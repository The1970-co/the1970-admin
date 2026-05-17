import { apiFetch, apiJson } from "@/lib/api";
import type { AttendancePreviewRow, PayrollBranchConfigTemplate, PayrollConfig, PayrollPeriod, PayrollSettings } from "@/types/payroll";

function qs(params: Record<string, any>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function getPayrollDashboard(params: Record<string, any> = {}) {
  return apiJson<{ summary: any; byBranch: any[]; latestPeriods: PayrollPeriod[] }>(`/payroll/dashboard${qs(params)}`);
}
export function getPayrollSettings() { return apiJson<PayrollSettings>("/payroll/settings"); }
export function updatePayrollSettings(body: PayrollSettings) { return apiJson<PayrollSettings>("/payroll/settings", { method: "PATCH", body: JSON.stringify(body) }); }
export function listPayrollPeriods(params: Record<string, any> = {}) { return apiJson<{ rows: PayrollPeriod[]; total: number; page: number; pageSize: number; totalPages: number }>(`/payroll/periods${qs(params)}`); }
export function createPayrollPeriod(body: any) { return apiJson<PayrollPeriod>("/payroll/periods", { method: "POST", body: JSON.stringify(body) }); }
export function getPayrollPeriod(id: string) { return apiJson<PayrollPeriod>(`/payroll/periods/${id}`); }
export function calculatePayrollPeriod(id: string, body: any = {}) { return apiJson<PayrollPeriod>(`/payroll/periods/${id}/calculate`, { method: "POST", body: JSON.stringify(body) }); }
export function lockPayrollPeriod(id: string) { return apiJson<PayrollPeriod>(`/payroll/periods/${id}/lock`, { method: "POST" }); }
export function unlockPayrollPeriod(id: string) { return apiJson<PayrollPeriod>(`/payroll/periods/${id}/unlock`, { method: "POST" }); }
export function markPayrollPeriodPaid(id: string, body: any = {}) { return apiJson<PayrollPeriod>(`/payroll/periods/${id}/mark-paid`, { method: "POST", body: JSON.stringify(body) }); }
export function updatePayrollLine(id: string, body: any) { return apiJson(`/payroll/lines/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }
export function addPayrollAdjustment(id: string, body: any) { return apiJson(`/payroll/lines/${id}/adjustments`, { method: "POST", body: JSON.stringify(body) }); }
export function markPayrollLinePaid(id: string, body: any = {}) { return apiJson(`/payroll/lines/${id}/mark-paid`, { method: "POST", body: JSON.stringify(body) }); }
export function listPayrollConfigs(params: Record<string, any> = {}) { return apiJson<PayrollConfig[]>(`/payroll/configs${qs(params)}`); }

export function listPayrollBranchTemplates(params: Record<string, any> = {}) { return apiJson<PayrollBranchConfigTemplate[]>(`/payroll/branch-config-templates${qs(params)}`); }
export function createPayrollBranchTemplate(body: any) { return apiJson<PayrollBranchConfigTemplate>("/payroll/branch-config-templates", { method: "POST", body: JSON.stringify(body) }); }
export function updatePayrollBranchTemplate(id: string, body: any) { return apiJson<PayrollBranchConfigTemplate>(`/payroll/branch-config-templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }
export function applyPayrollBranchTemplate(body: any) { return apiJson<any>("/payroll/branch-config-templates/apply", { method: "POST", body: JSON.stringify(body) }); }
export function createPayrollConfig(body: any) { return apiJson<PayrollConfig>("/payroll/configs", { method: "POST", body: JSON.stringify(body) }); }
export function updatePayrollConfig(id: string, body: any) { return apiJson<PayrollConfig>(`/payroll/configs/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }

export async function previewAttendanceImport(periodId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`/payroll/periods/${periodId}/import-attendance/preview`, { method: "POST", body: formData });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || "Không preview được file chấm công.");
  return data as { fileName: string; summary: any; rows: AttendancePreviewRow[] };
}
export function applyAttendanceImport(periodId: string, body: { fileName?: string; rows: AttendancePreviewRow[]; autoCalculate?: boolean }) {
  return apiJson<PayrollPeriod>(`/payroll/periods/${periodId}/import-attendance/apply`, { method: "POST", body: JSON.stringify(body) });
}
export async function exportPayrollPeriod(id: string) {
  const res = await apiFetch(`/payroll/periods/${id}/export`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `payroll-${id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function listStaffOptions() { return apiJson<any[]>("/staff"); }
export function listBranchOptions() { return apiJson<any[]>("/branches"); }
export function listPaymentSources() { return apiJson<any[]>("/payment-sources"); }
