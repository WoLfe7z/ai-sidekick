import 'dotenv/config'
import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, Event } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import OpenAI from 'openai'

let win: BrowserWindow | null = null
let tray: Tray | null = null

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------- AI SETUP ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

ipcMain.handle('ai:explain', async (_event, text: string) => {
  if (!text?.trim()) return 'No input provided.'

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert AI assistant that explains code and errors clearly and concisely.' },
        { role: 'user', content: text }
      ],
      temperature: 0.3
    })

    return response.choices[0].message.content ?? 'No explanation provided.'
  } catch (err: any) {
    if (err?.code === 'insufficient_quota') {
      return '⚠️ OpenAI API quota exceeded. Please check your billing settings.'
    }
    return '⚠️ AI service error. Please try again later.'
  }
})

// ---------------- WINDOW ----------------
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(__dirname, '../public/electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs')
    }
  })

  win.on('close', (event) => {
    event.preventDefault()
    win?.hide()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ---------------- TRAY ----------------
function createTray() {
  const iconPath = path.join(__dirname, '../public/electron-vite.svg')
  tray = new Tray(iconPath)

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Show AI Sidekick',
      click: () => {
        win?.show()
        win?.focus()
      }
    },
    {
      label: 'Explain Clipboard',
      click: () => {
        win?.show()
        win?.focus()
        win?.webContents.send('explain-clipboard')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])

  tray.setToolTip('AI Sidekick')
  tray.setContextMenu(trayMenu)
}

// ---------------- APP LIFECYCLE ----------------
app.whenReady().then(() => {
  createWindow()
  createTray()

  const success = globalShortcut.register('CommandOrControl+Alt+E', () => {
    win?.show()
    win?.focus()
    win?.webContents.send('explain-clipboard')
  })

  console.log(success
    ? '✅ Global shortcut registered'
    : '❌ Failed to register global shortcut'
  )
})

app.on('window-all-closed', (event: Event) => {
  event.preventDefault()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
