import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Language keywords for detection and highlighting
const LANGUAGES: { [key: string]: { keywords: string[], name: string } } = {
  javascript: {
    name: 'JavaScript',
    keywords: ['const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'new', 'this', 'super', 'extends', 'static', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'switch', 'case', 'break', 'continue']
  },
  typescript: {
    name: 'TypeScript',
    keywords: ['interface', 'type', 'enum', 'namespace', 'declare', 'const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'new', 'this', 'extends', 'implements', 'private', 'public', 'protected', 'readonly', 'static', 'abstract']
  },
  python: {
    name: 'Python',
    keywords: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'async', 'await', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue', 'raise', 'assert', 'global', 'nonlocal']
  },
  java: {
    name: 'Java',
    keywords: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'new', 'this', 'super', 'static', 'final', 'abstract', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'String', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return', 'break', 'continue', 'try', 'catch', 'throw', 'throws', 'finally', 'import', 'package']
  },
  c: {
    name: 'C',
    keywords: ['int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed', 'const', 'static', 'extern', 'auto', 'register', 'volatile', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'goto', 'typedef', 'struct', 'union', 'enum', 'sizeof', 'NULL']
  },
  cpp: {
    name: 'C++',
    keywords: ['int', 'char', 'float', 'double', 'void', 'long', 'short', 'bool', 'class', 'struct', 'namespace', 'using', 'public', 'private', 'protected', 'virtual', 'override', 'const', 'static', 'template', 'typename', 'new', 'delete', 'this', 'nullptr', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'throw']
  },
  csharp: {
    name: 'C#',
    keywords: ['public', 'private', 'protected', 'internal', 'class', 'interface', 'namespace', 'using', 'static', 'readonly', 'const', 'var', 'new', 'this', 'base', 'abstract', 'virtual', 'override', 'async', 'await', 'void', 'int', 'string', 'bool', 'double', 'float', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'return', 'break', 'continue', 'try', 'catch', 'throw', 'finally']
  },
  html: {
    name: 'HTML',
    keywords: ['div', 'span', 'p', 'a', 'img', 'ul', 'li', 'ol', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'head', 'body', 'html', 'script', 'style', 'meta', 'link', 'input', 'button', 'form', 'label', 'select', 'option', 'textarea', 'h1', 'h2', 'h3', 'nav', 'header', 'footer', 'section', 'article']
  },
  css: {
    name: 'CSS',
    keywords: ['color', 'background', 'padding', 'margin', 'display', 'flex', 'grid', 'position', 'width', 'height', 'border', 'font', 'text', 'align', 'justify', 'content', 'items', 'transform', 'transition', 'animation', 'opacity', 'z-index', 'overflow', 'cursor']
  },
  xml: {
    name: 'XML',
    keywords: ['xml', 'version', 'encoding', 'xmlns']
  },
  json: {
    name: 'JSON',
    keywords: ['true', 'false', 'null']
  },
  sql: {
    name: 'SQL',
    keywords: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET']
  }
}

// Detect language from code content
const detectLanguage = (code: string): string => {
  const lines = code.toLowerCase().trim()
  
  // Check for specific patterns
  if (lines.includes('def ') || lines.includes('import ') && lines.includes('from ')) return 'python'
  if (lines.includes('#include <') || lines.includes('printf(') || lines.includes('scanf(')) return 'c'
  if (lines.includes('std::') || lines.includes('cout <<') || lines.includes('namespace ')) return 'cpp'
  if (lines.includes('namespace ') && lines.includes('using System')) return 'csharp'
  if (lines.includes('public class') || lines.includes('public static void main')) return 'java'
  if (lines.includes('const ') || lines.includes('let ') || lines.includes('=>')) return 'javascript'
  if (lines.includes('interface ') || lines.includes(': string') || lines.includes(': number')) return 'typescript'
  if (lines.includes('<?xml') || lines.includes('</')) return 'xml'
  if (lines.match(/^\s*[{[]/) && lines.includes('"')) return 'json'
  if (lines.includes('<div') || lines.includes('<span') || lines.includes('<!DOCTYPE')) return 'html'
  if (lines.includes('{') && (lines.includes('color:') || lines.includes('margin:'))) return 'css'
  if (lines.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i)) return 'sql'
  
  return 'plaintext'
}

// Simple syntax highlighter
const highlightCode = (code: string, language: string): string => {
  // Normalize language aliases
  const langMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'c++': 'cpp',
    'c#': 'csharp',
    'cs': 'csharp',
    'markup': 'html',
    'xml': 'html',
    'htm': 'html'
  }
  
  const normalizedLang = langMap[language.toLowerCase()] || language.toLowerCase()
  
  if (normalizedLang === 'plaintext') {
    return escapeHtml(code)
  }
  
  const langConfig = LANGUAGES[normalizedLang]
  if (!langConfig) {
    return escapeHtml(code)
  }
  
  // Escape HTML first
  let highlighted = escapeHtml(code)
  
  // Track positions to avoid overlapping replacements
  const tokens: { start: number, end: number, type: string, text: string }[] = []
  
  // Find all strings
  const stringRegex = /(["'`])(?:(?=(\\?))\2.)*?\1/g
  let match
  while ((match = stringRegex.exec(code)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'string',
      text: match[0]
    })
  }
  
  // Find all comments
  const commentRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm
  while ((match = commentRegex.exec(code)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'comment',
      text: match[0]
    })
  }
  
  // Find all keywords
  langConfig.keywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'gi')
    while ((match = regex.exec(code)) !== null) {
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'keyword',
        text: match[0]
      })
    }
  })
  
  // Find all numbers
  const numberRegex = /\b(\d+\.?\d*)\b/g
  while ((match = numberRegex.exec(code)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'number',
      text: match[0]
    })
  }
  
  // Find all functions
  const functionRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g
  while ((match = functionRegex.exec(code)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[1].length,
      type: 'function',
      text: match[1]
    })
  }
  
  // Sort by position and filter overlapping tokens (keep first match)
  tokens.sort((a, b) => a.start - b.start)
  const filteredTokens: typeof tokens = []
  let lastEnd = 0
  
  for (const token of tokens) {
    if (token.start >= lastEnd) {
      filteredTokens.push(token)
      lastEnd = token.end
    }
  }
  
  // Build highlighted string
  let result = ''
  let position = 0
  
  for (const token of filteredTokens) {
    // Add text before token
    result += escapeHtml(code.slice(position, token.start))
    
    // Add highlighted token
    const escapedText = escapeHtml(token.text)
    result += `<span class="code-${token.type}">${escapedText}</span>`
    
    position = token.end
  }
  
  // Add remaining text
  result += escapeHtml(code.slice(position))
  
  return result
}

// Helper to escape HTML
const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

type CodeBlockProps = {
  code: string
  language?: string
  inline?: boolean
}

export function CodeBlock({ code, language, inline = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  
  // Normalize language aliases
  const langMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'c++': 'cpp',
    'c#': 'csharp',
    'cs': 'csharp',
    'markup': 'html',
    'xml': 'html',
    'htm': 'html'
  }
  
  const normalizedLang = language ? (langMap[language.toLowerCase()] || language.toLowerCase()) : detectLanguage(code)
  const displayLang = LANGUAGES[normalizedLang]?.name || normalizedLang
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  if (inline) {
    return <code className="code-inline">{code}</code>
  }
  
  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-language">{displayLang}</span>
        <button 
          className="code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="code-pre">
        <code 
          className={`code-content language-${normalizedLang}`}
          dangerouslySetInnerHTML={{ __html: highlightCode(code, normalizedLang) }}
        />
      </pre>
    </div>
  )
}

// Parse message content to extract code blocks
export function parseMessageWithCode(content: string): (string | { type: 'code', code: string, language?: string })[] {
  const parts: (string | { type: 'code', code: string, language?: string })[] = []
  
  // First, match explicit code blocks with triple backticks
  const explicitCodeRegex = /```(\w+)?\n([\s\S]*?)```|`([^`\n]+)`/g
  let lastIndex = 0
  let match
  
  const explicitMatches: { start: number, end: number, isInline: boolean, language?: string, code: string }[] = []
  
  while ((match = explicitCodeRegex.exec(content)) !== null) {
    explicitMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      isInline: !!match[3],
      language: match[1],
      code: match[3] || match[2] || match[0]
    })
  }
  
  // Reset for processing
  lastIndex = 0
  
  // Split by lines to detect implicit code blocks
  const lines = content.split('\n')
  let currentText = ''
  let currentCodeBlock = ''
  let inCodeBlock = false
  let codeBlockStartLine = -1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const position = content.indexOf(line, lastIndex)
    
    // Check if this line is part of an explicit code block
    const isInExplicitBlock = explicitMatches.some(m => position >= m.start && position < m.end)
    
    if (isInExplicitBlock) {
      if (currentCodeBlock) {
        // Save accumulated implicit code block
        const detectedLang = detectLanguage(currentCodeBlock.trim())
        if (detectedLang !== 'plaintext') {
          if (currentText.trim()) {
            parts.push(currentText)
            currentText = ''
          }
          parts.push({ type: 'code', code: currentCodeBlock.trim() })
        } else {
          currentText += currentCodeBlock
        }
        currentCodeBlock = ''
        inCodeBlock = false
      }
      continue
    }
    
    // Auto-detect code by patterns
    const isCodeLine = 
      /^\s{4,}/.test(line) || // 4+ spaces indentation
      /^\t/.test(line) || // Tab indentation
      /^[\s]*[{}\[\]();][\s]*$/.test(line) || // Lines with just brackets/parentheses
      /^[\s]*(const|let|var|function|class|def|import|export|public|private|protected|if|for|while|return)\s/.test(line) || // Starts with keywords
      (/[{};()=]/.test(line) && line.length > 10 && /[a-zA-Z]/.test(line)) || // Has code-like symbols
      /^\s*\/\//.test(line) || // Comment line
      /^\s*#/.test(line) && !/^#\s+[A-Z]/.test(line) || // Python comment (not markdown header)
      /^[\s]*<[a-zA-Z\/]/.test(line) // HTML/XML tag
    
    if (isCodeLine || (inCodeBlock && line.trim().length === 0)) {
      if (!inCodeBlock) {
        // Starting a code block
        if (currentText.trim()) {
          parts.push(currentText)
          currentText = ''
        }
        inCodeBlock = true
        codeBlockStartLine = i
      }
      currentCodeBlock += (currentCodeBlock ? '\n' : '') + line
    } else {
      if (inCodeBlock && i - codeBlockStartLine >= 2) {
        // End code block (minimum 2 lines)
        const detectedLang = detectLanguage(currentCodeBlock.trim())
        if (detectedLang !== 'plaintext' && currentCodeBlock.trim().length > 10) {
          parts.push({ type: 'code', code: currentCodeBlock.trim() })
        } else {
          currentText += currentCodeBlock + '\n'
        }
        currentCodeBlock = ''
        inCodeBlock = false
      } else if (inCodeBlock) {
        // Not enough lines, treat as text
        currentText += currentCodeBlock + '\n'
        currentCodeBlock = ''
        inCodeBlock = false
      }
      currentText += line + (i < lines.length - 1 ? '\n' : '')
    }
    
    lastIndex = position + line.length
  }
  
  // Handle remaining code block
  if (currentCodeBlock && inCodeBlock && lines.length - codeBlockStartLine >= 2) {
    const detectedLang = detectLanguage(currentCodeBlock.trim())
    if (detectedLang !== 'plaintext' && currentCodeBlock.trim().length > 10) {
      if (currentText.trim()) {
        parts.push(currentText)
        currentText = ''
      }
      parts.push({ type: 'code', code: currentCodeBlock.trim() })
    } else {
      currentText += currentCodeBlock
    }
  } else if (currentCodeBlock) {
    currentText += currentCodeBlock
  }
  
  // Add remaining text
  if (currentText.trim()) {
    parts.push(currentText)
  }
  
  // Now handle explicit code blocks (they override implicit detection)
  const finalParts: (string | { type: 'code', code: string, language?: string })[] = []
  let processedContent = content
  
  for (const explicitMatch of explicitMatches) {
    const beforeCode = processedContent.slice(0, explicitMatch.start)
    if (beforeCode.trim()) {
      // Re-parse this section for implicit code if no explicit blocks
      const beforeParts = parts.filter(p => {
        if (typeof p === 'string') {
          return beforeCode.includes(p)
        }
        return false
      })
      finalParts.push(...beforeParts.length > 0 ? beforeParts : [beforeCode])
    }
    
    if (explicitMatch.isInline) {
      finalParts.push({ type: 'code', code: explicitMatch.code })
    } else {
      finalParts.push({ type: 'code', code: explicitMatch.code, language: explicitMatch.language })
    }
    
    processedContent = processedContent.slice(explicitMatch.end)
  }
  
  if (processedContent.trim() && explicitMatches.length > 0) {
    finalParts.push(processedContent)
  }
  
  return explicitMatches.length > 0 ? finalParts : (parts.length > 0 ? parts : [content])
}