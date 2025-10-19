export const edgeSchema = {
  create: {
    type: 'object',
    properties: {
      _from: { type: 'string' },
      _to: { type: 'string' },
      type: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
      _version: { type: 'integer' },
    },
    required: ['_from', '_to'],
  },
  update: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
    },
    minProperties: 1,
  },
};
