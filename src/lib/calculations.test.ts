import { describe, expect, it } from 'vitest'
import { initialExpenses } from '../data/expenseMeta'
import type { CalculatorProfile } from '../types'
import { annualBonusIncomeTax, annualIncomeTax, calculateProfile, incomeJourneyPerHundred, isAnnualBonusSeparateTaxAvailable, vatFromGross } from './calculations'

const profile: CalculatorProfile = {
  year: 2026,
  city: '上海',
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

describe('含税价格拆分', () => {
  it('使用 P × r / (1+r)，而不是 P × r', () => {
    expect(vatFromGross(100, .13)).toBeCloseTo(11.5044, 4)
    expect(vatFromGross(100, .09)).toBeCloseTo(8.2569, 4)
    expect(vatFromGross(100, .06)).toBeCloseTo(5.6604, 4)
  })
})

describe('年度综合所得税', () => {
  it('正确应用速算扣除数', () => {
    expect(annualIncomeTax(36_000)).toBe(1_080)
    expect(annualIncomeTax(144_000)).toBe(11_880)
    expect(annualIncomeTax(300_000)).toBe(43_080)
  })

  it('全年一次性奖金按月换算税率表单独计税', () => {
    expect(annualBonusIncomeTax(36_000)).toBe(1_080)
    expect(annualBonusIncomeTax(144_000)).toBe(14_190)
    expect(annualBonusIncomeTax(300_000)).toBe(58_590)
  })

  it('只在政策有效年度开放全年一次性奖金单独计税', () => {
    expect(isAnnualBonusSeparateTaxAvailable(2018)).toBe(false)
    expect(isAnnualBonusSeparateTaxAvailable(2019)).toBe(true)
    expect(isAnnualBonusSeparateTaxAvailable(2027)).toBe(true)
    expect(isAnnualBonusSeparateTaxAvailable(2028)).toBe(false)

    const afterExpiry = calculateProfile({
      ...profile,
      year: 2028,
      annualBonus: 36_000,
      annualBonusTaxMethod: 'separate'
    }, 'conservative')
    expect(afterExpiry.effectiveAnnualBonusTaxMethod).toBe('comprehensive')
    expect(afterExpiry.incomeTax).toBe(afterExpiry.incomeTaxIfComprehensive)
  })

  it('比较单独计税与并入综合所得，并按用户选择计算', () => {
    const withBonus = { ...profile, annualBonus: 36_000 }
    const optimal = calculateProfile(withBonus, 'conservative')
    const comprehensive = calculateProfile({ ...withBonus, annualBonusTaxMethod: 'comprehensive' }, 'conservative')

    expect(optimal.incomeTaxIfSeparate).toBe(7_980)
    expect(optimal.incomeTaxIfComprehensive).toBe(10_500)
    expect(optimal.incomeTax).toBe(7_980)
    expect(optimal.salaryIncomeTax).toBe(6_900)
    expect(optimal.annualBonusIncomeTax).toBe(1_080)
    expect(optimal.effectiveAnnualBonusTaxMethod).toBe('separate')
    expect(comprehensive.incomeTax).toBe(10_500)
    expect(comprehensive.annualBonusIncomeTax).toBe(3_600)
  })

  it('扣除额未用完时，自动模式会选择并入综合所得', () => {
    const lowIncome = calculateProfile({
      ...profile,
      monthlySalary: 0,
      annualBonus: 36_000,
      socialInsuranceBase: 0,
      housingFundBase: 0,
      specialDeductionMonthly: 0
    }, 'conservative')

    expect(lowIncome.incomeTaxIfSeparate).toBe(1_080)
    expect(lowIncome.incomeTaxIfComprehensive).toBe(0)
    expect(lowIncome.incomeTax).toBe(0)
    expect(lowIncome.effectiveAnnualBonusTaxMethod).toBe('comprehensive')
  })

  it('分别保留社保、公积金和个人所得税', () => {
    const result = calculateProfile(profile, 'conservative')
    expect(result.annualGross).toBe(216_000)
    expect(result.personalSocial).toBeCloseTo(22_680, 2)
    expect(result.housingFund).toBeCloseTo(15_120, 2)
    expect(result.incomeTax).toBeCloseTo(6_900, 2)
    expect(result.takeHome).toBeCloseTo(171_300, 2)
    expect(result.employerSocial).toBeCloseTo(55_512, 2)
    expect(result.employerHousingFund).toBeCloseTo(15_120, 2)
    expect(result.employerCost).toBeCloseTo(286_632, 2)
  })
})

describe('统计口径', () => {
  it('保守模式排除组合消费中的低可信模型项', () => {
    const conservative = calculateProfile(profile, 'conservative')
    const neutral = calculateProfile(profile, 'neutral')
    expect(neutral.vatEstimate).toBeGreaterThan(conservative.vatEstimate)
    expect(neutral.incomeTax).toBe(conservative.incomeTax)
    expect(conservative.conservativeEmbeddedTaxEstimate).toBeCloseTo(conservative.vatEstimate + conservative.consumptionTaxEstimate, 2)
    expect(neutral.centralEmbeddedTaxEstimate).toBeCloseTo(neutral.vatEstimate + neutral.consumptionTaxEstimate, 2)
    expect(conservative.conservativeEmbeddedTaxEstimate).toBeCloseTo(2_668.89, 2)
    expect(neutral.centralEmbeddedTaxEstimate).toBeCloseTo(5_019.89, 2)
    expect(neutral.consumptionSpendCoverage).toBeGreaterThan(conservative.consumptionSpendCoverage)
    expect(conservative.consumptionSpendCoverage).toBeCloseTo(36_000 / 120_360, 6)
    expect(neutral.consumptionSpendCoverage).toBeCloseTo(72_360 / 120_360, 6)
  })

  it('中性模式仍排除房租房贷、购车与未分类支出', () => {
    const neutral = calculateProfile(profile, 'neutral')
    const excluded = neutral.expenseTaxes.filter((item) => !item.includedInEstimate).map((item) => item.key)

    expect(excluded).toEqual(['housing', 'car', 'other'])
    expect(neutral.coveredConsumptionSpending).toBeLessThan(neutral.annualSpending)
  })

  it('按升数识别汽油生产/进口环节法定消费税额', () => {
    const fuelProfile = { ...profile, expenses: { ...profile.expenses, fuel: 810 } }
    const result = calculateProfile(fuelProfile, 'conservative')
    expect(result.consumptionTaxEstimate).toBeCloseTo(1_824, 2)
  })
})

describe('每 100 元税前收入分配', () => {
  it('所得税、个人缴费和到手收入严格合计为 100 元', () => {
    const result = calculateProfile(profile, 'conservative')
    const journey = incomeJourneyPerHundred(result)

    expect(journey.tax).toBe(3.2)
    expect(journey.contribution).toBe(17.5)
    expect(journey.takeHome).toBe(79.3)
    expect(journey.tax + journey.contribution + journey.takeHome).toBe(100)
  })

  it('零收入时返回稳定的空状态', () => {
    const result = calculateProfile({ ...profile, monthlySalary: 0, socialInsuranceBase: 0, housingFundBase: 0 }, 'conservative')
    const journey = incomeJourneyPerHundred(result)

    expect(journey.hasIncome).toBe(false)
    expect(journey.tax + journey.contribution + journey.takeHome).toBe(0)
    expect(journey.embeddedPerTakeHome).toBe(0)
  })

  it('异常扣减比例不会产生负数或超过 100 元的主分配', () => {
    const journey = incomeJourneyPerHundred({
      annualGross: 100,
      incomeTax: 120,
      personalSocial: 30,
      housingFund: 20,
      takeHome: -70,
      annualSpending: 200,
      vatEstimate: 10,
      consumptionTaxEstimate: 5
    })

    expect(journey.tax).toBe(100)
    expect(journey.contribution).toBe(0)
    expect(journey.takeHome).toBe(0)
    expect(journey.tax + journey.contribution + journey.takeHome).toBe(100)
  })

  it('消费高于到手收入时保留真实折算并标记资金口径', () => {
    const journey = incomeJourneyPerHundred({
      annualGross: 100,
      incomeTax: 10,
      personalSocial: 10,
      housingFund: 0,
      takeHome: 80,
      annualSpending: 120,
      vatEstimate: 12,
      consumptionTaxEstimate: 4
    })

    expect(journey.spendingShareOfTakeHome).toBe(150)
    expect(journey.embeddedPerTakeHome).toBe(20)
    expect(journey.spendingExceedsTakeHome).toBe(true)
  })

  it('模式切换不改变工资阶段的 100 元分配基准', () => {
    const conservative = incomeJourneyPerHundred(calculateProfile(profile, 'conservative'))
    const broad = incomeJourneyPerHundred(calculateProfile(profile, 'broad'))

    expect({ tax: broad.tax, contribution: broad.contribution, takeHome: broad.takeHome }).toEqual({
      tax: conservative.tax,
      contribution: conservative.contribution,
      takeHome: conservative.takeHome
    })
  })
})

describe('上海 2026 社保缴费基数', () => {
  it('按两个社保年度分别应用上下限', () => {
    const low = calculateProfile({ ...profile, socialInsuranceBase: 5_000 }, 'conservative')
    const high = calculateProfile({ ...profile, socialInsuranceBase: 50_000 }, 'conservative')
    expect(low.personalSocial).toBeCloseTo((7_460 * 6 + 7_546 * 6) * .105, 2)
    expect(high.personalSocial).toBeCloseTo((37_302 * 6 + 37_731 * 6) * .105, 2)
  })
})
