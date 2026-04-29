import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { projectsApi } from '../../api/projects'
import { configApi   } from '../../api/config'
import { useAuthStore } from '../../store/authStore'
import type { ProjectConfig, GlobalConfig } from '../../api/types'
import Button        from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PageHeader    from '../../components/ui/PageHeader'
import ConfigForm    from '../../components/config/ConfigForm'

/* ── Default config ──────────────────────────────────────────────────────── */
const emptyConfig = (): ProjectConfig => ({
  model: '',
  llm_url: '',
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
    stdout_preview_limit: 200000,
    target_coverage: 80,
  },
  claude_md: { enabled: true, model: '', memory_model: '' },
  git: { enabled: false },
  execution_context_max_turns: 10,
  execution_context_content_limit: 500,
})

/**
 * Build project default config from the full GlobalConfig.
 * All nested fields (git, claude_md, models, execution_context_*, validation)
 * are inherited directly from global so "Reset to system defaults" truly
 * reflects what the admin has configured system-wide.
 */
function buildDefaultsFromGlobal(global: GlobalConfig): ProjectConfig {
  return {
    model:       global.model ?? '',
    llm_url:     global.llm_url ?? '',
    temperature: 0.7,
    max_tokens:  4096,
    timeout:     300,
    file_limit:  global.file_limit ?? 30,
    architect_prompt: global.architect_prompt ?? '',
    engineer_prompt:  global.engineer_prompt  ?? '',
    models: global.models ?? {},
    validation: {
      validate_after_run:   global.validation?.validate_after_run   ?? false,
      max_fix_rounds:       global.validation?.max_fix_rounds       ?? 3,
      model:                global.validation?.model                ?? '',
      step_filter:          global.validation?.step_filter          ?? null,
      stdout_preview_limit: global.validation?.stdout_preview_limit ?? 200000,
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

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function ProjectConfigPage() {
  const { solutionId, projectId } = useParams<{ solutionId: string; projectId: string }>()
  const navigate  = useNavigate()
  const isAdmin   = useAuthStore((s) => s.isAdmin())

  const [config,       setConfig]       = useState<ProjectConfig>(emptyConfig())
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [isDefault,    setIsDefault]    = useState(false)
  const [projectName,  setProjectName]  = useState('')

  const sid = solutionId!
  const pid = projectId!

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await projectsApi.getConfig(sid, pid)
        setProjectName(res.project_name)
        const merged = { ...emptyConfig(), ...res.config }
        setConfig(merged)
        setIsDefault(false)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        const code   = (err as { response?: { data?: { error?: string } } })?.response?.data?.error

        if (code === 'config_not_found' || status === 404) {
          try {
            const global = await configApi.get()
            const defaults = buildDefaultsFromGlobal(global)
            setConfig(defaults)
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
      const global = await configApi.get()
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
          { label: projectName || pid.slice(0, 8), to: `/solutions/${sid}` },
          { label: projectName, to: `/solutions/${sid}/projects/${pid}` },
          { label: '项目配置' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>取消</Button>
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
        />
      </div>

      {/* Footer actions */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-600">
          ⓘ 系统默认由管理员在 /admin/config 中设置；此处覆盖仅影响当前 Project。
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setResetConfirm(true)}>
              重置为系统默认
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>取消</Button>
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
