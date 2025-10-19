import { aql } from 'arangojs';
import deepmerge from '@fastify/deepmerge';
import { buildAqlQuery } from './query.builder.js';
import { edgeSchema } from '../schemas/edges.schema.js';
import { changelogSchema } from '../schemas/changelogs.schema.js';
import { captureOldStateHook, logChangesHook } from './changelog.hooks.js';

const merge = deepmerge({ all: true });

const allRoutes = ['create', 'read', 'readBulk', 'readById', 'updateById', 'deleteById', 'createBulk', 'updateBulk', 'deleteBulk'];

export const createResourceRoutes = (collectionName, options) => {
  const { schema, indexes = [], enable = allRoutes, enableEdges = false, enableChangelogs = false, hooks = {} } = options;
  const routes = {
    [collectionName]: {
      _isCollection: true,
      _indexes: indexes,
    },
  };

  const now = () => new Date().toISOString();
  
  const generators = {
    create: () => ({
      method: 'post',
      schema: { body: schema.create },
      handler: async function createResourceHandler(req, reply) {
        const payload = { ...req.body, createdAt: now(), updatedAt: now(), deletedAt: null, _version: 1 };
        const newDoc = await req.collections.docs.save(payload, { returnNew: true });
        return reply.code(201).send(newDoc.new);
      },
    }),

    read: () => ({
      method: 'get',
      handler: async function readResourceHandler(req) {
        const { query, bindVars, sortField } = buildAqlQuery(collectionName, schema.create, req.query);
        const cursor = await req.db.query(query, bindVars);
        const results = await cursor.all();
        const limit = parseInt(req.query.limit, 10) || 50;
        let nextCursor = null;
        if (sortField && results.length === limit) {
          const lastResult = results[results.length - 1];
          nextCursor = JSON.stringify(lastResult[sortField]);
        }
        return { data: results, pagination: { count: results.length, nextCursor } };
      },
    }),

    readBulk: () => ({
      method: 'post',
      path: '/query',
      schema: {
        body: {
          type: 'object',
          properties: {
            filter: { type: 'object' },
            sort: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 1000 },
            cursor: { type: ['string', 'null'] },
            fields: { type: 'string' }
          }
        }
      },
      handler: async function readResourceByPostHandler(req) {
        const { query, bindVars, sortField } = buildAqlQuery(collectionName, schema.create, req.body);
        const cursor = await req.db.query(query, bindVars);
        const results = await cursor.all();
        const limit = parseInt(req.body.limit, 10) || 50;
        let nextCursor = null;
        if (sortField && results.length === limit) {
          const lastResult = results[results.length - 1];
          nextCursor = JSON.stringify(lastResult[sortField]);
        }
        return { data: results, pagination: { count: results.length, nextCursor } };
      },
    }),
    
    readById: () => ({
      method: 'get',
      path: '/:id',
      handler: async function readResourceByIdHandler(req, reply) {
        const doc = await req.collections.docs.document(req.params.id).catch(() => null);
        return doc || reply.code(404).send({ error: 'Not Found' });
      },
    }),

    updateById: () => ({
      method: 'patch',
      path: '/:id',
      schema: { body: schema.update },
      config: { resource: { schema } },
      handler: async function updateResourceByIdHandler(req) {
        const payload = { ...req.body, updatedAt: now() };
        const query = aql`
            LET doc = DOCUMENT(${req.collections.docs.name}, ${req.params.id})
            UPDATE doc WITH ${payload} IN ${req.collections.docs}
            UPDATE doc WITH { _version: doc._version + 1 } IN ${req.collections.docs} OPTIONS { keepNull: false, mergeObjects: true }
            RETURN NEW
        `;
        const cursor = await req.db.query(query);
        return await cursor.next();
      },
    }),

    deleteById: () => ({
      method: 'delete',
      path: '/:id',
      handler: async function deleteResourceByIdHandler(req, reply) {
        await req.collections.docs.remove(req.params.id);
        return reply.code(204).send();
      },
    }),
    
    createBulk: () => ({
      method: 'post',
      path: '/bulk',
      schema: { body: { type: 'array', items: schema.create } },
      handler: async function createResourceBulkHandler(req) {
        const docs = req.body.map(doc => ({ ...doc, createdAt: now(), updatedAt: now(), deletedAt: null, _version: 1 }));
        const stats = await req.collections.docs.import(docs);
        return { message: 'Bulk create executed.', ...stats };
      },
    }),
    
    updateBulk: () => ({
      method: 'patch',
      path: '/bulk',
      schema: { body: schema.update },
      config: { resource: { schema } },
      handler: async function updateResourceBulkHandler(req) {
        const { query: selectionQuery, bindVars } = buildAqlQuery(collectionName, schema.create, req.query);
        bindVars.payload = { ...req.body, updatedAt: now() };
        const updateQuery = aql`
            FOR doc IN (${selectionQuery})
            UPDATE doc WITH @payload IN ${aql.literal(collectionName)} OPTIONS { keepNull: false, mergeObjects: true }
            UPDATE doc WITH { _version: doc._version + 1 } IN ${aql.literal(collectionName)}
            RETURN NEW
        `;
        const cursor = await req.db.query(updateQuery, bindVars);
        return await cursor.all();
      },
    }),
    
    deleteBulk: () => ({
      method: 'delete',
      path: '/bulk',
      handler: async function deleteResourceBulkHandler(req) {
        const { query: selectionQuery, bindVars } = buildAqlQuery(collectionName, schema.create, req.query);
                const deleteQuery = aql`
            FOR doc IN (${selectionQuery})
            REMOVE doc IN ${aql.literal(collectionName)}
            COLLECT WITH COUNT INTO length
            RETURN { deletedCount: length }
        `;
        const cursor = await req.db.query(deleteQuery, bindVars);
        return (await cursor.next()) || { deletedCount: 0 };
      },
    }),
  };

  for (const routeName of enable) {
    if (generators[routeName]) {
      const generatedRoute = generators[routeName]();
      const customHooks = hooks[routeName] || {};
      routes[collectionName][routeName] = merge(generatedRoute, customHooks);
    }
  }

  if (enableEdges) {
    const edgeOptions = {
      schema: edgeSchema,
      enable: allRoutes,
      hooks: hooks.edges || {},
    };
    const edgeCollectionName = `${collectionName}_edge`;
    const edgeRoutes = createResourceRoutes(edgeCollectionName, edgeOptions);
    routes[collectionName].edges = edgeRoutes[edgeCollectionName];
  }

  if (enableChangelogs) {
    const changelogHooks = {
      preHandler: { captureOldStateHook },
      onResponse: { logChangesHook },
    };

    if (routes[collectionName].updateById) {
      routes[collectionName].updateById = merge(routes[collectionName].updateById, changelogHooks);
    }
    if (routes[collectionName].updateBulk) {
      routes[collectionName].updateBulk = merge(routes[collectionName].updateBulk, changelogHooks);
    }

    const changelogCollectionName = `${collectionName}_changelogs`;
    const changelogRoutes = createResourceRoutes(changelogCollectionName, {
      schema: changelogSchema,
      enable: ['readBulk', 'deleteBulk'],
      enableEdges: false,
      enableChangelogs: false,
      hooks: hooks.changelogs || { onResponse: { auditLoggerHook: null } },
    });
    routes[collectionName].changelogs = changelogRoutes[changelogCollectionName];
  }

  return routes;
};
