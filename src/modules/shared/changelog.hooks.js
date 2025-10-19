import { generateDiff } from './diff.util.js';

/**
 * preHandler Hook: Fetches the state of the document(s) *before* the update runs.
 * It stores this "before" state on the request object.
 */
export const captureOldStateHook = async (req, reply) => {
  if (req.params.id) {
    // Single document update
    const oldDoc = await req.collections.docs.document(req.params.id).catch(() => null);
    req.changelogOldState = oldDoc;
  } else if (req.query) {
    // Bulk update. Note: This could be performance-intensive.
    // We are re-running the selection query to get the 'before' state.
    // This is the trade-off for not modifying the original handler.
    const { buildAqlQuery } = await import('./query.builder.js');
    const { schema } = req.routeOptions.config.resource; // We'll add this config later
    const { query, bindVars } = buildAqlQuery(req.collections.docs.name, schema.create, req.query);
    const cursor = await req.db.query(query, bindVars);
    req.changelogOldState = await cursor.all();
  }
};

/**
 * onResponse Hook: Runs after the handler is complete.
 * It compares the "before" state (from the request) with the "after" state (from the reply payload)
 * and saves the resulting diff to the database.
 */
export const logChangesHook = async (req, reply, payload) => {
  const oldState = req.changelogOldState;
  if (!oldState) return payload;

  const changelogCollectionName = `${req.collections.docs.name}_changelogs`;
  const changelogCollection = req.db.collection(changelelogCollectionName);
  
  // Ensure the collection exists before trying to write to it
  if (!(await changelogCollection.exists())) return payload;

  let newState;
  try {
     newState = JSON.parse(payload);
  } catch(e) {
      return payload; // Payload is not valid JSON
  }

  const changelogEntries = [];
  const now = new Date().toISOString();

  if (Array.isArray(oldState)) {
    // Bulk operation
    const oldStateMap = new Map(oldState.map(doc => [doc._key, doc]));
    const newDocs = Array.isArray(newState) ? newState : (newState.data || []);
    
    for (const newDoc of newDocs) {
      const oldDoc = oldStateMap.get(newDoc._key);
      if (oldDoc) {
        const diff = generateDiff(oldDoc, newDoc);
        if (Object.keys(diff).length > 0) {
          changelogEntries.push({
            documentId: newDoc._id,
            diff,
            length: Object.keys(diff).length,
            userId: req.auth?.userId || null,
            roleId: req.auth?.roleId || null,
            createdAt: now,
          });
        }
      }
    }
  } else {
    // Single document operation
    const diff = generateDiff(oldState, newState);
    if (Object.keys(diff).length > 0) {
      changelogEntries.push({
        documentId: newState._id,
        diff,
        length: Object.keys(diff).length,
        userId: req.auth?.userId || null,
        roleId: req.auth?.roleId || null,
        createdAt: now,
      });
    }
  }

  if (changelogEntries.length > 0) {
    try {
      await changelogCollection.import(changelogEntries);
    } catch (err) {
      req.log.error({ err, collection: changelogCollectionName }, 'Failed to write to changelog');
    }
  }

  return payload;
};