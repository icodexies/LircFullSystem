import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCoverFile,
  prepareCoverImage,
  MAX_COVER_UPLOAD_BYTES,
} from "../../src/services/catalog/coverImage.js";

test("cover validation rejects SVG, empty files and oversized input", () => {
  for (const file of [
    { type: "image/svg+xml", size: 100 },
    { type: "image/jpeg", size: 0 },
    { type: "image/png", size: 11 * 1024 * 1024 },
  ])
    assert.throws(() => validateCoverFile(file));
  validateCoverFile({ type: "image/webp", size: 100 });
});

test("cover preparation bounds dimensions, flattens images and releases decoded memory", async (t) => {
  let closed = 0;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob: (callback, type) => callback(new Blob(["cover"], { type })),
  };
  const originals = ["createImageBitmap", "document"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  globalThis.createImageBitmap = async () => ({
    width: 2400,
    height: 3600,
    close() {
      closed++;
    },
  });
  globalThis.document = { createElement: () => canvas };
  const blob = await prepareCoverImage({ type: "image/jpeg", size: 100 });
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 1200);
  assert.equal(blob.type, "image/webp");
  assert.equal(closed, 1);
  canvas.toBlob = (callback) =>
    callback(
      new Blob([new Uint8Array(MAX_COVER_UPLOAD_BYTES + 1)], {
        type: "image/webp",
      }),
    );
  await assert.rejects(
    () => prepareCoverImage({ type: "image/jpeg", size: 100 }),
    /too large/,
  );
  assert.equal(closed, 2);
});
