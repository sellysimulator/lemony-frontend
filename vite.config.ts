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

/**
 * Fails the build when the entry HTML's import graph reaches the `three` chunk
 * — the lazy 3D board's promise, enforced instead of trusted.
 *
 * The rule is that `three` may appear in NO chunk the entry HTML loads. That holds
 * only while every package in drei's and fiber's transitive tree is caught by
 * `manualChunks` below. It is a list of names, and a `npm update` that adds one
 * more transitive dependency breaks it silently: the new package falls through
 * to `vendor`, `vendor` imports `three`, and Vite emits a `modulepreload` for
 * the whole WebGL bundle on the welcome screen. Nothing fails. The only symptom
 * is a megabyte in the network tab of a player who chose the 2D board.
 *
 * So the rule is checked here, against the emitted bundle, the same way a
 * human would check it: walk the entry chunk's imports transitively and look
 * for `three`. Rollup's own "Circular chunk" message is a warning and warnings
 * scroll past.
 */
function forbidThreeInEntryGraph(): Plugin {
  return {
    name: 'lemony:forbid-three-in-entry-graph',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entries = Object.values(bundle).filter(
        (c): c is Extract<typeof c, { type: 'chunk' }> => c.type === 'chunk' && c.isEntry,
      )

      for (const entry of entries) {
        // Static imports only: `modulepreload` and the entry's own `import`
        // statements are what "the entry HTML loads" means. A dynamic import is
        // exactly the lazy fetch this whole arrangement exists to produce.
        const seen = new Set<string>()
        const queue = [...entry.imports]
        const path = new Map<string, string>(entry.imports.map((f) => [f, entry.fileName]))

        while (queue.length > 0) {
          const fileName = queue.shift() as string
          if (seen.has(fileName)) continue
          seen.add(fileName)

          const chunk = bundle[fileName]
          if (!chunk || chunk.type !== 'chunk') continue

          if (chunk.name === 'three') {
            const chain: string[] = [fileName]
            let cursor = path.get(fileName)
            while (cursor) {
              chain.unshift(cursor)
              cursor = path.get(cursor)
            }
            this.error(
              `The entry HTML loads the \`three\` chunk, which must stay lazy.\n` +
                `  ${chain.join(' -> ')}\n` +
                'A package in drei\'s or fiber\'s tree fell through to `vendor`. Add it to the\n' +
                '`three` bucket in `manualChunks` — see the comment there for how to find it.',
            )
          }

          for (const next of chunk.imports) if (!path.has(next)) path.set(next, fileName)
          queue.push(...chunk.imports)
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), requireBackendEnv(env), forbidThreeInEntryGraph()],
    build: {
      // The lazy 3D chunk (three + r3f + drei) is large by nature; it loads only
      // when a player opens the 3D view.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          /**
           * Splits the dependencies into chunks that change at different rates, as in the other
           * games. The `three` bucket keeps the 3D board's tree out of the entry graph.
           */
          manualChunks(id: string): string | undefined {
            // [HARD-WON] Vite's preload helper is a virtual module that matches no node_modules rule, so Rollup may place it in
            // the `three` chunk; every lazy route then imports `three` from the entry chunk and the welcome screen preloads WebGL.
            if (id.includes('vite/preload-helper')) return 'vendor'
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
            if (/[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/.test(id)) return 'charts'
            if (/[\\/]node_modules[\\/](socket\.io-client|engine\.io-client|engine\.io-parser|socket\.io-parser)[\\/]/.test(id))
              return 'socket'
            // [HARD-WON] The second list is packages that drei and fiber pull in that nothing in src/ imports by name; any of
            // them left to fall through lands in `vendor`, `vendor` then imports `three`, and the entry page preloads it.
            if (/[\\/]node_modules[\\/](three|@react-three|troika-three-text|troika-three-utils|troika-worker-utils|bidi-js|webgl-sdf-generator|its-fine|suspend-react|react-reconciler)[\\/]/.test(id))
              return 'three'
            if (/[\\/]node_modules[\\/](three-stdlib|three-mesh-bvh|camera-controls|maath|meshline|potpack|@monogrid[\\/]gainmap-js|@mediapipe[\\/]tasks-vision|detect-gpu|stats-gl|stats\.js|hls\.js|tunnel-rat|@use-gesture[\\/]core|@use-gesture[\\/]react|react-use-measure|@babel[\\/]runtime)[\\/]/.test(id))
              return 'three'
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
            return 'vendor'
          },
        },
      },
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
