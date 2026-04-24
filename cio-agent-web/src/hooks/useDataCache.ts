/**
 * useDataCache — 全局数据缓存 Hook
 * 在首次登录/刷新时预热 solution/project/knowledge 关系缓存到 localStorage
 * 提供快速读取和按需更新接口
 *
 * v2 新增：各页面专用缓存（solutions list、solution detail、project detail、knowledge list）
 * 统一策略：首次加载从 API 拉取写入缓存，下次从缓存读取，手动刷新图标触发强制更新。
 */
import { useCallback } from 'react'
import { solutionsApi } from '../api/solutions'
import { projectsApi  } from '../api/projects'
import { knowledgeApi } from '../api/knowledge'
import { runsApi      } from '../api/runs'
import { useAppStore  } from '../store/appStore'
import type {
  Solution, Project, KnowledgeDocument,
  SolutionDetail, RunSummary,
  UUID,
} from '../api/types'

// ─── TTL 常量 ────────────────────────────────────────────────────────────────

const CACHE_KEY   = 'cio_data_cache'
const CACHE_TTL   = 5 * 60 * 1000 // 5 minutes

// 各页面专用缓存 key 前缀
const SOLUTIONS_LIST_KEY    = 'cio_page_solutions_list'
const SOLUTION_DETAIL_KEY   = 'cio_page_solution_detail_'
const PROJECT_DETAIL_KEY    = 'cio_page_project_detail_'
const PROJECT_RUNS_KEY      = 'cio_page_project_runs_'
const KNOWLEDGE_LIST_KEY    = 'cio_page_knowledge_list'
const KNOWLEDGE_BINDING_KEY = 'cio_page_knowledge_bindings'

const PAGE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ─── 通用缓存工具 ─────────────────────────────────────────────────────────────

function readPageCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    if (Date.now() - ts > PAGE_CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writePageCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* localStorage 满时静默忽略 */ }
}

function clearPageCache(key: string) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ─── 主缓存（预热用，含 binding index） ───────────────────────────────────────

export interface CachedData {
  solutions:   Solution[]
  projectsMap: Record<UUID, Project[]>
  knowledgeDocs: KnowledgeDocument[]
  knowledgeBindings: Array<{
    docId: UUID
    scopeType: 'solution' | 'project'
    scopeId: UUID
    label: string
  }>
  updatedAt: number
}

function readCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data: CachedData = JSON.parse(raw)
    if (Date.now() - data.updatedAt > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data: Omit<CachedData, 'updatedAt'>) {
  try {
    const payload: CachedData = { ...data, updatedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch { /* ignore */ }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

async function fetchAndCache(): Promise<CachedData> {
  const { solutions } = await solutionsApi.list()

  const projectResults = await Promise.allSettled(
    solutions.map((sol) =>
      projectsApi.list(sol.id).then((r) => ({ id: sol.id, projects: r.projects }))
    )
  )
  const projectsMap: Record<UUID, Project[]> = {}
  for (const r of projectResults) {
    if (r.status === 'fulfilled') {
      projectsMap[r.value.id] = r.value.projects
    }
  }

  const { documents: knowledgeDocs } = await knowledgeApi.list()
  const knowledgeBindings: CachedData['knowledgeBindings'] = []

  await Promise.allSettled(
    solutions.map(async (sol) => {
      try {
        const { documents } = await knowledgeApi.listBySolution(sol.id)
        for (const doc of documents) {
          knowledgeBindings.push({
            docId: doc.id,
            scopeType: 'solution',
            scopeId: sol.id,
            label: `Solution: ${sol.name}`,
          })
        }
      } catch { /* ignore */ }
    })
  )

  await Promise.allSettled(
    solutions.flatMap((sol) =>
      (projectsMap[sol.id] ?? []).map(async (proj) => {
        try {
          const { documents } = await knowledgeApi.listByProject(sol.id, proj.id, false)
          for (const doc of documents) {
            knowledgeBindings.push({
              docId: doc.id,
              scopeType: 'project',
              scopeId: proj.id,
              label: `${sol.name} / ${proj.name}`,
            })
          }
        } catch { /* ignore */ }
      })
    )
  )

  const cached: CachedData = {
    solutions,
    projectsMap,
    knowledgeDocs,
    knowledgeBindings,
    updatedAt: Date.now(),
  }
  writeCache(cached)
  return cached
}

async function getCacheOrFetch(): Promise<CachedData> {
  const cached = readCache()
  if (cached) {
    fetchAndCache().catch(() => {})
    return cached
  }
  return fetchAndCache()
}

// ─── 页面级专用缓存接口 ───────────────────────────────────────────────────────

/** Solutions 列表页 */
export interface SolutionsListCache {
  solutions: Solution[]
  projectsMap: Record<UUID, Project[]>
}

/** Solution 详情页 */
export interface SolutionDetailCache {
  solution: SolutionDetail
  projects: Project[]
}

/** Project 详情页 */
export interface ProjectDetailCache {
  project: import('../api/types').Project
}

/** Project 运行记录缓存 */
export interface ProjectRunsCache {
  runs: RunSummary[]
}

/** Knowledge 列表页 */
export interface KnowledgeListCache {
  docs: KnowledgeDocument[]
}

/** Knowledge 绑定索引缓存（解析后的 bindingIndex） */
export interface KnowledgeBindingCache {
  /** docId -> { solutionIds, projectIds } 序列化存储 */
  index: Record<UUID, { solutionIds: UUID[]; projectIds: UUID[] }>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDataCache() {
  const { setSolutions, setProjects } = useAppStore()

  // ── 主预热 ────────────────────────────────────────────────────────────────

  const warmUp = useCallback(async () => {
    try {
      const data = await getCacheOrFetch()
      setSolutions(data.solutions)
      for (const [sid, projs] of Object.entries(data.projectsMap)) {
        setProjects(sid, projs)
      }
      return data
    } catch {
      return null
    }
  }, [setSolutions, setProjects])

  const invalidateAndRefresh = useCallback(async () => {
    clearCache()
    try {
      const data = await fetchAndCache()
      setSolutions(data.solutions)
      for (const [sid, projs] of Object.entries(data.projectsMap)) {
        setProjects(sid, projs)
      }
      return data
    } catch {
      return null
    }
  }, [setSolutions, setProjects])

  const getCache = useCallback((): CachedData | null => readCache(), [])

  const patchSolutions = useCallback((updater: (sols: Solution[]) => Solution[]) => {
    const cached = readCache()
    if (!cached) return
    writeCache({ ...cached, solutions: updater(cached.solutions) })
  }, [])

  const patchProjects = useCallback((solutionId: UUID, updater: (projs: Project[]) => Project[]) => {
    const cached = readCache()
    if (!cached) return
    writeCache({
      ...cached,
      projectsMap: {
        ...cached.projectsMap,
        [solutionId]: updater(cached.projectsMap[solutionId] ?? []),
      },
    })
  }, [])

  const patchKnowledge = useCallback((updater: (docs: KnowledgeDocument[]) => KnowledgeDocument[]) => {
    const cached = readCache()
    if (!cached) return
    writeCache({ ...cached, knowledgeDocs: updater(cached.knowledgeDocs) })
  }, [])

  // ── 页面级缓存：Solutions 列表 ────────────────────────────────────────────

  const getSolutionsListCache = useCallback((): SolutionsListCache | null => {
    return readPageCache<SolutionsListCache>(SOLUTIONS_LIST_KEY)
  }, [])

  const setSolutionsListCache = useCallback((data: SolutionsListCache) => {
    writePageCache(SOLUTIONS_LIST_KEY, data)
  }, [])

  const clearSolutionsListCache = useCallback(() => {
    clearPageCache(SOLUTIONS_LIST_KEY)
  }, [])

  // ── 页面级缓存：Solution 详情 ──────────────────────────────────────────────

  const getSolutionDetailCache = useCallback((sid: UUID): SolutionDetailCache | null => {
    return readPageCache<SolutionDetailCache>(`${SOLUTION_DETAIL_KEY}${sid}`)
  }, [])

  const setSolutionDetailCache = useCallback((sid: UUID, data: SolutionDetailCache) => {
    writePageCache(`${SOLUTION_DETAIL_KEY}${sid}`, data)
  }, [])

  const clearSolutionDetailCache = useCallback((sid: UUID) => {
    clearPageCache(`${SOLUTION_DETAIL_KEY}${sid}`)
  }, [])

  // ── 页面级缓存：Project 详情 ───────────────────────────────────────────────

  const getProjectDetailCache = useCallback((pid: UUID): ProjectDetailCache | null => {
    return readPageCache<ProjectDetailCache>(`${PROJECT_DETAIL_KEY}${pid}`)
  }, [])

  const setProjectDetailCache = useCallback((pid: UUID, data: ProjectDetailCache) => {
    writePageCache(`${PROJECT_DETAIL_KEY}${pid}`, data)
  }, [])

  const clearProjectDetailCache = useCallback((pid: UUID) => {
    clearPageCache(`${PROJECT_DETAIL_KEY}${pid}`)
  }, [])

  // ── 页面级缓存：Project Runs ───────────────────────────────────────────────

  const getProjectRunsCache = useCallback((pid: UUID, status: string): ProjectRunsCache | null => {
    return readPageCache<ProjectRunsCache>(`${PROJECT_RUNS_KEY}${pid}_${status}`)
  }, [])

  const setProjectRunsCache = useCallback((pid: UUID, status: string, data: ProjectRunsCache) => {
    writePageCache(`${PROJECT_RUNS_KEY}${pid}_${status}`, data)
  }, [])

  const clearProjectRunsCache = useCallback((pid: UUID) => {
    // Clear all status variants
    ;['all', 'running', 'success', 'failed'].forEach((s) =>
      clearPageCache(`${PROJECT_RUNS_KEY}${pid}_${s}`)
    )
  }, [])

  // ── 页面级缓存：Knowledge 文档列表 ────────────────────────────────────────

  const getKnowledgeListCache = useCallback((): KnowledgeListCache | null => {
    return readPageCache<KnowledgeListCache>(KNOWLEDGE_LIST_KEY)
  }, [])

  const setKnowledgeListCache = useCallback((data: KnowledgeListCache) => {
    writePageCache(KNOWLEDGE_LIST_KEY, data)
  }, [])

  const clearKnowledgeListCache = useCallback(() => {
    clearPageCache(KNOWLEDGE_LIST_KEY)
    clearPageCache(KNOWLEDGE_BINDING_KEY)
  }, [])

  // ── 页面级缓存：Knowledge Binding Index ──────────────────────────────────

  const getKnowledgeBindingCache = useCallback((): KnowledgeBindingCache | null => {
    return readPageCache<KnowledgeBindingCache>(KNOWLEDGE_BINDING_KEY)
  }, [])

  const setKnowledgeBindingCache = useCallback((data: KnowledgeBindingCache) => {
    writePageCache(KNOWLEDGE_BINDING_KEY, data)
  }, [])

  return {
    // 主预热
    warmUp,
    invalidateAndRefresh,
    getCache,
    patchSolutions,
    patchProjects,
    patchKnowledge,
    // Solutions 列表页
    getSolutionsListCache,
    setSolutionsListCache,
    clearSolutionsListCache,
    // Solution 详情页
    getSolutionDetailCache,
    setSolutionDetailCache,
    clearSolutionDetailCache,
    // Project 详情页
    getProjectDetailCache,
    setProjectDetailCache,
    clearProjectDetailCache,
    // Project Runs
    getProjectRunsCache,
    setProjectRunsCache,
    clearProjectRunsCache,
    // Knowledge 列表
    getKnowledgeListCache,
    setKnowledgeListCache,
    clearKnowledgeListCache,
    // Knowledge 绑定索引
    getKnowledgeBindingCache,
    setKnowledgeBindingCache,
  }
}
