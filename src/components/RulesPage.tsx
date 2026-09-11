import { useState } from 'react'
import taxRules from '../data/tax_rules.json'
import type { TaxRule } from '../types'
import { ConfidenceMark } from './Marks'
import { rulesForYear } from '../lib/rules'
import { PageIntro } from './PageShell'

export function RulesPage() {
  const rules = taxRules as TaxRule[]
  const [year, setYear] = useState(2026)
  const activeRules = rulesForYear(rules, year)
  return (
    <div className="rules-page">
      <PageIntro
        stage={{ index: '05', label: '规则依据' }}
        title="每一个数字，都应该能追溯。"
        lead="税率只采用财政部、国家税务总局、全国人大及政府官方网站。规则以生效区间组织，便于未来扩展年度对比。"
      />

      <section className="rules-summary">
        <div><strong>{rules.length}</strong><span>条已核验规则</span></div>
        <div><strong>{year}</strong><span>正在查看的制度年份</span></div>
        <div><strong>100%</strong><span>官方来源覆盖</span></div>
        <div><strong>2026.09.10</strong><span>最近核验</span></div>
      </section>

      <section className="rules-table-wrap">
        <div className="rules-table-title"><h2>tax_rules.json</h2><div className="rule-year-switch"><span>适用年份</span>{[2015, 2020, 2026].map((item) => <button key={item} className={year === item ? 'is-active' : ''} onClick={() => setYear(item)}>{item}</button>)}<button disabled title="2030 年规则尚未发布">2030?</button></div></div>
        <div className="rules-table" role="table" aria-label="税率规则表">
          <div className="rules-row rules-row--head" role="row"><span>税种与类别</span><span>计算方法</span><span>征税环节</span><span>有效期／来源</span></div>
          {activeRules.map((rule) => (
            <div className="rules-row" role="row" key={rule.id}>
              <div><strong>{rule.tax_name}</strong><span>{rule.category}</span><ConfidenceMark level={rule.confidence} /></div>
              <div><code>{rule.calculation_method}</code><small>计税依据：{rule.tax_base}</small></div>
              <div><strong>{rule.taxable_stage}</strong><small>法定纳税人：{rule.taxpayer}</small></div>
              <div><span>{rule.effective_from} — {rule.effective_to ?? '现行'}</span><a href={rule.source_url} target="_blank" rel="noreferrer">{rule.source_title} ↗</a><small>核验：{rule.last_verified}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="methodology-grid">
        <div className="methodology-title"><span className="kicker">方法论边界</span><h2>三条不能跨越的线</h2></div>
        <article><b>税与社会缴费分开</b><p>社保与住房公积金单列，不纳入“总可识别税费”。单位缴费也不倒推为个人直接税。</p></article>
        <article><b>税款与经济负担分开</b><p>法定纳税人负责申报；经济税负可能由消费者、员工和股东共同承担，零售价无法给出唯一答案。</p></article>
        <article><b>流转环节避免重复计算</b><p>进口税、零售增值税、消费税不能脱离各自税基直接相加。无法建立可靠抵扣链时只作知识展示。</p></article>
      </section>
    </div>
  )
}
