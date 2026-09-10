import { useEffect, useMemo, useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { BreakdownLab } from './components/BreakdownLab'
import { RulesPage } from './components/RulesPage'
import { ProfilePanel } from './components/ProfilePanel'
import { AssetsLab } from './components/AssetsLab'
import { DayPage } from './components/DayPage'
import { LifecyclePage } from './components/LifecyclePage'
import { BillPage } from './components/BillPage'
import { ComparePage } from './components/ComparePage'
import { InvestmentPage } from './components/InvestmentPage'
import { initialExpenses } from './data/expenseMeta'
import { calculateProfile } from './lib/calculations'
import type { CalculatorProfile, ViewMode } from './types'

type Page = 'dashboard' | 'lab' | 'assets' | 'day' | 'life' | 'investment' | 'compare' | 'bill' | 'rules'
type Density = 'story' | 'research' | 'bill'

const pages: Page[] = ['dashboard', 'lab', 'assets', 'day', 'life', 'investment', 'compare', 'bill', 'rules']

const defaultProfile: CalculatorProfile = {
  year: 2026,
  city: '上海',
  monthlySalary: 18_000,
  annualBonus: 0,
  annualBonusTaxMethod: 'optimal',
  specialDeductionMonthly: 2_000,
  socialInsuranceBase: 18_000,
  housingFundBase: 18_000,
  applyCitySocialBaseLimits: true,
  pensionRate: 0.08,
  medicalRate: 0.02,
  unemploymentRate: 0.005,
  housingFundRate: 0.07,
  employerPensionRate: 0.16,
  employerMedicalRate: 0.09,
  employerUnemploymentRate: 0.005,
  employerInjuryRate: 0.002,
  employerHousingFundRate: 0.07,
  fuelPrice: 8.1,
  expenses: initialExpenses
}

function getInitialProfile(): CalculatorProfile {
  try {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('profile')
    if (shared) return normalizeProfile(JSON.parse(shared))
    const saved = localStorage.getItem('taxlens.profile.v0')
    if (saved) {
      return normalizeProfile(JSON.parse(saved))
    }
  } catch {
    // Invalid shared or local data falls back to documented defaults.
  }
  return defaultProfile
}

function normalizeProfile(raw: Partial<CalculatorProfile>): CalculatorProfile {
  const salary = typeof raw.monthlySalary === 'number' ? raw.monthlySalary : defaultProfile.monthlySalary
  return {
    ...defaultProfile,
    ...raw,
    socialInsuranceBase: typeof raw.socialInsuranceBase === 'number' ? raw.socialInsuranceBase : salary,
    housingFundBase: typeof raw.housingFundBase === 'number' ? raw.housingFundBase : salary,
    annualBonusTaxMethod: raw.annualBonusTaxMethod === 'separate' || raw.annualBonusTaxMethod === 'comprehensive' || raw.annualBonusTaxMethod === 'optimal'
      ? raw.annualBonusTaxMethod
      : defaultProfile.annualBonusTaxMethod,
    applyCitySocialBaseLimits: typeof raw.applyCitySocialBaseLimits === 'boolean' ? raw.applyCitySocialBaseLimits : defaultProfile.applyCitySocialBaseLimits,
    employerPensionRate: typeof raw.employerPensionRate === 'number' ? raw.employerPensionRate : defaultProfile.employerPensionRate,
    employerMedicalRate: typeof raw.employerMedicalRate === 'number' ? raw.employerMedicalRate : defaultProfile.employerMedicalRate,
    employerUnemploymentRate: typeof raw.employerUnemploymentRate === 'number' ? raw.employerUnemploymentRate : defaultProfile.employerUnemploymentRate,
    employerInjuryRate: typeof raw.employerInjuryRate === 'number' ? raw.employerInjuryRate : defaultProfile.employerInjuryRate,
    employerHousingFundRate: typeof raw.employerHousingFundRate === 'number' ? raw.employerHousingFundRate : defaultProfile.employerHousingFundRate,
    expenses: { ...initialExpenses, ...raw.expenses }
  }
}

function getInitialPage(): Page {
  const page = new URLSearchParams(window.location.search).get('view') as Page | null
  return page && pages.includes(page) ? page : 'dashboard'
}

function getInitialTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem('taxlens.theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export default function App() {
  const [page, setPage] = useState<Page>(getInitialPage)
  const [profile, setProfile] = useState<CalculatorProfile>(getInitialProfile)
  const [mode, setMode] = useState<ViewMode>('neutral')
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [density, setDensity] = useState<Density>('research')
  const [panelOpen, setPanelOpen] = useState(false)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const result = useMemo(() => calculateProfile(profile, mode), [profile, mode])

  useEffect(() => {
    try { localStorage.setItem('taxlens.profile.v0', JSON.stringify(profile)) } catch { /* anonymous mode remains usable */ }
  }, [profile])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('taxlens.theme', theme) } catch { /* anonymous mode remains usable */ }
  }, [theme])

  const changePage = (next: Page) => {
    setPage(next)
    const url = new URL(window.location.href)
    url.searchParams.set('view', next)
    window.history.replaceState({}, '', url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const share = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('profile', JSON.stringify(profile))
    url.searchParams.set('view', page)
    try {
      await navigator.clipboard.writeText(url.toString())
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    } catch {
      window.history.replaceState({}, '', url)
      setShared(true)
    }
  }

  return (
    <div className={`app app--${density}`}>
      <header className="site-header">
        <button className="wordmark" onClick={() => changePage('dashboard')} aria-label="税镜首页">
          <span className="wordmark__seal">税</span><span><b>税镜</b><small>个人税费观察器</small></span>
        </button>
        <nav aria-label="主导航">
          <button className={page === 'dashboard' ? 'is-active' : ''} onClick={() => changePage('dashboard')}>年度账单</button>
          <button className={page === 'lab' ? 'is-active' : ''} onClick={() => changePage('lab')}>单笔拆解</button>
          <button className={page === 'assets' ? 'is-active' : ''} onClick={() => changePage('assets')}>房与车</button>
          <button className={page === 'day' ? 'is-active' : ''} onClick={() => changePage('day')}>一天</button>
          <button className={page === 'life' ? 'is-active' : ''} onClick={() => changePage('life')}>一生</button>
          <button className={page === 'investment' ? 'is-active' : ''} onClick={() => changePage('investment')}>投资</button>
          <button className={page === 'compare' ? 'is-active' : ''} onClick={() => changePage('compare')}>对比</button>
          <button className={page === 'bill' ? 'is-active' : ''} onClick={() => changePage('bill')}>账单</button>
          <button className={page === 'rules' ? 'is-active' : ''} onClick={() => changePage('rules')}>规则与来源</button>
        </nav>
        <div className="header-actions">
          <div className="mode-switch" aria-label="统计口径">
            {(['conservative', 'neutral', 'broad'] as ViewMode[]).map((item) => (
              <button key={item} className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>{item === 'conservative' ? '保守' : item === 'neutral' ? '中性' : '广义'}</button>
            ))}
          </div>
          <button className="text-button share-button" onClick={share}>{shared ? '链接已复制' : '分享结果'}</button>
          <button className="text-button bill-button" onClick={() => changePage('bill')}>生成账单</button>
          <button className="icon-button theme-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}><span aria-hidden="true">{theme === 'light' ? '暗' : '亮'}</span></button>
        </div>
      </header>

      <div className="scope-banner">
        <span>口径</span>
        <p><b>{mode === 'conservative' ? '保守模式' : mode === 'neutral' ? '中性模式' : '广义观察'}</b> · {mode === 'conservative' ? '只计入直接税和可可靠拆分的价格内含税。' : mode === 'neutral' ? '合理估算项以 ≈ 标记，暂不增加未经核验的上游税负。' : '展示企业用工成本等经济视角，但不计入“你交了多少税”。'}</p>
        <button onClick={() => changePage('rules')}>查看边界</button>
      </div>

      <main>
        {page === 'dashboard' && <Dashboard result={result} profile={profile} mode={mode} onEdit={() => setPanelOpen(true)} />}
        {page === 'lab' && <BreakdownLab />}
        {page === 'assets' && <AssetsLab />}
        {page === 'day' && <DayPage />}
        {page === 'life' && <LifecyclePage embeddedRate={result.annualSpending > 0 ? (result.vatEstimate + result.consumptionTaxEstimate) / result.annualSpending : 0} />}
        {page === 'investment' && <InvestmentPage />}
        {page === 'compare' && <ComparePage profile={profile} />}
        {page === 'bill' && <BillPage profile={profile} result={result} mode={mode} onEdit={() => setPanelOpen(true)} />}
        {page === 'rules' && <RulesPage />}
      </main>

      <footer className="site-footer">
        <div><span className="wordmark__seal">税</span><p><b>税镜 · 个人税费观察器</b><br />数据化理解普通居民在收入、消费与资产环节承担的税费。</p></div>
        <p>本工具提供模拟估算，不构成税务、法律或投资建议。<br />v0 数据核验日期：2026-09-10</p>
      </footer>

      <ProfilePanel profile={profile} onChange={setProfile} open={panelOpen} onClose={() => setPanelOpen(false)} />
      {panelOpen && <button className="panel-scrim" aria-label="关闭参数面板" onClick={() => setPanelOpen(false)} />}

      {!tweaksOpen ? (
        <button className="tweaks-trigger" onClick={() => setTweaksOpen(true)}>视图</button>
      ) : (
        <aside className="tweaks-panel" aria-label="视图调整">
          <div><b>Tweaks</b><button onClick={() => setTweaksOpen(false)}>关闭</button></div>
          <label><span>界面密度</span><select value={density} onChange={(event) => setDensity(event.target.value as Density)}><option value="story">讲解</option><option value="research">研究台</option><option value="bill">账单</option></select></label>
          <label className="toggle-row"><span>深色模式</span><input type="checkbox" checked={theme === 'dark'} onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')} /></label>
          <button className="print-button" onClick={() => window.print()}>打印／导出 PDF</button>
        </aside>
      )}
    </div>
  )
}
