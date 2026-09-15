import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");
const BACKEND = path.resolve(ROOT, "backend");

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(BACKEND, filePath), "utf-8");
}

function exists(filePath: string): boolean {
  return fs.existsSync(path.resolve(BACKEND, filePath));
}

describe("Production: Environment config", () => {
  it("config validates DATABASE_URL is a URL", () => {
    const source = read("src/config/index.ts");
    expect(source).toContain("z.string().url()");
  });

  it("config validates JWT_SECRET minimum length", () => {
    const source = read("src/config/index.ts");
    expect(source).toContain("min(32");
  });

  it("config has FRONTEND_URL as optional", () => {
    const source = read("src/config/index.ts");
    expect(source).toContain("FRONTEND_URL");
    expect(source).toContain("optional()");
  });

  it("config has TRUST_PROXY", () => {
    const source = read("src/config/index.ts");
    expect(source).toContain("TRUST_PROXY");
  });

  it("config warns in production about weak JWT_SECRET", () => {
    const source = read("src/config/index.ts");
    expect(source).toContain('JWT_SECRET.includes("change")');
  });

  it(".env.example has all required vars", () => {
    const example = fs.readFileSync(path.resolve(BACKEND, ".env.example"), "utf-8");
    expect(example).toContain("DATABASE_URL");
    expect(example).toContain("JWT_SECRET");
    expect(example).toContain("CORS_ORIGIN");
    expect(example).toContain("TRUST_PROXY");
  });

  it(".env.example has FRONTEND_URL placeholder", () => {
    const example = fs.readFileSync(path.resolve(BACKEND, ".env.example"), "utf-8");
    expect(example).toContain("FRONTEND_URL");
  });
});

describe("Production: CORS config", () => {
  it("CORS supports multiple origins via FRONTEND_URL", () => {
    const source = read("src/middleware/cors.ts");
    expect(source).toContain("getAllowedOrigins");
    expect(source).toContain("FRONTEND_URL");
  });

  it("CORS deduplicates origins", () => {
    const source = read("src/middleware/cors.ts");
    expect(source).toContain("new Set(origins)");
  });

  it("CORS allows credentials", () => {
    const source = read("src/middleware/cors.ts");
    expect(source).toContain("credentials: true");
  });
});

describe("Production: Trust proxy", () => {
  it("server reads TRUST_PROXY from config", () => {
    const source = read("src/index.ts");
    expect(source).toContain("TRUST_PROXY");
    expect(source).toContain("trust proxy");
  });
});

describe("Production: Health endpoint", () => {
  it("health endpoint exists", () => {
    expect(exists("src/routes/health.ts")).toBe(true);
  });

  it("health endpoint checks DB", () => {
    const source = read("src/routes/health.ts");
    expect(source).toContain("$queryRaw");
  });

  it("health endpoint returns 503 when DB is down", () => {
    const source = read("src/routes/health.ts");
    expect(source).toContain("503");
  });

  it("health endpoint includes environment", () => {
    const source = read("src/routes/health.ts");
    expect(source).toContain("environment");
  });
});

describe("Production: Migration workflow", () => {
  it("has prisma:migrate:deploy script", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["prisma:migrate:deploy"]).toBe("prisma migrate deploy");
  });

  it("has prisma:migrate:status script", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["prisma:migrate:status"]).toBe("prisma migrate status");
  });

  it("has prisma:generate script", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["prisma:generate"]).toBeDefined();
  });

  it("has prisma:validate script", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["prisma:validate"]).toBeDefined();
  });

  it("schema uses PostgreSQL provider", () => {
    const source = read("prisma/schema.prisma");
    expect(source).toContain('provider = "postgresql"');
  });
});

describe("Production: Deployment files", () => {
  it("backend Dockerfile exists", () => {
    expect(exists("Dockerfile")).toBe(true);
  });

  it("backend Dockerfile uses non-root user", () => {
    const source = read("Dockerfile");
    expect(source).toContain("appuser");
  });

  it("backend Dockerfile exposes correct port", () => {
    const source = read("Dockerfile");
    expect(source).toContain("EXPOSE 3001");
  });

  it("docker-compose.yml exists at root", () => {
    expect(fs.existsSync(path.resolve(ROOT, "docker-compose.yml"))).toBe(true);
  });

  it("deploy.sh exists", () => {
    expect(exists("deploy.sh")).toBe(true);
  });

  it("deploy.sh validates env before migration", () => {
    const source = read("deploy.sh");
    expect(source).toContain("DATABASE_URL");
    expect(source).toContain("JWT_SECRET");
    expect(source).toContain("prisma migrate deploy");
  });

  it("frontend Dockerfile exists", () => {
    expect(fs.existsSync(path.resolve(ROOT, "frontend/Dockerfile"))).toBe(true);
  });

  it("nginx.conf exists at root", () => {
    expect(fs.existsSync(path.resolve(ROOT, "nginx.conf"))).toBe(true);
  });

  it("vercel.json exists at root", () => {
    expect(fs.existsSync(path.resolve(ROOT, "vercel.json"))).toBe(true);
  });
});

describe("Production: Graceful shutdown", () => {
  it("server handles SIGTERM", () => {
    const source = read("src/index.ts");
    expect(source).toContain("SIGTERM");
    expect(source).toContain("disconnectDatabase");
  });

  it("server handles SIGINT", () => {
    const source = read("src/index.ts");
    expect(source).toContain("SIGINT");
    expect(source).toContain("disconnectDatabase");
  });
});

describe("Production: WebSocket security", () => {
  it("WebSocket maxPayload is configured", () => {
    const source = read("src/ws/server.ts");
    expect(source).toContain("WS_MAX_PAYLOAD");
    expect(source).toContain("maxPayload: WS_MAX_PAYLOAD");
  });

  it("WebSocket has flood protection", () => {
    const source = read("src/ws/server.ts");
    expect(source).toContain("MSG_RATE_LIMIT");
    expect(source).toContain("MSG_RATE_WINDOW");
  });

  it("WebSocket authenticates before join", () => {
    const source = read("src/ws/server.ts");
    expect(source).toContain("verifyAuthToken");
    expect(source).toContain("close(4001");
  });

  it("WebSocket verifies workspace membership", () => {
    const source = read("src/ws/server.ts");
    expect(source).toContain("workspaceMember.findUnique");
  });
});
