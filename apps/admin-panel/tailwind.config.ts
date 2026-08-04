import kontroliaPreset from "@kontrolia/config/tailwind/preset";
import type { Config } from "tailwindcss";

const config: Config = {
  presets: [kontroliaPreset as Partial<Config>],
  prefix: "k-",
  content: [
    "./app/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/react-sdk/src/**/*.{ts,tsx}",
  ],
};

export default config;
