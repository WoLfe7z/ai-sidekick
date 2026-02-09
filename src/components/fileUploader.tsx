import { useState } from 'react'
import { X, FileText, Image as ImageIcon, File, Code } from 'lucide-react'

export type UploadedFile = {
  id: string
  name: string
  type: string
  size: number
  data: string // base64 or text content
  preview?: string // for images
}

type FileUploaderProps = {
  onFilesSelected: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSizeMB?: number
}

export function FileUploader({ onFilesSelected, maxFiles = 5, maxSizeMB = 10 }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const processFiles = async (fileList: FileList) => {
    const files: UploadedFile[] = []
    const maxSizeBytes = maxSizeMB * 1024 * 1024

    for (let i = 0; i < Math.min(fileList.length, maxFiles); i++) {
      const file = fileList[i]
      
      if (file.size > maxSizeBytes) {
        alert(`File ${file.name} is too large. Max size is ${maxSizeMB}MB`)
        continue
      }

      const uploadedFile: UploadedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: ''
      }

      // Handle different file types
      if (file.type.startsWith('image/')) {
        // For images, create preview and store as base64
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
        uploadedFile.data = dataUrl
        uploadedFile.preview = dataUrl
      } else if (file.type.startsWith('text/') || 
                 file.name.endsWith('.txt') || 
                 file.name.endsWith('.md') ||
                 file.name.endsWith('.js') ||
                 file.name.endsWith('.ts') ||
                 file.name.endsWith('.tsx') ||
                 file.name.endsWith('.jsx') ||
                 file.name.endsWith('.py') ||
                 file.name.endsWith('.css') ||
                 file.name.endsWith('.json')) {
        // For text files, store as text
        const reader = new FileReader()
        const text = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsText(file)
        })
        uploadedFile.data = text
      } else {
        // For other files, store as base64
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
        uploadedFile.data = dataUrl
      }

      files.push(uploadedFile)
    }

    onFilesSelected(files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = '' // Reset input
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <>
      <input
        type="file"
        id="file-upload"
        multiple
        accept="image/*,.txt,.md,.js,.ts,.tsx,.jsx,.py,.css,.json,.pdf,.doc,.docx"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
      {isDragging && (
        <div
          className="file-drop-overlay"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="file-drop-message">
            Drop files here to upload
          </div>
        </div>
      )}
    </>
  )
}

export function FilePreview({ 
  files, 
  onRemove 
}: { 
  files: UploadedFile[]
  onRemove: (id: string) => void 
}) {
  const getFileIcon = (file: UploadedFile) => {
    if (file.type.startsWith('image/')) return <ImageIcon size={16} />
    if (file.name.match(/\.(js|ts|tsx|jsx|py|css|json)$/)) return <Code size={16} />
    if (file.type.startsWith('text/')) return <FileText size={16} />
    return <File size={16} />
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (files.length === 0) return null

  return (
    <div className="file-preview-container">
      {files.map(file => (
        <div key={file.id} className="file-preview-item">
          {file.preview ? (
            <div className="file-preview-image">
              <img src={file.preview} alt={file.name} />
            </div>
          ) : (
            <div className="file-preview-icon">
              {getFileIcon(file)}
            </div>
          )}
          <div className="file-preview-info">
            <div className="file-preview-name">{file.name}</div>
            <div className="file-preview-size">{formatSize(file.size)}</div>
          </div>
          <button
            className="file-preview-remove"
            onClick={() => onRemove(file.id)}
            title="Remove file"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}