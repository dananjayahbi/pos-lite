import type { UserRole } from '@/generated/prisma/client';

export const PERMISSIONS = {
  SALE: {
    createSale: 'sale:create',
    viewSale: 'sale:view',
    voidSale: 'sale:void',
    refundSale: 'sale:refund',
    holdSale: 'sale:hold',
    resumeSale: 'sale:resume',
    reprintReceipt: 'sale:receipt:reprint',
  },
  DISCOUNT: {
    applyDiscount: 'discount:apply',
    overrideDiscount: 'discount:override',
    viewDiscount: 'discount:view',
    createDiscountRule: 'discount:rule:create',
    editDiscountRule: 'discount:rule:edit',
  },
  PRODUCT: {
    createProduct: 'product:create',
    editProduct: 'product:edit',
    deleteProduct: 'product:delete',
    viewProduct: 'product:view',
    viewCostPrice: 'product:view_cost_price',
    archiveProduct: 'product:archive',
    importProduct: 'product:import',
    exportProduct: 'product:export',
  },
  STOCK: {
    adjustStock: 'stock:adjust',
    conductStockTake: 'stock:take',
    approveStockTake: 'stock:take:approve',
    viewStock: 'stock:view',
    transferStock: 'stock:transfer',
    viewStockValuation: 'stock:valuation:view',
  },
  CUSTOMER: {
    createCustomer: 'customer:create',
    editCustomer: 'customer:edit',
    deleteCustomer: 'customer:delete',
    viewCustomer: 'customer:view',
    viewCustomerBalance: 'customer:view_balance',
    mergeCustomer: 'customer:merge',
  },
  SUPPLIER: {
    createSupplier: 'supplier:create',
    editSupplier: 'supplier:edit',
    viewSupplier: 'supplier:view',
    createPurchaseOrder: 'purchase_order:create',
    receivePurchaseOrder: 'purchase_order:receive',
    approvePurchaseOrder: 'purchase_order:approve',
    cancelPurchaseOrder: 'purchase_order:cancel',
  },
  STAFF: {
    manageStaff: 'staff:manage',
    viewStaff: 'staff:view',
    openShift: 'shift:open',
    closeShift: 'shift:close',
    viewShift: 'shift:view',
    assignPermissions: 'staff:permissions:assign',
    viewAttendance: 'staff:attendance:view',
  },
  REPORT: {
    viewSalesReport: 'report:view_sales',
    viewProfitReport: 'report:view_profit',
    exportReport: 'report:export',
    viewCostReport: 'report:view_cost',
    viewTaxReport: 'report:view_tax',
    viewStockReport: 'report:view_stock',
    viewCashflowReport: 'report:view_cashflow',
    viewZeroValueReport: 'report:view_zero_value',
    viewRecoveryReport: 'report:view_recovery',
    viewCustomerReport: 'report:view_customers',
  },
  SETTINGS: {
    manageSettings: 'settings:manage',
    viewSettings: 'settings:view',
    manageTax: 'settings:tax',
    manageHardware: 'settings:hardware',
    manageUsers: 'settings:users',
    manageReceiptTemplate: 'settings:receipt_template',
    manageStoreProfile: 'settings:store_profile',
    viewAuditLog: 'settings:view_audit_log',
  },
  PROMOTION: {
    createPromotion: 'promotion:create',
    editPromotion: 'promotion:edit',
    deletePromotion: 'promotion:delete',
    publishPromotion: 'promotion:publish',
  },
  EXPENSE: {
    createExpense: 'expense:create',
    approveExpense: 'expense:approve',
    viewExpense: 'expense:view',
  },
  PETTY_CASH: {
    viewPettyCash: 'petty_cash:view',
    managePettyCash: 'petty_cash:manage',
  },
  BILLING: {
    viewBilling: 'billing:view',
    manageBilling: 'billing:manage',
  },
  APPOINTMENT: {
    viewAppointment: 'appointment:view',
    createAppointment: 'appointment:create',
    editAppointment: 'appointment:edit',
    cancelAppointment: 'appointment:cancel',
    checkInAppointment: 'appointment:checkin',
    manageServices: 'appointment:services:manage',
    manageSchedule: 'appointment:schedule:manage',
    manageSettings: 'appointment:settings:manage',
  },
  DELIVERY: {
    viewDelivery: 'delivery:view',
    createDelivery: 'delivery:create',
    dispatchDelivery: 'delivery:dispatch',
    editDelivery: 'delivery:edit',
    cancelDelivery: 'delivery:cancel',
    trackDelivery: 'delivery:track',
    manageRateCard: 'delivery:ratecard:manage',
    manageCourierSettings: 'delivery:courier:manage',
    manageLabelTemplate: 'delivery:label:manage',
    viewReconciliation: 'delivery:recon:view',
    importRemittance: 'delivery:recon:import',
    managePackaging: 'delivery:packaging:manage',
    dispatchPackaging: 'delivery:packaging:dispatch',
    manageRecovery: 'delivery:recovery:manage',
  },
  RAW_MATERIAL: {
    viewRawMaterial: 'raw_material:view',
    createRawMaterial: 'raw_material:create',
    editRawMaterial: 'raw_material:edit',
    adjustRawMaterialStock: 'raw_material:stock:adjust',
    deleteRawMaterial: 'raw_material:delete',
  },
  FACTORY: {
    viewFactoryDashboard: 'factory:dashboard:view',
  },
  BOM: {
    viewBom: 'bom:view',
    createBom: 'bom:create',
    editBom: 'bom:edit',
    deleteBom: 'bom:delete',
    produceGoods: 'bom:produce',
    viewProductionLog: 'bom:production:view',
  },
  RAW_MATERIAL_ALERT: {
    viewRawMaterialAlerts: 'raw_material:alerts:view',
    manageRawMaterialAlerts: 'raw_material:alerts:manage',
  },
  BATCH: {
    viewBatch: 'batch:view',
    viewBatchStats: 'batch:stats:view',
    viewBatchAlerts: 'batch:alerts:view',
  },
} as const;

type PermissionGroups = typeof PERMISSIONS;
type NestedPermissionValues<T> = T extends Record<string, infer Group>
  ? Group extends Record<string, infer Permission>
    ? Permission
    : never
  : never;

export type PermissionKey = NestedPermissionValues<PermissionGroups>;

export const ALL_PERMISSIONS: PermissionKey[] = Array.from(
  new Set(
    Object.values(PERMISSIONS).flatMap((group) =>
      Object.values(group) as PermissionKey[],
    ),
  ),
);

const managerExcluded = new Set<PermissionKey>([
  PERMISSIONS.PRODUCT.archiveProduct,
  PERMISSIONS.CUSTOMER.deleteCustomer,
  PERMISSIONS.PRODUCT.deleteProduct,
  PERMISSIONS.SETTINGS.manageSettings,
  PERMISSIONS.SETTINGS.manageUsers,
  PERMISSIONS.SUPPLIER.approvePurchaseOrder,
  PERMISSIONS.PROMOTION.deletePromotion,
  PERMISSIONS.BILLING.manageBilling,
  PERMISSIONS.DELIVERY.manageCourierSettings,
  PERMISSIONS.DELIVERY.importRemittance,
  PERMISSIONS.DELIVERY.manageRateCard,
  PERMISSIONS.REPORT.viewZeroValueReport,
]);

export const ROLE_PERMISSIONS: Record<
  'OWNER' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK' | 'DISPATCH_STAFF' | 'FACTORY_MANAGER',
  PermissionKey[]
> = {
  OWNER: [...ALL_PERMISSIONS],
  MANAGER: ALL_PERMISSIONS.filter((permission) => !managerExcluded.has(permission)),
  CASHIER: [
    PERMISSIONS.SALE.createSale,
    PERMISSIONS.SALE.viewSale,
    PERMISSIONS.DISCOUNT.applyDiscount,
    PERMISSIONS.PRODUCT.viewProduct,
    PERMISSIONS.CUSTOMER.viewCustomer,
    PERMISSIONS.CUSTOMER.createCustomer,
    PERMISSIONS.STAFF.openShift,
    PERMISSIONS.STAFF.closeShift,
    PERMISSIONS.APPOINTMENT.viewAppointment,
    PERMISSIONS.APPOINTMENT.createAppointment,
    PERMISSIONS.APPOINTMENT.checkInAppointment,
  ],
  STOCK_CLERK: [
    PERMISSIONS.PRODUCT.viewProduct,
    PERMISSIONS.STOCK.viewStock,
    PERMISSIONS.STOCK.adjustStock,
    PERMISSIONS.STOCK.conductStockTake,
    PERMISSIONS.PRODUCT.viewCostPrice,
    PERMISSIONS.SUPPLIER.createPurchaseOrder,
    PERMISSIONS.SUPPLIER.receivePurchaseOrder,
    PERMISSIONS.SUPPLIER.viewSupplier,
    PERMISSIONS.BATCH.viewBatch,
    PERMISSIONS.BATCH.viewBatchStats,
  ],
  DISPATCH_STAFF: [
    PERMISSIONS.DELIVERY.viewDelivery,
    PERMISSIONS.DELIVERY.createDelivery,
    PERMISSIONS.DELIVERY.dispatchDelivery,
    PERMISSIONS.DELIVERY.editDelivery,
    PERMISSIONS.DELIVERY.cancelDelivery,
    PERMISSIONS.DELIVERY.trackDelivery,
    PERMISSIONS.DELIVERY.managePackaging,
    PERMISSIONS.DELIVERY.dispatchPackaging,
    PERMISSIONS.DELIVERY.manageRecovery,
    PERMISSIONS.REPORT.viewRecoveryReport,
  ],
  FACTORY_MANAGER: [
    PERMISSIONS.RAW_MATERIAL.viewRawMaterial,
    PERMISSIONS.RAW_MATERIAL.createRawMaterial,
    PERMISSIONS.RAW_MATERIAL.editRawMaterial,
    PERMISSIONS.RAW_MATERIAL.adjustRawMaterialStock,
    PERMISSIONS.RAW_MATERIAL.deleteRawMaterial,
    PERMISSIONS.FACTORY.viewFactoryDashboard,
    PERMISSIONS.BOM.viewBom,
    PERMISSIONS.BOM.createBom,
    PERMISSIONS.BOM.editBom,
    PERMISSIONS.BOM.deleteBom,
    PERMISSIONS.BOM.produceGoods,
    PERMISSIONS.BOM.viewProductionLog,
    PERMISSIONS.RAW_MATERIAL_ALERT.viewRawMaterialAlerts,
    PERMISSIONS.PRODUCT.viewProduct,
    PERMISSIONS.BATCH.viewBatch,
    PERMISSIONS.BATCH.viewBatchStats,
    PERMISSIONS.BATCH.viewBatchAlerts,
  ],
};

export function getEffectivePermissions(
  role: UserRole | undefined,
  assignedPermissions: unknown,
): string[] {
  // SUPER_ADMIN acting within a store (tenant) context receives full store
  // access — equivalent to the OWNER permission set. Platform-level controls
  // remain enforced separately in the /api/admin/* routes.
  if (role === 'SUPER_ADMIN') {
    return [...ALL_PERMISSIONS];
  }

  const normalized = Array.isArray(assignedPermissions)
    ? assignedPermissions.filter((permission): permission is string => typeof permission === 'string')
    : [];

  if (!role) {
    return normalized;
  }

  const roleDefaults = ROLE_PERMISSIONS[role] ?? [];

  if (normalized.length === 0) {
    return [...roleDefaults];
  }

  return Array.from(new Set([...roleDefaults, ...normalized]));
}
