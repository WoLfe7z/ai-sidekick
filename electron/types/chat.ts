export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export type Chat = {
  id: string
  title: string
  favorite?: boolean
  folder?: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  isDeleting?: boolean
}
