import { useState, useEffect, useRef } from 'react'
import { Star, Pencil, Trash2, X, Command, Paperclip, Send, Copy, ThumbsUp, ThumbsDown, RotateCcw, Search, ChevronUp, ChevronDown, Edit2, Check, GitBranch, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react' 
import './styles/base.css'
import './styles/sidebar.css'
import './styles/chat.css'
import './styles/context-menu.css'
import './styles/shortcut.css'
import './styles/message-search.css'
import './styles/analytics.css'
import './styles/file-upload.css'

// Chat history
import { Chat, Message } from './types/chat'
import { createNewChat, addMessageToChat } from './state/chatStore'
import { FileUploader, FilePreview, UploadedFile } from './components/fileUploader'

// Declare window.ai for TypeScript
declare global {
  interface Window {
    ai: {
      explainText: (text: string) => Promise<string>
    }
    require: any
  }
}

// Setup window.ai wrapper
if (typeof window !== 'undefined') {
  window.ai = {
    explainText: async (text: string) => {
      const { ipcRenderer } = window.require('electron')
      return await ipcRenderer.invoke('ai:explain', text)
    }
  }
}

// Storage utility class with database and electron-store
class AppStorage {
  // Initialize storage
  static async initialize() {
    const { ipcRenderer } = window.require('electron')
    try {
      await ipcRenderer.invoke('db:initialize')
      console.log('✅ Database initialized')
    } catch (error) {
      console.error('❌ Failed to initialize database:', error)
    }
  }

  // Save chat
  static async saveChat(chat: Chat): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron')
      await ipcRenderer.invoke('db:saveChat', chat)
    } catch (error) {
      console.error('❌ Failed to save chat:', error)
    }
  }

  // Update chat
  static async updateChat(chatId: string, updates: Partial<Chat>): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron')
      await ipcRenderer.invoke('db:updateChat', chatId, updates)
    } catch (error) {
      console.error('❌ Failed to update chat:', error)
    }
  }

  // Delete chat
  static async deleteChat(chatId: string): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron')
      await ipcRenderer.invoke('db:deleteChat', chatId)
    } catch (error) {
      console.error('❌ Failed to delete chat:', error)
    }
  }

  // Load all chats
  static async loadChats(): Promise<Chat[]> {
    try {
      const { ipcRenderer } = window.require('electron')
      const chats = await ipcRenderer.invoke('db:loadChats')
      return chats
    } catch (error) {
      console.error('❌ Failed to load chats:', error)
      return []
    }
  }

  // Load single chat with messages
  static async loadChat(chatId: string): Promise<Chat | null> {
    try {
      const { ipcRenderer } = window.require('electron')
      const chat = await ipcRenderer.invoke('db:loadChat', chatId)
      return chat
    } catch (error) {
      console.error('❌ Failed to load chat:', error)
      return null
    }
  }

  // Save message
  static async saveMessage(chatId: string, message: Message): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron')
      await ipcRenderer.invoke('db:saveMessage', chatId, message)
    } catch (error) {
      console.error('❌ Failed to save message:', error)
    }
  }

  // Save reaction
  static async saveReaction(messageId: string, reaction: 'like' | 'dislike' | null): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron')
      await ipcRenderer.invoke('db:saveReaction', messageId, reaction)
    } catch (error) {
      console.error('❌ Failed to save reaction:', error)
    }
  }

  // Load reactions for a chat
  static async loadReactions(chatId: string): Promise<{ [key: string]: 'like' | 'dislike' | null }> {
    try {
      const { ipcRenderer } = window.require('electron')
      const reactions = await ipcRenderer.invoke('db:loadReactions', chatId)
      return reactions
    } catch (error) {
      console.error('❌ Failed to load reactions:', error)
      return {}
    }
  }

  // Get shortcuts
  static getShortcuts() {
    try {
      const { ipcRenderer } = window.require('electron')
      const shortcuts = ipcRenderer.sendSync('store:get', 'shortcuts')
      return shortcuts || {
        favorite: 'f',
        rename: 'r',
        delete: 'delete',
        deselect: 'escape'
      }
    } catch (error) {
      console.error('❌ Failed to load shortcuts:', error)
      return {
        favorite: 'f',
        rename: 'r',
        delete: 'delete',
        deselect: 'escape'
      }
    }
  }

  // Save shortcuts
  static saveShortcuts(shortcuts: any): void {
    try {
      const { ipcRenderer } = window.require('electron')
      ipcRenderer.send('store:set', 'shortcuts', shortcuts)
    } catch (error) {
      console.error('❌ Failed to save shortcuts:', error)
    }
  }

  // Save branch data for a chat
  static saveBranches(chatId: string, branches: any): void {
    try {
      const { ipcRenderer } = window.require('electron')
      ipcRenderer.send('store:set', `branches:${chatId}`, branches)
    } catch (error) {
      console.error('❌ Failed to save branches:', error)
    }
  }

  // Load branch data for a chat
  static loadBranches(chatId: string): any {
    try {
      const { ipcRenderer } = window.require('electron')
      const branches = ipcRenderer.sendSync('store:get', `branches:${chatId}`)
      return branches || {}
    } catch (error) {
      console.error('❌ Failed to load branches:', error)
      return {}
    }
  }
}

function App() {
  type RightPanel = 'panel-chat' | 'panel-shortcuts' | 'panel-analytics'
  const [rightPanel, setRightPanel] = useState<RightPanel>('panel-chat')

  // Message reactions
  const [messageReactions, setMessageReactions] = useState<{
    [messageId: string]: 'like' | 'dislike' | null
  }>({})

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageContent, setEditingMessageContent] = useState('')

  // Message branching state
  // Structure: { "chatId:messageIndex": { branches: Message[][], currentBranch: number } }
  const [messageBranches, setMessageBranches] = useState<{
    [key: string]: {  // key format: "chatId:messageIndex"
      branches: Message[][]
      currentBranch: number
    }
  }>({})

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  // Highlight search matches in message content
  const highlightMatches = (text: string, isCurrentMatch: boolean) => {
    if (!messageSearchQuery.trim()) return text
    
    const query = messageSearchQuery
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark 
              key={i} 
              className={isCurrentMatch ? 'search-match current-match' : 'search-match'}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  const handleLikeMessage = async (messageId: string) => {
    const newReaction = messageReactions[messageId] === 'like' ? null : 'like'
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: newReaction
    }))
    await AppStorage.saveReaction(messageId, newReaction)
  }

  const handleDislikeMessage = async (messageId: string) => {
    const newReaction = messageReactions[messageId] === 'dislike' ? null : 'dislike'
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: newReaction
    }))
    await AppStorage.saveReaction(messageId, newReaction)
  }

  const handleRetryMessage = async (messageIndex: number) => {
    if (!activeChatId || isTyping) return
    
    const chat = chats.find(c => c.id === activeChatId)
    if (!chat) return
    
    // Find the user message before this AI message
    const userMessage = chat.messages[messageIndex - 1]
    if (!userMessage || userMessage.role !== 'user') return
    
    // Remove the AI message
    setChats(prev =>
      prev.map(c => {
        if (c.id !== activeChatId) return c
        const updated = {
          ...c,
          messages: c.messages.slice(0, messageIndex)
        }
        AppStorage.saveChat(updated) // Save to DB
        return updated
      })
    )
    
    // Show typing indicator
    setIsTyping(true)

    // Get new response
    const reply = await window.ai.explainText(userMessage.content)

    // Hide typing indicator
    setIsTyping(false)

    // Create assistant message with empty content initially
    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    // Add empty message
    setChats(prev => addMessageToChat(prev, activeChatId, assistantMessage))
    await AppStorage.saveMessage(activeChatId, assistantMessage)

    // Stream the text character by character
    const chars = reply.split('')
    for (let i = 0; i < chars.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      
      setChats(prev => 
        prev.map(chat => {
          if (chat.id !== activeChatId) return chat
          return {
            ...chat,
            messages: chat.messages.map(msg => {
              if (msg.id !== assistantMessageId) return msg
              return {
                ...msg,
                content: reply.substring(0, i + 1)
              }
            })
          }
        })
      )
    }
    
    // Save final complete message
    const finalMessage = { ...assistantMessage, content: reply }
    await AppStorage.saveMessage(activeChatId, finalMessage)
  }

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditingMessageContent(currentContent)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingMessageContent('')
  }

  const handleSaveEdit = async (messageId: string, messageIndex: number) => {
    if (!activeChatId || !editingMessageContent.trim()) return

    const newContent = editingMessageContent.trim()
    
    // Update the user message
    setChats(prev =>
      prev.map(c => {
        if (c.id !== activeChatId) return c
        const updatedMessages = c.messages.slice(0, messageIndex + 1).map(msg =>
          msg.id === messageId ? { ...msg, content: newContent } : msg
        )
        const updated = { ...c, messages: updatedMessages }
        AppStorage.saveChat(updated)
        return updated
      })
    )

    // Clear editing state
    setEditingMessageId(null)
    setEditingMessageContent('')

    // Regenerate AI response
    setIsTyping(true)
    const reply = await window.ai.explainText(newContent)
    setIsTyping(false)

    // Create assistant message
    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    setChats(prev => addMessageToChat(prev, activeChatId, assistantMessage))

    // Stream the response
    const chars = reply.split('')
    for (let i = 0; i < chars.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      
      setChats(prev => 
        prev.map(chat => {
          if (chat.id !== activeChatId) return chat
          return {
            ...chat,
            messages: chat.messages.map(msg => {
              if (msg.id !== assistantMessageId) return msg
              return {
                ...msg,
                content: reply.substring(0, i + 1)
              }
            })
          }
        })
      )
    }

    // Save final message
    const finalMessage = { ...assistantMessage, content: reply }
    await AppStorage.saveMessage(activeChatId, finalMessage)
  }

  // Create a new branch from a message
  const handleCreateBranch = async (messageIndex: number) => {
    if (!activeChatId || isTyping) return
    
    const chat = chats.find(c => c.id === activeChatId)
    if (!chat) return

    const branchKey = `${activeChatId}:${messageIndex}`

    // Get messages up to and including the branch point
    const baseMessages = chat.messages.slice(0, messageIndex + 1)
    const remainingMessages = chat.messages.slice(messageIndex + 1)

    // Initialize branch structure if it doesn't exist
    if (!messageBranches[branchKey]) {
      setMessageBranches(prev => ({
        ...prev,
        [branchKey]: {
          branches: [remainingMessages], // Original path as first branch
          currentBranch: 0
        }
      }))
    }

    // Add new empty branch
    setMessageBranches(prev => ({
      ...prev,
      [branchKey]: {
        branches: [...(prev[branchKey]?.branches || [remainingMessages]), []],
        currentBranch: (prev[branchKey]?.branches.length || 1)
      }
    }))

    // Update chat to show only base messages
    setChats(prev =>
      prev.map(c => {
        if (c.id !== activeChatId) return c
        return {
          ...c,
          messages: baseMessages
        }
      })
    )
  }

  // Navigate between branches
  const handleSwitchBranch = (messageIndex: number, direction: 'prev' | 'next') => {
    if (!activeChatId) return

    const chat = chats.find(c => c.id === activeChatId)
    if (!chat) return

    const branchKey = `${activeChatId}:${messageIndex}`
    const branchData = messageBranches[branchKey]
    if (!branchData) return

    // Before switching, save the current branch's messages
    const baseMessages = chat.messages.slice(0, messageIndex + 1)
    const currentBranchMessages = chat.messages.slice(messageIndex + 1)
    
    setMessageBranches(prev => ({
      ...prev,
      [branchKey]: {
        ...prev[branchKey],
        branches: prev[branchKey].branches.map((branch, i) => 
          i === prev[branchKey].currentBranch ? currentBranchMessages : branch
        )
      }
    }))

    const totalBranches = branchData.branches.length
    let newBranchIndex = branchData.currentBranch

    if (direction === 'next') {
      newBranchIndex = (branchData.currentBranch + 1) % totalBranches
    } else {
      newBranchIndex = (branchData.currentBranch - 1 + totalBranches) % totalBranches
    }

    // Update current branch index
    const updatedBranchData = {
      ...branchData,
      currentBranch: newBranchIndex,
      branches: branchData.branches.map((branch, i) => 
        i === branchData.currentBranch ? currentBranchMessages : branch
      )
    }

    setMessageBranches(prev => ({
      ...prev,
      [branchKey]: updatedBranchData
    }))

    // Update chat messages to show the selected branch
    const branchMessages = updatedBranchData.branches[newBranchIndex]

    setChats(prev =>
      prev.map(c => {
        if (c.id !== activeChatId) return c
        return {
          ...c,
          messages: [...baseMessages, ...branchMessages]
        }
      })
    )
  }

  // Get branch info for a message
  const getBranchInfo = (messageIndex: number) => {
    if (!activeChatId) return null
    
    const branchKey = `${activeChatId}:${messageIndex}`
    const branchData = messageBranches[branchKey]
    if (!branchData || branchData.branches.length <= 1) return null

    return {
      current: branchData.currentBranch + 1,
      total: branchData.branches.length
    }
  }

  // Analytics calculations
  const getAnalytics = () => {
    const totalChats = chats.length
    const totalMessages = chats.reduce((sum, chat) => sum + chat.messages.length, 0)
    const userMessages = chats.reduce((sum, chat) => 
      sum + chat.messages.filter(m => m.role === 'user').length, 0)
    const aiMessages = chats.reduce((sum, chat) => 
      sum + chat.messages.filter(m => m.role === 'assistant').length, 0)
    
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const totalCharacters = chats.reduce((sum, chat) => 
      sum + chat.messages.reduce((msgSum, msg) => msgSum + msg.content.length, 0), 0)
    const estimatedTokens = Math.round(totalCharacters / 4)

    // Current chat stats
    const currentChatStats = activeChat ? {
      messages: activeChat.messages.length,
      userMessages: activeChat.messages.filter(m => m.role === 'user').length,
      aiMessages: activeChat.messages.filter(m => m.role === 'assistant').length,
      words: activeChat.messages.reduce((sum, msg) => 
        sum + msg.content.split(/\s+/).filter(w => w.length > 0).length, 0),
      characters: activeChat.messages.reduce((sum, msg) => sum + msg.content.length, 0),
      estimatedTokens: Math.round(
        activeChat.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4
      )
    } : null

    // Activity by date
    const messagesByDate: { [date: string]: number } = {}
    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        const date = new Date(msg.timestamp).toLocaleDateString()
        messagesByDate[date] = (messagesByDate[date] || 0) + 1
      })
    })

    const sortedDates = Object.entries(messagesByDate)
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
      .slice(-7) // Last 7 days

    return {
      overall: {
        totalChats,
        totalMessages,
        userMessages,
        aiMessages,
        estimatedTokens,
        favoriteChats: chats.filter(c => c.favorite).length
      },
      currentChat: currentChatStats,
      activity: sortedDates
    }
  }

  // Chat state
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [userIsTyping, setUserIsTyping] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])
  const isExplainingRef = useRef(false)
  const activeChatIdRef = useRef<string | null>(null)

  // Chat sorting
  type SortOption = 'latest' | 'oldest' | 'favorite' | 'name'
  const [sortBy, setSortBy] = useState<SortOption>('latest')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const getSortedChats = () => {
    let chatsCopy = [...chats]
    
    // Filter by search query first
    if (searchQuery.trim()) {
      chatsCopy = chatsCopy.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Then sort
    switch (sortBy) {
      case 'latest':
        return chatsCopy.sort((a, b) => b.createdAt - a.createdAt)
      case 'oldest':
        return chatsCopy.sort((a, b) => a.createdAt - b.createdAt)
      case 'favorite':
        return chatsCopy.sort((a, b) => {
          if (a.favorite && !b.favorite) return -1
          if (!a.favorite && b.favorite) return 1
          return b.createdAt - a.createdAt
        })
      case 'name':
        return chatsCopy.sort((a, b) => a.title.localeCompare(b.title))
      default:
        return chatsCopy
    }
  }

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
  const [shortcuts, setShortcuts] = useState(() => AppStorage.getShortcuts())
  const [editingShortcut, setEditingShortcut] = useState<keyof typeof shortcuts | null>(null)

  // Get active chat
  const activeChat = chats.find(c => c.id === activeChatId)

  // Message search state (must be after activeChat is defined)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [messageSearchExpanded, setMessageSearchExpanded] = useState(false)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const messageSearchInputRef = useRef<HTMLInputElement>(null)
  const matchedMessageRefs = useRef<HTMLDivElement[]>([])

  // Get matched messages
  const getMatchedMessages = () => {
    if (!activeChat || !messageSearchQuery.trim()) return []
    
    const query = messageSearchQuery.toLowerCase()
    return activeChat.messages
      .map((msg, index) => ({ msg, index }))
      .filter(({ msg }) => msg.content.toLowerCase().includes(query))
  }

  const matchedMessages = getMatchedMessages()
  const totalMatches = matchedMessages.length

  // Navigate to next/previous match
  const navigateToMatch = (direction: 'next' | 'prev') => {
    if (totalMatches === 0) return
    
    let newIndex = currentMatchIndex
    if (direction === 'next') {
      newIndex = (currentMatchIndex + 1) % totalMatches
    } else {
      newIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches
    }
    
    setCurrentMatchIndex(newIndex)
    
    // Scroll to matched message
    const matchedElement = matchedMessageRefs.current[newIndex]
    if (matchedElement) {
      matchedElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Reset search when chat changes
  useEffect(() => {
    setMessageSearchQuery('')
    setMessageSearchExpanded(false)
    setCurrentMatchIndex(0)
  }, [activeChatId])

  // Reset current match when query changes
  useEffect(() => {
    setCurrentMatchIndex(0)
  }, [messageSearchQuery])

  // Initialize database and load data
  useEffect(() => {
    const loadData = async () => {
      await AppStorage.initialize()
      const loadedChats = await AppStorage.loadChats()
      setChats(loadedChats)
    }
    loadData()
  }, [])

  // Load messages and reactions when active chat changes
  useEffect(() => {
    const loadChatData = async () => {
      if (!activeChatId) {
        setMessageReactions({})
        setMessageBranches({})
        return
      }

      const chat = await AppStorage.loadChat(activeChatId)
      if (chat) {
        // Load branches first
        const branches = AppStorage.loadBranches(activeChatId)
        setMessageBranches(branches)

        // If branches exist, reconstruct messages to show the current branch
        if (Object.keys(branches).length > 0) {
          // Find the earliest branch point for this chat
          const chatBranchKeys = Object.keys(branches).filter(key => key.startsWith(`${activeChatId}:`))
          
          if (chatBranchKeys.length > 0) {
            const branchIndices = chatBranchKeys.map(key => parseInt(key.split(':')[1])).sort((a, b) => a - b)
            const earliestBranchIndex = branchIndices[0]
            const earliestBranchKey = `${activeChatId}:${earliestBranchIndex}`
            const branchData = branches[earliestBranchKey]
            
            if (branchData && branchData.branches && branchData.branches.length > 0) {
              // Get base messages up to branch point
              const baseMessages = chat.messages.slice(0, earliestBranchIndex + 1)
              // Get current branch messages
              const currentBranchMessages = branchData.branches[branchData.currentBranch] || []
              
              // Update chat with reconstructed messages
              const reconstructedChat = {
                ...chat,
                messages: [...baseMessages, ...currentBranchMessages]
              }
              setChats(prev => prev.map(c => c.id === activeChatId ? reconstructedChat : c))
            } else {
              setChats(prev => prev.map(c => c.id === activeChatId ? chat : c))
            }
          } else {
            setChats(prev => prev.map(c => c.id === activeChatId ? chat : c))
          }
        } else {
          setChats(prev => prev.map(c => c.id === activeChatId ? chat : c))
        }
      }

      const reactions = await AppStorage.loadReactions(activeChatId)
      setMessageReactions(reactions)
    }
    loadChatData()
  }, [activeChatId])

  // Save shortcuts when they change
  useEffect(() => {
    AppStorage.saveShortcuts(shortcuts)
  }, [shortcuts])

  // Save branches when they change
  useEffect(() => {
    if (activeChatId && Object.keys(messageBranches).length > 0) {
      AppStorage.saveBranches(activeChatId, messageBranches)
    }
  }, [messageBranches, activeChatId])

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
      setChats(prev => [newChat, ...prev])
      setActiveChatId(newChat.id)
      AppStorage.saveChat(newChat) // Save to DB
      return
    }

    setChats(prev => addMessageToChat(prev, activeChatId, systemMessage))
    AppStorage.saveMessage(activeChatId, systemMessage) // Save to DB
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
      await AppStorage.saveChat(newChat) // Save to DB
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    // Append message
    setChats(prev => addMessageToChat(prev, chatId!, userMessage))
    await AppStorage.saveMessage(chatId, userMessage) // Save to DB

    // Show typing indicator
    setIsTyping(true)

    const reply = await window.ai.explainText(text)

    // Hide typing indicator
    setIsTyping(false)

    // Create assistant message with empty content initially
    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    // Add empty message
    setChats(prev => addMessageToChat(prev, chatId!, assistantMessage))

    // Stream the text character by character
    const chars = reply.split('')
    for (let i = 0; i < chars.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      
      setChats(prev => 
        prev.map(chat => {
          if (chat.id !== chatId) return chat
          return {
            ...chat,
            messages: chat.messages.map(msg => {
              if (msg.id !== assistantMessageId) return msg
              return {
                ...msg,
                content: reply.substring(0, i + 1)
              }
            })
          }
        })
      )
    }
    
    // Save final complete message
    const finalMessage = { ...assistantMessage, content: reply }
    await AppStorage.saveMessage(chatId, finalMessage)

    // Update branch structure if we're in a branch
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return

    // Find if we're at a branch point (only check branches for this chat)
    for (const [branchKey, branchData] of Object.entries(messageBranches)) {
      // Skip branches from other chats
      if (!branchKey.startsWith(`${chatId}:`)) continue
      
      const messageIndex = parseInt(branchKey.split(':')[1])
      const baseMessages = chat.messages.slice(0, messageIndex + 1)
      
      // If our current messages start with this base, we're in this branch
      if (chat.messages.length > baseMessages.length &&
          chat.messages.slice(0, baseMessages.length).every((msg, i) => msg.id === baseMessages[i]?.id)) {
        
        // Get messages after the branch point
        const branchMessages = chat.messages.slice(messageIndex + 1)
        
        // Update the current branch with new messages
        setMessageBranches(prev => ({
          ...prev,
          [branchKey]: {
            ...prev[branchKey],
            branches: prev[branchKey].branches.map((branch, i) => 
              i === prev[branchKey].currentBranch ? branchMessages : branch
            )
          }
        }))
        break
      }
    }
  }

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && attachedFiles.length === 0) || isTyping) return
    
    let message = messageInput.trim()
    
    // Add file context to message
    if (attachedFiles.length > 0) {
      message += '\n\n[Attached Files]:\n'
      
      for (const file of attachedFiles) {
        message += `\n--- ${file.name} ---\n`
        
        if (file.type.startsWith('image/')) {
          message += `[Image: ${file.name}]\n`
          // Note: For full multimodal support, you'd send the base64 image to a vision model
          // For now, we just mention it
        } else if (file.data && !file.data.startsWith('data:')) {
          // Text file content
          message += file.data + '\n'
        } else {
          message += `[File: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]\n`
        }
      }
    }
    
    setMessageInput('')
    setAttachedFiles([])
    setUserIsTyping(false)
    
    await handleExplain(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Delete chat function extracted for reuse
  const deleteChatById = async (chatId: string) => {
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

    deleteTimeoutRef.current = window.setTimeout(async () => {
      setChats(prev => prev.filter(c => c.id !== chat.id))
      setRecentlyDeletedChat(null)
      deleteTimeoutRef.current = null
      await AppStorage.deleteChat(chatId) // Delete from DB
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

    const { ipcRenderer } = window.require('electron')
    ipcRenderer.on('trigger-explain-clipboard', handleHotKey)

    return () => {
      ipcRenderer.removeAllListeners('trigger-explain-clipboard')
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
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
  }, [renamingChatId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F to open message search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && activeChatId && rightPanel === 'panel-chat') {
        e.preventDefault()
        setMessageSearchExpanded(true)
        setTimeout(() => messageSearchInputRef.current?.focus(), 100)
        return
      }

      // Enter / Shift+Enter to navigate search results
      if (messageSearchExpanded && messageSearchQuery && document.activeElement === messageSearchInputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault()
          navigateToMatch(e.shiftKey ? 'prev' : 'next')
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setMessageSearchQuery('')
          setMessageSearchExpanded(false)
          return
        }
      }

      if (editingShortcut) return

      const target = e.target as HTMLElement
      if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (!activeChatId) return

      const key = e.key.toLowerCase()
      switch (key) {
        case shortcuts.favorite:
          e.preventDefault()
          setChats(prev =>
            prev.map(c => {
              if (c.id === activeChatId) {
                const updated = { ...c, favorite: !c.favorite }
                AppStorage.updateChat(activeChatId, { favorite: updated.favorite })
                return updated
              }
              return c
            })
          )
          break

        case shortcuts.rename:
          e.preventDefault()
          setRenamingChatId(activeChatId)
          break

        case shortcuts.deselect:
          e.preventDefault()
          setActiveChatId(null)
          break
          
        case 'delete':
        case 'backspace':
          e.preventDefault()
          deleteChatById(activeChatId)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeChatId, chats, shortcuts])

  useEffect(() => {
    if (!editingShortcut) return

    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault()

      if (e.key === 'Escape') {
        setEditingShortcut(null)
        return
      }

      setShortcuts((prev: typeof shortcuts) => ({
        ...prev,
        [editingShortcut]: e.key.toLowerCase()
      }))

      setEditingShortcut(null)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [editingShortcut])

  // Dropdown sorting click handler
  useEffect(() => {
    const closeSortDropdown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.sort-container')) {
        setSortDropdownOpen(false)
      }
    }

    if (sortDropdownOpen) {
      window.addEventListener('click', closeSortDropdown)
    }

    return () => {
      window.removeEventListener('click', closeSortDropdown)
    }
  }, [sortDropdownOpen])

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <button
          className="new-chat"
          onClick={async () => {
            const newChat = createNewChat()
            setChats(prev => [newChat, ...prev])
            setActiveChatId(newChat.id)
            await AppStorage.saveChat(newChat)
          }}
        >
          + New Chat
        </button>

        <div className="sidebar-divider"></div>

        {/* Search Field */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="sort-container">
          <button 
            className="sort-button"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
          >
            <span>Sort: {
              sortBy === 'latest' ? 'Latest First' :
              sortBy === 'oldest' ? 'Oldest First' :
              sortBy === 'favorite' ? 'Favorites First' :
              'Alphabetical'
            }</span>
            <span className="sort-arrow">{sortDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {sortDropdownOpen && (
            <div className="sort-dropdown">
              <div 
                className={`sort-option ${sortBy === 'latest' ? 'active' : ''}`}
                onClick={() => {
                  setSortBy('latest')
                  setSortDropdownOpen(false)
                }}
              >
                Latest First
              </div>
              <div 
                className={`sort-option ${sortBy === 'oldest' ? 'active' : ''}`}
                onClick={() => {
                  setSortBy('oldest')
                  setSortDropdownOpen(false)
                }}
              >
                Oldest First
              </div>
              <div 
                className={`sort-option ${sortBy === 'favorite' ? 'active' : ''}`}
                onClick={() => {
                  setSortBy('favorite')
                  setSortDropdownOpen(false)
                }}
              >
                Favorites First
              </div>
              <div 
                className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
                onClick={() => {
                  setSortBy('name')
                  setSortDropdownOpen(false)
                }}
              >
                Alphabetical
              </div>
            </div>
          )}
        </div>

        <div className="chat-list">
          {getSortedChats().map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === activeChatId ? 'active' : ''}${chat.isDeleting ? ' chat-deleting' : ''}`}
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
                      onBlur={async (e) => {
                        const value = e.currentTarget.textContent?.trim()
                        if (value) {
                          setChats(prev =>
                            prev.map(c =>
                              c.id === chat.id ? { ...c, title: value } : c
                            )
                          )
                          await AppStorage.updateChat(chat.id, { title: value })
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
                  onClick={async (e) => {
                    e.stopPropagation()
                    setChats(prev =>
                      prev.map(c => {
                        if (c.id === chat.id) {
                          const updated = { ...c, favorite: !c.favorite }
                          AppStorage.updateChat(chat.id, { favorite: updated.favorite })
                          return updated
                        }
                        return c
                      })
                    )
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-icon-button"
            title="Analytics"
            onClick={() => setRightPanel(prev => prev === 'panel-analytics' ? 'panel-chat' : 'panel-analytics')}
          >
            <BarChart3 size={18} />
          </button>
          <button
            className="sidebar-icon-button"
            title="Keyboard shortcuts"
            onClick={() => setRightPanel(prev => prev === 'panel-shortcuts' ? 'panel-chat' : 'panel-shortcuts')}
          >
            <Command size={18} />
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="right-panel">
        <div className="right-panel-inner">
          {rightPanel === 'panel-chat' && (
            <div className="chat">
              {/* Search bar */}
              {activeChat && (
                <div 
                  className={`message-search-container ${messageSearchExpanded ? 'expanded' : ''}`}
                  onMouseEnter={() => setMessageSearchExpanded(true)}
                  onMouseLeave={() => {
                    if (!messageSearchQuery) setMessageSearchExpanded(false)
                  }}
                >
                  <div className="message-search-bar">
                    <Search size={16} className="search-icon" />
                    <input
                      ref={messageSearchInputRef}
                      type="text"
                      className="message-search-input"
                      placeholder="Search messages..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      onFocus={() => setMessageSearchExpanded(true)}
                    />
                    {messageSearchQuery && (
                      <>
                        <span className="search-count">
                          {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : 'No matches'}
                        </span>
                        <button
                          className="search-nav-btn"
                          onClick={() => navigateToMatch('prev')}
                          disabled={totalMatches === 0}
                          title="Previous match"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          className="search-nav-btn"
                          onClick={() => navigateToMatch('next')}
                          disabled={totalMatches === 0}
                          title="Next match"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          className="search-clear-btn"
                          onClick={() => {
                            setMessageSearchQuery('')
                            setMessageSearchExpanded(false)
                          }}
                          title="Clear search"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div className="chat-inner">
                {activeChat ? (
                  <>
                    {activeChat.messages.map((msg, index) => {
                      const matchIndex = matchedMessages.findIndex(m => m.index === index)
                      const isMatched = matchIndex !== -1
                      const isCurrentMatch = isMatched && matchIndex === currentMatchIndex
                      
                      return (
                        <div 
                          key={msg.id}
                          ref={(el) => {
                            if (isMatched && el) {
                              matchedMessageRefs.current[matchIndex] = el
                            }
                          }}
                        >
                          <div className={`msg-row ${msg.role}`}>
                            <div className="msg-bubble">
                              {msg.role === 'assistant' && <div className="msg-label">AI</div>}
                              {msg.role === 'user' && <div className="msg-label">You</div>}
                              
                              {editingMessageId === msg.id ? (
                                <div className="msg-edit-container">
                                  <textarea
                                    className="msg-edit-input"
                                    value={editingMessageContent}
                                    onChange={(e) => setEditingMessageContent(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSaveEdit(msg.id, index)
                                      }
                                      if (e.key === 'Escape') {
                                        handleCancelEdit()
                                      }
                                    }}
                                    autoFocus
                                    disabled={isTyping}
                                  />
                                  <div className="msg-edit-actions">
                                    <button
                                      className="msg-edit-save"
                                      onClick={() => handleSaveEdit(msg.id, index)}
                                      disabled={!editingMessageContent.trim() || isTyping}
                                      title="Save and regenerate (Enter)"
                                    >
                                      <Check size={14} />
                                      Save
                                    </button>
                                    <button
                                      className="msg-edit-cancel"
                                      onClick={handleCancelEdit}
                                      disabled={isTyping}
                                      title="Cancel (Esc)"
                                    >
                                      <X size={14} />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="msg-content">
                                  {highlightMatches(msg.content, isCurrentMatch)}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons for user messages */}
                          {msg.role === 'user' && editingMessageId !== msg.id && (
                            <div className="msg-actions">
                              <button
                                className="msg-action-btn"
                                onClick={() => handleCopyMessage(msg.content)}
                                title="Copy"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                className="msg-action-btn"
                                onClick={() => handleEditMessage(msg.id, msg.content)}
                                title="Edit message"
                                disabled={isTyping}
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}
                          
                          {/* Action buttons for AI messages */}
                          {msg.role === 'assistant' && (
                            <div className="msg-actions">
                              {/* Branch navigation */}
                              {getBranchInfo(index) && (
                                <>
                                  <button
                                    className="msg-action-btn"
                                    onClick={() => handleSwitchBranch(index, 'prev')}
                                    title="Previous branch"
                                    disabled={isTyping}
                                  >
                                    <ChevronLeft size={14} />
                                  </button>
                                  <span className="branch-indicator">
                                    {getBranchInfo(index)!.current}/{getBranchInfo(index)!.total}
                                  </span>
                                  <button
                                    className="msg-action-btn"
                                    onClick={() => handleSwitchBranch(index, 'next')}
                                    title="Next branch"
                                    disabled={isTyping}
                                  >
                                    <ChevronRight size={14} />
                                  </button>
                                  <div className="action-divider"></div>
                                </>
                              )}
                              
                              <button
                                className="msg-action-btn"
                                onClick={() => handleCreateBranch(index)}
                                title="Create alternate path from here"
                                disabled={isTyping}
                              >
                                <GitBranch size={14} />
                              </button>
                              <button
                                className="msg-action-btn"
                                onClick={() => handleCopyMessage(msg.content)}
                                title="Copy"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                className={`msg-action-btn ${messageReactions[msg.id] === 'like' ? 'active-like' : ''}`}
                                onClick={() => handleLikeMessage(msg.id)}
                                title="Like"
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                className={`msg-action-btn ${messageReactions[msg.id] === 'dislike' ? 'active-dislike' : ''}`}
                                onClick={() => handleDislikeMessage(msg.id)}
                                title="Dislike"
                              >
                                <ThumbsDown size={14} />
                              </button>
                              <button
                                className="msg-action-btn"
                                onClick={() => handleRetryMessage(index)}
                                title="Retry"
                                disabled={isTyping}
                              >
                                <RotateCcw size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {userIsTyping && (
                      <div className="typing-indicator user-typing">
                        <div className="typing-bubble user-typing-bubble">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    )}
                    {isTyping && (
                      <div className="typing-indicator">
                        <div className="typing-bubble">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="chat-empty">Select a chat</div>
                )}
              </div>
            </div>
          )}

          {rightPanel === 'panel-shortcuts' && (
            <div className="shortcuts-panel">
              <div className="shortcuts-header">
                <h2>Keyboard Shortcuts</h2>
                <p>Click on any shortcut to change it.</p>
              </div>

              <div className="shortcuts-list">
                {/* Chat Section */}
                <div className="shortcuts-section">
                  <h3 className="shortcuts-section-title">Chat</h3>
                  
                  <div className="shortcut-item">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Favorite Chat</div>
                      <div className="shortcut-description">Mark the active chat as favorite</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div
                        className={`shortcut-key ${editingShortcut === 'favorite' ? 'editing' : ''}`}
                        onClick={() => setEditingShortcut('favorite')}
                      >
                        {editingShortcut === 'favorite' ? 'Press key' : shortcuts.favorite}
                      </div>
                    </div>
                  </div>

                  <div className="shortcut-item">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Rename Chat</div>
                      <div className="shortcut-description">Rename the active chat</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div
                        className={`shortcut-key ${editingShortcut === 'rename' ? 'editing' : ''}`}
                        onClick={() => setEditingShortcut('rename')}
                      >
                        {editingShortcut === 'rename' ? 'Press key' : shortcuts.rename}
                      </div>
                    </div>
                  </div>

                  <div className="shortcut-item">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Delete Chat</div>
                      <div className="shortcut-description">Delete the active chat</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div
                        className={`shortcut-key ${editingShortcut === 'delete' ? 'editing' : ''}`}
                        onClick={() => setEditingShortcut('delete')}
                      >
                        {editingShortcut === 'delete' ? 'Press key' : shortcuts.delete}
                      </div>
                    </div>
                  </div>

                  <div className="shortcut-item">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Deselect Chat</div>
                      <div className="shortcut-description">Clear the active chat selection</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div
                        className={`shortcut-key ${editingShortcut === 'deselect' ? 'editing' : ''}`}
                        onClick={() => setEditingShortcut('deselect')}
                      >
                        {editingShortcut === 'deselect' ? 'Press key' : shortcuts.deselect}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Section */}
                <div className="shortcuts-section">
                  <h3 className="shortcuts-section-title">Messages</h3>
                  
                  <div className="shortcut-item non-editable">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Search Messages</div>
                      <div className="shortcut-description">Open message search in active chat</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div className="shortcut-key fixed">
                        {navigator.platform.includes('Mac') ? '⌘+F' : 'Ctrl+F'}
                      </div>
                    </div>
                  </div>

                  <div className="shortcut-item non-editable">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Navigate Search Results</div>
                      <div className="shortcut-description">Move between search matches</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div className="shortcut-key fixed">Enter</div>
                      <span className="shortcut-divider">/</span>
                      <div className="shortcut-key fixed">Shift+Enter</div>
                    </div>
                  </div>

                  <div className="shortcut-item non-editable">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Close Search</div>
                      <div className="shortcut-description">Exit message search</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div className="shortcut-key fixed">Escape</div>
                    </div>
                  </div>

                  <div className="shortcut-item non-editable">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Save Message Edit</div>
                      <div className="shortcut-description">Save edited message and regenerate</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div className="shortcut-key fixed">Enter</div>
                    </div>
                  </div>

                  <div className="shortcut-item non-editable">
                    <div className="shortcut-info">
                      <div className="shortcut-name">Cancel Message Edit</div>
                      <div className="shortcut-description">Discard message changes</div>
                    </div>
                    <div className="shortcut-key-wrapper">
                      <div className="shortcut-key fixed">Escape</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {rightPanel === 'panel-analytics' && (
            <div className="analytics-panel">
              <div className="analytics-header">
                <h2>Analytics</h2>
                <p>Statistics about your chats and messages</p>
              </div>

              <div className="analytics-content">
                {(() => {
                  const analytics = getAnalytics()
                  
                  return (
                    <>
                      {/* Overall Stats */}
                      <div className="analytics-section">
                        <h3 className="analytics-section-title">Overall Statistics</h3>
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-value">{analytics.overall.totalChats}</div>
                            <div className="stat-label">Total Chats</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analytics.overall.totalMessages}</div>
                            <div className="stat-label">Total Messages</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analytics.overall.userMessages}</div>
                            <div className="stat-label">Your Messages</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analytics.overall.aiMessages}</div>
                            <div className="stat-label">AI Responses</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analytics.overall.favoriteChats}</div>
                            <div className="stat-label">Favorite Chats</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analytics.overall.estimatedTokens.toLocaleString()}</div>
                            <div className="stat-label">Est. Tokens Used</div>
                          </div>
                        </div>
                      </div>

                      {/* Current Chat Stats */}
                      {analytics.currentChat && (
                        <div className="analytics-section">
                          <h3 className="analytics-section-title">Current Chat</h3>
                          <div className="stats-grid">
                            <div className="stat-card">
                              <div className="stat-value">{analytics.currentChat.messages}</div>
                              <div className="stat-label">Messages</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value">{analytics.currentChat.words.toLocaleString()}</div>
                              <div className="stat-label">Words</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value">{analytics.currentChat.characters.toLocaleString()}</div>
                              <div className="stat-label">Characters</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value">{analytics.currentChat.estimatedTokens.toLocaleString()}</div>
                              <div className="stat-label">Est. Tokens</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value">{analytics.currentChat.userMessages}</div>
                              <div className="stat-label">Your Messages</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value">{analytics.currentChat.aiMessages}</div>
                              <div className="stat-label">AI Responses</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Activity */}
                      <div className="analytics-section">
                        <h3 className="analytics-section-title">Recent Activity (Last 7 Days)</h3>
                        <div className="activity-chart">
                          {analytics.activity.length > 0 ? (
                            analytics.activity.map(([date, count]) => {
                              const maxCount = Math.max(...analytics.activity.map(([_, c]) => c))
                              const percentage = (count / maxCount) * 100
                              
                              return (
                                <div key={date} className="activity-bar-container">
                                  <div className="activity-date">{date}</div>
                                  <div className="activity-bar-wrapper">
                                    <div 
                                      className="activity-bar" 
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                  <div className="activity-count">{count}</div>
                                </div>
                              )
                            })
                          ) : (
                            <div className="no-activity">No messages yet</div>
                          )}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        {rightPanel === 'panel-chat' && activeChatId && (
          <div className="message-input-container">
            <FileUploader 
              onFilesSelected={(files) => setAttachedFiles(prev => [...prev, ...files])}
              maxFiles={5}
              maxSizeMB={10}
            />
            <div className="message-input-wrapper">
              <FilePreview 
                files={attachedFiles}
                onRemove={(id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))}
              />
              <div className="message-input-box">
                <button 
                  className="attachment-button" 
                  title="Add attachment"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Paperclip size={20} />
                  </span>
                </button>
                <textarea
                  className="message-input"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value)
                    if (e.target.value.trim() && !userIsTyping) {
                      setUserIsTyping(true)
                    } else if (!e.target.value.trim() && userIsTyping) {
                      setUserIsTyping(false)
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isTyping}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px'
                  }}
                />
                <button
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isTyping}
                  title="Send message"
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={18} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
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
              onClick={async () => {
                setChats(prev =>
                  prev.map(c => {
                    if (c.id === chatContextMenu.chatId) {
                      const updated = { ...c, favorite: !c.favorite }
                      AppStorage.updateChat(chatContextMenu.chatId, { favorite: updated.favorite })
                      return updated
                    }
                    return c
                  })
                )
                setChatContextMenu(null)
              }}
            >
              <Star size={18} />
              <span>Favorite</span>
            </div>  
            <span className='context-shortcut'>{shortcuts.favorite.toUpperCase()}</span>          
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
            <span className='context-shortcut'>{shortcuts.rename.toUpperCase()}</span>          
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
            <span className='context-shortcut'>{shortcuts.delete.toUpperCase()}</span>          
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
            <span className='context-shortcut'>{shortcuts.deselect.toUpperCase()}</span>           
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