import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../lib/password.js";
import { signAuthToken, verifyAuthToken } from "../lib/token.js";
import { hasForbiddenFields } from "../lib/userSchemas.js";

describe("password", () => {
  it("hashes a password", async () => {
    const hash = await hashPassword("mypassword123");
    expect(hash).not.toBe("mypassword123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("mypassword123");
    const result = await comparePassword("mypassword123", hash);
    expect(result).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("mypassword123");
    const result = await comparePassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const hash1 = await hashPassword("mypassword123");
    const hash2 = await hashPassword("mypassword123");
    expect(hash1).not.toBe(hash2);
  });
});

describe("token", () => {
  const testPayload = {
    sub: "user-123",
    email: "test@example.com",
    name: "Test User",
  };

  it("signs and verifies a valid token", async () => {
    const token = await signAuthToken(testPayload);
    const payload = await verifyAuthToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-123");
    expect(payload!.email).toBe("test@example.com");
    expect(payload!.name).toBe("Test User");
  });

  it("rejects an invalid token", async () => {
    const payload = await verifyAuthToken("invalid-token-string");
    expect(payload).toBeNull();
  });

  it("rejects a token signed with wrong secret", async () => {
    const { SignJWT } = await import("jose");
    const wrongSecret = new TextEncoder().encode("wrong-secret-at-least-32-chars-long!!!");
    const token = await new SignJWT(testPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("syncspace-lite")
      .sign(wrongSecret);
    const payload = await verifyAuthToken(token);
    expect(payload).toBeNull();
  });
});

describe("auth forbidden fields protection", () => {
  it("catches id manipulation", () => {
    const result = hasForbiddenFields({ id: "different-user-uuid" });
    expect(result).toContain("id");
  });

  it("catches role escalation", () => {
    const result = hasForbiddenFields({ role: "admin" });
    expect(result).toContain("role");
  });

  it("catches passwordHash injection", () => {
    const result = hasForbiddenFields({ passwordHash: "pre-computed-hash" });
    expect(result).toContain("passwordHash");
  });

  it("catches createdAt manipulation", () => {
    const result = hasForbiddenFields({ createdAt: "2020-01-01" });
    expect(result).toContain("createdAt");
  });

  it("catches lastActiveAt manipulation", () => {
    const result = hasForbiddenFields({ lastActiveAt: "2020-01-01" });
    expect(result).toContain("lastActiveAt");
  });

  it("catches email change attempt", () => {
    const result = hasForbiddenFields({ email: "attacker@evil.com" });
    expect(result).toContain("email");
  });

  it("detects multiple forbidden fields", () => {
    const result = hasForbiddenFields({
      id: "x",
      role: "admin",
      passwordHash: "y",
    });
    expect(result).toContain("id");
    expect(result).toContain("role");
    expect(result).toContain("passwordHash");
  });

  it("returns empty array for allowed fields", () => {
    expect(
      hasForbiddenFields({ name: "Jane", username: "jane", bio: "Hi" }),
    ).toEqual([]);
  });

  it("returns empty array for empty object", () => {
    expect(hasForbiddenFields({})).toEqual([]);
  });

  it("ignores undefined values", () => {
    expect(hasForbiddenFields({ id: undefined, role: undefined })).toEqual([]);
  });

  it("detects forbidden fields mixed with allowed fields", () => {
    const result = hasForbiddenFields({
      name: "Jane",
      id: "hacked",
      bio: "Hi",
      role: "admin",
    });
    expect(result).toContain("id");
    expect(result).toContain("role");
    expect(result).not.toContain("name");
    expect(result).not.toContain("bio");
  });
});
