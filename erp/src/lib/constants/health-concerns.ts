/**
 * Curated HealthConcern taxonomy used by the ERP product forms and validators.
 * Kept in sync with the `HealthConcern` enum in prisma/schema.prisma.
 */
export const HEALTH_CONCERNS = [
  'JOINT_PAIN',
  'SKIN_CARE',
  'DIGESTIVE_HEALTH',
  'STRESS_RELIEF',
  'IMMUNITY',
  'HAIR_CARE',
  'RESPIRATORY',
  'CARDIOVASCULAR',
  'WOMENS_HEALTH',
  'MENS_HEALTH',
  'CHILD_HEALTH',
  'SLEEP_SUPPORT',
  'ENERGY_VITALITY',
  'DIABETES_SUPPORT',
  'LIVER_KIDNEY_HEALTH',
  'WEIGHT_MANAGEMENT',
  'ORAL_CARE',
  'EYE_HEALTH',
] as const;

export type HealthConcernKey = (typeof HEALTH_CONCERNS)[number];

/** Human-readable label per concern, used in form checkboxes and storefront. */
export const HEALTH_CONCERN_LABELS: Record<HealthConcernKey, string> = {
  JOINT_PAIN: 'Joint Pain',
  SKIN_CARE: 'Skin Care',
  DIGESTIVE_HEALTH: 'Digestive Health',
  STRESS_RELIEF: 'Stress Relief',
  IMMUNITY: 'Immunity',
  HAIR_CARE: 'Hair Care',
  RESPIRATORY: 'Respiratory',
  CARDIOVASCULAR: 'Cardiovascular',
  WOMENS_HEALTH: "Women's Health",
  MENS_HEALTH: "Men's Health",
  CHILD_HEALTH: 'Child Health',
  SLEEP_SUPPORT: 'Sleep Support',
  ENERGY_VITALITY: 'Energy & Vitality',
  DIABETES_SUPPORT: 'Diabetes Support',
  LIVER_KIDNEY_HEALTH: 'Liver & Kidney Health',
  WEIGHT_MANAGEMENT: 'Weight Management',
  ORAL_CARE: 'Oral Care',
  EYE_HEALTH: 'Eye Health',
};
