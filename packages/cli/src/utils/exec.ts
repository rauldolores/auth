import { execSync, spawn } from "node:child_process";

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Runs a command to completion, buffering its output. Rejects with the
 * captured stderr/stdout on a non-zero exit. Uses a shell so Windows can
 * resolve the `.cmd` shims for pnpm/docker/git; args with spaces are quoted
 * so a target directory like `mi carpeta` survives that round-trip.
 */
export function run(command: string, args: string[], options: RunOptions = {}): Promise<string> {
  const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(" ");
  return new Promise((resolve, reject) => {
    const child = spawn(`${command} ${quoted}`.trim(), {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.stderr?.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err.trim() || out.trim() || `${command} terminó con código ${code}`));
    });
  });
}

/** True if a command resolves on PATH. */
export function commandExists(command: string): boolean {
  try {
    const probe = process.platform === "win32" ? "where" : "command -v";
    execSync(`${probe} ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Best-effort first line of `command --version`, or null if it isn't installed. */
export function tryVersion(command: string, arg = "--version"): string | null {
  try {
    const output = execSync(`${command} ${arg}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();
    return (output.trim().split("\n")[0] ?? "").trim() || null;
  } catch {
    return null;
  }
}
