export type DetailLayout = "ZARA" | "CLASSIC";
export type ProductDetailOptions = {
  layout: DetailLayout;
  maxWidth: number;
  heroWidth: number;
  gap: number;
  imageColumns: number;
  imageRatio: "NATURAL" | "PORTRAIT" | "SQUARE";
  titleSize: number;
  font: "SANS" | "SERIF";
  drawerWidth: number;
  relatedEnabled: boolean;
  relatedColumns: number;
  relatedLimit: number;
};
export type ProductDetailContent = {
  layout?: DetailLayout;
  material?: string;
  care?: string;
  origin?: string;
  measurements?: string;
  fit?: string;
  mixSlugs?: string;
};
export type ProductDetailConfig = {
  options: ProductDetailOptions;
  products: Record<string, ProductDetailContent>;
};
export const DEFAULT_DETAIL_OPTIONS: ProductDetailOptions = {
  layout: "ZARA", maxWidth: 1440, heroWidth: 58, gap: 40, imageColumns: 2,
  imageRatio: "NATURAL", titleSize: 22, font: "SANS", drawerWidth: 460,
  relatedEnabled: true, relatedColumns: 6, relatedLimit: 18,
};
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function integer(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}
export function normalizeDetailConfig(value: unknown): ProductDetailConfig {
  const root = object(value), o = object(root.options), d = DEFAULT_DETAIL_OPTIONS;
  const products: Record<string, ProductDetailContent> = Object.create(null);
  for (const [slug, raw] of Object.entries(object(root.products))) {
    if (!slug || slug === "__proto__" || slug === "constructor" || slug === "prototype") continue;
    const item = object(raw), result: ProductDetailContent = {};
    if (item.layout === "ZARA" || item.layout === "CLASSIC") result.layout = item.layout;
    for (const key of ["material", "care", "origin", "measurements", "fit", "mixSlugs"] as const) {
      if (typeof item[key] === "string") result[key] = item[key].slice(0, 20000);
    }
    products[slug] = result;
  }
  return { options: {
    layout: o.layout === "CLASSIC" ? "CLASSIC" : "ZARA",
    maxWidth: integer(o.maxWidth, 900, 1900, d.maxWidth),
    heroWidth: integer(o.heroWidth, 45, 72, d.heroWidth),
    gap: integer(o.gap, 0, 90, d.gap),
    imageColumns: integer(o.imageColumns, 1, 3, d.imageColumns),
    imageRatio: o.imageRatio === "SQUARE" || o.imageRatio === "PORTRAIT" ? o.imageRatio : "NATURAL",
    titleSize: integer(o.titleSize, 14, 48, d.titleSize),
    font: o.font === "SERIF" ? "SERIF" : "SANS",
    drawerWidth: integer(o.drawerWidth, 300, 720, d.drawerWidth),
    relatedEnabled: o.relatedEnabled !== false,
    relatedColumns: integer(o.relatedColumns, 2, 6, d.relatedColumns),
    relatedLimit: integer(o.relatedLimit, 4, 36, d.relatedLimit),
  }, products: { ...products } };
}
export function parseMeasurements(value: string) {
  const rows = value.split(/\r?\n/).filter(line => line.trim()).map(line => line.split(line.includes("\t") ? "\t" : "|").map(cell => cell.trim()));
  if (rows.length < 2 || rows[0].length < 2 || rows.some(row => row.length !== rows[0].length)) return null;
  return { headers: rows[0], rows: rows.slice(1) };
}
