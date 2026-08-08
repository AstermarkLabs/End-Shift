// Unit tests for fieldCrypto.ts. Uses Node's built-in test runner (node:test)
// and assert — no new test-framework dependency, since this repo has no
// existing test infra to plug into (see HANDOFF-e2ee.md).
//
// Run with (from artifacts/api-server/):
//   npx esbuild src/lib/fieldCrypto.test.ts --bundle --platform=node --format=esm --outfile=/tmp/fieldCrypto.test.mjs \
//     && node --test /tmp/fieldCrypto.test.mjs
//
// If this project ever adopts a test runner (vitest/jest), migrate these
// cases as-is — the assertions don't depend on node:test specifics beyond
// `test()` and `assert`.

import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptField,
  decryptField,
  hashForLookup,
  isEncryptedFieldBlob,
  blobKeyVersion,
} from "./fieldCrypto";

test("encryptField -> decryptField round-trips the original string", () => {
  const plaintext = "brian@example.com";
  const blob = encryptField(plaintext);
  assert.notEqual(blob, plaintext, "stored blob must not equal plaintext");
  assert.equal(decryptField(blob), plaintext);
});

test("encryptField is non-deterministic (random IV per call)", () => {
  const plaintext = "same input";
  const a = encryptField(plaintext);
  const b = encryptField(plaintext);
  assert.notEqual(a, b, "two encryptions of the same input must differ");
  // both still decrypt to the same plaintext
  assert.equal(decryptField(a), plaintext);
  assert.equal(decryptField(b), plaintext);
});

test("decryptField throws on tampered ciphertext", () => {
  const blob = encryptField("tamper me");
  const flipped =
    blob.slice(0, -2) + (blob.endsWith("AA") ? "BB" : "AA");
  assert.throws(() => decryptField(flipped));
});

test("decryptField throws on malformed/missing prefix", () => {
  assert.throws(() => decryptField("not-a-real-blob"));
  assert.throws(() => decryptField(""));
});

test("hashForLookup is deterministic for the same normalized input", () => {
  const h1 = hashForLookup("brian@example.com");
  const h2 = hashForLookup("brian@example.com");
  assert.equal(h1, h2);
});

test("hashForLookup differs for different inputs", () => {
  const h1 = hashForLookup("brian@example.com");
  const h2 = hashForLookup("someone-else@example.com");
  assert.notEqual(h1, h2);
});

test("isEncryptedFieldBlob distinguishes ciphertext from plaintext", () => {
  const blob = encryptField("plaintext value");
  assert.equal(isEncryptedFieldBlob(blob), true);
  assert.equal(isEncryptedFieldBlob("plaintext value"), false);
  assert.equal(isEncryptedFieldBlob(""), false);
});

// ─── Key rotation ───────────────────────────────────────────────────────────

test("mid-rotation: v1 blobs keep decrypting after a v2 key becomes active", () => {
  const savedActive = process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
  const savedV2 = process.env["FIELD_ENCRYPTION_KEY_V2"];
  try {
    // Encrypt one value under the default active version (1).
    delete process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
    const oldBlob = encryptField("encrypted before rotation");
    assert.equal(blobKeyVersion(oldBlob), 1);

    // Rotate: introduce a v2 key and make it active.
    process.env["FIELD_ENCRYPTION_KEY_V2"] = "a-distinct-32-character-v2-key!!";
    process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"] = "2";
    const newBlob = encryptField("encrypted after rotation");
    assert.equal(blobKeyVersion(newBlob), 2);

    // A table with a mix of v1 and v2 rows must decrypt both correctly —
    // decryptField reads the version off each blob, not off "active".
    assert.equal(decryptField(oldBlob), "encrypted before rotation");
    assert.equal(decryptField(newBlob), "encrypted after rotation");
  } finally {
    if (savedActive === undefined) delete process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
    else process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"] = savedActive;
    if (savedV2 === undefined) delete process.env["FIELD_ENCRYPTION_KEY_V2"];
    else process.env["FIELD_ENCRYPTION_KEY_V2"] = savedV2;
  }
});

test("hashForLookup output is stable across AES key rotation", () => {
  const savedActive = process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
  const savedV2 = process.env["FIELD_ENCRYPTION_KEY_V2"];
  try {
    delete process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
    const before = hashForLookup("brian@example.com");

    process.env["FIELD_ENCRYPTION_KEY_V2"] = "a-distinct-32-character-v2-key!!";
    process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"] = "2";
    const after = hashForLookup("brian@example.com");

    // The blind index must NOT change when the AES key rotates — it's a
    // separate secret (FIELD_INDEX_KEY). Otherwise every emailHash in the
    // table would need rewriting in lockstep with every AES rotation.
    assert.equal(before, after);
  } finally {
    if (savedActive === undefined) delete process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
    else process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"] = savedActive;
    if (savedV2 === undefined) delete process.env["FIELD_ENCRYPTION_KEY_V2"];
    else process.env["FIELD_ENCRYPTION_KEY_V2"] = savedV2;
  }
});

test("blobKeyVersion returns null for non-blob values", () => {
  assert.equal(blobKeyVersion("plain text"), null);
  assert.equal(blobKeyVersion(""), null);
});

test("invalid FIELD_ENCRYPTION_ACTIVE_KEY_VERSION throws", () => {
  const saved = process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
  try {
    process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"] = "not-a-number";
    assert.throws(() => encryptField("x"));
  } finally {
    if (saved === undefined) delete process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
    else process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"] = saved;
  }
});
