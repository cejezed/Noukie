import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  root: './client',
  plugins: [
    react(),
    tsconfigPaths({ projects: ['./client/tsconfig.json'] }), // <-- belangrijk
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'), // <-- @ wijst naar client/src
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
