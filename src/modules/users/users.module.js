import { createResourceRoutes } from '../shared/resource.factory.js';
import { userSchema, userIndexes } from '../schemas/users.schema.js';
import {
  hashPasswordHook,
  checkCreateUserPermissionsHook,
  checkUpdateUserPermissionsHook,
  checkDeleteUserPermissionsHook,
} from './users.hooks.js';
import { userCreateHandler, userUpdateHandler } from './users.handlers.js';

// 1. Generate standard CRUD for 'users'
const baseUsersRoutes = createResourceRoutes('users', {
  schema: userSchema,
  indexes: userIndexes,
  hooks: {
    create: { preHandler: { hashPasswordHook, checkCreateUserPermissionsHook } },
    updateById: { preHandler: { hashPasswordHook, checkUpdateUserPermissionsHook } },
    deleteById: { preHandler: { checkDeleteUserPermissionsHook } },
  }
});

// 2. Override the generated handlers with our custom ones
baseUsersRoutes.users.create.handler = userCreateHandler;
baseUsersRoutes.users.updateById.handler = userUpdateHandler;

export const usersModule = baseUsersRoutes;
