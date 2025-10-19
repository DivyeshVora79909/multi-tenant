import deepmerge from '@fastify/deepmerge';
import { userAuthModule } from '../shared/auth.module.js';
import {
  getServerStatusHandler,
  getEnvHandler,
  updateEnvHandler,
  getRouteControlRulesHandler,
  setRouteControlRuleHandler,
  deleteRouteControlRuleHandler,
} from '../admin/admin.handlers.js';

const merge = deepmerge({ all: true });

const adminResources = {
  server: {
    status: {
      method: 'get',
      handler: getServerStatusHandler,
    },
    env: {
      get: {
        method: 'get',
        handler: getEnvHandler,
      },
      update: {
        method: 'patch',
        schema: {
          body: { type: 'object', additionalProperties: { type: 'string' } }
        },
        handler: updateEnvHandler,
      }
    }
  },
  control: {
    routes: {
      get: {
        method: 'get',
        handler: getRouteControlRulesHandler,
      },
      set: {
        method: 'post',
        schema: {
          body: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The routerPath to control (e.g., /ecommerce/products/:id or /admin/*)' },
              message: { type: ['string', 'null'], description: 'The message to display. Set to null or empty to re-enable the route.' },
              statusCode: { type: 'integer', minimum: 400, maximum: 599 },
              reason: { type: 'string' }
            },
            required: ['path', 'message']
          }
        },
        handler: setRouteControlRuleHandler,
      },
      delete: {
        method: 'delete',
        schema: {
          body: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        },
        handler: deleteRouteControlRuleHandler,
      }
    }
  }
};

const adminTenant = merge(
  userAuthModule,
  adminResources
);

export default adminTenant;
