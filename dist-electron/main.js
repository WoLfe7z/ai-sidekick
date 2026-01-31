import require$$0 from "fs";
import require$$1 from "path";
import require$$2 from "os";
import require$$3 from "crypto";
import { app, ipcMain, globalShortcut, BrowserWindow, nativeImage, Tray, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import OpenAI from "openai";
import Store from "electron-store";
import Database from "better-sqlite3";
var main = { exports: {} };
const version$1 = "16.6.1";
const require$$4 = {
  version: version$1
};
const fs = require$$0;
const path = require$$1;
const os = require$$2;
const crypto = require$$3;
const packageJson = require$$4;
const version = packageJson.version;
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function parse(src) {
  const obj = {};
  let lines = src.toString();
  lines = lines.replace(/\r\n?/mg, "\n");
  let match;
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1];
    let value = match[2] || "";
    value = value.trim();
    const maybeQuote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, "\n");
      value = value.replace(/\\r/g, "\r");
    }
    obj[key] = value;
  }
  return obj;
}
function _parseVault(options2) {
  options2 = options2 || {};
  const vaultPath = _vaultPath(options2);
  options2.path = vaultPath;
  const result = DotenvModule.configDotenv(options2);
  if (!result.parsed) {
    const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
    err.code = "MISSING_DATA";
    throw err;
  }
  const keys = _dotenvKey(options2).split(",");
  const length = keys.length;
  let decrypted;
  for (let i = 0; i < length; i++) {
    try {
      const key = keys[i].trim();
      const attrs = _instructions(result, key);
      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
      break;
    } catch (error) {
      if (i + 1 >= length) {
        throw error;
      }
    }
  }
  return DotenvModule.parse(decrypted);
}
function _warn(message) {
  console.log(`[dotenv@${version}][WARN] ${message}`);
}
function _debug(message) {
  console.log(`[dotenv@${version}][DEBUG] ${message}`);
}
function _log(message) {
  console.log(`[dotenv@${version}] ${message}`);
}
function _dotenvKey(options2) {
  if (options2 && options2.DOTENV_KEY && options2.DOTENV_KEY.length > 0) {
    return options2.DOTENV_KEY;
  }
  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
    return process.env.DOTENV_KEY;
  }
  return "";
}
function _instructions(result, dotenvKey) {
  let uri;
  try {
    uri = new URL(dotenvKey);
  } catch (error) {
    if (error.code === "ERR_INVALID_URL") {
      const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    throw error;
  }
  const key = uri.password;
  if (!key) {
    const err = new Error("INVALID_DOTENV_KEY: Missing key part");
    err.code = "INVALID_DOTENV_KEY";
    throw err;
  }
  const environment = uri.searchParams.get("environment");
  if (!environment) {
    const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
    err.code = "INVALID_DOTENV_KEY";
    throw err;
  }
  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
  const ciphertext = result.parsed[environmentKey];
  if (!ciphertext) {
    const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
    err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
    throw err;
  }
  return { ciphertext, key };
}
function _vaultPath(options2) {
  let possibleVaultPath = null;
  if (options2 && options2.path && options2.path.length > 0) {
    if (Array.isArray(options2.path)) {
      for (const filepath of options2.path) {
        if (fs.existsSync(filepath)) {
          possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
        }
      }
    } else {
      possibleVaultPath = options2.path.endsWith(".vault") ? options2.path : `${options2.path}.vault`;
    }
  } else {
    possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
  }
  if (fs.existsSync(possibleVaultPath)) {
    return possibleVaultPath;
  }
  return null;
}
function _resolveHome(envPath) {
  return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
}
function _configVault(options2) {
  const debug = Boolean(options2 && options2.debug);
  const quiet = options2 && "quiet" in options2 ? options2.quiet : true;
  if (debug || !quiet) {
    _log("Loading env from encrypted .env.vault");
  }
  const parsed = DotenvModule._parseVault(options2);
  let processEnv = process.env;
  if (options2 && options2.processEnv != null) {
    processEnv = options2.processEnv;
  }
  DotenvModule.populate(processEnv, parsed, options2);
  return { parsed };
}
function configDotenv(options2) {
  const dotenvPath = path.resolve(process.cwd(), ".env");
  let encoding = "utf8";
  const debug = Boolean(options2 && options2.debug);
  const quiet = options2 && "quiet" in options2 ? options2.quiet : true;
  if (options2 && options2.encoding) {
    encoding = options2.encoding;
  } else {
    if (debug) {
      _debug("No encoding is specified. UTF-8 is used by default");
    }
  }
  let optionPaths = [dotenvPath];
  if (options2 && options2.path) {
    if (!Array.isArray(options2.path)) {
      optionPaths = [_resolveHome(options2.path)];
    } else {
      optionPaths = [];
      for (const filepath of options2.path) {
        optionPaths.push(_resolveHome(filepath));
      }
    }
  }
  let lastError;
  const parsedAll = {};
  for (const path2 of optionPaths) {
    try {
      const parsed = DotenvModule.parse(fs.readFileSync(path2, { encoding }));
      DotenvModule.populate(parsedAll, parsed, options2);
    } catch (e) {
      if (debug) {
        _debug(`Failed to load ${path2} ${e.message}`);
      }
      lastError = e;
    }
  }
  let processEnv = process.env;
  if (options2 && options2.processEnv != null) {
    processEnv = options2.processEnv;
  }
  DotenvModule.populate(processEnv, parsedAll, options2);
  if (debug || !quiet) {
    const keysCount = Object.keys(parsedAll).length;
    const shortPaths = [];
    for (const filePath of optionPaths) {
      try {
        const relative = path.relative(process.cwd(), filePath);
        shortPaths.push(relative);
      } catch (e) {
        if (debug) {
          _debug(`Failed to load ${filePath} ${e.message}`);
        }
        lastError = e;
      }
    }
    _log(`injecting env (${keysCount}) from ${shortPaths.join(",")}`);
  }
  if (lastError) {
    return { parsed: parsedAll, error: lastError };
  } else {
    return { parsed: parsedAll };
  }
}
function config(options2) {
  if (_dotenvKey(options2).length === 0) {
    return DotenvModule.configDotenv(options2);
  }
  const vaultPath = _vaultPath(options2);
  if (!vaultPath) {
    _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
    return DotenvModule.configDotenv(options2);
  }
  return DotenvModule._configVault(options2);
}
function decrypt(encrypted, keyStr) {
  const key = Buffer.from(keyStr.slice(-64), "hex");
  let ciphertext = Buffer.from(encrypted, "base64");
  const nonce = ciphertext.subarray(0, 12);
  const authTag = ciphertext.subarray(-16);
  ciphertext = ciphertext.subarray(12, -16);
  try {
    const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
    aesgcm.setAuthTag(authTag);
    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
  } catch (error) {
    const isRange = error instanceof RangeError;
    const invalidKeyLength = error.message === "Invalid key length";
    const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
    if (isRange || invalidKeyLength) {
      const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    } else if (decryptionFailed) {
      const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
      err.code = "DECRYPTION_FAILED";
      throw err;
    } else {
      throw error;
    }
  }
}
function populate(processEnv, parsed, options2 = {}) {
  const debug = Boolean(options2 && options2.debug);
  const override = Boolean(options2 && options2.override);
  if (typeof parsed !== "object") {
    const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    err.code = "OBJECT_REQUIRED";
    throw err;
  }
  for (const key of Object.keys(parsed)) {
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      if (override === true) {
        processEnv[key] = parsed[key];
      }
      if (debug) {
        if (override === true) {
          _debug(`"${key}" is already defined and WAS overwritten`);
        } else {
          _debug(`"${key}" is already defined and was NOT overwritten`);
        }
      }
    } else {
      processEnv[key] = parsed[key];
    }
  }
}
const DotenvModule = {
  configDotenv,
  _configVault,
  _parseVault,
  config,
  decrypt,
  parse,
  populate
};
main.exports.configDotenv = DotenvModule.configDotenv;
main.exports._configVault = DotenvModule._configVault;
main.exports._parseVault = DotenvModule._parseVault;
main.exports.config = DotenvModule.config;
main.exports.decrypt = DotenvModule.decrypt;
main.exports.parse = DotenvModule.parse;
main.exports.populate = DotenvModule.populate;
main.exports = DotenvModule;
var mainExports = main.exports;
const options = {};
if (process.env.DOTENV_CONFIG_ENCODING != null) {
  options.encoding = process.env.DOTENV_CONFIG_ENCODING;
}
if (process.env.DOTENV_CONFIG_PATH != null) {
  options.path = process.env.DOTENV_CONFIG_PATH;
}
if (process.env.DOTENV_CONFIG_QUIET != null) {
  options.quiet = process.env.DOTENV_CONFIG_QUIET;
}
if (process.env.DOTENV_CONFIG_DEBUG != null) {
  options.debug = process.env.DOTENV_CONFIG_DEBUG;
}
if (process.env.DOTENV_CONFIG_OVERRIDE != null) {
  options.override = process.env.DOTENV_CONFIG_OVERRIDE;
}
if (process.env.DOTENV_CONFIG_DOTENV_KEY != null) {
  options.DOTENV_KEY = process.env.DOTENV_CONFIG_DOTENV_KEY;
}
var envOptions = options;
const re = /^dotenv_config_(encoding|path|quiet|debug|override|DOTENV_KEY)=(.+)$/;
var cliOptions = function optionMatcher(args) {
  const options2 = args.reduce(function(acc, cur) {
    const matches = cur.match(re);
    if (matches) {
      acc[matches[1]] = matches[2];
    }
    return acc;
  }, {});
  if (!("quiet" in options2)) {
    options2.quiet = "true";
  }
  return options2;
};
(function() {
  mainExports.config(
    Object.assign(
      {},
      envOptions,
      cliOptions(process.argv)
    )
  );
})();
let db = null;
function initializeDatabase() {
  const userDataPath = app.getPath("userData");
  const dbPath = require$$1.join(userDataPath, "chat-app.db");
  console.log("📂 Database path:", dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      favorite INTEGER DEFAULT 0,
      folder TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reactions (
      messageId TEXT PRIMARY KEY,
      reaction TEXT,
      FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_chats_createdAt ON chats(createdAt);
    CREATE INDEX IF NOT EXISTS idx_chats_favorite ON chats(favorite);
  `);
  console.log("✅ Database initialized");
  return db;
}
function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
function saveChat(chat) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO chats (id, title, favorite, folder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    chat.id,
    chat.title,
    chat.favorite ? 1 : 0,
    chat.folder || null,
    chat.createdAt,
    Date.now()
  );
  if (chat.messages && chat.messages.length > 0) {
    const messageStmt = database.prepare(`
      INSERT OR REPLACE INTO messages (id, chatId, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertMany = database.transaction((messages) => {
      for (const message of messages) {
        messageStmt.run(message.id, chat.id, message.role, message.content, message.timestamp);
      }
    });
    insertMany(chat.messages);
  }
}
function updateChat(chatId, updates) {
  const database = getDatabase();
  const fields = [];
  const values = [];
  if (updates.title !== void 0) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.favorite !== void 0) {
    fields.push("favorite = ?");
    values.push(updates.favorite ? 1 : 0);
  }
  if ("folder" in updates) {
    fields.push("folder = ?");
    values.push(updates.folder || null);
  }
  fields.push("updatedAt = ?");
  values.push(Date.now());
  values.push(chatId);
  const stmt = database.prepare(`
    UPDATE chats SET ${fields.join(", ")} WHERE id = ?
  `);
  stmt.run(...values);
}
function deleteChat(chatId) {
  const database = getDatabase();
  database.prepare("DELETE FROM messages WHERE chatId = ?").run(chatId);
  database.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
}
function loadChats() {
  const database = getDatabase();
  const chats = database.prepare(`
    SELECT id, title, favorite, folder, createdAt, updatedAt
    FROM chats
    ORDER BY createdAt DESC
  `).all();
  return chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    favorite: chat.favorite === 1,
    folder: chat.folder,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages: [],
    isDeleting: false
  }));
}
function loadChat(chatId) {
  const database = getDatabase();
  const chat = database.prepare(`
    SELECT id, title, favorite, folder, createdAt, updatedAt
    FROM chats
    WHERE id = ?
  `).get(chatId);
  if (!chat) return null;
  const messages = loadMessages(chatId);
  return {
    id: chat.id,
    title: chat.title,
    favorite: chat.favorite === 1,
    folder: chat.folder,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages,
    isDeleting: false
  };
}
function saveMessage(chatId, message) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO messages (id, chatId, role, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(message.id, chatId, message.role, message.content, message.timestamp);
  database.prepare("UPDATE chats SET updatedAt = ? WHERE id = ?").run(Date.now(), chatId);
}
function loadMessages(chatId) {
  const database = getDatabase();
  const messages = database.prepare(`
    SELECT id, role, content, timestamp
    FROM messages
    WHERE chatId = ?
    ORDER BY timestamp ASC
  `).all(chatId);
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp
  }));
}
function saveReaction(messageId, reaction) {
  const database = getDatabase();
  if (reaction === null) {
    database.prepare("DELETE FROM reactions WHERE messageId = ?").run(messageId);
  } else {
    database.prepare(`
      INSERT OR REPLACE INTO reactions (messageId, reaction)
      VALUES (?, ?)
    `).run(messageId, reaction);
  }
}
function loadReactions(chatId) {
  const database = getDatabase();
  const reactions = database.prepare(`
    SELECT r.messageId, r.reaction
    FROM reactions r
    JOIN messages m ON r.messageId = m.id
    WHERE m.chatId = ?
  `).all(chatId);
  const result = {};
  for (const reaction of reactions) {
    result[reaction.messageId] = reaction.reaction;
  }
  return result;
}
function clearAll() {
  const database = getDatabase();
  database.exec(`
    DELETE FROM reactions;
    DELETE FROM messages;
    DELETE FROM chats;
  `);
  database.exec("VACUUM");
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
let win = null;
let tray = null;
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
if (process.platform === "win32") {
  app.setAppUserModelId("com.yourname.ai-sidekick");
}
const store = new Store();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
ipcMain.handle("ai:explain", async (_event, text) => {
  if (!(text == null ? void 0 : text.trim())) return "No input provided.";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant. Use markdown formatting: **bold** for emphasis, `code` for snippets, - lists for organization, code blocks for code, ## headings for structure. Be clear and concise."
        },
        { role: "user", content: text }
      ],
      temperature: 0.7
    });
    return response.choices[0].message.content ?? "No explanation provided.";
  } catch (err) {
    if ((err == null ? void 0 : err.code) === "insufficient_quota") {
      return "⚠️ **OpenAI API quota exceeded.**\nPlease check your billing settings at the [OpenAI Dashboard](https://platform.openai.com/account/billing).";
    }
    if ((err == null ? void 0 : err.code) === "ENOTFOUND" || (err == null ? void 0 : err.code) === "ECONNREFUSED") {
      return "⚠️ **Network error.**\nCannot connect to OpenAI services. Please check your internet connection.";
    }
    return "⚠️ **AI service error.**\nPlease try again later.\n*Error details: " + ((err == null ? void 0 : err.message) || "Unknown error") + "*";
  }
});
ipcMain.handle("db:initialize", async () => {
  try {
    initializeDatabase();
    return { success: true };
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
});
ipcMain.handle("db:saveChat", async (_event, chat) => {
  try {
    saveChat(chat);
    return { success: true };
  } catch (error) {
    console.error("Error saving chat:", error);
    throw error;
  }
});
ipcMain.handle("db:updateChat", async (_event, chatId, updates) => {
  try {
    updateChat(chatId, updates);
    return { success: true };
  } catch (error) {
    console.error("Error updating chat:", error);
    throw error;
  }
});
ipcMain.handle("db:deleteChat", async (_event, chatId) => {
  try {
    deleteChat(chatId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
});
ipcMain.handle("db:loadChats", async () => {
  try {
    return loadChats();
  } catch (error) {
    console.error("Error loading chats:", error);
    throw error;
  }
});
ipcMain.handle("db:loadChat", async (_event, chatId) => {
  try {
    return loadChat(chatId);
  } catch (error) {
    console.error("Error loading chat:", error);
    throw error;
  }
});
ipcMain.handle("db:saveMessage", async (_event, chatId, message) => {
  try {
    saveMessage(chatId, message);
    return { success: true };
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
});
ipcMain.handle("db:loadMessages", async (_event, chatId) => {
  try {
    return loadMessages(chatId);
  } catch (error) {
    console.error("Error loading messages:", error);
    throw error;
  }
});
ipcMain.handle("db:saveReaction", async (_event, messageId, reaction) => {
  try {
    saveReaction(messageId, reaction);
    return { success: true };
  } catch (error) {
    console.error("Error saving reaction:", error);
    throw error;
  }
});
ipcMain.handle("db:loadReactions", async (_event, chatId) => {
  try {
    return loadReactions(chatId);
  } catch (error) {
    console.error("Error loading reactions:", error);
    throw error;
  }
});
ipcMain.handle("db:clearAll", async () => {
  try {
    clearAll();
    return { success: true };
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
});
ipcMain.on("store:get", (event, key) => {
  event.returnValue = store.get(key);
});
ipcMain.on("store:set", (event, key, value) => {
  store.set(key, value);
  event.returnValue = { success: true };
});
ipcMain.on("store:delete", (event, key) => {
  store.delete(key);
  event.returnValue = { success: true };
});
ipcMain.on("store:clear", (event) => {
  store.clear();
  event.returnValue = { success: true };
});
ipcMain.handle("store:get-async", async (_event, key) => {
  return store.get(key);
});
ipcMain.handle("store:set-async", async (_event, key, value) => {
  store.set(key, value);
  return { success: true };
});
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 1e3,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    icon: getTrayIconPath(),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });
  win.setMenu(null);
  win.on("close", (event) => {
    event.preventDefault();
    win == null ? void 0 : win.hide();
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(__dirname$1, "../dist/index.html"));
  }
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }
}
function getTrayIconPath() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return path$1.join(process.cwd(), "public", "sidekick-tray-icon.ico");
  }
  return path$1.join(__dirname$1, "sidekick-tray-icon.ico");
}
function createTray() {
  const iconPath = getTrayIconPath();
  const trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    console.error("Tray icon failed to load.");
    return;
  }
  tray = new Tray(trayIcon);
  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Show AI Sidekick",
      click: () => {
        win == null ? void 0 : win.show();
        win == null ? void 0 : win.focus();
      }
    },
    {
      label: "Explain Clipboard",
      click: () => {
        win == null ? void 0 : win.show();
        win == null ? void 0 : win.focus();
        win == null ? void 0 : win.webContents.send("trigger-explain-clipboard");
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit()
    }
  ]);
  tray.setToolTip("AI Sidekick");
  tray.setContextMenu(trayMenu);
}
app.whenReady().then(() => {
  initializeDatabase();
  createWindow();
  createTray();
  const success = globalShortcut.register("CommandOrControl+Alt+E", () => {
    win == null ? void 0 : win.show();
    win == null ? void 0 : win.focus();
    win == null ? void 0 : win.webContents.send("trigger-explain-clipboard");
  });
  console.log(
    success ? "✅ Global shortcut registered" : "❌ Failed to register global shortcut"
  );
});
app.on("window-all-closed", () => {
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  closeDatabase();
});
