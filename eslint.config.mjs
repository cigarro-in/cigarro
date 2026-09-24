import { plugin as shadcn } from "@shadcn/lint";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/adminnew/pages/DashboardPage.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { shadcn },
    settings: {
      shadcn: {
        ui: "@/components/ui",
        note: "Use Cigarro's semantic theme tokens and existing UI components.",
      },
    },
    rules: {
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-raw-colors": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
    },
  },
];
