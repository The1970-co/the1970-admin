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
  "/control/warehouse-map": PERMISSIONS.MENU_WAREHOUSE_MAP,
  "/finance/daily": PERMISSIONS.MENU_FINANCE,
  "/finance/ghn-reconciliation": PERMISSIONS.MENU_SHIPPING_RECONCILE,
  "/finance/local-delivery": PERMISSIONS.MENU_SHIPPING_RECONCILE,
  "/finance/revenue": PERMISSIONS.MENU_REPORTS,
  "/finance/supplier-payments": PERMISSIONS.MENU_SUPPLIER_PAYMENTS,
  "/control/autopilot": PERMISSIONS.MENU_AUTOPILOT,
  "/control/ai-content": PERMISSIONS.MENU_AI_CONTENT,
  "/permissions": PERMISSIONS.MENU_PERMISSIONS,
  "/settings": PERMISSIONS.MENU_SETTINGS,
  "/print-center": PERMISSIONS.MENU_PRINT_CENTER,
};

export function getRequiredPermissionForPath(pathname: string) {
  const entries = Object.entries(ROUTE_PERMISSION_MAP).sort(
    ([a], [b]) => b.length - a.length,
  );

  const found = entries.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return found?.[1] || null;
}
