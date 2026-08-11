import { spawn } from "node:child_process";

/**
 * Best-effort browser open, no new dependency (avoids pulling in the `open`
 * npm package for three lines of platform dispatch). Never throws — a
 * failed/unsupported open shouldn't fail the installer over a convenience
 * feature. Callers may open a URL before its server is actually listening
 * (e.g. right after the wizard finishes, before the user runs `pnpm dev`) —
 * that's expected; the tab just needs a manual refresh once it's up, same
 * as most dev-server CLIs that open the browser optimistically.
 */
export function openBrowser(url: string): void {
  try {
    const child =
      process.platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true })
        : process.platform === "darwin"
          ? spawn("open", [url], { detached: true, stdio: "ignore" })
          : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Best-effort only.
  }
}
