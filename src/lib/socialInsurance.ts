import rulesJson from '../data/social_insurance_rules.json'
import type { CalculatorProfile } from '../types'
import type {
  CustomSocialContribution, SocialBaseRule, SocialInsuranceDetail, SocialInsuranceKind,
  SocialInsuranceMonth, SocialInsuranceRuleData, SocialInsuranceYear, SocialRateMode,
  SocialRateRule, SocialRulePeriod
} from './socialInsuranceTypes'

export const socialInsuranceRules = rulesJson as unknown as SocialInsuranceRuleData
export const socialInsuranceLabels: Record<SocialInsuranceKind, string> = {
  pension: '养老保险', medical: '基本医疗保险', unemployment: '失业保险',
  injury: '工伤保险', maternity: '生育保险', medicalSupplement: '医疗附加项目', localPension: '地方补充养老'
}
const standardInsurances: SocialInsuranceKind[] = ['pension', 'medical', 'unemployment', 'injury', 'maternity']
const nonNegative = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, value!) : 0
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const unique = <T,>(values: T[]): T[] => [...new Set(values)]
const isMissing = (status: SocialInsuranceDetail['baseCoverage']) => status === 'missing'

/** Only the mode changes. The user's salary, bases, fund and custom rates survive all switches. */
export function withSocialRateMode(profile: CalculatorProfile, mode: SocialRateMode): CalculatorProfile {
  return { ...profile, socialRateMode: mode }
}
export function withSocialCity(profile: CalculatorProfile, city: string): CalculatorProfile {
  return { ...profile, city }
}

function active(rule: SocialRulePeriod, profile: CalculatorProfile, month: number) {
  const first = `${profile.year}-${String(month).padStart(2, '0')}-01`
  const last = `${profile.year}-${String(month).padStart(2, '0')}-${new Date(profile.year, month, 0).getDate()}`
  return rule.city === profile.city && rule.effectiveFrom <= first &&
    (!rule.effectiveTo || rule.effectiveTo >= last) &&
    Object.entries(rule.conditions ?? {}).every(([key, value]) =>
      profile.socialInsuranceOptions?.[key as 'medicalTier' | 'hukou'] === value)
}

function customRate(profile: CalculatorProfile, insurance: SocialInsuranceKind): CustomSocialContribution {
  const defaults: Record<SocialInsuranceKind, CustomSocialContribution> = {
    pension: { personalRate: profile.pensionRate, employerRate: profile.employerPensionRate, taxDeductible: true },
    medical: { personalRate: profile.medicalRate, employerRate: profile.employerMedicalRate, taxDeductible: true },
    unemployment: { personalRate: profile.unemploymentRate, employerRate: profile.employerUnemploymentRate, taxDeductible: true },
    injury: { personalRate: 0, employerRate: profile.employerInjuryRate, taxDeductible: false },
    maternity: { personalRate: 0, employerRate: 0, taxDeductible: false },
    medicalSupplement: { personalRate: 0, employerRate: 0, taxDeductible: false },
    localPension: { personalRate: 0, employerRate: 0, taxDeductible: false }
  }
  const override = profile.customSocialContributions?.[insurance]
  const cleanOverride: CustomSocialContribution = {}
  if (override?.base !== undefined) cleanOverride.base = override.base
  if (override?.personalRate !== undefined) cleanOverride.personalRate = override.personalRate
  if (override?.employerRate !== undefined) cleanOverride.employerRate = override.employerRate
  if (override?.personalFixed !== undefined) cleanOverride.personalFixed = override.personalFixed
  if (override?.employerFixed !== undefined) cleanOverride.employerFixed = override.employerFixed
  if (override?.taxDeductible !== undefined) cleanOverride.taxDeductible = override.taxDeductible
  return { ...defaults[insurance], ...cleanOverride }
}

export function calculateSocialInsuranceMonth(
  profile: CalculatorProfile, month: number, data = socialInsuranceRules
): SocialInsuranceMonth {
  const official = profile.socialRateMode === 'official'
  const city = data.cities.find((entry) => entry.name === profile.city)
  const supported = data.supportedYears.includes(profile.year) && month >= 1 && month <= 12
  const issues: string[] = []
  const assumptions: string[] = []
  if ((official || profile.applyCitySocialBaseLimits) && (!city || !supported)) {
    issues.push(`${profile.city} ${profile.year} 年未覆盖，需手工校准`)
  }
  if (official && city) {
    city.requiredOptions.forEach((key) => {
      if (!profile.socialInsuranceOptions?.[key]) issues.push(`请补全${key === 'medicalTier' ? '医保档次' : '户籍选项'}，或使用自定义费率`)
    })
    if (profile.city === '深圳' && profile.socialInsuranceOptions?.hukou === 'local' &&
      profile.socialInsuranceOptions?.medicalTier === 'tier2') {
      issues.push('深圳本市户籍职工应参加医保一档，请更正参保条件')
    }
  }
  const insurances = official
    ? city?.insurances ?? standardInsurances
    : unique([...standardInsurances, ...Object.keys(profile.customSocialContributions ?? {}) as SocialInsuranceKind[]])
  const baseRules = supported ? data.baseRules.filter((rule) => active(rule, profile, month)) : []
  const rateRules = supported ? data.rateRules.filter((rule) => active(rule, profile, month)) : []
  const selectedRates = new Map<SocialInsuranceKind, SocialRateRule | undefined>()
  insurances.forEach((insurance) => {
    const matches = rateRules.filter((rule) => rule.insurance === insurance)
    selectedRates.set(insurance, matches.length === 1 ? matches[0] : undefined)
    if (official && matches.length > 1) issues.push(`${socialInsuranceLabels[insurance]}费率规则冲突，需手工校准`)
  })
  const details = insurances.map((insurance): SocialInsuranceDetail => {
    const manual = customRate(profile, insurance)
    const label = socialInsuranceLabels[insurance]
    const bases = baseRules.filter((rule) => rule.insurances.includes(insurance))
    const baseRule: SocialBaseRule | undefined = bases.length === 1 ? bases[0] : undefined
    const rateRule = selectedRates.get(insurance)
    const parent = official ? [...selectedRates.values()].find((rule) => rule?.includes?.includes(insurance)) : undefined
    const declared = nonNegative(official ? profile.socialInsuranceBase : manual.base ?? profile.socialInsuranceBase)
    const detail: SocialInsuranceDetail = {
      insurance, label, base: null, lower: null, upper: null, basis: 'manual',
      personalRate: null, employerRate: null, personalFixed: 0, employerFixed: 0,
      personalAmount: null, employerAmount: null, taxDeductibleAmount: null, accountTransfer: 0,
      baseCoverage: 'missing', rateCoverage: 'missing', employerRateOrigin: 'missing',
      sourceIds: [], notes: []
    }
    if (parent) {
      return {
        ...detail, base: 0, basis: 'none', personalRate: 0, employerRate: 0,
        personalAmount: 0, employerAmount: 0, taxDeductibleAmount: 0,
        baseCoverage: 'included', rateCoverage: 'included', employerRateOrigin: 'official',
        includedIn: parent.insurance, rateRuleId: parent.id, sourceIds: parent.sourceIds,
        notes: [`已计入${socialInsuranceLabels[parent.insurance]}，不重复缴费`]
      }
    }
    // Fixed additions do not need a salary base in official mode. Custom mode keeps its manual amount/rate inputs.
    if (baseRule?.basis === 'none' && official) {
      Object.assign(detail, { base: 0, basis: 'none', baseCoverage: 'official' })
    } else if (baseRule?.basis === 'reference' && (official || profile.applyCitySocialBaseLimits)) {
      Object.assign(detail, { base: baseRule.reference ?? null, basis: 'reference', baseCoverage: 'official' })
    } else if (!profile.applyCitySocialBaseLimits) {
      Object.assign(detail, { base: declared, basis: 'manual', baseCoverage: 'custom' })
    } else if (!official && profile.legacyShanghaiSocialBaseLimits && profile.city === '上海' && profile.year === 2026) {
      const lower = month <= 6 ? 7460 : 7546
      const upper = month <= 6 ? 37302 : 37731
      Object.assign(detail, { base: Math.min(upper, Math.max(lower, declared)), lower, upper, basis: 'salary', baseCoverage: 'legacy' })
      detail.notes.push('旧上海模型基数口径')
    } else if (baseRule?.basis === 'salary') {
      Object.assign(detail, {
        base: Math.min(baseRule.upper ?? Infinity, Math.max(baseRule.lower ?? 0, declared)),
        lower: baseRule.lower ?? null, upper: baseRule.upper ?? null, basis: 'salary', baseCoverage: 'official'
      })
    } else if (!official && (insurance === 'maternity' || insurance === 'medicalSupplement' || insurance === 'localPension')) {
      Object.assign(detail, { base: declared, basis: 'manual', baseCoverage: 'custom' })
    } else {
      issues.push(`${label}基数${bases.length > 1 ? '规则冲突' : '未覆盖'}，需手工校准（可关闭自动上下限并填写基数）`)
    }
    if (baseRule && detail.baseCoverage === 'official') {
      detail.baseRuleId = baseRule.id
      detail.sourceIds.push(...baseRule.sourceIds)
      if (baseRule.note) detail.notes.push(baseRule.note)
    }
    if (official && rateRule) {
      Object.assign(detail, {
        personalRate: rateRule.personalRate, employerRate: rateRule.employerRate,
        personalFixed: rateRule.personalFixed ?? 0, employerFixed: rateRule.employerFixed ?? 0,
        rateCoverage: 'official', rateRuleId: rateRule.id, employerRateOrigin: 'official'
      })
      detail.sourceIds.push(...rateRule.sourceIds)
      if (rateRule.note) detail.notes.push(rateRule.note)
      if (insurance === 'injury') {
        const override = profile.socialInsuranceOptions?.injuryRateOverride
        if (override !== undefined && Number.isFinite(override) && override >= 0 && override <= 1) {
          detail.employerRate = override
          detail.employerRateOrigin = 'user'
          detail.notes.push('工伤费率使用用户填写的单位核定值')
        } else {
          detail.employerRateOrigin = 'baseline'
          assumptions.push('工伤按第一类行业基准试算；实际浮动费率请填写单位核定值')
          if (override !== undefined) issues.push('单位核定工伤费率无效，需手工校准')
        }
      }
      if (profile.city === '深圳' && insurance === 'medical' &&
        profile.socialInsuranceOptions?.hukou === 'local' && profile.socialInsuranceOptions?.medicalTier === 'tier2') {
        detail.rateCoverage = 'missing'
        detail.personalRate = null
        detail.employerRate = null
      }
    } else if (!official) {
      Object.assign(detail, {
        personalRate: nonNegative(manual.personalRate), employerRate: nonNegative(manual.employerRate),
        personalFixed: nonNegative(manual.personalFixed), employerFixed: nonNegative(manual.employerFixed),
        rateCoverage: 'custom', employerRateOrigin: 'user'
      })
    } else {
      issues.push(`${label}费率未覆盖或参保条件未满足，需手工校准`)
    }
    if (detail.base !== null && detail.personalRate !== null && detail.employerRate !== null) {
      const round = official ? cents : (value: number) => value // preserve legacy custom arithmetic
      const personal = round(detail.base * detail.personalRate + detail.personalFixed)
      const employer = round(detail.base * detail.employerRate + detail.employerFixed)
      const accountFunded = official && rateRule?.paymentSource === 'medical-account'
      detail.personalAmount = accountFunded ? 0 : personal
      detail.employerAmount = accountFunded ? 0 : employer
      detail.accountTransfer = accountFunded ? personal : 0
      detail.taxDeductibleAmount = (official ? rateRule?.taxDeductible : manual.taxDeductible)
        ? detail.personalAmount : 0
    }
    detail.sourceIds = unique(detail.sourceIds)
    return detail
  })
  const baseComplete = details.every((detail) => !isMissing(detail.baseCoverage))
  const rateComplete = details.every((detail) => !isMissing(detail.rateCoverage))
  const sum = (key: 'personalAmount' | 'employerAmount' | 'taxDeductibleAmount') => {
    const value = details.reduce((total, detail) => total + (detail[key] ?? 0), 0)
    return official ? cents(value) : value
  }
  return {
    month, details, personalTotal: sum('personalAmount'), employerTotal: sum('employerAmount'),
    taxDeductibleTotal: sum('taxDeductibleAmount'), baseComplete, rateComplete,
    complete: baseComplete && rateComplete && issues.length === 0,
    issues: unique(issues), assumptions: unique(assumptions), changeReasons: []
  }
}

export function socialInsuranceChanges(before: SocialInsuranceMonth, after: SocialInsuranceMonth): string[] {
  const changes: string[] = []
  after.details.forEach((detail) => {
    const previous = before.details.find((item) => item.insurance === detail.insurance)
    if (!previous) { changes.push(`${detail.label}项目变化`); return }
    if (detail.base !== previous.base || detail.lower !== previous.lower || detail.upper !== previous.upper ||
      detail.baseRuleId !== previous.baseRuleId) changes.push(`${detail.label}基数规则变化`)
    if (detail.personalRate !== previous.personalRate || detail.employerRate !== previous.employerRate ||
      detail.rateRuleId !== previous.rateRuleId || detail.includedIn !== previous.includedIn) changes.push(`${detail.label}费率变化`)
    if (detail.personalFixed !== previous.personalFixed || detail.employerFixed !== previous.employerFixed) {
      changes.push(`${detail.label}固定金额变化`)
    }
    if (detail.baseCoverage !== previous.baseCoverage || detail.rateCoverage !== previous.rateCoverage) {
      changes.push(`${detail.label}规则覆盖变化`)
    }
  })
  return unique(changes)
}

export function calculateSocialInsuranceYear(profile: CalculatorProfile, data = socialInsuranceRules): SocialInsuranceYear {
  const months = Array.from({ length: 12 }, (_, index) => calculateSocialInsuranceMonth(profile, index + 1, data))
  months.forEach((month, index) => { if (index) month.changeReasons = socialInsuranceChanges(months[index - 1], month) })
  const sum = (key: 'personalTotal' | 'employerTotal' | 'taxDeductibleTotal') => {
    const value = months.reduce((total, month) => total + month[key], 0)
    return profile.socialRateMode === 'official' ? cents(value) : value
  }
  return {
    months, personalTotal: sum('personalTotal'), employerTotal: sum('employerTotal'),
    taxDeductibleTotal: sum('taxDeductibleTotal'), complete: months.every((month) => month.complete),
    issues: unique(months.flatMap((month) => month.issues)), assumptions: unique(months.flatMap((month) => month.assumptions)),
    sourceIds: unique(months.flatMap((month) => month.details.flatMap((detail) => detail.sourceIds)))
  }
}

export function socialInsurancePeriods(year: SocialInsuranceYear) {
  const periods: Array<{ from: number; to: number; sample: SocialInsuranceMonth }> = []
  year.months.forEach((month) => {
    const last = periods.at(-1)
    if (last && month.changeReasons.length === 0) last.to = month.month
    else periods.push({ from: month.month, to: month.month, sample: month })
  })
  return periods
}

