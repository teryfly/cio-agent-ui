import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { configApi } from '../../api/config'
import type { GlobalConfig } from '../../api/types'
import Button from '../../components/ui/Button'
import ConfigForm from '../../components/config/ConfigForm'

/* ── Read-only fields that must NOT be sent back to the server ───────────── */
const READ_ONLY_FIELDS = ['config_file_path'] as const

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

/* ── Main Page ───────────────────────────────────────────────────────────── */

type Tab = 'general' | 's4c'

export default function ConfigPage() {
  const [config,      setConfig]      = useState<Partial<GlobalConfig>>({})
  const [aliases,     setAliases]     = useState<string[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [validating,  setValidating]  = useState(false)
  const [tab,         setTab]         = useState<Tab>('general')
  const [validateResult, setValidateResult] = useState<{ shown: boolean; errors: string[] } | null>(null)

  useEffect(() => {
    Promise.all([configApi.get(), configApi.getAliases()])
      .then(([cfg, al]) => {
        setConfig(cfg)
        setAliases(al.aliases)
      })
      .catch(() => toast.error('加载配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
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
      const res = await configApi.validate(sanitizeConfigPayload(config) as GlobalConfig)
      setValidateResult({ shown: true, errors: res.errors })
    } catch {
      toast.error('验证请求失败')
    } finally {
      setValidating(false)
    }
  }

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
        {([
          { key: 'general', label: '通用配置' },
          { key: 's4c',     label: 'Solution4CIO 信息' },
        ] as { key: Tab; label: string }[]).map((t) => (
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
          <p className="text-xs text-gray-500 mb-4">以下信息来自 solution4cio 运行时状态，只读。</p>
          <S4CPanel />
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-xl p-6">
          <ConfigForm
            mode="global"
            config={config}
            onChange={setConfig}
            aliases={aliases}
          />
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
