// Shared collection tree: a menu link points to a collection, not to a product.
export type CollectionChoice = { slug: string; label: string; };
export type CollectionGroup = {
  id: string; label: string; parent: CollectionChoice | null;
  children: CollectionChoice[]; ignored: string[];
};
type MenuLink = { id?: string; enabled?: boolean; labelVi?: string; labelEn?: string; link?: string };
type MenuItem = MenuLink & { type?: string; columns?: { links?: MenuLink[] }[] };
export function categorySlug(link: unknown): string | null {
  if (typeof link !== "string") return null;
  // Query-based filters are not separate collection memberships.
  const match = /^\/collections\/([^/?#]+)\/?$/.exec(link.trim());
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]).toLowerCase();
    return /^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u.test(value) && !["all", "sale"].includes(value) ? value : null;
  } catch { return null; }
}
export function collectionGroups(config: unknown): CollectionGroup[] {
  const raw = config as {items?: MenuItem[]; publishedConfig?: {items?: MenuItem[]}} | null;
  const items = raw?.items ?? raw?.publishedConfig?.items;
  if (!Array.isArray(items)) return [];
  const groups: CollectionGroup[] = [];
  for (const [index, item] of items.entries()) {
    if (!item || item.enabled === false) continue;
    const slug = categorySlug(item.link);
    const label = item.labelVi || item.labelEn || slug || "Menu";
    const group: CollectionGroup = {id: item.id || `menu-${index}`, label,
      parent: slug ? {slug, label} : null, children: [], ignored: []};
    const seen = new Set(slug ? [slug] : []);
    if (item.type === "MEGA" && Array.isArray(item.columns)) {
      for (const column of item.columns) {
        if (!Array.isArray(column?.links)) continue;
        for (const child of column.links) {
          if (!child || child.enabled === false) continue;
          const sub = categorySlug(child.link);
          const name = child.labelVi || child.labelEn || sub || "Menu con";
          if (!sub || seen.has(sub)) {
            if (typeof child.link === "string" && child.link.startsWith("/collections/") && child.link !== "/collections/all" && child.link !== "/collections/sale") group.ignored.push(name);
            continue;
          }
          seen.add(sub);
          group.children.push({slug: sub, label: name});
        }
      }
    }
    if (group.parent || group.children.length) groups.push(group);
  }
  return groups;
}
export function includedCollectionSlugs(slug: string, config: unknown): Set<string> {
  const result = new Set([slug]);
  // Only the configured parent includes its direct child collections.
  for (const group of collectionGroups(config)) {
    if (group.parent?.slug === slug) for (const child of group.children) result.add(child.slug);
  }
  return result;
}
