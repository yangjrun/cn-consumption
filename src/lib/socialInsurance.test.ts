import { describe, expect, it } from 'vitest'
import { defaultProfile } from '../data/defaultProfile'
import type { CalculatorProfile } from '../types'
import {
  calculateSocialInsuranceMonth,
  calculateSocialInsuranceYear,
  socialInsurancePeriods,
  socialInsuranceRules,
  withSocialCity,
  withSocialRateMode
} from './socialInsurance'
import { normalizeCalculatorProfile } from './profileNormalization'
import type { SocialInsuranceDetail, SocialInsuranceKind } from './socialInsuranceTypes'

const profile = (overrides: Partial<CalculatorProfile> = {}): CalculatorProfile => ({
  ...defaultProfile,
  ...overrides,
  socialInsuranceOptions: { ...defaultProfile.socialInsuranceOptions, ...(overrides.socialInsuranceOptions ?? {}) }
})

const detail = (month: ReturnType<typeof calculateSocialInsuranceMonth>, insurance: SocialInsuranceKind): SocialInsuranceDetail => {
  const match = month.details.find((item) => item.insurance === insurance)
  if (!match) throw new Error('missing detail ' + insurance)
  return match
}

describe('social insurance rule data', () => {
  it('covers the six supported cities for 2026', () => {
    expect(socialInsuranceRules.supportedYears).toEqual([2026])
    expect(socialInsuranceRules.cities.map((city) => city.name)).toEqual([
      '\u4e0a\u6d77',
      '\u5317\u4eac',
      '\u6df1\u5733',
      '\u5e7f\u5dde',
      '\u676d\u5dde',
      '\u6210\u90fd'
    ])
  })

  it('resolves every base and rate rule source', () => {
    const sourceIds = new Set(socialInsuranceRules.sources.map((source) => source.id))
    const rules = [...socialInsuranceRules.baseRules, ...socialInsuranceRules.rateRules]
    rules.forEach((rule) => {
      rule.sourceIds.forEach((id) => {
        expect(sourceIds.has(id)).toBe(true)
      })
    })
  })

  it('uses non-overlapping effective windows', () => {
    const rules = [...socialInsuranceRules.baseRules, ...socialInsuranceRules.rateRules]
    rules.forEach((rule) => {
      if (rule.effectiveTo !== null) {
        expect(rule.effectiveFrom <= rule.effectiveTo).toBe(true)
      }
      expect(socialInsuranceRules.cities.some((city) => city.name === rule.city)).toBe(true)
    })
  })
})

describe('Shanghai official social insurance', () => {
  const shanghai = () => profile({
    city: '\u4e0a\u6d77',
    monthlySalary: 18_000,
    socialInsuranceBase: 18_000,
    applyCitySocialBaseLimits: true,
    socialRateMode: 'official'
  })

  it('computes official personal and employer totals with maternity included in medical', () => {
    const year = calculateSocialInsuranceYear(shanghai())
    expect(year.complete).toBe(true)
    expect(year.personalTotal).toBeCloseTo(22_680, 2)
    expect(year.employerTotal).toBeCloseTo(56_592, 2)
    expect(year.taxDeductibleTotal).toBeCloseTo(22_680, 2)

    const jan = year.months[0]
    expect(jan.personalTotal).toBeCloseTo(1_890, 2)
    expect(jan.employerTotal).toBeCloseTo(4_716, 2)
    expect(detail(jan, 'maternity').includedIn).toBe('medical')
    expect(detail(jan, 'maternity').personalAmount).toBe(0)
    expect(detail(jan, 'maternity').employerAmount).toBe(0)
  })

  it('marks March and July as actual rule-change months', () => {
    const periods = socialInsurancePeriods(calculateSocialInsuranceYear(shanghai()))
      .map((period) => period.from + '-' + period.to)
    expect(periods).toEqual(['1-2', '3-6', '7-12'])
  })

  it('clamps the declared base by half-year upper and lower bounds', () => {
    const low = profile({
      city: '\u4e0a\u6d77',
      monthlySalary: 5_000,
      socialInsuranceBase: 5_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official'
    })
    const lowJan = calculateSocialInsuranceMonth(low, 1)
    const lowJul = calculateSocialInsuranceMonth(low, 7)
    expect(detail(lowJan, 'pension').base).toBe(7_460)
    expect(detail(lowJul, 'pension').base).toBe(7_546)
    expect(lowJan.personalTotal).toBeCloseTo(7_460 * .105, 2)
    expect(lowJan.employerTotal).toBeCloseTo(7_460 * .262, 2)
    expect(lowJul.personalTotal).toBeCloseTo(7_546 * .105, 2)
    expect(lowJul.employerTotal).toBeCloseTo(7_546 * .262, 2)

    const high = profile({ ...low, monthlySalary: 50_000, socialInsuranceBase: 50_000 })
    expect(detail(calculateSocialInsuranceMonth(high, 1), 'pension').base).toBe(37_302)
    expect(detail(calculateSocialInsuranceMonth(high, 7), 'pension').base).toBe(37_731)
  })
})

describe('Beijing fixed medical supplement', () => {
  it('adds the monthly 3 yuan large-amount medical mutual aid once', () => {
    const jan = calculateSocialInsuranceMonth(profile({
      city: '\u5317\u4eac',
      monthlySalary: 18_000,
      socialInsuranceBase: 18_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official'
    }), 1)

    expect(detail(jan, 'medical').personalFixed).toBe(3)
    expect(detail(jan, 'medical').personalAmount).toBeCloseTo(363, 2)
    expect(detail(jan, 'medical').employerAmount).toBeCloseTo(1_764, 2)
    expect(jan.personalTotal).toBeCloseTo(1_893, 2)
    expect(jan.employerTotal).toBeCloseTo(4_770, 2)
    expect(jan.taxDeductibleTotal).toBeCloseTo(1_893, 2)
    expect(detail(jan, 'maternity').includedIn).toBe('medical')
  })
})

describe('Shenzhen tiers and local pension', () => {
  it('uses tier-one medical and different insurance bases in January', () => {
    const jan = calculateSocialInsuranceMonth(profile({
      city: '\u6df1\u5733',
      monthlySalary: 30_000,
      socialInsuranceBase: 30_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official',
      socialInsuranceOptions: { hukou: 'nonlocal', medicalTier: 'tier1' }
    }), 1)

    expect(detail(jan, 'pension').base).toBe(27_549)
    expect(detail(jan, 'medical').base).toBe(30_000)
    expect(detail(jan, 'unemployment').base).toBe(30_000)
    expect(detail(jan, 'injury').base).toBe(30_000)
    expect(detail(jan, 'localPension').base).toBe(27_549)
    expect(detail(jan, 'localPension').employerAmount).toBe(0)
    expect(detail(jan, 'maternity').includedIn).toBe('medical')
    expect(jan.personalTotal).toBeCloseTo(2_953.92, 2)
    expect(jan.employerTotal).toBeCloseTo(6_567.84, 2)
  })

  it('marks July pension and unemployment bases as missing', () => {
    const jul = calculateSocialInsuranceMonth(profile({
      city: '\u6df1\u5733',
      monthlySalary: 30_000,
      socialInsuranceBase: 30_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official',
      socialInsuranceOptions: { hukou: 'nonlocal', medicalTier: 'tier1' }
    }), 7)

    expect(detail(jul, 'pension').baseCoverage).toBe('missing')
    expect(detail(jul, 'unemployment').baseCoverage).toBe('missing')
    expect(jul.complete).toBe(false)
    expect(jul.issues.length).toBeGreaterThan(0)
  })

  it('requires local household workers to use tier-one medical', () => {
    const jan = calculateSocialInsuranceMonth(profile({
      city: '\u6df1\u5733',
      monthlySalary: 30_000,
      socialInsuranceBase: 30_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official',
      socialInsuranceOptions: { hukou: 'local', medicalTier: 'tier2' }
    }), 1)

    expect(detail(jan, 'medical').rateCoverage).toBe('missing')
    expect(detail(jan, 'medical').personalRate).toBeNull()
    expect(jan.complete).toBe(false)
  })

  it('charges local supplementary pension for local household workers', () => {
    const jan = calculateSocialInsuranceMonth(profile({
      city: '\u6df1\u5733',
      monthlySalary: 30_000,
      socialInsuranceBase: 30_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official',
      socialInsuranceOptions: { hukou: 'local', medicalTier: 'tier1' }
    }), 1)

    expect(detail(jan, 'localPension').employerRate).toBe(.01)
    expect(detail(jan, 'localPension').employerAmount).toBeCloseTo(275.49, 2)
  })
})

describe('Guangzhou and Chengdu rule gaps', () => {
  it('keeps Guangzhou medical active while pension expires after June', () => {
    const guangzhou = profile({
      city: '\u5e7f\u5dde',
      monthlySalary: 20_000,
      socialInsuranceBase: 20_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official'
    })
    const jun = calculateSocialInsuranceMonth(guangzhou, 6)
    const jul = calculateSocialInsuranceMonth(guangzhou, 7)

    expect(detail(jun, 'pension').base).toBe(20_000)
    expect(detail(jun, 'medical').base).toBe(20_000)
    expect(jun.personalTotal).toBeCloseTo(2_100, 2)
    expect(jun.employerTotal).toBeCloseTo(4_740, 2)
    expect(detail(jul, 'pension').baseCoverage).toBe('missing')
    expect(detail(jul, 'medical').base).toBe(20_000)
    expect(jul.complete).toBe(false)
  })

  it('expires Chengdu medical base after September', () => {
    const chengdu = profile({
      city: '\u6210\u90fd',
      monthlySalary: 10_000,
      socialInsuranceBase: 10_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official'
    })
    const sep = calculateSocialInsuranceMonth(chengdu, 9)
    const oct = calculateSocialInsuranceMonth(chengdu, 10)

    expect(detail(sep, 'medical').base).toBe(10_000)
    expect(sep.personalTotal).toBeCloseTo(1_050, 2)
    expect(sep.employerTotal).toBeCloseTo(2_600, 2)
    expect(detail(oct, 'medical').baseCoverage).toBe('missing')
    expect(detail(oct, 'pension').base).toBe(10_000)
    expect(oct.personalTotal).toBeCloseTo(850, 2)
    expect(oct.complete).toBe(false)
  })
})

describe('Hangzhou fixed account-funded supplement', () => {
  it('keeps the annual 48 yuan transfer out of payroll deductions', () => {
    const jan = calculateSocialInsuranceMonth(profile({
      city: '\u676d\u5dde',
      monthlySalary: 18_000,
      socialInsuranceBase: 18_000,
      applyCitySocialBaseLimits: true,
      socialRateMode: 'official'
    }), 1)

    expect(detail(jan, 'medicalSupplement').baseCoverage).toBe('official')
    expect(detail(jan, 'medicalSupplement').personalAmount).toBe(0)
    expect(detail(jan, 'medicalSupplement').employerAmount).toBe(0)
    expect(detail(jan, 'medicalSupplement').accountTransfer).toBeCloseTo(4, 2)
    expect(detail(jan, 'pension').baseCoverage).toBe('missing')
    expect(jan.complete).toBe(false)
  })
})

describe('official and custom modes', () => {
  it('switches modes without dropping custom values or salary fields', () => {
    const base = profile({
      city: '\u4e0a\u6d77',
      monthlySalary: 20_000,
      socialInsuranceBase: 20_000,
      socialRateMode: 'official',
      customSocialContributions: { pension: { personalRate: .1, employerRate: .2 } }
    })
    const custom = withSocialRateMode(base, 'custom')
    expect(custom.socialRateMode).toBe('custom')
    expect(custom.customSocialContributions?.pension?.personalRate).toBe(.1)
    expect(withSocialRateMode(base, 'official').socialRateMode).toBe('official')

    const moved = withSocialCity(base, '\u5317\u4eac')
    expect(moved.city).toBe('\u5317\u4eac')
    expect(moved.monthlySalary).toBe(base.monthlySalary)
    expect(moved.socialInsuranceBase).toBe(base.socialInsuranceBase)
    expect(moved.customSocialContributions?.pension?.personalRate).toBe(.1)
  })

  it('lets base limits and rate mode work independently', () => {
    const customLimited = profile({
      city: '\u4e0a\u6d77',
      monthlySalary: 5_000,
      socialInsuranceBase: 5_000,
      socialRateMode: 'custom',
      applyCitySocialBaseLimits: true,
      customSocialContributions: { pension: { personalRate: .1, employerRate: .2 } }
    })
    const limited = calculateSocialInsuranceMonth(customLimited, 1)
    expect(detail(limited, 'pension').base).toBe(7_460)
    expect(detail(limited, 'pension').personalRate).toBe(.1)

    const manual = calculateSocialInsuranceMonth({ ...customLimited, applyCitySocialBaseLimits: false }, 1)
    expect(detail(manual, 'pension').base).toBe(5_000)
    expect(detail(manual, 'pension').personalRate).toBe(.1)
  })

  it('uses a user-supplied injury rate in official mode', () => {
    const jan = calculateSocialInsuranceMonth(profile({
      city: '\u4e0a\u6d77',
      socialRateMode: 'official',
      socialInsuranceOptions: { injuryRateOverride: .008 }
    }), 1)
    expect(detail(jan, 'injury').employerRate).toBe(.008)
    expect(detail(jan, 'injury').employerRateOrigin).toBe('user')
  })
})

describe('legacy migration and missing coverage', () => {
  it('migrates legacy profiles to custom mode and preserves only Shanghai bounds', () => {
    const legacyRaw = {
      city: '\u4e0a\u6d77',
      year: 2026,
      monthlySalary: 18_000,
      socialInsuranceBase: 18_000,
      housingFundBase: 18_000,
      applyCitySocialBaseLimits: true
    }
    const shanghai = normalizeCalculatorProfile(legacyRaw, defaultProfile)
    expect(shanghai.socialRateMode).toBe('custom')
    expect(shanghai.legacyShanghaiSocialBaseLimits).toBe(true)
    expect(shanghai.applyCitySocialBaseLimits).toBe(true)

    const beijing = normalizeCalculatorProfile({ ...legacyRaw, city: '\u5317\u4eac' }, defaultProfile)
    expect(beijing.socialRateMode).toBe('custom')
    expect(beijing.applyCitySocialBaseLimits).toBe(false)
    expect(beijing.legacyShanghaiSocialBaseLimits).toBe(false)
  })

  it('flags unsupported cities and years for manual calibration', () => {
    const unsupported = calculateSocialInsuranceYear(profile({
      city: '\u5176\u4ed6\u57ce\u5e02',
      socialRateMode: 'official',
      applyCitySocialBaseLimits: true
    }))
    expect(unsupported.complete).toBe(false)
    expect(unsupported.issues.length).toBeGreaterThan(0)
  })
})
