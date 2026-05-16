export type PayrollStatus = "DRAFT" | "CALCULATED" | "LOCKED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | string;
export type SalaryType = "MONTHLY" | "DAILY" | "SHIFT" | "NONE" | string;
export type AdjustmentType = "BONUS" | "ALLOWANCE" | "ADVANCE" | "DEDUCTION";

export type PayrollPeriod = {
  id: string;
  code: string;
  name: string;
  fromDate: string;
  toDate: string;
  branchId?: string | null;
  branchName?: string | null;
  status: PayrollStatus;
  totalStaff?: number | string | null;
  totalOrders?: number | string | null;
  totalItems?: number | string | null;
  totalRevenue?: number | string | null;
  totalGross?: number | string | null;
  totalNet?: number | string | null;
  totalPaid?: number | string | null;
  lockedAt?: string | null;
  paidAt?: string | null;
  note?: string | null;
  lines?: PayrollLine[];
  createdAt?: string;
  updatedAt?: string;
};

export type PayrollLine = {
  id: string;
  periodId: string;
  staffId: string;
  staffCode?: string | null;
  staffName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  salaryType?: SalaryType;
  baseSalary?: number | string | null;
  workingDays?: number | string | null;
  standardDays?: number | string | null;
  proratedSalary?: number | string | null;
  successOrderCount?: number | string | null;
  successItemQty?: number | string | null;
  revenueAmount?: number | string | null;
  commissionByOrder?: number | string | null;
  commissionByItem?: number | string | null;
  commissionByPercent?: number | string | null;
  commissionTotal?: number | string | null;
  bonus?: number | string | null;
  allowance?: number | string | null;
  advance?: number | string | null;
  deduction?: number | string | null;
  grossPay?: number | string | null;
  netPay?: number | string | null;
  paidAmount?: number | string | null;
  status?: PayrollStatus;
  note?: string | null;
  paidAt?: string | null;
  orderLinks?: PayrollOrderLink[];
  adjustments?: PayrollAdjustment[];
};

export type PayrollOrderLink = {
  id: string;
  payrollLineId: string;
  orderId: string;
  orderCode?: string | null;
  orderDate?: string | null;
  completedAt?: string | null;
  revenueAmount?: number | string | null;
  itemQty?: number | string | null;
  commissionByOrder?: number | string | null;
  commissionByItem?: number | string | null;
  commissionByPercent?: number | string | null;
  commission?: number | string | null;
  reason?: string | null;
};

export type PayrollAdjustment = {
  id: string;
  payrollLineId: string;
  type: AdjustmentType | string;
  amount: number | string;
  reason?: string | null;
  createdByName?: string | null;
  createdAt?: string;
};

export type PayrollConfig = {
  id: string;
  staffId: string;
  staffCode?: string | null;
  staffName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  salaryType?: SalaryType;
  baseSalary?: number | string | null;
  dailyRate?: number | string | null;
  standardWorkingDays?: number | string | null;
  commissionPerOrderEnabled?: boolean;
  commissionPerOrderAmount?: number | string | null;
  commissionPerItemEnabled?: boolean;
  commissionPerItemAmount?: number | string | null;
  commissionPercentEnabled?: boolean;
  commissionRate?: number | string | null;
  applyPos?: boolean;
  applyOnline?: boolean;
  applyFacebook?: boolean;
  applyCod?: boolean;
  allowanceDefault?: number | string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  note?: string | null;
};

export type StaffOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  isActive?: boolean;
};

export type BranchOption = {
  id: string;
  name?: string | null;
  code?: string | null;
};

export type PaymentSourceOption = {
  id: string;
  name?: string | null;
  code?: string | null;
  type?: string | null;
  branchId?: string | null;
};
