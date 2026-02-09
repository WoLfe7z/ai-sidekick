import { Chat } from '../types/chat'

// Export chat as Markdown
export function exportChatAsMarkdown(chat: Chat): string {
  const lines: string[] = []
  
  // Header
  lines.push(`# ${chat.title}`)
  lines.push('')
  lines.push(`**Created:** ${new Date(chat.createdAt).toLocaleString()}`)
  lines.push(`**Updated:** ${new Date(chat.updatedAt).toLocaleString()}`)
  lines.push(`**Messages:** ${chat.messages.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  
  // Messages
  chat.messages.forEach((msg, index) => {
    const timestamp = new Date(msg.timestamp).toLocaleString()
    const role = msg.role === 'user' ? '**You**' : '**AI**'
    
    lines.push(`### Message ${index + 1} - ${role}`)
    lines.push(`*${timestamp}*`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  })
  
  return lines.join('\n')
}

// Export chat as JSON
export function exportChatAsJSON(chat: Chat): string {
  const exportData = {
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages.length,
    messages: chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      date: new Date(msg.timestamp).toISOString()
    }))
  }
  
  return JSON.stringify(exportData, null, 2)
}

// Export chat as plain text
export function exportChatAsText(chat: Chat): string {
  const lines: string[] = []
  
  // Header
  lines.push('═'.repeat(60))
  lines.push(chat.title.toUpperCase())
  lines.push('═'.repeat(60))
  lines.push('')
  lines.push(`Created: ${new Date(chat.createdAt).toLocaleString()}`)
  lines.push(`Updated: ${new Date(chat.updatedAt).toLocaleString()}`)
  lines.push(`Messages: ${chat.messages.length}`)
  lines.push('')
  lines.push('─'.repeat(60))
  lines.push('')
  
  // Messages
  chat.messages.forEach((msg, index) => {
    const timestamp = new Date(msg.timestamp).toLocaleString()
    const role = msg.role === 'user' ? 'YOU' : 'AI'
    
    lines.push(`[${role}] - ${timestamp}`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('')
  })
  
  return lines.join('\n')
}

// Download file helper
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Generate filename from chat title
export function generateFilename(chatTitle: string, extension: string): string {
  // Remove special characters and limit length
  const cleaned = chatTitle
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50)
  
  const timestamp = new Date().toISOString().split('T')[0]
  return `${cleaned}-${timestamp}.${extension}`
}