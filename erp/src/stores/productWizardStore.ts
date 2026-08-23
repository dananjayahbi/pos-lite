import { create } from 'zustand';
import type { TaxRule } from '@/generated/prisma/client';

export interface Step1Data {
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  tags: string[];
  taxRule: TaxRule;
  mainImageUrl: string;
  activeIngredients: string;
  usageInstructions: string;
  healthBenefits: string;
  safetyPrecautions: string;
  healthConcerns: string[];
  productSource: 'MANUFACTURED' | 'TRADED';
}

export interface Step2Data {
  variants: Array<{
    form?: string;
    packSize?: string;
    costPrice: number;
    retailPrice: number;
    wholesalePrice?: number;
    lowStockThreshold: number;
    barcode?: string;
    sku?: string;
    imageUrls?: string[];
    initialStock?: number;
  }>;
}

interface ProductWizardState {
  step: 1 | 2 | 3;
  step1Data: Step1Data | null;
  step2Data: Step2Data | null;
  goToStep: (step: 1 | 2 | 3) => void;
  setStep1Data: (data: Step1Data) => void;
  setStep2Data: (data: Step2Data) => void;
  resetWizard: () => void;
}

export const useProductWizardStore = create<ProductWizardState>((set) => ({
  step: 1,
  step1Data: null,
  step2Data: null,
  goToStep: (step) => set({ step }),
  setStep1Data: (data) => set({ step1Data: data }),
  setStep2Data: (data) => set({ step2Data: data }),
  resetWizard: () => set({ step: 1, step1Data: null, step2Data: null }),
}));