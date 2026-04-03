import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import cmaRouter from './api/cma/index.js';
import cdaRouter from './api/cda/index.js';
import previewRouter from './api/preview/index.js';
import extensionRouter from './extensions/router.js';
import { wireEventHandlers } from './events/wire.js';
import { apiRateLimiter, loginRateLimiter } from './auth/rate-limit.js';

const app = express();

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Rate limiting on login route (applied before CMA router so it runs first)
app.use('/cma/v1/auth/login', loginRateLimiter);

// API surfaces
app.use('/cma/v1', apiRateLimiter, cmaRouter);
app.use('/cda/v1', cdaRouter);
app.use('/preview/v1', previewRouter);
app.use('/api/v1', extensionRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// Start
async function start() {
  await prisma.$connect();
  console.log('Database connected');

  wireEventHandlers();

  app.listen(config.port, () => {
    console.log(`HTMLess API running on http://localhost:${config.port}`);
    console.log(`  CMA: /cma/v1`);
    console.log(`  CDA: /cda/v1`);
    console.log(`  Preview: /preview/v1`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
