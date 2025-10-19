import deepmerge from '@fastify/deepmerge';
import { userAuthModule } from '../shared/auth.module.js';
import { auditModule } from '../shared/audit.module.js';
import { createResourceRoutes } from '../shared/resource.factory.js';
import { productsSchema, productsIndexes } from '../schemas/products.schema.js';

const merge = deepmerge({ all: true });

const ecommerceTenant = merge(
  auditModule,
  userAuthModule,
  createResourceRoutes('products', {
    schema: productsSchema,
    indexes: productsIndexes,
  })
);

export default ecommerceTenant;
