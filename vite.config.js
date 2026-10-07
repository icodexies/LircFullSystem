import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'router-vendor',
              test: /[\\/]node_modules[\\/]react-router(?:-dom)?[\\/]/,
              priority: 15,
            },
            {
              name: 'supabase-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?@supabase[\\/]/,
              priority: 10,
              includeDependenciesRecursively: true,
            },
          ],
        },
      },
    },
  },
})
