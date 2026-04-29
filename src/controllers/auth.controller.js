import axios from 'axios';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../db/database.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/github/callback';

export const githubAuth = (req, res) => {
  const { state, code_challenge, code_challenge_method, redirect_uri } = req.query;
  
  const rUri = redirect_uri || REDIRECT_URI;
  let url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${rUri}&scope=user:email`;
  
  if (state) url += `&state=${state}`;
  if (code_challenge) {
    url += `&code_challenge=${code_challenge}&code_challenge_method=${code_challenge_method || 'S256'}`;
  }
  
  res.redirect(url);
};

export const githubCallback = async (req, res) => {
  const { code, state, code_verifier, redirect_uri } = { ...req.query, ...req.body };
  const db = await getDb();

  const rUri = redirect_uri || REDIRECT_URI;

  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: rUri,
      code_verifier // PKCE
    }, {
      headers: { Accept: 'application/json' }
    });

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({ status: 'error', message: 'Failed to exchange code for access token' });
    }

    // Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const githubUser = userResponse.data;

    // Get email (might be private)
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const primaryEmail = emailsResponse.data.find(e => e.primary);
      email = primaryEmail ? primaryEmail.email : null;
    }

    // Check if user exists
    let user = await db.get('SELECT * FROM users WHERE github_id = ?', [githubUser.id.toString()]);

    if (user) {
      // Update last login
      await db.run('UPDATE users SET last_login_at = ?, username = ?, avatar_url = ?, email = ? WHERE id = ?', 
        [new Date().toISOString(), githubUser.login, githubUser.avatar_url, email, user.id]);
    } else {
      // Create user
      user = {
        id: uuidv7(),
        github_id: githubUser.id.toString(),
        username: githubUser.login,
        email: email,
        avatar_url: githubUser.avatar_url,
        role: 'analyst', // Default role
        is_active: 1,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };
      await db.run(
        'INSERT INTO users (id, github_id, username, email, avatar_url, role, is_active, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user.id, user.github_id, user.username, user.email, user.avatar_url, user.role, user.is_active, user.created_at, user.last_login_at]
      );
    }

    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'User account is inactive' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    await db.run('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [refreshToken, user.id, expiresAt]);

    // Check if it's a CLI request (maybe via state or a header)
    // If it's a redirect-based flow, we might want to return tokens in a specific way
    // For the CLI PKCE flow, the CLI will call an endpoint with the code.
    
    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: refreshToken
    });

  } catch (error) {
    console.error('Auth error:', error.response?.data || error.message);
    res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
};

export const refresh = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ status: 'error', message: 'Refresh token required' });
  }

  const db = await getDb();
  try {
    const decoded = verifyRefreshToken(refresh_token);
    const storedToken = await db.get('SELECT * FROM refresh_tokens WHERE token = ?', [refresh_token]);

    if (!storedToken) {
      return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
    }

    // Invalidate old token immediately
    await db.run('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);

    if (new Date(storedToken.expires_at) < new Date()) {
      return res.status(401).json({ status: 'error', message: 'Refresh token expired' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user || !user.is_active) {
      return res.status(401).json({ status: 'error', message: 'User not found or inactive' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    await db.run('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [newRefreshToken, user.id, expiresAt]);

    res.json({
      status: 'success',
      access_token: newAccessToken,
      refresh_token: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
  }
};

export const logout = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ status: 'error', message: 'Refresh token required' });
  }

  const db = await getDb();
  await db.run('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
  
  res.json({ status: 'success', message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  // req.user is populated by authenticate middleware
  res.json({
    status: 'success',
    data: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      avatar_url: req.user.avatar_url,
      role: req.user.role,
      last_login_at: req.user.last_login_at,
      created_at: req.user.created_at
    }
  });
};
