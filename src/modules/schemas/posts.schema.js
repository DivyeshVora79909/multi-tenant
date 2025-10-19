export const postsSchema = {
  create: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 3 },
      content: { type: 'string' },
      authorId: { type: 'string' },
      publishedAt: { type: 'string', format: 'date-time' },
      views: { type: 'integer', minimum: 0, default: 0 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
      _version: { type: 'integer' },
    },
    required: ['title', 'content', 'authorId'],
  },
  update: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 3 },
      content: { type: 'string' },
      views: { type: 'integer', minimum: 0 },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
    },
    minProperties: 1,
  },
};
