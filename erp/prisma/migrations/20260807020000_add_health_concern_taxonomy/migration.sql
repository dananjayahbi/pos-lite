-- Create the curated HealthConcern enum type
CREATE TYPE "HealthConcern" AS ENUM (
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
  'EYE_HEALTH'
);

-- Add the healthConcerns array column to products
ALTER TABLE "products" ADD COLUMN "healthConcerns" "HealthConcern"[] NOT NULL DEFAULT '{}';
