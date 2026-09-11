import { describe, expect, it } from 'vitest'
import { initialExpenses } from '../data/expenseMeta'
import type { AppModelV1, CalculatorProfile, ModelApplication } from '../types'
import {
  applyModelApplication,
  calculateAnnualModel,
  modelFromProfile,
  normalizeAnnualModel,
  profileFromModel,
  replaceModelProfile
} from './annualModel'

const profile: CalculatorProfile = {
  year: 2026,
  city: '上海',
  cityTier: 'urban',
  monthlySalary: 18_000,
  annualBonus: 0,
  annualBonusTaxMethod: 'optimal',
  specialDeductionMonthly: 2_000,
  socialInsuranceBase: 18_000,
  housingFundBase: 18_000,
  applyCitySocialBaseLimits: true,
  pensionRate: .08,
  medicalRate: .02,
  unemploymentRate: .005,
  housingFundRate: .07,
  employerPensionRate: .16,
  employerMedicalRate: .09,
  employerUnemploymentRate: .005,
  employerInjuryRate: .002,
  employerHousingFundRate: .07,
  fuelPrice: 8.1,
  expenses: initialExpenses
}

const emptyExpenses = Object.fromEntries(Object.keys(initialExpenses).map((key) => [key, 0])) as CalculatorProfile['expenses']

describe('AppModelV1', () => {
  it('从 v0 profile 迁移为 12 个月工资并保留消费篮子', () => {
    const model = modelFromProfile(profile)
    expect(model.version).toBe(1)
    expect(model.monthlyIncome).toHaveLength(12)
    expect(model.monthlyIncome.every((item) => item.salary === 18_000)).toBe(true)
    expect(profileFromModel(model).expenses).toEqual(profile.expenses)
  })

  it('损坏模型回退为明确标记的示例模型', () => {
    const model = normalizeAnnualModel({ version: 1, profile: null }, profile)
    expect(model.status).toBe('sample')
    expect(model.monthlyIncome).toHaveLength(12)
  })

  it('替换情景时重填 12 个月工资但保留已确认事件', () => {
    const initial = modelFromProfile(profile)
    initial.events = [{ id: 'x', fingerprint: 'x', type: 'investment', month: 3, title: '股息', confidence: 'high', kind: 'dividend', amount: 1000, holdPeriod: 'long' }]
    const replaced = replaceModelProfile(initial, { ...profile, monthlySalary: 25_000 })
    expect(replaced.monthlyIncome.every((item) => item.salary === 25_000)).toBe(true)
    expect(replaced.events).toHaveLength(1)
  })
})
describe('统一年度计算', () => {
  it('默认模型呈现累计预扣节奏且月度合计等于年度可识别税费', () => {
    const result = calculateAnnualModel(modelFromProfile(profile), 'central')
    const totals = result.monthlySchedule.map((item) => item.total)
    expect(new Set(totals.map((item) => item.toFixed(2))).size).toBeGreaterThan(1)
    expect(result.monthlySchedule.reduce((sum, item) => sum + item.total, 0)).toBeCloseTo(result.identifiableTax, 6)
    expect(result.monthlySchedule[0].salaryIncomeTax).toBeCloseTo(235.5, 2)
    expect(result.monthlySchedule[11].salaryIncomeTax).toBeCloseTo(785, 2)
  })

  it('允许依法得到 12 个相同月份而不制造差异', () => {
    const model = modelFromProfile({ ...profile, monthlySalary: 0, annualBonus: 0, socialInsuranceBase: 0, housingFundBase: 0, expenses: emptyExpenses })
    const result = calculateAnnualModel(model, 'conservative')
    expect(new Set(result.monthlySchedule.map((item) => item.total))).toEqual(new Set([0]))
  })

  it('逐月工资、奖金月份与 7 月社保基数分别进入正确月份', () => {
    const model = modelFromProfile({ ...profile, annualBonus: 36_000, socialInsuranceBase: 5_000 })
    model.annualBonusMonth = 6
    model.monthlyIncome[11].salary = 30_000
    const result = calculateAnnualModel(model, 'central')
    expect(result.monthlySchedule[5].bonusTax).toBeGreaterThan(0)
    expect(result.monthlySchedule.filter((item) => item.month !== 6).every((item) => item.bonusTax === 0)).toBe(true)
    expect(result.monthlySchedule[5].socialBase).toBe(7_460)
    expect(result.monthlySchedule[6].socialBase).toBe(7_546)
    expect(result.monthlySchedule.reduce((sum, item) => sum + item.salaryIncomeTax, 0)).toBeCloseTo(result.salaryIncomeTax, 6)
  })

  it('房车与投资事件只进入指定月份并遵守交易角色', () => {
    const model = modelFromProfile({ ...profile, expenses: emptyExpenses })
    model.events = [
      { id: 'home', fingerprint: 'home', type: 'housing', month: 2, title: '买房', confidence: 'high', role: 'buyer', price: 3_000_000, area: 90, homeCount: 'first', holdingYears: 0 },
      { id: 'sale', fingerprint: 'sale', type: 'housing', month: 4, title: '卖房', confidence: 'high', role: 'seller', price: 2_000_000, area: 90, homeCount: 'first', holdingYears: 3 },
      { id: 'car', fingerprint: 'car', type: 'vehicle', month: 5, title: '购车', confidence: 'high', price: 150_000, energy: 'fuel', engine: 1.5, imported: false },
      { id: 'dividend', fingerprint: 'dividend', type: 'investment', month: 8, title: '股息', confidence: 'high', kind: 'dividend', amount: 10_000, holdPeriod: 'middle' }
    ]
    const result = calculateAnnualModel(model, 'central')
    expect(result.monthlySchedule[1].assetTax).toBeCloseTo(30_000, 2)
    expect(result.monthlySchedule[3].assetTax).toBe(0)
    expect(result.monthlySchedule[4].assetTax).toBeGreaterThan(0)
    expect(result.monthlySchedule[7].investmentTax).toBe(1_000)
    expect(result.assetTransactionTax).toBeGreaterThan(30_000)
  })

  it('保守口径排除低可信消费事件，中性口径纳入', () => {
    const model = modelFromProfile({ ...profile, expenses: emptyExpenses })
    model.events = [{ id: 'food', fingerprint: 'food', type: 'consumption', month: 9, title: '食品组合', confidence: 'model', category: 'groceries', amount: 1000 }]
    expect(calculateAnnualModel(model, 'conservative').eventEmbeddedTax).toBe(0)
    expect(calculateAnnualModel(model, 'central').eventEmbeddedTax).toBeGreaterThan(0)
  })
})

describe('显式应用与去重', () => {
  it('确认应用后才变化，同一指纹不会重复写入', () => {
    const model = modelFromProfile(profile)
    const application: ModelApplication = {
      fingerprint: 'coffee-once',
      title: '咖啡',
      description: '仅一次',
      events: [{ id: 'coffee', fingerprint: 'coffee', applicationFingerprint: 'coffee-once', type: 'consumption', month: 1, title: '咖啡', confidence: 'high', category: 'dining', amount: 25 }]
    }
    const before = calculateAnnualModel(model, 'central')
    const applied = applyModelApplication(model, application)
    const after = calculateAnnualModel(applied, 'central')
    const repeated = applyModelApplication(applied, application)
    expect(before.identifiableTax).toBeLessThan(after.identifiableTax)
    expect(applied.events).toHaveLength(1)
    expect(repeated).toBe(applied)
  })

  it('月度重复消费写入固定篮子而不是创建 12 个事件', () => {
    const model = modelFromProfile({ ...profile, expenses: emptyExpenses })
    const application: ModelApplication = { fingerprint: 'coffee-monthly', title: '咖啡', description: '每月', recurringExpenseDelta: { dining: 25 } }
    const applied = applyModelApplication(model, application)
    expect(applied.profile.expenses.dining).toBe(25)
    expect(applied.events).toHaveLength(0)
    expect(calculateAnnualModel(applied, 'central').recurringEmbeddedTax).toBeGreaterThan(0)
  })
})
