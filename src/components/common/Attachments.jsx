import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

const FILE_ICONS = {
  'application/pdf': '📄',
  'image/png': '🖼️', 'image/jpeg': '🖼️', 'image/jpg': '🖼️', 'image/webp': '🖼️', 'image/gif': '🖼️', 'image/svg+xml': '🖼️',
  'application/msword': '📝', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-powerpoint': '📑', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📑',
  'text/plain': '📃', 'text/csv': '📊',
  'application/zip': '🗜️', 'application/x-rar-compressed': '🗜️', 'application/x-7z-compressed': '🗜️',
  'video/mp4': '🎬', 'video/quicktime': '🎬', 'audio/mpeg': '🎵', 'audio/wav': '🎵',
  'default': '📎'
}

// File types the browser can display inline — everything else triggers a download
const INLINE_VIEWABLE = new Set(['application/pdf', 'text/plain', 'text/csv'])

function canViewInline(mimetype = '') {
  return mimetype.startsWith('image/') || INLINE_VIEWABLE.has(mimetype)
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Attachments({ refId, refType, uploadedBy, readOnly = false }) {
  const [files, setFiles]       = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState(null)
  const inputRef = useRef()

  // Load existing attachments
  useEffect(() => {
    if (!refId) { setLoading(false); return }
    fetch(`/api/attachments?refId=${refId}&refType=${refType}`)
      .then(r => r.json())
      .then(data => { setFiles(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refId, refType])

  const handleUpload = async (e) => {
    const selected = Array.from(e.target.files)
    if (!selected.length) return
    setUploading(true)

    for (const file of selected) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', refType)
        formData.append('refId', refId)
        formData.append('refType', refType)
        formData.append('uploadedBy', uploadedBy || 'unknown')

        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error || 'Upload failed'); continue }

        setFiles(prev => [{ ...data, id: Date.now().toString() }, ...prev])
        toast.success(`✅ ${file.name} uploaded!`)
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return
    setDeleting(file.publicId)
    try {
      const res = await fetch(`/api/attachments/${encodeURIComponent(file.publicId)}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Delete failed'); return }
      setFiles(prev => prev.filter(f => f.publicId !== file.publicId))
      toast.success('File deleted!')
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          📎 Attachments {files.length > 0 && <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{files.length}</span>}
        </div>
        {!readOnly && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !refId}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                color: 'var(--blue)', cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: !refId ? 0.5 : 1
              }}
            >
              {uploading ? '⏳ Uploading...' : '+ Upload File'}
            </button>
            <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
              onChange={handleUpload}
            />
          </>
        )}
      </div>

      {/* File List */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading...</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
          No attachments yet {!readOnly && '— click "+ Upload File" to add'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((file, i) => {
            const icon = FILE_ICONS[file.fileType] || FILE_ICONS['default']
            const isDeleting = deleting === file.publicId
            const inline = canViewInline(file.fileType)
            return (
              <div key={file.publicId || i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.originalName}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatSize(file.size)}</div>
                </div>
                <a href={file.url} target="_blank" rel="noopener noreferrer"
                  {...(!inline && { download: file.originalName })}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', textDecoration: 'none', flexShrink: 0 }}>
                  {inline ? '👁️ View' : '⬇️ Download'}
                </a>
                {!readOnly && (
                  <button onClick={() => handleDelete(file)} disabled={isDeleting}
                    style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                    {isDeleting ? '⏳' : '🗑️'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
