import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import Button    from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface LogFile {
  filename:     string
  size_bytes:   number
  modified:     string
  entries_count: number
  project_name: string
}

interface LogEntry {
  timestamp: string
  level:     string
  message:   string
  run_id?:   string
  extra:     Record<string, unknown>
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'

/* ── Log level styling ───────────────────────────────────────────────────── */

const levelCls: Record<string, string> = {
  DEBUG:   'text-gray-500',
  INFO:    'text-blue-400',
  WARNING: 'text-amber-400',
  ERROR:   'text-red-400',
}

const levelBg: Record<string, string> = {
  DEBUG:   'bg-gray-500/10   border-gray-500/20',
  INFO:    'bg-blue-500/10   border-blue-500/20',
  WARNING: 'bg-amber-500/10  border-amber-500/20',
  ERROR:   'bg-red-500/10    border-red-500/20',
}

/* ── Log file list ───────────────────────────────────────────────────────── */

function LogFileRow({
  file, active, onClick,
}: { file: LogFile; active: boolean; onClick: () => void }) {
  const kb = (file.size_bytes / 1024).toFixed(1)
  const date = new Date(file.modified).toLocaleDateString('zh-CN')

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
        active
          ? 'border-brand-600/50 bg-brand-600/10 text-brand-400'
          : 'border-transparent hover:bg-surface-3 text-gray-300'
      }`}
    >
      <p className="text-xs font-medium truncate">{file.project_name || file.filename}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {file.entries_count} 条 · {kb} KB · {date}
      </p>
    </button>
  )
}

/* ── Log entry row ───────────────────────────────────────────────────────── */

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasExtra = Object.keys(entry.extra ?? {}).length > 0
  const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false })

  return (
    <div
      className={`border-b border-border/30 text-xs font-mono ${
        expanded ? 'bg-surface-3/30' : 'hover:bg-surface-3/20'
      } transition-colors`}
    >
      <div
        className={`flex items-start gap-2 px-3 py-1.5 ${hasExtra ? 'cursor-pointer' : ''}`}
        onClick={() => hasExtra && setExpanded((e) => !e)}
      >
        <span className="text-gray-600 shrink-0 w-20 text-right">{time}</span>
        <span className={`shrink-0 w-16 font-semibold ${levelCls[entry.level] ?? 'text-gray-400'}`}>
          {entry.level}
        </span>
        {entry.run_id && (
          <span className="text-gray-600 shrink-0">[{entry.run_id.slice(0, 8)}]</span>
        )}
        <span className="text-gray-300 break-all leading-relaxed flex-1">{entry.message}</span>
        {hasExtra && (
          <span className="text-gray-600 shrink-0">{expanded ? '▴' : '▾'}</span>
        )}
      </div>
      {expanded && hasExtra && (
        <pre className="px-3 py-2 text-[11px] text-gray-500 bg-surface-0 border-t border-border/30 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(entry.extra, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function LogsPage() {
  const [files,       setFiles]       = useState<LogFile[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [selected,    setSelected]    = useState<string | null>(null)
  const [entries,     setEntries]     = useState<LogEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [keyword,     setKeyword]     = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load file list
  const loadFiles = () => {
    setFilesLoading(true)
    apiClient.get<{ logs: LogFile[] }>('/logs/', {
      params: projectFilter ? { project_name: projectFilter } : {},
    })
      .then((r) => setFiles(r.data.logs))
      .catch(() => toast.error('加载日志列表失败'))
      .finally(() => setFilesLoading(false))
  }

  useEffect(() => { loadFiles() }, [projectFilter]) // eslint-disable-line

  // Load entries for selected file
  const loadEntries = (filename: string) => {
    setEntriesLoading(true)
    apiClient.get<{ entries: LogEntry[]; total: number }>(`/logs/${filename}`, {
      params: {
        ...(levelFilter !== 'all' ? { level: levelFilter } : {}),
        ...(keyword ? { keyword } : {}),
        limit: 500,
      },
    })
      .then((r) => {
        setEntries(r.data.entries)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .catch(() => toast.error('加载日志内容失败'))
      .finally(() => setEntriesLoading(false))
  }

  useEffect(() => {
    if (selected) loadEntries(selected)
  }, [selected, levelFilter]) // eslint-disable-line

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !selected) return
    const t = setInterval(() => loadEntries(selected), 3000)
    return () => clearInterval(t)
  }, [autoRefresh, selected]) // eslint-disable-line

  // Keyword search with debounce
  useEffect(() => {
    if (!selected) return
    const t = setTimeout(() => loadEntries(selected), 400)
    return () => clearTimeout(t)
  }, [keyword]) // eslint-disable-line

  const levels: (LogLevel | 'all')[] = ['all', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
  const totalEntries = entries.length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">日志查看</h1>
          <p className="text-xs text-gray-500 mt-0.5">{files.length} 个日志文件</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)] min-h-[500px]">

        {/* Left: file list */}
        <div className="w-60 shrink-0 flex flex-col gap-2">
          {/* Project filter */}
          <input
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            placeholder="按项目过滤…"
            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500"
          />
          <div className="flex-1 overflow-y-auto space-y-1">
            {filesLoading ? (
              <div className="space-y-1">
                {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-surface-2 rounded-lg animate-pulse" />)}
              </div>
            ) : files.length === 0 ? (
              <EmptyState icon="📋" title="暂无日志文件" />
            ) : (
              files.map((f) => (
                <LogFileRow
                  key={f.filename}
                  file={f}
                  active={selected === f.filename}
                  onClick={() => setSelected(f.filename)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: log content */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface-1 border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="📄" title="选择左侧日志文件以查看内容" />
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2 flex-wrap shrink-0">
                {/* Level filter */}
                <div className="flex items-center gap-0.5">
                  {levels.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevelFilter(l)}
                      className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                        levelFilter === l
                          ? l === 'all'
                            ? 'bg-brand-600/20 text-brand-400'
                            : `border ${levelBg[l]} ${levelCls[l]}`
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {/* Keyword search */}
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="关键词…"
                  className="flex-1 min-w-24 max-w-48 bg-surface-1 border border-border rounded px-2 py-0.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none"
                />

                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-brand-500 w-3 h-3"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    自动刷新
                  </label>
                  <button
                    onClick={() => selected && loadEntries(selected)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23,4 23,10 17,10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                  </button>
                  <span className="text-[11px] text-gray-600">{totalEntries} 条</span>
                </div>
              </div>

              {/* Entries */}
              <div className="flex-1 overflow-y-auto bg-surface-0">
                {entriesLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : entries.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-600">
                    没有匹配的日志条目
                  </div>
                ) : (
                  entries.map((entry, i) => (
                    <LogEntryRow key={i} entry={entry} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
