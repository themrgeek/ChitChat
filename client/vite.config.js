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
    target: "es2020", // Modern browsers for smaller bundles
    cssMinify: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Better code splitting for caching
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          socket: ["socket.io-client"],
          crypto: ["crypto-js"],
          ui: ["lucide-react", "zustand"],
        },
        // Optimize asset file names for caching
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "socket.io-client",
      "zustand",
    ],
  },
});
