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

export const checkCreateRolePermissionsHook = async (req, reply) => {
  const targetPermissions = req.body.permissions || {};
  if (!isSubsetPermissions(targetPermissions, req.auth.rolePermissions)) {
    return reply.code(403).send({ error: 'Forbidden', message: `You cannot create a role with permissions beyond your own.` });
  }
};

export const checkUpdateRolePermissionsHook = async (req, reply) => {
  const id = req.params.id;
  try {
    const role = await req.db.collection('roles').document(id);
    if (!isSubsetPermissions(role.permissions, req.auth.rolePermissions)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'You cannot modify a role with permissions beyond your own.' });
    }
    if (req.body.permissions && !isSubsetPermissions(req.body.permissions, req.auth.rolePermissions)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'You cannot assign permissions that you do not possess.' });
    }
  } catch (err) {
    if (err.isArangoError && err.code === 404) {
      return;
    }
    throw err;
  }
};

export const checkDeleteRolePermissionsHook = async (req, reply) => {
  const id = req.params.id;
  try {
    const role = await req.db.collection('roles').document(id);
    if (!isSubsetPermissions(role.permissions, req.auth.rolePermissions)) {
      return reply.code(403).send({ error: 'Forbidden', message: `You cannot delete a role with permissions beyond your own.` });
    }
  } catch (err) {
    if (err.isArangoError && err.code === 404) {
      return;
    }
    throw err;
  }
};
