import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  app.get('/ready', async () => {
    // Verificar dependências (banco de dados, etc.)
    return { status: 'ready' };
  });

  app.get('/live', async () => {
    // Liveness probe simples
    return { status: 'alive' };
  });
};
