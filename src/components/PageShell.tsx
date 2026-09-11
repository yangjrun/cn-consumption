import type { ReactNode } from 'react'
import type { Page } from '../types'

/**
 * 页面阶段徽标。九个页面按「概览 → 场景 → 推演 → 依据 → 输出」组织，
 * 徽标把用户当前所处的位置显式写出来，避免在多页之间失去方向感。
 */
export interface PageStage {
  /** 两位序号，如 '02' */
  index: string
  /** 阶段名，如 '场景拆解' */
  label: string
}

export interface PageIntroProps {
  stage: PageStage
  title: ReactNode
  lead: ReactNode
  /** 右侧摘要区（可选）。有值时头部切换为左右分栏。 */
  aside?: ReactNode
  /** 标题下方的补充内容，如操作按钮或口径说明。 */
  children?: ReactNode
}

/**
 * 统一页面头部：阶段徽标 + 标题 + 导语（+ 可选右侧摘要）。
 * 取代此前页面各自实现的 page-intro / day-hero / life-hero 三套结构。
 */
export function PageIntro({ stage, title, lead, aside, children }: PageIntroProps) {
  return (
    <header className={`page-intro${aside ? ' page-intro--split' : ''}`}>
      <div className="page-intro__main">
        <span className="kicker page-stage">
          <b className="page-stage__index">{stage.index}</b>
          <span className="page-stage__label">{stage.label}</span>
        </span>
        <h1>{title}</h1>
        <p>{lead}</p>
        {children}
      </div>
      {aside ? <aside className="page-intro__aside">{aside}</aside> : null}
    </header>
  )
}

export interface NextStep {
  page: Page
  label: string
  hint: string
}

export interface PageFooterProps {
  current: Page
  steps: NextStep[]
  onNavigate: (page: Page) => void
  onEdit: () => void
}

/**
 * 统一页面收口。每个页面都以「下一步 + 调整数据 + 生成账单」结束，
 * 保证从入口到产出之间没有死胡同。
 */
export function PageFooter({ current, steps, onNavigate, onEdit }: PageFooterProps) {
  return (
    <nav className="page-footer" aria-label="继续探索">
      <div className="page-footer__lead">
        <span className="kicker">下一步</span>
        <p>换一个角度继续看，或把当前结果整理成可分享的账单。</p>
      </div>
      <div className="page-footer__steps">
        {steps.map((step) => (
          <button key={step.page} onClick={() => onNavigate(step.page)}>
            <b>{step.label}</b>
            <small>{step.hint}</small>
          </button>
        ))}
      </div>
      <div className="page-footer__actions">
        <button className="text-button" onClick={onEdit}>调整我的数据</button>
        {current === 'bill'
          ? <button className="text-button" onClick={() => onNavigate('rules')}>查看规则与来源</button>
          : <button className="primary-button" onClick={() => onNavigate('bill')}>生成年度账单</button>}
      </div>
    </nav>
  )
}
