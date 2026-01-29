export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export type Chat = {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}
