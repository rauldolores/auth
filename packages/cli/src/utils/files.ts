import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

export interface EnvValues {
  [key: string]: string;
}

export async function writeEnvFile(path: string, values: EnvValues): Promise<void> {
  const contents = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(path, `${contents}\n`, "utf8");
}

/**
 * Updates (or appends) a single key in an existing .env file without
 * touching the rest — for docker/.env, which database.ts already wrote a
 * full set of values into before deployment.ts runs.
 */
export async function updateEnvValue(path: string, key: string, value: string): Promise<void> {
  const current = existsSync(path) ? await readFile(path, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const updated = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current.replace(/\n+$/, "")}\n${line}\n`;
  await writeFile(path, updated.replace(/^\n/, ""), "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Parses a simple `KEY=value` .env file (no quoting/escaping) — null if it doesn't exist. */
export async function readEnvFile(path: string): Promise<EnvValues | null> {
  if (!existsSync(path)) return null;
  const contents = await readFile(path, "utf8");
  const values: EnvValues = {};
  for (const line of contents.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      values[key as string] = (value as string).trim();
    }
  }
  return values;
}
