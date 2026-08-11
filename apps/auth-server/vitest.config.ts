import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Route handlers import via the "@/*" tsconfig path alias (e.g.
// "@/lib/supabase-server"). Vitest/Vite doesn't read tsconfig `paths`
// automatically, so it's mirrored here — otherwise both the route imports
// and this suite's `vi.mock("@/lib/...")` calls would fail to resolve.
// Plain Node environment is enough: Route Handlers run on standard Fetch
// API Request/Response, no DOM involved.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": dirname,
    },
  },
});
