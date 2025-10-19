export const auditLogSchema = {
  create: {
    type: 'object',
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      tenantName: { type: 'string' },
      ip: { type: 'string' },
      userId: { type: ['string', 'null'] },
      userEmail: { type: ['string', 'null'] },
      roleId: { type: ['string', 'null'] },
      method: { type: 'string' },
      path: { type: 'string' },
      statusCode: { type: 'integer' },
      requestBody: { type: 'object', additionalProperties: true },
      responseBody: { type: 'object', additionalProperties: true },
      query: { type: 'object', additionalProperties: true },
      params: { type: 'object', additionalProperties: true },
    },
    required: ['timestamp', 'tenantName', 'ip', 'method', 'path', 'statusCode'],
  },
  update: {
    type: 'object',
    properties: {},
  },
};
