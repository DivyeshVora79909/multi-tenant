export const productsSchema = {
  create: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      sku: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      inventory: { type: 'integer', minimum: 0 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
      _version: { type: 'integer' },
    },
    required: ['name', 'sku', 'price', 'inventory'],
  },
  update: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      inventory: { type: 'integer', minimum: 0 },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
    },
    minProperties: 1,
  },
};

export const productsIndexes = [
  { type: 'persistent', fields: ['sku'], unique: true, name: 'idx_products_sku' },
  { type: 'persistent', fields: ['price'], name: 'idx_products_price' }
];
