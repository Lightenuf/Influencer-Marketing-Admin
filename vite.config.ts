import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages는 저장소 이름이 경로에 붙는다: lightenuf.github.io/Influencer-Marketing-Admin/
  base: process.env.GITHUB_PAGES ? '/Influencer-Marketing-Admin/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
