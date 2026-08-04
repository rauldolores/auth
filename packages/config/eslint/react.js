import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "./base.js";

/** ESLint flat config for React library packages (no Next.js runtime). */
export const reactConfig = [
  ...baseConfig,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];

export default reactConfig;
