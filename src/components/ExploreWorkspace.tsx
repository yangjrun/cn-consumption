import type { CalculatorProfile, ExploreSection, ModelApplication, Page } from '../types'
import { AssetsLab } from './AssetsLab'
import { BreakdownLab } from './BreakdownLab'
import { DayPage } from './DayPage'
import { InvestmentPage } from './InvestmentPage'

const sections: Array<{ id: ExploreSection; label: string; hint: string }> = [
  { id: 'transaction', label: '单笔拆解', hint: '咖啡、手机、汽油与购车' },
  { id: 'day', label: '一天', hint: '把多笔消费放回时间线' },
  { id: 'assets', label: '房与车', hint: '一次性资产交易' },
  { id: 'investment', label: '投资', hint: '股息与股票转让' }
]

interface ExploreWorkspaceProps {
  section: ExploreSection
  profile: CalculatorProfile
  onSectionChange: (section: ExploreSection) => void
  onApply: (application: ModelApplication) => void
  onNavigate: (page: Page) => void
}

export function ExploreWorkspace({ section, profile, onSectionChange, onApply, onNavigate }: ExploreWorkspaceProps) {
  return (
    <div className="workspace-page explore-workspace">
      <header className="workspace-masthead"><div><span className="kicker">02 / 场景试算</span><h1>先试算，再决定是否写进年度。</h1><p>每个工具都是独立草稿。只有点击“应用到我的年度”并确认后，结果才会进入月度节奏和年度报告。</p></div><button className="text-button" onClick={() => onNavigate('dashboard')}>返回我的年度</button></header>
      <nav className="workspace-tabs" aria-label="场景试算分类">{sections.map((item) => <button key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => onSectionChange(item.id)} aria-current={section === item.id ? 'page' : undefined}><b>{item.label}</b><small>{item.hint}</small></button>)}</nav>
      <div className="workspace-panel" key={section}>
        {section === 'transaction' && <BreakdownLab cityTier={profile.cityTier} onApply={onApply} />}
        {section === 'day' && <DayPage onApply={onApply} />}
        {section === 'assets' && <AssetsLab onApply={onApply} />}
        {section === 'investment' && <InvestmentPage onApply={onApply} />}
      </div>
    </div>
  )
}
