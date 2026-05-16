import { apiJson } from "@/lib/api";
import type { PayrollConfig, PayrollPeriod } from "@/types/payroll";

function qs(params: Record<string, any>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function listPayrollPeriods(params: Record<string, any> = {}) {
  return apiJson<{ rows: PayrollPeriod[]; total: number; page: number; pageSize: number; totalPages: number }>(`/payroll/periods${qs(params)}`);
}

export function createPayrollPeriod(body: any) {
  return apiJson<PayrollPeriod>("/payroll/periods", { method: "POST", body: JSON.stringify(body) });
}

export function getPayrollPeriod(id: string) {
  return apiJson<PayrollPeriod>(`/payroll/periods/${id}`);
}

export function calculatePayrollPeriod(id: string, body: any = {}) {
  return apiJson<PayrollPeriod>(`/payroll/periods/${id}/calculate`, { method: "POST", body: JSON.stringify(body) });
}

export function lockPayrollPeriod(id: string) {
  return apiJson<PayrollPeriod>(`/payroll/periods/${id}/lock`, { method: "POST" });
}

export function unlockPayrollPeriod(id: string) {
  return apiJson<PayrollPeriod>(`/payroll/periods/${id}/unlock`, { method: "POST" });
}

export function markPayrollPeriodPaid(id: string, body: any = {}) {
  return apiJson<PayrollPeriod>(`/payroll/periods/${id}/mark-paid`, { method: "POST", body: JSON.stringify(body) });
}

export function updatePayrollLine(id: string, body: any) {
  return apiJson(`/payroll/lines/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function addPayrollAdjustment(id: string, body: any) {
  return apiJson(`/payroll/lines/${id}/adjustments`, { method: "POST", body: JSON.stringify(body) });
}

export function markPayrollLinePaid(id: string, body: any = {}) {
  return apiJson(`/payroll/lines/${id}/mark-paid`, { method: "POST", body: JSON.stringify(body) });
}

export function listPayrollConfigs(params: Record<string, any> = {}) {
  return apiJson<PayrollConfig[]>(`/payroll/configs${qs(params)}`);
}

export function createPayrollConfig(body: any) {
  return apiJson<PayrollConfig>("/payroll/configs", { method: "POST", body: JSON.stringify(body) });
}

export function updatePayrollConfig(id: string, body: any) {
  return apiJson<PayrollConfig>(`/payroll/configs/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function listStaffOptions() {
  return apiJson<any[]>("/staff");
}

export function listBranchOptions() {
  return apiJson<any[]>("/branches");
}

export function listPaymentSources() {
  return apiJson<any[]>("/payment-sources");
}
