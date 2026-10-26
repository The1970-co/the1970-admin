"use client";

import { useEffect, useState } from "react";
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  type WebsiteSettings,
} from "@/lib/website-settings-api";
import { useAuth } from "@/components/admin/auth/AuthProvider";

const defaults: WebsiteSettings = {
  market: "VN",
  cartEnabled: false,
  checkoutEnabled: false,
  newCustomerDiscountEnabled: false,
  newCustomerDiscountPercent: 0,
  messengerEnabled: false,
  messengerUrl: "",
  zaloEnabled: false,
  zaloUrl: "",
  defaultBranchId: "",
};

export default function WebsiteSettingsPageClient() {
  const { can } = useAuth();
  const canEdit = can("website.edit");
  const [form, setForm] = useState<WebsiteSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const row = await getWebsiteSettings("VN");
        setForm({ ...defaults, ...row });
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Không tải được cài đặt.");
      }
    })();
  }, []);

  const patch = <K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) =>
    setForm((old) => ({ ...old, [key]: value }));

  async function save() {
    try {
      setSaving(true);
      setMessage("");
      const row = await saveWebsiteSettings(form, "VN");
      setForm({ ...defaults, ...row });
      setMessage("Đã lưu cài đặt website.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">
              Website / Cài đặt
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Cài đặt website</h1>
          </div>
          {canEdit ? (
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              {saving ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          ) : null}
        </div>

        {message ? (
          <div className="rounded-xl border bg-white px-4 py-3 text-sm">{message}</div>
        ) : null}

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Giỏ hàng & checkout</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Toggle label="Bật giỏ hàng" checked={form.cartEnabled} disabled={!canEdit}
              onChange={(v)=>patch("cartEnabled",v)} />
            <Toggle label="Cho phép tạo đơn / checkout" checked={form.checkoutEnabled} disabled={!canEdit}
              onChange={(v)=>patch("checkoutEnabled",v)} />
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Sale theo khách hàng</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Toggle label="Sale khách mới theo SĐT" checked={form.newCustomerDiscountEnabled} disabled={!canEdit}
              onChange={(v)=>patch("newCustomerDiscountEnabled",v)} />
            <label>
              <div className="mb-1 text-sm font-medium">% giảm cho SĐT chưa từng có</div>
              <input
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={form.newCustomerDiscountPercent}
                onChange={(e)=>patch("newCustomerDiscountPercent",Math.max(0,Math.min(100,Number(e.target.value||0))))}
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Core API tự tra bảng Customer theo SĐT và tự tính lại discount khi tạo đơn.
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Nhắn tin cho shop</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <Toggle label="Bật Messenger" checked={form.messengerEnabled} disabled={!canEdit}
                onChange={(v)=>patch("messengerEnabled",v)} />
              <input disabled={!canEdit} value={form.messengerUrl||""}
                onChange={(e)=>patch("messengerUrl",e.target.value)}
                placeholder="https://m.me/..."
                className="h-11 w-full rounded-xl border px-3" />
            </div>
            <div className="space-y-3">
              <Toggle label="Bật Zalo" checked={form.zaloEnabled} disabled={!canEdit}
                onChange={(v)=>patch("zaloEnabled",v)} />
              <input disabled={!canEdit} value={form.zaloUrl||""}
                onChange={(e)=>patch("zaloUrl",e.target.value)}
                placeholder="https://zalo.me/..."
                className="h-11 w-full rounded-xl border px-3" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Đơn hàng web</h2>
          <label className="mt-4 block">
            <div className="mb-1 text-sm font-medium">Branch ID mặc định (nếu muốn gán)</div>
            <input disabled={!canEdit} value={form.defaultBranchId||""}
              onChange={(e)=>patch("defaultBranchId",e.target.value)}
              placeholder="Để trống nếu chưa cần"
              className="h-11 w-full rounded-xl border px-3" />
          </label>
        </section>
      </div>
    </div>
  );
}

function Toggle({label,checked,onChange,disabled}:{label:string;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean}) {
  return (
    <label className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-4">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e)=>onChange(e.target.checked)} className="h-5 w-5" />
    </label>
  );
}
