import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { stopDevProcesses } from "./stop-dev.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultDevPort = 5173;

function resolveDevPort() {
  const raw = process.env.VITE_DEV_PORT?.trim();
  if (!raw) {
    return String(defaultDevPort);
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    console.warn(`[dev] Ongeldige VITE_DEV_PORT "${raw}", fallback naar ${defaultDevPort}.`);
    return String(defaultDevPort);
  }

  return String(parsed);
}

function binPath(name) {
  return path.resolve(
    projectRoot,
    `node_modules/.bin/${name}${process.platform === "win32" ? ".cmd" : ""}`
  );
}

function spawnCmd(command, args) {
  return spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env
  });
}

function electronBuildArgs({ watch }) {
  const args = [
    "main/main.ts",
    "main/preload.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node20",
    "--sourcemap",
    "--outdir=dist-electron",
    "--packages=external",
    "--external:electron"
  ];

  if (watch) {
    args.push("--watch");
  }

  return args;
}

function runBuild() {
  return new Promise((resolve, reject) => {
    console.log("[dev] Building Electron main/preload...");

    const build = spawnCmd(binPath("esbuild"), electronBuildArgs({ watch: false }));

    const timeout = setTimeout(() => {
      build.kill("SIGTERM");
      reject(new Error("build:electron timeout na 30s"));
    }, 30_000);

    build.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    build.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log("[dev] Build klaar.");
        resolve();
      } else {
        reject(new Error(`build:electron failed with exit code ${code ?? "unknown"}`));
      }
    });
  });
}

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  stopDevProcesses();

  setTimeout(() => process.exit(exitCode), 150);
}

async function main() {
  const devPort = resolveDevPort();
  process.env.VITE_DEV_PORT = devPort;

  stopDevProcesses();
  await runBuild();

  console.log("[dev] Starting renderer, electron watcher en app...");
  console.log(`[dev] Renderer poort: ${devPort}`);

  children.push(spawnCmd(binPath("vite"), ["--strictPort", "--port", devPort]));
  children.push(spawnCmd(binPath("esbuild"), electronBuildArgs({ watch: true })));
  children.push(spawnCmd(process.execPath, ["scripts/dev-app.js"]));

  for (const child of children) {
    child.on("error", () => shutdown(1));
    child.on("exit", (code) => {
      if (!shuttingDown && code && code !== 0) {
        shutdown(code);
      }
    });
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
