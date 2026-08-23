-- AlterEnum
-- Add future courier providers to the CarrierProvider enum. Only Trans Express
-- has a registered adapter today; these values allow the registry / config seam
-- to recognize Domex, PromptX, and Koombiyo without an active integration.
ALTER TYPE "CarrierProvider" ADD VALUE 'DOMEX';
ALTER TYPE "CarrierProvider" ADD VALUE 'PROMPTX';
ALTER TYPE "CarrierProvider" ADD VALUE 'KOOMBIYO';
