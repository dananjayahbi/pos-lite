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
  },
  SETTINGS: {
    manageSettings: 'settings:manage',
    viewSettings: 'settings:view',
    manageTax: 'settings:tax',
    manageHardware: 'settings:hardware',
    manageUsers: 'settings:users',
    manageReceiptTemplate: 'settings:receipt_template',
    manageStoreProfile: 'settings:store_profile',
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
  BILLING: {
    viewBilling: 'billing:view',
    manageBilling: 'billing:manage',
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
]);

export const ROLE_PERMISSIONS: Record<'OWNER' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK', PermissionKey[]> = {
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
  ],
};
