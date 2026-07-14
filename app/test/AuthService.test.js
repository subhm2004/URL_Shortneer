import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { describe, it } from "node:test";
import AuthService from "../services/AuthService.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../core/errors.js";
import { fakeEventBus, fakeUserRepository, testConfig } from "./helpers/fakes.js";

function build(repoOverrides = {}) {
  const userRepository = fakeUserRepository(repoOverrides);
  const eventBus = fakeEventBus();

  const service = new AuthService({ userRepository, eventBus, config: testConfig });
  return { service, userRepository, eventBus };
}

describe("AuthService.login", () => {
  it("gives the same message for an unknown user and a wrong password", async () => {
    const hash = await bcrypt.hash("correct-password", 4);

    const { service: unknownUser } = build({
      findByEmailWithPassword: async () => null,
    });
    const { service: wrongPassword } = build({
      findByEmailWithPassword: async () => ({
        id: "u1",
        email: "a@b.test",
        passwordHash: hash,
      }),
    });

    const a = await unknownUser
      .login({ email: "nobody@b.test", password: "whatever1" })
      .catch((e) => e);
    const b = await wrongPassword
      .login({ email: "a@b.test", password: "wrong-password" })
      .catch((e) => e);

    // Telling them apart lets an attacker enumerate which emails have accounts.
    assert.equal(a.message, b.message);
    assert.equal(a.statusCode, 401);
    assert.equal(b.statusCode, 401);
  });

  it("rejects a Google-only account with 401 rather than crashing", async () => {
    const { service } = build({
      findByEmailWithPassword: async () => ({
        id: "u1",
        email: "g@b.test",
        // A Google account has no password. bcrypt.compare(pw, undefined) THROWS
        // rather than returning false — so without a guard this was a 500, and
        // that 500 confirmed the account existed.
        passwordHash: undefined,
        hasGoogle: true,
      }),
    });

    await assert.rejects(
      () => service.login({ email: "g@b.test", password: "anything1" }),
      (err) => err instanceof UnauthorizedError && err.statusCode === 401,
    );
  });

  it("accepts the correct password", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    const { service } = build({
      findByEmailWithPassword: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.test",
        passwordHash: hash,
      }),
    });

    const { user, token } = await service.login({
      email: "a@b.test",
      password: "correct-password",
    });

    assert.equal(user.id, "u1");
    assert.ok(token);
    assert.ok(!("passwordHash" in user), "the hash must never leave the service");
  });
});

describe("AuthService.register", () => {
  it("rejects a duplicate email as a conflict", async () => {
    const { service } = build({
      findByEmail: async () => ({ id: "existing" }),
    });

    await assert.rejects(
      () => service.register({ name: "A", email: "a@b.test", password: "longenough" }),
      ConflictError,
    );
  });

  it("rejects a password below the minimum", async () => {
    const { service } = build();
    await assert.rejects(
      () => service.register({ name: "A", email: "a@b.test", password: "short" }),
      ValidationError,
    );
  });
});

describe("AuthService.loginWithGoogle", () => {
  const profile = {
    googleId: "google-sub-123",
    email: "a@b.test",
    name: "A",
    avatarUrl: null,
  };

  it("signs in an account we already know by its Google id", async () => {
    const { service } = build({
      findByGoogleId: async () => ({ id: "u1", email: "a@b.test" }),
      findByEmail: async () => assert.fail("should not have needed the email"),
    });

    const { user, created } = await service.loginWithGoogle(profile);

    assert.equal(user.id, "u1");
    assert.equal(created, false);
  });

  it("links Google to an existing password account with the same email", async () => {
    let linkedWith = null;

    const { service } = build({
      findByGoogleId: async () => null,
      findByEmail: async () => ({ id: "u1", email: "a@b.test" }),
      async linkGoogle(id, input) {
        linkedWith = { id, ...input };
        return { id, email: "a@b.test", hasGoogle: true };
      },
    });

    const { created } = await service.loginWithGoogle(profile);

    assert.equal(created, false);
    assert.equal(linkedWith.id, "u1");
    assert.equal(linkedWith.googleId, "google-sub-123");
    // This branch is only safe because GoogleAuthService refuses any profile whose
    // email Google hasn't verified. Without that, it's account takeover.
  });

  it("creates a new account when neither the Google id nor the email is known", async () => {
    const { service, eventBus } = build({
      findByGoogleId: async () => null,
      findByEmail: async () => null,
    });

    const { created } = await service.loginWithGoogle(profile);

    assert.equal(created, true);
    assert.equal(eventBus.published.at(-1)?.event, "user.registered");
  });
});

describe("AuthService.getById", () => {
  it("treats a valid token for a deleted account as unauthenticated", async () => {
    const { service } = build({ findById: async () => null });

    // Not a 404: the client's job is to sign in again, not to go looking for a
    // missing resource.
    await assert.rejects(() => service.getById("gone"), UnauthorizedError);
  });
});
