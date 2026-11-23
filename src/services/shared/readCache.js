// Small in-memory read cache with in-flight request deduplication.
//
// Shared reads must not be tied to one caller's AbortSignal: a component
// unmounting should not cancel a request that another component is waiting on.
// Callers can still ignore a result after unmount.
export function createReadCache(ttlMs = 60_000) {
  const values = new Map();
  const pending = new Map();

  async function read(key, loader, { fresh = false } = {}) {
    const now = Date.now();
    const hit = values.get(key);
    if (!fresh && hit && now - hit.at < ttlMs) return hit.value;

    if (!fresh && pending.has(key)) return pending.get(key);

    const request = Promise.resolve()
      .then(loader)
      .then((value) => {
        values.set(key, { value, at: Date.now() });
        return value;
      })
      .finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      });

    pending.set(key, request);
    return request;
  }

  function clear(prefix = "") {
    for (const key of values.keys()) {
      if (!prefix || key.startsWith(prefix)) values.delete(key);
    }
    for (const key of pending.keys()) {
      if (!prefix || key.startsWith(prefix)) pending.delete(key);
    }
  }

  return { read, clear };
}
