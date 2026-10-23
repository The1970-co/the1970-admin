export type HomepageImage = { id:string; url:string; altVi?:string; altEn?:string; link?:string };
export type HomepageItem = {
  id:string; titleVi:string; titleEn:string; subtitleVi:string; subtitleEn:string;
  bodyVi:string; bodyEn:string; ctaVi:string; ctaEn:string; link:string;
  mediaMode:"single"|"slider"; autoplayMs:number; images:HomepageImage[];
};
export type HomepageBlock = {
  id:string; type:"HERO_SPLIT"|"CARD_ROW"|"STORY_WIDE"|"STORY_SPLIT"|"PRODUCT_GRID";
  enabled:boolean; titleVi:string; titleEn:string; layout:string; settings:Record<string,any>; items:HomepageItem[];
};
export type HomepageConfig={version:number;blocks:HomepageBlock[]};

function base(){
  return (process.env.CORE_API_URL||process.env.NEXT_PUBLIC_CORE_API_URL||"http://localhost:3001").replace(/\/$/,"");
}
export async function getHomepageConfig(market="VN"):Promise<HomepageConfig|null>{
  try{
    const res=await fetch(`${base()}/storefront/homepage?market=${encodeURIComponent(market)}`,{cache:"no-store"});
    if(!res.ok)return null;
    return await res.json() as HomepageConfig;
  }catch{return null;}
}
