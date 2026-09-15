import { execSync } from "node:child_process";

const INTEGRATION_TESTS = [
  "src/__tests__/auth.integration.test.ts",
  "src/__tests__/workspace.integration.test.ts",
  "src/__tests__/workspaceIsolation.integration.test.ts",
  "src/__tests__/notes.integration.test.ts",
  "src/__tests__/codeFiles.integration.test.ts",
  "src/__tests__/whiteboards.integration.test.ts",
];

let passed = 0;
let failed = 0;

for (const file of INTEGRATION_TESTS) {
  const name = file.split("/").pop().replace(".integration.test.ts", "");
  process.stdout.write(`  ${name} ... `);
  try {
    execSync(`npx vitest run "${file}"`, {
      stdio: "pipe",
      timeout: 30000,
      env: { ...process.env },
    });
    process.stdout.write("ok\n");
    passed++;
  } catch {
    process.stdout.write("FAIL\n");
    failed++;
  }
}

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
