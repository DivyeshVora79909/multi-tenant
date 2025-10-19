import { Database } from 'arangojs';

export const db = new Database({
  url: process.env.ARANGO_URL,
  auth: { username: process.env.ARANGO_USER, password: process.env.ARANGO_PASSWORD },
});

export async function setupTenantDatabase(tenantName) {
  const systemDb = db;
  const databases = await systemDb.listDatabases();
  if (!databases.includes(tenantName)) {
    console.log(`Database '${tenantName}' not found. Creating...`);
    await systemDb.createDatabase(tenantName);
    console.log(`Database '${tenantName}' created.`);
  }
  return systemDb.database(tenantName);
}

<<<<<<< HEAD
export async function setupResourceCollections(tenantDb, collectionName, options = {}) {
  const { indexConfigs = [] } = options;
  const docCollection = tenantDb.collection(collectionName);
  const edgeCollection = tenantDb.collection(`${collectionName}_edge`);
  const changelogCollection = tenantDb.collection(`${collectionName}_changelogs`);
=======
export async function setupResourceCollections(tenantDb, collectionName, indexConfigs = []) {
  const docCollection = tenantDb.collection(collectionName);
  const edgeCollection = tenantDb.collection(`${collectionName}_edge`);
>>>>>>> c835626 (90% done)

  if (!(await docCollection.exists())) {
    console.log(`Collection '${collectionName}' in db '${tenantDb.name}' not found. Creating...`);
    await docCollection.create();
    
<<<<<<< HEAD
=======
    // Create indexes if provided
>>>>>>> c835626 (90% done)
    if (indexConfigs.length > 0) {
      await createCollectionIndexes(tenantDb, collectionName, docCollection, indexConfigs);
    }
  }
  
  if (!(await edgeCollection.exists())) {
    console.log(`Edge Collection '${collectionName}_edge' in db '${tenantDb.name}' not found. Creating...`);
    await edgeCollection.create({ type: 3 });
  }

<<<<<<< HEAD
  if (!(await changelogCollection.exists())) {
    console.log(`Changelog Collection '${collectionName}_changelogs' in db '${tenantDb.name}' not found. Creating...`);
    await changelogCollection.create();
    await changelogCollection.ensureIndex({ type: 'persistent', fields: ['documentId'], name: 'idx_changelogs_documentId' });
  }

=======
>>>>>>> c835626 (90% done)
  return {
    docs: docCollection,
    edges: edgeCollection
  }
}

/**
 * Generic index creation - remains declarative
 */
async function createCollectionIndexes(tenantDb, collectionName, collection, indexConfigs) {
  try {
    console.log(`Creating ${indexConfigs.length} index(es) for '${collectionName}' collection in ${tenantDb.name}...`);
    
    for (const indexConfig of indexConfigs) {
      await collection.ensureIndex(indexConfig);
      console.log(`  ✓ Created index: ${indexConfig.name || 'unnamed'}`);
    }
    
    console.log(`All indexes created for '${collectionName}' collection in ${tenantDb.name}`);
  } catch (error) {
    console.error(`Error creating indexes for ${collectionName} in ${tenantDb.name}:`, error);
    throw error;
  }
}
