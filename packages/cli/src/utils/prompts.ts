import * as p from "@clack/prompts";

/** A required text prompt — exits cleanly on Ctrl+C instead of returning a cancel symbol to every call site. */
export async function textOrExit(message: string, placeholder?: string): Promise<string> {
  const value = await p.text({ message, placeholder });
  if (p.isCancel(value)) {
    p.cancel("Instalación cancelada.");
    process.exit(0);
  }
  return value;
}
