import { useState, useEffect } from 'react'
import './App.css'

// Chat history
import { Chat, Message } from './types/chat'
import { createNewChat, addMessageToChat } from './state/chatStore'

function App() {
  // Chat state
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

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
      setChats([newChat])
      setActiveChatId(newChat.id)
      return
    }

    setChats(prev =>
      addMessageToChat(prev, activeChatId, systemMessage)
    )
  }

  const handleExplainClipboard = async () => {
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
    }
  }

  const handleExplain = async (text: string) => {
    if (!text.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    let chatId = activeChatId

    // Create chat if none exists
    if (!chatId) {
      const newChat = createNewChat(userMessage)
      setChats([newChat])
      setActiveChatId(newChat.id)
      chatId = newChat.id
    } else {
      setChats(prev => addMessageToChat(prev, chatId!, userMessage))
    }

    // Call AI
    const reply = await window.ai.explainText(text)

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: reply,
      timestamp: Date.now()
    }

    setChats(prev => addMessageToChat(prev, chatId!, assistantMessage))
  }


  useEffect(() => {
    const handleHotKey = async () => {
      await handleExplainClipboard()
    }

    // @ts-ignore
    window.ipcRenderer.on('trigger-explain-clipboard', handleHotKey)

    return () => {
      // @ts-ignore
      window.ipcRenderer.off('trigger-explain-clipboard', handleHotKey)
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
              className={`chat-item ${
                chat.id === activeChatId ? 'active' : ''
              }`}
              onClick={() => setActiveChatId(chat.id)}
            >
              <div className="chat-title">{chat.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat">
        {!activeChat && (
          <div className="empty">
            <p>No chat selected.</p>
            <p>Press <b>Ctrl + Alt + E</b> or create a new chat.</p>
          </div>
        )}

        {activeChat?.messages.map(msg => (
          <div key={msg.id} className={`msg ${msg.role}`}>
            {msg.role !== 'system' && (
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>
            )}
            <div>{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
