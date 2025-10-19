import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { aql } from 'arangojs';

const isSubsetPermissions = (subset, superset) => {
  if (!subset || !superset) return false;
  for (const path in subset) {
    if (!superset[path]) return false;
    for (const method in subset[path]) {
      if (!superset[path][method]) return false;
    }
  }
  return true;
};

export const authenticateHook = async (req, reply) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authorization header is missing or invalid.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = req.db;
    const role = await db.collection('roles').document(decoded.roleId);

    const pathTemplate = req.routerPath.replace(`/${req.params.tenantName}`, '');
    const method = req.method.toUpperCase();

    if (role.permissions?.[pathTemplate]?.[method] !== true) {
      return reply.code(403).send({ error: 'Forbidden', message: 'You do not have permission to perform this action.' });
    }

    req.auth = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      email: decoded.email,
      tenant: req.params.tenantName,
      rolePermissions: role.permissions,
    };
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return reply.code(401).send({ error: 'Unauthorized', message: `Invalid or expired token: ${err.message}` });
    }
    if (err.isArangoError && err.code === 404) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Associated role not found.' });
    }
    throw err;
  }
};

export const hashPasswordHook = async (req) => {
  if (req.body && req.body.password) {
    req.body.password = await argon2.hash(req.body.password);
  }
};

export const checkCreateUserPermissionsHook = async (req, reply) => {
  const { roleId } = req.body;
  if (!roleId) return;
  try {
    const role = await req.db.collection('roles').document(roleId);
    if (!isSubsetPermissions(role.permissions, req.auth.rolePermissions)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Cannot assign a role with permissions beyond your own.' });
    }
  } catch (err) {
    if (err.isArangoError && err.code === 404) {
      return reply.code(404).send({ error: 'Not Found', message: `The role with ID '${roleId}' does not exist.` });
    }
    throw err;
  }
};

export const checkUpdateUserPermissionsHook = async (req, reply) => {
  const { id } = req.params;
  const db = req.db;

  const query = aql`
    LET user = DOCUMENT('users', ${id})
    FILTER user != null
    LET roleEdge = FIRST(FOR v, e IN 1..1 OUTBOUND user._id users_edge RETURN e)
    FILTER roleEdge != null
    LET role = DOCUMENT(roleEdge._to)
    RETURN role.permissions
  `;
  const cursor = await db.query(query);
  const currentPermissions = await cursor.next();

  if (!currentPermissions) {
    const userExists = await req.collections.docs.exists(id);
    if (userExists) {
      return reply.code(404).send({ error: 'Not Found', message: 'Role not found for the specified user.' });
    }
    return;
  }

  if (!isSubsetPermissions(currentPermissions, req.auth.rolePermissions)) {
    return reply.code(403).send({ error: 'Forbidden', message: 'You cannot modify a user with a role that has permissions beyond your own.' });
  }

  if (req.body.roleId) {
    try {
      const newRole = await db.collection('roles').document(req.body.roleId);
      if (!isSubsetPermissions(newRole.permissions, req.auth.rolePermissions)) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Cannot assign a new role with permissions beyond your own.' });
      }
    } catch (err) {
      if (err.isArangoError && err.code === 404) {
        return reply.code(404).send({ error: 'Not Found', message: `The new role with ID '${req.body.roleId}' does not exist.` });
      }
      throw err;
    }
  }
};

export const checkDeleteUserPermissionsHook = async (req, reply) => {
  const { id } = req.params;
  const db = req.db;
  const query = aql`
    LET user = DOCUMENT('users', ${id})
    FILTER user != null
    LET roleEdge = FIRST(FOR v, e IN 1..1 OUTBOUND user._id users_edge RETURN e)
    FILTER roleEdge != null
    LET role = DOCUMENT(roleEdge._to)
    RETURN role.permissions
  `;
  const cursor = await db.query(query);
  const targetPermissions = await cursor.next();

  if (!targetPermissions) {
    const userExists = await req.collections.docs.exists(id);
    if (userExists) {
        return reply.code(404).send({ error: 'Not Found', message: 'Role not found for the specified user.' });
    }
    return;
  }

  if (!isSubsetPermissions(targetPermissions, req.auth.rolePermissions)) {
    return reply.code(403).send({ error: 'Forbidden', message: `You cannot delete a user with a role that has permissions beyond your own.` });
  }
};
