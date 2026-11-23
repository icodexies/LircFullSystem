import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadCache } from "../../src/services/shared/readCache.js";

test("readCache returns the cached value", async () => {
  const cache = createReadCache(10_000);
  let calls = 0;
  const load = async () => ++calls;

  assert.equal(await cache.read("key", load), 1);
  assert.equal(await cache.read("key", load), 1);
  assert.equal(calls, 1);
});

test("readCache deduplicates an in-flight read", async () => {
  const cache = createReadCache(10_000);
  let calls = 0;
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const load = () => {
    calls += 1;
    return pending;
  };

  const first = cache.read("key", load);
  const second = cache.read("key", load);
  finish("value");

  assert.equal(await first, "value");
  assert.equal(await second, "value");
  assert.equal(calls, 1);
});

test("readCache fresh bypasses a cached value", async () => {
  const cache = createReadCache(10_000);
  let calls = 0;
  const load = async () => ++calls;

  assert.equal(await cache.read("key", load), 1);
  assert.equal(await cache.read("key", load, { fresh: true }), 2);
  assert.equal(await cache.read("key", load), 2);
});

test("readCache does not cache failures", async () => {
  const cache = createReadCache(10_000);
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary");
    return "ok";
  };

  await assert.rejects(() => cache.read("key", load), /temporary/);
  assert.equal(await cache.read("key", load), "ok");
  assert.equal(calls, 2);
});

test("readCache clear removes matching entries", async () => {
  const cache = createReadCache(10_000);
  let calls = 0;
  const load = async () => ++calls;

  await cache.read("programs", load);
  await cache.read("curriculum:1", load);
  cache.clear("programs");
  assert.equal(await cache.read("programs", load), 3);
  assert.equal(await cache.read("curriculum:1", load), 2);
});
