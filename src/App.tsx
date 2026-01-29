import { useState, useEffect, useRef } from 'react'
import './App.css'
import { Star, Pencil, Trash2, X } from 'lucide-react' 

// Chat history
import { Chat, Message } from './types/chat'
import { createNewChat, addMessageToChat } from './state/chatStore'
import { set } from 'mongoose'

function App() {
  // Chat state
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const isExplainingRef = useRef(false)
  const activeChatIdRef = useRef<string | null>(null)

  // Chat context menu states
  const [chatContextMenu, setChatContextMenu] = useState<{
    x: number
    y: number
    chatId: string
  } | null>(null)
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null)
  const [recentlyDeletedChat, setRecentlyDeletedChat] = useState<Chat | null>(null)
  const deleteTimeoutRef = useRef<number | null>(null)

  // Shortcuts
  const SHORTCUTS = {
    favorite: 'f',
    rename : 'r',
    delete : 'delete',
    deselect : 'escape'
  } as const

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

  // Delete chat function extracted for reuse
  const deleteChatById = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return

    // Mark as deleting for animation
    setChats(prev =>
      prev.map(c =>
        c.id === chat.id ? { ...c, isDeleting: true } : c
      )
    )

    // Clear active chat if needed
    if (activeChatId === chat.id) {
      setActiveChatId(null)
    }

    setRecentlyDeletedChat(chat)

    deleteTimeoutRef.current = window.setTimeout(() => {
      setChats(prev => prev.filter(c => c.id !== chat.id))
      setRecentlyDeletedChat(null)
      deleteTimeoutRef.current = null
    }, 4000)
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
      if (e.key === 'Escape' && chatContextMenu) close()
    })

    return () => {
      window.removeEventListener('click', close)
    }
  }, [])

  // Highlight text when renaming
  useEffect(() => {
    if (!renamingChatId) return

    requestAnimationFrame(() => {
      const el = document.querySelector(
        `.chat-item.active .chat-title-editing`
      ) as HTMLElement | null

      if (!el) return

      const range = document.createRange()
      const sel = window.getSelection()

      range.selectNodeContents(el)
      range.collapse(false) // move caret to END
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
  }, [renamingChatId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an editable field
      const target = e.target as HTMLElement
      if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (!activeChatId) return

      // Handle keyboard shortcuts for active chat
      const key = e.key.toLowerCase()
      switch (key) {
        case SHORTCUTS.favorite:
          e.preventDefault()
          setChats(prev =>
            prev.map(c =>
              c.id === activeChatId
                ? { ...c, favorite: !c.favorite }
                : c
            )
          )
          break

        case SHORTCUTS.rename:
          e.preventDefault()
          setRenamingChatId(activeChatId)
          break



        case SHORTCUTS.deselect:
          e.preventDefault()
          setActiveChatId(null)
          break
          
        case 'delete':
        case 'backspace':     // for Mac keyboards
          e.preventDefault()
          deleteChatById(activeChatId)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeChatId, chats])


  const activeChat = chats.find(c => c.id === activeChatId)

  const sortedChats = [...chats].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1
    if (!a.favorite && b.favorite) return 1
    return 0
  })

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
          {sortedChats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === activeChatId ? 'active' : ''}${chat.isDeleting ? 'chat-deleting' : ''}`}
              onClick={() => {
                if (renamingChatId) return
                setActiveChatId(chat.id)
              }}
              onContextMenu={e => {
                e.preventDefault()
                setChatContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  chatId: chat.id
                })
              }}
            >
              <div className="chat-row">
                <div className="chat-title-wrapper">
                  {renamingChatId === chat.id ? (
                    <span
                      className="chat-title chat-title-editing"
                      contentEditable
                      suppressContentEditableWarning
                      autoFocus
                      onBlur={e => {
                        const value = e.currentTarget.textContent?.trim()
                        if (value) {
                          setChats(prev =>
                            prev.map(c =>
                              c.id === chat.id ? { ...c, title: value } : c
                            )
                          )
                        }
                        setRenamingChatId(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.currentTarget.blur()
                        }
                        if (e.key === 'Escape') {
                          e.currentTarget.textContent = chat.title
                          setRenamingChatId(null)
                        }
                      }}
                    >
                      {chat.title}
                    </span>
                  ) : (
                    <div className="chat-title">{chat.title}</div>
                  )}
                </div>

                <Star
                  size={14}
                  className={`chat-fav-icon ${
                    chat.favorite ? 'is-favorite fav-pop' : 'fav-burst'
                  }`}
                  onClick={e => {
                    e.stopPropagation()
                    setChats(prev =>
                      prev.map(c =>
                        c.id === chat.id
                          ? { ...c, favorite: !c.favorite }
                          : c
                      )
                    )
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat">
        <div className="chat-inner">
          {activeChat ? (
            activeChat.messages.map(msg => (
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
            ))
          ) : (
            <div className="chat-empty">
              Select a chat or create a new one
            </div>
          )}
        </div>
      </div>

      {/* Chat context menu */}
      {chatContextMenu && (
        <div
          className="chat-context-menu"
          style={{
            top: chatContextMenu.y,
            left: chatContextMenu.x
          }}
          onClick={() => setChatContextMenu(null)}
        >
          <div className='context-item'>
            <div
              className="context-left"
              onClick={() => {
                setChats(prev =>
                  prev.map(c =>
                    c.id === chatContextMenu.chatId
                      ? { ...c, favorite: !c.favorite }
                      : c
                  )
                )
                setChatContextMenu(null)
              }}
            >
              <Star size={18} />
              <span>Favorite</span>
            </div>  
            <span className='context-shortcut'>{SHORTCUTS.favorite.toUpperCase()}</span>          
          </div>

          <div className='context-item'>
            <div
              className="context-left"
              onClick={() => {
                const chat = chats.find(c => c.id === chatContextMenu.chatId)
                if (!chat) return
                setRenamingChatId(chat.id)
                setChatContextMenu(null)
              }}
            >
              <Pencil size={18} />
              <span>Rename</span>
            </div>  
            <span className='context-shortcut'>{SHORTCUTS.rename.toUpperCase()}</span>          
          </div>

          <div className='context-item'>
            <div 
              className="context-left"
              onClick={() => {
                deleteChatById(chatContextMenu.chatId)
                setChatContextMenu(null)
              }}
            >
              <Trash2 size={18} />
              <span>Delete</span>
            </div>            
            <span className='context-shortcut'>{SHORTCUTS.delete.toUpperCase()}</span>          
          </div>

          <div className='context-item'>
            <div 
              className="context-left"
              onClick={() => {
                setActiveChatId(null)
                setChatContextMenu(null)
              }}
            >
              <X size={18} />
              <span>Deselect</span>
            </div> 
            <span className='context-shortcut'>{SHORTCUTS.deselect.toUpperCase()}</span>           
          </div>
        </div>
      )}

      {recentlyDeletedChat && (
        <div className="undo-toast">
          <span>Chat deleted</span>
          <button
            onClick={() => {
              if (deleteTimeoutRef.current) {
                clearTimeout(deleteTimeoutRef.current)
                deleteTimeoutRef.current = null
              }

              setChats(prev =>
                prev.map(c =>
                  c.id === recentlyDeletedChat.id
                    ? { ...c, isDeleting: false }
                    : c
                )
              )

              setRecentlyDeletedChat(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

export default App
