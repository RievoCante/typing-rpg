import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Split heavy vendors into their own cached chunks so the initial
        // payload parses faster and the 3D engine downloads in parallel.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("three") || id.includes("@react-three"))
            return "three-vendor";
          if (id.includes("@clerk")) return "clerk-vendor";
          if (id.includes("@sentry")) return "sentry-vendor";
        },
      },
    },
  },
});
