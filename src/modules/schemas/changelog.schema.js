export const changelogSchema = {
  create: {
    type: 'object',
    properties: {
      documentId: { type: 'string' },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            userId: { type: ['string', 'null'] },
            roleId: { type: ['string', 'null'] },
            patch: { type: 'object', additionalProperties: true }
          },
          required: ['timestamp', 'patch']
        }
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['documentId', 'changes']
  },
  update: {
      type: 'object',
      properties: {}
  }
};

export const changelogIndexes = [
    { type: 'persistent', fields: ['documentId'], unique: true, name: 'idx_changelog_documentId' }
];