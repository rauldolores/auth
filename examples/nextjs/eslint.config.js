import { reactConfig } from "@kontrolia/config/eslint/react";

export default [...reactConfig, { ignores: [".next/**", "next-env.d.ts"] }];
