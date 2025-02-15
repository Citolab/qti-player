/** @type {import('vite').UserConfig} */
import { defineConfig } from "vite";

const fullReloadAlways = {
  name: "full-reload-always",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
};

export default defineConfig({
  plugins: [fullReloadAlways],
  base: process.env.NODE_ENV === 'production' ? 'https://citolab.github.io/qti-iol-player/' : './',
  server: {
    watch: {
      ignored: ['!**/node_modules/@citolab/qti-components/**']
    },
  },
  optimizeDeps: {
    noDiscovery: true,
  },
});
