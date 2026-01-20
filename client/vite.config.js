import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
        secure: false,
        // Handle WebSocket errors gracefully
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.log("Proxy error:", err.message);
          });
          proxy.on("proxyReqWs", (proxyReq, req, socket) => {
            socket.on("error", (err) => {
              console.log("Socket error:", err.message);
            });
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          socket: ["socket.io-client"],
          crypto: ["crypto-js"],
        },
      },
    },
  },
});
