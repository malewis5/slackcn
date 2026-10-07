import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const example = fileURLToPath(new URL("../", import.meta.url));
const workflow = `${example}node_modules/workflow/dist/`;

export default defineConfig({
  resolve: {
    alias: [
      { find: "workflow/api", replacement: `${workflow}api.js` },
      { find: "workflow/errors", replacement: `${workflow}internal/errors.js` },
      { find: "workflow", replacement: `${workflow}index.js` },
      { find: /^@\//, replacement: example },
      {
        find: "slackcn/utils",
        replacement: fileURLToPath(new URL("../../../lib/get-base-url.ts", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["examples/slack-next/tests/*.test.ts"],
    clearMocks: true,
  },
});
