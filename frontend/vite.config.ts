import { defineConfig, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function attachHealthPlusApi(middlewares: ViteDevServer['middlewares'] | PreviewServer['middlewares']) {
  middlewares.use('/api/health', (req, res, next) => {
    try {
      const handler = require(path.resolve(import.meta.dirname, '../api/health.js'))
      handler(req, res)
    } catch (err) {
      next(err)
    }
  })

  middlewares.use('/api/ai/chat', async (req, res, next) => {
    try {
      const handler = require(path.resolve(import.meta.dirname, '../api/ai/chat.js'))
      await handler(req, res)
    } catch (err) {
      next(err)
    }
  })

  middlewares.use('/api/auth/login', async (req, res, next) => {
    try {
      const handler = require(path.resolve(import.meta.dirname, '../api/auth/login.js'))
      await handler(req, res)
    } catch (err) {
      next(err)
    }
  })

  middlewares.use('/api/auth/signup', async (req, res, next) => {
    try {
      const handler = require(path.resolve(import.meta.dirname, '../api/auth/signup.js'))
      await handler(req, res)
    } catch (err) {
      next(err)
    }
  })

  middlewares.use('/api/auth/reset-password', async (req, res, next) => {
    try {
      const handler = require(path.resolve(import.meta.dirname, '../api/auth/reset-password.js'))
      await handler(req, res)
    } catch (err) {
      next(err)
    }
  })
}

const localApiPlugin = {
  name: 'healthplus-local-api-gateway',
  configureServer(server: ViteDevServer) {
    attachHealthPlusApi(server.middlewares)
  },
  configurePreviewServer(server: PreviewServer) {
    attachHealthPlusApi(server.middlewares)
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
})
