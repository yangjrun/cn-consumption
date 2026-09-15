import { initialExpenses } from '../data/expenseMeta'
import type { CalculatorProfile } from '../types'

/** Used by local v0 profiles, v1 models and both share-link formats. */
export function normalizeCalculatorProfile(raw: Partial<CalculatorProfile>, fallback: CalculatorProfile): CalculatorProfile {
  const legacy = raw.socialRateMode !== 'official' && raw.socialRateMode !== 'custom'
  const salary = typeof raw.monthlySalary === 'number' && Number.isFinite(raw.monthlySalary)
    ? Math.max(0, raw.monthlySalary) : fallback.monthlySalary
  const city = typeof raw.city === 'string' ? raw.city : fallback.city
  const year = typeof raw.year === 'number' && Number.isInteger(raw.year) ? raw.year : fallback.year
  const options = raw.socialInsuranceOptions ?? {}
  const enabled = typeof raw.applyCitySocialBaseLimits === 'boolean' ? raw.applyCitySocialBaseLimits : fallback.applyCitySocialBaseLimits
  return {
    ...fallback, ...raw, city, year, monthlySalary: salary,
    socialInsuranceBase: typeof raw.socialInsuranceBase === 'number' && Number.isFinite(raw.socialInsuranceBase) ? Math.max(0, raw.socialInsuranceBase) : salary,
    housingFundBase: typeof raw.housingFundBase === 'number' && Number.isFinite(raw.housingFundBase) ? Math.max(0, raw.housingFundBase) : salary,
    annualBonusTaxMethod: raw.annualBonusTaxMethod === 'separate' || raw.annualBonusTaxMethod === 'comprehensive' || raw.annualBonusTaxMethod === 'optimal'
      ? raw.annualBonusTaxMethod : fallback.annualBonusTaxMethod,
    socialRateMode: legacy ? 'custom' : raw.socialRateMode!,
    // Before this release the checkbox only affected Shanghai 2026.
    applyCitySocialBaseLimits: legacy ? enabled && city === '上海' && year === 2026 : enabled,
    legacyShanghaiSocialBaseLimits: legacy ? enabled && city === '上海' && year === 2026 : raw.legacyShanghaiSocialBaseLimits,
    socialInsuranceOptions: {
      medicalTier: options.medicalTier === 'tier1' || options.medicalTier === 'tier2' ? options.medicalTier : undefined,
      hukou: options.hukou === 'local' || options.hukou === 'nonlocal' ? options.hukou : undefined,
      injuryRateOverride: typeof options.injuryRateOverride === 'number' ? options.injuryRateOverride : undefined
    },
    customSocialContributions: raw.customSocialContributions ?? {},
    expenses: { ...initialExpenses, ...raw.expenses }
  }
}
