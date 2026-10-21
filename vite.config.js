/** @type {import('vite').UserConfig} */
import { defineConfig } from "vite";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

// When linking qti-components from source this plugin will force a full reload on changes
const fullReloadAlways = {
  name: "full-reload-always",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
};

// The shell (index.html) and every example in examples/<id>/index.html are html entry points of their own
const examples = readdirSync("examples", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const input = {
  main: resolve("index.html"),
  ...Object.fromEntries(examples.map((id) => [id, resolve("examples", id, "index.html")])),
};

// https://citolab.github.io/qti-iol-player/
export default defineConfig({
  envDir: './env',
  plugins: [fullReloadAlways],
  base: '', // use relative paths for GitHub Pages and testing
  build: { rollupOptions: { input } },
  server: {
    watch: {
      // watch changes in qti-components for development
      ignored: ['!**/node_modules/@citolab/qti-components/**']
    },
  },
  optimizeDeps: {
    noDiscovery: true,
  },
});
