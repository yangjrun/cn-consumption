export type Confidence = 'exact' | 'high' | 'model' | 'unknown'
export type ViewMode = 'conservative' | 'neutral' | 'broad'
export type AnnualBonusTaxMethod = 'optimal' | 'separate' | 'comprehensive'

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
  monthlySalary: number
  annualBonus: number
  annualBonusTaxMethod: AnnualBonusTaxMethod
  specialDeductionMonthly: number
  socialInsuranceBase: number
  housingFundBase: number
  applyCitySocialBaseLimits: boolean
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

export interface TaxResult {
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
  conservativeEmbeddedTaxEstimate: number
  centralEmbeddedTaxEstimate: number
  coveredConsumptionSpending: number
  consumptionSpendCoverage: number
  identifiableTax: number
  immediateConsumptionValue: number
  burdenRatio: number
  freedomDay: number
  expenseTaxes: Array<{
    key: ExpenseKey
    label: string
    spend: number
    vat: number
    consumptionTax: number
    total: number
    confidence: Confidence
    includedInEstimate: boolean
  }>
}
