import { expenseMeta } from '../data/expenseMeta'
import type { CalculatorProfile, ExpenseKey } from '../types'
import { calculateProfile, money } from '../lib/calculations'

interface ProfilePanelProps {
  profile: CalculatorProfile
  onChange: (next: CalculatorProfile) => void
  open: boolean
  onClose: () => void
}

const toNumber = (value: string) => Math.max(0, Number(value) || 0)

export function ProfilePanel({ profile, onChange, open, onClose }: ProfilePanelProps) {
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
  const contributionPreview = calculateProfile(profile, 'conservative')

  return (
    <aside className={`profile-panel ${open ? 'profile-panel--open' : ''}`} aria-label="计算参数">
      <div className="profile-panel__head">
        <div>
          <span className="kicker">你的模型</span>
          <h2>调整计算参数</h2>
        </div>
        <button className="icon-button panel-close" onClick={onClose} aria-label="关闭参数面板">关闭</button>
      </div>

      <section className="form-section">
        <h3>收入与地区</h3>
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
          <span>税前月薪</span>
          <span className="money-input"><b>¥</b><input type="number" min="0" step="500" value={profile.monthlySalary} onChange={(event) => patch('monthlySalary', toNumber(event.target.value))} /></span>
        </label>
        <div className="form-grid form-grid--two">
          <label>
            <span>全年一次性奖金</span>
            <span className="money-input"><b>¥</b><input type="number" min="0" step="1000" value={profile.annualBonus} onChange={(event) => patch('annualBonus', toNumber(event.target.value))} /></span>
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
          <span className="money-input"><b>¥</b><input type="number" min="0" step="100" value={profile.specialDeductionMonthly} onChange={(event) => patch('specialDeductionMonthly', toNumber(event.target.value))} /></span>
        </label>
        {profile.annualBonus > 0 && (
          <p className="form-note">
            预计采用{contributionPreview.effectiveAnnualBonusTaxMethod === 'separate' ? '单独计税' : '并入综合所得'}：个税 {money(contributionPreview.incomeTax)}。
            单独计税 {money(contributionPreview.incomeTaxIfSeparate)}，并入综合所得 {money(contributionPreview.incomeTaxIfComprehensive)}。
            单独计税政策适用至 2027 年 12 月 31 日，且需符合全年一次性奖金条件。
          </p>
        )}
      </section>

      <section className="form-section contribution-section">
        <div className="section-title-inline"><h3>缴费基数</h3><button className="inline-action" onClick={syncBases}>同步为当前月薪</button></div>
        <div className="form-grid form-grid--two">
          <label><span>社保月缴费基数</span><span className="money-input"><b>¥</b><input type="number" min="0" step="100" value={profile.socialInsuranceBase} onChange={(event) => patch('socialInsuranceBase', toNumber(event.target.value))} /></span></label>
          <label><span>公积金月缴存基数</span><span className="money-input"><b>¥</b><input type="number" min="0" step="100" value={profile.housingFundBase} onChange={(event) => patch('housingFundBase', toNumber(event.target.value))} /></span></label>
        </div>
        {profile.city === '上海' ? <label className="base-limit-check"><input type="checkbox" checked={profile.applyCitySocialBaseLimits} onChange={(event) => patch('applyCitySocialBaseLimits', event.target.checked)} /><span>应用上海 2026 社保基数上下限</span></label> : <p className="form-note form-note--warning">当前尚未内置 {profile.city} 的基数上下限；按你填写的基数计算。</p>}
        <p className="form-note">上海 2026 年 1—6 月社保基数范围为 ¥7,460—¥37,302，7—12 月为 ¥7,546—¥37,731。公积金按上一年度月平均工资另行核定。</p>
      </section>

      <details className="form-section form-details" open>
        <summary><span>个人缴费比例</span><small>社保 {Math.round(personalSocialRate * 1000) / 10}% · 公积金 {Math.round(profile.housingFundRate * 1000) / 10}%</small></summary>
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
      </details>

      <details className="form-section form-details">
        <summary><span>单位缴费比例</span><small>社保 {Math.round(employerSocialRate * 1000) / 10}% · 含公积金 {Math.round(employerTotalRate * 1000) / 10}%</small></summary>
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
        <p className="form-note">单位缴费合计 = 单位社保 + 单位公积金。工伤费率按行业浮动，上海当前基准为 0.2%—1.9%。</p>
      </details>

      <section className="contribution-preview" aria-label="月均缴费预览">
        <div><span>个人社保</span><strong>{money(contributionPreview.personalSocial / 12)}</strong></div>
        <div><span>个人公积金</span><strong>{money(contributionPreview.housingFund / 12)}</strong></div>
        <div><span>单位社保</span><strong>{money(contributionPreview.employerSocial / 12)}</strong></div>
        <div><span>单位公积金</span><strong>{money(contributionPreview.employerHousingFund / 12)}</strong></div>
        <div><span>单位缴费合计</span><strong>{money(contributionPreview.employerContributions / 12)}</strong></div>
        <small>月均值；上海 2026 年社保基数上下限按上下半年分别应用。</small>
      </section>
      {profile.city === '上海' && <div className="contribution-sources"><span>官方依据</span><a href="https://rsj.sh.gov.cn/tdjjf_17554/20200828/t0035_1393484.html" target="_blank" rel="noreferrer">个人社保比例 ↗</a><a href="https://rsj.sh.gov.cn/tdjjf_17554/20250120/t0035_1430072.html" target="_blank" rel="noreferrer">单位社保比例 ↗</a><a href="https://shanghai.chinatax.gov.cn/bsfw/nszx/hdfk/202609/t481435.html" target="_blank" rel="noreferrer">2026 社保基数 ↗</a><a href="https://www.shanghai.gov.cn/gwk/affairs/content/0064%4003d6f8b173fb4927b9a475f0e764b9dd" target="_blank" rel="noreferrer">公积金基数规则 ↗</a></div>}

      <section className="form-section">
        <div className="section-title-inline">
          <h3>每月消费</h3>
          <small>共 {expenseMeta.length} 类</small>
        </div>
        <div className="expense-inputs">
          {expenseMeta.map((item) => (
            <label key={item.key} title={item.note}>
              <span>{item.label}</span>
              <span className="money-input money-input--compact"><b>¥</b><input type="number" min="0" step="50" value={profile.expenses[item.key]} onChange={(event) => patchExpense(item.key, toNumber(event.target.value))} /></span>
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

      <div className="profile-panel__footer">
        <p>修改后立即重算，并只保存在当前浏览器。</p>
        <button className="primary-button" onClick={onClose}>查看计算结果</button>
      </div>
    </aside>
  )
}
