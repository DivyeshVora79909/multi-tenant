import { shallowCloneAndTruncate, redactSensitiveFields } from "./common.utils.js";

export const capturePayloadHook = async (req, reply, payload) => {
  reply.loggablePayload = payload;
  return payload;
};

export const auditLoggerHook = async (req, reply) => {
  const auditCollectionName = process.env.ADMIN_AUDIT_COLLECTION || 'auditLogs';
  if (!req.db) {
    return;
  }

  try {
    let parsedPayload;
    if (reply.loggablePayload) {
      try {
        parsedPayload = JSON.parse(reply.loggablePayload);
      } catch (e) {
        parsedPayload = { _raw: 'Payload is not valid JSON or is binary.' };
      }
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      tenantName: req.params.tenantName,
      ip: req.ip,
      userId: req.auth?.userId || null,
      userEmail: req.auth?.email || null,
      roleId: req.auth?.roleId || null,
      method: req.method,
      path: req.raw.url,
      statusCode: reply.statusCode,
      query: redactSensitiveFields(shallowCloneAndTruncate(req.query)),
      params: redactSensitiveFields(shallowCloneAndTruncate(req.params)),
      requestBody: redactSensitiveFields(shallowCloneAndTruncate(req.body)),
      responseBody: redactSensitiveFields(shallowCloneAndTruncate(parsedPayload)),
    };
    if (req.logContext) logEntry.context = redactSensitiveFields(shallowCloneAndTruncate(req.logContext));

    await req.db.collection(auditCollectionName).save(logEntry);
  } catch (error) {
    const logger = req.log || console;
    logger.error({ err: error }, 'Failed to write to audit log');
  }
};
