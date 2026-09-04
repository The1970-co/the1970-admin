"use client";

import type { PayrollLine } from "@/types/payroll";

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(n(value)) + "đ";
}
function num(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(n(value));
}
function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function adjustmentLabel(type?: string) {
  if (type === "BONUS") return "Thưởng";
  if (type === "ALLOWANCE") return "Phụ cấp";
  if (type === "ADVANCE") return "Tạm ứng";
  if (type === "DEDUCTION") return "Khấu trừ";
  return type || "—";
}

function bonusAllowanceNote(line: PayrollLine) {
  const reasons = (Array.isArray(line.adjustments) ? line.adjustments : [])
    .filter((item: any) => ["BONUS", "ALLOWANCE"].includes(String(item.type || "").toUpperCase()))
    .map((item: any) => String(item.reason || "").trim())
    .filter(Boolean);
  return Array.from(new Set([String(line.note || "").trim(), ...reasons].filter(Boolean))).join(" · ");
}

export default function PayrollEmployeeDrawer({ line, onClose }: { line: PayrollLine | null; onClose: () => void }) {
  if (!line) return null;
  const orders = Array.isArray(line.orderLinks) ? line.orderLinks : [];
  const adjustments = Array.isArray(line.adjustments) ? line.adjustments : [];
  const overtimeRows = (Array.isArray(line.overtimeBreakdown) ? line.overtimeBreakdown : [])
    .map((row: any, index: number) => ({ ...row, index }))
    .filter((row: any) => n(row.hours) > 0);
  const rewardNote = bonusAllowanceNote(line);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <button className="flex-1" onClick={onClose} aria-label="Đóng" />
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">Chi tiết lương</p>
              <h3 className="mt-2 text-2xl font-semibold text-neutral-950">{line.staffName || "Nhân viên"}</h3>
              <p className="mt-1 text-sm text-neutral-500">{line.staffCode || "—"} · {line.branchName || line.branchId || "—"}</p>
            </div>
            <button onClick={onClose} className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Đóng</button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Card label="Thực nhận" value={money(line.netPay)} strong />
            <Card label="Tổng lương" value={money(line.grossPay)} />
            <Card label="Đã trả" value={money(line.paidAmount)} />
            <Card label="Trạng thái" value={String(line.status || "DRAFT")} />
          </div>

          <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-neutral-950">Công thức tính</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Row label="Lương cứng theo công" value={money(line.proratedSalary)} />
              <Row label="Ngày công / chuẩn" value={`${num(line.workingDays)} / ${num(line.standardDays)}`} />
              <Row label="Giờ quy đổi" value={`${num(line.convertedWorkingHours)} giờ · ${money(line.hourlyAmount)}`} />
              <Row label="Tổng tăng ca" value={money(line.overtimeAmount)} />
              {overtimeRows.length
                ? overtimeRows.map((row: any) => <Row key={row.key || row.index} label={`TC${row.index + 1}${row.label ? ` · ${row.label}` : ""}`} value={`${num(row.hours)}h × ${money(row.baseHourlyRate)} × ${num(row.multiplier)} = ${money(row.amount)}`} />)
                : <Row label="Chi tiết tăng ca" value="Không có tăng ca" />}
              <Row label="Nghỉ có lương" value={`${num(line.paidLeaveDays)} ngày · ${money(line.paidLeaveAmount)}`} />
              <Row label="SP gắn tên" value={`${num(line.taggedProductQty)} sp · ${money(line.taggedProductAmount)}`} />
              <Row label="Thưởng COD GHN" value={`${num(line.ghnCodOrderCount)} đơn · ${money(line.ghnCodBonusAmount)}`} />
              <Row label="Ăn trưa / BH" value={`${money(line.mealAllowanceAmount)} / -${money(line.insuranceDeduction)}`} />
              <Row label="Nguồn đơn" value={attributionLabel(line.orderAttributionMode)} />
              <Row label="Đơn thành công" value={`${num(line.successOrderCount)} đơn · ${money(line.commissionByOrder)}`} />
              <Row label="Sản phẩm thành công" value={`${num(line.successItemQty)} sp · ${money(line.commissionByItem)}`} />
              <Row label="% doanh thu" value={`${money(line.revenueAmount)} · ${money(line.commissionByPercent)}`} />
              <Row label="Tổng hoa hồng" value={money(line.commissionTotal)} />
              <Row label="Thưởng + phụ cấp" value={`${money(line.bonus)} + ${money(line.allowance)}`} />
              {rewardNote ? <Row label="Ghi chú thưởng / phụ cấp" value={rewardNote} /> : null}
              <Row label="Tạm ứng + khấu trừ" value={`${money(line.advance)} + ${money(line.deduction)}`} />
            </div>
          </section>

          <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-neutral-950">Đơn được tính lương</h4>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">{orders.length} đơn</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-3">Đơn</th>
                    <th className="px-3 py-3">Ngày</th>
                    <th className="px-3 py-3 text-right">Doanh thu</th>
                    <th className="px-3 py-3 text-right">SL SP</th>
                    <th className="px-3 py-3 text-right">Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-3 font-medium text-neutral-900">{order.orderCode || order.orderId}</td>
                      <td className="px-3 py-3 text-neutral-600">{dateText(order.orderDate)}</td>
                      <td className="px-3 py-3 text-right text-neutral-700">{money(order.revenueAmount)}</td>
                      <td className="px-3 py-3 text-right text-neutral-700">{num(order.itemQty)}</td>
                      <td className="px-3 py-3 text-neutral-600">{order.reason || attributionLabel(order.attributionSource)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-neutral-900">{money(order.commissionTotal || order.commission)}</td>
                    </tr>
                  ))}
                  {!orders.length ? <tr><td className="px-3 py-8 text-center text-neutral-500" colSpan={6}>Chưa có đơn hợp lệ trong kỳ.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-neutral-950">Lịch sử điều chỉnh</h4>
            <div className="mt-4 space-y-2">
              {adjustments.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-neutral-900">{adjustmentLabel(item.type)} · {money(item.amount)}</div>
                    <div className="mt-1 text-xs text-neutral-500">{item.reason || "Không ghi chú"} · {item.createdByName || "—"} · {dateText(item.createdAt)}</div>
                  </div>
                </div>
              ))}
              {!adjustments.length ? <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có điều chỉnh tay.</div> : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function attributionLabel(mode?: string | null) {
  if (mode === "CREATED_BY") return "Người tạo đơn";
  if (mode === "ASSIGNED_ONLY") return "Chỉ NV phụ trách";
  if (mode === "ASSIGNED_STAFF") return "NV phụ trách";
  if (mode === "CREATED_BY_FALLBACK") return "Người tạo do chưa gán";
  return "NV phụ trách / người tạo";
}

function Card({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`rounded-3xl border p-4 ${strong ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-white"}`}><div className={`text-xs ${strong ? "text-neutral-300" : "text-neutral-500"}`}>{label}</div><div className="mt-2 text-lg font-semibold">{value}</div></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-neutral-50 px-4 py-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 font-semibold text-neutral-900">{value}</div></div>;
}
