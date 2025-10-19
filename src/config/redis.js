import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  maxRetriesPerRequest: 1,
  showFriendlyErrorStack: process.env.NODE_ENV === 'development',
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis.');
});

redis.on('error', (err) => {
  console.error('Could not connect to Redis:', err);
});

export default redis;
