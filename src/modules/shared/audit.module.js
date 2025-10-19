import { createResourceRoutes } from './resource.factory.js';
import { auditLogSchema } from '../schemas/auditLogs.schema.js';
import { capturePayloadHook, auditLoggerHook } from './common.hooks.js';

// Get routes for managing the audit logs themselves
const auditLogManagementRoutes = createResourceRoutes(process.env.ADMIN_AUDIT_COLLECTION || 'auditLogs', {
  schema: auditLogSchema,
  enable: ['read', 'readById', 'readBulk', 'deleteById', 'deleteBulk'],
  enableEdges: false,
  hooks: {
    // For routes that READ audit logs, we don't want to create an audit log of the action.
    // We declaratively disable the inherited 'auditLoggerHook'.
    onResponse: {
      auditLoggerHook: null
    },
  },
});

export const auditModule = {
  // These hooks will apply to all other routes in the tenant where this module is merged
  onSend: { capturePayloadHook },
  onResponse: { auditLoggerHook },
  ...auditLogManagementRoutes,
};
