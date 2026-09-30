import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const REQUIRED_BACKEND_VARS = ['VITE_API_BASE_URL', 'VITE_SOCKET_URL'] as const
const HOSTING_ORIGIN = /web\.app|firebaseapp\.com/

/**
 * Fails a deploy build whose backend URLs are empty or point at the Hosting
 * origin. Opt-in (`REQUIRE_BACKEND_ENV=1`, set by the deploy workflow) so a
 * local `npm run build` against the dev proxy stays green.
 *
 * Without it an unset CI variable builds green, REST "works" by accident via
 * the SPA rewrite, and the socket — which Hosting cannot proxy — never
 * connects. [HARD-WON, game_stack.md §1]
 */
function requireBackendEnv(env: Record<string, string>): Plugin {
  return {
    name: 'lemony:require-backend-env',
    apply: 'build',
    buildStart() {
      if (process.env.REQUIRE_BACKEND_ENV !== '1') return
      const problems = REQUIRED_BACKEND_VARS.flatMap((key) => {
        const value = (env[key] ?? '').trim()
        if (!value) return [`${key} is empty — set the repository variable vars.${key}.`]
        if (HOSTING_ORIGIN.test(value)) return [`${key} is ${value}, a Hosting origin. It must be the backend host.`]
        return []
      })
      if (problems.length > 0) {
        this.error('Refusing to build a deploy bundle with no backend configured:\n' + problems.map((p) => `  - ${p}`).join('\n'))
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), requireBackendEnv(env)],
    build: {
      // The lazy 3D chunk (three + r3f + drei) is large by nature; it loads only
      // when a player opens the 3D view.
      chunkSizeWarningLimit: 1500,
    },
    server: {
      proxy: {
        '/api': 'http://localhost:8080',
        '/socket.io': { target: 'http://localhost:8080', ws: true },
      },
    },
    test: { environment: 'jsdom', setupFiles: ['./src/__tests__/setup.ts'] },
  }
})
