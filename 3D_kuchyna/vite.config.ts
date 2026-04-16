import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5191",
        changeOrigin: true
      },
      "/exports": {
        target: "http://127.0.0.1:5191",
        changeOrigin: true
      }
    }
  }
});

