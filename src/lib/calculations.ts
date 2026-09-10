import { expenseMeta } from '../data/expenseMeta'
import type { CalculatorProfile, TaxResult, ViewMode } from '../types'

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

export const annualSocialInsuranceBase = (profile: CalculatorProfile) => {
  const declaredBase = Math.max(0, profile.socialInsuranceBase)
  if (profile.applyCitySocialBaseLimits && profile.city === '上海' && profile.year === 2026) {
    const januaryToJune = clamp(declaredBase, 7_460, 37_302) * 6
    const julyToDecember = clamp(declaredBase, 7_546, 37_731) * 6
    return januaryToJune + julyToDecember
  }
  return declaredBase * 12
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
    return {
      key: meta.key,
      label: meta.label,
      spend,
      vat,
      consumptionTax,
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
