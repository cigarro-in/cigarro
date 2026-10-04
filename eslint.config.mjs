import { plugin as shadcn } from "@shadcn/lint";
import tsParser from "@typescript-eslint/parser";

export default [
  // Printable invoices intentionally use physical paper dimensions and an
  // operator-selected brand color, independent of the interactive admin UI.
  { ignores: ["src/adminnew/components/invoices/InvoiceDocument.tsx"] },
  {
    files: [
      "src/adminnew/**/*.tsx",
      "src/components/ui/empty.tsx",
    ],
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
