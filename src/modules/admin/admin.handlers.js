import os from 'os';
import redis from '../../config/redis.js';
import { redactSensitiveFields } from '../shared/common.utils.js';
import config from '../../config/config.js';

export const getServerStatusHandler = async (req, reply) => {
  const memoryUsage = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: process.platform,
    cpuUsage: process.cpuUsage(),
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    },
    cpus: os.cpus().length,
  };
};

export const getEnvHandler = async (req, reply) => {
  const staticConfig = redactSensitiveFields(process.env);
  const dynamicConfig = await config.getAllDynamic();

  return {
    static: staticConfig,
    dynamic: dynamicConfig,
    updatable: config.DYNAMIC_CONFIG_DEFAULTS,
  };
};

export const updateEnvHandler = async (req, reply) => {
  const updates = req.body;
  const appliedChanges = {};
  const failedChanges = {};

  const updatableEnvVars = Object.keys(config.DYNAMIC_CONFIG_DEFAULTS);

  for (const key in updates) {
    if (updatableEnvVars.includes(key)) {
      appliedChanges[key] = updates[key];
    } else {
      failedChanges[key] = 'This variable is not whitelisted for runtime updates.';
    }
  }

  if (Object.keys(failedChanges).length > 0) {
    return reply.code(400).send({
      message: 'Some variables could not be updated.',
      appliedChanges,
      failedChanges,
    });
  }

  if (Object.keys(appliedChanges).length > 0) {
    await config.updateDynamic(appliedChanges);
  }

  return {
    message: 'Dynamic configuration variables updated successfully.',
    appliedChanges,
  };
};

export const getRouteControlRulesHandler = async (req, reply) => {
  const rules = await redis.hgetall(process.env.ROUTE_CONTROL_KEY);
  for (const key in rules) {
    try {
      rules[key] = JSON.parse(rules[key]);
    } catch (error) {
      console.error(`Failed to parse rule for key ${key}:`, error);
      rules[key] = { error: 'Invalid format in storage' };
    }
  }
  return rules;
};

export const setRouteControlRuleHandler = async (req, reply) => {
  const { path, ...ruleData } = req.body;
  const ruleToStore = { path, ...ruleData };
  await redis.hset(process.env.ROUTE_CONTROL_KEY, path, JSON.stringify(ruleToStore));
  return { status: 'ok', path, rule: ruleToStore };
};

export const deleteRouteControlRuleHandler = async (req, reply) => {
  const { path } = req.body;
  const result = await redis.hdel(process.env.ROUTE_CONTROL_KEY, path);
  if (result === 0) {
    return reply.code(404).send({ error: 'Not Found', message: `No control rule found for path: ${path}` });
  }
  return reply.code(204).send();
};
