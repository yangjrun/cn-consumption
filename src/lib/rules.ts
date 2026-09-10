import type { TaxRule } from '../types'

export function rulesForYear(rules: TaxRule[], year: number) {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  return rules.filter((rule) => rule.effective_from <= end && (!rule.effective_to || rule.effective_to >= start))
}
