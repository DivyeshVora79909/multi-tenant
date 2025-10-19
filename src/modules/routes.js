import deepmerge from '@fastify/deepmerge';
import blogTenant from './tenants/blog.tenant.js';
import ecommerceTenant from './tenants/ecommerce.tenant.js';
import adminTenant from './tenants/admin.tenant.js';
import demoRoutes from './demo/demo.routes.js';
import { cacheOnRequestHook, cacheOnSendHook } from './shared/cache.hooks.js';
import { messageControlHook } from './shared/control.hook.js';

const merge = deepmerge({ all: true });

// Custom route for a specific tenant
const nomadShubhamTenant = merge({}, blogTenant);
nomadShubhamTenant.posts.latest = {
  method: 'get',
  path: '/latest',
  handler: async function getLatestPostHandler(req, reply) {
    const query = `
      FOR p IN posts
      SORT p.publishedAt DESC
      LIMIT 1
      RETURN p
    `;
    const cursor = await req.db.query(query);
    const latestPost = await cursor.next();

    if (!latestPost) {
      return reply.code(404).send({ message: 'No posts found.' });
    }
    return latestPost;
  }
};

// Define global hooks using the new object syntax
const rootRoutes = {
  onRequest: {
    messageControlHook,
    cacheOnRequestHook,
    logRequest: async function logRequest(req) {
      console.log(`[GLOBAL] ==> ${req.method} ${req.raw.url}`);
    }
  },
  onSend: {
    cacheOnSendHook
  },

  // Tenants
  GauriRocks: merge({}, blogTenant),
  Ishita_blogs: merge({}, blogTenant),
  nomad_shubham: nomadShubhamTenant,
  ecommerce: ecommerceTenant,
  demo: demoRoutes,
  admin: adminTenant,
};

export default rootRoutes;
