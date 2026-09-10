import { FlowDiagram } from './FlowDiagram'
import { Approx, ConfidenceMark } from './Marks'
import { compactMoney, getFreedomDate, money } from '../lib/calculations'
import type { CalculatorProfile, TaxResult, ViewMode } from '../types'

const metricHelp = {
  income: '工资与奖金合计，不等同于企业实际用工成本。',
  takeHome: '税前收入扣除个人所得税、个人社保与住房公积金。',
  direct: '工资按年度综合所得计税；符合条件的全年一次性奖金按所选方式计算。',
  social: '个人养老、医疗、失业保险和住房公积金；它们不是税。',
  embedded: '消费含税价中按法定税率拆出的增值税，加能够从现有输入识别的选择性消费税。',
  total: '个人直接税与消费价格中可识别税收因素之和，不含社会缴费。'
}

function Metric({ label, value, tone, help, estimate, subline }: { label: string; value: number; tone?: string; help: string; estimate?: boolean; subline?: string }) {
  return (
    <article className={`metric ${tone ? `metric--${tone}` : ''}`} title={help}>
      <div className="metric__label"><span>{label}</span><span className="info-mark">i</span></div>
      <strong>{estimate && <span className="metric__approx">≈</span>}{money(value)}</strong>
      {subline && <small className="metric__subline">{subline}</small>}
    </article>
  )
}

function Donut({ result }: { result: TaxResult }) {
  const total = Math.max(1, result.identifiableTax)
  const income = result.incomeTax / total * 100
  const vat = result.vatEstimate / total * 100
  const fuel = result.consumptionTaxEstimate / total * 100
  const style = { '--income': `${income}%`, '--vat': `${income + vat}%`, '--fuel': `${income + vat + fuel}%` } as React.CSSProperties
  return (
    <div className="donut-block">
      <div className="donut" style={style}>
        <div><strong>{(result.burdenRatio * 100).toFixed(1)}%</strong><span>占税前收入</span></div>
      </div>
      <ul className="legend-list">
        <li><span className="legend-dot legend-dot--income" /><div><b>个人所得税</b><small>直接税</small></div><strong>{money(result.incomeTax)}</strong></li>
        <li><span className="legend-dot legend-dot--vat" /><div><b>增值税价税部分</b><small>价格内含税估算</small></div><strong><Approx>{money(result.vatEstimate)}</Approx></strong></li>
        <li><span className="legend-dot legend-dot--fuel" /><div><b>法定消费税（已识别）</b><small>当前仅按汽油升数估算</small></div><strong><Approx>{money(result.consumptionTaxEstimate)}</Approx></strong></li>
      </ul>
    </div>
  )
}

function MonthBars({ result }: { result: TaxResult }) {
  const averageVat = (result.vatEstimate + result.consumptionTaxEstimate) / 12
  const baseTax = result.salaryIncomeTax / 12
  const bonusTax = result.annualBonusIncomeTax
  const values = Array.from({ length: 12 }, (_, index) => baseTax + averageVat + (index === 11 ? bonusTax : 0))
  const max = Math.max(...values, 1)
  return (
    <div className="month-chart" role="list" aria-label="按月折算的可识别税费">
      {values.map((value, index) => {
        const month = index + 1
        const height = value > 0 ? Math.max(6, value / max * 88) : 0
        const isBonus = index === 11 && bonusTax > 0
        return (
          <div
            className="month-bar"
            key={month}
            role="listitem"
            aria-label={`${month} 月：${money(value)}`}
            title={`${month} 月：${money(value)}`}
          >
            <span className="month-bar__plot" aria-hidden="true">
              <i
                className={`month-bar__fill${isBonus ? ' is-bonus' : ''}${value <= 0 ? ' is-empty' : ''}`}
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="month-bar__label" aria-hidden="true">{month}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard({ result, profile, mode, onEdit }: { result: TaxResult; profile: CalculatorProfile; mode: ViewMode; onEdit: () => void }) {
  const ranked = [...result.expenseTaxes].filter((item) => item.spend > 0).sort((a, b) => b.total - a.total).slice(0, 5)
  const maxTax = Math.max(...ranked.map((item) => item.total), 1)

  return (
    <div className="dashboard-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="edition-line"><span>2026 个人税费观察</span><span>{profile.city}</span></div>
          <h1>你的工资条，<br />只告诉你看得见的税。</h1>
          <p>还有一些税，已经包含在你每天支付的价格里。我们把可识别的部分拆出来，也把不能确定的部分留白。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onEdit}>调整我的数据</button>
            <span><ConfidenceMark level="high" /> 当前结果基于 {profile.year} 年规则</span>
          </div>
        </div>
        <aside className="hero-statement">
          <span>你的可识别税负模拟</span>
          <strong><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></strong>
          <p>直接税 + 消费价格中可识别税收因素<br />÷ 年税前收入</p>
          <small>不含社保、公积金，也不代表宏观税负。</small>
        </aside>
      </section>

      <section className="metric-grid" aria-label="年度摘要">
        <Metric label="年税前收入" value={result.annualGross} help={metricHelp.income} />
        <Metric label="税后到手" value={result.takeHome} help={metricHelp.takeHome} />
        <Metric label="直接税" value={result.incomeTax} tone="tax" help={metricHelp.direct} subline={profile.annualBonus > 0 ? `奖金${result.effectiveAnnualBonusTaxMethod === 'separate' ? '单独计税' : '并入综合所得'}` : undefined} />
        <Metric label="个人缴费（非税）" value={result.personalSocial + result.housingFund} tone="social" help={metricHelp.social} subline={`社保 ${money(result.personalSocial)} · 公积金 ${money(result.housingFund)}`} />
        <Metric
          label="消费价格内含税估计"
          value={result.vatEstimate + result.consumptionTaxEstimate}
          tone="estimate"
          help={metricHelp.embedded}
          estimate
          subline={`${mode === 'conservative' ? `中性估计 ${money(result.centralEmbeddedTaxEstimate)}` : `保守口径 ${money(result.conservativeEmbeddedTaxEstimate)}`} · 建模覆盖 ${(result.consumptionSpendCoverage * 100).toFixed(0)}%`}
        />
        <Metric label="总可识别税费" value={result.identifiableTax} tone="tax" help={metricHelp.total} estimate />
      </section>
      {mode === 'broad' && (
        <section className="employer-ledger" aria-label="单位缴费与用工成本">
          <div><span>企业实际用工成本</span><strong>{money(result.employerCost)}</strong><small>税前工资 + 单位社保 + 单位公积金</small></div>
          <div><span>单位社会保险缴费</span><strong>{money(result.employerSocial)}</strong><small>不是个人直接税，也不从到手工资扣除</small></div>
          <div><span>单位住房公积金</span><strong>{money(result.employerHousingFund)}</strong><small>单独进入职工公积金账户</small></div>
        </section>
      )}

      <section className="section-block flow-section">
        <div className="section-heading">
          <div><span className="kicker">收入流向</span><h2>100 元收入旅行图</h2></div>
          <p>以税前收入为基准，先看工资阶段的分配，再看已录入消费中的价格内含税。</p>
        </div>
        <FlowDiagram result={result} />
      </section>

      <section className="analysis-grid">
        <article className="analysis-panel composition-panel">
          <div className="panel-heading"><div><span className="kicker">构成</span><h2>可识别税费</h2></div><ConfidenceMark level={mode === 'conservative' ? 'high' : 'model'} compact /></div>
          <Donut result={result} />
        </article>
        <article className="analysis-panel ranking-panel">
          <div className="panel-heading"><div><span className="kicker">消费</span><h2>哪些消费含税更多</h2></div><small>年估算</small></div>
          <ol className="rank-list">
            {ranked.map((item, index) => (
              <li key={item.key}>
                <span className="rank-index">0{index + 1}</span>
                <div><div className="rank-copy"><b>{item.label}</b><strong><Approx>{money(item.total)}</Approx></strong></div><div className="rank-track"><i style={{ width: `${item.total / maxTax * 100}%` }} /></div></div>
                <ConfidenceMark level={item.confidence} compact />
              </li>
            ))}
          </ol>
        </article>
        <article className="analysis-panel freedom-panel">
          <div className="panel-heading"><div><span className="kicker">模拟指标</span><h2>可识别税负日</h2></div><ConfidenceMark level="model" compact /></div>
          <div className="freedom-date"><strong>{getFreedomDate(profile.year, result.freedomDay)}</strong><span>全年第 {result.freedomDay} 天</span></div>
          <div className="calendar-track"><i style={{ width: `${result.freedomDay / 365 * 100}%` }} /><b style={{ left: `${result.freedomDay / 365 * 100}%` }} /></div>
          <div className="calendar-labels"><span>1 月 1 日</span><span>12 月 31 日</span></div>
          <p>把全年可识别税费与税前收入之比映射到 365 天。它不是官方指标，也不是“中国税收自由日”。</p>
        </article>
        <article className="analysis-panel monthly-panel">
          <div className="panel-heading"><div><span className="kicker">节奏</span><h2>12 个月税费折算</h2></div><small>12 月含奖金影响</small></div>
          <MonthBars result={result} />
          <p>工资个税与消费支出按月均摊；奖金税额集中显示在 12 月，仅用于观察节奏。</p>
        </article>
      </section>

      <section className="principle-note">
        <div className="principle-note__mark">≠</div>
        <div><h2>社会缴费不是税，价格内含税也不等于商家最终缴税。</h2><p>增值税估算是含税价格的理论价税拆分。企业实际应纳增值税还涉及进项抵扣；消费税的法定纳税人与经济承担者也可能不同。</p></div>
        <span>{compactMoney(result.personalSocial + result.housingFund)}<small>个人社保 {money(result.personalSocial)} · 个人公积金 {money(result.housingFund)}</small></span>
      </section>
    </div>
  )
}
