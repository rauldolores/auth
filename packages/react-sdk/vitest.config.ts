import { defineConfig } from "vitest/config";

// Unlike auth-sdk/next-sdk (plain Node environment is enough for their HTTP-
// and JWT-focused tests), this package renders React components/hooks and
// needs a DOM to mount into — jsdom is the standard, lighter-weight choice
// that @testing-library/react expects.
export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
