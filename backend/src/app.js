import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';

import { config, rootDir } from './config/index.js';
import routes from './routes/index.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

if (config.env !== 'test') app.use(morgan('dev'));

app.use(generalLimiter);

app.use(
  '/static',
  express.static(path.join(rootDir, config.storage.uploadDir), {
    maxAge: '7d',
    immutable: true,
  })
);

app.use(config.apiPrefix, routes);

app.get('/', (_req, res) => {
  res.json({
    name: 'SYT Marketplace API',
    version: '1.0.0',
    docs: `${config.apiPrefix}/health`,
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
