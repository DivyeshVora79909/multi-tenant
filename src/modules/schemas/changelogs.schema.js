export const changelogSchema = {
  create: {
    type: 'object',
    properties: {
      documentId: { type: 'string' },
      diff: { type: 'object', additionalProperties: true },
      length: { type: 'integer' },
      userId: { type: ['string', 'null'] },
      roleId: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
      _note: { type: 'string' },
    },
    required: ['documentId', 'diff', 'createdAt'],
  },
  update: {
      type: 'object',
      properties: {}
  }
};