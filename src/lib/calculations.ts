import { expenseMeta } from '../data/expenseMeta'
import type { CalculatorProfile, CityTier, MonthlyTaxPoint, TaxResult, ViewMode } from '../types'

const taxBrackets = [
  { ceiling: 36_000, rate: 0.03, deduction: 0 },
  { ceiling: 144_000, rate: 0.1, deduction: 2_520 },
  { ceiling: 300_000, rate: 0.2, deduction: 16_920 },
  { ceiling: 420_000, rate: 0.25, deduction: 31_920 },
  { ceiling: 660_000, rate: 0.3, deduction: 52_920 },
  { ceiling: 960_000, rate: 0.35, deduction: 85_920 },
  { ceiling: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 181_920 }
]

const monthlyTaxBrackets = [
  { ceiling: 3_000, rate: 0.03, deduction: 0 },
  { ceiling: 12_000, rate: 0.1, deduction: 210 },
  { ceiling: 25_000, rate: 0.2, deduction: 1_410 },
  { ceiling: 35_000, rate: 0.25, deduction: 2_660 },
  { ceiling: 55_000, rate: 0.3, deduction: 4_410 },
  { ceiling: 80_000, rate: 0.35, deduction: 7_160 },
  { ceiling: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 15_160 }
]

export const money = (value: number, digits = 0) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0)

export const compactMoney = (value: number) =>
  value >= 100_000
    ? `${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)} 万`
    : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)

export const vatFromGross = (gross: number, rate: number) =>
  rate <= 0 ? 0 : gross * rate / (1 + rate)

/**
 * 城市维护建设税税率——《中华人民共和国城市维护建设税法》第四条：
 * 市区 7%、县城和镇 5%、其他 1%。
 * 这是流转税中少见的"因城施策"税率，随纳税人所在地变化。
 */
export const cityMaintenanceTaxRate = (tier: CityTier) =>
  tier === 'county' ? 0.05 : tier === 'other' ? 0.01 : 0.07

/** 教育费附加 3%（《征收教育费附加的暂行规定》）。 */
export const EDUCATION_SURCHARGE_RATE = 0.03
/** 地方教育附加 2%（各省规定，全国普遍执行）。 */
export const LOCAL_EDUCATION_SURCHARGE_RATE = 0.02

/** 附加税费合计费率：市区 12%、县城和镇 10%、其他 6%。 */
export const surchargeRateForTier = (tier: CityTier) =>
  cityMaintenanceTaxRate(tier) + EDUCATION_SURCHARGE_RATE + LOCAL_EDUCATION_SURCHARGE_RATE

/**
 * 附加税费 =（增值税 + 消费税）× 附加率。
 * 计税依据是纳税人实际缴纳的增值税、消费税税额，属"以税为基"的税上税。
 * 小规模纳税人、小型微利企业和个体工商户可减半征收（财政部 税务总局公告 2023 年第 12 号，至 2027-12-31）。
 */
export const surchargeFromTurnover = (vat: number, consumptionTax: number, tier: CityTier) =>
  (Math.max(0, vat) + Math.max(0, consumptionTax)) * surchargeRateForTier(tier)

/**
 * 增值税中对消费税征收的部分——消费税是价内税，其税额进入增值税计税依据，
 * 故消费者承担的增值税中含"对消费税征收的增值税"：税上税金额 = 消费税额 × 增值税税率。
 */
export const vatOnConsumptionTax = (consumptionTax: number, vatRate: number) =>
  vatRate <= 0 ? 0 : Math.max(0, consumptionTax) * vatRate

export const annualIncomeTax = (taxableIncome: number) => {
  const taxable = Math.max(0, taxableIncome)
  const bracket = taxBrackets.find((item) => taxable <= item.ceiling) ?? taxBrackets.at(-1)!
  return Math.max(0, taxable * bracket.rate - bracket.deduction)
}

export const annualBonusIncomeTax = (annualBonus: number) => {
  const bonus = Math.max(0, annualBonus)
  if (bonus === 0) return 0
  const monthlyEquivalent = bonus / 12
  const bracket = monthlyTaxBrackets.find((item) => monthlyEquivalent <= item.ceiling) ?? monthlyTaxBrackets.at(-1)!
  return Math.max(0, bonus * bracket.rate - bracket.deduction)
}

export const isAnnualBonusSeparateTaxAvailable = (year: number) => year >= 2019 && year <= 2027

/**
 * 年终奖临界点提示：因单独计税按"奖金 ÷ 12"定档，
 * 跨过临界点会出现"多发 1 元、多缴上千元"的跳档。
 */
const BONUS_CLIFFS = [36_000, 144_000, 300_000, 420_000, 660_000, 960_000]

export const annualBonusCliffWarning = (annualBonus: number) => {
  const bonus = Math.max(0, annualBonus)
  if (bonus <= 0) return null
  const cliff = BONUS_CLIFFS.find((value) => bonus > value && bonus <= value * 1.35)
  if (!cliff) return null
  const atCliff = annualBonusIncomeTax(cliff)
  const actual = annualBonusIncomeTax(bonus)
  const extra = actual - atCliff
  return extra > 0
    ? { cliff, extra, atCliff, actual }
    : null
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const finiteNonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
const roundTenth = (value: number) => Math.round(value * 10) / 10

export interface IncomeJourneyPerHundred {
  hasIncome: boolean
  tax: number
  contribution: number
  takeHome: number
  embeddedPerTakeHome: number
  spendingShareOfTakeHome: number
  spendingExceedsTakeHome: boolean
}

export function incomeJourneyPerHundred(
  result: Pick<TaxResult, 'annualGross' | 'incomeTax' | 'personalSocial' | 'housingFund' | 'takeHome' | 'annualSpending' | 'vatEstimate' | 'consumptionTaxEstimate'>
): IncomeJourneyPerHundred {
  const gross = finiteNonNegative(result.annualGross)
  const takeHomeIncome = finiteNonNegative(result.takeHome)
  const spending = finiteNonNegative(result.annualSpending)
  const embeddedTax = finiteNonNegative(result.vatEstimate) + finiteNonNegative(result.consumptionTaxEstimate)

  if (gross === 0) {
    return {
      hasIncome: false,
      tax: 0,
      contribution: 0,
      takeHome: 0,
      embeddedPerTakeHome: 0,
      spendingShareOfTakeHome: 0,
      spendingExceedsTakeHome: spending > 0
    }
  }

  const tax = roundTenth(clamp(finiteNonNegative(result.incomeTax) / gross * 100, 0, 100))
  const contribution = roundTenth(clamp(
    (finiteNonNegative(result.personalSocial) + finiteNonNegative(result.housingFund)) / gross * 100,
    0,
    100 - tax
  ))

  return {
    hasIncome: true,
    tax,
    contribution,
    takeHome: roundTenth(Math.max(0, 100 - tax - contribution)),
    embeddedPerTakeHome: takeHomeIncome > 0 ? embeddedTax / takeHomeIncome * 100 : 0,
    spendingShareOfTakeHome: takeHomeIncome > 0 ? spending / takeHomeIncome * 100 : 0,
    spendingExceedsTakeHome: spending > takeHomeIncome && spending > 0
  }
}

/**
 * 单个社保年度的月缴费基数。
 * 上海 2026 年按两个社保年度执行：1—6 月 ¥7,460—¥37,302，7—12 月 ¥7,546—¥37,731。
 * 这也是月度税费节奏里 7 月出现台阶的原因——基数上调会改变当月专项扣除，从而影响预扣税额。
 */
export const monthlySocialInsuranceBase = (profile: CalculatorProfile, month: number) => {
  const declaredBase = Math.max(0, profile.socialInsuranceBase)
  if (profile.applyCitySocialBaseLimits && profile.city === '上海' && profile.year === 2026) {
    return month <= 6 ? clamp(declaredBase, 7_460, 37_302) : clamp(declaredBase, 7_546, 37_731)
  }
  return declaredBase
}

export const annualSocialInsuranceBase = (profile: CalculatorProfile) =>
  Array.from({ length: 12 }, (_, index) => monthlySocialInsuranceBase(profile, index + 1))
    .reduce((total, base) => total + base, 0)

/**
 * 12 个月税费节奏。
 *
 * 工资个税采用**累计预扣法**（国家税务总局公告 2018 年第 61 号）：
 *   累计预扣预缴应纳税所得额 = 累计收入 − 累计减除费用（5,000 × 月数）
 *     − 累计专项扣除（社保、公积金） − 累计专项附加扣除
 *   本月应预扣预缴税额 = 累计应纳税所得额 × 预扣率 − 速算扣除数 − 累计已预扣预缴税额
 *
 * 由此得到的每月税额天然呈现「年初低、跨档后抬升」的形态，而不是全年均摊。
 * 数学上，12 个月预扣税额之和恒等于全年工资薪金个税 salaryIncomeTax。
 *
 * 消费内含税按月均摊；全年一次性奖金税额集中计入 12 月，仅用于观察节奏。
 * 社保与公积金不属于税，单独保留在数据点里但不计入 total。
 */
export function monthlyTaxSchedule(profile: CalculatorProfile, result: TaxResult): MonthlyTaxPoint[] {
  const basicDeduction = 5_000 + Math.max(0, profile.specialDeductionMonthly)
  const personalRate = Math.max(0, profile.pensionRate) + Math.max(0, profile.medicalRate) + Math.max(0, profile.unemploymentRate)
  const fundMonthly = Math.max(0, profile.housingFundBase) * Math.max(0, profile.housingFundRate)
  const monthlyGross = Math.max(0, profile.monthlySalary)
  const embeddedMonthly = (finiteNonNegative(result.vatEstimate) + finiteNonNegative(result.consumptionTaxEstimate)) / 12
  const bonusTax = finiteNonNegative(result.annualBonusIncomeTax)

  let cumulativeTaxable = 0
  let cumulativePaid = 0

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const socialBase = monthlySocialInsuranceBase(profile, month)
    const personalSocial = socialBase * personalRate
    cumulativeTaxable += monthlyGross - basicDeduction - personalSocial - fundMonthly
    const salaryIncomeTax = Math.max(0, annualIncomeTax(cumulativeTaxable) - cumulativePaid)
    cumulativePaid += salaryIncomeTax
    const bonus = month === 12 ? bonusTax : 0
    return {
      month,
      socialBase,
      salaryIncomeTax,
      cumulativeIncomeTax: cumulativePaid,
      personalSocial,
      housingFund: fundMonthly,
      embeddedTax: embeddedMonthly,
      bonusTax: bonus,
      total: salaryIncomeTax + embeddedMonthly + bonus
    }
  })
}

export function calculateProfile(profile: CalculatorProfile, mode: ViewMode): TaxResult {
  const annualSalary = profile.monthlySalary * 12
  const annualBonus = Math.max(0, profile.annualBonus)
  const annualGross = annualSalary + annualBonus
  const annualSocialBase = annualSocialInsuranceBase(profile)
  const fundBase = Math.max(0, profile.housingFundBase)
  const pension = annualSocialBase * profile.pensionRate
  const medical = annualSocialBase * profile.medicalRate
  const unemployment = annualSocialBase * profile.unemploymentRate
  const housingFund = fundBase * 12 * profile.housingFundRate
  const personalSocial = pension + medical + unemployment
  const deductibleContributions = personalSocial + housingFund
  const taxableSalary = annualSalary - 60_000 - deductibleContributions - profile.specialDeductionMonthly * 12
  const salaryIncomeTax = annualIncomeTax(taxableSalary)
  const separatelyCalculatedBonusTax = annualBonusIncomeTax(annualBonus)
  const incomeTaxIfSeparate = salaryIncomeTax + separatelyCalculatedBonusTax
  const incomeTaxIfComprehensive = annualIncomeTax(taxableSalary + annualBonus)
  const separateMethodAvailable = isAnnualBonusSeparateTaxAvailable(profile.year)
  const requestedMethod = separateMethodAvailable ? profile.annualBonusTaxMethod : 'comprehensive'
  const effectiveAnnualBonusTaxMethod = requestedMethod === 'optimal'
    ? incomeTaxIfSeparate < incomeTaxIfComprehensive ? 'separate' : 'comprehensive'
    : requestedMethod
  const incomeTax = effectiveAnnualBonusTaxMethod === 'separate' ? incomeTaxIfSeparate : incomeTaxIfComprehensive
  const annualBonusIncomeTaxAmount = effectiveAnnualBonusTaxMethod === 'separate'
    ? separatelyCalculatedBonusTax
    : Math.max(0, incomeTaxIfComprehensive - salaryIncomeTax)
  const employerSocialRate = profile.employerPensionRate + profile.employerMedicalRate + profile.employerUnemploymentRate + profile.employerInjuryRate
  const employerSocial = annualSocialBase * employerSocialRate
  const employerHousingFund = fundBase * 12 * profile.employerHousingFundRate
  const employerContributions = employerSocial + employerHousingFund
  const employerCost = annualGross + employerContributions
  const takeHome = annualGross - incomeTax - personalSocial - housingFund

  const surchargeRate = surchargeRateForTier(profile.cityTier)
  const expenseTaxes = expenseMeta.map((meta) => {
    const spend = Math.max(0, profile.expenses[meta.key]) * 12
    const conservativeIncluded = meta.confidence === 'high' || meta.key === 'fuel'
    const centralIncluded = meta.confidence !== 'unknown'
    const includedByMode = mode === 'conservative' ? conservativeIncluded : centralIncluded
    const conservativeVat = conservativeIncluded ? vatFromGross(spend, meta.vatRate) : 0
    const centralVat = centralIncluded ? vatFromGross(spend, meta.vatRate) : 0
    const vat = includedByMode ? vatFromGross(spend, meta.vatRate) : 0
    const identifiableConsumptionTax = meta.key === 'fuel' && profile.fuelPrice > 0
      ? spend / profile.fuelPrice * 1.52
      : 0
    const consumptionTax = includedByMode ? identifiableConsumptionTax : 0
    // 税上税两条通道：① 增值税中对消费税征收的部分；② 以（增值税+消费税）为基数的附加税费
    const vatOnCt = includedByMode ? vatOnConsumptionTax(consumptionTax, meta.vatRate) : 0
    const surcharge = includedByMode ? (vat + consumptionTax) * surchargeRate : 0
    return {
      key: meta.key,
      label: meta.label,
      spend,
      vat,
      consumptionTax,
      surcharge,
      taxOnTax: vatOnCt + surcharge,
      total: vat + consumptionTax,
      confidence: meta.confidence,
      includedInEstimate: includedByMode,
      conservativeVat,
      centralVat,
      identifiableConsumptionTax
    }
  })

  const annualSpending = expenseTaxes.reduce((sum, item) => sum + item.spend, 0)
  const vatEstimate = expenseTaxes.reduce((sum, item) => sum + item.vat, 0)
  const consumptionTaxEstimate = expenseTaxes.reduce((sum, item) => sum + item.consumptionTax, 0)
  const conservativeEmbeddedTaxEstimate = expenseTaxes.reduce((sum, item) => sum + item.conservativeVat + item.identifiableConsumptionTax, 0)
  const centralEmbeddedTaxEstimate = expenseTaxes.reduce((sum, item) => sum + item.centralVat + item.identifiableConsumptionTax, 0)
  const coveredConsumptionSpending = expenseTaxes.reduce((sum, item) => sum + (item.includedInEstimate ? item.spend : 0), 0)
  const consumptionSpendCoverage = annualSpending > 0 ? coveredConsumptionSpending / annualSpending : 0
  const identifiableTax = incomeTax + vatEstimate + consumptionTaxEstimate
  // 附加税费与"税上税"单列：法定纳税人是经营者，能否转嫁无法从零售价反推，故不并入 identifiableTax
  const surchargeEstimate = expenseTaxes.reduce((sum, item) => sum + item.surcharge, 0)
  const taxOnTaxEstimate = expenseTaxes.reduce((sum, item) => sum + item.taxOnTax, 0)
  const cascadedTax = identifiableTax + surchargeEstimate
  const immediateConsumptionValue = Math.max(0, annualSpending - vatEstimate - consumptionTaxEstimate)
  const burdenRatio = annualGross > 0 ? identifiableTax / annualGross : 0
  const freedomDay = Math.min(365, Math.max(0, Math.round(365 * burdenRatio)))

  return {
    annualGross,
    incomeTax,
    salaryIncomeTax,
    annualBonusIncomeTax: annualBonusIncomeTaxAmount,
    incomeTaxIfSeparate,
    incomeTaxIfComprehensive,
    effectiveAnnualBonusTaxMethod,
    personalSocial,
    housingFund,
    employerSocial,
    employerHousingFund,
    employerContributions,
    employerCost,
    takeHome,
    annualSpending,
    vatEstimate,
    consumptionTaxEstimate,
    surchargeRate,
    surchargeEstimate,
    taxOnTaxEstimate,
    cascadedTax,
    conservativeEmbeddedTaxEstimate,
    centralEmbeddedTaxEstimate,
    coveredConsumptionSpending,
    consumptionSpendCoverage,
    identifiableTax,
    immediateConsumptionValue,
    burdenRatio,
    freedomDay,
    expenseTaxes
  }
}

export const getFreedomDate = (year: number, day: number) => {
  const date = new Date(year, 0, Math.max(1, day))
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}
