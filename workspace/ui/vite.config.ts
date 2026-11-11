import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The workspace UI ships prebuilt inside the Redesign skill. Every asset is
// inlined so the build is text only (the skill build copies scripts as text).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../../skills/congo/scripts/workspace/ui",
    emptyOutDir: true,
    assetsInlineLimit: 200_000,
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 4868,
    strictPort: true,
    proxy: { "/api": process.env.CONGO_WORKSPACE_DEV_API ?? "http://127.0.0.1:4870" },
  },
});
