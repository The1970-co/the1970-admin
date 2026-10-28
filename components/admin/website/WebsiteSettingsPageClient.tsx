"use client";

import { useEffect, useState } from "react";
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  type WebsiteSettings,
} from "@/lib/website-settings-api";
import {
  getWebsiteNavigation,
  publishWebsiteNavigation,
  saveWebsiteNavigation,
  type WebsiteNavigationConfig,
  type WebsiteNavigationSettings,
} from "@/lib/website-navigation-api";
import { useAuth } from "@/components/admin/auth/AuthProvider";

const DEFAULT_NAV_SETTINGS: WebsiteNavigationSettings = {
  menuFontFamily: "SERIF",
  menuFontSize: 12,
  menuGap: 28,
  megaMenuHeightVh: 48,
  megaOverlayOpacity: 0.28,
  headerSticky: true,
  announcementEnabled: true,
  announcementTextVi: "THE 1970 — EST. 2015",
  announcementLink: "",
};

const DEFAULT_SETTINGS: WebsiteSettings = {
  market: "VN",
  cartEnabled: false,
  checkoutEnabled: false,
  newCustomerDiscountEnabled: false,
  newCustomerDiscountPercent: 10,
  messengerEnabled: false,
  messengerUrl: "",
  zaloEnabled: false,
  zaloUrl: "",
  defaultBranchId: "",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function WebsiteSettingsPageClient() {
  const { can } = useAuth();
  const canEdit = can("website.edit");
  const canPublish = can("website.publish");

  const [form, setForm] =
    useState<WebsiteSettings>(DEFAULT_SETTINGS);
  const [navigation, setNavigation] =
    useState<WebsiteNavigationConfig | null>(null);
  const [navSettings, setNavSettings] =
    useState<WebsiteNavigationSettings>(DEFAULT_NAV_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [settingsRow, navigationRow] = await Promise.all([
        getWebsiteSettings("VN"),
        getWebsiteNavigation("VN"),
      ]);

      setForm({
        ...DEFAULT_SETTINGS,
        ...(settingsRow || {}),
        newCustomerDiscountPercent: Number(
          settingsRow?.newCustomerDiscountPercent ??
            DEFAULT_SETTINGS.newCustomerDiscountPercent,
        ),
      });

      const config = (navigationRow?.draftConfig ||
        navigationRow?.publishedConfig || {
          version: 2,
          settings: DEFAULT_NAV_SETTINGS,
          items: [],
        }) as WebsiteNavigationConfig;

      setNavigation(config);
      setNavSettings({
        ...DEFAULT_NAV_SETTINGS,
        ...(config.settings || {}),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không tải được cài đặt website.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!navigation) return;

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      await saveWebsiteSettings(
        {
          cartEnabled: form.cartEnabled,
          checkoutEnabled: form.checkoutEnabled,
          newCustomerDiscountEnabled:
            form.newCustomerDiscountEnabled,
          newCustomerDiscountPercent: clamp(
            Number(form.newCustomerDiscountPercent || 0),
            0,
            100,
          ),
          messengerEnabled: form.messengerEnabled,
          messengerUrl: form.messengerUrl,
          zaloEnabled: form.zaloEnabled,
          zaloUrl: form.zaloUrl,
          defaultBranchId: form.defaultBranchId,
        },
        "VN",
      );

      const nextNavigation: WebsiteNavigationConfig = {
        ...navigation,
        version: Math.max(2, Number(navigation.version || 2)),
        settings: {
          ...navSettings,
          menuFontSize: clamp(
            Number(navSettings.menuFontSize || 12),
            10,
            18,
          ),
          menuGap: clamp(
            Number(navSettings.menuGap || 28),
            12,
            60,
          ),
          megaMenuHeightVh: clamp(
            Number(navSettings.megaMenuHeightVh || 48),
            35,
            65,
          ),
          megaOverlayOpacity: clamp(
            Number(navSettings.megaOverlayOpacity || 0.28),
            0,
            0.7,
          ),
        },
      };

      await saveWebsiteNavigation(nextNavigation, "VN");

      // Các setting header là phần giao diện live nên xuất bản luôn.
      if (canPublish) {
        await publishWebsiteNavigation("VN");
      }

      setNavigation(nextNavigation);
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không lưu được cài đặt website.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-neutral-500">
        Đang tải cài đặt website...
      </div>
    );
  }

  return (
    <div className="min-h-full bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">
              Website / Settings
            </div>
            <h1 className="mt-1 text-2xl font-semibold">
              Cài đặt website
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Điều khiển giỏ hàng, ưu đãi khách mới và giao diện header mà không cần sửa code.
            </p>
          </div>

          {canEdit ? (
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Đã lưu cài đặt.
          </div>
        ) : null}

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold">
            Header & Menu
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Các giá trị này áp dụng cho header global trên mọi trang.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            <label className="text-sm">
              <span className="mb-1 block font-medium">Font menu</span>
              <select
                value={navSettings.menuFontFamily}
                disabled={!canEdit}
                onChange={(e) =>
                  setNavSettings((old) => ({
                    ...old,
                    menuFontFamily:
                      e.target.value === "SANS" ? "SANS" : "SERIF",
                  }))
                }
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
              >
                <option value="SERIF">Serif — giống menu cũ</option>
                <option value="SANS">Sans — hiện đại hơn</option>
              </select>
            </label>
            <NumberField
              label="Cỡ chữ menu"
              value={navSettings.menuFontSize}
              min={10}
              max={18}
              suffix="px"
              disabled={!canEdit}
              onChange={(value) =>
                setNavSettings((old) => ({
                  ...old,
                  menuFontSize: value,
                }))
              }
            />

            <NumberField
              label="Khoảng cách menu"
              value={navSettings.menuGap}
              min={12}
              max={60}
              suffix="px"
              disabled={!canEdit}
              onChange={(value) =>
                setNavSettings((old) => ({
                  ...old,
                  menuGap: value,
                }))
              }
            />

            <NumberField
              label="Chiều cao Mega Menu"
              value={navSettings.megaMenuHeightVh}
              min={35}
              max={65}
              suffix="vh"
              disabled={!canEdit}
              onChange={(value) =>
                setNavSettings((old) => ({
                  ...old,
                  megaMenuHeightVh: value,
                }))
              }
            />

            <NumberField
              label="Độ tối nền khi mở menu"
              value={Math.round(
                navSettings.megaOverlayOpacity * 100,
              )}
              min={0}
              max={70}
              suffix="%"
              disabled={!canEdit}
              onChange={(value) =>
                setNavSettings((old) => ({
                  ...old,
                  megaOverlayOpacity: value / 100,
                }))
              }
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Toggle
              label="Header bám trên cùng khi cuộn"
              checked={navSettings.headerSticky}
              disabled={!canEdit}
              onChange={(checked) =>
                setNavSettings((old) => ({
                  ...old,
                  headerSticky: checked,
                }))
              }
            />

            <Toggle
              label="Hiển thị thanh thông báo phía trên"
              checked={navSettings.announcementEnabled}
              disabled={!canEdit}
              onChange={(checked) =>
                setNavSettings((old) => ({
                  ...old,
                  announcementEnabled: checked,
                }))
              }
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">
                Nội dung thanh thông báo
              </span>
              <input
                value={navSettings.announcementTextVi}
                disabled={!canEdit}
                onChange={(e) =>
                  setNavSettings((old) => ({
                    ...old,
                    announcementTextVi: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">
                Link thanh thông báo
              </span>
              <input
                value={navSettings.announcementLink}
                disabled={!canEdit}
                onChange={(e) =>
                  setNavSettings((old) => ({
                    ...old,
                    announcementLink: e.target.value,
                  }))
                }
                placeholder="/collections/all"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold">
            Giỏ hàng & Checkout
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Toggle
              label="Bật giỏ hàng"
              checked={form.cartEnabled}
              disabled={!canEdit}
              onChange={(checked) =>
                setForm((old) => ({
                  ...old,
                  cartEnabled: checked,
                }))
              }
            />

            <Toggle
              label="Bật tạo đơn / checkout"
              checked={form.checkoutEnabled}
              disabled={!canEdit}
              onChange={(checked) =>
                setForm((old) => ({
                  ...old,
                  checkoutEnabled: checked,
                }))
              }
            />
          </div>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">
              Branch ID mặc định của website
            </span>
            <input
              value={form.defaultBranchId}
              disabled={!canEdit}
              onChange={(e) =>
                setForm((old) => ({
                  ...old,
                  defaultBranchId: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
              placeholder="branchId"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold">
            Ưu đãi khách mới
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Toggle
              label="Bật giảm giá khách mới"
              checked={form.newCustomerDiscountEnabled}
              disabled={!canEdit}
              onChange={(checked) =>
                setForm((old) => ({
                  ...old,
                  newCustomerDiscountEnabled: checked,
                }))
              }
            />

            <NumberField
              label="Mức giảm"
              value={form.newCustomerDiscountPercent}
              min={0}
              max={100}
              suffix="%"
              disabled={!canEdit}
              onChange={(value) =>
                setForm((old) => ({
                  ...old,
                  newCustomerDiscountPercent: value,
                }))
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold">
            Nhắn tin sau khi đặt hàng
          </h2>

          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border p-4">
              <Toggle
                label="Messenger"
                checked={form.messengerEnabled}
                disabled={!canEdit}
                onChange={(checked) =>
                  setForm((old) => ({
                    ...old,
                    messengerEnabled: checked,
                  }))
                }
              />

              <input
                value={form.messengerUrl}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((old) => ({
                    ...old,
                    messengerUrl: e.target.value,
                  }))
                }
                placeholder="https://m.me/..."
                className="mt-3 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </div>

            <div className="rounded-xl border p-4">
              <Toggle
                label="Zalo"
                checked={form.zaloEnabled}
                disabled={!canEdit}
                onChange={(checked) =>
                  setForm((old) => ({
                    ...old,
                    zaloEnabled: checked,
                  }))
                }
              />

              <input
                value={form.zaloUrl}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((old) => ({
                    ...old,
                    zaloUrl: e.target.value,
                  }))
                }
                placeholder="https://zalo.me/..."
                className="mt-3 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 px-4 py-3 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <div className="flex overflow-hidden rounded-xl border border-neutral-300">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-w-0 flex-1 border-0 px-3 py-2.5 outline-none"
        />
        <span className="flex items-center border-l bg-neutral-50 px-3 text-neutral-500">
          {suffix}
        </span>
      </div>
      <span className="mt-1 block text-xs text-neutral-400">
        {min}–{max}
      </span>
    </label>
  );
}
