import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import rootRoutes from './modules/routes.js';
import { compileRoutes } from './core/routeCompiler.js';
import redis from './config/redis.js';
import { db } from './config/database.js';
import { initializeConfig } from './config/config.js';

const fastify = Fastify({
  logger: true,
});

async function start() {
  try {
    await initializeConfig();

    await fastify.register(helmet);
    await fastify.register(cors, {
      origin: '*',
    });

    await fastify.register(rateLimit, {
      max: 45,
      timeWindow: '1 minute',
      redis: redis,
    });

    fastify.get('/health', async (request, reply) => {
      const healthcheck = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        status: 'OK',
        services: {
          arangodb: { status: 'unavailable' },
          redis: { status: 'unavailable' },
        },
      };

      try {
        await db.version();
        healthcheck.services.arangodb.status = 'available';
      } catch (error) {
        fastify.log.error(error, 'ArangoDB health check failed');
        healthcheck.status = 'ERROR';
      }

      try {
        const redisPing = await redis.ping();
        if (redisPing === 'PONG') {
          healthcheck.services.redis.status = 'available';
        } else {
            throw new Error(`Redis ping returned: ${redisPing}`);
        }
      } catch (error) {
        fastify.log.error(error, 'Redis health check failed');
        healthcheck.status = 'ERROR';
      }

      const statusCode = healthcheck.status === 'OK' ? 200 : 503;
      return reply.code(statusCode).send(healthcheck);
    });

    await compileRoutes(fastify, rootRoutes);

    const port = parseInt(process.env.PORT, 10) || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    try {
      fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
      await fastify.close();
      fastify.log.info('Fastify server closed.');
      await redis.quit();
      fastify.log.info('Redis connection closed.');
      await db.close();
      fastify.log.info('ArangoDB connection closed.');
      fastify.log.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
}

start();
