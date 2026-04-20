import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { knowledgeApi } from '../../../api/knowledge'
import { runsApi }       from '../../../api/runs'
import { useDraftCache } from '../../../hooks/useDraftCache'
import type { KnowledgeDocument, LogLevel, UUID } from '../../../api/types'
import Modal  from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'

/* ── Types ─────────────────────────────────────────────────────────────── */

type KnowledgeMode = 'all' | 'whitelist' | 'skip'
type RunVariant    = 'new' | 'secondary'

interface Props {
  open:        boolean
  onClose:     () => void
  solutionId:  UUID
  projectId:   UUID
  projectName: string
  variant?:    RunVariant
  /** Called after successful launch with the run_id */
  onLaunched?: (runId: string) => void
}

/* ── Knowledge Selector ─────────────────────────────────────────────────── */

function KnowledgeSelector({
  solutionId,
  projectId,
  mode,
  onModeChange,
  selected,
  onSelectedChange,
}: {
  solutionId:       UUID
  projectId:        UUID
  mode:             KnowledgeMode
  onModeChange:     (m: KnowledgeMode) => void
  selected:         Set<UUID>
  onSelectedChange: (s: Set<UUID>) => void
}) {
  const [docs,    setDocs]    = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'whitelist') return
    setLoading(true)
    knowledgeApi.listByProject(solutionId, projectId, true)
      .then((d) => {
        setDocs(d.documents)
        // Default: select all
        onSelectedChange(new Set(d.documents.map((doc) => doc.id)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, solutionId, projectId])

  const toggleDoc = (id: UUID) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else              next.add(id)
    onSelectedChange(next)
  }

  const scopeLabel: Record<string, string> = {
    solution: 'sol',
    project:  'proj',
  }

  const scopeCls: Record<string, string> = {
    solution: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
    project:  'text-purple-400 bg-purple-400/10 border-purple-400/20',
  }

  return (
    <div className="space-y-3">
      {/* Mode radio buttons */}
      <div className="space-y-1.5">
        {(
          [
            { val: 'all',       label: '全量模式', desc: '自动聚合所有绑定文档' },
            { val: 'whitelist', label: '白名单模式', desc: '手动勾选文档' },
            { val: 'skip',      label: '跳过',     desc: '不注入任何知识上下文' },
          ] as { val: KnowledgeMode; label: string; desc: string }[]
        ).map(({ val, label, desc }) => (
          <label
            key={val}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
              mode === val
                ? 'border-brand-600/50 bg-brand-600/10'
                : 'border-transparent hover:bg-surface-3'
            }`}
          >
            <input
              type="radio"
              className="accent-brand-500"
              checked={mode === val}
              onChange={() => onModeChange(val)}
            />
            <span className="text-sm text-gray-200">{label}</span>
            <span className="text-xs text-gray-500">（{desc}）</span>
          </label>
        ))}
      </div>

      {/* Doc list for whitelist mode */}
      {mode === 'whitelist' && (
        <div className="border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-500">加载文档列表…</div>
          ) : docs.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">
              此 Project / Solution 暂无绑定的知识文档
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[80px_1fr_48px] gap-2 px-3 py-1.5 bg-surface-3 text-[11px] text-gray-500 font-medium border-b border-border">
                <span>来源</span>
                <span>文档名称</span>
                <span className="text-center">勾选</span>
              </div>
              <div className="divide-y divide-border max-h-44 overflow-y-auto">
                {docs.map((doc) => (
                  <label
                    key={doc.id}
                    className="grid grid-cols-[80px_1fr_48px] gap-2 px-3 py-2.5 items-center cursor-pointer hover:bg-surface-3 transition-colors"
                  >
                    <span className={`text-[10px] font-medium px-1 py-0.5 rounded border w-fit ${scopeCls[doc.scope ?? 'project']}`}>
                      {scopeLabel[doc.scope ?? 'project']}
                    </span>
                    <span className="text-xs text-gray-200 truncate">{doc.title}</span>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        className="accent-brand-500 w-3.5 h-3.5"
                        checked={selected.has(doc.id)}
                        onChange={() => toggleDoc(doc.id)}
                      />
                    </div>
                  </label>
                ))}
              </div>
              <div className="px-3 py-1.5 bg-surface-3 text-[11px] text-gray-500 border-t border-border">
                已选 {selected.size} / {docs.length} 个文档
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Advanced Options ───────────────────────────────────────────────────── */

function AdvancedOptions({
  validate,
  onValidateChange,
  fixRounds,
  onFixRoundsChange,
  logLevel,
  onLogLevelChange,
}: {
  validate:          boolean
  onValidateChange:  (v: boolean) => void
  fixRounds:         number
  onFixRoundsChange: (n: number) => void
  logLevel:          LogLevel
  onLogLevelChange:  (l: LogLevel) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:bg-surface-3 transition-colors"
      >
        <span>高级选项</span>
        <span
          className="text-xs transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3 border-t border-border bg-surface-3/40">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-brand-500"
              checked={validate}
              onChange={(e) => onValidateChange(e.target.checked)}
            />
            <span className="text-xs text-gray-300">执行后自动验证代码（Validate）</span>
          </label>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">修复轮数</label>
              <select
                value={fixRounds}
                onChange={(e) => onFixRoundsChange(parseInt(e.target.value))}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
              >
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">日志级别</label>
              <select
                value={logLevel}
                onChange={(e) => onLogLevelChange(e.target.value as LogLevel)}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
              >
                {(['DEBUG', 'INFO', 'WARNING', 'ERROR'] as LogLevel[]).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Modal ─────────────────────────────────────────────────────────── */

export default function NewRunModal({
  open, onClose, solutionId, projectId, projectName, variant = 'new', onLaunched,
}: Props) {
  const navigate = useNavigate()
  const cacheKey = `draft_run_${projectId}`
  const { draft, updateDraft, clearDraft, isRestored } = useDraftCache(cacheKey)

  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>('all')
  const [selectedDocs,  setSelectedDocs]  = useState<Set<UUID>>(new Set())
  const [validate,      setValidate]      = useState(false)
  const [fixRounds,     setFixRounds]     = useState(3)
  const [logLevel,      setLogLevel]      = useState<LogLevel>('INFO')
  const [loading,       setLoading]       = useState(false)

  // Reset non-draft state when modal opens
  useEffect(() => {
    if (open) {
      setKnowledgeMode('all')
      setSelectedDocs(new Set())
      setValidate(false)
      setFixRounds(3)
      setLogLevel('INFO')
    }
  }, [open])

  const resolveKnowledgeDocIds = (): UUID[] | null => {
    if (knowledgeMode === 'all')  return null
    if (knowledgeMode === 'skip') return []
    return Array.from(selectedDocs)
  }

  const handleSubmit = async () => {
    if (!draft.trim()) {
      toast.error('请输入需求描述')
      return
    }
    setLoading(true)
    try {
      const fn = variant === 'new' ? runsApi.newRun : runsApi.secondaryRun
      const res = await fn(solutionId, projectId, {
        requirement:       draft.trim(),
        validate,
        fix_rounds:        validate ? fixRounds : null,
        log_level:         logLevel,
        knowledge_doc_ids: resolveKnowledgeDocIds(),
      })
      clearDraft()
      toast.success('任务已启动')
      if (onLaunched) {
        onLaunched(res.run_id)
      } else {
        onClose()
        navigate(`/runs/${res.run_id}`)
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'project_locked') toast.error('项目正在执行中，请稍后再试')
      else toast.error('启动失败')
    } finally {
      setLoading(false)
    }
  }

  const title = variant === 'new'
    ? `🚀 启动新任务 — ${projectName}`
    : `↺ 二次开发 — ${projectName}`

  const charCount = draft.length

  return (
    <Modal open={open} onClose={onClose} title={title} width="lg" persistent={loading}>
      <div className="px-5 py-4 space-y-5">

        {/* Requirement input */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            需求描述 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            rows={6}
            placeholder={
              `详细描述你的编码需求，例如：\n- 实现 POST /api/v1/auth/register 接口\n- 使用 bcrypt 哈希密码\n- 返回 JWT token`
            }
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono leading-relaxed"
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-[11px] ${charCount > 45000 ? 'text-amber-400' : 'text-gray-600'}`}>
              字数: {charCount.toLocaleString()} / 50,000
            </span>
            <span className="text-[11px] text-gray-600 flex items-center gap-1">
              <span>💾</span>
              {isRestored ? (
                <span className="text-amber-400">已恢复上次未发送的草稿</span>
              ) : (
                <span>已自动保存草稿</span>
              )}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-gray-500 font-medium uppercase tracking-widest">知识上下文</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Knowledge selector */}
        <KnowledgeSelector
          solutionId={solutionId}
          projectId={projectId}
          mode={knowledgeMode}
          onModeChange={setKnowledgeMode}
          selected={selectedDocs}
          onSelectedChange={setSelectedDocs}
        />

        {/* Advanced options */}
        <AdvancedOptions
          validate={validate}
          onValidateChange={setValidate}
          fixRounds={fixRounds}
          onFixRoundsChange={setFixRounds}
          logLevel={logLevel}
          onLogLevelChange={setLogLevel}
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={loading}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!draft.trim()}
            icon={variant === 'new' ? '▶' : '↺'}
          >
            {variant === 'new' ? '启动任务' : '启动二次开发'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}