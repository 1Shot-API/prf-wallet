import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CredentialId, CredentialIssuer, CredentialTypeName } from "@1shotapi/ows-types";
import { InMemoryCredentialStore } from "../src/mock/in-memory-store.js";
import { createMockStoredCredential } from "../src/mock/fixtures.js";

describe("InMemoryCredentialStore", () => {
  it("saves, lists, gets, and deletes credentials", async () => {
    const store = new InMemoryCredentialStore();
    const credential = createMockStoredCredential();

    await store.save(credential);

    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.credentialId, credential.credentialId);

    const fetched = await store.get(credential.credentialId);
    assert.ok(fetched);
    assert.equal(fetched.payload, credential.payload);

    const byType = await store.list({ type: CredentialTypeName("KycCredential") });
    assert.equal(byType.length, 1);

    const byWrongType = await store.list({ type: CredentialTypeName("OtherCredential") });
    assert.equal(byWrongType.length, 0);

    await store.delete(credential.credentialId);
    assert.equal((await store.list()).length, 0);
  });

  it("filters by issuer", async () => {
    const store = new InMemoryCredentialStore();
    await store.save(createMockStoredCredential());

    const match = await store.list({
      issuer: CredentialIssuer("https://kyc.demo.issuer.example"),
    });
    assert.equal(match.length, 1);

    const noMatch = await store.list({
      issuer: CredentialIssuer("https://other.example"),
    });
    assert.equal(noMatch.length, 0);
  });
});

describe("CredentialId", () => {
  it("brands credential ids", () => {
    const id = CredentialId("cred_test");
    assert.equal(id, "cred_test");
  });
});
