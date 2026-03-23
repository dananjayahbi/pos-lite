export const GENDER_TYPES = ['MEN', 'WOMEN', 'UNISEX', 'KIDS', 'TODDLERS'] as const;

export type GenderTypeValue = (typeof GENDER_TYPES)[number];

export const GENDER_TYPE: Record<GenderTypeValue, GenderTypeValue> = {
  MEN: 'MEN',
  WOMEN: 'WOMEN',
  UNISEX: 'UNISEX',
  KIDS: 'KIDS',
  TODDLERS: 'TODDLERS',
};

export const GENDER_OPTIONS: Array<{ value: GenderTypeValue; label: string }> = [
  { value: GENDER_TYPE.MEN, label: 'Men' },
  { value: GENDER_TYPE.WOMEN, label: 'Women' },
  { value: GENDER_TYPE.UNISEX, label: 'Unisex' },
  { value: GENDER_TYPE.KIDS, label: 'Kids' },
  { value: GENDER_TYPE.TODDLERS, label: 'Toddlers' },
];

export const TAX_RULES = ['STANDARD_VAT', 'SSCL', 'EXEMPT'] as const;

export type TaxRuleValue = (typeof TAX_RULES)[number];

export const TAX_RULE: Record<TaxRuleValue, TaxRuleValue> = {
  STANDARD_VAT: 'STANDARD_VAT',
  SSCL: 'SSCL',
  EXEMPT: 'EXEMPT',
};

export const TAX_RULE_OPTIONS: Array<{ value: TaxRuleValue; label: string }> = [
  { value: TAX_RULE.STANDARD_VAT, label: 'Standard VAT (15%)' },
  { value: TAX_RULE.SSCL, label: 'SSCL' },
  { value: TAX_RULE.EXEMPT, label: 'VAT Exempt' },
];