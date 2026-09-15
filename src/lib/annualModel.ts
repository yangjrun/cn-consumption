import { normalizeCalculatorProfile } from './profileNormalization'
import { expenseMeta } from '../data/expenseMeta'
import type {
  AnnualEvent,
  AnnualMonthlyPoint,
  AnnualTaxResult,
  AppModelV1,
  CalculatorProfile,
  EstimateMode,
  EventTaxBreakdown,
  ExpenseKey,
  ModelApplication
} from '../types'
import {
  annualBonusIncomeTax,
  annualIncomeTax,
  calculateProfile,
  isAnnualBonusSeparateTaxAvailable,
  vatFromGross
} from './calculations'

export const MODEL_STORAGE_KEY = 'taxlens.model.v1'
export const LEGACY_PROFILE_STORAGE_KEY = 'taxlens.profile.v0'

const finiteNonNegative = (value: unknown, fallback = 0) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : fallback
}

const validMonth = (value: unknown, fallback = 12) =>
  Math.min(12, Math.max(1, Math.round(finiteNonNegative(value, fallback))))

const now = () => new Date().toISOString()

export function modelFromProfile(profile: CalculatorProfile, status: AppModelV1['status'] = 'personalized'): AppModelV1 {
  return {
    version: 1,
    status,
    profile: normalizeCalculatorProfile(profile, profile),
    monthlyIncome: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, salary: finiteNonNegative(profile.monthlySalary) })),
    annualBonusMonth: 12,
    events: [],
    appliedFingerprints: [],
    updatedAt: now()
  }
}

/** Normalize local/share data defensively so a damaged payload never breaks the app. */
export function normalizeAnnualModel(raw: unknown, fallbackProfile: CalculatorProfile): AppModelV1 {
  if (!raw || typeof raw !== 'object') return modelFromProfile(fallbackProfile, 'sample')
  const candidate = raw as Partial<AppModelV1>
  if (candidate.version !== 1 || !candidate.profile) return modelFromProfile(fallbackProfile, 'sample')

  const profile = normalizeCalculatorProfile(candidate.profile, fallbackProfile)
  const monthlyIncome = Array.from({ length: 12 }, (_, index) => {
    const supplied = Array.isArray(candidate.monthlyIncome)
      ? candidate.monthlyIncome.find((item) => item && item.month === index + 1)
      : undefined
    return { month: index + 1, salary: finiteNonNegative(supplied?.salary, profile.monthlySalary) }
  })
  const eventCandidates = Array.isArray(candidate.events) ? candidate.events : []
  const events = eventCandidates
    .filter((event): event is AnnualEvent => Boolean(
      event && typeof event.id === 'string' && typeof event.fingerprint === 'string' &&
      (event.type === 'consumption' || event.type === 'housing' || event.type === 'vehicle' || event.type === 'investment')
    ))
    .map((event) => ({ ...event, month: validMonth(event.month) }))

  return {
    version: 1,
    status: candidate.status === 'personalized' ? 'personalized' : 'sample',
    profile,
    monthlyIncome,
    annualBonusMonth: validMonth(candidate.annualBonusMonth),
    events,
    appliedFingerprints: Array.isArray(candidate.appliedFingerprints)
      ? candidate.appliedFingerprints.filter((item): item is string => typeof item === 'string')
      : events.map((event) => event.fingerprint),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now()
  }
}

export function profileFromModel(model: AppModelV1): CalculatorProfile {
  const annualSalary = model.monthlyIncome.reduce((sum, item) => sum + finiteNonNegative(item.salary), 0)
  return {
    ...model.profile,
    monthlySalary: annualSalary / 12,
    annualBonus: finiteNonNegative(model.profile.annualBonus),
    expenses: { ...model.profile.expenses }
  }
}

export function replaceModelProfile(model: AppModelV1, profile: CalculatorProfile): AppModelV1 {
  return {
    ...model,
    status: 'personalized',
    profile: { ...profile, expenses: { ...profile.expenses } },
    monthlyIncome: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, salary: finiteNonNegative(profile.monthlySalary) })),
    updatedAt: now()
  }
}

export function fingerprintFor(value: unknown) {
  const input = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function eventId(kind: string, fingerprint: string) {
  return `${kind}-${fingerprint}`
}

export function applyModelApplication(model: AppModelV1, application: ModelApplication): AppModelV1 {
  if (model.appliedFingerprints.includes(application.fingerprint)) return model
  const expenses = { ...model.profile.expenses }
  if (application.recurringExpenseDelta) {
    Object.entries(application.recurringExpenseDelta).forEach(([key, value]) => {
      const expenseKey = key as ExpenseKey
      expenses[expenseKey] = finiteNonNegative(expenses[expenseKey]) + finiteNonNegative(value)
    })
  }
  const incomingEvents = (application.events ?? []).filter(
    (event) => !model.events.some((existing) => existing.id === event.id || existing.fingerprint === event.fingerprint)
  )
  return {
    ...model,
    status: 'personalized',
    profile: { ...model.profile, ...application.profilePatch, expenses },
    events: [...model.events, ...incomingEvents],
    appliedFingerprints: [...model.appliedFingerprints, application.fingerprint],
    updatedAt: now()
  }
}

function housingRate(event: Extract<AnnualEvent, { type: 'housing' }>) {
  if (event.homeCount === 'other') return 0.03
  if (finiteNonNegative(event.area) <= 140) return 0.01
  return event.homeCount === 'first' ? 0.015 : 0.02
}

function eventTax(event: AnnualEvent, mode: EstimateMode): EventTaxBreakdown {
  if (event.type === 'consumption') {
    const amount = finiteNonNegative(event.amount)
    const meta = expenseMeta.find((item) => item.key === event.category)
    const included = Boolean(meta && (mode === 'central' ? meta.confidence !== 'unknown' : meta.confidence === 'high' || meta.key === 'fuel'))
    const vat = included && meta ? vatFromGross(amount, meta.vatRate) : 0
    const consumption = included && event.category === 'fuel' && finiteNonNegative(event.fuelPrice) > 0
      ? amount / finiteNonNegative(event.fuelPrice) * 1.52
      : 0
    return {
      eventId: event.id,
      month: event.month,
      title: event.title,
      type: event.type,
      directTax: 0,
      embeddedTax: vat + consumption,
      total: vat + consumption,
      confidence: event.confidence,
      note: included ? '按含税价格和所选消费类别计算。' : '当前估计口径不纳入该低可信消费类别。'
    }
  }

  if (event.type === 'housing') {
    const price = finiteNonNegative(event.price)
    const directTax = event.role === 'buyer'
      ? price * housingRate(event)
      : finiteNonNegative(event.holdingYears) < 2 ? price * 0.03 : 0
    return {
      eventId: event.id,
      month: event.month,
      title: event.title,
      type: event.type,
      directTax,
      embeddedTax: 0,
      total: directTax,
      confidence: event.confidence,
      note: event.role === 'buyer' ? '仅计入买方契税。' : '仅计入作为卖方时可识别的住房增值税。'
    }
  }

  if (event.type === 'vehicle') {
    const price = finiteNonNegative(event.price)
    const vat = vatFromGross(price, 0.13)
    const statutoryPurchaseTax = (price - vat) * 0.1
    const purchaseTax = event.energy === 'nev'
      ? statutoryPurchaseTax - Math.min(statutoryPurchaseTax * 0.5, 15_000)
      : statutoryPurchaseTax
    return {
      eventId: event.id,
      month: event.month,
      title: event.title,
      type: event.type,
      directTax: purchaseTax,
      embeddedTax: vat,
      total: purchaseTax + vat,
      confidence: event.confidence,
      note: '计入车辆购置税与含税车价中的增值税价税部分；不反推生产环节消费税。'
    }
  }

  const rate = event.kind === 'dividend'
    ? event.holdPeriod === 'short' ? 0.2 : event.holdPeriod === 'middle' ? 0.1 : 0
    : event.kind === 'restricted-transfer' ? 0.2 : 0
  const directTax = finiteNonNegative(event.amount) * rate
  return {
    eventId: event.id,
    month: event.month,
    title: event.title,
    type: event.type,
    directTax,
    embeddedTax: 0,
    total: directTax,
    confidence: event.confidence,
    note: event.kind === 'listed-transfer' ? '普通境内上市公司流通股转让所得暂免个人所得税。' : '按所选投资类型与持有期计算。'
  }
}

export function calculateAnnualModel(model: AppModelV1, estimateMode: EstimateMode): AnnualTaxResult {
  const profile = profileFromModel(model)
  const legacyMode = estimateMode === 'conservative' ? 'conservative' : 'neutral'
  const base = calculateProfile(profile, legacyMode)
  const eventBreakdowns = model.events.map((event) => eventTax(event, estimateMode))
  const eventEmbeddedTax = eventBreakdowns.reduce((sum, item) => sum + item.embeddedTax, 0)
  const investmentTax = eventBreakdowns.filter((item) => item.type === 'investment').reduce((sum, item) => sum + item.directTax, 0)
  const assetTransactionTax = eventBreakdowns
    .filter((item) => item.type === 'housing' || item.type === 'vehicle')
    .reduce((sum, item) => sum + item.directTax, 0)
  const eventTaxTotal = eventBreakdowns.reduce((sum, item) => sum + item.total, 0)
  const recurringEmbeddedTax = base.vatEstimate + base.consumptionTaxEstimate

  const annualSalary = model.monthlyIncome.reduce((sum, item) => sum + finiteNonNegative(item.salary), 0)
  const annualBonus = finiteNonNegative(profile.annualBonus)
  const socialInsurance = base.socialInsurance
  const housingFundMonthly = finiteNonNegative(profile.housingFundBase) * finiteNonNegative(profile.housingFundRate)
  const salaryTaxable = annualSalary - 60_000 - socialInsurance.taxDeductibleTotal - housingFundMonthly * 12 - finiteNonNegative(profile.specialDeductionMonthly) * 12
  const salaryIncomeTax = annualIncomeTax(salaryTaxable)
  const separateBonusTax = annualBonusIncomeTax(annualBonus)
  const incomeTaxIfSeparate = salaryIncomeTax + separateBonusTax
  const incomeTaxIfComprehensive = annualIncomeTax(salaryTaxable + annualBonus)
  const requested = isAnnualBonusSeparateTaxAvailable(profile.year) ? profile.annualBonusTaxMethod : 'comprehensive'
  const effectiveAnnualBonusTaxMethod = requested === 'optimal'
    ? incomeTaxIfSeparate < incomeTaxIfComprehensive ? 'separate' : 'comprehensive'
    : requested
  const bonusTaxTotal = effectiveAnnualBonusTaxMethod === 'separate'
    ? separateBonusTax
    : Math.max(0, incomeTaxIfComprehensive - salaryIncomeTax)
  const incomeTax = salaryIncomeTax + bonusTaxTotal

  let cumulativeTaxable = 0
  let cumulativePaid = 0
  const monthlySchedule: AnnualMonthlyPoint[] = model.monthlyIncome.map((input, index) => {
    const month = index + 1
    const monthlySocial = socialInsurance.months[index]
    const socialBase = monthlySocial.details.find((item) => item.insurance === 'pension')?.base ?? profile.socialInsuranceBase
    const personalSocial = monthlySocial.personalTotal
    cumulativeTaxable += finiteNonNegative(input.salary) - 5_000 - finiteNonNegative(profile.specialDeductionMonthly) - monthlySocial.taxDeductibleTotal - housingFundMonthly
    const cumulativeDue = annualIncomeTax(cumulativeTaxable)
    // A negative value represents a net withholding adjustment after an earlier high-income month.
    const salaryTax = cumulativeDue - cumulativePaid
    cumulativePaid = cumulativeDue
    const bonusTax = month === validMonth(model.annualBonusMonth) ? bonusTaxTotal : 0
    const monthEvents = eventBreakdowns.filter((item) => item.month === month)
    const embeddedTax = recurringEmbeddedTax / 12 + monthEvents.reduce((sum, item) => sum + item.embeddedTax, 0)
    const monthInvestmentTax = monthEvents.filter((item) => item.type === 'investment').reduce((sum, item) => sum + item.directTax, 0)
    const assetTax = monthEvents.filter((item) => item.type === 'housing' || item.type === 'vehicle').reduce((sum, item) => sum + item.directTax, 0)
    return {
      month,
      grossSalary: finiteNonNegative(input.salary),
      socialBase,
      socialInsurance: monthlySocial,
      employerSocial: monthlySocial.employerTotal,
      socialTaxDeduction: monthlySocial.taxDeductibleTotal,
      salaryIncomeTax: salaryTax,
      cumulativeIncomeTax: cumulativePaid,
      personalSocial,
      housingFund: housingFundMonthly,
      embeddedTax,
      bonusTax,
      investmentTax: monthInvestmentTax,
      assetTax,
      eventIds: monthEvents.map((item) => item.eventId),
      total: salaryTax + embeddedTax + bonusTax + monthInvestmentTax + assetTax
    }
  })

  const otherIncome = model.events
    .filter((event): event is Extract<AnnualEvent, { type: 'investment' }> => event.type === 'investment')
    .reduce((sum, event) => sum + finiteNonNegative(event.amount), 0)
  const annualCashIncome = annualSalary + annualBonus + otherIncome
  const identifiableTax = incomeTax + recurringEmbeddedTax + eventTaxTotal
  const burdenRatio = annualCashIncome > 0 ? identifiableTax / annualCashIncome : 0

  return {
    ...base,
    annualGross: annualSalary + annualBonus,
    incomeTax,
    salaryIncomeTax,
    annualBonusIncomeTax: bonusTaxTotal,
    incomeTaxIfSeparate,
    incomeTaxIfComprehensive,
    effectiveAnnualBonusTaxMethod,
    takeHome: annualSalary + annualBonus - incomeTax - base.personalSocial - base.housingFund,
    identifiableTax,
    cascadedTax: identifiableTax + base.surchargeEstimate,
    burdenRatio,
    freedomDay: Math.min(365, Math.max(0, Math.round(365 * burdenRatio))),
    estimateMode,
    monthlySchedule,
    eventBreakdowns,
    recurringEmbeddedTax,
    eventEmbeddedTax,
    investmentTax,
    assetTransactionTax,
    otherIncome,
    annualCashIncome,
    employmentTakeHome: annualSalary + annualBonus - incomeTax - base.personalSocial - base.housingFund
  }
}
