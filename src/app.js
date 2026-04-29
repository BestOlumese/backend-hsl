import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import profileRoutes from './routes/profile.routes.js';
import authRoutes from './routes/auth.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(':method :url :status :response-time ms'));

// Gracefully intercept express.json() payload parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ status: 'error', message: 'Invalid JSON payload' });
  }
  next();
});

app.use('/auth', authRoutes);
app.use('/api', profileRoutes);

// Default 404 handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

export default app;