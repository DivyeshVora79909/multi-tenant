import { createResourceRoutes } from '../shared/resource.factory.js';
import { roleSchema, roleIndexes } from '../schemas/roles.schema.js';
import {
  checkCreateRolePermissionsHook,
  checkUpdateRolePermissionsHook,
  checkDeleteRolePermissionsHook,
} from './roles.hooks.js';

// Generate standard CRUD for 'roles' and inject permission check hooks
export const rolesModule = createResourceRoutes('roles', {
  schema: roleSchema,
  indexes: roleIndexes,
  enable: ['create', 'read', 'readById', 'readBulk', 'updateById', 'deleteById'],
  hooks: {
    create: { preHandler: { checkCreateRolePermissionsHook } },
    updateById: { preHandler: { checkUpdateRolePermissionsHook } },
    deleteById: { preHandler: { checkDeleteRolePermissionsHook } },
  },
});
