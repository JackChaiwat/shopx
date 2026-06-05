import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export function createViteConfig() {
  const root = fileURLToPath(new URL("..", import.meta.url));

  return {
    configFile: false,
    root,
    plugins: [react()],
    optimizeDeps: {
      noDiscovery: true,
      include: [],
      esbuildOptions: {
        absWorkingDir: root,
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("../src", import.meta.url)),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            query: ["@tanstack/react-query"],
            ui: ["lucide-react", "react-hot-toast"],
            charts: ["recharts"],
          },
        },
      },
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://backend:8000",
          changeOrigin: true,
        },
        "/ws": {
          target: "ws://backend:8000",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
}
