import 'dotenv/config'
import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import OpenAI from 'openai'
import Store from 'electron-store'
import {
  initializeDatabase,
  saveChat,
  updateChat,
  deleteChat,
  loadChats,
  loadChat,
  saveMessage,
  loadMessages,
  saveReaction,
  loadReactions,
  clearAll,
  closeDatabase
} from './database.js' // .js extension for ESM

let win: BrowserWindow | null = null
let tray: Tray | null = null

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (process.platform === 'win32') {
  app.setAppUserModelId('com.yourname.ai-sidekick')
}

// ---------------- STORAGE SETUP ----------------
const store = new Store()

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

// ---------------- DATABASE IPC HANDLERS ----------------

// Initialize database
ipcMain.handle('db:initialize', async () => {
  try {
    initializeDatabase()
    return { success: true }
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
})

// Chat operations
ipcMain.handle('db:saveChat', async (_event, chat) => {
  try {
    saveChat(chat)
    return { success: true }
  } catch (error) {
    console.error('Error saving chat:', error)
    throw error
  }
})

ipcMain.handle('db:updateChat', async (_event, chatId, updates) => {
  try {
    updateChat(chatId, updates)
    return { success: true }
  } catch (error) {
    console.error('Error updating chat:', error)
    throw error
  }
})

ipcMain.handle('db:deleteChat', async (_event, chatId) => {
  try {
    deleteChat(chatId)
    return { success: true }
  } catch (error) {
    console.error('Error deleting chat:', error)
    throw error
  }
})

ipcMain.handle('db:loadChats', async () => {
  try {
    return loadChats()
  } catch (error) {
    console.error('Error loading chats:', error)
    throw error
  }
})

ipcMain.handle('db:loadChat', async (_event, chatId) => {
  try {
    return loadChat(chatId)
  } catch (error) {
    console.error('Error loading chat:', error)
    throw error
  }
})

// Message operations
ipcMain.handle('db:saveMessage', async (_event, chatId, message) => {
  try {
    saveMessage(chatId, message)
    return { success: true }
  } catch (error) {
    console.error('Error saving message:', error)
    throw error
  }
})

ipcMain.handle('db:loadMessages', async (_event, chatId) => {
  try {
    return loadMessages(chatId)
  } catch (error) {
    console.error('Error loading messages:', error)
    throw error
  }
})

// Reaction operations
ipcMain.handle('db:saveReaction', async (_event, messageId, reaction) => {
  try {
    saveReaction(messageId, reaction)
    return { success: true }
  } catch (error) {
    console.error('Error saving reaction:', error)
    throw error
  }
})

ipcMain.handle('db:loadReactions', async (_event, chatId) => {
  try {
    return loadReactions(chatId)
  } catch (error) {
    console.error('Error loading reactions:', error)
    throw error
  }
})

// Clear all data
ipcMain.handle('db:clearAll', async () => {
  try {
    clearAll()
    return { success: true }
  } catch (error) {
    console.error('Error clearing data:', error)
    throw error
  }
})

// ---------------- ELECTRON-STORE IPC HANDLERS ----------------

// Synchronous store operations (for shortcuts and preferences)
ipcMain.on('store:get', (event, key) => {
  event.returnValue = store.get(key)
})

ipcMain.on('store:set', (event, key, value) => {
  store.set(key, value)
  event.returnValue = { success: true }
})

ipcMain.on('store:delete', (event, key) => {
  store.delete(key)
  event.returnValue = { success: true }
})

ipcMain.on('store:clear', (event) => {
  store.clear()
  event.returnValue = { success: true }
})

// Async store operations
ipcMain.handle('store:get-async', async (_event, key) => {
  return store.get(key)
})

ipcMain.handle('store:set-async', async (_event, key, value) => {
  store.set(key, value)
  return { success: true }
})

// ---------------- WINDOW ----------------
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 1000,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    icon: getTrayIconPath(),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  })

  win.setMenu(null)

  win.on('close', (event) => {
    event.preventDefault()
    win?.hide()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

// ---------------- TRAY ----------------
function getTrayIconPath() {
  // DEV: load from source public folder
  if (process.env.VITE_DEV_SERVER_URL) {
    return path.join(process.cwd(), 'public', 'sidekick-tray-icon.ico')
  }

  // PROD: load from bundled electron output
  return path.join(__dirname, 'sidekick-tray-icon.ico')
}

function createTray() {
  const iconPath = getTrayIconPath()
  const trayIcon = nativeImage.createFromPath(iconPath)

  if (trayIcon.isEmpty()) {
    console.error('Tray icon failed to load.')
    return
  }

  tray = new Tray(trayIcon)

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
        win?.webContents.send('trigger-explain-clipboard')
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
  // Initialize database FIRST
  initializeDatabase()
  
  createWindow()
  createTray()

  const success = globalShortcut.register('CommandOrControl+Alt+E', () => {
    win?.show()
    win?.focus()
    win?.webContents.send('trigger-explain-clipboard')
  })

  console.log(success
    ? '✅ Global shortcut registered'
    : '❌ Failed to register global shortcut'
  )
})

app.on('window-all-closed', () => {
  // Prevent the app from closing when all windows are closed
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeDatabase() // Clean up database connection
})