import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { configApi } from '../../api/config'
import type { GlobalConfig } from '../../api/types'
import Button from '../../components/ui/Button'

/* ── Field wrapper ───────────────────────────────────────────────────────── */

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] items-start gap-4 py-3 border-b border-border/50 last:border-0">
      <div className="pt-1.5">
        <p className="text-sm text-gray-300">{label}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { masked?: boolean }) {
  const { masked, ...rest } = props
  const [show, setShow] = useState(false)
  if (masked) {
    return (
      <div className="flex items-center gap-2">
        <input
          {...rest}
          type={show ? 'text' : 'password'}
          className="flex-1 max-w-md bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 font-mono"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
        >
          {show ? '隐藏' : '显示'}
        </button>
      </div>
    )
  }
  return (
    <input
      {...rest}
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
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-surface-4'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

/* ── Read-only fields that must NOT be sent back to the server ───────────── */
const READ_ONLY_FIELDS = ['config_file_path'] as const

/**
 * Strip read-only fields before sending to PUT /config/ or POST /config/validate.
 * The server only accepts:
 *   model, api_key, file_limit, work_dir, claude_alias, models,
 *   validation, architect_prompt, engineer_prompt
 */
function sanitizeConfigPayload(config: Partial<GlobalConfig>): Partial<GlobalConfig> {
  const payload = { ...config }
  for (const field of READ_ONLY_FIELDS) {
    delete (payload as Record<string, unknown>)[field]
  }
  return payload
}

/* ── S4C info panel ──────────────────────────────────────────────────────── */

function S4CPanel() {
  const [data,    setData]    = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    configApi.getS4C()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="h-20 bg-surface-2 animate-pulse rounded-lg" />
  if (!data)   return null

  const rows: [string, string][] = [
    ['数据库',          String(data.database_url ?? '').replace(/:[^:@]+@/, ':***@')],
    ['工作区目录',      String(data.solution_dir ?? '')],
    ['锁超时（秒）',    String(data.lock_timeout ?? '')],
    ['心跳间隔（秒）',  String(data.heartbeat_interval ?? '')],
    ['编排最大项目数',  String(data.orchestrator_max_projects ?? '')],
    ['数据库状态',      String(data.db_status ?? '')],
  ]

  return (
    <div className="bg-surface-2 border border-border rounded-lg overflow-hidden">
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-start gap-4 px-4 py-2.5 border-b border-border/50 last:border-0">
          <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
          <span className="text-xs font-mono text-gray-300 break-all">{val}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Validate banner ─────────────────────────────────────────────────────── */

function ValidateBanner({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2.5 text-xs text-green-400">
        <span>✓</span> 配置验证通过
      </div>
    )
  }
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs text-red-400">
      <p className="font-medium mb-1">验证失败：</p>
      <ul className="space-y-0.5 list-disc list-inside">
        {errors.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  )
}

/* ── Alias selector ──────────────────────────────────────────────────────── */

function AliasSelector({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [aliases,  setAliases]  = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    configApi.getAliases()
      .then((d) => setAliases(d.aliases))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="w-40 h-8 bg-surface-2 animate-pulse rounded-lg" />

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
    >
      {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

type Tab = 'general' | 's4c'

export default function ConfigPage() {
  const [config,    setConfig]    = useState<Partial<GlobalConfig>>({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [validating, setValidating] = useState(false)
  const [tab,       setTab]       = useState<Tab>('general')
  const [validateResult, setValidateResult] = useState<{ shown: boolean; errors: string[] } | null>(null)

  useEffect(() => {
    configApi.get()
      .then(setConfig)
      .catch(() => toast.error('加载配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Strip read-only fields before sending
      await configApi.update(sanitizeConfigPayload(config) as GlobalConfig)
      toast.success('配置已保存')
      setValidateResult(null)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    try {
      // Strip read-only fields before sending
      const res = await configApi.validate(sanitizeConfigPayload(config) as GlobalConfig)
      setValidateResult({ shown: true, errors: res.errors })
    } catch {
      toast.error('验证请求失败')
    } finally {
      setValidating(false)
    }
  }

  const set = <K extends keyof GlobalConfig>(key: K, val: GlobalConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: val }))

  const setValidationField = (key: string, val: unknown) =>
    setConfig((c) => ({
      ...c,
      validation: { ...(c.validation ?? {}), [key]: val },
    }))

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-surface-2 rounded animate-pulse" />
        <div className="h-96 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">系统配置</h1>
          <p className="text-xs text-gray-500 mt-0.5">全局 cio-agent 配置，影响所有 Project 的默认行为</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={validating} onClick={handleValidate}>
            验证配置
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>

      {/* Validate result */}
      {validateResult?.shown && (
        <div className="mb-4">
          <ValidateBanner errors={validateResult.errors} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-5 gap-1">
        {(
          [
            { key: 'general', label: '通用配置' },
            { key: 's4c',     label: 'Solution4CIO 信息' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 's4c' ? (
        <div>
          <p className="text-xs text-gray-500 mb-4">
            以下信息来自 solution4cio 运行时状态，只读。
          </p>
          <S4CPanel />
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-xl p-6">

          {/* LLM */}
          <Section title="LLM 设置" />
          <Field label="模型名称" hint="全局默认模型，Project 级配置可覆盖">
            <TextInput
              value={config.model ?? ''}
              onChange={(e) => set('model', e.target.value)}
              placeholder="GPT-4.1"
            />
          </Field>
          <Field label="Claude 模型别名" hint="使用预设别名快速切换模型">
            <AliasSelector
              value={config.claude_alias ?? 'default'}
              onChange={(v) => set('claude_alias', v)}
            />
          </Field>
          <Field label="API Key" hint="sk-*** 格式，保存时若传入掩码值则不更新">
            <TextInput
              value={config.api_key ?? ''}
              onChange={(e) => set('api_key', e.target.value)}
              placeholder="sk-…"
              masked
            />
          </Field>
          <Field label="工作区目录" hint="所有 Solution 代码的根目录">
            <TextInput
              value={config.work_dir ?? ''}
              onChange={(e) => set('work_dir', e.target.value)}
              placeholder="./workspace"
            />
          </Field>
          <Field label="文件上限" hint="单次工作流最多读取的文件数">
            <TextInput
              type="number"
              min={1} max={200}
              value={config.file_limit ?? 20}
              onChange={(e) => set('file_limit', parseInt(e.target.value))}
              className="!w-24"
            />
          </Field>

          {/* Validation */}
          <Section title="验证设置（全局默认）" />
          <Field label="自动验证" hint="Project 级可单独覆盖">
            <Toggle
              checked={config.validation?.validate_after_run ?? false}
              onChange={(v) => setValidationField('validate_after_run', v)}
              label="完成后自动验证代码"
            />
          </Field>
          <Field label="最大修复轮数">
            <TextInput
              type="number"
              min={0} max={20}
              value={config.validation?.max_fix_rounds ?? 3}
              onChange={(e) => setValidationField('max_fix_rounds', parseInt(e.target.value))}
              className="!w-24"
            />
          </Field>

          {/* Prompts */}
          <Section title="提示词覆盖（高级）" />
          <Field label="Architect 提示词" hint="留空则使用内置默认提示词">
            <textarea
              value={(config as Record<string, string>).architect_prompt ?? ''}
              onChange={(e) => set('architect_prompt' as keyof GlobalConfig, e.target.value as never)}
              rows={4}
              placeholder="可选：覆盖 Architect Agent 系统提示词"
              className="w-full max-w-lg bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono text-xs"
            />
          </Field>
          <Field label="Engineer 提示词" hint="留空则使用内置默认提示词">
            <textarea
              value={(config as Record<string, string>).engineer_prompt ?? ''}
              onChange={(e) => set('engineer_prompt' as keyof GlobalConfig, e.target.value as never)}
              rows={4}
              placeholder="可选：覆盖 Engineer Agent 系统提示词"
              className="w-full max-w-lg bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono text-xs"
            />
          </Field>
        </div>
      )}

      {/* Bottom save */}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" size="sm" loading={validating} onClick={handleValidate}>验证配置</Button>
        <Button variant="primary"   size="sm" loading={saving}     onClick={handleSave}>保存</Button>
      </div>
    </div>
  )
}
