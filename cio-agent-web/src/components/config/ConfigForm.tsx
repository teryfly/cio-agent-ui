/**
 * ConfigForm — 统一配置表单组件
 * 同时用于全局配置（GlobalConfig）和项目配置（ProjectConfig）
 * 完整覆盖 config.yaml 所有字段，包含 v2.3.0 新增的 programmer 字段
 */
import type {
  GlobalConfig,
  ProjectConfig,
  ModelOverrides,
  ValidationConfig,
  ClaudeMdConfig,
  GitConfig,
} from '../../api/types'
import {
  Section,
  Field,
  TextInput,
  Toggle,
  NumberInput,
  SelectInput,
  ModelsSection,
  ValidationSection,
  ClaudeMdSection,
  GitSection,
  ExecutionContextSection,
} from './ConfigFormFields'

// ─── Programmer 常量 ───────────────────────────────────────────────────────────

export const PROGRAMMER_OPTIONS = ['claude', 'qoder'] as const
export type ProgrammerOption = typeof PROGRAMMER_OPTIONS[number]

// ─── Claude alias 常量（前端维护，不依赖后端端点）────────────────────────────────

export const CLAUDE_ALIASES = [
  'default',
  'best',
  'sonnet',
  'opus',
  'haiku',
  'sonnet[1m]',
  'opus[1m]',
  'opusplan',
] as const

export type ClaudeAlias = typeof CLAUDE_ALIASES[number]

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
  aliases?: string[]
}

export type ConfigFormProps = ConfigFormGlobalProps | ConfigFormProjectProps

// ─── Programmer Radio Group ───────────────────────────────────────────────────

function ProgrammerRadio({
  value,
  onChange,
}: {
  value: ProgrammerOption
  onChange: (v: ProgrammerOption) => void
}) {
  const options: { val: ProgrammerOption; label: string; desc: string }[] = [
    {
      val: 'claude',
      label: 'Claude Code',
      desc: 'Anthropic Claude Code CLI（默认，推荐）',
    },
    {
      val: 'qoder',
      label: 'Qoder',
      desc: 'Qoder CLI（备选 Programmer）',
    },
  ]

  return (
    <div className="flex gap-3">
      {options.map(({ val, label, desc }) => (
        <label
          key={val}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-lg cursor-pointer border transition-colors flex-1 ${
            value === val
              ? 'border-brand-600/50 bg-brand-600/10'
              : 'border-border hover:bg-surface-3'
          }`}
        >
          <input
            type="radio"
            className="accent-brand-500 mt-0.5 shrink-0"
            checked={value === val}
            onChange={() => onChange(val)}
          />
          <div>
            <p className="text-sm font-medium text-gray-200">{label}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

// ─── 主表单 ───────────────────────────────────────────────────────────────────

export default function ConfigForm(props: ConfigFormProps) {
  const isGlobal = props.mode === 'global'

  const setField = <K extends string>(key: K, val: unknown) => {
    if (isGlobal) {
      props.onChange({ ...(props.config as Record<string, unknown>), [key]: val } as Partial<GlobalConfig>)
    } else {
      props.onChange({ ...(props.config as Record<string, unknown>), [key]: val } as ProjectConfig)
    }
  }

  const cfg      = props.config as Record<string, unknown>
  const aliases  = (CLAUDE_ALIASES as readonly string[])

  const validation = (cfg.validation as ValidationConfig | undefined) ?? {}
  const models     = (cfg.models as ModelOverrides | undefined)
  const claudeMd   = (cfg.claude_md as ClaudeMdConfig | undefined)
  const git        = (cfg.git as GitConfig | undefined)

  // programmer 字段：默认 'claude'
  const programmer = ((cfg.programmer as ProgrammerOption | undefined) ?? 'claude') as ProgrammerOption
  // claude_alias 仅在 programmer === 'claude' 时显示
  const showClaudeAlias = programmer === 'claude'

  return (
    <div className="space-y-1">

      {/* ── Programmer 选择 ────────────────────────────────────────────── */}
      <Section title="Programmer CLI" />

      <Field
        label="编程 CLI"
        hint="programmer — 执行代码生成所使用的 CLI 工具"
      >
        <ProgrammerRadio
          value={programmer}
          onChange={(v) => setField('programmer', v)}
        />
      </Field>

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

      {/* claude_alias — 仅在 programmer === 'claude' 时显示 */}
      {showClaudeAlias && (
        <Field
          label="Claude 模型别名"
          hint={isGlobal
            ? 'claude_alias — valid: default/best/sonnet/opus/haiku'
            : 'claude_alias — 留空则继承系统默认；valid: default/best/sonnet/opus/haiku'}
        >
          <SelectInput
            value={(cfg.claude_alias as string) ?? ''}
            onChange={(v) => setField('claude_alias', v)}
            options={[
              { val: '', label: isGlobal ? '（账号默认）' : '（继承系统默认）' },
              ...aliases.map((a) => ({ val: a, label: a })),
            ]}
          />
        </Field>
      )}

      {isGlobal && (
        <Field label="API Key" hint="sk-*** / glpat-*** 格式">
          <TextInput value={(cfg.api_key as string) ?? ''} onChange={(e) => setField('api_key', e.target.value)}
            placeholder="sk-…" masked />
        </Field>
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

      {isGlobal && (
        <Field label="工作区目录 (work_dir)" hint="AI 代码生成的根目录">
          <TextInput value={(cfg.work_dir as string) ?? ''} onChange={(e) => setField('work_dir', e.target.value)}
            placeholder="./workspace" />
        </Field>
      )}

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
        value={validation}
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
