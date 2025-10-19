import { aql } from 'arangojs';
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

export const logPatchHook = async (req, reply) => {
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;
    if (!req.body || Object.keys(req.body).length === 0) return;

    const documentId = `${req.collections.docs.name}/${req.params.id}`;
    const changelogCollection = req.collections.changelog;

    const logEntry = {
        timestamp: new Date().toISOString(),
        userId: req.auth?.userId || null,
        roleId: req.auth?.roleId || null,
        patch: req.body
    };

    const query = aql`
        UPSERT { documentId: ${documentId} }
        INSERT {
            documentId: ${documentId},
            changes: [${logEntry}],
            createdAt: UTC_TIMESTAMP(),
            updatedAt: UTC_TIMESTAMP()
        }
        UPDATE {
            changes: APPEND(OLD.changes, ${logEntry}),
            updatedAt: UTC_TIMESTAMP()
        }
        IN ${changelogCollection}
    `;

    try {
        req.db.query(query);
    } catch (error) {
        req.log.error({ err: error, documentId }, `Failed to write to changelog collection '${changelogCollection.name}'`);
    }
};

export const logBulkPatchHook = async (req, reply) => {
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;
    if (!req.body || Object.keys(req.body).length === 0 || !req.updatedKeys || req.updatedKeys.length === 0) return;

    const changelogCollection = req.collections.changelog;

    const logEntry = {
        timestamp: new Date().toISOString(),
        userId: req.auth?.userId || null,
        roleId: req.auth?.roleId || null,
        patch: req.body
    };

    for (const key of req.updatedKeys) {
      const documentId = `${req.collections.docs.name}/${key}`;
      const query = aql`
        UPSERT { documentId: ${documentId} }
        INSERT { documentId: ${documentId}, changes: [${logEntry}], createdAt: UTC_TIMESTAMP(), updatedAt: UTC_TIMESTAMP() }
        UPDATE { changes: APPEND(OLD.changes, ${logEntry}), updatedAt: UTC_TIMESTAMP() }
        IN ${changelogCollection}
      `;
      try {
        req.db.query(query);
      } catch (error) {
        req.log.error({ err: error, documentId }, `Failed to write bulk patch to changelog`);
      }
    }
};