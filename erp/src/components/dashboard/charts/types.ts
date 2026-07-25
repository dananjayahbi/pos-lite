export interface DailyRevenue {
  date: string;
  revenue: number;
  salesCount: number;
}

export interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ChartAnalytics {
  dailyRevenue: DailyRevenue[];
  paymentBreakdown: PaymentBreakdown[];
  topProducts: TopProduct[];
}
