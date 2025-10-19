export const roleSchema = {
   create: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      permissions: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          additionalProperties: { type: 'boolean' }
        }
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
      _version: { type: 'integer' },
    },
    required: ['name', 'permissions']
  },
  update: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      permissions: {
        type: 'object',
         additionalProperties: {
          type: 'object',
          additionalProperties: { type: 'boolean' }
        }
      },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
    },
    minProperties: 1,
  },
};

export const roleIndexes = [
  {
    type: 'persistent',
    fields: ['name'],
    unique: true,
    name: 'idx_roles_name'
  }
];
