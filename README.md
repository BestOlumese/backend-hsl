# Insighta Labs+ - Secure Profile Intelligence System

Insighta Labs+ is a secure, multi-interface platform for demographic intelligence. It builds upon the Stage 2 Intelligence Query Engine by adding robust authentication, role-based access control, and dedicated CLI and Web interfaces.

## 🌟 Key Features (Stage 3)

- **Secure Authentication:** GitHub OAuth with PKCE for both CLI and Web.
- **Token Lifecycle Management:** Secure Access (3m) and Refresh (5m) token rotation.
- **Role-Based Access Control (RBAC):**
  - `admin`: Full access (CRUD + Query).
  - `analyst`: Read-only access (Read + Search).
- **Multi-Interface Access:**
  - **CLI Tool:** Globally installable `insighta` command.
  - **Web Portal:** Premium Next.js dashboard with metrics and profiles.
- **API Versioning:** Strict `X-API-Version: 1` requirement for all profile endpoints.
- **Advanced Export:** Export filtered profile data directly to CSV.
- **Rate Limiting & Logging:** Per-user rate limiting and detailed request logging.

## 🏗️ System Architecture

The system consists of three main components:
1. **Backend:** Express.js API with LibSQL (Turso) persistence.
2. **CLI:** Node.js command-line tool with browser-based OAuth flow.
3. **Web Portal:** Next.js application with secure HTTP-only cookie session management.

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd backend-stage0
npm install
```
Configure `.env`:
```env
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
REDIRECT_URI=http://localhost:5000/auth/github/callback
```
Run the server:
```bash
npm run dev
```

### 2. CLI Setup
```bash
cd cli
npm install
npm link # To install globally
```
Usage:
```bash
insighta login
insighta profiles list --gender male
insighta profiles search "young males from nigeria"
insighta profiles export --format csv
```

### 3. Web Portal Setup
```bash
cd web
npm install
npm run dev
```
Accessible at `http://localhost:3000`.

## 🔒 Security Implementation

### OAuth with PKCE
The CLI uses Proof Key for Code Exchange (PKCE) to securely authenticate users without a pre-shared secret. It generates a `code_verifier` and `code_challenge`, opens the browser for GitHub auth, and captures the code via a local callback server.

### Token Handling
- **Access Tokens:** Short-lived (3 mins) JWTs used for authentication.
- **Refresh Tokens:** Short-lived (5 mins) JWTs used to rotate access tokens. Refresh tokens are invalidated immediately after use.
- **Web Security:** Uses HTTP-only cookies to prevent XSS-based token theft.

### Role Enforcement
Roles are enforced via a centralized middleware that checks the `role` field in the user's record before allowing access to restricted endpoints like `POST /api/profiles` or `DELETE /api/profiles/:id`.

## 📡 API Versioning
All profile-related requests must include the following header:
`X-API-Version: 1`

## 📊 Rate Limiting
- `/auth/*`: 10 requests per minute.
- `/api/*`: 60 requests per minute per user.

## 📝 Engineering Standards
- **Conventional Commits:** `feat(auth): ...`, `fix(cli): ...`
- **CI/CD:** GitHub Actions for linting, testing, and build checks.