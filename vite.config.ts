/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // 기본 경로(T1): 브라우저 → http://localhost:5173/api/v1/… → 이 프록시(/api) → localhost:8080.
    // 브라우저 기준 같은 출처라 CORS가 개입하지 않는다. 직접 호출(T2)은 VITE_API_BASE_URL을
    // http://localhost:8080/api/v1로 바꾼다. 백엔드가 허용하는 Origin은 http://localhost:5173뿐이고
    // 프록시가 브라우저의 Origin을 그대로 넘기므로, 다른 포트로 조용히 바뀌면 쿠키 연산이 모두 403이 된다.
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Queue flows poll on real timers (Retry-After); leave room for a loaded machine.
    testTimeout: 20000,
    // Node 25+ ships its own (empty) globalThis.localStorage which shadows jsdom's.
    execArgv: ['--no-webstorage'],
  },
})
