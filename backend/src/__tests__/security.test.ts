import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, "../../src", relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

// ─── Rate limiting ──────────────────────────────────────────────────────

describe("Security: Rate limiting", () => {
  it("general API rate limiter exists", () => {
    const source = readSource("middleware/rateLimit.ts");
    expect(source).toContain("apiLimiter");
    expect(source).toContain("max: 200");
  });

  it("auth rate limiter exists with strict limits", () => {
    const source = readSource("middleware/rateLimit.ts");
    expect(source).toContain("authLimiter");
    expect(source).toContain("max: 20");
  });

  it("registration rate limiter is strictest", () => {
    const source = readSource("middleware/rateLimit.ts");
    expect(source).toContain("strictAuthLimiter");
    expect(source).toContain("max: 5");
  });

  it("apiLimiter is applied to all routes", () => {
    const source = readSource("routes/index.ts");
    expect(source).toContain("apiLimiter");
    expect(source).toContain("router.use(apiLimiter)");
  });

  it("auth routes use strictAuthLimiter for register", () => {
    const source = readSource("routes/auth/index.ts");
    expect(source).toContain("strictAuthLimiter");
    expect(source).toContain("authLimiter");
  });

  it("all rate limiters use IP-based key generation", () => {
    const source = readSource("middleware/rateLimit.ts");
    const keyGenMatches = source.match(/keyGenerator:/g);
    expect(keyGenMatches).not.toBeNull();
    expect(keyGenMatches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Error handling ─────────────────────────────────────────────────────

describe("Security: Error handling", () => {
  it("error handler does not include stack trace in response", () => {
    const source = readSource("middleware/errorHandler.ts");
    // Should NOT have: response.stack = err.stack
    expect(source).not.toContain("response.stack");
    expect(source).not.toContain("err.stack");
  });

  it("error response interface has no stack field", () => {
    const source = readSource("middleware/errorHandler.ts");
    expect(source).not.toContain("stack?: string");
  });

  it("404 handler sanitizes path in production", () => {
    const source = readSource("middleware/errorHandler.ts");
    expect(source).toContain("NODE_ENV === \"production\"");
    expect(source).toContain("Route not found");
  });

  it("unhandled 500 errors show generic message in production", () => {
    const source = readSource("middleware/errorHandler.ts");
    expect(source).toContain("Internal server error");
  });
});

// ─── WebSocket security ─────────────────────────────────────────────────

describe("Security: WebSocket", () => {
  it("WebSocket server has maxPayload limit", () => {
    const source = readSource("ws/server.ts");
    expect(source).toContain("WS_MAX_PAYLOAD");
    expect(source).toContain("maxPayload: WS_MAX_PAYLOAD");
  });

  it("WebSocket maxPayload is 1MB", () => {
    const source = readSource("ws/server.ts");
    expect(source).toContain("1024 * 1024");
  });

  it("WebSocket has flood protection (message rate limiting)", () => {
    const source = readSource("ws/server.ts");
    expect(source).toContain("MSG_RATE_LIMIT");
    expect(source).toContain("MSG_RATE_WINDOW");
    expect(source).toContain("msgCount");
    expect(source).toContain("msgWindowStart");
  });

  it("WebSocket flood protection sends rate limit error", () => {
    const source = readSource("ws/server.ts");
    expect(source).toContain("Rate limit exceeded");
  });

  it("WebSocket authenticates before allowing connections", () => {
    const source = readSource("ws/server.ts");
    expect(source).toContain("verifyAuthToken");
    expect(source).toContain("close(4001");
  });

  it("WebSocket verifies workspace membership on join", () => {
    const source = readSource("ws/server.ts");
    expect(source).toContain("workspaceMember.findUnique");
    expect(source).toContain("Not a member of this workspace");
  });
});

// ─── Cookie security ───────────────────────────────────────────────────

describe("Security: Cookie configuration", () => {
  it("auth cookie is httpOnly", () => {
    const source = readSource("lib/token.ts");
    expect(source).toContain("httpOnly: true");
  });

  it("auth cookie is secure in production", () => {
    const source = readSource("lib/token.ts");
    expect(source).toContain("secure: isProduction");
  });

  it("auth cookie uses strict sameSite in production", () => {
    const source = readSource("lib/token.ts");
    expect(source).toContain('sameSite: isProduction ? "strict" : "lax"');
  });

  it("auth cookie has a defined maxAge", () => {
    const source = readSource("lib/token.ts");
    expect(source).toContain("maxAge:");
  });
});

// ─── JWT configuration ─────────────────────────────────────────────────

describe("Security: JWT configuration", () => {
  it("JWT secret has minimum length requirement", () => {
    const source = readSource("config/index.ts");
    expect(source).toContain("min(32");
  });

  it("JWT uses issuer claim", () => {
    const source = readSource("lib/token.ts");
    expect(source).toContain("setIssuer");
    expect(source).toContain("syncspace-lite");
  });

  it("JWT verification checks issuer", () => {
    const source = readSource("lib/token.ts");
    expect(source).toContain('issuer: "syncspace-lite"');
  });
});

// ─── Password security ─────────────────────────────────────────────────

describe("Security: Password handling", () => {
  it("passwords are hashed with bcrypt", () => {
    const source = readSource("lib/password.ts");
    expect(source).toContain("bcrypt");
  });

  it("bcrypt uses adequate salt rounds", () => {
    const source = readSource("lib/password.ts");
    expect(source).toContain("SALT_ROUNDS = 12");
  });

  it("register schema enforces minimum password length", () => {
    const source = readSource("lib/authSchemas.ts");
    expect(source).toContain("min(6");
  });

  it("register schema enforces maximum password length", () => {
    const source = readSource("lib/authSchemas.ts");
    expect(source).toContain("max(128");
  });
});

// ─── Input validation ──────────────────────────────────────────────────

describe("Security: Input validation", () => {
  it("all route files import and use validate middleware", () => {
    const routeFiles = [
      "routes/auth/index.ts",
      "routes/workspaces/index.ts",
      "routes/notes/index.ts",
      "routes/codefiles/index.ts",
      "routes/whiteboards/index.ts",
      "routes/admin/index.ts",
    ];

    for (const file of routeFiles) {
      const source = readSource(file);
      expect(source).toContain("validate(");
    }
  });

  it("workspace routes check forbidden fields", () => {
    const source = readSource("routes/workspaces/index.ts");
    expect(source).toContain("hasWorkspaceForbiddenFields");
  });

  it("user routes check forbidden fields", () => {
    const source = readSource("routes/users/index.ts");
    expect(source).toContain("hasForbiddenFields");
  });

  it("note routes check forbidden fields", () => {
    const source = readSource("routes/notes/index.ts");
    expect(source).toContain("hasNoteForbiddenFields");
  });
});

// ─── Authorization ─────────────────────────────────────────────────────

describe("Security: Authorization", () => {
  it("workspace middleware resolves membership from DB", () => {
    const source = readSource("middleware/workspace.ts");
    expect(source).toContain("workspaceMember.findUnique");
    expect(source).toContain("userId_workspaceId");
  });

  it("requireRole uses role hierarchy", () => {
    const source = readSource("middleware/workspace.ts");
    expect(source).toContain("ROLE_HIERARCHY");
    expect(source).toContain("owner: 3");
    expect(source).toContain("admin: 2");
    expect(source).toContain("member: 1");
  });

  it("admin routes use requireRole", () => {
    const source = readSource("routes/admin/index.ts");
    expect(source).toContain("requireRole(");
  });

  it("admin role change requires owner", () => {
    const source = readSource("routes/admin/index.ts");
    expect(source).toContain('requireRole("owner")');
  });

  it("all protected routes use requireAuth", () => {
    const routeFiles = [
      "routes/workspaces/index.ts",
      "routes/notes/index.ts",
      "routes/codefiles/index.ts",
      "routes/whiteboards/index.ts",
      "routes/invites/index.ts",
      "routes/users/index.ts",
      "routes/admin/index.ts",
      "routes/activity/index.ts",
    ];

    for (const file of routeFiles) {
      const source = readSource(file);
      expect(source).toContain("requireAuth");
    }
  });
});

// ─── Sensitive data protection ─────────────────────────────────────────

describe("Security: Sensitive data protection", () => {
  it("auth routes never return passwordHash in API responses", () => {
    const source = readSource("routes/auth/index.ts");
    // USER_SELECT should not include passwordHash
    const selectMatch = source.match(/const USER_SELECT = \{[\s\S]*?\} as const;/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![0]).not.toContain("passwordHash");
    // Login response manually lists fields — should not include passwordHash
    const loginSection = source.substring(source.indexOf("/auth/login"));
    expect(loginSection).not.toMatch(/passwordHash.*user/);
  });

  it("USER_SELECT does not include passwordHash", () => {
    const source = readSource("routes/auth/index.ts");
    // The USER_SELECT const should not contain passwordHash
    const selectMatch = source.match(/const USER_SELECT = \{[\s\S]*?\} as const;/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![0]).not.toContain("passwordHash");
  });

  it("activity log sanitizes sensitive metadata fields", () => {
    const source = readSource("lib/activityLog.ts");
    expect(source).toContain("SENSITIVE_FIELDS");
    expect(source).toContain('"password"');
    expect(source).toContain('"passwordHash"');
    expect(source).toContain('"token"');
    expect(source).toContain('"secret"');
  });

  it("health endpoint does not expose secrets", () => {
    const source = readSource("routes/health.ts");
    expect(source).not.toContain("JWT_SECRET");
    expect(source).not.toContain("DATABASE_URL");
  });

  it("config validates JWT_SECRET minimum length", () => {
    const source = readSource("config/index.ts");
    expect(source).toContain("min(32");
  });

  it("config validates DATABASE_URL is a URL", () => {
    const source = readSource("config/index.ts");
    expect(source).toContain(".url()");
  });
});

// ─── Helmet ────────────────────────────────────────────────────────────

describe("Security: Helmet configuration", () => {
  it("CSP is configured with restrictive defaults", () => {
    const source = readSource("middleware/security.ts");
    expect(source).toContain("defaultSrc: [\"'self'\"]");
    expect(source).toContain("connectSrc: [\"'self'\"]");
  });

  it("COEP is only disabled outside production", () => {
    const source = readSource("middleware/security.ts");
    expect(source).toContain("crossOriginEmbedderPolicy: config.NODE_ENV === \"production\"");
  });
});
