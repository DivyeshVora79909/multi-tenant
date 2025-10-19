import redis from '../../config/redis.js';
import config from '../../config/config.js';

export const cacheOnRequestHook = async (req, reply) => {
  req.logContext = req.logContext || {};
  
  // Only cache GET requests and respect route-specific overrides
  if (req.method !== 'GET' || req.routeOptions.config?.cache === false) {
    req.logContext.cacheStatus = 'BYPASS';
    return;
  }

  const CACHE_PREFIX = await config.get('CACHE_PREFIX');
  const CACHE_MAX_HITS = parseInt(await config.get('CACHE_MAX_HITS'), 10);

  const cacheKey = `${CACHE_PREFIX}${req.raw.url}`;
  const cached = await redis.hgetall(cacheKey);

  if (cached && Object.keys(cached).length > 0) {
    const hits = parseInt(cached.hits, 10);
    
    req.logContext.cacheStatus = 'HIT';
    req.logContext.cacheHits = hits + 1;

    if (hits >= CACHE_MAX_HITS) {
      await redis.del(cacheKey);
      reply.header('X-Cache', 'EXPIRED-HITS');
      req.isCacheable = true;
      req.logContext.cacheAction = 'EXPIRED-HITS';
      return;
    }

    await redis.hincrby(cacheKey, 'hits', 1);

    const headers = JSON.parse(cached.headers);
    reply.headers(headers)
         .code(parseInt(cached.statusCode, 10))
         .header('X-Cache', 'HIT')
         .header('X-Cache-Hits', hits + 1);

    return reply.send(cached.body);
  }

  reply.header('X-Cache', 'MISS');
  req.logContext.cacheStatus = 'MISS';
  req.isCacheable = true;
};

export const cacheOnSendHook = async (req, reply, payload) => {
  if (!req.isCacheable || reply.statusCode >= 300) {
    return payload;
  }

  const CACHE_PREFIX = await config.get('CACHE_PREFIX');
  const CACHE_TTL_SECONDS = parseInt(await config.get('CACHE_TTL_SECONDS'), 10);

  const cacheKey = `${CACHE_PREFIX}${req.raw.url}`;
  const headersToCache = { ...reply.getHeaders(), 'content-type': reply.getHeader('content-type') };

  try {
    const multi = redis.multi();
    multi.hset(cacheKey, 'body', payload);
    multi.hset(cacheKey, 'statusCode', reply.statusCode);
    multi.hset(cacheKey, 'headers', JSON.stringify(headersToCache));
    multi.hset(cacheKey, 'hits', 1);
    multi.expire(cacheKey, CACHE_TTL_SECONDS);
    await multi.exec();
    
    if (req.logContext) {
      req.logContext.cacheAction = 'WRITTEN';
    }
    
  } catch (err) {
    req.log.error({ err, cacheKey }, 'Failed to write to cache');
  }

  return payload;
};
