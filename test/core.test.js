import test from "node:test";
import assert from "node:assert/strict";
process.env.SESSION_SECRET = "x".repeat(40);
const { chunkPlan, MIN_CHUNK, CHUNK } = await import("../lib/tiktok.js");
const { seal, unseal } = await import("../lib/session.js");
const { buildInit } = await import("../api/init.js");

const creator = { privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], comment_disabled: true, duet_disabled: false, stitch_disabled: false };

test("small files upload whole", () => {
  assert.deepEqual(chunkPlan(1000), { chunk_size: 1000, total_chunk_count: 1 });
  assert.deepEqual(chunkPlan(MIN_CHUNK), { chunk_size: MIN_CHUNK, total_chunk_count: 1 });
});
test("between 5 and 10 MB is one chunk", () => {
  const s = MIN_CHUNK + 10;
  assert.deepEqual(chunkPlan(s), { chunk_size: s, total_chunk_count: 1 });
});
test("large files: last chunk absorbs remainder", () => {
  assert.deepEqual(chunkPlan(CHUNK * 3 + 123), { chunk_size: CHUNK, total_chunk_count: 3 });
});
test("session round-trips and rejects tampering", () => {
  const t = seal({ a: 1 });
  assert.deepEqual(unseal(t), { a: 1 });
  assert.equal(unseal(t.slice(0, -2) + "AA"), null);
});
test("privacy is required and must be allowed", () => {
  assert.throws(() => buildInit({ video_size: 10, post: {} }, creator), /Choose who can view/);
  assert.throws(() => buildInit({ video_size: 10, post: { privacy_level: "FOLLOWER_OF_CREATOR" } }, creator), /isn't available/);
});
test("branded content can't be private", () => {
  assert.throws(() => buildInit({ video_size: 10, post: { privacy_level: "SELF_ONLY", brand_content_toggle: true } }, creator), /can't be private/);
});
test("creator-disabled interactions stay disabled", () => {
  const b = buildInit({ video_size: 10, post: { privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false } }, creator);
  assert.equal(b.post_info.disable_comment, true);
  assert.equal(b.source_info.source, "FILE_UPLOAD");
});
