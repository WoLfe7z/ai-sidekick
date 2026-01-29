import { useState, useEffect, useRef } from 'react'
import './App.css'
import { Star, Pencil, Trash2, X } from 'lucide-react' 

// Chat history
import { Chat, Message } from './types/chat'
import { createNewChat, addMessageToChat } from './state/chatStore'

function App() {
  // Chat state
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const isExplainingRef = useRef(false)
  const activeChatIdRef = useRef<string | null>(null)

  const [chatContextMenu, setChatContextMenu] = useState<{
    x: number
    y: number
    chatId: string
  } | null>(null)

  // Function to read from clipboard and set input
  const addSystemMessage = (text: string) => {
    const systemMessage: Message = {
      id: crypto.randomUUID(),
      role: 'system',
      content: text,
      timestamp: Date.now()
    }

    if (!activeChatId) {
      const newChat = createNewChat(systemMessage)
      setChats(prev => [newChat, ...prev]) // Append
      setActiveChatId(newChat.id)
      return
    }

    setChats(prev => addMessageToChat(prev, activeChatId, systemMessage))
  }

  const handleExplainClipboard = async () => {
    if (isExplainingRef.current) return
    isExplainingRef.current = true

    try {
      const clipboardText = await navigator.clipboard.readText()

      if (!clipboardText.trim()) {
        addSystemMessage("📋 Clipboard is empty.")
        return
      }

      await handleExplain(clipboardText)
    } catch (err) {
      addSystemMessage(
        "⚠️ Failed to read clipboard: " + (err as Error).message
      )
    } finally {
      isExplainingRef.current = false
    }
  }

  const handleExplain = async (text: string) => {
    if (!text.trim()) return

    let chatId = activeChatIdRef.current

    // ONLY create chat if none is selected or no chats exist
    if (!chatId) {
      const newChat = createNewChat()
      setChats(prev => [newChat, ...prev])
      setActiveChatId(newChat.id)
      activeChatIdRef.current = newChat.id
      chatId = newChat.id
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    // Append message, DO NOT replace chats
    setChats(prev => addMessageToChat(prev, chatId!, userMessage))

    const reply = await window.ai.explainText(text)

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: reply,
      timestamp: Date.now()
    }

    // Append again
    setChats(prev => addMessageToChat(prev, chatId!, assistantMessage))
  }

  // --------- Effects ---------
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  useEffect(() => {
    const handleHotKey = async () => {
      await handleExplainClipboard()
    }

    window.ipcRenderer.on('trigger-explain-clipboard', handleHotKey)

    return () => {
      window.ipcRenderer.off('trigger-explain-clipboard', handleHotKey)
    }
  }, [])

  // Context menu
  useEffect(() => {
    const close = () => setChatContextMenu(null)

    window.addEventListener('click', close)
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') close()
    })

    return () => {
      window.removeEventListener('click', close)
    }
  }, [])

  const activeChat = chats.find(c => c.id === activeChatId)

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <button
          className="new-chat"
          onClick={() => {
            const newChat = createNewChat()
            setChats(prev => [newChat, ...prev])
            setActiveChatId(newChat.id)
          }}
        >
          + New Chat
        </button>

        <div className="chat-list">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => setActiveChatId(chat.id)}
              onContextMenu={e => {
                e.preventDefault()
                setChatContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  chatId: chat.id
                })
              }}
            >
              <div className="chat-title">{chat.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat">
        <div className="chat-inner">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`msg-row ${msg.role}`}>
              <div className="msg-bubble">
                {msg.role !== 'system' && (
                  <div className="msg-author">
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                )}
                <div className="msg-content">{msg.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {chatContextMenu && (
        <div
          className="chat-context-menu"
          style={{
            top: chatContextMenu.y,
            left: chatContextMenu.x
          }}
          onClick={() => setChatContextMenu(null)}
        >
          <div className="context-item"><Star size={18} /><span>Favorite</span></div>
          <div className="context-item"><Pencil size={18} /><span>Rename</span></div>
          <div className="context-item"><Trash2 size={18} /><span>Delete</span></div>
          <div className="context-item"><X size={18} /><span>Deselect</span></div>
        </div>
      )}
    </div>
  )
}

export default App
