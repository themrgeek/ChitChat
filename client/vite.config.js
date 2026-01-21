import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      // ⚡ Faster JSX transform
      jsxRuntime: "automatic",
    }),
  ],
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
    target: "esnext", // ⚡ Latest browsers for smallest bundle
    cssMinify: true,
    cssCodeSplit: true, // ⚡ Split CSS for better caching
    // ⚡ Optimize chunk size
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // ⚡ Better code splitting for caching
        manualChunks: {
          // Core React (loaded immediately)
          "react-core": ["react", "react-dom"],
          // Router (loaded with first navigation)
          router: ["react-router-dom"],
          // Socket (loaded when authenticated)
          socket: ["socket.io-client"],
          // Crypto (loaded when needed)
          crypto: ["crypto-js"],
          // UI components (loaded lazily)
          ui: ["lucide-react"],
          // State management
          state: ["zustand"],
        },
        // ⚡ Optimize asset file names for caching
        assetFileNames: (assetInfo) => {
          // Hash CSS files for long caching
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
      },
    },
    // ⚡ Report compressed sizes
    reportCompressedSize: true,
  },
  // ⚡ Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "socket.io-client",
      "zustand",
      "lucide-react",
    ],
    // ⚡ Pre-bundle in production
    force: false,
  },
  // ⚡ Enable esbuild optimizations
  esbuild: {
    drop: ["console", "debugger"], // ⚡ Remove console.log in production
    legalComments: "none", // ⚡ Remove comments
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
});
