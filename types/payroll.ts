export type PayrollStatus = "DRAFT" | "CALCULATED" | "LOCKED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | string;
export type SalaryType = "MONTHLY" | "DAILY" | "SHIFT" | "NONE" | string;
export type AdjustmentType = "BONUS" | "ALLOWANCE" | "ADVANCE" | "DEDUCTION";

export type PayrollPeriod = {
  id: string; code: string; name: string; fromDate: string; toDate: string;
  branchId?: string | null; branchName?: string | null; status: PayrollStatus;
  totalStaff?: number | string | null; totalOrders?: number | string | null; totalItems?: number | string | null; totalRevenue?: number | string | null;
  totalHourlyAmount?: number | string | null; totalTaggedProductAmount?: number | string | null; totalMealAllowance?: number | string | null;
  totalInsuranceDeduction?: number | string | null; totalGhnCodBonus?: number | string | null;
  totalAttendanceWarnings?: number | string | null; totalLateMinutes?: number | string | null; totalEarlyMinutes?: number | string | null;
  attendanceImportedAt?: string | null; attendanceImportFileName?: string | null;
  totalGross?: number | string | null; totalNet?: number | string | null; totalPaid?: number | string | null;
  lockedAt?: string | null; paidAt?: string | null; note?: string | null; lines?: PayrollLine[]; createdAt?: string; updatedAt?: string;
};

export type PayrollLine = {
  id: string; periodId: string; staffId: string; staffCode?: string | null; staffName?: string | null; branchId?: string | null; branchName?: string | null;
  salaryType?: SalaryType; baseSalary?: number | string | null; dailyRate?: number | string | null; workingDays?: number | string | null; standardDays?: number | string | null; proratedSalary?: number | string | null;
  orderAttributionMode?: string | null; successOrderCount?: number | string | null; successItemQty?: number | string | null; revenueAmount?: number | string | null;
  attendanceCode?: string | null; attendanceMatchedBy?: string | null; attendanceRawName?: string | null; attendanceSourceFile?: string | null; attendanceImportedAt?: string | null;
  lateCount?: number | string | null; lateMinutes?: number | string | null; earlyCount?: number | string | null; earlyMinutes?: number | string | null; attendanceWarningLevel?: string | null; attendanceWarningNote?: string | null;
  normalHours?: number | string | null; overtimeHours?: number | string | null; overtimeRate?: number | string | null; holidayHours?: number | string | null; holidayRate?: number | string | null;
  convertedWorkingHours?: number | string | null; hourlyRate?: number | string | null; hourlyAmount?: number | string | null;
  paidLeaveDays?: number | string | null; paidLeaveHoursPerDay?: number | string | null; paidLeaveAmount?: number | string | null;
  mealAllowanceAmount?: number | string | null; insuranceDeduction?: number | string | null;
  taggedProductQty?: number | string | null; taggedProductRate?: number | string | null; taggedProductAmount?: number | string | null;
  ghnCodOrderCount?: number | string | null; ghnCodBonusPerOrder?: number | string | null; ghnCodBonusAmount?: number | string | null;
  commissionByOrder?: number | string | null; commissionByItem?: number | string | null; commissionByPercent?: number | string | null; commissionTotal?: number | string | null;
  bonus?: number | string | null; allowance?: number | string | null; advance?: number | string | null; deduction?: number | string | null;
  grossPay?: number | string | null; netPay?: number | string | null; paidAmount?: number | string | null; status?: PayrollStatus; note?: string | null; paidAt?: string | null;
  orderLinks?: PayrollOrderLink[]; adjustments?: PayrollAdjustment[];
};

export type PayrollOrderLink = {
  id: string; payrollLineId: string; orderId: string; orderCode?: string | null; branchId?: string | null; salesChannel?: string | null; orderDate?: string | null; completedAt?: string | null;
  revenueAmount?: number | string | null; itemQty?: number | string | null; commissionByOrder?: number | string | null; commissionByItem?: number | string | null; commissionByPercent?: number | string | null; commissionTotal?: number | string | null; commission?: number | string | null;
  attributionSource?: string | null; attributedStaffId?: string | null; attributedStaffName?: string | null; attributionStaffId?: string | null; attributionStaffName?: string | null; reason?: string | null;
};

export type PayrollAdjustment = { id: string; payrollLineId: string; type: AdjustmentType | string; amount: number | string; reason?: string | null; createdByName?: string | null; createdAt?: string; };

export type PayrollConfig = {
  id: string; staffId: string; staffCode?: string | null; staffName?: string | null; branchId?: string | null; branchName?: string | null; attendanceCode?: string | null;
  salaryType?: SalaryType; baseSalary?: number | string | null; dailyRate?: number | string | null; standardWorkingDays?: number | string | null;
  orderAttributionMode?: string | null; commissionPerOrderEnabled?: boolean; commissionPerOrderAmount?: number | string | null; commissionPerItemEnabled?: boolean; commissionPerItemAmount?: number | string | null; commissionPercentEnabled?: boolean; commissionRate?: number | string | null;
  hourlyEnabled?: boolean; hourlyRate?: number | string | null; standardHoursPerDay?: number | string | null; overtimeRate?: number | string | null; holidayRate?: number | string | null;
  paidLeaveEnabled?: boolean; paidLeaveHoursPerDay?: number | string | null; mealAllowanceEnabled?: boolean; mealHoursPerUnit?: number | string | null; mealAmountPerUnit?: number | string | null; insuranceDeductionAmount?: number | string | null;
  taggedProductEnabled?: boolean; taggedProductRate?: number | string | null; ghnCodBonusEnabled?: boolean; ghnCodBonusPerOrder?: number | string | null;
  applyPos?: boolean; applyOnline?: boolean; applyFacebook?: boolean; applyCod?: boolean; allowanceDefault?: number | string | null; effectiveFrom?: string; effectiveTo?: string | null; isActive?: boolean; note?: string | null;
};

export type AttendancePreviewRow = {
  attendanceCode: string; staffName: string; branchName?: string | null; normalHours?: number; overtimeHours?: number; holidayHours?: number; overtime3Hours?: number; totalWorkHours?: number;
  lateCount?: number; lateMinutes?: number; earlyCount?: number; earlyMinutes?: number; matched?: boolean; matchedBy?: string | null; staffId?: string | null; staffCode?: string | null; systemStaffName?: string | null; systemBranchId?: string | null; systemBranchName?: string | null;
  hourlyRate?: number; overtimeRate?: number; holidayRate?: number; taggedProductRate?: number; warningLevel?: string; warningNote?: string; fileName?: string;
};

export type PayrollSettings = {
  id?: string; autoCreateEnabled?: boolean; autoCreateDay?: number; cycleMode?: string; cycleStartDay?: number; cycleEndDay?: number | null; autoCalculateMode?: string; autoLockEnabled?: boolean; autoLockAfterDays?: number; reminderEnabled?: boolean;
  lateWarningCount?: number; lateWarningMinutes?: number; lateCriticalCount?: number; lateCriticalMinutes?: number; earlyWarningCount?: number; earlyWarningMinutes?: number; earlyCriticalCount?: number; earlyCriticalMinutes?: number;
};

export type StaffOption = { id: string; code?: string | null; name?: string | null; branchId?: string | null; branchName?: string | null; isActive?: boolean; };
export type BranchOption = { id: string; name?: string | null; code?: string | null; };
export type PaymentSourceOption = { id: string; name?: string | null; code?: string | null; type?: string | null; branchId?: string | null; };
