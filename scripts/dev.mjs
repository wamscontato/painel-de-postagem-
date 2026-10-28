import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const baseEnv = { ...process.env, NODE_ENV: 'development' }

const api = spawn(process.execPath, ['server/index.js'], {
  cwd: projectRoot,
  env: { ...baseEnv, PORT: '3001', HOST: '127.0.0.1' },
  stdio: 'inherit',
})
const vite = spawn(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', '3000', '--strictPort'], {
  cwd: projectRoot,
  env: baseEnv,
  stdio: 'inherit',
})
const children = [api, vite]
let stopping = false

function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill(signal)
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`A local development process could not start (${error.code || 'unknown error'}).`)
    process.exitCode = 1
    stop('SIGTERM')
  })
  child.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1
      stop('SIGTERM')
    }
  })
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
