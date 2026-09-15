import { describe, expect, it } from 'vitest'
import { initialExpenses } from '../data/expenseMeta'
import type { CalculatorProfile } from '../types'
import { annualBonusCliffWarning, annualBonusIncomeTax, annualIncomeTax, calculateProfile, incomeJourneyPerHundred, isAnnualBonusSeparateTaxAvailable, monthlySocialInsuranceBase, monthlyTaxSchedule, surchargeFromTurnover, surchargeRateForTier, vatFromGross, vatOnConsumptionTax } from './calculations'

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
  socialRateMode: 'custom',
  socialInsuranceOptions: {},
  legacyShanghaiSocialBaseLimits: true,
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
  cityTier: 'urban',
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

  it('月缴费基数在 7 月切换到新的社保年度', () => {
    const floored = { ...profile, socialInsuranceBase: 5_000 }
    expect(monthlySocialInsuranceBase(floored, 1)).toBe(7_460)
    expect(monthlySocialInsuranceBase(floored, 6)).toBe(7_460)
    expect(monthlySocialInsuranceBase(floored, 7)).toBe(7_546)
    expect(monthlySocialInsuranceBase(floored, 12)).toBe(7_546)

    const capped = { ...profile, socialInsuranceBase: 50_000 }
    expect(monthlySocialInsuranceBase(capped, 6)).toBe(37_302)
    expect(monthlySocialInsuranceBase(capped, 7)).toBe(37_731)

    // 未启用上下限时按申报基数，全年不变
    const raw = { ...floored, applyCitySocialBaseLimits: false }
    expect(monthlySocialInsuranceBase(raw, 7)).toBe(5_000)
  })
})

describe('12 个月税费节奏', () => {
  it('每月预扣个税之和等于全年工资个税', () => {
    const result = calculateProfile(profile, 'neutral')
    const schedule = monthlyTaxSchedule(profile, result)
    const summed = schedule.reduce((sum, point) => sum + point.salaryIncomeTax, 0)

    expect(schedule).toHaveLength(12)
    expect(summed).toBeCloseTo(result.salaryIncomeTax, 6)
    expect(schedule[11].cumulativeIncomeTax).toBeCloseTo(result.salaryIncomeTax, 6)
  })

  it('呈现累计预扣法的真实节奏，而不是 12 个相同的均值', () => {
    const result = calculateProfile(profile, 'neutral')
    const schedule = monthlyTaxSchedule(profile, result)
    const taxes = schedule.map((point) => point.salaryIncomeTax)

    // 关键回归：修复前 12 个月完全相同，图表零信息量
    expect(new Set(taxes.map((value) => value.toFixed(2))).size).toBeGreaterThan(1)
    // 累计应纳税所得额单调递增，故预扣税额非递减
    for (let index = 1; index < taxes.length; index += 1) {
      expect(taxes[index]).toBeGreaterThanOrEqual(taxes[index - 1] - 1e-9)
    }
    // 年初处于最低档，年末已跨档
    expect(taxes[0]).toBeCloseTo(235.5, 2)
    expect(taxes[11]).toBeCloseTo(785, 2)
    expect(taxes[0]).toBeLessThan(taxes[11])
  })

  it('奖金税额集中计入 12 月，且不改动其他月份', () => {
    const withBonus = { ...profile, annualBonus: 36_000 }
    const result = calculateProfile(withBonus, 'neutral')
    const schedule = monthlyTaxSchedule(withBonus, result)

    expect(schedule.slice(0, 11).every((point) => point.bonusTax === 0)).toBe(true)
    expect(schedule[11].bonusTax).toBeCloseTo(result.annualBonusIncomeTax, 6)
    expect(schedule[11].total - schedule[10].total).toBeCloseTo(
      result.annualBonusIncomeTax + schedule[11].salaryIncomeTax - schedule[10].salaryIncomeTax,
      6
    )
  })

  it('月度合计只含税，不含社保与公积金', () => {
    const result = calculateProfile(profile, 'neutral')
    const schedule = monthlyTaxSchedule(profile, result)

    schedule.forEach((point) => {
      expect(point.total).toBeCloseTo(point.salaryIncomeTax + point.embeddedTax + point.bonusTax, 6)
    })
    // 全年月度合计 = 工资个税 + 消费内含税（不含奖金时）
    const annualTotal = schedule.reduce((sum, point) => sum + point.total, 0)
    expect(annualTotal).toBeCloseTo(result.salaryIncomeTax + result.vatEstimate + result.consumptionTaxEstimate, 4)
  })

  it('零收入时返回全零且不产生负数', () => {
    const noIncome = { ...profile, monthlySalary: 0, annualBonus: 0, socialInsuranceBase: 0, housingFundBase: 0 }
    const result = calculateProfile(noIncome, 'conservative')
    const schedule = monthlyTaxSchedule(noIncome, result)

    schedule.forEach((point) => {
      expect(point.salaryIncomeTax).toBe(0)
      expect(point.total).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('附加税费与税上税（重复征税）', () => {
  it('城建税按所在地分档，附加合计为 12% / 10% / 6%', () => {
    expect(surchargeRateForTier('urban')).toBeCloseTo(0.12, 6)
    expect(surchargeRateForTier('county')).toBeCloseTo(0.10, 6)
    expect(surchargeRateForTier('other')).toBeCloseTo(0.06, 6)
  })

  it('附加税费以（增值税 + 消费税）为计税依据', () => {
    expect(surchargeFromTurnover(43.14, 76, 'urban')).toBeCloseTo(119.14 * 0.12, 2)
    expect(surchargeFromTurnover(0, 0, 'urban')).toBe(0)
  })

  it('增值税中对消费税征收的部分 = 消费税额 × 增值税率', () => {
    expect(vatOnConsumptionTax(76, 0.13)).toBeCloseTo(9.88, 2)
    expect(vatOnConsumptionTax(150, 0.13)).toBeCloseTo(19.5, 2)
    expect(vatOnConsumptionTax(0, 0.13)).toBe(0)
  })

  it('附加税费与税上税单列，不并入可识别税费', () => {
    const result = calculateProfile(profile, 'neutral')
    expect(result.identifiableTax).toBeCloseTo(result.incomeTax + result.vatEstimate + result.consumptionTaxEstimate, 2)
    expect(result.cascadedTax).toBeCloseTo(result.identifiableTax + result.surchargeEstimate, 2)
    expect(result.surchargeEstimate).toBeGreaterThan(0)
    expect(result.taxOnTaxEstimate).toBeGreaterThanOrEqual(result.surchargeEstimate)
  })

  it('附加税费等于逐项之和，且费率取自所在地档次', () => {
    const result = calculateProfile(profile, 'conservative')
    const summed = result.expenseTaxes.reduce((sum, item) => sum + item.surcharge, 0)
    expect(result.surchargeEstimate).toBeCloseTo(summed, 2)
    expect(result.surchargeRate).toBeCloseTo(0.12, 6)
  })

  it('县城和镇口径的附加税费低于市区', () => {
    const urban = calculateProfile(profile, 'neutral')
    const county = calculateProfile({ ...profile, cityTier: 'county' }, 'neutral')
    expect(county.surchargeEstimate).toBeLessThan(urban.surchargeEstimate)
    expect(county.surchargeEstimate / urban.surchargeEstimate).toBeCloseTo(10 / 12, 4)
  })

  it('汽油场景的附加税费与税上税可复算', () => {
    const fuelProfile = { ...profile, expenses: { ...profile.expenses, fuel: 810 } }
    const result = calculateProfile(fuelProfile, 'conservative')
    const fuel = result.expenseTaxes.find((item) => item.key === 'fuel')!
    expect(fuel.consumptionTax).toBeCloseTo(1_824, 2)
    expect(fuel.vat).toBeCloseTo(vatFromGross(9_720, 0.13), 2)
    expect(fuel.surcharge).toBeCloseTo((fuel.vat + fuel.consumptionTax) * 0.12, 2)
    expect(fuel.taxOnTax).toBeCloseTo(vatOnConsumptionTax(fuel.consumptionTax, 0.13) + fuel.surcharge, 2)
  })
})

describe('年终奖临界点', () => {
  it('跨过 36000 元后提示多缴税额', () => {
    expect(annualBonusCliffWarning(36_000)).toBeNull()
    const warning = annualBonusCliffWarning(36_100)
    expect(warning).not.toBeNull()
    expect(warning!.cliff).toBe(36_000)
    expect(warning!.extra).toBeCloseTo(annualBonusIncomeTax(36_100) - annualBonusIncomeTax(36_000), 2)
    expect(warning!.extra).toBeGreaterThan(2_000)
  })

  it('远离临界点时不再提示', () => {
    expect(annualBonusCliffWarning(50_000)).toBeNull()
    expect(annualBonusCliffWarning(0)).toBeNull()
  })
})
