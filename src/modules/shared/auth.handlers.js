export const userCreateHandler = async (req, reply) => {
  const { roleId, ...userData } = req.body;
  const now = new Date().toISOString();
  const payload = { ...userData, createdAt: now, updatedAt: now, _version: 1 };
  try {
    const newUser = await req.collections.docs.save(payload, { returnNew: true });
    // Also create the edge to the role
    await req.db.collection('users_edge').save({ _from: newUser.new._id, _to: `roles/${roleId}` });
    delete newUser.new.password;
    return reply.code(201).send(newUser.new);
  } catch (err) {
    if (err.isArangoError && err.errorNum === 1210) { // Unique constraint violation
      return reply.code(409).send({ error: 'Conflict', message: 'A user with this email, username, or phone number already exists.' });
    }
    throw err;
  }
};

export const userUpdateHandler = async (req) => {
  const { roleId, ...userData } = req.body;
  const userId = req.params.id;
  const db = req.db;

  if (roleId) {
    const query = `
      LET userDocId = CONCAT('users/', @userId)
      UPSERT { _from: userDocId }
      INSERT { _from: userDocId, _to: @newRoleId }
      UPDATE { _to: @newRoleId }
      IN users_edge
    `;
    await db.query(query, { userId, newRoleId: `roles/${roleId}` });
  }

  let updatedUser;
  if (Object.keys(userData).length > 0) {
    const payload = { ...userData, updatedAt: new Date().toISOString() };
    const result = await req.collections.docs.update(userId, payload, { returnNew: true, mergeObjects: true });
    updatedUser = result.new;
  } else {
    updatedUser = await req.collections.docs.document(userId);
  }
  delete updatedUser.password;
  return updatedUser;
};
