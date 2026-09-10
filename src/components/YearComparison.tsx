import { useMemo } from 'react'
import { calculateProfile, money, vatFromGross } from '../lib/calculations'
import type { CalculatorProfile, ExpenseKey } from '../types'
import { Approx, ConfidenceMark } from './Marks'

const oldBrackets = [
  { ceiling: 1_500, rate: .03, deduction: 0 },
  { ceiling: 4_500, rate: .1, deduction: 105 },
  { ceiling: 9_000, rate: .2, deduction: 555 },
  { ceiling: 35_000, rate: .25, deduction: 1_005 },
  { ceiling: 55_000, rate: .3, deduction: 2_755 },
  { ceiling: 80_000, rate: .35, deduction: 5_505 },
  { ceiling: Infinity, rate: .45, deduction: 13_505 }
]

const goods17: ExpenseKey[] = ['clothing', 'electronics', 'fuel', 'tobacco', 'alcohol']
const reduced13: ExpenseKey[] = ['groceries', 'utilities']

export function YearComparison({ profile }: { profile: CalculatorProfile }) {
  const snapshots = useMemo(() => {
    const annualSocial = profile.socialInsuranceBase * 12 * (profile.pensionRate + profile.medicalRate + profile.unemploymentRate) + profile.housingFundBase * 12 * profile.housingFundRate
    const oldTaxableMonthly = Math.max(0, profile.monthlySalary - annualSocial / 12 - 3_500)
    const oldBracket = oldBrackets.find((item) => oldTaxableMonthly <= item.ceiling)!
    const tax2015 = Math.max(0, oldTaxableMonthly * oldBracket.rate - oldBracket.deduction) * 12
    const historicalVat2015 = Object.entries(profile.expenses).reduce((sum, [key, monthly]) => {
      const expenseKey = key as ExpenseKey
      const rate = goods17.includes(expenseKey) ? .17 : reduced13.includes(expenseKey) ? .13 : 0
      return sum + vatFromGross(monthly * 12, rate)
    }, 0)
    const tax2020 = calculateProfile({ ...profile, year: 2020, applyCitySocialBaseLimits: false }, 'neutral').incomeTax
    const currentTax = calculateProfile(profile, 'neutral').incomeTax
    const currentVat = Object.entries(profile.expenses).reduce((sum, [key, monthly]) => {
      const rates: Partial<Record<ExpenseKey, number>> = { dining: .06, groceries: .09, clothing: .13, electronics: .13, utilities: .09, telecom: .09, transport: .09, fuel: .13, travel: .06, entertainment: .06, tobacco: .13, alcohol: .13 }
      return sum + vatFromGross(monthly * 12, rates[key as ExpenseKey] ?? 0)
    }, 0)
    return [
      { year: 2015, iit: tax2015, vat: historicalVat2015, rate: 17, status: '部分可比', confidence: 'model' as const, note: '个税按每月 3,500 元减除费用；消费仅纳入可映射的 17%／13% 货物，未把营业税服务与现行增值税强行比较。' },
      { year: 2020, iit: tax2020, vat: currentVat, rate: 13, status: '高可比', confidence: 'high' as const, note: '按年度综合所得、所选奖金计税方式和 13%／9%／6% 三档增值税结构模拟。未回溯当年阶段性优惠。' },
      { year: 2026, iit: currentTax, vat: currentVat, rate: 13, status: '当前基线', confidence: 'high' as const, note: '按 2026 年增值税法、综合所得和所选全年一次性奖金计税方式模拟。' }
    ]
  }, [profile])
  const max = Math.max(...snapshots.map((item) => item.iit + item.vat), 1)

  return (
    <section className="year-compare">
      <div className="year-compare__head"><div><span className="kicker">历史规则快照</span><h2>同一份收入与消费，放进不同年份。</h2></div><p>只比较已建立可比映射的税制要素；币值、行为变化和全部历史优惠不在本图中。</p></div>
      <div className="year-cards">
        {snapshots.map((item) => <article key={item.year}><div className="year-card__top"><strong>{item.year}</strong><span>{item.status}</span></div><div className="year-bar"><i className="year-bar__iit" style={{ height: `${item.iit / max * 100}%` }} /><i className="year-bar__vat" style={{ height: `${item.vat / max * 100}%` }} /></div><div className="year-values"><span>个人所得税 <b>{money(item.iit)}</b></span><span>价税部分 <b><Approx>{money(item.vat)}</Approx></b></span></div><p>{item.note}</p><ConfidenceMark level={item.confidence} /></article>)}
        <article className="year-future"><div className="year-card__top"><strong>2030</strong><span>等待规则</span></div><div className="future-question">?</div><h3>不预测尚未发布的税率</h3><p>当官方规则公布并完成有效期核验后，2030 年才会进入可计算状态。</p><ConfidenceMark level="unknown" /></article>
      </div>
    </section>
  )
}
