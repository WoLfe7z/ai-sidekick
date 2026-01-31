// Markdown parser and renderer for chat messages

export type MarkdownToken = 
  | { type: 'text', content: string }
  | { type: 'bold', content: string }
  | { type: 'italic', content: string }
  | { type: 'code', content: string }
  | { type: 'strikethrough', content: string }
  | { type: 'link', text: string, url: string }
  | { type: 'heading', level: number, content: string }
  | { type: 'list-item', content: string, ordered: boolean, level: number }
  | { type: 'blockquote', content: string }
  | { type: 'hr' }
  | { type: 'linebreak' }

// Parse inline markdown (bold, italic, code, etc.)
const parseInline = (text: string): MarkdownToken[] => {
  const tokens: MarkdownToken[] = []
  let remaining = text
  
  // Pattern: **bold** or __bold__
  // Pattern: *italic* or _italic_
  // Pattern: `code`
  // Pattern: ~~strikethrough~~
  // Pattern: [text](url)
  
  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, type: 'bold' as const },
    { regex: /__(.+?)__/g, type: 'bold' as const },
    { regex: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, type: 'italic' as const },
    { regex: /(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, type: 'italic' as const },
    { regex: /`([^`]+)`/g, type: 'code' as const },
    { regex: /~~(.+?)~~/g, type: 'strikethrough' as const },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' as const }
  ]
  
  let pos = 0
  const matches: { start: number, end: number, type: string, content: string, url?: string }[] = []
  
  // Find all matches
  for (const pattern of patterns) {
    let match
    const regex = new RegExp(pattern.regex.source, 'g')
    while ((match = regex.exec(text)) !== null) {
      if (pattern.type === 'link') {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: pattern.type,
          content: match[1],
          url: match[2]
        })
      } else {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: pattern.type,
          content: match[1]
        })
      }
    }
  }
  
  // Sort by position and filter overlapping
  matches.sort((a, b) => a.start - b.start)
  const filteredMatches = []
  let lastEnd = 0
  
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match)
      lastEnd = match.end
    }
  }
  
  // Build tokens
  let position = 0
  for (const match of filteredMatches) {
    // Add text before match
    if (match.start > position) {
      tokens.push({ type: 'text', content: text.slice(position, match.start) })
    }
    
    // Add formatted token
    if (match.type === 'link') {
      tokens.push({ type: 'link', text: match.content, url: match.url! })
    } else {
      tokens.push({ type: match.type as any, content: match.content })
    }
    
    position = match.end
  }
  
  // Add remaining text
  if (position < text.length) {
    tokens.push({ type: 'text', content: text.slice(position) })
  }
  
  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }]
}

// Parse block-level markdown (headings, lists, etc.)
export const parseMarkdown = (text: string): MarkdownToken[] => {
  const lines = text.split('\n')
  const tokens: MarkdownToken[] = []
  
  let inList = false
  let listLevel = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Empty line
    if (trimmed === '') {
      if (inList) {
        inList = false
        listLevel = 0
      }
      tokens.push({ type: 'linebreak' })
      continue
    }
    
    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      tokens.push({ type: 'hr' })
      continue
    }
    
    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      tokens.push({ 
        type: 'heading', 
        level: headingMatch[1].length, 
        content: headingMatch[2] 
      })
      continue
    }
    
    // Blockquote
    if (trimmed.startsWith('>')) {
      tokens.push({ 
        type: 'blockquote', 
        content: trimmed.slice(1).trim() 
      })
      continue
    }
    
    // Ordered list
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/)
    if (orderedMatch) {
      const level = Math.floor(orderedMatch[1].length / 2)
      tokens.push({ 
        type: 'list-item', 
        content: orderedMatch[3],
        ordered: true,
        level 
      })
      inList = true
      listLevel = level
      continue
    }
    
    // Unordered list
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/)
    if (unorderedMatch) {
      const level = Math.floor(unorderedMatch[1].length / 2)
      tokens.push({ 
        type: 'list-item', 
        content: unorderedMatch[3],
        ordered: false,
        level 
      })
      inList = true
      listLevel = level
      continue
    }
    
    // Regular text
    tokens.push({ type: 'text', content: line })
  }
  
  return tokens
}

// Render inline markdown tokens to React elements
export const renderInline = (text: string, key?: string | number) => {
  const tokens = parseInline(text)
  
  return (
    <>
      {tokens.map((token, i) => {
        const tokenKey = `${key}-${i}`
        
        switch (token.type) {
          case 'bold':
            return <strong key={tokenKey}>{token.content}</strong>
          case 'italic':
            return <em key={tokenKey}>{token.content}</em>
          case 'code':
            return <code key={tokenKey} className="markdown-inline-code">{token.content}</code>
          case 'strikethrough':
            return <del key={tokenKey}>{token.content}</del>
          case 'link':
            return (
              <a 
                key={tokenKey} 
                href={token.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="markdown-link"
              >
                {token.text}
              </a>
            )
          case 'text':
            return <span key={tokenKey}>{token.content}</span>
          default:
            return null
        }
      })}
    </>
  )
}

// Render full markdown to React elements
export const renderMarkdown = (tokens: MarkdownToken[]) => {
  const elements: JSX.Element[] = []
  let currentList: JSX.Element[] = []
  let currentListOrdered = false
  let currentListLevel = 0
  
  const flushList = () => {
    if (currentList.length > 0) {
      const ListTag = currentListOrdered ? 'ol' : 'ul'
      elements.push(
        <ListTag key={`list-${elements.length}`} className="markdown-list">
          {currentList}
        </ListTag>
      )
      currentList = []
    }
  }
  
  tokens.forEach((token, i) => {
    const key = `md-${i}`
    
    switch (token.type) {
      case 'heading':
        flushList()
        const HeadingTag = `h${token.level}` as keyof JSX.IntrinsicElements
        elements.push(
          <HeadingTag key={key} className={`markdown-h${token.level}`}>
            {renderInline(token.content, key)}
          </HeadingTag>
        )
        break
        
      case 'list-item':
        if (currentList.length === 0 || currentListOrdered !== token.ordered) {
          flushList()
          currentListOrdered = token.ordered
        }
        currentList.push(
          <li key={key} className="markdown-list-item">
            {renderInline(token.content, key)}
          </li>
        )
        currentListLevel = token.level
        break
        
      case 'blockquote':
        flushList()
        elements.push(
          <blockquote key={key} className="markdown-blockquote">
            {renderInline(token.content, key)}
          </blockquote>
        )
        break
        
      case 'hr':
        flushList()
        elements.push(<hr key={key} className="markdown-hr" />)
        break
        
      case 'linebreak':
        flushList()
        elements.push(<br key={key} />)
        break
        
      case 'text':
        flushList()
        elements.push(
          <p key={key} className="markdown-text">
            {renderInline(token.content, key)}
          </p>
        )
        break
    }
  })
  
  flushList()
  
  return <>{elements}</>
}