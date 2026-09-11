import { useEffect, useRef, useState } from 'react'
import { expenseMeta } from '../data/expenseMeta'
import type { CalculatorProfile, ExpenseKey } from '../types'
import { annualBonusCliffWarning, calculateProfile, money } from '../lib/calculations'

interface ProfilePanelProps {
  profile: CalculatorProfile
  onChange: (next: CalculatorProfile) => void
  open: boolean
  onClose: () => void
}

type PanelTab = 'income' | 'contribution' | 'spending' | 'employer'

const toNumber = (value: string) => Math.max(0, Number(value) || 0)

const panelTabs: Array<{ id: PanelTab; label: string; hint: string }> = [
  { id: 'income', label: '收入', hint: '工资、奖金与专项附加扣除' },
  { id: 'contribution', label: '缴费', hint: '社保与公积金基数、个人比例' },
  { id: 'spending', label: '消费', hint: '每月消费篮子' },
  { id: 'employer', label: '单位', hint: '单位缴费比例与用工成本' }
]

const formatAmount = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)

/** 失焦时显示千分位，聚焦时回到纯数字，避免光标跳位。 */
function MoneyInput({ value, onChange, className = '' }: { value: number; onChange: (value: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  return (
    <span className={`money-input ${className}`}>
      <b>¥</b>
      <input
        type="text"
        inputMode="decimal"
        value={editing ? draft : formatAmount(value)}
        onFocus={() => { setEditing(true); setDraft(String(value)) }}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.]/g, '')
          setDraft(raw)
          onChange(Math.max(0, Number(raw) || 0))
        }}
        onBlur={() => setEditing(false)}
      />
    </span>
  )
}

export function ProfilePanel({ profile, onChange, open, onClose }: ProfilePanelProps) {
  const [tab, setTab] = useState<PanelTab>('income')
  const baselineRef = useRef<CalculatorProfile>(profile)

  useEffect(() => {
    if (open) baselineRef.current = profile
    // 仅在面板打开的那一刻记录基线，之后用户的每次改动都要与它比较
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const patch = (field: keyof CalculatorProfile, value: number | string | boolean) => {
    if (field === 'monthlySalary' && typeof value === 'number') {
      onChange({
        ...profile,
        monthlySalary: value,
        socialInsuranceBase: profile.socialInsuranceBase === profile.monthlySalary ? value : profile.socialInsuranceBase,
        housingFundBase: profile.housingFundBase === profile.monthlySalary ? value : profile.housingFundBase
      })
      return
    }
    onChange({ ...profile, [field]: value })
  }

  const patchExpense = (key: ExpenseKey, value: number) =>
    onChange({ ...profile, expenses: { ...profile.expenses, [key]: value } })

  const personalSocialRate = profile.pensionRate + profile.medicalRate + profile.unemploymentRate
  const employerSocialRate = profile.employerPensionRate + profile.employerMedicalRate + profile.employerUnemploymentRate + profile.employerInjuryRate
  const employerTotalRate = employerSocialRate + profile.employerHousingFundRate
  const syncBases = () => onChange({ ...profile, socialInsuranceBase: profile.monthlySalary, housingFundBase: profile.monthlySalary })

  const preview = calculateProfile(profile, 'neutral')
  const bonusCliff = annualBonusCliffWarning(profile.annualBonus)
  const baselinePreview = calculateProfile(baselineRef.current, 'neutral')
  const baselineRatio = baselinePreview.burdenRatio * 100
  const currentRatio = preview.burdenRatio * 100
  const deltaPp = currentRatio - baselineRatio
  const hasChange = Math.abs(deltaPp) >= 0.05

  const monthlySpending = Object.values(profile.expenses).reduce((sum, value) => sum + value, 0)
  const completion: Record<PanelTab, boolean> = {
    income: profile.monthlySalary > 0,
    contribution: profile.socialInsuranceBase > 0 || profile.housingFundBase > 0,
    spending: monthlySpending > 0,
    employer: employerSocialRate > 0 || profile.employerHousingFundRate > 0
  }
  const doneCount = panelTabs.filter((item) => completion[item.id]).length

  return (
    <aside className={`profile-panel ${open ? 'profile-panel--open' : ''}`} aria-label="计算参数">
      <div className="profile-panel__head">
        <div>
          <span className="kicker">你的模型</span>
          <h2>调整计算参数</h2>
        </div>
        <button className="icon-button panel-close" onClick={onClose} aria-label="关闭参数面板">关闭</button>
      </div>

      <div className="impact-preview" aria-live="polite">
        <span className="impact-preview__label">可识别税负</span>
        <span className="impact-preview__before">{baselineRatio.toFixed(1)}%</span>
        <span className="impact-preview__arrow" aria-hidden="true">→</span>
        <strong className="impact-preview__after">{currentRatio.toFixed(1)}%</strong>
        <span className={`impact-preview__delta ${hasChange ? (deltaPp > 0 ? 'is-up' : 'is-down') : ''}`}>
          {hasChange ? `${deltaPp > 0 ? '+' : ''}${deltaPp.toFixed(1)} 个百分点` : '尚未改动'}
        </span>
      </div>

      <div className="panel-tabs" role="tablist" aria-label="参数分组">
        {panelTabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`${tab === item.id ? 'is-active' : ''} ${completion[item.id] ? 'is-done' : ''}`}
            onClick={() => setTab(item.id)}
            title={item.hint}
          >{item.label}</button>
        ))}
      </div>
      <p className="panel-tab-hint">{panelTabs.find((item) => item.id === tab)!.hint}</p>

      {tab === 'income' && (
        <section className="form-section">
          <div className="form-grid form-grid--two">
            <label>
              <span>城市</span>
              <select value={profile.city} onChange={(event) => patch('city', event.target.value)}>
                <option>上海</option><option>北京</option><option>深圳</option><option>广州</option><option>杭州</option><option>成都</option><option>其他城市</option>
              </select>
            </label>
            <label>
              <span>计算年份</span>
              <select value={profile.year} onChange={(event) => patch('year', toNumber(event.target.value))}>
                <option value="2026">2026</option>
                <option value="2025" disabled>2025 · 待补规则</option>
                <option value="2020" disabled>2020 · 待补规则</option>
              </select>
            </label>
          </div>
          <label>
            <span>所在地档次（城建税）</span>
            <select value={profile.cityTier} onChange={(event) => patch('cityTier', event.target.value)}>
              <option value="urban">市区 · 附加税费 12%</option>
              <option value="county">县城和镇 · 附加税费 10%</option>
              <option value="other">其他 · 附加税费 6%</option>
            </select>
          </label>
          <p className="form-note">附加税费＝城建税（市区 7%／县镇 5%／其他 1%）＋教育费附加 3%＋地方教育附加 2%，以实缴增值税、消费税为计税依据，属"税上税"。它单列展示，不计入可识别税费。</p>
          <label>
            <span>税前月薪</span>
            <MoneyInput value={profile.monthlySalary} onChange={(value) => patch('monthlySalary', value)} />
          </label>
          <div className="form-grid form-grid--two">
            <label>
              <span>全年一次性奖金</span>
              <MoneyInput value={profile.annualBonus} onChange={(value) => patch('annualBonus', value)} />
            </label>
            <label>
              <span>奖金计税方式</span>
              <select value={profile.annualBonusTaxMethod} onChange={(event) => patch('annualBonusTaxMethod', event.target.value)}>
                <option value="optimal">自动选择较低税额</option>
                <option value="separate">单独计税</option>
                <option value="comprehensive">并入综合所得</option>
              </select>
            </label>
          </div>
          <label>
            <span>每月专项附加扣除</span>
            <MoneyInput value={profile.specialDeductionMonthly} onChange={(value) => patch('specialDeductionMonthly', value)} />
          </label>
          {profile.annualBonus > 0 && (
            <p className="form-note">
              预计采用{preview.effectiveAnnualBonusTaxMethod === 'separate' ? '单独计税' : '并入综合所得'}：个税 {money(preview.incomeTax)}。
              单独计税 {money(preview.incomeTaxIfSeparate)}，并入综合所得 {money(preview.incomeTaxIfComprehensive)}。
              单独计税政策适用至 2027 年 12 月 31 日，且需符合全年一次性奖金条件。
            </p>
          )}
          {profile.annualBonus > 0 && bonusCliff && (
            <p className="form-note form-note--warning">
              临界点提示：奖金 {money(bonusCliff.cliff)} 元时单独计税税额为 {money(bonusCliff.atCliff)} 元，
              当前 {money(profile.annualBonus)} 元对应 {money(bonusCliff.actual)} 元——多发 {money(profile.annualBonus - bonusCliff.cliff)} 元，
              多缴约 {money(bonusCliff.extra)} 元。若条件允许，把奖金控制在 {money(bonusCliff.cliff)} 元以内更划算。
            </p>
          )}
        </section>
      )}

      {tab === 'contribution' && (
        <>
          <section className="form-section contribution-section">
            <div className="section-title-inline"><h3>缴费基数</h3><button className="inline-action" onClick={syncBases}>同步为当前月薪</button></div>
            <div className="form-grid form-grid--two">
              <label><span>社保月缴费基数</span><MoneyInput value={profile.socialInsuranceBase} onChange={(value) => patch('socialInsuranceBase', value)} /></label>
              <label><span>公积金月缴存基数</span><MoneyInput value={profile.housingFundBase} onChange={(value) => patch('housingFundBase', value)} /></label>
            </div>
            {profile.city === '上海' ? <label className="base-limit-check"><input type="checkbox" checked={profile.applyCitySocialBaseLimits} onChange={(event) => patch('applyCitySocialBaseLimits', event.target.checked)} /><span>应用上海 2026 社保基数上下限</span></label> : <p className="form-note form-note--warning">当前尚未内置 {profile.city} 的基数上下限；按你填写的基数计算。</p>}
            <p className="form-note">上海 2026 年 1—6 月社保基数范围为 ¥7,460—¥37,302，7—12 月为 ¥7,546—¥37,731。公积金按上一年度月平均工资另行核定。</p>
          </section>

          <section className="form-section">
            <div className="section-title-inline"><h3>个人缴费比例</h3><small>社保 {Math.round(personalSocialRate * 1000) / 10}% · 公积金 {Math.round(profile.housingFundRate * 1000) / 10}%</small></div>
            <div className="rate-grid">
              {([
                ['pensionRate', '个人养老'], ['medicalRate', '个人医疗'], ['unemploymentRate', '个人失业'], ['housingFundRate', '个人公积金']
              ] as Array<[keyof CalculatorProfile, string]>).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <span className="rate-input"><input type="number" min="0" max="50" step="0.1" value={Number(profile[key]) * 100} onChange={(event) => patch(key, toNumber(event.target.value) / 100)} /><b>%</b></span>
                </label>
              ))}
            </div>
          </section>

          <section className="contribution-preview" aria-label="月均缴费预览">
            <div><span>个人社保</span><strong>{money(preview.personalSocial / 12)}</strong></div>
            <div><span>个人公积金</span><strong>{money(preview.housingFund / 12)}</strong></div>
            <div><span>单位社保</span><strong>{money(preview.employerSocial / 12)}</strong></div>
            <div><span>单位公积金</span><strong>{money(preview.employerHousingFund / 12)}</strong></div>
            <div><span>单位缴费合计</span><strong>{money(preview.employerContributions / 12)}</strong></div>
            <small>月均值；上海 2026 年社保基数上下限按上下半年分别应用。</small>
          </section>
          {profile.city === '上海' && <div className="contribution-sources"><span>官方依据</span><a href="https://rsj.sh.gov.cn/tdjjf_17554/20200828/t0035_1393484.html" target="_blank" rel="noreferrer">个人社保比例 ↗</a><a href="https://rsj.sh.gov.cn/tdjjf_17554/20250120/t0035_1430072.html" target="_blank" rel="noreferrer">单位社保比例 ↗</a><a href="https://shanghai.chinatax.gov.cn/bsfw/nszx/hdfk/202609/t481435.html" target="_blank" rel="noreferrer">2026 社保基数 ↗</a><a href="https://www.shanghai.gov.cn/gwk/affairs/content/0064%4003d6f8b173fb4927b9a475f0e764b9dd" target="_blank" rel="noreferrer">公积金基数规则 ↗</a></div>}
        </>
      )}

      {tab === 'spending' && (
        <section className="form-section">
          <div className="section-title-inline">
            <h3>每月消费</h3>
            <small>共 {expenseMeta.length} 类 · 合计 {money(monthlySpending)}／月</small>
          </div>
          <div className="expense-inputs">
            {expenseMeta.map((item) => (
              <label key={item.key} title={item.note}>
                <span>{item.label}</span>
                <MoneyInput className="money-input--compact" value={profile.expenses[item.key]} onChange={(value) => patchExpense(item.key, value)} />
              </label>
            ))}
          </div>
          <p className="form-note">消费价格内含税以增值税估算为主；法定消费税当前仅能按汽油升数识别。烟酒的从价消费税需要生产或批发环节税基，不从零售价强行反推。</p>
          {profile.expenses.fuel > 0 && (
            <label className="sub-field">
              <span>汽油单价（元／升）</span>
              <input type="number" min="1" step="0.01" value={profile.fuelPrice} onChange={(event) => patch('fuelPrice', toNumber(event.target.value))} />
            </label>
          )}
        </section>
      )}

      {tab === 'employer' && (
        <section className="form-section">
          <div className="section-title-inline"><h3>单位缴费比例</h3><small>社保 {Math.round(employerSocialRate * 1000) / 10}% · 含公积金 {Math.round(employerTotalRate * 1000) / 10}%</small></div>
          <div className="rate-grid">
            {([
              ['employerPensionRate', '单位养老'], ['employerMedicalRate', '单位医疗（含生育）'], ['employerUnemploymentRate', '单位失业'], ['employerInjuryRate', '单位工伤'], ['employerHousingFundRate', '单位公积金']
            ] as Array<[keyof CalculatorProfile, string]>).map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <span className="rate-input"><input type="number" min="0" max="50" step="0.1" value={Number(profile[key]) * 100} onChange={(event) => patch(key, toNumber(event.target.value) / 100)} /><b>%</b></span>
              </label>
            ))}
          </div>
          <p className="form-note">单位缴费合计 = 单位社保 + 单位公积金。工伤费率按行业浮动，上海当前基准为 0.2%—1.9%。单位缴费不属于个人直接税，仅用于观察企业用工成本。</p>
          <div className="contribution-preview">
            <div><span>单位社保</span><strong>{money(preview.employerSocial / 12)}</strong></div>
            <div><span>单位公积金</span><strong>{money(preview.employerHousingFund / 12)}</strong></div>
            <div><span>单位缴费合计</span><strong>{money(preview.employerContributions / 12)}</strong></div>
            <div><span>企业用工成本</span><strong>{money(preview.employerCost / 12)}</strong></div>
          </div>
        </section>
      )}

      <div className="profile-panel__footer">
        <p>已完成 {doneCount} / {panelTabs.length} 组 · 修改后立即重算，并只保存在当前浏览器。</p>
        <button className="primary-button" onClick={onClose}>查看计算结果</button>
      </div>
    </aside>
  )
}
