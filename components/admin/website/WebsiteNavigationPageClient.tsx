"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getWebsiteNavigation,
  publishWebsiteNavigation,
  saveWebsiteNavigation,
  type WebsiteNavColumn,
  type WebsiteNavItem,
  type WebsiteNavLink,
  type WebsiteNavigationConfig,
} from "@/lib/website-navigation-api";
import { uploadWebsiteImage } from "@/lib/website-products-api";

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function blankLink(): WebsiteNavLink {
  return {
    id: uid("link"),
    labelVi: "",
    labelEn: "",
    link: "",
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

function blankItem(): WebsiteNavItem {
  return {
    id: uid("menu"),
    enabled: true,
    type: "LINK",
    labelVi: "Menu mới",
    labelEn: "New Menu",
    link: "/collections/all",
    columns: [],
    promo: {
      enabled: false,
      imageUrl: "",
      titleVi: "",
      titleEn: "",
      link: "",
    },
  };
}

export default function WebsiteNavigationPageClient() {
  const [config, setConfig] = useState<WebsiteNavigationConfig>({
    version: 1,
    items: [],
  });
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const row = await getWebsiteNavigation("VN");
      const next = (row?.draftConfig ||
        row?.publishedConfig || { version: 1, items: [] }) as WebsiteNavigationConfig;
      setConfig(next);
      setSelectedId(next.items?.[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được menu website.");
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

  function patchItem(id: string, patch: Partial<WebsiteNavItem>) {
    setItems(config.items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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
      labelVi: `${item.labelVi} — bản sao`,
      columns: item.columns.map((column) => ({
        ...column,
        id: uid("column"),
        links: column.links.map((link) => ({ ...link, id: uid("link") })),
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

  function moveMenu(id: string, dir: -1 | 1) {
    const index = config.items.findIndex((item) => item.id === id);
    const to = index + dir;
    if (index < 0 || to < 0 || to >= config.items.length) return;
    const next = [...config.items];
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
  }

  function patchColumn(columnId: string, patch: Partial<WebsiteNavColumn>) {
    if (!selected) return;
    patchItem(selected.id, {
      columns: selected.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    });
  }

  function addColumn() {
    if (!selected) return;
    patchItem(selected.id, { columns: [...selected.columns, blankColumn()] });
  }

  function removeColumn(columnId: string) {
    if (!selected) return;
    patchItem(selected.id, {
      columns: selected.columns.filter((column) => column.id !== columnId),
    });
  }

  function moveColumn(columnId: string, dir: -1 | 1) {
    if (!selected) return;
    const index = selected.columns.findIndex((column) => column.id === columnId);
    const to = index + dir;
    if (index < 0 || to < 0 || to >= selected.columns.length) return;
    const columns = [...selected.columns];
    [columns[index], columns[to]] = [columns[to], columns[index]];
    patchItem(selected.id, { columns });
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
    patchColumn(columnId, { links: [...column.links, blankLink()] });
  }

  function removeLink(columnId: string, linkId: string) {
    const column = selected?.columns.find((x) => x.id === columnId);
    if (!column) return;
    patchColumn(columnId, {
      links: column.links.filter((link) => link.id !== linkId),
    });
  }

  function moveLink(columnId: string, linkId: string, dir: -1 | 1) {
    const column = selected?.columns.find((x) => x.id === columnId);
    if (!column) return;
    const index = column.links.findIndex((link) => link.id === linkId);
    const to = index + dir;
    if (index < 0 || to < 0 || to >= column.links.length) return;
    const links = [...column.links];
    [links[index], links[to]] = [links[to], links[index]];
    patchColumn(columnId, { links });
  }

  async function uploadPromo(file: File | undefined) {
    if (!selected || !file) return;
    try {
      setSaving(true);
      setError("");
      const url = await uploadWebsiteImage(file);
      patchItem(selected.id, {
        promo: { ...selected.promo, enabled: true, imageUrl: url },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload ảnh thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      await saveWebsiteNavigation(config, "VN");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được menu.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    try {
      setPublishing(true);
      setError("");
      await saveWebsiteNavigation(config, "VN");
      await publishWebsiteNavigation("VN");
      alert("Đã xuất bản menu website.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất bản được menu.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-neutral-500">Đang tải menu website...</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-100">
      <div className="z-30 shrink-0 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">
            Website / Menu
          </div>
          <h1 className="mt-1 text-xl font-semibold">Menu website</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Quản lý menu trên cùng, mega menu, submenu, link và ảnh.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold"
          >
            {saving ? "Đang lưu..." : "Lưu nháp"}
          </button>
          <button
            onClick={() => void publish()}
            disabled={saving || publishing}
            className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white"
          >
            {publishing ? "Đang xuất bản..." : "Xuất bản"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[330px_minmax(0,1fr)] overflow-hidden">
        <aside className="min-h-0 overflow-y-auto border-r border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Menu trên cùng
            </span>
            <button
              onClick={addMenu}
              className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white"
            >
              + Thêm menu
            </button>
          </div>

          <div className="space-y-2">
            {config.items.map((item, index) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-3 ${
                  selectedId === item.id
                    ? "border-black bg-neutral-50"
                    : "border-neutral-200"
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {index + 1}. {item.labelVi || "Chưa đặt tên"}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {item.type === "MEGA" ? "Mega menu" : "Menu thường"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        item.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {item.enabled ? "BẬT" : "TẮT"}
                    </span>
                  </div>
                </button>

                <div className="mt-3 flex gap-1">
                  <button
                    onClick={() => moveMenu(item.id, -1)}
                    className="rounded-lg border px-2 py-1 text-xs"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveMenu(item.id, 1)}
                    className="rounded-lg border px-2 py-1 text-xs"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => duplicateMenu(item)}
                    className="rounded-lg border px-2 py-1 text-xs"
                  >
                    Nhân bản
                  </button>
                  <button
                    onClick={() => removeMenu(item.id)}
                    className="ml-auto rounded-lg px-2 py-1 text-xs text-red-600"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-6 pb-24">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
              Bấm + Thêm menu hoặc chọn menu bên trái.
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                <h2 className="mb-4 text-base font-semibold">Menu chính</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Tên VI"
                    value={selected.labelVi}
                    onChange={(value) => patchItem(selected.id, { labelVi: value })}
                  />
                  <Field
                    label="Tên EN"
                    value={selected.labelEn}
                    onChange={(value) => patchItem(selected.id, { labelEn: value })}
                  />
                  <Field
                    label="Link"
                    value={selected.link}
                    onChange={(value) => patchItem(selected.id, { link: value })}
                    placeholder="/collections/backpacks"
                  />
                  <label>
                    <div className="mb-1 text-xs font-semibold text-neutral-500">
                      Kiểu menu
                    </div>
                    <select
                      value={selected.type}
                      onChange={(e) =>
                        patchItem(selected.id, {
                          type: e.target.value as "LINK" | "MEGA",
                          columns:
                            e.target.value === "MEGA" && !selected.columns.length
                              ? [blankColumn()]
                              : selected.columns,
                        })
                      }
                      className="h-11 w-full rounded-xl border px-3 text-sm"
                    >
                      <option value="LINK">Menu thường</option>
                      <option value="MEGA">Mega menu</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                  <div>
                    <div className="text-sm font-semibold">Hiển thị menu</div>
                    <div className="text-xs text-neutral-500">
                      Tắt là menu biến mất khỏi thanh trên cùng sau khi xuất bản.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) =>
                      patchItem(selected.id, { enabled: e.target.checked })
                    }
                    className="h-5 w-5"
                  />
                </label>
              </section>

              {selected.type === "MEGA" ? (
                <>
                  <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold">Các cột submenu</h2>
                        <p className="mt-1 text-xs text-neutral-500">
                          Ví dụ: cột Danh mục, cột Theo màu.
                        </p>
                      </div>
                      <button
                        onClick={addColumn}
                        className="rounded-xl border px-3 py-2 text-sm font-semibold"
                      >
                        + Thêm cột
                      </button>
                    </div>

                    <div className="space-y-4">
                      {selected.columns.map((column, columnIndex) => (
                        <div
                          key={column.id}
                          className="rounded-2xl border border-neutral-200 p-4"
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <strong className="text-sm">
                              Cột {columnIndex + 1}
                            </strong>
                            <button
                              onClick={() => moveColumn(column.id, -1)}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              ←
                            </button>
                            <button
                              onClick={() => moveColumn(column.id, 1)}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              →
                            </button>
                            <button
                              onClick={() => removeColumn(column.id)}
                              className="ml-auto text-xs text-red-600"
                            >
                              Xóa cột
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <Field
                              label="Tiêu đề cột VI"
                              value={column.titleVi}
                              onChange={(value) =>
                                patchColumn(column.id, { titleVi: value })
                              }
                            />
                            <Field
                              label="Tiêu đề cột EN"
                              value={column.titleEn}
                              onChange={(value) =>
                                patchColumn(column.id, { titleEn: value })
                              }
                            />
                          </div>

                          <div className="mt-4 space-y-2">
                            {column.links.map((link, linkIndex) => (
                              <div
                                key={link.id}
                                className="grid gap-2 rounded-xl bg-neutral-50 p-3 md:grid-cols-[40px_1fr_1fr_1.2fr_70px]"
                              >
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      moveLink(column.id, link.id, -1)
                                    }
                                    className="text-xs"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() =>
                                      moveLink(column.id, link.id, 1)
                                    }
                                    className="text-xs"
                                  >
                                    ↓
                                  </button>
                                </div>
                                <input
                                  value={link.labelVi}
                                  placeholder="Tên VI"
                                  onChange={(e) =>
                                    patchLink(column.id, link.id, {
                                      labelVi: e.target.value,
                                    })
                                  }
                                  className="h-10 rounded-lg border px-3 text-sm"
                                />
                                <input
                                  value={link.labelEn}
                                  placeholder="Tên EN"
                                  onChange={(e) =>
                                    patchLink(column.id, link.id, {
                                      labelEn: e.target.value,
                                    })
                                  }
                                  className="h-10 rounded-lg border px-3 text-sm"
                                />
                                <input
                                  value={link.link}
                                  placeholder="/collections/..."
                                  onChange={(e) =>
                                    patchLink(column.id, link.id, {
                                      link: e.target.value,
                                    })
                                  }
                                  className="h-10 rounded-lg border px-3 text-sm"
                                />
                                <button
                                  onClick={() =>
                                    removeLink(column.id, link.id)
                                  }
                                  className="text-xs text-red-600"
                                >
                                  Xóa
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => addLink(column.id)}
                            className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold"
                          >
                            + Thêm link
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 text-base font-semibold">
                      Ảnh trong mega menu
                    </h2>

                    <label className="mb-4 flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                      <div>
                        <div className="text-sm font-semibold">
                          Hiển thị ảnh quảng bá
                        </div>
                        <div className="text-xs text-neutral-500">
                          Ảnh nằm bên phải mega menu.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selected.promo.enabled}
                        onChange={(e) =>
                          patchItem(selected.id, {
                            promo: {
                              ...selected.promo,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="h-5 w-5"
                      />
                    </label>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <Field
                          label="Chữ trên ảnh VI"
                          value={selected.promo.titleVi}
                          onChange={(value) =>
                            patchItem(selected.id, {
                              promo: { ...selected.promo, titleVi: value },
                            })
                          }
                        />
                        <Field
                          label="Chữ trên ảnh EN"
                          value={selected.promo.titleEn}
                          onChange={(value) =>
                            patchItem(selected.id, {
                              promo: { ...selected.promo, titleEn: value },
                            })
                          }
                        />
                        <Field
                          label="Link ảnh"
                          value={selected.promo.link}
                          onChange={(value) =>
                            patchItem(selected.id, {
                              promo: { ...selected.promo, link: value },
                            })
                          }
                        />

                        <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-neutral-50 px-4 py-7">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => void uploadPromo(e.target.files?.[0])}
                          />
                          <div className="text-center">
                            <div className="text-sm font-semibold">
                              + Thay ảnh mega menu
                            </div>
                            <div className="mt-1 text-xs text-neutral-400">
                              Dùng hệ thống upload ảnh hiện tại.
                            </div>
                          </div>
                        </label>
                      </div>

                      <div className="overflow-hidden rounded-xl border bg-neutral-50">
                        {selected.promo.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selected.promo.imageUrl}
                            alt=""
                            className="aspect-[4/3] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center text-sm text-neutral-400">
                            Chưa có ảnh
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
                  Menu thường chỉ cần tên + link. Ví dụ thêm{" "}
                  <strong>Balo</strong> → link{" "}
                  <code>/collections/backpacks</code>.
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <div className="mb-1 text-xs font-semibold text-neutral-500">{label}</div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border px-3 text-sm"
      />
    </label>
  );
}
