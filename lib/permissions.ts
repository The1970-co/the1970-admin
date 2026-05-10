export const PERMISSIONS = {
  MENU_DASHBOARD: "menu.dashboard",
  MENU_ORDERS: "menu.orders",
  MENU_CREATE_ORDER: "menu.create_order",
  MENU_POS: "menu.pos",
  MENU_RETURNS: "menu.returns",
  MENU_PRODUCTS: "menu.products",
  MENU_PROMOTIONS: "menu.promotions",
  MENU_PRODUCT_CATEGORIES: "menu.product_categories",
  MENU_SUPPLIERS: "menu.suppliers",
  MENU_CUSTOMERS: "menu.customers",
  MENU_INVENTORY: "menu.inventory",
  MENU_INVENTORY_LOGS: "menu.inventory_logs",
  MENU_PURCHASE_RECEIPT: "menu.purchase_receipt",
  MENU_STOCK_TRANSFER: "menu.stock_transfer",
  MENU_STOCKTAKE: "menu.stocktake",
  MENU_WAREHOUSE_MAP: "menu.warehouse_map",
  MENU_FINANCE: "menu.finance",
  MENU_SHIPPING_RECONCILE: "menu.shipping_reconcile",
  MENU_SUPPLIER_PAYMENTS: "menu.supplier_payments",
  MENU_REPORTS: "menu.reports",
  MENU_AUTOPILOT: "menu.autopilot",
  MENU_AI_CONTENT: "menu.ai_content",
  MENU_PERMISSIONS: "menu.permissions",
  MENU_SETTINGS: "menu.settings",
  MENU_PRINT_CENTER: "menu.print_center",

  ORDERS_VIEW: "orders.view",
  ORDERS_VIEW_OWN: "orders.view_own",
  ORDERS_CREATE: "orders.create",
  ORDERS_EDIT: "orders.edit",
  ORDERS_APPROVE: "orders.approve",
  ORDERS_CANCEL: "orders.cancel",
  ORDERS_PACK_SHIP: "orders.pack_ship",
  ORDERS_PAY: "orders.pay",

  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_EDIT: "products.edit",
  PRODUCTS_DELETE: "products.delete",

  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",
  INVENTORY_LOGS_VIEW: "inventory.logs.view",

  PURCHASE_RECEIPT_VIEW: "purchase_receipt.view",
  PURCHASE_RECEIPT_CREATE: "purchase_receipt.create",
  PURCHASE_RECEIPT_EDIT: "purchase_receipt.edit",
  PURCHASE_RECEIPT_RECEIVE: "purchase_receipt.receive",

  STOCK_TRANSFER_VIEW: "stock_transfer.view",
  STOCK_TRANSFER_CREATE: "stock_transfer.create",
  STOCK_TRANSFER_EDIT: "stock_transfer.edit",
  STOCK_TRANSFER_CONFIRM: "stock_transfer.confirm",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_VIEW_OWN: "customers.view_own",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_EDIT: "customers.edit",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | "*" | string;

export function uniquePermissions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}
