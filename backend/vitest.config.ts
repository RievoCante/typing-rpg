import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  plugins: [
    {
      name: "mock-cloudflare-workers",
      enforce: "pre",
      resolveId(source) {
        if (source === "cloudflare:workers") {
          return path.resolve(__dirname, "__mocks__/cloudflare-workers.ts");
        }
      },
    },
  ],
});
