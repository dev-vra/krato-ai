import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { userRoutes } from './routes/users.js';

export async function buildServer() {
  const app = Fastify({
    logger: false, // Usamos nosso logger customizado
  });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(sensible);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(userRoutes, { prefix: '/api/users' });

  // Error handler global
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error }, 'Unhandled error');
    
    reply.status(error.statusCode || 500).send({
      error: error.name,
      message: error.message,
      statusCode: error.statusCode || 500,
    });
  });

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info({ signal }, 'Shutting down...');
      await app.close();
      process.exit(0);
    });
  });

  return app;
}

// Start server
if (require.main === module) {
  buildServer()
    .then((app) => {
      app.listen({ port: env.PORT, host: env.HOST }, (err) => {
        if (err) {
          logger.error(err, 'Failed to start server');
          process.exit(1);
        }
        logger.info({ port: env.PORT, host: env.HOST }, 'Server started');
      });
    })
    .catch((err) => {
      logger.error(err, 'Failed to build server');
      process.exit(1);
    });
}
