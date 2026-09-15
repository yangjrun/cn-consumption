import { SocialInsuranceNotice, SocialInsurancePreview } from './SocialInsuranceEditor'
import { getFreedomDate, money } from '../lib/calculations'
import type { AnnualMonthlyPoint, AnnualTaxResult, AppModelV1, Page } from '../types'
import { Approx, ConfidenceMark } from './Marks'

interface AnnualDashboardProps {
  model: AppModelV1
  result: AnnualTaxResult
  onEdit: () => void
  onNavigate: (page: Page) => void
}

const monthSegments: Array<{ key: keyof Pick<AnnualMonthlyPoint, 'salaryIncomeTax' | 'embeddedTax' | 'bonusTax' | 'investmentTax' | 'assetTax'>; label: string; className: string }> = [
  { key: 'salaryIncomeTax', label: '工资个税', className: 'is-salary' },
  { key: 'embeddedTax', label: '消费内含税', className: 'is-embedded' },
  { key: 'bonusTax', label: '奖金个税', className: 'is-bonus' },
  { key: 'investmentTax', label: '投资税', className: 'is-investment' },
  { key: 'assetTax', label: '资产交易税', className: 'is-asset' }
]

function MonthLedgerChart({ schedule }: { schedule: AnnualMonthlyPoint[] }) {
  const max = Math.max(...schedule.map((point) => Math.max(0, point.total)), 1)
  const unique = new Set(schedule.map((point) => point.total.toFixed(2))).size
  const peak = schedule.reduce((best, point) => point.total > best.total ? point : best, schedule[0])
  const annual = schedule.reduce((sum, point) => sum + point.total, 0)
  const visibleSegments = monthSegments.filter((segment) => schedule.some((point) => Math.abs(Number(point[segment.key])) > 0.01))

  return (
    <div className="ledger-chart-block">
      {unique === 1 && <div className="uniform-note"><b>当前条件下月度金额确实相同</b><span>工资未跨税率档位，也没有一次性事件；这是计算结果，不是图表异常。</span></div>}
      <div className="ledger-chart" role="list" aria-label="逐月可识别税费">
        {schedule.map((point, index) => {
          const previous = schedule[index - 1]
          const changed = previous && Math.abs(point.salaryIncomeTax - previous.salaryIncomeTax) > .01
          const socialChanged = point.socialInsurance.changeReasons.length > 0
          return (
            <div className="ledger-month" key={point.month} role="listitem" aria-label={`${point.month} 月，可识别税费 ${money(point.total)}${socialChanged ? "，" + point.socialInsurance.changeReasons.join("；") : ""}`}>
              <div className="ledger-month__plot" title={`${point.month} 月 · ${money(point.total)}`}>
                {visibleSegments.map((segment) => {
                  const value = Math.max(0, Number(point[segment.key]))
                  return value > 0 ? <i key={segment.key} className={`ledger-segment ${segment.className}`} style={{ height: `${value / max * 100}%` }} /> : null
                })}
                {point.salaryIncomeTax < 0 && <span className="refund-mark" title="净预扣调整">退</span>}
              </div>
              <span>{point.month}</span>
              <div className="ledger-month__markers" aria-hidden="true">
                {changed && <i title="工资个税节奏变化" />}
                {socialChanged && <i className="is-social" title={point.socialInsurance.changeReasons.join("；")} />}
                {point.eventIds.length > 0 && <i className="is-event" title="一次性事件" />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="ledger-legend">{visibleSegments.map((segment) => <span key={segment.key}><i className={segment.className} />{segment.label}</span>)}<span><i className="is-social-marker" />社保基数／费率／固定金额变化</span><span><i className="is-event-marker" />一次性事件</span></div>
      <dl className="ledger-facts">
        <div><dt>1 月</dt><dd>{money(schedule[0].total)}</dd></div>
        <div><dt>12 月</dt><dd>{money(schedule[11].total)}</dd></div>
        <div><dt>最高月份</dt><dd>{peak.month} 月 · {money(peak.total)}</dd></div>
        <div><dt>全年合计</dt><dd>{money(annual)}</dd></div>
      </dl>
      <details className="ledger-table-toggle"><summary>展开 12 个月明细表</summary><div className="ledger-table-wrap"><table><thead><tr><th>月份</th><th>工资</th><th>个人社保（非税）</th><th>单位社保（非税）</th><th>工资个税</th><th>消费内含税</th><th>奖金税</th><th>投资税</th><th>资产税</th><th>合计</th></tr></thead><tbody>{schedule.map((point) => <tr key={point.month}><th>{point.month} 月</th><td>{money(point.grossSalary)}</td><td>{money(point.personalSocial, 2)}{!point.socialInsurance.complete && "（待校准）"}</td><td>{money(point.employerSocial, 2)}{!point.socialInsurance.complete && "（待校准）"}</td><td>{money(point.salaryIncomeTax)}</td><td>{money(point.embeddedTax)}</td><td>{money(point.bonusTax)}</td><td>{money(point.investmentTax)}</td><td>{money(point.assetTax)}</td><td>{money(point.total)}</td></tr>)}</tbody></table></div></details>
    </div>
  )
}

function HeadlineMetric({ label, value, tone, note, basis, approximate = false }: { label: string; value: number; tone?: string; note: string; basis: string; approximate?: boolean }) {
  return <article className={`headline-metric${tone ? ` is-${tone}` : ''}`}><span>{label}</span><strong>{approximate && <Approx />}{money(value)}</strong><small>{note}</small><details className="metric-basis"><summary>计算依据</summary><p>{basis}</p></details></article>
}

export function AnnualDashboard({ model, result, onEdit, onNavigate }: AnnualDashboardProps) {
  const contributions = result.personalSocial + result.housingFund
  const eventTotal = result.investmentTax + result.assetTransactionTax + result.eventEmbeddedTax
  const parts = [
    { label: '工资与奖金个税', value: result.incomeTax, className: 'is-tax' },
    { label: '固定消费内含税', value: result.recurringEmbeddedTax, className: 'is-embedded' },
    { label: '年度事件税费', value: eventTotal, className: 'is-event' }
  ]
  const maxPart = Math.max(...parts.map((part) => part.value), 1)
  const ranked = [...result.expenseTaxes].filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 6)
  const maxExpense = Math.max(...ranked.map((item) => item.total), 1)

  return (
    <div className="annual-dashboard">
      {model.status === 'sample' && <section className="sample-banner"><div><b>你正在查看示例年度</b><span>这些金额用于展示产品结构，不代表你的真实税费。</span></div><button className="primary-button" onClick={onEdit}>建立我的年度模型</button></section>}

      <header className="annual-hero">
        <div className="annual-hero__copy"><span className="kicker">{result.annualGross > 0 ? `${model.profile.year} · ${model.profile.city}` : '等待收入数据'}</span><h1>这一年的钱，<br />去了哪里。</h1><p>先看收入、直接税和社会缴费，再追踪每个月的税费节奏。一次性房车与投资事件会在确认后进入同一本年度账。</p><div><button className="primary-button" onClick={onEdit}>调整年度数据</button><button className="text-button" onClick={() => onNavigate('explore')}>加入一笔场景试算</button></div></div>
        <div className="annual-hero__answer"><span>可识别税费／现金收入</span><strong><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></strong><p>{result.estimateMode === 'conservative' ? '保守估计' : '中性估计'} · 不含社会缴费与扩展观察项</p><ConfidenceMark level={result.estimateMode === 'conservative' ? 'high' : 'model'} /></div>
      </header>

      <SocialInsuranceNotice value={result.socialInsurance} />
      <section className="headline-ledger" aria-label="年度核心结果">
        <HeadlineMetric label="工资与奖金" value={result.annualGross} note={`其他投资收入 ${money(result.otherIncome)}`} basis="12 个月工资输入之和，加全年一次性奖金。投资收入单独列示。" />
        <HeadlineMetric label="工资税后到手" value={result.employmentTakeHome} note="已扣个人所得税与个人缴费" basis="工资与奖金减个人所得税、个人社保和住房公积金。" />
        <HeadlineMetric label="个人所得税" value={result.incomeTax + result.investmentTax} tone="tax" note={`其中投资税 ${money(result.investmentTax)}`} basis="工资按累计预扣法；奖金按所选方式；投资事件按类型和持有期分别计算。" />
        <HeadlineMetric label="个人缴费（非税）" value={contributions} tone="social" note={`社保 ${money(result.personalSocial)} · 公积金 ${money(result.housingFund)}`} basis="汇总逐月各险种个人缴费及依法额外扣款，加住房公积金；医保个账内部划转不重复计入。不属于税。" />
        <HeadlineMetric label="消费价格内含税" value={result.recurringEmbeddedTax + result.eventEmbeddedTax} tone="estimate" note="固定消费与已加入事件" basis="按含税价格 × 税率 ÷（1＋税率）拆分，另加入能够从数量识别的消费税。" approximate />
        <HeadlineMetric label="全年可识别税费" value={result.identifiableTax} tone="tax" note={`已加入 ${model.events.length} 个年度事件`} basis="个人所得税、消费价格内含税及已确认资产/投资事件税费之和，不含社会缴费和扩展观察。" approximate />
      </section>

      <section className="dashboard-section dashboard-section--monthly">
        <div className="dashboard-section__head"><div><span className="kicker">先验证节奏</span><h2>12 个月，不再是同一个平均数。</h2></div><p>工资个税按累计预扣法；消费固定部分按月分布；奖金、投资和房车事件落在实际发生月份。</p></div>
        <MonthLedgerChart schedule={result.monthlySchedule} />
        {result.socialInsurance.months.some((month) => month.changeReasons.length > 0) && <ul className="social-month-changes">{result.socialInsurance.months.filter((month) => month.changeReasons.length).map((month) => <li key={month.month}><b>{month.month} 月</b>{month.changeReasons.join('；')}</li>)}</ul>}
        <details className="ledger-table-toggle"><summary>查看各险种缴费、个税扣除与来源</summary><SocialInsurancePreview value={result.socialInsurance} /></details>
      </section>

      <section className="dashboard-split">
        <article className="composition-ledger">
          <div className="dashboard-section__head"><div><span className="kicker">税费构成</span><h2>每一类都单独记账。</h2></div></div>
          <div className="composition-list">{parts.map((part) => <div key={part.label}><div><span>{part.label}</span><strong>{money(part.value)}</strong></div><i><b className={part.className} style={{ width: `${part.value / maxPart * 100}%` }} /></i></div>)}</div>
          <dl className="expanded-observation"><div><dt>单位缴费</dt><dd>{money(result.employerContributions)}</dd></div><div><dt>附加税费观察</dt><dd><Approx>{money(result.surchargeEstimate)}</Approx></dd></div><p>这些项目有助于理解企业成本和级联结构，但不并入“个人可识别税费”。</p></dl>
        </article>
        <article className="ranking-ledger">
          <div className="dashboard-section__head"><div><span className="kicker">固定消费</span><h2>哪些类别含税更多。</h2></div></div>
          {ranked.length ? <ol>{ranked.map((item, index) => <li key={item.key}><span>0{index + 1}</span><div><div><b>{item.label}</b><strong><Approx>{money(item.total)}</Approx></strong></div><i><b style={{ width: `${item.total / maxExpense * 100}%` }} /></i></div><ConfidenceMark level={item.confidence} compact /></li>)}</ol> : <div className="empty-ledger">尚未录入可计算的固定消费。</div>}
        </article>
      </section>

      <section className="method-boundary"><span>边界</span><div><h2>社会缴费不是税，价格内含税也不等于商家最终实缴税。</h2><p>模型只汇总能够从当前输入识别的直接税与价税部分。经营者进项抵扣、税收转嫁和无法确定的上游成本继续留在“扩展观察”，不制造虚假的精确。</p></div><div><b>{getFreedomDate(model.profile.year, result.freedomDay)}</b><small>可识别税负日 · 非官方指标</small></div></section>
    </div>
  )
}
