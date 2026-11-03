import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const apiDir = path.join(frontendRoot, "src", "app", "api");
const tempApiDir = path.join(frontendRoot, "src", "_api_dev_only");
const nextDir = path.join(frontendRoot, ".next");
const outDir = path.join(frontendRoot, "out");

function restoreApiDir() {
  if (fs.existsSync(tempApiDir) && !fs.existsSync(apiDir)) {
    fs.renameSync(tempApiDir, apiDir);
  }
}

process.on("SIGINT", () => {
  restoreApiDir();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restoreApiDir();
  process.exit(143);
});

try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, tempApiDir);
  }

  fs.rmSync(nextDir, { recursive: true, force: true });
  fs.rmSync(outDir, { recursive: true, force: true });

  execSync("npx next build", {
    cwd: frontendRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
    },
  });
} finally {
  restoreApiDir();
}
