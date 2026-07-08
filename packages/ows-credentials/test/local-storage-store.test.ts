import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CredentialIssuer, CredentialTypeName } from "@1shotapi/ows-types";
import {
  LocalStorageCredentialStore,
  createMemoryStorageBackend,
} from "../src/mock/local-storage-store.js";
import { createMockStoredCredential } from "../src/mock/fixtures.js";

describe("LocalStorageCredentialStore", () => {
  it("persists credentials across store instances", async () => {
    const storage = createMemoryStorageBackend();
    const credential = await createMockStoredCredential();

    const writer = new LocalStorageCredentialStore({ storage });
    await writer.save(credential);

    const reader = new LocalStorageCredentialStore({ storage });
    const listed = await reader.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.credentialId, credential.credentialId);

    const fetched = await reader.get(credential.credentialId);
    assert.ok(fetched);
    assert.equal(fetched.payload, credential.payload);
  });

  it("filters and deletes like the in-memory store", async () => {
    const storage = createMemoryStorageBackend();
    const store = new LocalStorageCredentialStore({ storage });
    await store.save(await createMockStoredCredential());

    const match = await store.list({
      issuer: CredentialIssuer("https://kyc.demo.issuer.example"),
    });
    assert.equal(match.length, 1);

    const byWrongType = await store.list({
      type: CredentialTypeName("OtherCredential"),
    });
    assert.equal(byWrongType.length, 0);

    const saved = await createMockStoredCredential();
    await store.delete(saved.credentialId);
    assert.equal((await store.list()).length, 0);
    assert.equal(storage.getItem("ows.mock.credentials.v1"), null);
  });
});
