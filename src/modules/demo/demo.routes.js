// src/modules/demo/demo.routes.js (DEMO DEFINITIONS)
// This file showcases the refactored route compiler's features.
// Hooks are now defined as OBJECTS for granular control over merging and overriding.

// --- Hooks Library ---
const globalOnRequest = async (req) => console.log(`  [HOOK] ==> Global onRequest Fired for ${req.raw.url}`);
const globalPreValidation = async (req) => console.log(`  [HOOK] ==> Global preValidation Fired for ${req.raw.url}`);
const globalOnResponse = async (req) => console.log(`  [HOOK] <== Global onResponse Fired for ${req.raw.url}`);
const tenantAHook = async (req) => console.log(`  [HOOK] --> Tenant A preHandler Hook`);
const crmOnRequestHook = async (req) => console.log(`  [HOOK] --> CRM Section-Specific onRequest Hook`);
const invoicePreHandler = async (req) => console.log(`  [HOOK] ---> Invoice-Specific preHandler Hook`);
const routeSpecificOverrideHook = async (req) => console.log(`  [HOOK] XXX This hook OVERRIDES the global one! XXX`);
const inputValidationHook = async (req) => console.log(`  [HOOK] ---> Validating input for 'validate' route`);

const definedRoutes = {
  // DEMO 1: Global hooks defined as an object.
  // The KEY is the hook's identifier, the VALUE is the function.
  onRequest: { globalOnRequest },
  preValidation: { globalPreValidation },
  onResponse: { globalOnResponse },

  tenantA: {
    // DEMO 2: Tenant-level hook, adding to the hook chain.
    preHandler: { tenantAHook },

    status: {
      method: 'get',
      handler: async (req, reply) => reply.send({ tenant: 'tenantA', status: 'ok' })
    },

    crm: {
      // DEMO 4: Section-level hook MERGING.
      // The compiler merges this with the global `onRequest` object, resulting in:
      // onRequest: { globalOnRequest, crmOnRequestHook }
      onRequest: { crmOnRequestHook },

      leads: {
        _isCollection: true,
        create: {
          method: 'post',
          handler: async (req, reply) => reply.send({ status: `Lead created in ${req.params.tenantName}` })
        },
      },

      reports: {
        special: {
          method: 'get',
          // DEMO 6: Hook OVERRIDE by key.
          // Because this object defines a key 'globalOnRequest' that also exists
          // at the global level, this function REPLACES the global one for this route.
          // The `crmOnRequestHook` is also inherited but not overridden, so it will still run.
          // Final `onRequest` hooks for this route: routeSpecificOverrideHook, crmOnRequestHook
          onRequest: {
            globalOnRequest: routeSpecificOverrideHook
          },
          handler: async (req, reply) => reply.send({ report: 'This route has custom hooks.' })
        },
        quarterly: {
            byMonth: {
                method: 'get',
                path: '/:year/:month',
                 // DEMO 7: Hook DISABLING.
                 // To prevent an inherited hook from running, we redeclare its key
                 // with a null value. This route will NOT run the global `onResponse` hook.
                onResponse: {
                    globalOnResponse: null
                },
                handler: async (req, reply) => reply.send({ report: 'Quarterly', params: req.params })
            }
        }
      }
    }
  },

  tenantC: {
    validation: {
        check: {
            method: 'post',
            // DEMO 9: Add a new hook to an existing lifecycle event.
            // This is merged with the global `preValidation` object. Both will run.
            preValidation: { inputValidationHook },
            handler: async(req, reply) => reply.send({ tenant: req.params.tenantName, status: 'validated' })
        }
    }
  }
};

export default definedRoutes;
