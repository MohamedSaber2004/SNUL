/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import plugin from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

function devFallbackPlugin(gatewayTarget: string) {
  const cacheFile = path.resolve(process.cwd(), 'node_modules/.cache/site-logo.json')
  let localLogo = {
    id: '00000000-0000-0000-0000-000000000001',
    logoUrl: '',
    altText: 'SNUL',
    updatedAt: new Date().toISOString(),
  }

  try {
    if (fs.existsSync(cacheFile)) {
      localLogo = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    }
  } catch {}

  return {
    name: 'dev-fallback-plugin',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''

        if (url === '/api/v1/help/site-stats' && req.method === 'GET') {
          try {
            const resp = await fetch(`${gatewayTarget}/api/v1/help/site-stats`, {
              headers: { Accept: 'application/json' },
            })
            if (resp.ok) {
              const data = await resp.text()
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(data)
              return
            }
          } catch {}
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ isSuccess: true, statusCode: 200, message: 'OK', data: [] }))
          return
        }

        if (url === '/api/v1/content/logo') {
          if (req.method === 'GET') {
            try {
              const resp = await fetch(`${gatewayTarget}/api/v1/content/logo`, {
                headers: { Accept: 'application/json' },
              })
              if (resp.ok) {
                const data = await resp.text()
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(data)
                return
              }
            } catch {}
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ isSuccess: true, statusCode: 200, message: 'OK', data: localLogo }))
            return
          }

          if (req.method === 'PUT') {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', async () => {
              try {
                const resp = await fetch(`${gatewayTarget}/api/v1/content/logo`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(req.headers.authorization ? { Authorization: req.headers.authorization as string } : {}),
                  },
                  body,
                })
                if (resp.ok) {
                  const data = await resp.text()
                  res.setHeader('Content-Type', 'application/json; charset=utf-8')
                  res.end(data)
                  return
                }
              } catch {}

              try {
                const parsed = JSON.parse(body)
                localLogo = {
                  id: localLogo.id,
                  logoUrl: parsed.logoUrl || '',
                  altText: parsed.altText || 'SNUL',
                  updatedAt: new Date().toISOString(),
                }
                try {
                  fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
                  fs.writeFileSync(cacheFile, JSON.stringify(localLogo, null, 2), 'utf-8')
                } catch {}
              } catch {}
              const isAr = String(req.headers['accept-language'] || '').toLowerCase().startsWith('ar')
              const msg = isAr ? 'تم حفظ وتحديث شعار الموقع ومزامنته بنجاح!' : 'Site logo saved and synchronized successfully!'
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ isSuccess: true, statusCode: 200, message: msg, data: localLogo }))
            })
            return
          }
        }

        if (url === '/api/v1/attachments/upload' && req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })
          req.on('end', async () => {
            const rawBuffer = Buffer.concat(chunks)
            const contentType = req.headers['content-type'] || ''

            // 1. Try forwarding to remote gateway if authorization is present
            if (req.headers.authorization) {
              try {
                const resp = await fetch(`${gatewayTarget}/api/v1/attachments/upload`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': contentType,
                    Authorization: req.headers.authorization as string,
                    ...(req.headers['accept-language'] ? { 'Accept-Language': req.headers['accept-language'] as string } : {}),
                  },
                  body: rawBuffer,
                })
                if (resp.ok) {
                  const data = await resp.text()
                  res.setHeader('Content-Type', 'application/json; charset=utf-8')
                  res.end(data)
                  return
                }
              } catch {}
            }

            // 2. Dev fallback: parse multipart and save locally into public/files/
            try {
              const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
              const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null
              let fileBuffer: Buffer | null = null
              let origFileName = 'upload.jpg'
              let place = '0'

              if (boundary) {
                const boundaryBuffer = Buffer.from(`--${boundary}`)
                let startIdx = rawBuffer.indexOf(boundaryBuffer)

                while (startIdx !== -1) {
                  const nextBoundaryIdx = rawBuffer.indexOf(boundaryBuffer, startIdx + boundaryBuffer.length)
                  if (nextBoundaryIdx === -1) break

                  const part = rawBuffer.subarray(startIdx + boundaryBuffer.length, nextBoundaryIdx)
                  const headerEndIdx = part.indexOf(Buffer.from('\r\n\r\n'))

                  if (headerEndIdx !== -1) {
                    const headersStr = part.subarray(0, headerEndIdx).toString('utf-8')
                    const body = part.subarray(headerEndIdx + 4, part.length - 2)

                    if (headersStr.includes('name="file"') && headersStr.includes('filename=')) {
                      const fnMatch = headersStr.match(/filename="([^"]+)"/i)
                      if (fnMatch) origFileName = fnMatch[1]
                      fileBuffer = body
                    } else if (headersStr.includes('name="place"')) {
                      place = body.toString('utf-8').trim() || '0'
                    }
                  }

                  startIdx = nextBoundaryIdx
                }
              }

              if (fileBuffer) {
                const ext = path.extname(origFileName) || '.jpg'
                const storedName = `${place}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`
                const filesDir = path.resolve(process.cwd(), 'public/files')
                if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true })
                fs.writeFileSync(path.join(filesDir, storedName), fileBuffer)

                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ isSuccess: true, statusCode: 200, message: 'Uploaded', data: storedName }))
                return
              }
            } catch (err) {
              console.error('[vite dev upload fallback error]', err)
            }

            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ isSuccess: true, statusCode: 200, message: 'Uploaded', data: '0_dev_sample.png' }))
          })
          return
        }

        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || 'https://snul-gateway.runasp.net'
  // Hangfire dashboard target (non-API route; all /api reads go through the gateway)
  const productTarget = 'https://snul-product.runasp.net'
  return {
    plugins: [plugin(), devFallbackPlugin(gatewayTarget)],
    test: {
      environment: 'jsdom',
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 9002,
      host: true,
      strictPort: false,
      proxy: {
        // Gateway-first for proxy and exchange-rate/currency repos so provider
        // changes in the gateway are reflected immediately; product microservice
        // remains as fallback if gateway is unavailable.
        '/hangfire':               { target: productTarget,  changeOrigin: true, secure: false },
        '/files':                  { target: gatewayTarget, changeOrigin: true, secure: false },
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
