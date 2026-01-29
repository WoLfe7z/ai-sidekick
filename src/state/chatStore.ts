import { Chat, Message } from '../types/chat'

export type ChatState = {
  chats: Chat[]
  activeChatId: string | null
}

export function createNewChat(initialMessage?: Message): Chat {
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    title: initialMessage
      ? initialMessage.content.slice(0, 40)
      : 'New Chat: ' + new Date(now).toLocaleString().slice(0, -3),
    messages: initialMessage ? [initialMessage] : [],
    createdAt: now,
    updatedAt: now
  }
}

export function addMessageToChat(
  chats: Chat[],
  chatId: string,
  message: Message
): Chat[] {
  return chats.map(chat =>
    chat.id === chatId
      ? {
          ...chat,
          messages: [...chat.messages, message],
          updatedAt: Date.now()
        }
      : chat
  )
}
