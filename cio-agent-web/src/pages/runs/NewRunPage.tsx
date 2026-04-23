/**
 * NewRunPage — 全屏运行配置页面
 * 替换原来的弹窗，三列布局：需求描述 | 知识上下文 | 高级选项
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { knowledgeApi } from '../../api/knowledge'
import { runsApi }      from '../../api/runs'
import { projectsApi }  from '../../api/projects'
import { useDraftCache } from '../../hooks/useDraftCache'
import type { KnowledgeDocument, LogLevel, UUID } from '../../api/types'
import Button from '../../components/ui/Button'

// ─── Types ──────────────────────────────────────────────────────────────────

type KnowledgeMode = 'all' | 'whitelist' | 'skip'
type RunVariant = 'new' | 'secondary' | 'auto'

// ─── Knowledge Selector ─────────────────────────────────────────────────────

function KnowledgeSelector({
  solutionId, projectId, mode, onModeChange, selected, onSelectedChange,
}: {
  solutionId: UUID; projectId: UUID
  mode: KnowledgeMode; onModeChange: (m: KnowledgeMode) => void
  selected: Set<UUID>; onSelectedChange: (s: Set<UUID>) => void
}) {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'whitelist') return
    setLoading(true)
    knowledgeApi.selectableByProject(solutionId, projectId)
      .then((d) => {
        setDocs(d.documents)
        onSelectedChange(new Set(d.documents.map((doc) => doc.id)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, solutionId, projectId])

  const toggleDoc = (id: UUID) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  const scopeCls: Record<string, string> = {
    solution: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
    project:  'text-purple-400 bg-purple-400/10 border-purple-400/20',
  }
  const scopeLabel: Record<string, string> = { solution: 'sol', project: 'proj' }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {([
          { val: 'all',       label: '全量模式',   desc: '自动聚合所有绑定文档' },
          { val: 'whitelist', label: '白名单模式', desc: '手动勾选文档' },
          { val: 'skip',      label: '跳过',       desc: '不注入任何知识上下文' },
        ] as { val: KnowledgeMode; label: string; desc: string }[]).map(({ val, label, desc }) => (
          <label key={val}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
              mode === val ? 'border-brand-600/50 bg-brand-600/10' : 'border-transparent hover:bg-surface-3'
            }`}>
            <input type="radio" className="accent-brand-500" checked={mode === val}
              onChange={() => onModeChange(val)} />
            <span className="text-sm text-gray-200">{label}</span>
            <span className="text-xs text-gray-500">（{desc}）</span>
          </label>
        ))}
      </div>

      {mode === 'whitelist' && (
        <div className="border border-border rounded-lg overflow-hidden mt-2">
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-500">加载文档列表…</div>
          ) : docs.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">暂无绑定文档</div>
          ) : (
            <>
              <div className="grid grid-cols-[80px_1fr_48px] gap-2 px-3 py-1.5 bg-surface-3 text-[11px] text-gray-500 font-medium border-b border-border">
                <span>来源</span><span>文档名称</span><span className="text-center">勾选</span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {docs.map((doc) => (
                  <label key={doc.id}
                    className="grid grid-cols-[80px_1fr_48px] gap-2 px-3 py-2.5 items-center cursor-pointer hover:bg-surface-3 transition-colors">
                    <span className={`text-[10px] font-medium px-1 py-0.5 rounded border w-fit ${scopeCls[doc.scope ?? 'project']}`}>
                      {scopeLabel[doc.scope ?? 'project']}
                    </span>
                    <span className="text-xs text-gray-200 truncate">{doc.title}</span>
                    <div className="flex justify-center">
                      <input type="checkbox" className="accent-brand-500 w-3.5 h-3.5"
                        checked={selected.has(doc.id)} onChange={() => toggleDoc(doc.id)} />
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

// ─── Advanced Options ────────────────────────────────────────────────────────

function AdvancedOptions({
  validate, onValidateChange,
  fixRounds, onFixRoundsChange,
  logLevel, onLogLevelChange,
}: {
  validate: boolean; onValidateChange: (v: boolean) => void
  fixRounds: number; onFixRoundsChange: (n: number) => void
  logLevel: LogLevel; onLogLevelChange: (l: LogLevel) => void
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-transparent hover:bg-surface-3 transition-colors">
        <input type="checkbox" className="accent-brand-500 mt-0.5"
          checked={validate} onChange={(e) => onValidateChange(e.target.checked)} />
        <div>
          <p className="text-sm text-gray-200">执行后自动验证</p>
          <p className="text-xs text-gray-500 mt-0.5">完成代码生成后运行验证流程（V0-V6）</p>
        </div>
      </label>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1.5">修复轮数</label>
          <select value={fixRounds} onChange={(e) => onFixRoundsChange(parseInt(e.target.value))}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500">
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n} 轮</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1.5">日志级别</label>
          <select value={logLevel} onChange={(e) => onLogLevelChange(e.target.value as LogLevel)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500">
            {(['DEBUG', 'INFO', 'WARNING', 'ERROR'] as LogLevel[]).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-surface-2 border border-border rounded-lg p-3 text-[11px] text-gray-500 space-y-1">
        <p className="font-medium text-gray-400">运行模式说明</p>
        <p>• Auto Run — 服务端根据项目是否有运行记录，自动选择 New 或 Secondary</p>
        <p>• New Run — 强制作为全新项目运行</p>
        <p>• Secondary — 在现有代码基础上二次开发</p>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function NewRunPage() {
  const { solutionId, projectId } = useParams<{ solutionId: string; projectId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const variantParam = (searchParams.get('variant') as RunVariant) ?? 'auto'

  const sid = solutionId!
  const pid = projectId!

  const cacheKey = `draft_run_${pid}_${variantParam}`
  const { draft, updateDraft, clearDraft, isRestored } = useDraftCache(cacheKey)

  const [projectName, setProjectName] = useState('')
  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>('all')
  const [selectedDocs,  setSelectedDocs]  = useState<Set<UUID>>(new Set())
  const [validate,      setValidate]      = useState(false)
  const [fixRounds,     setFixRounds]     = useState(3)
  const [logLevel,      setLogLevel]      = useState<LogLevel>('INFO')
  const [loading,       setLoading]       = useState(false)

  useEffect(() => {
    projectsApi.get(sid, pid)
      .then((p) => setProjectName(p.name))
      .catch(() => {})
  }, [sid, pid])

  const resolveKnowledgeDocIds = (): UUID[] | null => {
    if (knowledgeMode === 'all')  return null
    if (knowledgeMode === 'skip') return []
    return Array.from(selectedDocs)
  }

  const handleSubmit = async () => {
    if (!draft.trim()) { toast.error('请输入需求描述'); return }
    setLoading(true)
    try {
      const payload = {
        requirement:       draft.trim(),
        validate,
        fix_rounds:        validate ? fixRounds : null,
        log_level:         logLevel,
        knowledge_doc_ids: resolveKnowledgeDocIds(),
      }

      let res
      if (variantParam === 'new') {
        res = await runsApi.newRun(sid, pid, payload)
      } else if (variantParam === 'secondary') {
        res = await runsApi.secondaryRun(sid, pid, payload)
      } else {
        res = await runsApi.autoRun(sid, pid, payload)
      }

      clearDraft()
      toast.success('任务已启动')
      navigate(`/runs/${res.run_id}`)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'project_locked') toast.error('项目正在执行中，请稍后再试')
      else if (code === 'workflow_already_running') toast.error('该项目已有运行中的任务')
      else toast.error('启动失败')
    } finally {
      setLoading(false)
    }
  }

  const variantLabel: Record<RunVariant, { icon: string; title: string; color: string }> = {
    auto:      { icon: '⚡', title: 'Auto Run',      color: 'text-brand-400' },
    new:       { icon: '▶',  title: 'New Run',        color: 'text-green-400' },
    secondary: { icon: '↺',  title: 'Secondary Run',  color: 'text-amber-400' },
  }
  const vl = variantLabel[variantParam]

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-surface-1 border-b border-border flex items-center px-6 gap-4 shrink-0">
        <button onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-lg ${vl.color}`}>{vl.icon}</span>
          <span className="font-semibold text-gray-100">{vl.title}</span>
          {projectName && (
            <span className="text-gray-500">— {projectName}</span>
          )}
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} disabled={loading}>
          取消
        </Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} loading={loading}
          disabled={!draft.trim()} icon={vl.icon}>
          启动任务
        </Button>
      </div>

      {/* Three-column layout */}
      <div className="flex-1 grid grid-cols-[1fr_280px_260px] gap-0 overflow-hidden">

        {/* Col 1: Requirement */}
        <div className="flex flex-col border-r border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-1 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-100">需求描述</h2>
                <p className="text-xs text-gray-500 mt-0.5">详细描述你的编码需求</p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={draft.length > 45000 ? 'text-amber-400' : 'text-gray-600'}>
                  {draft.length.toLocaleString()} / 50,000
                </span>
                {isRestored && (
                  <span className="text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                    💾 已恢复草稿
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-hidden flex flex-col">
            <textarea
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              placeholder={`详细描述你的编码需求，例如：\n- 实现 POST /api/v1/auth/register 接口\n- 使用 bcrypt 哈希密码\n- 返回 JWT token\n- 写完整的 OpenAPI 文档注释`}
              className="flex-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono leading-relaxed"
              style={{ minHeight: 0 }}
            />
          </div>
        </div>

        {/* Col 2: Knowledge */}
        <div className="flex flex-col border-r border-border overflow-hidden">
          <div className="px-4 py-4 border-b border-border bg-surface-1 shrink-0">
            <h2 className="text-sm font-semibold text-gray-100">知识上下文</h2>
            <p className="text-xs text-gray-500 mt-0.5">选择要注入的知识文档</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <KnowledgeSelector
              solutionId={sid}
              projectId={pid}
              mode={knowledgeMode}
              onModeChange={setKnowledgeMode}
              selected={selectedDocs}
              onSelectedChange={setSelectedDocs}
            />
          </div>
        </div>

        {/* Col 3: Advanced */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-border bg-surface-1 shrink-0">
            <h2 className="text-sm font-semibold text-gray-100">高级选项</h2>
            <p className="text-xs text-gray-500 mt-0.5">验证与执行参数</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <AdvancedOptions
              validate={validate}
              onValidateChange={setValidate}
              fixRounds={fixRounds}
              onFixRoundsChange={setFixRounds}
              logLevel={logLevel}
              onLogLevelChange={setLogLevel}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
