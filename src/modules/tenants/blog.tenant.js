import deepmerge from '@fastify/deepmerge';
import { userAuthModule } from '../shared/auth.module.js';
import { auditModule } from '../shared/audit.module.js';
import { createResourceRoutes } from '../shared/resource.factory.js';
import { postsSchema } from '../schemas/posts.schema.js';

const merge = deepmerge({ all: true });

const blogTenant = merge(
  auditModule,
  userAuthModule,
  createResourceRoutes('posts', { schema: postsSchema })
);

export default blogTenant;
