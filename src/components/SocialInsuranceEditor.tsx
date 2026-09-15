import { useMemo } from 'react'
import { money } from '../lib/calculations'
import {
  calculateSocialInsuranceYear, socialInsuranceLabels, socialInsurancePeriods, socialInsuranceRules,
  withSocialRateMode
} from '../lib/socialInsurance'
import type { CalculatorProfile } from '../types'
import type { CustomSocialContribution, SocialInsuranceDetail, SocialInsuranceKind, SocialInsuranceYear } from '../lib/socialInsuranceTypes'

const rate = (value: number | null, fixed = 0) => value === null ? '待核验' :
  `${Number((value * 100).toFixed(4))}%${fixed ? ` + ${money(fixed, 2)}` : ''}`
const amount = (value: number | null) => value === null ? '待核验' : money(value, 2)
const percentValue = (value: number) => Number((value * 100).toFixed(4))

export function SocialInsuranceNotice({ value }: { value: SocialInsuranceYear }) {
  if (value.complete) return null
  const missing = value.months.filter((month) => !month.complete).map((month) => `${month.month}月`).join('、')
  return <div className="social-calibration" role="status">
    <strong>需手工校准</strong>
    <p>{missing}的基数、费率或参保条件尚不完整。下列金额仅汇总已知缴费项目；个税、到手收入和单位成本均为待校准试算。</p>
    <details><summary>查看缺口与处理方式</summary><ul>{value.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></details>
  </div>
}

function InsuranceTable({ details }: { details: SocialInsuranceDetail[] }) {
  return <div className="social-table-scroll" tabIndex={0} aria-label="各险种缴费明细，可横向滚动"><table className="social-detail-table">
    <thead><tr><th>险种／基数口径</th><th>当月基数</th><th>个人比例／金额</th><th>单位比例／金额</th><th>个税可扣</th></tr></thead>
    <tbody>{details.map((item) => <tr key={item.insurance}>
      <th>{item.label}<small>{item.includedIn ? `已含在${socialInsuranceLabels[item.includedIn]}` :
        item.basis === 'reference' ? '固定参考基数' : item.basis === 'none' ? '固定金额项目' :
          item.baseCoverage === 'legacy' ? '旧模型上下限' : item.baseCoverage === 'custom' ? '手填基数' :
            item.baseCoverage === 'missing' ? '基数待核验' : `${item.lower ?? 0}—${item.upper ?? '无上限'}`}</small></th>
      <td>{item.includedIn || item.basis === 'none' ? '—' : amount(item.base)}</td>
      <td><span>{rate(item.personalRate, item.personalFixed)}</span><b>{amount(item.personalAmount)}</b>{item.accountTransfer > 0 && <small>个账划转 {money(item.accountTransfer, 2)}，不重复扣薪</small>}</td>
      <td><span>{rate(item.employerRate, item.employerFixed)}</span><b>{amount(item.employerAmount)}</b>{item.insurance === 'injury' && <small>{item.employerRateOrigin === 'user' ? '用户核定值' : item.employerRateOrigin === 'baseline' ? '第一类行业基准' : '待核验'}</small>}</td>
      <td>{amount(item.taxDeductibleAmount)}</td>
    </tr>)}</tbody>
  </table></div>
}

export function SocialInsurancePreview({ value, expanded = false }: { value: SocialInsuranceYear; expanded?: boolean }) {
  return <section className="social-rule-preview" aria-label="社保缴费预览">
    <SocialInsuranceNotice value={value} />
    <div className="social-preview-totals"><div><span>全年个人社保{!value.complete && '（已知部分）'}</span><b>{money(value.personalTotal, 2)}</b></div><div><span>全年单位社保{!value.complete && '（已知部分）'}</span><b>{money(value.employerTotal, 2)}</b></div><div><span>全年个税可扣社保</span><b>{money(value.taxDeductibleTotal, 2)}</b></div></div>
    {socialInsurancePeriods(value).map((period) => {
      const sourceIds = [...new Set(period.sample.details.flatMap((item) => item.sourceIds))]
      const notes = [...new Set(period.sample.details.flatMap((item) => item.notes))]
      return <details key={period.from} className="social-period" open={expanded || undefined}>
        <summary><span>{period.from === period.to ? `${period.from} 月` : `${period.from}—${period.to} 月`}{!period.sample.complete && <em>需手工校准</em>}</span><span>个人 {money(period.sample.personalTotal, 2)} · 单位 {money(period.sample.employerTotal, 2)}／月</span></summary>
        <InsuranceTable details={period.sample.details} />
        {notes.length > 0 && <ul className="social-rule-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
        {sourceIds.length > 0 && <div className="social-source-links"><b>官方依据</b>{sourceIds.map((id) => {
          const source = socialInsuranceRules.sources.find((item) => item.id === id)
          return source && <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>
        })}</div>}
      </details>
    })}
    {value.assumptions.map((item) => <p className="social-assumption" key={item}>{item}。</p>)}
  </section>
}

type RateKey = 'pensionRate' | 'medicalRate' | 'unemploymentRate' | 'employerPensionRate' | 'employerMedicalRate' | 'employerUnemploymentRate' | 'employerInjuryRate'
const manualRates: Array<{ insurance: SocialInsuranceKind; personal?: RateKey; employer: RateKey }> = [
  { insurance: 'pension', personal: 'pensionRate', employer: 'employerPensionRate' },
  { insurance: 'medical', personal: 'medicalRate', employer: 'employerMedicalRate' },
  { insurance: 'unemployment', personal: 'unemploymentRate', employer: 'employerUnemploymentRate' },
  { insurance: 'injury', employer: 'employerInjuryRate' }
]
function PercentageInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><span><input aria-label={label} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={percentValue(value)} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0) / 100)} /><b>%</b></span></label>
}

export function SocialInsuranceEditor({ profile, onChange }: { profile: CalculatorProfile; onChange: (profile: CalculatorProfile) => void }) {
  const preview = useMemo(() => calculateSocialInsuranceYear(profile), [profile])
  const official = profile.socialRateMode === 'official'
  const options = profile.socialInsuranceOptions ?? {}
  const patchCustom = (insurance: SocialInsuranceKind, patch: Partial<CustomSocialContribution>) =>
    onChange({ ...profile, customSocialContributions: {
      ...profile.customSocialContributions, [insurance]: { ...profile.customSocialContributions?.[insurance], ...patch }
    } })
  const updateRate = (key: RateKey, insurance: SocialInsuranceKind, side: 'personalRate' | 'employerRate', value: number) => {
    const existing = profile.customSocialContributions?.[insurance]
    const { [side]: _ignored, ...rest } = existing ?? {}
    onChange({ ...profile, [key]: value, customSocialContributions: {
      ...profile.customSocialContributions, [insurance]: rest
    } })
  }
  return <div className="social-editor">
    <div className="model-subsection-head"><div><span>社保费率</span><small>2026 年普通企业在职职工 · 全年同城连续参保</small></div></div>
    <div className="social-mode-switch" role="group" aria-label="社保费率模式">
      <button type="button" className={official ? 'is-active' : ''} aria-pressed={official} onClick={() => onChange(withSocialRateMode(profile, 'official'))}>官方费率</button>
      <button type="button" className={!official ? 'is-active' : ''} aria-pressed={!official} onClick={() => onChange(withSocialRateMode(profile, 'custom'))}>自定义费率</button>
    </div>
    {!official && <p className="social-mode-note">使用你填写的费率与附加项目。<button type="button" className="text-button" onClick={() => onChange(withSocialRateMode(profile, 'official'))}>恢复官方费率</button></p>}
    <label className="model-check"><input type="checkbox" checked={profile.applyCitySocialBaseLimits} onChange={(event) => onChange({ ...profile, applyCitySocialBaseLimits: event.target.checked })} /><span><b>应用城市各险种基数上下限</b><small>与费率模式独立；固定参考基数仍按政策计算。公积金继续手工配置。</small></span></label>
    {official && profile.city === '深圳' && <div className="model-form-grid social-options">
      <label className="model-field"><span>深圳参保户籍</span><select aria-label="深圳参保户籍" value={options.hukou ?? ''} onChange={(event) => onChange({ ...profile, socialInsuranceOptions: { ...options, hukou: event.target.value as typeof options.hukou || undefined } })}><option value="">请选择户籍条件</option><option value="local">深圳户籍</option><option value="nonlocal">非深圳户籍</option></select></label>
      <label className="model-field"><span>深圳医保档次</span><select aria-label="深圳医保档次" value={options.medicalTier ?? ''} onChange={(event) => onChange({ ...profile, socialInsuranceOptions: { ...options, medicalTier: event.target.value as typeof options.medicalTier || undefined } })}><option value="">请选择医保档次</option><option value="tier1">职工医保一档</option><option value="tier2" disabled={options.hukou === 'local'}>职工医保二档（非深户）</option></select></label>
      <p className="social-mode-note">深圳户籍职工应参加一档；户籍还影响单位地方补充养老缴费。</p>
    </div>}
    {official ? <label className="model-field social-injury-field"><span>单位核定工伤费率（%）</span><input aria-label="单位核定工伤费率（%）" type="number" min="0" max="100" step="0.01" inputMode="decimal" placeholder="留空使用第一类行业基准" value={options.injuryRateOverride === undefined ? '' : percentValue(options.injuryRateOverride)} onChange={(event) => onChange({ ...profile, socialInsuranceOptions: { ...options, injuryRateOverride: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) / 100 } })} /><small>行业基准与单位实际浮动费率不同，预览会标明采用哪一种。</small></label> :
      <div className="social-custom-rates">
        <div className="model-rate-grid">{manualRates.flatMap((row) => [
          ...(row.personal ? [<PercentageInput key={row.personal} label={`个人${socialInsuranceLabels[row.insurance]}`} value={profile.customSocialContributions?.[row.insurance]?.personalRate ?? profile[row.personal]} onChange={(value) => updateRate(row.personal!, row.insurance, 'personalRate', value)} />] : []),
          <PercentageInput key={row.employer} label={`单位${socialInsuranceLabels[row.insurance]}`} value={profile.customSocialContributions?.[row.insurance]?.employerRate ?? profile[row.employer]} onChange={(value) => updateRate(row.employer, row.insurance, 'employerRate', value)} />
        ])}</div>
        <details className="social-custom-extra"><summary>不同险种基数与附加项目</summary>
          <p>医疗费率已含生育时，生育附加比例留为 0；这里的固定金额仅填写工资单额外扣款，医保个账划转不重复填写。</p>
          <div className="model-form-grid">{manualRates.map((row) => <label className="model-field" key={row.insurance}><span>{socialInsuranceLabels[row.insurance]}申报基数</span><input type="number" min="0" step="0.01" aria-label={`${socialInsuranceLabels[row.insurance]}申报基数`} placeholder={String(profile.socialInsuranceBase)} value={profile.customSocialContributions?.[row.insurance]?.base ?? ''} onChange={(event) => patchCustom(row.insurance, { base: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} /><small>留空使用统一申报基数</small></label>)}</div>
          <div className="model-rate-grid">
            <PercentageInput label="单位生育附加比例" value={profile.customSocialContributions?.maternity?.employerRate ?? 0} onChange={(value) => patchCustom('maternity', { employerRate: value })} />
            <PercentageInput label="单位医疗附加比例" value={profile.customSocialContributions?.medicalSupplement?.employerRate ?? 0} onChange={(value) => patchCustom('medicalSupplement', { employerRate: value })} />
            <PercentageInput label="单位地方补充养老" value={profile.customSocialContributions?.localPension?.employerRate ?? 0} onChange={(value) => patchCustom('localPension', { employerRate: value })} />
          </div>
          <div className="model-form-grid">{(['personalFixed', 'employerFixed'] as const).map((key) => <label className="model-field" key={key}><span>{key === 'personalFixed' ? '个人' : '单位'}社保固定附加（元／月）</span><input aria-label={`${key === 'personalFixed' ? '个人' : '单位'}社保固定附加（元／月）`} type="number" min="0" step="0.01" value={profile.customSocialContributions?.medicalSupplement?.[key] ?? 0} onChange={(event) => patchCustom('medicalSupplement', { [key]: Math.max(0, Number(event.target.value) || 0) })} /></label>)}</div>
          <label className="model-check"><input type="checkbox" checked={profile.customSocialContributions?.medicalSupplement?.taxDeductible ?? false} onChange={(event) => patchCustom('medicalSupplement', { taxDeductible: event.target.checked })} /><span>个人固定附加可在个税前扣除（请以工资单和税务口径核对）</span></label>
        </details>
      </div>}
    <SocialInsurancePreview value={preview} />
    <div className="model-subsection-head"><div><span>住房公积金</span><small>个人与单位比例手工配置</small></div></div>
    <div className="model-rate-grid">
      <PercentageInput label="个人公积金" value={profile.housingFundRate} onChange={(value) => onChange({ ...profile, housingFundRate: value })} />
      <PercentageInput label="单位公积金" value={profile.employerHousingFundRate} onChange={(value) => onChange({ ...profile, employerHousingFundRate: value })} />
    </div>
  </div>
}

