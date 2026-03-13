'use client'

import { apiClient } from '@/lib/api-client'

const SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  ptt: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  document: 20 * 1024 * 1024,
}

const ACCEPT_MAP: Record<string, string> = {
  image: '.jpg,.jpeg,.png,.webp',
  audio: '.mp3,.ogg,.aac',
  ptt: '.mp3,.ogg,.aac',
  video: '.mp4',
  document: '.pdf,.docx',
}

const SIZE_LABEL: Record<string, string> = {
  image: 'JPG, PNG, WEBP — máx 5MB',
  audio: 'MP3, OGG, AAC — máx 10MB',
  ptt: 'MP3, OGG, AAC — máx 10MB',
  video: 'MP4 — máx 50MB',
  document: 'PDF, DOCX — máx 20MB',
}

const FILE_ICON: Record<string, string> = {
  image: '🖼️',
  audio: '🎵',
  ptt: '🎵',
  video: '🎥',
  document: '📄',
}

export type MediaValue = {
  mediaType: 'upload' | 'url'
  mediaUrl: string
  uploadedMediaId?: string
  uploadedFileName?: string
  uploadedFileSize?: number
}

interface MediaUploadInputProps {
  value: MediaValue | null
  onChange: (value: MediaValue | null) => void
  /** The kind of file being handled — controls accept, size limits and icon */
  fileType: 'image' | 'audio' | 'ptt' | 'video' | 'document'
  tenantId: string
  nodeId: string
  workflowId: string
  /** Override the accepted file extensions */
  accept?: string
}

/** Infer mode from an existing value (backward-compat: no mediaType field saved yet) */
function inferMode(value: MediaValue | null): 'upload' | 'url' {
  if (value?.mediaType) return value.mediaType
  if (!value?.mediaUrl) return 'upload'
  return value.mediaUrl.startsWith('http') ? 'url' : 'upload'
}

export default function MediaUploadInput({
  value,
  onChange,
  fileType,
  tenantId,
  nodeId,
  workflowId,
  accept,
}: MediaUploadInputProps) {
  const mode = inferMode(value)

  const setMode = (newMode: 'upload' | 'url') => {
    onChange({ mediaType: newMode, mediaUrl: '' })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ptt is sent as 'audio' to the API (backend doesn't have a 'ptt' type)
    const apiFileType = fileType === 'ptt' ? 'audio' : fileType
    const limit = SIZE_LIMITS[fileType] ?? 5 * 1024 * 1024
    if (file.size > limit) {
      const maxMB = Math.round(limit / (1024 * 1024))
      alert(`Arquivo muito grande. Máximo para ${fileType}: ${maxMB}MB`)
      e.target.value = ''
      return
    }

    try {
      const data = await apiClient.uploadMedia(file, tenantId, apiFileType, nodeId, workflowId)
      onChange({
        mediaType: 'upload',
        mediaUrl: data.url,
        uploadedMediaId: data.id,
        uploadedFileName: data.originalName,
        uploadedFileSize: data.size,
      })
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Erro ao fazer upload do arquivo')
    }
    e.target.value = ''
  }

  const handleRemove = async () => {
    if (value?.uploadedMediaId) {
      try {
        await apiClient.deleteMedia(value.uploadedMediaId, tenantId)
      } catch { /* ignore */ }
    }
    onChange({ mediaType: 'upload', mediaUrl: '' })
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        <button
          type="button"
          onClick={() => mode !== 'upload' && setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-primary/20 text-primary border-r border-primary/30'
              : 'bg-[#151515] text-gray-400 hover:text-gray-200 border-r border-gray-700'
          }`}
        >
          📎 Upload de Arquivo
        </button>
        <button
          type="button"
          onClick={() => mode !== 'url' && setMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
            mode === 'url'
              ? 'bg-primary/20 text-primary'
              : 'bg-[#151515] text-gray-400 hover:text-gray-200'
          }`}
        >
          🔗 Via Link
        </button>
      </div>

      {/* Upload mode */}
      {mode === 'upload' && (
        <>
          {!value?.uploadedMediaId ? (
            <div>
              <label className="flex items-center justify-center gap-2 w-full px-4 py-4 bg-[#151515] border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-[#1a1a1a] transition-colors">
                <span className="text-sm text-gray-300">📎 Selecionar Arquivo</span>
                <input
                  type="file"
                  className="hidden"
                  accept={accept ?? ACCEPT_MAP[fileType] ?? '*'}
                  onChange={handleUpload}
                />
              </label>
              <p className="text-xs text-gray-500 mt-1.5">{SIZE_LABEL[fileType] ?? ''}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border border-primary/30 rounded-lg">
              <span className="text-xl">{FILE_ICON[fileType] ?? '📎'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{value.uploadedFileName || 'Arquivo'}</p>
                <p className="text-xs text-gray-500">
                  {value.uploadedFileSize ? `${(value.uploadedFileSize / 1024).toFixed(1)} KB` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                Remover
              </button>
            </div>
          )}
        </>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div>
          <input
            type="text"
            value={value?.mediaUrl || ''}
            onChange={(e) => onChange({ mediaType: 'url', mediaUrl: e.target.value })}
            placeholder="https://exemplo.com/media.jpg"
            className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            💡 Use{' '}
            <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">
              {'{{variables.imageUrl}}'}
            </code>{' '}
            para variáveis dinâmicas
          </p>
        </div>
      )}
    </div>
  )
}
