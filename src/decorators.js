/**
 * Per-instance memoization for prototype getters and methods.
 * Replaces the former `@cache` decorator (no Babel required).
 *
 * - Getters: computed once per instance.
 * - Methods: memoized by the first argument (same as legacy `@cache`).
 *
 * Values are stored in a WeakMap, so they do not collide with instance fields.
 */

/** @type {WeakMap<object, Map<string | symbol, unknown>>} */
const store = new WeakMap();

/**
 * @param {object} instance
 * @returns {Map<string | symbol, unknown>}
 */
function cacheMap(instance) {
  let map = store.get(instance);
  if (!map) {
    map = new Map();
    store.set(instance, map);
  }
  return map;
}

/**
 * Wrap existing prototype properties with memoization.
 * @param {object} proto
 * @param {string[]} keys
 * @returns {void}
 */
export function defineCached(proto, keys) {
  for (let key of keys) {
    let desc = Object.getOwnPropertyDescriptor(proto, key);
    if (!desc) {
      throw new Error(`defineCached: missing property "${key}"`);
    }

    if (desc.get) {
      let compute = desc.get;
      Object.defineProperty(proto, key, {
        configurable: true,
        enumerable: false,
        get() {
          let map = cacheMap(this);
          if (!map.has(key)) {
            map.set(key, compute.call(this));
          }
          return map.get(key);
        }
      });
      continue;
    }

    if (typeof desc.value === 'function') {
      let fn = desc.value;
      Object.defineProperty(proto, key, {
        configurable: true,
        enumerable: false,
        writable: true,
        /**
         * @param {...unknown} args
         * @returns {unknown}
         */
        value: function (...args) {
          let map = cacheMap(this);
          /** @type {Map<unknown, unknown> | undefined} */
          let methodCache = /** @type {Map<unknown, unknown> | undefined} */ (map.get(key));
          if (!methodCache) {
            methodCache = new Map();
            map.set(key, methodCache);
          }

          let cacheKey = args.length > 0 ? args[0] : 'value';
          if (methodCache.has(cacheKey)) {
            return methodCache.get(cacheKey);
          }

          let result = fn.apply(this, args);
          methodCache.set(cacheKey, result);
          return result;
        }
      });
      continue;
    }

    throw new Error(`defineCached: "${key}" must be a getter or method`);
  }
}
