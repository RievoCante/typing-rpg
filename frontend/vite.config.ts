import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split heavy vendors into their own cached chunks so the initial
        // payload parses faster and the 3D engine downloads in parallel.
        manualChunks(id) {
          // Vite's __vitePreload helper is a virtual module (no node_modules in
          // its id) used by every lazy import in the entry. Pin it to
          // react-vendor (already a static entry dep); otherwise Rollup parks it
          // in three-vendor, forcing the entry to statically import three-vendor
          // and putting the 3D bundle back on the critical path.
          if (id.includes('preload-helper')) return 'react-vendor';
          if (!id.includes('node_modules')) return;
          // Match the package path (node_modules/three), not the bare substring
          // "three": a loose match also catches any project/worktree dir that
          // happens to contain "three" in its name, sweeping unrelated deps
          // (react, react-dom, ...) into three-vendor and dragging it back onto
          // the critical path.
          if (id.includes('node_modules/three') || id.includes('@react-three'))
            return 'three-vendor';
          if (id.includes('@clerk')) return 'clerk-vendor';
          if (id.includes('@sentry')) return 'sentry-vendor';
          // Isolate the React runtime (incl. jsx-runtime) in its own chunk.
          // Otherwise React is a shared dep of both the entry and the now-lazy
          // three-vendor chunk, and Rollup hoists the shared bits into
          // three-vendor — making the entry statically import three-vendor and
          // dragging it back onto the critical path. Safe here because the
          // three/@react-three checks above run first (they also match "react").
          if (id.includes('node_modules/react') || id.includes('scheduler'))
            return 'react-vendor';
        },
      },
    },
  },
});
