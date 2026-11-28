"use client";

import { useEffect, useRef, useState } from "react";
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
import { uploadWebsiteImage } from "@/lib/website-products-api";
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
  siteBackgroundColor: "#F4EFE7",
  headerLogoUrl: "",
  headerLogoWidth: 118,
  headerLogoAlign: "LEFT",
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

const DEFAULT_SITE_BACKGROUND = "#F4EFE7";
function validBackground(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
function previewForeground(hex: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] > .179 ? "#1D1C19" : "#FFFFFF";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function WebsiteSettingsPageClient() {
  const { can } = useAuth();
  const canEdit = can("website.edit");
  const canPublish = can("website.publish");
  const canUpload = can("website.image.upload");

  const [form, setForm] =
    useState<WebsiteSettings>(DEFAULT_SETTINGS);
  const [navigation, setNavigation] =
    useState<WebsiteNavigationConfig | null>(null);
  const [navSettings, setNavSettings] =
    useState<WebsiteNavigationSettings>(DEFAULT_NAV_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [themePreviewUrl, setThemePreviewUrl] = useState("");
  const previewRef = useRef<HTMLIFrameElement>(null);
  const colorInput = navSettings.siteBackgroundColor ?? DEFAULT_SITE_BACKGROUND;
  const themeColor = validBackground(colorInput) ? colorInput : DEFAULT_SITE_BACKGROUND;
  const themeText = previewForeground(themeColor);

  function sendThemePreview() {
    if (!themePreviewUrl) return;
    previewRef.current?.contentWindow?.postMessage(
      { type: "THE1970_THEME_PREVIEW", color: themeColor },
      new URL(themePreviewUrl).origin,
    );
  }

  useEffect(() => {
    if (!themePreviewUrl) return;
    sendThemePreview();
    const onReady = (event: MessageEvent) => {
      if (event.source !== previewRef.current?.contentWindow ||
          event.origin !== new URL(themePreviewUrl).origin ||
          event.data?.type !== "THE1970_THEME_PREVIEW_READY") return;
      sendThemePreview();
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [themeColor, themePreviewUrl]);

  function openThemePreview() {
    const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    setThemePreviewUrl(local
      ? `${window.location.protocol}//${window.location.hostname}:3002/?themePreview=1`
      : "https://web.the1970.co/?themePreview=1");
  }

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

  function patchSettings(patch: Partial<WebsiteNavigationSettings>) {
    if (!canEdit) return;
    setNavSettings((old) => ({ ...old, ...patch }));
    setSaved(false);
  }

  async function uploadHeaderLogo(file: File | undefined) {
    if (!file || !canUpload || !canEdit || saving || uploadingLogo) return;
    try {
      setUploadingLogo(true);
      setError("");
      const url = await uploadWebsiteImage(file);
      patchSettings({ headerLogoUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload logo header thất bại.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function save() {
    if (!navigation || !canEdit || uploadingLogo || saving) return;
    if (!validBackground(colorInput)) {
      setError("Mã màu nền phải có dạng #RRGGBB, ví dụ #F4EFE7.");
      return;
    }

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

      // Settings and menu are edited in separate screens. Keep the latest menu draft.
      const latestRow = await getWebsiteNavigation("VN");
      const latestNavigation = (latestRow?.draftConfig || latestRow?.publishedConfig || navigation) as WebsiteNavigationConfig;
      const nextNavigation: WebsiteNavigationConfig = {
        ...latestNavigation,
        version: Math.max(2, Number(latestNavigation.version || 2)),
        settings: {
          ...latestNavigation.settings,
          ...navSettings,
          siteBackgroundColor: colorInput.toUpperCase(),
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
              disabled={saving || uploadingLogo}
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
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Logo thanh menu</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Logo chung cho tất cả menu và trang. Chọn ảnh, kích thước, căn lề rồi bấm Lưu cài đặt.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="flex min-h-[120px] items-center justify-center rounded-xl border bg-neutral-50 p-4">
              {navSettings.headerLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={navSettings.headerLogoUrl}
                  src={navSettings.headerLogoUrl}
                  alt="The 1970"
                  style={{
                    width: `${Math.max(
                      40,
                      Math.min(
                        420,
                        Number(navSettings.headerLogoWidth || 118),
                      ),
                    )}px`,
                    maxHeight: "72px",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div className="font-serif text-xl font-semibold tracking-[.12em]">
                  THE 1970
                </div>
              )}
            </div>

            <div className="space-y-4">
              {canUpload && canEdit ? (
                <label className="block cursor-pointer rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm font-medium">
                  {uploadingLogo ? "Đang upload logo..." : "Chọn file logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogo || saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void uploadHeaderLogo(file);
                    }}
                  />
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Kích thước logo
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={40}
                    max={420}
                    step={2}
                    disabled={!canEdit || saving || uploadingLogo}
                    value={Number(navSettings.headerLogoWidth || 118)}
                    onChange={(e) =>
                      patchSettings({
                        headerLogoWidth: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <input
                    type="number"
                    min={40}
                    max={420}
                    disabled={!canEdit || saving || uploadingLogo}
                    value={Number(navSettings.headerLogoWidth || 118)}
                    onChange={(e) =>
                      patchSettings({
                        headerLogoWidth: Math.max(
                          40,
                          Math.min(420, Number(e.target.value || 118)),
                        ),
                      })
                    }
                    className="w-20 rounded-lg border px-2 py-2 text-sm"
                  />
                  <span className="text-xs text-neutral-500">px</span>
                </div>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Căn logo trong vùng bên trái
                </span>
                <select
                  disabled={!canEdit || saving || uploadingLogo}
                  value={navSettings.headerLogoAlign || "LEFT"}
                  onChange={(e) =>
                    patchSettings({
                      headerLogoAlign: e.target.value as
                        | "LEFT"
                        | "CENTER"
                        | "RIGHT",
                    })
                  }
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                >
                  <option value="LEFT">Căn trái</option>
                  <option value="CENTER">Căn giữa</option>
                  <option value="RIGHT">Căn phải</option>
                </select>
              </label>

              {navSettings.headerLogoUrl && canEdit ? (
                <button
                  type="button"
                  disabled={saving || uploadingLogo}
                  onClick={() => patchSettings({ headerLogoUrl: "" })}
                  className="text-sm font-medium text-red-600 underline"
                >
                  Xóa logo upload, dùng lại chữ THE 1970
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Màu nền chung website</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Một màu cho header, menu xổ xuống, menu mobile, nền chữ các thẻ và nền trang. Không đổi màu ảnh hay banner phủ ảnh.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Chọn màu</span>
              <input type="color" disabled={!canEdit} value={themeColor}
                onChange={(e) => setNavSettings((old) => ({ ...old, siteBackgroundColor: e.target.value.toUpperCase() }))}
                className="h-11 w-20 cursor-pointer rounded-xl border border-neutral-300 p-1" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Mã HEX</span>
              <input type="text" disabled={!canEdit} value={colorInput} maxLength={7}
                aria-invalid={!validBackground(colorInput)}
                onChange={(e) => setNavSettings((old) => ({ ...old, siteBackgroundColor: e.target.value }))}
                className="h-11 w-36 rounded-xl border border-neutral-300 px-3 font-mono" />
            </label>
            <button type="button" disabled={!canEdit}
              onClick={() => setNavSettings((old) => ({ ...old, siteBackgroundColor: DEFAULT_SITE_BACKGROUND }))}
              className="h-11 rounded-xl border px-4 text-sm">Khôi phục màu mặc định</button>
            <button type="button" onClick={() => themePreviewUrl ? setThemePreviewUrl("") : openThemePreview()}
              className="h-11 rounded-xl border border-black px-4 text-sm font-medium">{themePreviewUrl ? "Đóng xem trước" : "Xem trước trực tiếp"}</button>
          </div>
          <div className="mt-2 text-xs text-neutral-500">Mặc định: #F4EFE7 · {canPublish ? "Bấm Lưu cài đặt để áp dụng trên website." : "Thay đổi sẽ lưu nháp, cần người có quyền xuất bản."}</div>
          {!validBackground(colorInput) && <p className="mt-2 text-xs text-red-600">Nhập mã màu #RRGGBB hợp lệ.</p>}
          <div className="mt-4 overflow-hidden rounded-xl border text-sm" style={{ backgroundColor: themeColor, color: themeText }}>
            <div className="flex items-center justify-between border-b border-current/10 px-5 py-3"><strong className="tracking-[.2em]">THE 1970</strong><span>ÁO PHÔNG &nbsp; SƠ MI &nbsp; QUẦN &nbsp; ÁO KHOÁC</span></div>
            <div className="grid grid-cols-2 gap-3 px-5 py-4"><div><strong>Menu xổ xuống</strong><p className="mt-2 opacity-70">Xem tất cả sản phẩm</p></div><div className="grid grid-cols-2 gap-2">{["DARK BROWN", "HERITAGE SAGE"].map((label, index) => <div key={label}><div className="h-14" style={{backgroundColor:index ? "#8A8069" : "#5B4435"}} /><div className="py-2 text-xs">{label}</div></div>)}</div></div>
          </div>
          {themePreviewUrl && <iframe ref={previewRef} onLoad={sendThemePreview} src={themePreviewUrl}
            title="Xem trước màu nền website" className="mt-4 h-[650px] w-full rounded-xl border bg-white" />}
        </section>

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
