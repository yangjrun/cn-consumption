export type SocialInsuranceKind = 'pension' | 'medical' | 'unemployment' | 'injury' | 'maternity' | 'medicalSupplement' | 'localPension'
export type SocialRateMode = 'official' | 'custom'
export interface SocialInsuranceOptions {
  /** Shenzhen: local employees must select tier 1. No condition is inferred from the previous city. */
  medicalTier?: 'tier1' | 'tier2'
  hukou?: 'local' | 'nonlocal'
  /** Actual employer-approved rate; undefined means use the explicitly labelled industry baseline. */
  injuryRateOverride?: number
}
export interface CustomSocialContribution {
  base?: number
  personalRate?: number
  employerRate?: number
  personalFixed?: number
  employerFixed?: number
  taxDeductible?: boolean
}
export interface SocialRuleSource {
  id: string
  title: string
  publisher: string
  url: string
  publishedAt: string
  verifiedAt: string
  /** Verbatim or tightly scoped extract checked against the original. */
  evidence: string
}
export interface SocialRulePeriod {
  id: string
  city: string
  effectiveFrom: string
  effectiveTo: string | null
  population: string
  conditions?: Pick<SocialInsuranceOptions, 'medicalTier' | 'hukou'>
  sourceIds: string[]
  note?: string
}
export interface SocialBaseRule extends SocialRulePeriod {
  insurances: SocialInsuranceKind[]
  basis: 'salary' | 'reference' | 'none'
  lower?: number
  upper?: number | null
  reference?: number
}
export interface SocialRateRule extends SocialRulePeriod {
  insurance: SocialInsuranceKind
  personalRate: number
  employerRate: number
  personalFixed?: number
  employerFixed?: number
  taxDeductible: boolean
  includes?: SocialInsuranceKind[]
  /** An allocation from the medical account/fund, not another payroll deduction. */
  paymentSource?: 'payroll' | 'medical-account'
  employerRateRange?: [number, number]
}
export interface SocialInsuranceRuleData {
  version: 1
  supportedYears: number[]
  cities: Array<{
    name: string
    insurances: SocialInsuranceKind[]
    requiredOptions: Array<'medicalTier' | 'hukou'>
    note: string
  }>
  sources: SocialRuleSource[]
  baseRules: SocialBaseRule[]
  rateRules: SocialRateRule[]
}
export type SocialCoverage = 'official' | 'custom' | 'missing' | 'included' | 'legacy'
export interface SocialInsuranceDetail {
  insurance: SocialInsuranceKind
  label: string
  base: number | null
  lower: number | null
  upper: number | null
  basis: SocialBaseRule['basis'] | 'manual'
  personalRate: number | null
  employerRate: number | null
  personalFixed: number
  employerFixed: number
  personalAmount: number | null
  employerAmount: number | null
  taxDeductibleAmount: number | null
  accountTransfer: number
  baseCoverage: SocialCoverage
  rateCoverage: SocialCoverage
  baseRuleId?: string
  rateRuleId?: string
  includedIn?: SocialInsuranceKind
  employerRateOrigin: 'official' | 'baseline' | 'user' | 'missing'
  sourceIds: string[]
  notes: string[]
}
export interface SocialInsuranceMonth {
  month: number
  details: SocialInsuranceDetail[]
  /** Known contribution subtotals; check complete before presenting these as final amounts. */
  personalTotal: number
  employerTotal: number
  taxDeductibleTotal: number
  baseComplete: boolean
  rateComplete: boolean
  complete: boolean
  issues: string[]
  assumptions: string[]
  changeReasons: string[]
}
export interface SocialInsuranceYear {
  months: SocialInsuranceMonth[]
  personalTotal: number
  employerTotal: number
  taxDeductibleTotal: number
  complete: boolean
  issues: string[]
  assumptions: string[]
  sourceIds: string[]
}
