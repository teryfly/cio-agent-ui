import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import Button    from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface WorkspaceEntry {
  name:     string
  type:     'directory' | 'file'
  size:     number | null
  modified: string
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(entry: WorkspaceEntry): string {
  if (entry.type === 'directory') return '📁'
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    py:   '🐍', ts:  '📘', tsx: '📘', js:  '📒', jsx: '📒',
    json: '📋', md:  '📝', txt: '📄', yaml:'⚙', yml: '⚙',
    sh:   '💻', env: '🔐', sql: '🗄', html:'🌐', css: '🎨',
  }
  return icons[ext] ?? '📄'
}

/* ── File content modal ──────────────────────────────────────────────────── */

function FileContentModal({
  path, onClose,
}: { path: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    apiClient.get<{ content: string; truncated: boolean; path: string }>(
      `/workspace/${encodeURIComponent(path)}/content`
    )
      .then((r) => {
        setContent(r.data.content)
        setTruncated(r.data.truncated)
      })
      .catch((err) => {
        const code = err?.response?.data?.error
        if (code === 'binary_file') setContent('[二进制文件，无法以文本展示]')
        else toast.error('读取文件失败')
      })
      .finally(() => setLoading(false))
  }, [path])

  const filename = path.split('/').pop() ?? path
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const isCode = ['py','ts','tsx','js','jsx','json','yaml','yml','sh','sql','html','css','md','txt','env'].includes(ext)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface-1 border border-border rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100 truncate">{filename}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate">{path}</p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {content && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  navigator.clipboard.writeText(content)
                  toast.success('已复制')
                }}
              >
                复制
              </Button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-xs text-gray-500">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
              加载中…
            </div>
          ) : (
            <>
              {truncated && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
                  ⚠ 文件较大，仅展示前 200KB 内容
                </div>
              )}
              <pre className={`p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre ${
                isCode ? 'text-gray-300 font-mono' : 'text-gray-400'
              }`}>
                {content ?? ''}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Breadcrumb ──────────────────────────────────────────────────────────── */

function Breadcrumb({
  path, onNavigate,
}: { path: string; onNavigate: (p: string) => void }) {
  const parts = path ? path.split('/').filter(Boolean) : []

  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      <button
        onClick={() => onNavigate('')}
        className="text-brand-400 hover:text-brand-300 transition-colors"
      >
        workspace
      </button>
      {parts.map((part, i) => {
        const to = parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            <span className="text-gray-600">›</span>
            {isLast ? (
              <span className="text-gray-300">{part}</span>
            ) : (
              <button
                onClick={() => onNavigate(to)}
                className="text-brand-400 hover:text-brand-300 transition-colors"
              >
                {part}
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function WorkspacePage() {
  const [path,    setPath]    = useState('')
  const [entries, setEntries] = useState<WorkspaceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewFile, setViewFile] = useState<string | null>(null)
  const [search,  setSearch]  = useState('')

  const navigate = (to: string) => {
    setPath(to)
    setSearch('')
  }

  useEffect(() => {
    setLoading(true)
    const url = path ? `/workspace/${encodeURIComponent(path)}` : '/workspace'
    apiClient.get<{ files: WorkspaceEntry[] }>(url)
      .then((r) => setEntries(r.data.files))
      .catch((err) => {
        const code = err?.response?.data?.error
        if (code === 'not_a_directory') toast.error('这不是一个目录')
        else toast.error('加载目录失败')
      })
      .finally(() => setLoading(false))
  }, [path])

  const filtered = entries.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  // Sort: directories first, then by name
  const sorted = [...filtered].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const handleEntryClick = (entry: WorkspaceEntry) => {
    if (entry.type === 'directory') {
      const dirName = entry.name.replace(/\/$/, '')
      navigate(path ? `${path}/${dirName}` : dirName)
    } else {
      const filePath = path ? `${path}/${entry.name}` : entry.name
      setViewFile(filePath)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">工作区</h1>
          <p className="text-xs text-gray-500 mt-0.5">浏览 AI 生成代码的文件系统</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(path)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          刷新
        </Button>
      </div>

      {/* Toolbar */}
      <div className="bg-surface-1 border border-border rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
        {/* Up button */}
        {path && (
          <Button
            variant="ghost"
            size="xs"
            icon="↑"
            onClick={() => {
              const parts = path.split('/').filter(Boolean)
              parts.pop()
              navigate(parts.join('/'))
            }}
          >
            上级目录
          </Button>
        )}

        {/* Breadcrumb */}
        <Breadcrumb path={path} onNavigate={navigate} />

        {/* Search */}
        <div className="ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="过滤文件名…"
            className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 w-44"
          />
        </div>
      </div>

      {/* File list */}
      <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[32px_1fr_100px_140px] gap-3 px-4 py-2 bg-surface-2 border-b border-border text-[11px] text-gray-500 font-medium uppercase tracking-wider">
          <span />
          <span>名称</span>
          <span className="text-right">大小</span>
          <span className="text-right">修改时间</span>
        </div>

        {loading ? (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 border-b border-border/30 animate-pulse bg-surface-2/30" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={search ? '🔍' : '📭'}
            title={search ? '没有匹配的文件' : '此目录为空'}
          />
        ) : (
          <div>
            {sorted.map((entry) => {
              const modDate = entry.modified
                ? new Date(entry.modified).toLocaleDateString('zh-CN') + ' ' +
                  new Date(entry.modified).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
                : '—'

              return (
                <button
                  key={entry.name}
                  className="w-full grid grid-cols-[32px_1fr_100px_140px] gap-3 px-4 py-2.5 items-center border-b border-border/30 last:border-0 hover:bg-surface-3/50 transition-colors text-left group"
                  onClick={() => handleEntryClick(entry)}
                >
                  <span className="text-base leading-none">{fileIcon(entry)}</span>
                  <span className={`text-sm truncate ${
                    entry.type === 'directory'
                      ? 'text-brand-400 font-medium group-hover:text-brand-300'
                      : 'text-gray-200 group-hover:text-gray-100'
                  }`}>
                    {entry.name}
                  </span>
                  <span className="text-[11px] text-gray-500 text-right tabular-nums">
                    {entry.type === 'directory' ? '—' : formatBytes(entry.size)}
                  </span>
                  <span className="text-[11px] text-gray-600 text-right font-mono">{modDate}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && sorted.length > 0 && (
        <p className="text-[11px] text-gray-600 mt-2 px-1">
          {sorted.filter((e) => e.type === 'directory').length} 个目录，{' '}
          {sorted.filter((e) => e.type === 'file').length} 个文件
          {search && ` (过滤中，共 ${entries.length} 个)`}
        </p>
      )}

      {/* File content viewer */}
      {viewFile && (
        <FileContentModal path={viewFile} onClose={() => setViewFile(null)} />
      )}
    </div>
  )
}
