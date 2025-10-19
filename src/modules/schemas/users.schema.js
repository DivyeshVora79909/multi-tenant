const addressSchema = {
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip: { type: 'string' },
    country: { type: 'string' },
  },
  required: ['street', 'city', 'state', 'zip', 'country'],
};

export const userSchema = {
  create: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 3 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phoneNumber: {
        type: 'string',
        pattern: '^\\+?[1-9]\\d{4,14}$'
      },
      address: addressSchema,
      dateOfBirth: { type: 'string', format: 'date' }, // YYYY-MM-DD
      roleId: { type: 'string' }, // The _key of the role to assign
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
      _version: { type: 'integer' },
    },
    required: ['username', 'email', 'password', 'firstName', 'lastName', 'roleId'],
  },
  update: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phoneNumber: { type: 'string' },
      address: addressSchema,
      dateOfBirth: { type: 'string', format: 'date' },
      roleId: { type: 'string' }, // The _key of the new role to assign
      deletedAt: { type: ['string', 'null'], format: 'date-time' },
    },
    minProperties: 1,
  },
};

export const userIndexes = [
  { type: 'persistent', fields: ['email'], unique: true, name: 'idx_users_email' },
  { type: 'persistent', fields: ['username'], unique: true, name: 'idx_users_username' },
  { type: 'persistent', fields: ['phoneNumber'], unique: true, name: 'idx_users_phone' },
  { type: 'persistent', fields: ['firstName', 'lastName'], name: 'idx_users_name' }
];
