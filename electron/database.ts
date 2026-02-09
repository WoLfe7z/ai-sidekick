// database.ts - Electron main process database handler
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import type { Chat, Message } from './types/chat'

let db: Database.Database | null = null

export function initializeDatabase() {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'chat-app.db')
  
  console.log('📂 Database path:', dbPath)
  
  db = new Database(dbPath)
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  
  // Create tables
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
  `)
  
  console.log('✅ Database initialized')
  
  return db
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

// ==================== CHAT OPERATIONS ====================

export function saveChat(chat: Chat) {
  const database = getDatabase()
  
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO chats (id, title, favorite, folder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    chat.id,
    chat.title,
    chat.favorite ? 1 : 0,
    (chat as any).folder || null,
    chat.createdAt,
    Date.now()
  )
  
  // Save all messages if they exist
  if (chat.messages && chat.messages.length > 0) {
    const messageStmt = database.prepare(`
      INSERT OR REPLACE INTO messages (id, chatId, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const insertMany = database.transaction((messages: Message[]) => {
      for (const message of messages) {
        messageStmt.run(message.id, chat.id, message.role, message.content, message.timestamp)
      }
    })
    
    insertMany(chat.messages)
  }
}

export function updateChat(chatId: string, updates: Partial<Chat>) {
  const database = getDatabase()
  
  const fields: string[] = []
  const values: any[] = []
  
  if (updates.title !== undefined) {
    fields.push('title = ?')
    values.push(updates.title)
  }
  
  if (updates.favorite !== undefined) {
    fields.push('favorite = ?')
    values.push(updates.favorite ? 1 : 0)
  }

  if ('folder' in updates) {
    fields.push('folder = ?')
    values.push((updates as any).folder || null)  // Convert undefined to null
  }
  
  fields.push('updatedAt = ?')
  values.push(Date.now())
  
  values.push(chatId)
  
  const stmt = database.prepare(`
    UPDATE chats SET ${fields.join(', ')} WHERE id = ?
  `)
  
  stmt.run(...values)
}

export function deleteChat(chatId: string) {
  const database = getDatabase()
  
  // Delete messages first (cascade will handle this, but explicit is better)
  database.prepare('DELETE FROM messages WHERE chatId = ?').run(chatId)
  database.prepare('DELETE FROM chats WHERE id = ?').run(chatId)
}

export function loadChats(): Chat[] {
  const database = getDatabase()
  
  const chats = database.prepare(`
    SELECT id, title, favorite, folder, createdAt, updatedAt
    FROM chats
    ORDER BY createdAt DESC
  `).all() as any[]
  
  return chats.map(chat => ({
    id: chat.id,
    title: chat.title,
    favorite: chat.favorite === 1,
    folder: chat.folder,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages: [],
    isDeleting: false
  }))
}

export function loadChat(chatId: string): Chat | null {
  const database = getDatabase()
  
  const chat = database.prepare(`
    SELECT id, title, favorite, folder, createdAt, updatedAt
    FROM chats
    WHERE id = ?
  `).get(chatId) as any
  
  if (!chat) return null
  
  const messages = loadMessages(chatId)
  
  return {
    id: chat.id,
    title: chat.title,
    favorite: chat.favorite === 1,
    folder: chat.folder,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages,
    isDeleting: false
  }
}

// ==================== MESSAGE OPERATIONS ====================

export function saveMessage(chatId: string, message: Message) {
  const database = getDatabase()
  
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO messages (id, chatId, role, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `)
  
  stmt.run(message.id, chatId, message.role, message.content, message.timestamp)
  
  // Update chat's updatedAt timestamp
  database.prepare('UPDATE chats SET updatedAt = ? WHERE id = ?').run(Date.now(), chatId)
}

export function loadMessages(chatId: string): Message[] {
  const database = getDatabase()
  
  const messages = database.prepare(`
    SELECT id, role, content, timestamp
    FROM messages
    WHERE chatId = ?
    ORDER BY timestamp ASC
  `).all(chatId) as any[]
  
  return messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp
  }))
}

// ==================== REACTION OPERATIONS ====================

export function saveReaction(messageId: string, reaction: 'like' | 'dislike' | null) {
  const database = getDatabase()
  
  if (reaction === null) {
    // Delete reaction
    database.prepare('DELETE FROM reactions WHERE messageId = ?').run(messageId)
  } else {
    // Insert or update reaction
    database.prepare(`
      INSERT OR REPLACE INTO reactions (messageId, reaction)
      VALUES (?, ?)
    `).run(messageId, reaction)
  }
}

export function loadReactions(chatId: string): { [key: string]: 'like' | 'dislike' | null } {
  const database = getDatabase()
  
  const reactions = database.prepare(`
    SELECT r.messageId, r.reaction
    FROM reactions r
    JOIN messages m ON r.messageId = m.id
    WHERE m.chatId = ?
  `).all(chatId) as any[]
  
  const result: { [key: string]: 'like' | 'dislike' | null } = {}
  
  for (const reaction of reactions) {
    result[reaction.messageId] = reaction.reaction
  }
  
  return result
}

// ==================== UTILITY ====================

export function clearAll() {
  const database = getDatabase()
  
  database.exec(`
    DELETE FROM reactions;
    DELETE FROM messages;
    DELETE FROM chats;
  `)
  
  // Vacuum to reclaim space
  database.exec('VACUUM')
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}