const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const BACKEND_PORT = 8765
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow = null
let backendProcess = null

function startBackend() {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  const backendDir = path.join(__dirname, '..', 'backend')
  // Build the child env in ONE place: strip ELECTRON_RUN_AS_NODE (VS Code
  // terminals inject it, which would force the Python-spawned electron —
  // and any nested electron tools — into plain-Node mode), then add ours.
  const env = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toUpperCase() !== 'ELECTRON_RUN_AS_NODE') env[k] = v
  }
  env.PYTHONUNBUFFERED = '1'
  // Packaged apps must not write cache into resources/ — use userData instead
  if (app.isPackaged) {
    env.MUSICDLGUI_CACHE_DIR = path.join(app.getPath('userData'), 'cache')
  }
  backendProcess = spawn(pythonCmd, ['server.py'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
  })
}

function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    function check() {
      http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) resolve()
        else if (retries > 0) { retries--; setTimeout(check, 500) }
        else reject(new Error('Backend did not become healthy'))
      }).on('error', () => {
        if (retries > 0) { retries--; setTimeout(check, 500) }
        else reject(new Error('Backend did not start'))
      })
    }
    check()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    title: 'Musicdl',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = process.argv.includes('--dev')
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
    mainWindow.loadFile(distPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    startBackend()
    await waitForBackend()
    console.log('[electron] Backend is ready')
  } catch (err) {
    console.error('[electron] Startup error:', err.message)
  }
  try {
    createWindow()
  } catch (err) {
    console.error('[electron] Failed to create window:', err.message)
  }
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
})