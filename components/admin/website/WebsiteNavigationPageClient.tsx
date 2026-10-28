"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getWebsiteNavigation,
  publishWebsiteNavigation,
  saveWebsiteNavigation,
  type WebsiteNavColumn,
  type WebsiteNavItem,
  type WebsiteNavLink,
  type WebsiteNavPromo,
  type WebsiteNavigationConfig,
  type WebsiteNavigationSettings,
} from "@/lib/website-navigation-api";
import { uploadWebsiteImage } from "@/lib/website-products-api";
import { useAuth } from "@/components/admin/auth/AuthProvider";

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_SETTINGS: WebsiteNavigationSettings = {
  menuFontFamily: "SERIF",
  menuFontSize: 12,
  menuGap: 28,
  megaMenuHeightVh: 48,
  megaOverlayOpacity: 0.28,
  headerSticky: true,
  announcementEnabled: true,
  announcementTextVi: "THE 1970 — EST. 2015",
  announcementLink: "",
  headerLogoUrl: "",
  headerLogoWidth: 118,
  headerLogoAlign: "LEFT",
};

function blankLink(): WebsiteNavLink {
  return {
    id: uid("link"),
    labelVi: "",
    labelEn: "",
    link: "/collections/all",
    enabled: true,
  };
}

function blankColumn(): WebsiteNavColumn {
  return {
    id: uid("column"),
    titleVi: "",
    titleEn: "",
    links: [blankLink()],
  };
}

function blankPromo(): WebsiteNavPromo {
  return {
    id: uid("promo"),
    enabled: true,
    imageUrl: "",
    titleVi: "",
    titleEn: "",
    link: "/collections/all",
  };
}

function blankItem(): WebsiteNavItem {
  return {
    id: uid("menu"),
    enabled: true,
    type: "MEGA",
    labelVi: "Menu mới",
    labelEn: "",
    link: "/collections/all",
    columns: [blankColumn(), blankColumn()],
    promos: [blankPromo(), blankPromo()],
  };
}

function normalizeConfig(row: any): WebsiteNavigationConfig {
  const source =
    row?.draftConfig ||
    row?.publishedConfig || {
      version: 2,
      settings: DEFAULT_SETTINGS,
      items: [],
    };

  return {
    version: Number(source?.version || 2),
    settings: {
      ...DEFAULT_SETTINGS,
      ...(source?.settings || {}),
    },
    items: Array.isArray(source?.items)
      ? source.items.map((item: any) => {
          const legacyPromo = item?.promo;
          const promos = Array.isArray(item?.promos)
            ? item.promos
            : legacyPromo
              ? [
                  {
                    id: uid("promo"),
                    enabled: legacyPromo.enabled !== false,
                    imageUrl: legacyPromo.imageUrl || "",
                    titleVi: legacyPromo.titleVi || "",
                    titleEn: legacyPromo.titleEn || "",
                    link: legacyPromo.link || item.link || "/collections/all",
                  },
                ]
              : [];

          return {
            ...item,
            id: item?.id || uid("menu"),
            enabled: item?.enabled !== false,
            type: item?.type === "MEGA" ? "MEGA" : "LINK",
            labelVi: item?.labelVi || "",
            labelEn: item?.labelEn || "",
            link: item?.link || "/collections/all",
            columns: Array.isArray(item?.columns)
              ? item.columns.map((column: any) => ({
                  ...column,
                  id: column?.id || uid("column"),
                  links: Array.isArray(column?.links)
                    ? column.links.map((link: any) => ({
                        ...link,
                        id: link?.id || uid("link"),
                        enabled: link?.enabled !== false,
                      }))
                    : [],
                }))
              : [],
            promos: promos.slice(0, 2),
          } as WebsiteNavItem;
        })
      : [],
  };
}

export default function WebsiteNavigationPageClient() {
  const { can } = useAuth();
  const canEdit = can("website.edit");
  const canDelete = can("website.delete");
  const canPublish = can("website.publish");
  const canUpload = can("website.image.upload");

  const [config, setConfig] = useState<WebsiteNavigationConfig>({
    version: 2,
    settings: DEFAULT_SETTINGS,
    items: [],
  });
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingPromoId, setUploadingPromoId] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const row = await getWebsiteNavigation("VN");
      const next = normalizeConfig(row);
      setConfig(next);
      setSelectedId(next.items[0]?.id || "");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không tải được menu website.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(
    () => config.items.find((item) => item.id === selectedId) || null,
    [config.items, selectedId],
  );

  function setItems(items: WebsiteNavItem[]) {
    setConfig((old) => ({ ...old, items }));
  }

  function patchSettings(patch: Partial<WebsiteNavigationSettings>) {
    setConfig((old) => ({
      ...old,
      settings: {
        ...old.settings,
        ...patch,
      },
    }));
  }

  async function uploadHeaderLogo(file: File | undefined) {
    if (!file || !canUpload) return;

    try {
      setUploadingLogo(true);
      setError("");
      const url = await uploadWebsiteImage(file);
      patchSettings({ headerLogoUrl: url });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Upload logo header thất bại.",
      );
    } finally {
      setUploadingLogo(false);
    }
  }

  function patchItem(id: string, patch: Partial<WebsiteNavItem>) {
    setItems(
      config.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  function addMenu() {
    const item = blankItem();
    setItems([...config.items, item]);
    setSelectedId(item.id);
  }

  function duplicateMenu(item: WebsiteNavItem) {
    const copy: WebsiteNavItem = {
      ...structuredClone(item),
      id: uid("menu"),
      labelVi: `${item.labelVi || "Menu"} — bản sao`,
      columns: item.columns.map((column) => ({
        ...column,
        id: uid("column"),
        links: column.links.map((link) => ({ ...link, id: uid("link") })),
      })),
      promos: item.promos.map((promo) => ({
        ...promo,
        id: uid("promo"),
      })),
    };

    setItems([...config.items, copy]);
    setSelectedId(copy.id);
  }

  function removeMenu(id: string) {
    if (!confirm("Xóa menu này?")) return;
    const next = config.items.filter((item) => item.id !== id);
    setItems(next);
    if (selectedId === id) setSelectedId(next[0]?.id || "");
  }

  function moveMenu(id: string, direction: -1 | 1) {
    const index = config.items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= config.items.length) return;

    const next = [...config.items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  function patchColumn(
    columnId: string,
    patch: Partial<WebsiteNavColumn>,
  ) {
    if (!selected) return;

    patchItem(selected.id, {
      columns: selected.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    });
  }

  function addColumn() {
    if (!selected) return;
    patchItem(selected.id, {
      type: "MEGA",
      columns: [...selected.columns, blankColumn()],
      promos:
        selected.promos.length > 0
          ? selected.promos
          : [blankPromo(), blankPromo()],
    });
  }

  function removeColumn(columnId: string) {
    if (!selected) return;
    patchItem(selected.id, {
      columns: selected.columns.filter((column) => column.id !== columnId),
    });
  }

  function patchLink(
    columnId: string,
    linkId: string,
    patch: Partial<WebsiteNavLink>,
  ) {
    if (!selected) return;

    patchItem(selected.id, {
      columns: selected.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              links: column.links.map((link) =>
                link.id === linkId ? { ...link, ...patch } : link,
              ),
            }
          : column,
      ),
    });
  }

  function addLink(columnId: string) {
    const column = selected?.columns.find((x) => x.id === columnId);
    if (!column) return;
    patchColumn(columnId, {
      links: [...column.links, blankLink()],
    });
  }

  function removeLink(columnId: string, linkId: string) {
    const column = selected?.columns.find((x) => x.id === columnId);
    if (!column) return;
    patchColumn(columnId, {
      links: column.links.filter((link) => link.id !== linkId),
    });
  }

  function ensureTwoPromos() {
    if (!selected) return;

    const promos = [...selected.promos];
    while (promos.length < 2) promos.push(blankPromo());

    patchItem(selected.id, {
      promos: promos.slice(0, 2),
    });
  }

  function patchPromo(
    promoId: string,
    patch: Partial<WebsiteNavPromo>,
  ) {
    if (!selected) return;

    patchItem(selected.id, {
      promos: selected.promos.map((promo) =>
        promo.id === promoId ? { ...promo, ...patch } : promo,
      ),
    });
  }

  async function uploadPromo(
    promoId: string,
    file: File | undefined,
  ) {
    if (!file || !selected || !canUpload) return;

    try {
      setUploadingPromoId(promoId);
      setError("");
      const url = await uploadWebsiteImage(file);
      patchPromo(promoId, {
        imageUrl: url,
        enabled: true,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Upload ảnh promo thất bại.",
      );
    } finally {
      setUploadingPromoId("");
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      await saveWebsiteNavigation(
        {
          ...config,
          version: Math.max(2, Number(config.version || 2)),
        },
        "VN",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không lưu được menu website.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    try {
      setPublishing(true);
      setError("");
      await saveWebsiteNavigation(
        {
          ...config,
          version: Math.max(2, Number(config.version || 2)),
        },
        "VN",
      );
      await publishWebsiteNavigation("VN");
      alert("Đã xuất bản menu website.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không xuất bản được menu website.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-neutral-500">
        Đang tải menu website...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-100">
      <div className="z-30 flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">
            Website / Menu
          </div>
          <h1 className="mt-1 text-xl font-semibold">
            Menu website
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Menu global trên toàn website. Mega menu hỗ trợ 2 ảnh promo như Taylor Stitch.
          </p>
        </div>

        <div className="flex gap-2">
          {canEdit ? (
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold"
            >
              {saving ? "Đang lưu..." : "Lưu nháp"}
            </button>
          ) : null}

          {canPublish ? (
            <button
              onClick={() => void publish()}
              disabled={saving || publishing}
              className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white"
            >
              {publishing ? "Đang xuất bản..." : "Xuất bản"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-0 overflow-hidden">
        <aside className="min-h-0 overflow-y-auto border-r border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Menu trên cùng</div>
            {canEdit ? (
              <button
                onClick={addMenu}
                className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
              >
                + Menu
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {config.items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedId === item.id
                    ? "border-black bg-neutral-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[.06em]">
                      {item.labelVi || "Chưa đặt tên"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {item.type} · {item.link}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-400">
                    {index + 1}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-6">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
              Chọn một menu bên trái hoặc tạo menu mới.
            </div>
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Logo thanh menu</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Upload file thiết kế logo thay cho chữ THE 1970. Có thể chỉnh kích thước và căn trái / giữa / phải trong vùng logo.
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="flex min-h-[120px] items-center justify-center rounded-xl border bg-neutral-50 p-4">
                    {config.settings.headerLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={config.settings.headerLogoUrl}
                        alt="The 1970"
                        style={{
                          width: `${Math.max(
                            40,
                            Math.min(
                              260,
                              Number(config.settings.headerLogoWidth || 118),
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
                    {canUpload ? (
                      <label className="block cursor-pointer rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm font-medium">
                        {uploadingLogo ? "Đang upload logo..." : "Chọn file logo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          disabled={uploadingLogo}
                          onChange={(e) =>
                            void uploadHeaderLogo(e.target.files?.[0])
                          }
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
                          max={260}
                          step={2}
                          disabled={!canEdit}
                          value={Number(config.settings.headerLogoWidth || 118)}
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
                          max={260}
                          disabled={!canEdit}
                          value={Number(config.settings.headerLogoWidth || 118)}
                          onChange={(e) =>
                            patchSettings({
                              headerLogoWidth: Math.max(
                                40,
                                Math.min(260, Number(e.target.value || 118)),
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
                        disabled={!canEdit}
                        value={config.settings.headerLogoAlign || "LEFT"}
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

                    {config.settings.headerLogoUrl && canEdit ? (
                      <button
                        type="button"
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
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Menu chính
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Chữ ngoài website tự viết hoa bằng CSS.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={!canEdit}
                      onClick={() => moveMenu(selected.id, -1)}
                      className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      disabled={!canEdit}
                      onClick={() => moveMenu(selected.id, 1)}
                      className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      disabled={!canEdit}
                      onClick={() => duplicateMenu(selected)}
                      className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
                    >
                      Nhân bản
                    </button>
                    {canDelete ? (
                      <button
                        onClick={() => removeMenu(selected.id)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"
                      >
                        Xóa
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">
                      Tên tiếng Việt
                    </span>
                    <input
                      value={selected.labelVi}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchItem(selected.id, {
                          labelVi: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium">
                      Tên tiếng Anh
                    </span>
                    <input
                      value={selected.labelEn}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchItem(selected.id, {
                          labelEn: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium">
                      Link
                    </span>
                    <input
                      value={selected.link}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchItem(selected.id, {
                          link: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium">
                      Loại menu
                    </span>
                    <select
                      value={selected.type}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const type =
                          e.target.value === "MEGA"
                            ? "MEGA"
                            : "LINK";
                        patchItem(selected.id, {
                          type,
                          columns:
                            type === "MEGA" &&
                            !selected.columns.length
                              ? [blankColumn(), blankColumn()]
                              : selected.columns,
                          promos:
                            type === "MEGA" &&
                            !selected.promos.length
                              ? [blankPromo(), blankPromo()]
                              : selected.promos,
                        });
                      }}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                    >
                      <option value="LINK">LINK</option>
                      <option value="MEGA">MEGA</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    disabled={!canEdit}
                    onChange={(e) =>
                      patchItem(selected.id, {
                        enabled: e.target.checked,
                      })
                    }
                  />
                  Hiển thị menu
                </label>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Cột link trong Mega Menu
                        </h2>
                        <p className="text-sm text-neutral-500">
                          Mọi menu đều có thể tạo menu con. Nếu đang là LINK, bấm + Cột sẽ tự chuyển sang MEGA.
                        </p>
                      </div>

                      {canEdit ? (
                        <button
                          onClick={addColumn}
                          className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        >
                          + Cột
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {selected.columns.map((column) => (
                        <div
                          key={column.id}
                          className="rounded-xl border border-neutral-200 p-4"
                        >
                          <div className="mb-3 flex gap-2">
                            <input
                              value={column.titleVi}
                              disabled={!canEdit}
                              onChange={(e) =>
                                patchColumn(column.id, {
                                  titleVi: e.target.value,
                                })
                              }
                              placeholder="Tên cột"
                              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                            />
                            {canDelete ? (
                              <button
                                onClick={() =>
                                  removeColumn(column.id)
                                }
                                className="rounded-lg border border-red-200 px-3 text-xs text-red-600"
                              >
                                Xóa
                              </button>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            {column.links.map((link) => (
                              <div
                                key={link.id}
                                className="grid grid-cols-[26px_1fr_1fr_34px] gap-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={link.enabled}
                                  disabled={!canEdit}
                                  onChange={(e) =>
                                    patchLink(
                                      column.id,
                                      link.id,
                                      {
                                        enabled:
                                          e.target.checked,
                                      },
                                    )
                                  }
                                />
                                <input
                                  value={link.labelVi}
                                  disabled={!canEdit}
                                  onChange={(e) =>
                                    patchLink(
                                      column.id,
                                      link.id,
                                      {
                                        labelVi:
                                          e.target.value,
                                      },
                                    )
                                  }
                                  placeholder="Tên link"
                                  className="rounded-lg border px-2 py-2 text-sm"
                                />
                                <input
                                  value={link.link}
                                  disabled={!canEdit}
                                  onChange={(e) =>
                                    patchLink(
                                      column.id,
                                      link.id,
                                      {
                                        link: e.target.value,
                                      },
                                    )
                                  }
                                  placeholder="/collections/..."
                                  className="rounded-lg border px-2 py-2 text-sm"
                                />
                                {canDelete ? (
                                  <button
                                    onClick={() =>
                                      removeLink(
                                        column.id,
                                        link.id,
                                      )
                                    }
                                    className="rounded-lg border text-xs"
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          {canEdit ? (
                            <button
                              onClick={() =>
                                addLink(column.id)
                              }
                              className="mt-3 text-xs font-semibold underline"
                            >
                              + Thêm link
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
              </section>

              {selected.type === "MEGA" ? (
                <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">
                          2 ảnh promo
                        </h2>
                        <p className="text-sm text-neutral-500">
                          Giống Taylor Stitch: 2 ảnh nổi bật nằm bên phải mega menu.
                        </p>
                      </div>

                      {canEdit &&
                      selected.promos.length < 2 ? (
                        <button
                          onClick={ensureTwoPromos}
                          className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        >
                          Tạo đủ 2 ảnh
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      {[0, 1].map((slot) => {
                        const promo =
                          selected.promos[slot] || null;

                        return (
                          <div
                            key={promo?.id || `slot-${slot}`}
                            className="rounded-xl border border-neutral-200 p-4"
                          >
                            <div className="mb-3 text-sm font-semibold">
                              Ảnh promo {slot + 1}
                            </div>

                            {!promo ? (
                              <button
                                disabled={!canEdit}
                                onClick={ensureTwoPromos}
                                className="w-full rounded-xl border border-dashed p-8 text-sm text-neutral-500 disabled:opacity-50"
                              >
                                + Tạo ô ảnh
                              </button>
                            ) : (
                              <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={promo.enabled}
                                    disabled={!canEdit}
                                    onChange={(e) =>
                                      patchPromo(promo.id, {
                                        enabled:
                                          e.target.checked,
                                      })
                                    }
                                  />
                                  Hiển thị ảnh này
                                </label>

                                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                                  {promo.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={promo.imageUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                                      Chưa có ảnh
                                    </div>
                                  )}
                                </div>

                                {canUpload ? (
                                  <label className="block cursor-pointer rounded-xl border border-neutral-300 px-3 py-2.5 text-center text-sm font-medium">
                                    {uploadingPromoId ===
                                    promo.id
                                      ? "Đang upload..."
                                      : "Chọn ảnh"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      disabled={
                                        uploadingPromoId ===
                                        promo.id
                                      }
                                      onChange={(e) =>
                                        void uploadPromo(
                                          promo.id,
                                          e.target.files?.[0],
                                        )
                                      }
                                    />
                                  </label>
                                ) : null}

                                <input
                                  value={promo.titleVi}
                                  disabled={!canEdit}
                                  onChange={(e) =>
                                    patchPromo(promo.id, {
                                      titleVi: e.target.value,
                                    })
                                  }
                                  placeholder="Tiêu đề dưới ảnh"
                                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                />

                                <label className="block text-sm">
                                  <span className="mb-1 block font-medium">
                                    Link khi khách bấm vào ảnh
                                  </span>
                                  <input
                                    value={promo.link}
                                    disabled={!canEdit}
                                    onChange={(e) =>
                                      patchPromo(promo.id, {
                                        link: e.target.value,
                                      })
                                    }
                                    placeholder="/products/... hoặc /collections/..."
                                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                </section>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
