import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { projectsApi } from '../../api/projects'
import { configApi   } from '../../api/config'
import { useAuthStore } from '../../store/authStore'
import type { ProjectConfig } from '../../api/types'
import Button        from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PageHeader    from '../../components/ui/PageHeader'

/* ── Input wrappers ──────────────────────────────────────────────────────── */
function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-4">
      <div className="pt-2">
        <p className="text-sm text-gray-300">{label}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full max-w-md bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 disabled:opacity-50"
    />
  )
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-brand-600' : 'bg-surface-4'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

/* ── Section heading ─────────────────────────────────────────────────────── */
function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 py-4 border-t border-border first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

/* ── Default config ──────────────────────────────────────────────────────── */
const emptyConfig = (): ProjectConfig => ({
  model: '',
  llm_url: '',
  temperature: 0.7,
  max_tokens: 4096,
  timeout: 300,
  validation: { validate_after_run: false, max_fix_rounds: 3 },
  git: { enabled: false },
})

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function ProjectConfigPage() {
  const { solutionId, projectId } = useParams<{ solutionId: string; projectId: string }>()
  const navigate  = useNavigate()
  const isAdmin   = useAuthStore((s) => s.isAdmin())

  const [config,        setConfig]        = useState<ProjectConfig>(emptyConfig())
  const [original,      setOriginal]      = useState<ProjectConfig>(emptyConfig())
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [resetConfirm,  setResetConfirm]  = useState(false)
  const [resetLoading,  setResetLoading]  = useState(false)
  const [isDefault,     setIsDefault]     = useState(false)    // showing system defaults
  const [projectName,   setProjectName]   = useState('')

  const sid = solutionId!
  const pid = projectId!

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Try to load project config
        const res = await projectsApi.getConfig(sid, pid)
        setProjectName(res.project_name)
        const merged = { ...emptyConfig(), ...res.config }
        setConfig(merged)
        setOriginal(merged)
        setIsDefault(false)
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        if (code === 'config_not_found' || (err as { response?: { status?: number } })?.response?.status === 404) {
          // No config yet – fill with system defaults if admin
          if (isAdmin) {
            try {
              const global = await configApi.get()
              const filled: ProjectConfig = {
                model:       global.model,
                temperature: 0.7,
                max_tokens:  4096,
                timeout:     300,
                llm_url:     '',
                validation: {
                  validate_after_run: global.validation?.validate_after_run ?? false,
                  max_fix_rounds:     global.validation?.max_fix_rounds ?? 3,
                },
                git: { enabled: false },
              }
              setConfig(filled)
              setOriginal(emptyConfig())
              setIsDefault(true)
            } catch {
              setIsDefault(true)
            }
          } else {
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
  }, [sid, pid, isAdmin])

  const handleSave = async () => {
    setSaving(true)
    try {
      await projectsApi.patchConfig(sid, pid, config)
      toast.success('配置已保存')
      setOriginal(config)
      setIsDefault(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!isAdmin) return
    setResetLoading(true)
    try {
      const global = await configApi.get()
      const reset: ProjectConfig = {
        model:       global.model,
        temperature: 0.7,
        max_tokens:  4096,
        timeout:     300,
        llm_url:     '',
        validation: {
          validate_after_run: global.validation?.validate_after_run ?? false,
          max_fix_rounds:     global.validation?.max_fix_rounds ?? 3,
        },
        git: { enabled: false },
      }
      await projectsApi.patchConfig(sid, pid, reset)
      setConfig(reset)
      setOriginal(reset)
      setIsDefault(false)
      toast.success('已重置为系统默认')
    } catch {
      toast.error('重置失败')
    } finally {
      setResetLoading(false)
      setResetConfirm(false)
    }
  }

  const set = <K extends keyof ProjectConfig>(key: K, val: ProjectConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: val }))

  const setValidation = (key: string, val: unknown) =>
    setConfig((c) => ({
      ...c,
      validation: { ...c.validation, [key]: val },
    }))

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
          {isAdmin
            ? '当前未设置独立配置，显示的是系统默认值，保存后生效。'
            : '将使用系统默认配置，填写后可覆盖特定字段。'}
        </div>
      )}

      <div className="bg-surface-1 border border-border rounded-xl p-6 space-y-2">

        {/* LLM */}
        <Section title="LLM 设置" />
        <Field label="模型名称" hint="留空则继承系统默认">
          <TextInput
            value={config.model ?? ''}
            onChange={(e) => set('model', e.target.value)}
            placeholder="GPT-4.1"
          />
        </Field>
        <Field label="LLM API 地址" hint="OpenAI 兼容接口地址">
          <TextInput
            value={config.llm_url ?? ''}
            onChange={(e) => set('llm_url', e.target.value)}
            placeholder="https://api.openai.com"
          />
        </Field>
        <Field label="温度（0-1）" hint="值越高，生成内容越有创意">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={config.temperature ?? 0.7}
              onChange={(e) => set('temperature', parseFloat(e.target.value))}
              className="w-40 accent-brand-500"
            />
            <TextInput
              type="number"
              min={0} max={1} step={0.05}
              value={config.temperature ?? 0.7}
              onChange={(e) => set('temperature', parseFloat(e.target.value))}
              className="!w-20"
            />
          </div>
        </Field>
        <Field label="Max Tokens">
          <TextInput
            type="number"
            min={1024} max={128000}
            value={config.max_tokens ?? 4096}
            onChange={(e) => set('max_tokens', parseInt(e.target.value))}
            className="!w-32"
          />
        </Field>
        <Field label="超时（秒）">
          <TextInput
            type="number"
            min={30} max={3600}
            value={config.timeout ?? 300}
            onChange={(e) => set('timeout', parseInt(e.target.value))}
            className="!w-32"
          />
        </Field>

        {/* Validation */}
        <Section title="验证设置" />
        <Field label="自动验证">
          <Toggle
            checked={config.validation?.validate_after_run ?? false}
            onChange={(v) => setValidation('validate_after_run', v)}
            label="完成后自动验证代码（validate_after_run）"
          />
        </Field>
        <Field label="最大修复轮数">
          <TextInput
            type="number"
            min={0} max={20}
            value={config.validation?.max_fix_rounds ?? 3}
            onChange={(e) => setValidation('max_fix_rounds', parseInt(e.target.value))}
            className="!w-24"
          />
        </Field>

        {/* Git */}
        <Section title="Git 集成" />
        <Field label="启用 Git" hint="需在系统配置中提前配置 GitLab 信息">
          <Toggle
            checked={config.git?.enabled ?? false}
            onChange={(v) => setConfig((c) => ({ ...c, git: { ...c.git, enabled: v } }))}
            label="启用 Git 集成（git.enabled）"
          />
        </Field>
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
