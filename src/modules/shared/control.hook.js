import redis from '../../config/redis.js';

export const messageControlHook = async (req, reply) => {
  const path = req.routerPath;
  let controlData = null;

  const exactMatch = await redis.hget(process.env.ROUTE_CONTROL_KEY, path);
  if (exactMatch) {
    controlData = JSON.parse(exactMatch);
  } else {
    const pathSegments = path.split('/').filter(Boolean);
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const wildcardPath = `/${pathSegments.slice(0, i).join('/')}/*`;
      const wildcardMatch = await redis.hget(process.env.ROUTE_CONTROL_KEY, wildcardPath);
      if (wildcardMatch) {
        controlData = JSON.parse(wildcardMatch);
        break;
      }
    }
  }

  if (controlData && controlData.message) {
    const statusCode = controlData.statusCode || 503;
    return reply.code(statusCode).send({
      message: controlData.message,
      controlRule: {
        path: controlData.path,
        reason: controlData.reason || 'Route is temporarily disabled by an administrator.',
      }
    });
  }
};
