import 'dotenv/config';
import redis from './redis.js';

const DYNAMIC_CONFIG_KEY = 'runtime-config';

const DYNAMIC_CONFIG_DEFAULTS = {
  CACHE_TTL_SECONDS: '120',
  CACHE_MAX_HITS: '5',
  CACHE_PREFIX: 'route-cache:',
};

// A short-lived in-memory cache to avoid querying Redis on every request.
let dynamicConfigCache = {};
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5000; // Cache for 5 seconds between Redis fetches.

async function seedDynamicConfig() {
  try {
    const exists = await redis.exists(DYNAMIC_CONFIG_KEY);
    if (!exists) {
      console.log('Seeding dynamic runtime configuration in Redis...');
      await redis.hset(DYNAMIC_CONFIG_KEY, DYNAMIC_CONFIG_DEFAULTS);
      console.log('Dynamic configuration seeded.');
    }
  } catch (error) {
    console.error('Failed to seed dynamic configuration in Redis:', error);
  }
}

async function getDynamicConfig() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION_MS && Object.keys(dynamicConfigCache).length > 0) {
    return dynamicConfigCache;
  }

  try {
    const configFromRedis = await redis.hgetall(DYNAMIC_CONFIG_KEY);
    dynamicConfigCache = configFromRedis;
    lastFetchTime = now;
    return dynamicConfigCache;
  } catch (error) {
    console.error('Could not fetch dynamic config from Redis. Using last known cache or defaults.', error);
    // Return the stale cache on error to prevent total failure.
    return dynamicConfigCache || DYNAMIC_CONFIG_DEFAULTS;
  }
}

export async function initializeConfig() {
  await seedDynamicConfig();
  await getDynamicConfig();
  console.log('Configuration system initialized.');
}

const config = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  ARANGO_URL: process.env.ARANGO_URL,
  ARANGO_USER: process.env.ARANGO_USER,
  ARANGO_PASSWORD: process.env.ARANGO_PASSWORD,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  ADMIN_AUDIT_COLLECTION: process.env.ADMIN_AUDIT_COLLECTION,
  ROUTE_CONTROL_KEY: process.env.ROUTE_CONTROL_KEY,

  get: async function(key, defaultValue = undefined) {
    const dynamicConf = await getDynamicConfig();
    if (dynamicConf && typeof dynamicConf[key] !== 'undefined') {
      return dynamicConf[key];
    }
    if (typeof this[key] !== 'undefined' && typeof this[key] !== 'function') {
      return this[key];
    }
    return defaultValue;
  },

  getAllDynamic: getDynamicConfig,

  updateDynamic: async function(updates) {
     await redis.hset(DYNAMIC_CONFIG_KEY, updates);
     lastFetchTime = 0;
  },

  DYNAMIC_CONFIG_DEFAULTS,
};

export default config;
