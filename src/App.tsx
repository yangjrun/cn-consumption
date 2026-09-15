import { useEffect, useMemo, useState } from 'react'
import { AnnualDashboard } from './components/AnnualDashboard'
import { AnnualReport } from './components/AnnualReport'
import { ConfirmChangeDialog } from './components/ConfirmChangeDialog'
import { ExploreWorkspace } from './components/ExploreWorkspace'
import { ModelEditor } from './components/ModelEditor'
import { RulesPage } from './components/RulesPage'
import { ScenarioWorkspace } from './components/ScenarioWorkspace'
import { defaultProfile } from './data/defaultProfile'
import { normalizeCalculatorProfile } from './lib/profileNormalization'
import {
  applyModelApplication,
  calculateAnnualModel,
  LEGACY_PROFILE_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  modelFromProfile,
  normalizeAnnualModel,
  profileFromModel,
  replaceModelProfile
} from './lib/annualModel'
import type {
  AppModelV1,
  CalculatorProfile,
  EstimateMode,
  ExploreSection,
  ModelApplication,
  Page,
  ScenarioSection
} from './types'

interface AppRoute {
  page: Page
  exploreSection: ExploreSection
  scenarioSection: ScenarioSection
}

interface PendingChange {
  title: string
  description: string
  nextModel: AppModelV1
  duplicate: boolean
}

const pageItems: Array<{ page: Page; label: string; index: string }> = [
  { page: 'dashboard', label: '我的年度', index: '01' },
  { page: 'explore', label: '场景试算', index: '02' },
  { page: 'scenarios', label: '对比推演', index: '03' },
  { page: 'bill', label: '年度报告', index: '04' },
  { page: 'rules', label: '规则与来源', index: '05' }
]


function readInitialModel() {
  try {
    const params = new URLSearchParams(window.location.search)
    const sharedModel = params.get('model')
    if (sharedModel) return { model: normalizeAnnualModel(JSON.parse(sharedModel), defaultProfile), explicit: true }
    const sharedProfile = params.get('profile')
    if (sharedProfile) return { model: modelFromProfile(normalizeCalculatorProfile(JSON.parse(sharedProfile), defaultProfile)), explicit: true }
    const savedModel = localStorage.getItem(MODEL_STORAGE_KEY)
    if (savedModel) return { model: normalizeAnnualModel(JSON.parse(savedModel), defaultProfile), explicit: true }
    const legacyProfile = localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY)
    if (legacyProfile) return { model: modelFromProfile(normalizeCalculatorProfile(JSON.parse(legacyProfile), defaultProfile)), explicit: true }
  } catch {
    // Damaged local/share data falls through to a clearly marked sample model.
  }
  return { model: modelFromProfile(defaultProfile, 'sample'), explicit: false }
}

function readRoute(): AppRoute {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const section = params.get('section')
  const exploreSection: ExploreSection = section === 'day' || section === 'assets' || section === 'investment' || section === 'transaction' ? section : 'transaction'
  const scenarioSection: ScenarioSection = section === 'lifetime' || section === 'compare' ? section : 'compare'
  if (view === 'lab') return { page: 'explore', exploreSection: 'transaction', scenarioSection }
  if (view === 'day' || view === 'assets' || view === 'investment') return { page: 'explore', exploreSection: view, scenarioSection }
  if (view === 'life') return { page: 'scenarios', exploreSection, scenarioSection: 'lifetime' }
  if (view === 'compare') return { page: 'scenarios', exploreSection, scenarioSection: 'compare' }
  if (view === 'explore') return { page: 'explore', exploreSection, scenarioSection }
  if (view === 'scenarios') return { page: 'scenarios', exploreSection, scenarioSection }
  if (view === 'bill' || view === 'rules' || view === 'dashboard') return { page: view, exploreSection, scenarioSection }
  return { page: 'dashboard', exploreSection, scenarioSection }
}

function routeUrl(route: AppRoute) {
  const url = new URL(window.location.href)
  url.searchParams.set('view', route.page)
  if (route.page === 'explore') url.searchParams.set('section', route.exploreSection)
  else if (route.page === 'scenarios') url.searchParams.set('section', route.scenarioSection)
  else url.searchParams.delete('section')
  return url
}

const initial = readInitialModel()

export default function App() {
  const [model, setModel] = useState<AppModelV1>(initial.model)
  const [route, setRoute] = useState<AppRoute>(readRoute)
  const [estimateMode, setEstimateMode] = useState<EstimateMode>(() => {
    try { return localStorage.getItem('taxlens.estimate-mode') === 'conservative' ? 'conservative' : 'central' } catch { return 'central' }
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('taxlens.theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const [editorOpen, setEditorOpen] = useState(!initial.explicit)
  const [onboarding, setOnboarding] = useState(!initial.explicit)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [undoModel, setUndoModel] = useState<AppModelV1 | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'too-long' | 'error'>('idle')
  const result = useMemo(() => calculateAnnualModel(model, estimateMode), [estimateMode, model])
  const profile = useMemo(() => profileFromModel(model), [model])

  useEffect(() => {
    try { localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(model)) } catch { /* local persistence is best effort */ }
  }, [model])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('taxlens.theme', theme) } catch { /* theme remains usable */ }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('taxlens.estimate-mode', estimateMode) } catch { /* mode remains usable */ }
  }, [estimateMode])

  useEffect(() => {
    const onPopState = () => setRoute(readRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const normalized = routeUrl(route)
    if (normalized.toString() !== window.location.href) window.history.replaceState({}, '', normalized)
    // Only normalize legacy links on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = (page: Page, options?: { exploreSection?: ExploreSection; scenarioSection?: ScenarioSection }) => {
    const next: AppRoute = {
      page,
      exploreSection: options?.exploreSection ?? route.exploreSection,
      scenarioSection: options?.scenarioSection ?? route.scenarioSection
    }
    setRoute(next)
    window.history.pushState({}, '', routeUrl(next))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveModel = (next: AppModelV1) => {
    setUndoModel(model)
    setModel(next)
    setOnboarding(false)
    setToast('年度模型已保存，所有页面已重新计算。')
  }

  const queueApplication = (application: ModelApplication) => {
    const duplicate = model.appliedFingerprints.includes(application.fingerprint)
    const nextModel = duplicate ? model : applyModelApplication(model, application)
    setPending({ title: application.title, description: application.description, nextModel, duplicate })
  }

  const queueProfileReplacement = (nextProfile: CalculatorProfile, label: string) => {
    setPending({
      title: label,
      description: '12 个月工资会按该情景的月薪重新填充；已确认加入的一次性事件继续保留。',
      nextModel: replaceModelProfile(model, nextProfile),
      duplicate: false
    })
  }

  const confirmPending = () => {
    if (!pending || pending.duplicate) return
    setUndoModel(model)
    setModel(pending.nextModel)
    setPending(null)
    setToast('已写入年度模型，可在提示中撤销。')
  }

  const undo = () => {
    if (!undoModel) return
    setModel(undoModel)
    setUndoModel(null)
    setToast('已撤销上一次年度模型变更。')
  }

  const copyShareLink = async () => {
    const url = routeUrl(route)
    url.searchParams.delete('profile')
    url.searchParams.set('model', JSON.stringify(model))
    if (url.toString().length > 8_000) {
      setShareState('too-long')
      return
    }
    try {
      await navigator.clipboard.writeText(url.toString())
      setShareState('copied')
    } catch { setShareState('error') }
  }

  const nextAction = route.page === 'dashboard'
    ? { label: '进入场景试算', note: '加入房车、投资或一笔消费', action: () => navigate('explore') }
    : route.page === 'explore'
      ? { label: '查看年度变化', note: '回到月度节奏核对刚才的写入', action: () => navigate('dashboard') }
      : route.page === 'scenarios'
        ? { label: '生成年度报告', note: '把当前模型整理成可分享账本', action: () => navigate('bill') }
        : route.page === 'bill'
          ? { label: '核对规则与来源', note: '追溯报告里的计算依据', action: () => navigate('rules') }
          : { label: '回到我的年度', note: '带着规则边界重新理解结果', action: () => navigate('dashboard') }

  return (
    <div className="app app-v1">
      <header className="app-header">
        <button className="wordmark" onClick={() => navigate('dashboard')} aria-label="税镜首页"><span className="wordmark__seal">税</span><span><b>税镜</b><small>个人年度税费账本</small></span></button>
        <nav className="primary-nav" aria-label="主导航">{pageItems.map((item) => <button key={item.page} className={route.page === item.page ? 'is-active' : ''} onClick={() => navigate(item.page)}><small>{item.index}</small><span>{item.label}</span></button>)}</nav>
        <div className="app-header__actions"><button className="text-button" onClick={() => { setShareState('idle'); setShareOpen(true) }}>分享</button><button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}>{theme === 'light' ? '暗' : '亮'}</button></div>
      </header>

      <section className="model-strip" aria-label="当前年度模型">
        <div><span className={`model-status is-${model.status}`}>{model.status === 'sample' ? '示例' : '我的模型'}</span><b>{model.profile.year} · {model.profile.city}</b><span>现金收入 {new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(result.annualCashIncome)}</span><span>年度事件 {model.events.length}</span><button onClick={() => { setOnboarding(false); setEditorOpen(true) }}>调整数据</button></div>
        <div className="estimate-switch" role="group" aria-label="估计口径"><span>估计口径</span><button className={estimateMode === 'conservative' ? 'is-active' : ''} onClick={() => setEstimateMode('conservative')} aria-pressed={estimateMode === 'conservative'}>保守</button><button className={estimateMode === 'central' ? 'is-active' : ''} onClick={() => setEstimateMode('central')} aria-pressed={estimateMode === 'central'}>中性</button></div>
      </section>

      <main className="app-main">
        {route.page === 'dashboard' && <AnnualDashboard model={model} result={result} onEdit={() => { setOnboarding(false); setEditorOpen(true) }} onNavigate={navigate} />}
        {route.page === 'explore' && <ExploreWorkspace section={route.exploreSection} profile={profile} onSectionChange={(section) => navigate('explore', { exploreSection: section })} onApply={queueApplication} onNavigate={navigate} />}
        {route.page === 'scenarios' && <ScenarioWorkspace section={route.scenarioSection} profile={profile} embeddedRate={result.annualSpending > 0 ? result.recurringEmbeddedTax / result.annualSpending : 0} onSectionChange={(section) => navigate('scenarios', { scenarioSection: section })} onUseScenario={queueProfileReplacement} onNavigate={navigate} />}
        {route.page === 'bill' && <AnnualReport model={model} result={result} onEdit={() => { setOnboarding(false); setEditorOpen(true) }} onNavigate={navigate} />}
        {route.page === 'rules' && <RulesPage />}
        <section className="journey-next"><div><span className="kicker">下一步</span><h2>{nextAction.label}</h2><p>{nextAction.note}</p></div><button className="primary-button" onClick={nextAction.action}>{nextAction.label}</button></section>
      </main>

      <footer className="app-footer"><div><span className="wordmark__seal">税</span><p><b>税镜 · 个人年度税费账本</b><br />在收入、消费与资产事件之间，保留每一个数字的边界。</p></div><p>本工具提供模拟估算，不构成税务、法律或投资建议。<br />所有个人数据只保存在当前浏览器。</p></footer>

      <ModelEditor model={model} open={editorOpen} onboarding={onboarding} onSave={saveModel} onClose={() => setEditorOpen(false)} onSkip={onboarding ? () => { setOnboarding(false); setEditorOpen(false); try { localStorage.setItem('taxlens.onboarding.dismissed', '1') } catch { /* optional */ } } : undefined} />
      {pending && <ConfirmChangeDialog title={pending.title} description={pending.description} current={result} next={calculateAnnualModel(pending.nextModel, estimateMode)} duplicate={pending.duplicate} onConfirm={confirmPending} onClose={() => setPending(null)} />}
      {toast && <div className="app-toast" role="status"><span>{toast}</span>{undoModel && <button onClick={undo}>撤销</button>}</div>}

      {shareOpen && <div className="share-layer"><button className="confirm-scrim" aria-label="关闭分享" onClick={() => setShareOpen(false)} /><section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title"><span className="kicker">分享年度模型</span><h2 id="share-title">链接会包含你填写的金额。</h2><p>链接数据不会上传到服务器，但任何获得链接的人都能读取其中的收入、消费和事件。若不适合分享原始数据，请前往年度报告导出 PNG 或 PDF。</p>{shareState === 'too-long' && <div className="share-message is-error">模型内容较多，链接可能无法可靠打开。请改用报告导出。</div>}{shareState === 'error' && <div className="share-message is-error">浏览器未允许复制，请改用报告导出。</div>}{shareState === 'copied' && <div className="share-message">链接已复制。</div>}<footer><button className="text-button" onClick={() => setShareOpen(false)}>取消</button><button className="text-button" onClick={() => { setShareOpen(false); navigate('bill') }}>改为导出报告</button><button className="primary-button" onClick={copyShareLink}>确认并复制链接</button></footer></section></div>}
    </div>
  )
}
