import { run } from "./exec.js";
import type { EnvValues } from "./files.js";

/**
 * Resolves "owner/repo" from the git remote, so the wizard can offer to
 * create Vercel projects automatically instead of walking the user through
 * `vercel`/dashboard steps by hand. Only understands GitHub remotes (https
 * or ssh) — Vercel's own gitRepository.type also supports gitlab/bitbucket,
 * but this product's docs and CLI only ever assume GitHub.
 */
export async function detectGitHubRepo(repoRoot: string): Promise<string | null> {
  try {
    const url = (await run("git", ["remote", "get-url", "origin"], { cwd: repoRoot })).trim();
    const match = url.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    return match ? `${match[1]}/${match[2]}` : null;
  } catch {
    return null;
  }
}

/** The branch actually checked out — what should get deployed, not an assumed "main". */
export async function detectCurrentBranch(repoRoot: string): Promise<string> {
  try {
    const branch = (await run("git", ["branch", "--show-current"], { cwd: repoRoot })).trim();
    return branch || "main";
  } catch {
    return "main";
  }
}

export interface CreateVercelProjectOptions {
  token: string;
  /** "owner/repo" on GitHub. */
  repo: string;
  name: string;
  rootDirectory: string;
  env: EnvValues;
}

export interface CreateVercelProjectResult {
  ok: boolean;
  /** Only present when ok is false. */
  error?: string;
}

/**
 * Creates a Vercel project via the REST API — connected to the GitHub repo,
 * scoped to one app's folder in this monorepo, with its environment
 * variables already set. This is what makes automatic setup possible: the
 * same three things (gitRepository, rootDirectory, environmentVariables)
 * that are easy to get wrong doing this by hand (see the "vercel CLI run
 * from inside the app folder" failure mode) are just fields in one request
 * body here.
 *
 * https://vercel.com/docs/rest-api/reference/endpoints/projects/create-a-new-project
 */
export async function createVercelProject(options: CreateVercelProjectOptions): Promise<CreateVercelProjectResult> {
  const environmentVariables = Object.entries(options.env).map(([key, value]) => ({
    key,
    value,
    type: "encrypted" as const,
    target: ["production", "preview", "development"] as const,
  }));

  let response: Response;
  try {
    response = await fetch("https://api.vercel.com/v11/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: options.name,
        framework: "nextjs",
        gitRepository: { type: "github", repo: options.repo },
        rootDirectory: options.rootDirectory,
        environmentVariables,
      }),
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  if (response.ok) return { ok: true };

  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, error: body?.error?.message ?? `HTTP ${response.status}` };
}

export interface TriggerDeploymentOptions {
  token: string;
  /** "owner/repo" on GitHub. */
  repo: string;
  branch: string;
  /** Must match the `name` used in createVercelProject — that's how this targets the right project. */
  projectName: string;
}

/**
 * Creating a project via the API (createVercelProject above) connects the
 * GitHub repo but does NOT build or deploy anything by itself — that's a
 * separate resource. Without this, a freshly created project just sits
 * there until something else (a push, or clicking "Deploy" in the
 * dashboard) triggers its first build, which defeats the point of
 * automating this in the first place.
 *
 * https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment
 */
export async function triggerVercelDeployment(options: TriggerDeploymentOptions): Promise<CreateVercelProjectResult> {
  const [org, repo] = options.repo.split("/");

  let response: Response;
  try {
    response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: options.projectName,
        target: "production",
        gitSource: { type: "github", ref: options.branch, org, repo },
      }),
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  if (response.ok) return { ok: true };

  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, error: body?.error?.message ?? `HTTP ${response.status}` };
}
