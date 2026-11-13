import express from 'express';
import * as path from 'node:path';
import 'dotenv/config';
import apiRoutes from './routes/api.js';
import aiApiRoutes from './routes/aiApi.js';
import healthRoutes from './routes/health.js';
import pageRoutes from './routes/pages.js';
import providerApiRoutes from './routes/providerApi.js';
import listApiRoutes from './routes/listApi.js';
import authApiRoutes from './routes/authApi.js';
import bothubApiRoutes from './routes/bothubApi.js';
import helpApiRoutes from './routes/helpApi.js';
import { requireAdminPageAuth } from './middleware/adminAuth.js';
import { aiRateLimit, bothubRateLimit } from './middleware/rateLimit.js';
import { ensureSchema } from './db/migrate.js';

const projectRoot = process.cwd();

ensureSchema();

const app = express();

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.get('/favicon.ico', (_req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(projectRoot, 'src/public/favicon.svg'));
});
app.use(express.static(path.join(projectRoot, 'src/public')));

app.set('view engine', 'ejs');
app.set('views', path.join(projectRoot, 'src/views'));

app.use('/health', healthRoutes);
app.use('/api/auth', authApiRoutes);
app.use('/api/models', apiRoutes);
app.use('/api/providers', providerApiRoutes);
app.use('/api/lists', listApiRoutes);
app.use('/api/ai', aiRateLimit, aiApiRoutes);
app.use('/api/bothub', bothubRateLimit, bothubApiRoutes);
app.use('/api/help', helpApiRoutes);
app.use('/admin', requireAdminPageAuth);
app.use('/', pageRoutes);

export default app;
