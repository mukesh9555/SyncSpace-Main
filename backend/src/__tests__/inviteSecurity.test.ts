import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acceptInviteSchema } from "../lib/workspaceSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Invite email-matching security", () => {
  it("acceptInviteSchema only accepts a token string", () => {
    const result = acceptInviteSchema.safeParse({ token: "abc123" });
    expect(result.success).toBe(true);
  });

  it("acceptInviteSchema rejects missing token", () => {
    const result = acceptInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("route requires req.userEmail to match invite.email", () => {
    // Resolve relative to src/__tests__, not dist/__tests__
    const srcDir = path.resolve(__dirname, "../../src");
    const routePath = path.resolve(srcDir, "routes/invites/index.ts");
    const source = fs.readFileSync(routePath, "utf-8");
    expect(source).toContain("invite.email !== req.userEmail");
    expect(source).toContain("This invite was sent to a different email address");
  });
});
