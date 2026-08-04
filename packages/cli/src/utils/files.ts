import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

export interface EnvValues {
  [key: string]: string;
}

export async function writeEnvFile(path: string, values: EnvValues): Promise<void> {
  const contents = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(path, `${contents}\n`, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
