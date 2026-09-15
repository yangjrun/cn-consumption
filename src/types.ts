import type { CustomSocialContribution, SocialInsuranceKind, SocialInsuranceMonth, SocialInsuranceOptions, SocialInsuranceYear, SocialRateMode } from './lib/socialInsuranceTypes'

export type Confidence = 'exact' | 'high' | 'model' | 'unknown'
export type ViewMode = 'conservative' | 'neutral' | 'broad'
export type EstimateMode = 'conservative' | 'central'
export type AnnualBonusTaxMethod = 'optimal' | 'separate' | 'comprehensive'

/** v1 应用内的五个一级入口。旧页面标识由路由兼容层映射到 section。 */
export type Page =
  | 'dashboard'
  | 'explore'
  | 'scenarios'
  | 'bill'
  | 'rules'

export type LegacyPage = 'lab' | 'assets' | 'day' | 'life' | 'investment' | 'compare'
export type ExploreSection = 'transaction' | 'day' | 'assets' | 'investment'
export type ScenarioSection = 'compare' | 'lifetime'

/**
 * 12 个月税费节奏的一个数据点。
 * 工资个税按《个人所得税扣缴申报管理办法（试行）》的累计预扣法逐月推算，
 * 因此年初低、跨档后抬升，而不是全年 1/12 的均摊值。
 */
export interface MonthlyTaxPoint {
  month: number
  /** 养老基数兼容字段；各险种实际基数、费率与覆盖情况见 socialInsurance。 */
  socialBase: number
  socialInsurance: SocialInsuranceMonth
  employerSocial: number
  socialTaxDeduction: number
  /** 当月工资薪金预扣预缴个人所得税额。 */
  salaryIncomeTax: number
  /** 截至当月的累计已预扣个税。 */
  cumulativeIncomeTax: number
  /** 当月个人社保缴费（不属于税，仅用于解释扣除额变化）。 */
  personalSocial: number
  /** 当月住房公积金（不属于税）。 */
  housingFund: number
  /** 当月消费价格内含税估算（按月均摊）。 */
  embeddedTax: number
  /** 当月集中计入的全年一次性奖金税额，仅 12 月非零。 */
  bonusTax: number
  /** 当月可识别税费合计 = 工资个税 + 消费内含税 + 奖金个税。不含社保与公积金。 */
  total: number
}

/**
 * 纳税人所在地档次——决定城市维护建设税税率（7% / 5% / 1%）。
 * 见《中华人民共和国城市维护建设税法》第四条。
 */
export type CityTier = 'urban' | 'county' | 'other'

export type ExpenseKey =
  | 'housing'
  | 'dining'
  | 'groceries'
  | 'clothing'
  | 'electronics'
  | 'utilities'
  | 'telecom'
  | 'transport'
  | 'fuel'
  | 'travel'
  | 'entertainment'
  | 'medical'
  | 'education'
  | 'tobacco'
  | 'alcohol'
  | 'car'
  | 'other'

export interface CalculatorProfile {
  year: number
  city: string
  cityTier: CityTier
  monthlySalary: number
  annualBonus: number
  annualBonusTaxMethod: AnnualBonusTaxMethod
  specialDeductionMonthly: number
  socialInsuranceBase: number
  housingFundBase: number
  applyCitySocialBaseLimits: boolean
  socialRateMode: SocialRateMode
  socialInsuranceOptions: SocialInsuranceOptions
  customSocialContributions?: Partial<Record<SocialInsuranceKind, CustomSocialContribution>>
  /** Migration marker for the original Shanghai 2026 bounds. */
  legacyShanghaiSocialBaseLimits?: boolean
  pensionRate: number
  medicalRate: number
  unemploymentRate: number
  housingFundRate: number
  employerPensionRate: number
  employerMedicalRate: number
  employerUnemploymentRate: number
  employerInjuryRate: number
  employerHousingFundRate: number
  fuelPrice: number
  expenses: Record<ExpenseKey, number>
}

export interface MonthlyIncomeInput {
  month: number
  salary: number
}

interface AnnualEventBase {
  id: string
  fingerprint: string
  applicationFingerprint?: string
  month: number
  title: string
  confidence: Confidence
}

export interface ConsumptionAnnualEvent extends AnnualEventBase {
  type: 'consumption'
  category: ExpenseKey
  amount: number
  fuelPrice?: number
}

export interface HousingAnnualEvent extends AnnualEventBase {
  type: 'housing'
  role: 'buyer' | 'seller'
  price: number
  area: number
  homeCount: 'first' | 'second' | 'other'
  holdingYears: number
}

export interface VehicleAnnualEvent extends AnnualEventBase {
  type: 'vehicle'
  price: number
  energy: 'fuel' | 'nev'
  engine: number
  imported: boolean
}

export interface InvestmentAnnualEvent extends AnnualEventBase {
  type: 'investment'
  kind: 'dividend' | 'listed-transfer' | 'restricted-transfer'
  amount: number
  holdPeriod?: 'short' | 'middle' | 'long'
}

export type AnnualEvent =
  | ConsumptionAnnualEvent
  | HousingAnnualEvent
  | VehicleAnnualEvent
  | InvestmentAnnualEvent

/**
 * 浏览器本地保存的年度模型。profile 保留现有稳定字段；逐月工资与一次性事件
 * 在 v1 中独立建模，避免把年度值机械除以 12。
 */
export interface AppModelV1 {
  version: 1
  status: 'sample' | 'personalized'
  profile: CalculatorProfile
  monthlyIncome: MonthlyIncomeInput[]
  annualBonusMonth: number
  events: AnnualEvent[]
  appliedFingerprints: string[]
  updatedAt: string
}

export interface ModelApplication {
  fingerprint: string
  title: string
  description: string
  events?: AnnualEvent[]
  recurringExpenseDelta?: Partial<Record<ExpenseKey, number>>
  profilePatch?: Partial<CalculatorProfile>
}

export interface EventTaxBreakdown {
  eventId: string
  month: number
  title: string
  type: AnnualEvent['type']
  directTax: number
  embeddedTax: number
  total: number
  confidence: Confidence
  note: string
}

export interface AnnualMonthlyPoint {
  month: number
  grossSalary: number
  socialBase: number
  socialInsurance: SocialInsuranceMonth
  employerSocial: number
  socialTaxDeduction: number
  salaryIncomeTax: number
  cumulativeIncomeTax: number
  personalSocial: number
  housingFund: number
  embeddedTax: number
  bonusTax: number
  investmentTax: number
  assetTax: number
  eventIds: string[]
  total: number
}

export interface TaxRule {
  id: string
  category: string
  tax_name: string
  rate_type: 'ad_valorem' | 'specific' | 'compound' | 'exempt'
  rate: number | null
  fixed_rate: number | null
  unit?: string
  calculation_method: string
  taxpayer: string
  tax_base: string
  taxable_stage: string
  effective_from: string
  effective_to: string | null
  source_url: string
  source_title: string
  last_verified: string
  confidence: Confidence
}

export interface ExpenseMeta {
  key: ExpenseKey
  label: string
  shortLabel: string
  vatRate: number
  confidence: Confidence
  note: string
}

export interface ExpenseTaxBreakdown {
  key: ExpenseKey
  label: string
  spend: number
  vat: number
  consumptionTax: number
  /**
   * 附加税费（城建税 + 教育费附加 + 地方教育附加）＝（增值税 + 消费税）× 附加率。
   * 以流转税为计税依据，属"税上税"；法定纳税人是经营者，
   * 是否最终转嫁给消费者无法从零售价反推，故不并入 identifiableTax。
   */
  surcharge: number
  /**
   * "税上税"合计 = 增值税中对消费税征收的部分 + 附加税费。
   * 仅用于展示级联结构，不并入 identifiableTax。
   */
  taxOnTax: number
  total: number
  confidence: Confidence
  includedInEstimate: boolean
}

export interface TaxResult {
  socialInsurance: SocialInsuranceYear
  annualGross: number
  incomeTax: number
  salaryIncomeTax: number
  annualBonusIncomeTax: number
  incomeTaxIfSeparate: number
  incomeTaxIfComprehensive: number
  effectiveAnnualBonusTaxMethod: Exclude<AnnualBonusTaxMethod, 'optimal'>
  personalSocial: number
  housingFund: number
  employerSocial: number
  employerHousingFund: number
  employerContributions: number
  employerCost: number
  takeHome: number
  annualSpending: number
  vatEstimate: number
  consumptionTaxEstimate: number
  /** 当前所在地档次的附加税费合计费率（市区 12%、县镇 10%、其他 6%）。 */
  surchargeRate: number
  /** 附加税费估算（税上税，不计入 identifiableTax）。 */
  surchargeEstimate: number
  /** "税上税"合计：增值税中对消费税征收的部分 + 附加税费。 */
  taxOnTaxEstimate: number
  /** 级联口径：identifiableTax + surchargeEstimate，用于展示"含税上税"的广义负担。 */
  cascadedTax: number
  conservativeEmbeddedTaxEstimate: number
  centralEmbeddedTaxEstimate: number
  coveredConsumptionSpending: number
  consumptionSpendCoverage: number
  identifiableTax: number
  immediateConsumptionValue: number
  burdenRatio: number
  freedomDay: number
  expenseTaxes: ExpenseTaxBreakdown[]
}

/** 聚合后的 v1 年度账本；旧 TaxResult 字段继续供历史视图和公式复用。 */
export interface AnnualTaxResult extends TaxResult {
  estimateMode: EstimateMode
  monthlySchedule: AnnualMonthlyPoint[]
  eventBreakdowns: EventTaxBreakdown[]
  recurringEmbeddedTax: number
  eventEmbeddedTax: number
  investmentTax: number
  assetTransactionTax: number
  otherIncome: number
  annualCashIncome: number
  employmentTakeHome: number
}
