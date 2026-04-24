/**
 * ConfigForm — 统一配置表单组件
 * 同时用于全局配置（GlobalConfig）和项目配置（ProjectConfig）
 * 完整覆盖 config.yaml 所有字段
 */
import { useState } from 'react'
import type {
  GlobalConfig,
  ProjectConfig,
  ModelOverrides,
  ValidationConfig,
  ClaudeMdConfig,
  GitConfig,
} from '../../api/types'

// ─── 共用 UI 原语 ─────────────────────────────────────────────────────────────

export function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 py-4 border-t border-border first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] items-start gap-4 py-2">
      <div className="pt-2">
        <p className="text-sm text-gray-300">{label}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { masked?: boolean; mono?: boolean }
) {
  const { masked, mono, className = '', ...rest } = props
  const [show, setShow] = useState(false)
  const base = `bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600
    focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 disabled:opacity-50
    ${mono ? 'font-mono' : ''} ${className}`

  if (masked) {
    return (
      <div className="flex items-center gap-2">
        <input {...rest} type={show ? 'text' : 'password'} className={`flex-1 max-w-md ${base}`} />
        <button type="button" onClick={() => setShow((s) => !s)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-xs shrink-0">
          {show ? '隐藏' : '显示'}
        </button>
      </div>
    )
  }
  return <input {...rest} className={`w-full max-w-md ${base}`} />
}

export function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-brand-600' : 'bg-surface-4'}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement> & { width?: string }) {
  const { width = '!w-28', className = '', ...rest } = props
  return (
    <input {...rest} type="number"
      className={`bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100
        focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50
        disabled:opacity-50 ${width} ${className}`} />
  )
}

function SelectInput({
  value, onChange, options, width = 'max-w-xs',
}: {
  value: string
  onChange: (v: string) => void
  options: { val: string; label: string }[]
  width?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`w-full ${width} bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500`}>
      {options.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
    </select>
  )
}

// ─── Validation Steps 定义（V0-V6）────────────────────────────────────────────

export const VALIDATION_STEPS = [
  {
    id:    'V0',
    label: 'V0 · PROJECT_DETECT',
    desc:  '检测语言、框架、测试工具、入口点（始终自动执行，不可跳过）',
    alwaysOn: true,
  },
  {
    id:    'V1',
    label: 'V1 · DEPENDENCY',
    desc:  '安装项目依赖',
    alwaysOn: false,
  },
  {
    id:    'V2',
    label: 'V2 · STATIC_ANALYSIS',
    desc:  'Linting / 类型检查',
    alwaysOn: false,
  },
  {
    id:    'V3',
    label: 'V3 · UNIT_TEST',
    desc:  '运行单测；覆盖率低于 target_coverage 时自动生成测试',
    alwaysOn: false,
  },
  {
    id:    'V4',
    label: 'V4 · BUILD_VERIFY',
    desc:  '构建 / 安装验证',
    alwaysOn: false,
  },
  {
    id:    'V5',
    label: 'V5 · SMOKE_TEST',
    desc:  '入口点冒烟测试',
    alwaysOn: false,
  },
  {
    id:    'V6',
    label: 'V6 · REPORT',
    desc:  '生成验证报告（有错误时生成；全部成功则进入 CI/CD 流程，不生成报告）',
    alwaysOn: false,
  },
] as const

// ─── Step Filter 勾选组件 ─────────────────────────────────────────────────────

export function StepFilterCheckboxes({
  value, onChange,
}: { value: string[] | null; onChange: (v: string[] | null) => void }) {
  const filterableIds = VALIDATION_STEPS.filter((s) => !s.alwaysOn).map((s) => s.id)
  const enabled       = value ?? filterableIds
  const isAll         = value === null

  const toggleAll = () => onChange(isAll ? [] : null)

  const toggleStep = (id: string) => {
    const next = new Set(enabled)
    if (next.has(id)) next.delete(id)
    else              next.add(id)
    const arr = filterableIds.filter((sid) => next.has(sid))
    onChange(arr.length === filterableIds.length ? null : arr)
  }

  return (
    <div className="space-y-1.5">
      {/* V0 — always on, non-interactive */}
      <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg border border-border/50 bg-surface-3/30 opacity-60">
        <input
          type="checkbox"
          className="accent-brand-500 w-3.5 h-3.5 mt-0.5 shrink-0"
          checked
          readOnly
          disabled
        />
        <div className="min-w-0">
          <span className="text-[11px] font-mono font-semibold text-gray-400">
            {VALIDATION_STEPS[0].label}
          </span>
          <span className="text-[10px] text-gray-600 ml-1.5">{VALIDATION_STEPS[0].desc}</span>
        </div>
      </div>

      {/* 全选 V1-V6 */}
      <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-brand-600/30 bg-brand-600/5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-brand-500 w-3.5 h-3.5"
          checked={isAll}
          onChange={toggleAll}
        />
        <span className="text-xs font-semibold text-brand-400">全部步骤（V1–V6）</span>
        <span className="text-[11px] text-gray-500">均运行</span>
      </label>

      {/* V1-V6 */}
      {VALIDATION_STEPS.filter((s) => !s.alwaysOn).map((step) => {
        const checked = enabled.includes(step.id)
        return (
          <label
            key={step.id}
            className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border cursor-pointer select-none transition-colors ${
              checked ? 'border-border bg-surface-3' : 'border-transparent opacity-50'
            }`}
          >
            <input
              type="checkbox"
              className="accent-brand-500 w-3.5 h-3.5 mt-0.5 shrink-0"
              checked={checked}
              onChange={() => toggleStep(step.id)}
            />
            <div className="min-w-0">
              <span className="text-[11px] font-mono font-semibold text-gray-200">{step.label}</span>
              <span className="text-[10px] text-gray-500 ml-1.5">{step.desc}</span>
            </div>
          </label>
        )
      })}
    </div>
  )
}

// ─── 折叠区域 ─────────────────────────────────────────────────────────────────

function Collapsible({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-lg overflow-hidden mt-3">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:bg-surface-3 transition-colors bg-surface-2">
        <span className="font-medium">{title}</span>
        <span className="text-xs transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && <div className="px-4 py-4 space-y-2 bg-surface-1">{children}</div>}
    </div>
  )
}

// ─── 子区域：Models ────────────────────────────────────────────────────────────

function ModelsSection({
  value, onChange,
}: { value: ModelOverrides | undefined; onChange: (v: ModelOverrides) => void }) {
  const m = value ?? {}
  const set = (k: keyof ModelOverrides, v: string) => onChange({ ...m, [k]: v })
  const fields: { key: keyof ModelOverrides; label: string }[] = [
    { key: 'cio_naming_model',   label: 'CIO Naming Model' },
    { key: 'cio_decision_model', label: 'CIO Decision Model' },
    { key: 'cio_executor_model', label: 'CIO Executor Model' },
    { key: 'architect_model',    label: 'Architect Model' },
    { key: 'engineer_model',     label: 'Engineer Model' },
    { key: 'documenter_model',   label: 'Documenter Model' },
  ]
  return (
    <Collapsible title="各角色模型覆盖 (models)">
      <p className="text-[11px] text-gray-500 mb-3">留空或填 "default" 则继承顶层 model 设置</p>
      <div className="grid grid-cols-1 gap-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[200px_1fr] items-center gap-3">
            <span className="text-xs text-gray-400 font-mono">{key}</span>
            <TextInput value={m[key] ?? ''} onChange={(e) => set(key, e.target.value)}
              placeholder="default" className="!max-w-sm text-xs" />
          </div>
        ))}
      </div>
    </Collapsible>
  )
}

// ─── 子区域：Validation ────────────────────────────────────────────────────────

function ValidationSection({
  value, onChange,
}: { value: ValidationConfig | undefined; onChange: (v: ValidationConfig) => void }) {
  const v = value ?? {}
  const set = (k: keyof ValidationConfig, val: unknown) => onChange({ ...v, [k]: val })

  return (
    <div className="space-y-2">
      <Field label="执行后自动验证" hint="validate_after_run">
        <Toggle checked={v.validate_after_run ?? false} onChange={(val) => set('validate_after_run', val)}
          label="完成后自动执行验证流程" />
      </Field>
      <Field label="最大修复轮数" hint="max_fix_rounds — 验证失败后 Claude Code 最多修复几轮">
        <NumberInput min={0} max={20} value={v.max_fix_rounds ?? 3}
          onChange={(e) => set('max_fix_rounds', parseInt(e.target.value))} width="!w-24" />
      </Field>
      <Field label="验证模型" hint="model — 留空或 default 继承顶层模型">
        <TextInput value={v.model ?? ''} onChange={(e) => set('model', e.target.value)}
          placeholder="default" className="!max-w-xs" />
      </Field>

      {/* ── step_filter：勾选形式 ──────────────────────────────────────── */}
      <Field
        label="验证步骤过滤 (step_filter)"
        hint="选择要执行的验证步骤；V0 始终执行不可跳过"
      >
        <StepFilterCheckboxes
          value={v.step_filter ?? null}
          onChange={(val) => set('step_filter', val)}
        />
      </Field>

      <Field label="stdout 预览限制" hint="stdout_preview_limit — CIO 决策时可见的 Claude Code 输出字符数">
        <div className="flex items-center gap-2">
          <NumberInput min={1000} max={2000000} value={v.stdout_preview_limit ?? 200000}
            onChange={(e) => set('stdout_preview_limit', parseInt(e.target.value))} width="!w-36" />
          <span className="text-xs text-gray-500">字符</span>
        </div>
      </Field>
      <Field label="最低覆盖率" hint="target_coverage — V3 单测需达到的最低行覆盖率 %（0-100）">
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} step={5}
            value={v.target_coverage ?? 80}
            onChange={(e) => set('target_coverage', parseInt(e.target.value))}
            className="w-36 accent-brand-500" />
          <NumberInput min={0} max={100}
            value={v.target_coverage ?? 80}
            onChange={(e) => set('target_coverage', parseInt(e.target.value))} width="!w-20" />
          <span className="text-xs text-gray-500">%</span>
        </div>
      </Field>
    </div>
  )
}

// ─── 子区域：Claude MD ─────────────────────────────────────────────────────────

function ClaudeMdSection({
  value, onChange,
}: { value: ClaudeMdConfig | undefined; onChange: (v: ClaudeMdConfig) => void }) {
  const c = value ?? {}
  const set = (k: keyof ClaudeMdConfig, val: unknown) => onChange({ ...c, [k]: val })
  return (
    <Collapsible title="CLAUDE.md 动态优化 (claude_md)">
      <div className="space-y-2">
        <Field label="启用 claude_md" hint="claude_md.enabled">
          <Toggle checked={c.enabled ?? true} onChange={(v) => set('enabled', v)}
            label="启用动态 CLAUDE.md 优化" />
        </Field>
        <Field label="优化模型" hint="claude_md.model — 用于生成/更新 CLAUDE.md 的模型">
          <TextInput value={c.model ?? ''} onChange={(e) => set('model', e.target.value)}
            placeholder="Claude-Sonnet-4.5" className="!max-w-xs" />
        </Field>
        <Field label="记忆模型" hint="claude_md.memory_model — ClaudeMemoryAgent 使用的模型">
          <TextInput value={c.memory_model ?? ''} onChange={(e) => set('memory_model', e.target.value)}
            placeholder="default" className="!max-w-xs" />
        </Field>
      </div>
    </Collapsible>
  )
}

// ─── 子区域：Git ───────────────────────────────────────────────────────────────

function GitSection({
  value, onChange,
}: { value: GitConfig | undefined; onChange: (v: GitConfig) => void }) {
  const g = value ?? {}
  const set = (k: keyof GitConfig, val: unknown) => onChange({ ...g, [k]: val })
  const setGitlab = (k: string, val: string) =>
    onChange({ ...g, gitlab: { ...(g.gitlab ?? {}), [k]: val } })
  const setUser = (k: string, val: string) =>
    onChange({ ...g, user: { ...(g.user ?? {}), [k]: val } })

  return (
    <Collapsible title="Git 集成 (git)">
      <div className="space-y-2">
        <Field label="启用 Git" hint="git.enabled">
          <Toggle checked={g.enabled ?? false} onChange={(v) => set('enabled', v)}
            label="启用 Git 集成" />
        </Field>
        {g.enabled && <>
          <Field label="提交者姓名" hint="git.user.name">
            <TextInput value={g.user?.name ?? ''} onChange={(e) => setUser('name', e.target.value)}
              placeholder="CIO-Agent" className="!max-w-xs" />
          </Field>
          <Field label="提交者邮箱" hint="git.user.email">
            <TextInput value={g.user?.email ?? ''} onChange={(e) => setUser('email', e.target.value)}
              placeholder="cio@noreply.local" className="!max-w-xs" />
          </Field>
          <Field label="推送策略" hint="git.push_strategy">
            <SelectInput value={g.push_strategy ?? 'never'}
              onChange={(v) => set('push_strategy', v)}
              options={[
                { val: 'never',       label: 'never — 仅本地提交（默认/最安全）' },
                { val: 'on_complete', label: 'on_complete — 工作流全部完成后推送一次' },
                { val: 'on_phase',    label: 'on_phase — 每个 Phase 提交后立即推送' },
                { val: 'manual',      label: 'manual — 永不自动推送' },
              ]} />
          </Field>
          <Field label="分支策略" hint="git.branch_strategy — 二次开发时的分支模式">
            <SelectInput value={g.branch_strategy ?? 'feature_branch'}
              onChange={(v) => set('branch_strategy', v)}
              options={[
                { val: 'feature_branch', label: 'feature_branch — 创建 cio/<slug>-<timestamp> 分支（推荐）' },
                { val: 'direct_main',    label: 'direct_main — 直接提交到当前分支（不推荐）' },
              ]} />
          </Field>
          <Field label="Feature 分支前缀" hint="git.feature_branch_prefix">
            <TextInput value={g.feature_branch_prefix ?? ''} onChange={(e) => set('feature_branch_prefix', e.target.value)}
              placeholder="cio" className="!max-w-xs" />
          </Field>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {([
              ['init_on_new_project', '新项目自动 git init'],
              ['commit_on_phase', 'Phase 完成后自动 commit'],
              ['tag_on_validate', '验证通过后自动打 tag'],
              ['gitignore_cio_logs', '自动忽略 cio 日志文件'],
            ] as [keyof GitConfig, string][]).map(([key, label]) => (
              <Toggle key={key} checked={(g[key] as boolean | undefined) ?? true}
                onChange={(v) => set(key, v)} label={label} />
            ))}
          </div>

          {/* GitLab */}
          <div className="mt-3 p-3 bg-surface-2 rounded-lg border border-border space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">GitLab 配置 (git.gitlab)</p>
            <Field label="Personal Access Token" hint="需要 api, write_repository 权限">
              <TextInput value={g.gitlab?.token ?? ''} onChange={(e) => setGitlab('token', e.target.value)}
                placeholder="glpat-…" masked className="!max-w-sm" />
            </Field>
            <Field label="GitLab 地址" hint="git.gitlab.base_url">
              <TextInput value={g.gitlab?.base_url ?? ''} onChange={(e) => setGitlab('base_url', e.target.value)}
                placeholder="https://gitlab.com" className="!max-w-sm" />
            </Field>
            <Field label="Namespace" hint="git.gitlab.namespace — 留空则从 token 自动解析">
              <TextInput value={g.gitlab?.namespace ?? ''} onChange={(e) => setGitlab('namespace', e.target.value)}
                placeholder="留空则自动解析" className="!max-w-sm" />
            </Field>
            <Field label="默认分支" hint="git.gitlab.branch">
              <TextInput value={g.gitlab?.branch ?? ''} onChange={(e) => setGitlab('branch', e.target.value)}
                placeholder="main" className="!max-w-xs" />
            </Field>
          </div>
        </>}
      </div>
    </Collapsible>
  )
}

// ─── 子区域：执行上下文压缩 ────────────────────────────────────────────────────

function ExecutionContextSection({
  maxTurns, maxTurnsOnChange,
  contentLimit, contentLimitOnChange,
}: {
  maxTurns: number | undefined; maxTurnsOnChange: (v: number) => void
  contentLimit: number | undefined; contentLimitOnChange: (v: number) => void
}) {
  return (
    <Collapsible title="执行上下文压缩（高级）">
      <p className="text-[11px] text-gray-500 mb-3">控制 Claude Code stdout 在传给 CIO 前的压缩行为</p>
      <div className="space-y-2">
        <Field label="最大保留轮数" hint="execution_context_max_turns — stream_json 格式时保留最近 N 个事件">
          <div className="flex items-center gap-2">
            <NumberInput min={1} max={100} value={maxTurns ?? 10}
              onChange={(e) => maxTurnsOnChange(parseInt(e.target.value))} width="!w-24" />
            <span className="text-xs text-gray-500">轮</span>
          </div>
        </Field>
        <Field label="内容字符限制" hint="execution_context_content_limit — 每个事件保留的最大字符数">
          <div className="flex items-center gap-2">
            <NumberInput min={100} max={10000} value={contentLimit ?? 500}
              onChange={(e) => contentLimitOnChange(parseInt(e.target.value))} width="!w-28" />
            <span className="text-xs text-gray-500">字符/事件</span>
          </div>
        </Field>
      </div>
    </Collapsible>
  )
}

// ─── 主组件 Props ──────────────────────────────────────────────────────────────

interface ConfigFormGlobalProps {
  mode: 'global'
  config: Partial<GlobalConfig>
  onChange: (c: Partial<GlobalConfig>) => void
  aliases?: string[]
}

interface ConfigFormProjectProps {
  mode: 'project'
  config: ProjectConfig
  onChange: (c: ProjectConfig) => void
  isDefault?: boolean
}

export type ConfigFormProps = ConfigFormGlobalProps | ConfigFormProjectProps

// ─── 主表单 ───────────────────────────────────────────────────────────────────

export default function ConfigForm(props: ConfigFormProps) {
  const isGlobal = props.mode === 'global'

  // Type-safe setters
  const setField = <K extends string>(key: K, val: unknown) => {
    if (isGlobal) {
      props.onChange({ ...(props.config as Record<string, unknown>), [key]: val } as Partial<GlobalConfig>)
    } else {
      props.onChange({ ...(props.config as Record<string, unknown>), [key]: val } as ProjectConfig)
    }
  }

  const cfg = props.config as Record<string, unknown>

  const validation = (cfg.validation as ReturnType<() => typeof cfg.validation>) ?? {}
  const models = (cfg.models as ModelOverrides | undefined)
  const claudeMd = (cfg.claude_md as ClaudeMdConfig | undefined)
  const git = (cfg.git as GitConfig | undefined)

  return (
    <div className="space-y-1">

      {/* ── LLM 基础设置 ──────────────────────────────────────────────────── */}
      <Section title="LLM 设置" />

      <Field label="模型名称" hint={isGlobal ? '全局默认模型 (model)' : '留空则继承系统默认 (model)'}>
        <TextInput value={(cfg.model as string) ?? ''} onChange={(e) => setField('model', e.target.value)}
          placeholder="GPT-4.1" />
      </Field>

      <Field label="LLM API 地址" hint="OpenAI 兼容接口 (llm_url)">
        <TextInput value={(cfg.llm_url as string) ?? ''} onChange={(e) => setField('llm_url', e.target.value)}
          placeholder="https://api.openai.com" />
      </Field>

      {isGlobal && (
        <>
          <Field label="API Key" hint="sk-*** / glpat-*** 格式">
            <TextInput value={(cfg.api_key as string) ?? ''} onChange={(e) => setField('api_key', e.target.value)}
              placeholder="sk-…" masked />
          </Field>
          <Field label="Claude 模型别名" hint="claude_alias — valid: default/best/sonnet/opus/haiku">
            <SelectInput
              value={(cfg.claude_alias as string) ?? ''}
              onChange={(v) => setField('claude_alias', v)}
              options={[
                { val: '',           label: '（账号默认）' },
                ...((props as ConfigFormGlobalProps).aliases ?? []).map((a) => ({ val: a, label: a })),
              ]}
            />
          </Field>
        </>
      )}

      {!isGlobal && (
        <>
          <Field label="温度 (temperature)" hint="0-1，值越高结果越随机">
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={1} step={0.05}
                value={(cfg.temperature as number) ?? 0.7}
                onChange={(e) => setField('temperature', parseFloat(e.target.value))}
                className="w-40 accent-brand-500" />
              <NumberInput min={0} max={1} step={0.05}
                value={(cfg.temperature as number) ?? 0.7}
                onChange={(e) => setField('temperature', parseFloat(e.target.value))} width="!w-20" />
            </div>
          </Field>
          <Field label="Max Tokens" hint="单次生成最大 token 数">
            <NumberInput min={1024} max={128000}
              value={(cfg.max_tokens as number) ?? 4096}
              onChange={(e) => setField('max_tokens', parseInt(e.target.value))} width="!w-32" />
          </Field>
          <Field label="超时（秒）" hint="单次 Claude Code 调用超时">
            <NumberInput min={30} max={3600}
              value={(cfg.timeout as number) ?? 300}
              onChange={(e) => setField('timeout', parseInt(e.target.value))} width="!w-28" />
          </Field>
        </>
      )}

      <Field label={isGlobal ? '工作区目录 (work_dir)' : '工作区目录覆盖'} hint="AI 代码生成的根目录">
        <TextInput value={(cfg.work_dir as string) ?? ''} onChange={(e) => setField('work_dir', e.target.value)}
          placeholder="./workspace" />
      </Field>

      <Field label="最大文件数 (file_limit)" hint="单次工作流最多读取的文件数量">
        <NumberInput min={1} max={500} value={(cfg.file_limit as number) ?? 30}
          onChange={(e) => setField('file_limit', parseInt(e.target.value))} width="!w-24" />
      </Field>

      {/* ── 各角色模型 ────────────────────────────────────────────────────── */}
      <Section title="角色模型" />
      <ModelsSection value={models} onChange={(v) => setField('models', v)} />

      {/* ── 提示词 ────────────────────────────────────────────────────────── */}
      <Section title="提示词覆盖（高级）" />

      <Field label="Architect 提示词" hint="architect_prompt — 留空或 default 使用内置">
        <textarea value={(cfg.architect_prompt as string) ?? ''}
          onChange={(e) => setField('architect_prompt', e.target.value)}
          rows={3} placeholder="default"
          className="w-full max-w-lg bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono text-xs" />
      </Field>

      <Field label="Engineer 提示词" hint="engineer_prompt — 留空或 default 使用内置">
        <textarea value={(cfg.engineer_prompt as string) ?? ''}
          onChange={(e) => setField('engineer_prompt', e.target.value)}
          rows={3} placeholder="default"
          className="w-full max-w-lg bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono text-xs" />
      </Field>

      {/* ── 验证设置 ──────────────────────────────────────────────────────── */}
      <Section title="验证设置 (validation)" />
      <ValidationSection
        value={validation as ValidationConfig}
        onChange={(v) => setField('validation', v)}
      />

      {/* ── claude_md ─────────────────────────────────────────────────────── */}
      <Section title="CLAUDE.md 优化" />
      <ClaudeMdSection value={claudeMd} onChange={(v) => setField('claude_md', v)} />

      {/* ── 执行上下文压缩 ────────────────────────────────────────────────── */}
      <Section title="执行上下文压缩" />
      <ExecutionContextSection
        maxTurns={(cfg.execution_context_max_turns as number | undefined)}
        maxTurnsOnChange={(v) => setField('execution_context_max_turns', v)}
        contentLimit={(cfg.execution_context_content_limit as number | undefined)}
        contentLimitOnChange={(v) => setField('execution_context_content_limit', v)}
      />

      {/* ── Git 集成 ──────────────────────────────────────────────────────── */}
      <Section title="Git 集成" />
      <GitSection value={git} onChange={(v) => setField('git', v)} />

    </div>
  )
}