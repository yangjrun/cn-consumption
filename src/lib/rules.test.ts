import { describe, expect, it } from 'vitest'
import taxRules from '../data/tax_rules.json'
import type { TaxRule } from '../types'
import { rulesForYear } from './rules'

describe('按年份选择规则', () => {
  const rules = taxRules as TaxRule[]

  it('2015 年使用 17% 一般货物增值税规则', () => {
    const selected = rulesForYear(rules, 2015)
    expect(selected.some((rule) => rule.id === 'vat-goods-2015')).toBe(true)
    expect(selected.some((rule) => rule.id === 'vat-goods-2026')).toBe(false)
  })

  it('2020 年使用 13% 过渡条例规则，2026 年切换增值税法', () => {
    expect(rulesForYear(rules, 2020).some((rule) => rule.id === 'vat-goods-2019-2025')).toBe(true)
    expect(rulesForYear(rules, 2026).some((rule) => rule.id === 'vat-goods-2026')).toBe(true)
    expect(rulesForYear(rules, 2026).some((rule) => rule.id === 'vat-goods-2019-2025')).toBe(false)
  })

  it('2026 年包含全年一次性奖金单独计税政策', () => {
    expect(rulesForYear(rules, 2026).some((rule) => rule.id === 'iit-annual-bonus-2024-2027')).toBe(true)
    expect(rulesForYear(rules, 2020).some((rule) => rule.id === 'iit-annual-bonus-2019-2021')).toBe(true)
    expect(rulesForYear(rules, 2022).some((rule) => rule.id === 'iit-annual-bonus-2022-2023')).toBe(true)
  })
})
