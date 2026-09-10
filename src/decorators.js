/**
 * Cache decorator for getters/methods.
 * Results are lazily computed once, then cached on the instance.
 *
 * @template T
 * @param {object} target
 * @param {string} key
 * @param {TypedPropertyDescriptor<T>} descriptor
 * @returns {TypedPropertyDescriptor<T> | void}
 */
export function cache(target, key, descriptor) {
  if (descriptor.get) {
    let get = descriptor.get;
    descriptor.get = function () {
      let value = get.call(this);
      Object.defineProperty(this, key, { value });
      return value;
    };
    return;
  }

  if (typeof descriptor.value === 'function') {
    let fn = /** @type {(...args: unknown[]) => T} */ (descriptor.value);

    /** @type {TypedPropertyDescriptor<T>} */
    let replacement = {
      configurable: true,
      enumerable: false,
      get() {
        /** @type {Map<unknown, T>} */
        let cacheMap = new Map();

        /**
         * @param {...unknown} args
         * @returns {T}
         */
        let memoized = (...args) => {
          let cacheKey = args.length > 0 ? args[0] : 'value';
          if (cacheMap.has(cacheKey)) {
            return /** @type {T} */ (cacheMap.get(cacheKey));
          }

          let result = fn.apply(this, args);
          cacheMap.set(cacheKey, result);
          return result;
        };

        Object.defineProperty(this, key, { value: memoized });
        return /** @type {T} */ (/** @type {unknown} */ (memoized));
      }
    };

    return replacement;
  }
}
