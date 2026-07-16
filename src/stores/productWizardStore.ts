import { create } from 'zustand';
import type { GenderType, TaxRule } from '@/generated/prisma/client';

export interface Step1Data {
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  gender: GenderType;
  tags: string[];
  taxRule: TaxRule;
}

export interface Step2Data {
  variants: Array<{
    size?: string;
    colour?: string;
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
