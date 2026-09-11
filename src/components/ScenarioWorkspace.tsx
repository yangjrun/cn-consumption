import type { CalculatorProfile, Page, ScenarioSection } from '../types'
import { ComparePage } from './ComparePage'
import { LifecyclePage } from './LifecyclePage'

const sections: Array<{ id: ScenarioSection; label: string; hint: string }> = [
  { id: 'compare', label: '情景对比', hint: '两套年度条件并排核对' },
  { id: 'lifetime', label: '一生推演', hint: '把起始年度沿时间轴延伸' }
]

interface ScenarioWorkspaceProps {
  section: ScenarioSection
  profile: CalculatorProfile
  embeddedRate: number
  onSectionChange: (section: ScenarioSection) => void
  onUseScenario: (profile: CalculatorProfile, label: string) => void
  onNavigate: (page: Page) => void
}

export function ScenarioWorkspace({ section, profile, embeddedRate, onSectionChange, onUseScenario, onNavigate }: ScenarioWorkspaceProps) {
  return (
    <div className="workspace-page scenario-workspace">
      <header className="workspace-masthead"><div><span className="kicker">03 / 对比推演</span><h1>把当前年度当作基线，而不是孤岛。</h1><p>草稿会保留在当前会话中。你可以随时从最新年度数据重新同步，只有明确确认才会替换主模型。</p></div><button className="text-button" onClick={() => onNavigate('dashboard')}>返回我的年度</button></header>
      <nav className="workspace-tabs workspace-tabs--two" aria-label="对比推演分类">{sections.map((item) => <button key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => onSectionChange(item.id)} aria-current={section === item.id ? 'page' : undefined}><b>{item.label}</b><small>{item.hint}</small></button>)}</nav>
      <div className="workspace-panel" key={section}>
        {section === 'compare' && <ComparePage profile={profile} onUseScenario={onUseScenario} />}
        {section === 'lifetime' && <LifecyclePage profile={profile} embeddedRate={embeddedRate} onUseScenario={onUseScenario} />}
      </div>
    </div>
  )
}
