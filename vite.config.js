/** @type {import('vite').UserConfig} */
import { defineConfig } from "vite";

// When linking qti-components from source this plugin will force a full reload on changes
const fullReloadAlways = {
  name: "full-reload-always",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
};

// https://citolab.github.io/qti-iol-player/
export default defineConfig({
  envDir: './env',
  plugins: [fullReloadAlways],
  base: '', // use relative paths for GitHub Pages and testing, while setting base href in index.html
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