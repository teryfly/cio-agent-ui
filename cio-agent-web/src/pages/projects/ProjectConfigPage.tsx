import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { projectsApi } from '../../api/projects'
import { solutionsApi } from '../../api/solutions'
import {
  configApi,
  readGlobalConfigCache,
  writeGlobalConfigCache,
  getS4CInfoCached,
} from '../../api/config'
import { useAuthStore } from '../../store/authStore'
import type { ProjectConfig, GlobalConfig } from '../../api/types'
import Button        from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PageHeader    from '../../components/ui/PageHeader'
import ConfigForm, { CLAUDE_ALIASES } from '../../components/config/ConfigForm'

// ─── Empty / default helpers ──────────────────────────────────────────────────

const emptyConfig = (): ProjectConfig => ({
  model: '',
  llm_url: '',
  claude_alias: '',
  programmer: 'claude',
  temperature: 0.7,
  max_tokens: 4096,
  timeout: 300,
  file_limit: 30,
  architect_prompt: '',
  engineer_prompt: '',
  models: {},
  validation: {
    validate_after_run: false,
    max_fix_rounds: 3,
    model: '',
    step_filter: null,
    stdout_preview_limit: 10000,
    target_coverage: 80,
  },
  claude_md: { enabled: true, model: '', memory_model: '' },
  git: { enabled: false },
  execution_context_max_turns: 10,
  execution_context_content_limit: 500,
})

/**
 * Build project defaults from the full GlobalConfig so that
 * "Reset to system defaults" reflects every field the admin configured.
 */
function buildDefaultsFromGlobal(global: GlobalConfig): ProjectConfig {
  return {
    model:        global.model         ?? '',
    llm_url:      global.llm_url       ?? '',
    claude_alias: global.claude_alias  ?? '',
    programmer:   global.programmer    ?? 'claude',
    temperature:  0.7,
    max_tokens:   4096,
    timeout:      300,
    file_limit:   global.file_limit    ?? 30,
    architect_prompt: global.architect_prompt ?? '',
    engineer_prompt:  global.engineer_prompt  ?? '',
    models: global.models ?? {},
    validation: {
      validate_after_run:   global.validation?.validate_after_run   ?? false,
      max_fix_rounds:       global.validation?.max_fix_rounds       ?? 3,
      model:                global.validation?.model                ?? '',
      step_filter:          global.validation?.step_filter          ?? null,
      stdout_preview_limit: global.validation?.stdout_preview_limit ?? 10000,
      target_coverage:      global.validation?.target_coverage      ?? 80,
    },
    claude_md: {
      enabled:      global.claude_md?.enabled      ?? true,
      model:        global.claude_md?.model        ?? '',
      memory_model: global.claude_md?.memory_model ?? '',
    },
    git: global.git ?? { enabled: false },
    execution_context_max_turns:
      global.execution_context_max_turns     ?? 10,
    execution_context_content_limit:
      global.execution_context_content_limit ?? 500,
  }
}

/**
 * Get global config: prefer cache, fall back to API and cache the result.
 */
async function getGlobalConfigCached(): Promise<GlobalConfig> {
  const cached = readGlobalConfigCache()
  if (cached) return cached
  const fresh = await configApi.get()
  writeGlobalConfigCache(fresh)
  return fresh
}

// ─── Copy Config Icon Button ──────────────────────────────────────────────────

interface CopyConfigButtonProps {
  config: ProjectConfig
  solutionId: string
  projectId: string
  solutionName: string
  projectName: string
}

function CopyConfigButton({
  config,
  solutionId,
  solutionName,
}: CopyConfigButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      // v2.3.0: work_dir is solution-level path.
      // Format: {solution_dir}/{solution_name}_{solution_id}/
      // Project subdirectory is created by CIO-Agent on first run_new; do NOT include it here.
      let workDir: string | undefined
      const s4c = await getS4CInfoCached()
      const baseDir = s4c?.solution_dir
      if (baseDir && solutionName && solutionId) {
        workDir = `${baseDir}/${solutionName}_${solutionId}`
      }

      const enrichedConfig: ProjectConfig = {
        ...config,
        ...(workDir !== undefined ? { work_dir: workDir } : {}),
      }

      const json = JSON.stringify(enrichedConfig, null, 2)
      await navigator.clipboard.writeText(json)
      setCopied(true)
      toast.success('配置已复制到剪贴板（JSON 格式）')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败，请检查浏览器剪贴板权限')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="复制配置 JSON 到剪贴板"
      className={`
        inline-flex items-center justify-center p-1.5 rounded-lg border transition-all duration-150
        ${copied
          ? 'border-green-500/50 text-green-400 bg-green-500/10'
          : 'border-border text-gray-500 hover:text-gray-200 hover:border-brand-500/50 hover:bg-surface-3'
        }
      `}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

// ─── Reset to Default Button ──────────────────────────────────────────────────

function ResetButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="ghost" size="sm" loading={loading} onClick={onClick}>
      重置为系统默认
    </Button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectConfigPage() {
  const { solutionId, projectId } = useParams<{ solutionId: string; projectId: string }>()
  const navigate = useNavigate()
  const isAdmin  = useAuthStore((s) => s.isAdmin())

  const [config,       setConfig]       = useState<ProjectConfig>(emptyConfig())
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [isDefault,    setIsDefault]    = useState(false)
  const [projectName,  setProjectName]  = useState('')
  const [solutionName, setSolutionName] = useState('')

  // claude_alias options: static list from ConfigForm constants
  const aliasOptions = CLAUDE_ALIASES as readonly string[]

  const sid = solutionId!
  const pid = projectId!

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Fetch solution name for work_dir computation
        solutionsApi.get(sid)
          .then((sol) => setSolutionName(sol.name))
          .catch(() => {})

        const res = await projectsApi.getConfig(sid, pid)
        setProjectName(res.project_name)
        const merged = { ...emptyConfig(), ...res.config }
        // Ensure programmer defaults to 'claude' if not set
        if (!merged.programmer) merged.programmer = 'claude'
        setConfig(merged)
        setIsDefault(false)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        const code   = (err as { response?: { data?: { error?: string } } })?.response?.data?.error

        if (code === 'config_not_found' || status === 404) {
          // No project-specific config yet — seed form with system defaults
          try {
            const global = await getGlobalConfigCached()
            setConfig(buildDefaultsFromGlobal(global))
            setIsDefault(true)
          } catch {
            setConfig(emptyConfig())
            setIsDefault(true)
          }
        } else {
          toast.error('加载配置失败')
        }
      } finally {
        setLoading(false)
      }
    }

    // Also fetch project name separately in case getConfig fails with 404
    projectsApi.get(sid, pid)
      .then((p) => setProjectName(p.name))
      .catch(() => {})

    load()
  }, [sid, pid]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true)
    try {
      await projectsApi.patchConfig(sid, pid, config)
      toast.success('配置已保存')
      setIsDefault(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetLoading(true)
    try {
      const global = await getGlobalConfigCached()
      const reset  = buildDefaultsFromGlobal(global)
      await projectsApi.patchConfig(sid, pid, reset)
      setConfig(reset)
      setIsDefault(false)
      toast.success('已重置为系统默认')
    } catch {
      toast.error('重置失败')
    } finally {
      setResetLoading(false)
      setResetConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 bg-surface-2 rounded animate-pulse" />
        <div className="h-64 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: 'Solutions', to: '/solutions' },
          { label: solutionName || sid.slice(0, 8), to: `/solutions/${sid}` },
          { label: projectName || pid.slice(0, 8), to: `/solutions/${sid}/projects/${pid}` },
          { label: '项目配置' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>取消</Button>
            {/* Reset button in top-right (admin only) */}
            {isAdmin && (
              <ResetButton onClick={() => setResetConfirm(true)} loading={resetLoading} />
            )}
            {/* Copy config JSON button */}
            <CopyConfigButton
              config={config}
              solutionId={sid}
              projectId={pid}
              solutionName={solutionName}
              projectName={projectName}
            />
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              保存修改
            </Button>
          </div>
        }
      />

      {/* Default-fill notice */}
      {isDefault && (
        <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-amber-400">
          当前未设置独立配置，已自动填入系统默认值作为参考，保存后将作为此项目的独立配置生效。
        </div>
      )}

      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <ConfigForm
          mode="project"
          config={config}
          onChange={setConfig}
          isDefault={isDefault}
          aliases={aliasOptions as string[]}
        />
      </div>

      {/* Footer actions */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-600">
          ⓘ 系统默认由管理员在 /admin/config 中设置；此处覆盖仅影响当前 Project。
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>取消</Button>
          {/* Copy config JSON button (footer) */}
          <CopyConfigButton
            config={config}
            solutionId={sid}
            projectId={pid}
            solutionName={solutionName}
            projectName={projectName}
          />
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            保存修改
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        onConfirm={handleReset}
        title="重置为系统默认"
        message="确定要将此 Project 配置重置为系统默认吗？此操作不可撤销。"
        confirmLabel="重置"
        danger
        loading={resetLoading}
      />
    </div>
  )
}
