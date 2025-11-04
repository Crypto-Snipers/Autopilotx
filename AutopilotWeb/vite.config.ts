  // Local vite
  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  import path from "path";
  import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
  export default defineConfig({
    plugins: [
      react(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
        process.env.REPL_ID !== undefined
        ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
        : []),
    ],
    resolve: {
      alias: {
        // "@": path.resolve(import.meta.dirname, "client", "src"),
        // "@shared": path.resolve(import.meta.dirname, "shared"),
        // "@assets": path.resolve(import.meta.dirname, "attached_assets"),
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
        "@hooks": path.resolve(import.meta.dirname, "client", "src/hooks"),
        "@lib": path.resolve(import.meta.dirname, "client", "src/lib"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },


  });



// Production vite
// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";
// import path from "path";
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// export default defineConfig(async () => {
//   const plugins = [
//     react(),
//     runtimeErrorOverlay(),
//   ];

//   if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
//     const { cartographer } = await import("@replit/vite-plugin-cartographer");
//     plugins.push(cartographer());
//   }

//   return {
//     base: '/',
//     plugins,
//     css: {
//       postcss: {
//         plugins: [
//           (await import('tailwindcss')).default,
//           (await import('autoprefixer')).default,
//         ],
//       },
//     },
//     resolve: {
//       alias: {
//         "@": path.resolve(__dirname, "client", "src"),
//         "@shared": path.resolve(__dirname, "shared"),
//         "@assets": path.resolve(__dirname, "attached_assets"),
//       },
//     },
//     root: path.resolve(__dirname, "client"),
//     build: {
//       outDir: path.resolve(__dirname, "client-dist"),
//       emptyOutDir: true,
//       rollupOptions: {
//         // Add react-router-dom to external dependencies
//         external: ['react-router-dom'],
//         output: {
//           manualChunks: {
//             react: ['react', 'react-dom', 'react-router-dom'],
//           },
//         },
//       },
//       sourcemap: true,
//     },
//   };
// });
