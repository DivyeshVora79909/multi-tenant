import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import deepmerge from '@fastify/deepmerge';
import { usersModule } from '../users/users.module.js';
import { rolesModule } from '../roles/roles.module.js';
import { authenticateHook } from '../users/users.hooks.js'; // authenticateHook is user-centric

const merge = deepmerge({ all: true });

// Define the standalone 'login' route
const loginRoute = {
  users: {
    login: {
      method: 'post',
      // Disable the global authentication hook for the login route itself
      preValidation: {
        authenticateHook: null
      },
      schema: { 
          body: {
          type: 'object',
          properties: { email: { type: 'string' }, password: { type: 'string' } },
          required: ['email', 'password']
      }},
      handler: async function loginHandler(req, reply) {
        const { email, password } = req.body;
        const db = req.db;
        const query = `
          LET user = FIRST(FOR u IN users FILTER u.email == @email LIMIT 1 RETURN u)
          FILTER user != null
          LET roleEdge = FIRST(FOR v, e IN 1..1 OUTBOUND user._id users_edge RETURN e)
          FILTER roleEdge != null
          RETURN { user, roleId: PARSE_IDENTIFIER(roleEdge._to).key }
        `;
        const cursor = await db.query(query, { email });
        const result = await cursor.next();

        if (!result || !await argon2.verify(result.user.password, password)) {
          return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials.' });
        }

        const { user, roleId } = result;
        const token = jwt.sign({ userId: user._key, roleId, email: user.email, tenant: req.params.tenantName },
            process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

        return { message: 'Login successful', token };
      },
    },
  }
};

// Assemble the final export by composing the other modules
export const userAuthModule = {
  // Apply authentication hook to all routes within this module by default
  preValidation: {
    authenticateHook,
  },
  ...merge(rolesModule, usersModule, loginRoute)
};
