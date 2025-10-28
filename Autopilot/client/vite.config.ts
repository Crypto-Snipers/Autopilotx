import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '');
  
  // Log environment variables for debugging (remove in production)
  console.log('VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? '***' : 'Not set');
  console.log('VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? '***' : 'Not set');

  return {
    base: '/',
    plugins: [react()],
    root: '.',
    build: {
      outDir: '../client-dist',
      emptyOutDir: true,
      rollupOptions: {
        // Remove external since we want to bundle everything
      },
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@lib': path.resolve(__dirname, 'src/lib'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@types': path.resolve(__dirname, 'src/types'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      
    },
    css: {
      postcss: './postcss.config.cjs',
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
    optimizeDeps: {
      include: ['@supabase/supabase-js'],
    },
  };
});
