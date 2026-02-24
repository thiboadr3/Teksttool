import fs from "node:fs";
import { execSync } from "node:child_process";

function parsePsOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstSpace = line.indexOf(" ");
      if (firstSpace === -1) {
        return null;
      }

      const pid = Number(line.slice(0, firstSpace).trim());
      const command = line.slice(firstSpace + 1).trim();

      if (!Number.isFinite(pid) || pid <= 0 || !command) {
        return null;
      }

      return { pid, command };
    })
    .filter((entry) => entry !== null);
}

function shouldKill(command, cwd) {
  if (!command.includes(cwd)) {
    return false;
  }

  const patterns = [
    "dist-electron/main.js",
    "node scripts/dev-app.js",
    "vite --strictPort --port",
    "vite --port",
    "esbuild main/main.ts main/preload.ts",
    "electronmon/src/hook.js",
    "wait-on tcp:"
  ];

  return patterns.some((pattern) => command.includes(pattern));
}

export function stopDevProcesses() {
  const cwd = fs.realpathSync(process.cwd());
  const raw = execSync("ps -axo pid=,command=", { encoding: "utf8" });
  const processes = parsePsOutput(raw);

  const toKill = processes.filter(
    (proc) => proc.pid !== process.pid && shouldKill(proc.command, cwd)
  );

  for (const proc of toKill) {
    try {
      process.kill(proc.pid, "SIGTERM");
    } catch {
      // Process might already be gone.
    }
  }

  return toKill.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const killed = stopDevProcesses();
  if (killed > 0) {
    console.log(`Stopped ${killed} dev process(es).`);
  }
}
