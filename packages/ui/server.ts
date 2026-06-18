import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? '3030')
const WORKING_DIR = process.env.CWD ?? process.cwd()
const IS_DEV = process.env.NODE_ENV !== 'production'
const UI_TOKEN = process.env.UI_TOKEN

function isAuthorized(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  if (!UI_TOKEN) return true
  const auth = req.headers['authorization']
  if (typeof auth !== 'string' || !auth.startsWith('Basic ')) return false
  const decoded = Buffer.from(auth.slice(6), 'base64').toString()
  const [, pass] = decoded.split(':')
  return pass === UI_TOKEN
}

// Resolve pi binary
function resolvePiBinary(): { cmd: string; args: string[] } {
  // 1. PI_BINARY env var
  if (process.env.PI_BINARY) {
    return { cmd: process.env.PI_BINARY, args: ['--mode', 'rpc'] }
  }

  // 2. monorepo local build: packages/coding-agent/dist/cli.js (2 dirs up from server.ts)
  const monorepoRoot = join(__dirname, '..', '..')
  const localBin = join(monorepoRoot, 'packages', 'coding-agent', 'dist', 'cli.js')
  if (existsSync(localBin)) {
    return { cmd: 'node', args: [localBin, '--mode', 'rpc'] }
  }

  // 3. pi in PATH
  return { cmd: 'pi', args: ['--mode', 'rpc'] }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = createServer((req, res) => {
  if (!isAuthorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="pi"' })
    res.end()
    return
  }

  if (IS_DEV) {
    res.writeHead(302, { Location: 'http://localhost:5173' + (req.url ?? '/') })
    res.end()
    return
  }

  const distDir = join(__dirname, 'dist')
  let filePath = join(distDir, req.url === '/' ? 'index.html' : req.url ?? 'index.html')

  // Remove query string
  filePath = filePath.split('?')[0]

  if (!existsSync(filePath)) {
    // SPA fallback
    filePath = join(distDir, 'index.html')
  }

  const ext = extname(filePath)
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime })
  createReadStream(filePath).pipe(res)
})

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  if (!isAuthorized(req)) {
    ws.close(1008, 'Unauthorized')
    return
  }

  const url = new URL(req.url!, `http://localhost:${PORT}`)
  const cwd = url.searchParams.get('cwd') ?? WORKING_DIR

  const { cmd, args } = resolvePiBinary()
  console.log(`Spawning: ${cmd} ${args.join(' ')} in ${cwd}`)

  let piProcess: ReturnType<typeof spawn> | null = null

  try {
    piProcess = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env },
    })
  } catch (err) {
    ws.send(JSON.stringify({ type: 'error', message: `Failed to spawn pi: ${err}` }))
    ws.close()
    return
  }

  const proc = piProcess

  ws.on('message', (data) => {
    try {
      proc.stdin?.write(data.toString() + '\n')
    } catch (err) {
      console.error('Failed to write to stdin:', err)
    }
  })

  let buffer = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) {
        try {
          ws.send(line)
        } catch (_) {
          // ws might be closed
        }
      }
    }
  })

  proc.on('error', (err) => {
    console.error('pi process error:', err)
    try {
      ws.send(JSON.stringify({ type: 'error', message: `Process error: ${err.message}` }))
    } catch (_) {}
  })

  ws.on('close', () => {
    proc.kill()
  })

  proc.on('exit', (code) => {
    console.log(`pi process exited with code ${code}`)
    try {
      ws.close()
    } catch (_) {}
  })
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  if (IS_DEV) {
    console.log('Dev mode: redirecting HTTP to http://localhost:5173')
  }
})
