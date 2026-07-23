import { PERMISSIONS } from "@/lib/permissions";

export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  "/control": PERMISSIONS.MENU_DASHBOARD,
  "/orders": PERMISSIONS.MENU_ORDERS,
  "/create-order": PERMISSIONS.MENU_CREATE_ORDER,
  "/pos": PERMISSIONS.MENU_POS,
  "/returns": PERMISSIONS.MENU_RETURNS,
  "/products": PERMISSIONS.MENU_PRODUCTS,
  "/promotions": PERMISSIONS.MENU_PROMOTIONS,
  "/control/product-categories": PERMISSIONS.MENU_PRODUCT_CATEGORIES,
  "/control/suppliers": PERMISSIONS.MENU_SUPPLIERS,
  "/control/customers": PERMISSIONS.MENU_CUSTOMERS,
  "/inventory": PERMISSIONS.MENU_INVENTORY,
  "/inventory-logs": PERMISSIONS.MENU_INVENTORY_LOGS,
  "/control/purchase-receipts": PERMISSIONS.MENU_PURCHASE_RECEIPT,
  "/control/stock-transfers": PERMISSIONS.MENU_STOCK_TRANSFER,
  "/stocktake": PERMISSIONS.MENU_STOCKTAKE,
  "/stocktake-sessions": PERMISSIONS.MENU_STOCKTAKE,
  "/control/warehouse-map": PERMISSIONS.MENU_WAREHOUSE_MAP,
  "/finance/daily": PERMISSIONS.MENU_FINANCE,
  "/finance/cash-receipts": PERMISSIONS.MENU_CASH_VOUCHER,
  "/finance/cash-payments": PERMISSIONS.MENU_CASH_VOUCHER,
  "/finance/ghn-reconciliation":
    PERMISSIONS.MENU_FINANCE_GHN_RECONCILIATION,
  "/finance/local-delivery": PERMISSIONS.FINANCE_LOCAL_DELIVERY_VIEW,
  "/finance/revenue": PERMISSIONS.MENU_REPORTS,
  "/finance/supplier-payments": PERMISSIONS.MENU_SUPPLIER_PAYMENTS,
  "/payroll": PERMISSIONS.MENU_PAYROLL,
  "/payroll/config": PERMISSIONS.PAYROLL_CONFIG,
  "/payroll/settings": PERMISSIONS.PAYROLL_CONFIG,
  "/staff-transfer": PERMISSIONS.MENU_STAFF_TRANSFER,
  "/control/autopilot": PERMISSIONS.MENU_AUTOPILOT,
  "/control/ai-content": PERMISSIONS.MENU_AI_CONTENT,

  // Omni Inbox routes phải chặn theo đúng quyền menu.
  "/messages": PERMISSIONS.MENU_OMNI_MESSAGES,
  "/comments": PERMISSIONS.MENU_OMNI_COMMENTS,
  "/livestream": PERMISSIONS.MENU_OMNI_LIVESTREAM,

  "/permissions": PERMISSIONS.MENU_PERMISSIONS,
  "/settings": PERMISSIONS.MENU_SETTINGS,
  "/settings/payment-sources": PERMISSIONS.MENU_SETTINGS,
  "/settings/print-templates": PERMISSIONS.MENU_PRINT_CENTER,
  "/control/security/google-auth": PERMISSIONS.MENU_SETTINGS,
  "/print-center": PERMISSIONS.MENU_PRINT_CENTER,
  "/print-center/product-labels": PERMISSIONS.PRODUCTS_PRINT_LABEL,
  "/print-center/templates": PERMISSIONS.MENU_PRINT_CENTER,
};

export function getRequiredPermissionForPath(pathname: string) {
  const entries = Object.entries(ROUTE_PERMISSION_MAP).sort(
    ([a], [b]) => b.length - a.length,
  );

  const found = entries.find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return found?.[1] || null;
}
