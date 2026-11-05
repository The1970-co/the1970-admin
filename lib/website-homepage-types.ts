export type HomepageImage = {
  id: string;
  url: string;
  altVi?: string;
  altEn?: string;
  link?: string;
};

export type HomepageItem = {
  id: string;
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  bodyVi: string;
  bodyEn: string;
  ctaVi: string;
  ctaEn: string;
  link: string;
  mediaMode: "single" | "slider";
  autoplayMs: number;
  images: HomepageImage[];
  mediaType?: "image" | "video";
  videoUrl?: string;
  style?: Record<string, any>;
};

export type HomepageBlockType =
  | "FULL_BLEED_HERO"
  | "HERO_SPLIT"
  | "CARD_ROW"
  | "STORY_WIDE"
  | "STORY_SPLIT"
  | "PRODUCT_GRID";

export type HomepageBlock = {
  id: string;
  type: HomepageBlockType;
  enabled: boolean;
  titleVi: string;
  titleEn: string;
  layout: string;
  settings: Record<string, any>;
  items: HomepageItem[];
};

export type HomepageConfig = {
  version: number;
  blocks: HomepageBlock[];
};
