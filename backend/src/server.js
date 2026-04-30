import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { initSocket } from './sockets/index.js';

const start = async () => {
  await connectDatabase();

  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io);

  server.listen(config.port, () => {
    console.log(`[server] running on port ${config.port} (${config.env})`);
    console.log(`[server] API: http://localhost:${config.port}${config.apiPrefix}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] received ${signal}, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    process.exit(1);
  });
};

start();
