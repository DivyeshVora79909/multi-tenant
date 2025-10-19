import { setupTenantDatabase, setupResourceCollections } from '../config/database.js';

const hookLifecycle = [
  'onRequest', 'preParsing', 'preValidation', 'preHandler',
  'preSerialization', 'onError', 'onSend', 'onResponse',
  'onTimeout', 'onRequestAbort'
];

function mergeConfigs(parent, child) {
  const merged = { ...parent };

  for (const key in child) {
    if (Object.prototype.hasOwnProperty.call(child, key)) {
      if (hookLifecycle.includes(key) && typeof parent[key] === 'object' && parent[key] !== null) {
        merged[key] = { ...parent[key], ...child[key] };
      } else if (typeof child[key] === 'object' && child[key] !== null && !Array.isArray(child[key]) && typeof parent[key] === 'object' && parent[key] !== null) {
        merged[key] = mergeConfigs(parent[key], child[key]);
      } else {
        merged[key] = child[key];
      }
    }
  }
  return merged;
}


function isRouteDefinition(obj) {
  return obj && typeof obj.handler === 'function' && typeof obj.method === 'string';
}

function extractConfig(definition) {
  if (!definition || typeof definition !== 'object') return {};
  const config = {};
  for (const key of hookLifecycle) {
    if (key in definition) {
      config[key] = definition[key];
    }
  }
  return config;
}

function normalizeHookInfo(config) {
  const info = {};
  for (const key of hookLifecycle) {
    const raw = config[key];
    if (!raw || typeof raw !== 'object') {
      info[key] = { count: 0, names: [] };
      continue;
    }
    const activeHooks = Object.entries(raw).filter(([_, func]) => func);
    info[key] = {
      count: activeHooks.length,
      names: activeHooks.map(([name, _]) => name)
    };
  }
  return info;
}

async function processRouteNode(fastify, node, parentConfig, tenantDb, routeSummaries) {
  const localConfig = extractConfig(node);
  const currentConfig = mergeConfigs(parentConfig, localConfig);

  if (node._isCollection) {
    const pathParts = (fastify.prefix || '').split('/').filter(Boolean);
    const collectionName = pathParts[pathParts.length - 1];
    if (collectionName) {
      // Correctly pass the indexes to the setup function
      const collections = await setupResourceCollections(tenantDb, collectionName, node._indexes || []);
      fastify.addHook('preHandler', async function injectCollections(request) {
        request.collections = collections;
      });
    }
  }

  for (const key in node) {
    if (key.startsWith('_') || hookLifecycle.includes(key)) continue;
    const childRouteNode = node[key];
    if (!childRouteNode || typeof childRouteNode !== 'object') continue;

    if (isRouteDefinition(childRouteNode)) {
      const handlerDefinition = childRouteNode;
      let finalRouteConfig = mergeConfigs(currentConfig, handlerDefinition);

      const finalUrl = `${handlerDefinition.path || ''}`;
      const routePath = `/${key}${finalUrl}`.replace(/\/+/g, '/');
      const routeOptions = {
        method: finalRouteConfig.method,
        url: routePath === '/' && key !== '' ? `/${key}` : routePath,
        ...finalRouteConfig
      };
      
      for (const hookName of hookLifecycle) {
          if (routeOptions[hookName] && typeof routeOptions[hookName] === 'object') {
              routeOptions[hookName] = Object.values(routeOptions[hookName]).filter(Boolean);
          }
      }

      fastify.route(routeOptions);

      const fullPath = (fastify.prefix + routeOptions.url).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      const hookInfo = normalizeHookInfo(finalRouteConfig);
      const handlerName = handlerDefinition.handler?.name || finalRouteConfig.handler?.name || 'anonymous';
      routeSummaries.push({
        method: String(routeOptions.method).toUpperCase(),
        path: fullPath,
        handler: handlerName,
        hooks: hookInfo
      });

    } else {
      await fastify.register(async (childInstance) => {
        await processRouteNode(childInstance, childRouteNode, currentConfig, tenantDb, routeSummaries);
      }, { prefix: `/${key}` });
    }
  }
}

export async function compileRoutes(fastify, routesObject) {
  const routeSummary = {};
  const globalConfig = extractConfig(routesObject);

  for (const tenantName in routesObject) {
    if (tenantName.startsWith('_') || hookLifecycle.includes(tenantName)) continue;
    const tenantDef = routesObject[tenantName];
    if (typeof tenantDef !== 'object' || tenantDef === null) continue;

    const tenantDb = await setupTenantDatabase(tenantName);
    routeSummary[tenantName] = [];

    await fastify.register(async (tenantInstance) => {
      tenantInstance.addHook('preHandler', async function injectTenantInfo(request) {
        request.db = tenantDb;
        request.params = Object.assign({}, request.params, { tenantName });
      });

      await processRouteNode(tenantInstance, tenantDef, globalConfig, tenantDb, routeSummary[tenantName]);

    }, { prefix: `/${tenantName}` });
  }

  for (const tenant in routeSummary) {
    console.log(`\nTenant: ${tenant} (${routeSummary[tenant].length} routes)`);
    const tableData = routeSummary[tenant].map(entry => ({
      Method: entry.method,
      Path: entry.path,
      Handler: entry.handler,
      Hooks: Object.entries(entry.hooks)
        .filter(([_, info]) => info.count > 0)
        .map(([key, info]) => `${key}: [${info.names.join(', ')}]`)
        .join(' | ')
        || 'None',
    }));
    console.table(tableData);
  }
}
