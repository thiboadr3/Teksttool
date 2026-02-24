import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDevPort = 5173;
const electronBin = path.resolve(
  __dirname,
  `../node_modules/.bin/electron${process.platform === "win32" ? ".cmd" : ""}`
);

function resolveDevPort() {
  const raw = process.env.VITE_DEV_PORT?.trim();
  if (!raw) {
    return String(defaultDevPort);
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    return String(defaultDevPort);
  }

  return String(parsed);
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim() || `http://localhost:${resolveDevPort()}`;

const child = spawn(electronBin, ["dist-electron/main.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devServerUrl
  }
});

child.on("error", (error) => {
  console.error("Failed to start Electron", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
