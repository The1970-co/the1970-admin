"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import {
  getHomepageAdmin, publishHomepage, saveHomepageDraft,
  type HomepageBlock, type HomepageBlockType, type HomepageConfig,
  type HomepageImage, type HomepageItem,
} from "@/lib/website-homepage-api";
import { uploadWebsiteImage } from "@/lib/website-products-api";
import { useAuth } from "@/components/admin/auth/AuthProvider";
import ProductDetailLayoutSettings from "./ProductDetailLayoutSettings";
import type { ProductDetailConfig } from "@/lib/product-detail-layout";
type HomepageWithDetail = HomepageConfig & { productDetailConfig?: ProductDetailConfig };


// Decorative Unicode letters are characters, not CSS fonts.
function plainCardText(value: string) {
  return value.replace(/[\u{1D400}-\u{1D7FF}\u2102\u210A-\u2113\u2115\u2119-\u211D\u2124\u2128\u212C-\u212D\u212F-\u2131\u2133-\u2134\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/gu, ch => {
    const normalized = ch.normalize("NFKC");
    return /^[A-Za-z0-9]$/.test(normalized) ? normalized : ch;
  });
}
function cardCaptionHeight(value: unknown): number {
  if (value == null || value === "") return 96;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(48, Math.min(200, Math.round(n))) : 96;
}
function safeCardFont(value: unknown): string {
  // Only a local font name, never CSS declarations, URL or markup.
  const name = String(value ?? "").trim().replace(/^["']|["']$/g, "");
  return /^[A-Za-z][A-Za-z0-9 ._-]{0,59}$/.test(name) ? name : "";
}

type CardTextKey = "titleVi" | "titleEn" | "subtitleVi" | "subtitleEn";
function cardStyle(item: HomepageItem) {
  return (item as HomepageItem & {style?: Record<string, any>}).style || {};
}
function pastedCardFont(html: string): string {
  if (!html) return "";
  // Inspect clipboard markup in an inert template; never insert it into the page.
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of Array.from(template.content.querySelectorAll<HTMLElement>("[style],font[face]"))) {
    if (!element.textContent?.trim()) continue;
    const value = element.style.fontFamily || element.getAttribute("face") || "";
    const first = safeCardFont(value.split(",")[0]);
    if (first) return first;
  }
  return "";
}
function cardFieldValue(item: HomepageItem, key: CardTextKey, isMini: boolean) {
  return isMini && cardStyle(item).pasteFontMode === "CMS" ? plainCardText(item[key] || "") : item[key] || "";
}

const TYPES: {value:HomepageBlockType;label:string}[] = [
  {value:"FULL_BLEED_HERO",label:"Hero tràn viền ảnh / video"},
  {value:"HERO_SPLIT",label:"Hero chia 2 cột"},
  {value:"CARD_ROW",label:"Hàng thẻ ảnh"},
  {value:"STORY_WIDE",label:"Bài ảnh lớn ngang"},
  {value:"STORY_SPLIT",label:"Hai bài ảnh song song"},
  {value:"PRODUCT_GRID",label:"Lưới sản phẩm"},
];

type SlidePlayback = "AUTO" | "MANUAL" | "OFF";
type SlideItem = HomepageItem & { slidePlayback?: SlidePlayback };

function slidePlaybackOf(item: HomepageItem | null | undefined): SlidePlayback {
  const mode = (item as SlideItem | null | undefined)?.slidePlayback;
  return mode === "MANUAL" || mode === "OFF" ? mode : "AUTO";
}

function slideDelayMs(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1500, Math.min(60000, Math.round(n))) : 5000;
}

const uid=(p:string)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const blankItem=():HomepageItem=>({
  id:uid("item"),titleVi:"",titleEn:"",subtitleVi:"",subtitleEn:"",
  bodyVi:"",bodyEn:"",ctaVi:"",ctaEn:"",link:"",mediaMode:"single",autoplayMs:5000,images:[],
  mediaType:"image",videoUrl:""
});
function blankBlock(type:HomepageBlockType):HomepageBlock{
  const count=
    type==="FULL_BLEED_HERO"?1:
    type==="HERO_SPLIT"?6:
    type==="CARD_ROW"?3:
    type==="STORY_SPLIT"?2:
    type==="PRODUCT_GRID"?0:1;

  const settings=
    type==="PRODUCT_GRID"
      ? {limit:8,onlyFeatured:false}
      : type==="FULL_BLEED_HERO"
        ? {heightVh:82,contentAlign:"LEFT",overlayOpacity:0.24}
        : {};

  return {
    id:uid("block"),type,enabled:true,
    titleVi:TYPES.find(x=>x.value===type)?.label||"Block mới",titleEn:"",
    layout:type.toLowerCase(),settings,
    items:Array.from({length:count},()=>blankItem())
  };
}

export default function WebsiteHomepagePageClient(){
  const { can } = useAuth();
  const canEdit = can("website.edit");
  const canDelete = can("website.delete");
  const canPublish = can("website.publish");
  const canUpload = can("website.image.upload");
  const [config,setConfig]=useState<HomepageWithDetail>({version:1,blocks:[]});
  const [selectedId,setSelectedId]=useState("");
  const [detailSettingsOpen,setDetailSettingsOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [previewOpen,setPreviewOpen]=useState(false);
  const [previewReady,setPreviewReady]=useState(false);
  const [selectedItemId,setSelectedItemId]=useState("");
  const previewFrameRef=useRef<HTMLIFrameElement|null>(null);

  const previewUrl=useMemo(()=>{
    if(typeof window==="undefined")return "";
    const configured=(process.env.NEXT_PUBLIC_STOREFRONT_URL||"").trim().replace(/\/$/,"");
    if(configured)return `${configured}/?cmsPreview=1`;
    const host=window.location.hostname;
    if(host==="localhost"||host==="127.0.0.1")return "http://localhost:3002/?cmsPreview=1";
    return "https://web.the1970.co/?cmsPreview=1";
  },[]);

  useEffect(()=>{
    function onMessage(event:MessageEvent){
      if(event.source!==previewFrameRef.current?.contentWindow)return;
      const data=event.data;
      if(!data||typeof data!=="object")return;

      if(data.type==="THE1970_HOMEPAGE_PREVIEW_READY"){
        setPreviewReady(true);
        return;
      }

      if(data.type==="THE1970_HOMEPAGE_PREVIEW_SELECT"){
        const blockId=String(data.blockId||"");
        const itemId=String(data.itemId||"");
        if(blockId)setSelectedId(blockId);
        setSelectedItemId(itemId);
        setPreviewOpen(false);

        window.setTimeout(()=>{
          const target=itemId
            ? document.getElementById(`homepage-item-${itemId}`)
            : document.getElementById(`homepage-block-${blockId}`);
          target?.scrollIntoView({behavior:"smooth",block:"start"});
        },120);
      }
    }

    window.addEventListener("message",onMessage);
    return()=>window.removeEventListener("message",onMessage);
  },[]);

  useEffect(()=>{
    if(!previewOpen||!previewReady)return;
    previewFrameRef.current?.contentWindow?.postMessage({
      type:"THE1970_HOMEPAGE_PREVIEW_CONFIG",
      config,
      selectedBlockId:selectedId,
      selectedItemId,
    },"*");
  },[config,previewOpen,previewReady,selectedId,selectedItemId]);

  useEffect(()=>{ void load(); },[]);
  async function load(){
    try{
      setLoading(true);setError("");
      const row=await getHomepageAdmin("VN");
      const next=(row?.draftConfig||row?.publishedConfig||{version:1,blocks:[]}) as HomepageWithDetail;
      setConfig(next);setSelectedId(next.blocks?.[0]?.id||"");
    }catch(e){setError(e instanceof Error?e.message:"Không tải được homepage.");}
    finally{setLoading(false);}
  }

  const selected=useMemo(()=>config.blocks.find(b=>b.id===selectedId)||null,[config.blocks,selectedId]);
  const setBlocks=(blocks:HomepageBlock[])=>setConfig(old=>({...old,blocks}));
  const patchBlock=(id:string,patch:Partial<HomepageBlock>)=>setBlocks(config.blocks.map(b=>b.id===id?{...b,...patch}:b));
  const patchItem=(blockId:string,itemId:string,patch:Partial<HomepageItem>)=>setConfig(old=>({
    ...old,blocks:old.blocks.map(b=>b.id===blockId?{...b,items:b.items.map(i=>i.id===itemId?{...i,...patch}:i)}:b)
  }));

  function pasteCardText(event: ClipboardEvent<HTMLInputElement>, blockId: string, item: HomepageItem, key: CardTextKey) {
    if (!canEdit) return;
    event.preventDefault();
    const input = event.currentTarget;
    const style = cardStyle(item);
    const locked = style.pasteFontMode === "CMS";
    const raw = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ");
    const insert = locked ? plainCardText(raw) : raw;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = input.value.slice(0, start) + insert + input.value.slice(end);
    const fonts = {...(style.pastedCardFonts || {})};
    const font = locked ? "" : pastedCardFont(event.clipboardData.getData("text/html"));
    // A single field uses a single family. A plain-text paste replaces the override
    // only when replacing the whole field; partial text keeps its existing family.
    if (font) fonts[key] = font;
    else if (locked || (start === 0 && end === input.value.length)) delete fonts[key];
    patchItem(blockId, item.id, {[key]:next, style:{...style,pastedCardFonts:fonts}} as Partial<HomepageItem>);
    requestAnimationFrame(()=>{if(document.activeElement===input)input.setSelectionRange(start+insert.length,start+insert.length);});
  }

  function applyMiniCaptionHeight(blockId: string, value: number) {
    if (!canEdit) return;
    const height = cardCaptionHeight(value);
    setConfig(old=>({...old,blocks:old.blocks.map(block=>block.id!==blockId?block:{...block,items:block.items.map((item,index)=>index>=2&&index<=5?{...item,style:{...cardStyle(item),captionHeightPx:height}}:item)})}));
  }

  function moveBlock(id:string,dir:-1|1){
    const i=config.blocks.findIndex(b=>b.id===id),to=i+dir;if(i<0||to<0||to>=config.blocks.length)return;
    const next=[...config.blocks];[next[i],next[to]]=[next[to],next[i]];setBlocks(next);
  }
  function addBlock(type:HomepageBlockType){const b=blankBlock(type);setBlocks([...config.blocks,b]);setSelectedId(b.id);}
  function duplicateBlock(b:HomepageBlock){
    const copy:HomepageBlock={...structuredClone(b),id:uid("block"),titleVi:`${b.titleVi} — bản sao`,
      items:b.items.map(i=>({...i,id:uid("item"),images:i.images.map(img=>({...img,id:uid("image")}))}))};
    setBlocks([...config.blocks,copy]);setSelectedId(copy.id);
  }
  function deleteBlock(id:string){
    if(!confirm("Xóa block này?"))return;
    const next=config.blocks.filter(b=>b.id!==id);setBlocks(next);if(selectedId===id)setSelectedId(next[0]?.id||"");
  }
  function addItem(blockId:string){const b=config.blocks.find(x=>x.id===blockId);if(b)patchBlock(blockId,{items:[...b.items,blankItem()]});}
  function removeItem(blockId:string,itemId:string){const b=config.blocks.find(x=>x.id===blockId);if(b)patchBlock(blockId,{items:b.items.filter(i=>i.id!==itemId)});}
  function moveItem(blockId:string,itemId:string,dir:-1|1){
    const b=config.blocks.find(x=>x.id===blockId);if(!b)return;
    const i=b.items.findIndex(x=>x.id===itemId),to=i+dir;if(i<0||to<0||to>=b.items.length)return;
    const items=[...b.items];[items[i],items[to]]=[items[to],items[i]];patchBlock(blockId,{items});
  }

  async function upload(blockId:string,item:HomepageItem,files:FileList|null){
    if(!files?.length)return;
    try{
      setSaving(true);setError("");
      const images:HomepageImage[]=[];
      for(const file of Array.from(files)){
        const url=await uploadWebsiteImage(file);
        images.push({id:uid("image"),url,altVi:item.titleVi,altEn:item.titleEn,link:item.link});
      }
      patchItem(blockId,item.id,{images:[...item.images,...images]});
    }catch(e){setError(e instanceof Error?e.message:"Upload ảnh thất bại.");}
    finally{setSaving(false);}
  }
  function moveImage(blockId:string,item:HomepageItem,imageId:string,dir:-1|1){
    const i=item.images.findIndex(x=>x.id===imageId),to=i+dir;if(i<0||to<0||to>=item.images.length)return;
    const images=[...item.images];[images[i],images[to]]=[images[to],images[i]];patchItem(blockId,item.id,{images});
  }
  function removeImage(blockId:string,item:HomepageItem,imageId:string){
    patchItem(blockId,item.id,{images:item.images.filter(x=>x.id!==imageId)});
  }

  function showNotice(message:string){
    setNotice(message);
    window.setTimeout(()=>{
      setNotice(current=>current===message?"":current);
    },2600);
  }

  async function save(){
    try{
      setSaving(true);
      setError("");
      await saveHomepageDraft(config,"VN");
      showNotice("Đã lưu nháp homepage");
    }
    catch(e){setError(e instanceof Error?e.message:"Không lưu được.");}
    finally{setSaving(false);}
  }

  async function publish(){
    try{
      setPublishing(true);
      setError("");
      await saveHomepageDraft(config,"VN");
      await publishHomepage("VN");
      showNotice("Đã xuất bản homepage");
    }catch(e){setError(e instanceof Error?e.message:"Không xuất bản được.");}
    finally{setPublishing(false);}
  }

  if(loading)return <div className="p-8 text-sm text-neutral-500">Đang tải...</div>;

  return <div className="min-h-screen bg-neutral-100">
    {notice?(
      <div className="fixed right-6 top-6 z-[100] w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,.16)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
            ✓
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-neutral-900">{notice}</div>
            <div className="mt-1 text-xs leading-5 text-neutral-500">
              Thay đổi đã được ghi nhận trên hệ thống.
            </div>
          </div>
          <button
            type="button"
            onClick={()=>setNotice("")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-full origin-left animate-[homepageNotice_2.6s_linear_forwards] bg-black" />
        </div>
        <style jsx>{`
          @keyframes homepageNotice {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `}</style>
      </div>
    ):null}

    {previewOpen?(
      <div className="fixed inset-0 z-[90] bg-black/55 p-4 md:p-6">
        <div className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-[0_28px_90px_rgba(0,0,0,.35)]">
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <div>
              <div className="text-sm font-semibold">Xem trước trực tiếp homepage</div>
              <div className="text-xs text-neutral-500">Bấm đúng vùng trên website để nhảy về block / thẻ cần sửa. Thay đổi hiện tại chưa cần lưu.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${previewReady?"bg-emerald-50 text-emerald-700":"bg-neutral-100 text-neutral-500"}`}>
                {previewReady?"LIVE":"ĐANG KẾT NỐI"}
              </span>
              <button
                type="button"
                onClick={()=>setPreviewOpen(false)}
                className="rounded-xl border px-3 py-2 text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-neutral-200 p-3">
            <iframe
              ref={previewFrameRef}
              src={previewUrl}
              title="Homepage visual preview"
              className="h-full w-full rounded-xl border bg-white"
              onLoad={()=>{
                setPreviewReady(true);
                window.setTimeout(()=>{
                  previewFrameRef.current?.contentWindow?.postMessage({
                    type:"THE1970_HOMEPAGE_PREVIEW_CONFIG",
                    config,
                    selectedBlockId:selectedId,
                    selectedItemId,
                  },"*");
                },50);
              }}
            />
          </div>
        </div>
      </div>
    ):null}

    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-6 py-4">
      <div><div className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">Website / Trang chủ</div><h1 className="mt-1 text-xl font-semibold">Bố cục homepage</h1></div>
      <div className="flex gap-2">
        <button type="button" onClick={()=>setDetailSettingsOpen(v=>!v)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">{detailSettingsOpen?"Quay lại homepage":"Chi tiết sản phẩm"}</button>
        <button
          type="button"
          onClick={()=>{setPreviewReady(false);setPreviewOpen(true);}}
          className="rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-semibold text-black"
        >
          Xem trước trực tiếp
        </button>
        {canEdit ? <button onClick={()=>void save()} disabled={saving} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">{saving?"Đang lưu...":"Lưu nháp"}</button> : null}
        {canPublish ? <button onClick={()=>void publish()} disabled={saving||publishing} className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">{publishing?"Đang xuất bản...":"Xuất bản"}</button> : null}
      </div>
    </div>

    {error?<div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>:null}

    {detailSettingsOpen?<div className="p-6"><ProductDetailLayoutSettings value={config.productDetailConfig} disabled={!canEdit||saving||publishing} onChange={value=>setConfig(old=>({...old,productDetailConfig:value}))}/></div>:null}
    <div hidden={detailSettingsOpen} className="grid min-h-[calc(100vh-78px)] grid-cols-[330px_minmax(0,1fr)]" style={detailSettingsOpen?{display:"none"}:undefined}>
      <aside className="border-r bg-white p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Các block</div>
        <div className="space-y-2">
          {config.blocks.map((b,index)=><div key={b.id} className={`rounded-2xl border p-3 ${selectedId===b.id?"border-black bg-neutral-50":"border-neutral-200"}`}>
            <button className="w-full text-left" onClick={()=>{setSelectedId(b.id);setSelectedItemId("");}}>
              <div className="flex items-center justify-between gap-2">
                <div><div className="text-sm font-semibold">{index+1}. {b.titleVi||b.type}</div><div className="mt-1 text-xs text-neutral-400">{b.type}</div></div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${b.enabled?"bg-emerald-50 text-emerald-700":"bg-neutral-100 text-neutral-500"}`}>{b.enabled?"BẬT":"TẮT"}</span>
              </div>
            </button>
            <div className="mt-3 flex gap-1">
              {canEdit ? <button onClick={()=>moveBlock(b.id,-1)} className="rounded-lg border px-2 py-1 text-xs">↑</button> : null}
              {canEdit ? <button onClick={()=>moveBlock(b.id,1)} className="rounded-lg border px-2 py-1 text-xs">↓</button> : null}
              {canEdit ? <button onClick={()=>duplicateBlock(b)} className="rounded-lg border px-2 py-1 text-xs">Nhân bản</button> : null}
              {canDelete ? <button onClick={()=>deleteBlock(b.id)} className="ml-auto rounded-lg px-2 py-1 text-xs text-red-600">Xóa</button> : null}
            </div>
          </div>)}
        </div>
        {canEdit ? <div className="mt-5 border-t pt-4">
          <div className="mb-2 text-xs font-semibold text-neutral-500">Thêm block</div>
          <div className="grid gap-2">{TYPES.map(t=><button key={t.value} onClick={()=>addBlock(t.value)} className="rounded-xl border px-3 py-2 text-left text-sm">+ {t.label}</button>)}</div>
        </div> : null}
      </aside>

      <main className="p-6">
        {!selected?<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-neutral-500">Chọn một block để sửa.</div>:
        <div className="space-y-5">
          <section id={`homepage-block-${selected.id}`} className="scroll-mt-28 rounded-2xl border bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tên block trong admin" value={selected.titleVi} onChange={v=>patchBlock(selected.id,{titleVi:v})}/>
              <label><div className="mb-1 text-xs font-semibold text-neutral-500">Loại block</div>
                <select disabled={!canEdit} value={selected.type} onChange={e=>patchBlock(selected.id,{type:e.target.value as HomepageBlockType})} className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100">
                  {TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 p-4">
              <div><div className="text-sm font-semibold">Hiển thị block</div><div className="text-xs text-neutral-500">Tắt là block biến mất sau khi xuất bản.</div></div>
              <input disabled={!canEdit} type="checkbox" checked={selected.enabled} onChange={e=>patchBlock(selected.id,{enabled:e.target.checked})} className="h-5 w-5"/>
            </label>

            <div className="mt-4 rounded-xl border bg-neutral-50 p-4">
              <div className="mb-4">
                <div className="text-sm font-semibold">Style & khoảng cách của block</div>
                <div className="mt-1 text-xs text-neutral-500">
                  Điều chỉnh đủ 4 phía, bo góc, nền, viền, shadow và hiệu ứng mà không cần sửa CSS.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Margin trên (px)" value={String(selected.settings?.marginTopPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,marginTopPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
                <Field label="Margin phải (px)" value={String(selected.settings?.marginRightPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,marginRightPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
                <Field label="Margin dưới (px)" value={String(selected.settings?.marginBottomPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,marginBottomPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
                <Field label="Margin trái (px)" value={String(selected.settings?.marginLeftPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,marginLeftPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Padding trên (px)" value={String(selected.settings?.paddingTopPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,paddingTopPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
                <Field label="Padding phải (px)" value={String(selected.settings?.paddingRightPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,paddingRightPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
                <Field label="Padding dưới (px)" value={String(selected.settings?.paddingBottomPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,paddingBottomPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
                <Field label="Padding trái (px)" value={String(selected.settings?.paddingLeftPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,paddingLeftPx:Math.max(0,Math.min(240,Number(v||0)))}})}/>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Bo góc (%)" value={String(selected.settings?.radiusPct ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,radiusPct:Math.max(0,Math.min(50,Number(v||0)))}})}/>
                <Field label="Độ mờ (%)" value={String(selected.settings?.opacityPct ?? 100)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,opacityPct:Math.max(0,Math.min(100,Number(v||100)))}})}/>
                <Field label="Viền (px)" value={String(selected.settings?.borderWidthPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,borderWidthPx:Math.max(0,Math.min(12,Number(v||0)))}})}/>
                <Field label="Max width (px, 0 = full)" value={String(selected.settings?.maxWidthPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,maxWidthPx:Math.max(0,Math.min(2400,Number(v||0)))}})}/>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Màu nền" value={String(selected.settings?.backgroundColor ?? "")} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,backgroundColor:v}})} placeholder="#f5efe8"/>
                <Field label="Màu viền" value={String(selected.settings?.borderColor ?? "")} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,borderColor:v}})} placeholder="#d9d2c8"/>
                <label><div className="mb-1 text-xs font-semibold text-neutral-500">Shadow</div>
                  <select disabled={!canEdit} value={selected.settings?.shadow||"NONE"} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,shadow:e.target.value}})} className="h-11 w-full rounded-xl border px-3 text-sm">
                    <option value="NONE">Không</option><option value="SOFT">Nhẹ</option><option value="MEDIUM">Vừa</option><option value="STRONG">Đậm</option>
                  </select>
                </label>
                <label><div className="mb-1 text-xs font-semibold text-neutral-500">Overflow</div>
                  <select disabled={!canEdit} value={selected.settings?.overflow||"CLIP"} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,overflow:e.target.value}})} className="h-11 w-full rounded-xl border px-3 text-sm">
                    <option value="CLIP">Ẩn phần tràn</option><option value="VISIBLE">Cho phép tràn</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label><div className="mb-1 text-xs font-semibold text-neutral-500">Căn block khi có max-width</div>
                  <select disabled={!canEdit} value={selected.settings?.containerAlign||"CENTER"} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,containerAlign:e.target.value}})} className="h-11 w-full rounded-xl border px-3 text-sm">
                    <option value="LEFT">Trái</option><option value="CENTER">Giữa</option><option value="RIGHT">Phải</option>
                  </select>
                </label>
                <label><div className="mb-1 text-xs font-semibold text-neutral-500">Hiệu ứng khi cuộn tới</div>
                  <select disabled={!canEdit} value={selected.settings?.enterAnimation||"NONE"} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,enterAnimation:e.target.value}})} className="h-11 w-full rounded-xl border px-3 text-sm">
                    <option value="NONE">Không</option><option value="FADE">Fade</option><option value="FADE_UP">Fade + đi lên</option><option value="ZOOM_IN">Zoom in</option>
                  </select>
                </label>
                <label><div className="mb-1 text-xs font-semibold text-neutral-500">Hover block</div>
                  <select disabled={!canEdit} value={selected.settings?.hoverEffect||"NONE"} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,hoverEffect:e.target.value}})} className="h-11 w-full rounded-xl border px-3 text-sm">
                    <option value="NONE">Không</option><option value="LIFT">Nhấc nhẹ</option><option value="ZOOM">Zoom nhẹ</option><option value="BRIGHTEN">Sáng hơn</option>
                  </select>
                </label>
              </div>
            </div>

            {selected.type==="FULL_BLEED_HERO"?<div className="mt-4 rounded-xl border p-4">
              <div className="mb-3 text-sm font-semibold">Cài đặt Hero tràn viền</div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="Chiều cao hero (vh)"
                  value={String(selected.settings?.heightVh ?? 82)}
                  onChange={v=>patchBlock(selected.id,{settings:{
                    ...selected.settings,
                    heightVh:Math.max(45,Math.min(100,Number(v||82))),
                  }})}
                />
                <label>
                  <div className="mb-1 text-xs font-semibold text-neutral-500">Vị trí nội dung</div>
                  <select
                    disabled={!canEdit}
                    value={selected.settings?.contentAlign || "LEFT"}
                    onChange={e=>patchBlock(selected.id,{settings:{
                      ...selected.settings,
                      contentAlign:e.target.value,
                    }})}
                    className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100"
                  >
                    <option value="LEFT">Trái</option>
                    <option value="CENTER">Giữa</option>
                    <option value="RIGHT">Phải</option>
                  </select>
                </label>
                <Field
                  label="Độ tối overlay (%)"
                  value={String(Math.round(Number(selected.settings?.overlayOpacity ?? 0.24)*100))}
                  onChange={v=>patchBlock(selected.id,{settings:{
                    ...selected.settings,
                    overlayOpacity:Math.max(0,Math.min(.7,Number(v||0)/100)),
                  }})}
                />
              </div>
            </div>:null}

            {selected.type==="HERO_SPLIT"?<div className="mt-4 rounded-xl border p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold">Bố cục Hero chia 2 cột</div>
                <div className="mt-1 text-xs text-neutral-500">Chỉnh tỷ lệ cột và khoảng cách riêng của 4 thẻ bên phải.</div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Cột trái (%)" value={String(selected.settings?.leftColumnPct ?? 57)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,leftColumnPct:Math.max(35,Math.min(75,Number(v||57)))}})}/>
                <Field label="Gap 2 cột (px)" value={String(selected.settings?.columnGapPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,columnGapPx:Math.max(0,Math.min(120,Number(v||0)))}})}/>
                <Field label="Gap 4 thẻ (px)" value={String(selected.settings?.cardGapPx ?? 0)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,cardGapPx:Math.max(0,Math.min(80,Number(v||0)))}})}/>
                <Field label="Intro phải cao (%)" value={String(selected.settings?.introHeightPct ?? 22)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,introHeightPct:Math.max(10,Math.min(55,Number(v||22)))}})}/>
              </div>
            </div>:null}

            {selected.type==="PRODUCT_GRID"?<div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Số sản phẩm" value={String(selected.settings?.limit||8)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,limit:Number(v||8)}})}/>
              <label className="flex items-center gap-3 rounded-xl border p-3"><input disabled={!canEdit} type="checkbox" checked={selected.settings?.onlyFeatured===true} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,onlyFeatured:e.target.checked}})}/><span className="text-sm">Chỉ sản phẩm nổi bật</span></label>
            </div>:null}
          </section>

          {selected.type!=="PRODUCT_GRID"?<>
            {selected.items.map((item,index)=><section
              id={`homepage-item-${item.id}`}
              key={item.id}
              onClick={()=>setSelectedItemId(item.id)}
              className={`scroll-mt-28 rounded-2xl border bg-white p-5 transition ${selectedItemId===item.id?"border-black ring-2 ring-black/10":"border-neutral-200"}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div><div className="text-sm font-semibold">Thẻ {index+1}</div><div className="text-xs text-neutral-400">{item.images.length} ảnh{(selected.type==="HERO_SPLIT"||selected.type==="FULL_BLEED_HERO")&&item.images.length>1?` · ${slidePlaybackOf(item)==="AUTO"?"Tự động":slidePlaybackOf(item)==="MANUAL"?"Thủ công":"Tắt slide"}`:""}</div></div>
                <div className="flex gap-1">
                  {canEdit ? <><button onClick={()=>moveItem(selected.id,item.id,-1)} className="rounded border px-2 py-1 text-xs">↑</button><button onClick={()=>moveItem(selected.id,item.id,1)} className="rounded border px-2 py-1 text-xs">↓</button></> : null}
                  {canDelete ? <button onClick={()=>removeItem(selected.id,item.id)} className="rounded px-2 py-1 text-xs text-red-600">Xóa thẻ</button> : null}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Field label="Tiêu đề VI" value={cardFieldValue(item,"titleVi",selected.type==="HERO_SPLIT"&&index>=2&&index<=5)} onChange={v=>patchItem(selected.id,item.id,{titleVi:(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)&&cardStyle(item).pasteFontMode==="CMS"?plainCardText(v):v})} onPaste={(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)?e=>pasteCardText(e,selected.id,item,"titleVi"):undefined} disabled={!canEdit}/>
                  <Field label="Tiêu đề EN" value={cardFieldValue(item,"titleEn",selected.type==="HERO_SPLIT"&&index>=2&&index<=5)} onChange={v=>patchItem(selected.id,item.id,{titleEn:(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)&&cardStyle(item).pasteFontMode==="CMS"?plainCardText(v):v})} onPaste={(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)?e=>pasteCardText(e,selected.id,item,"titleEn"):undefined} disabled={!canEdit}/>
                  <Field label="Dòng nhỏ VI" value={cardFieldValue(item,"subtitleVi",selected.type==="HERO_SPLIT"&&index>=2&&index<=5)} onChange={v=>patchItem(selected.id,item.id,{subtitleVi:(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)&&cardStyle(item).pasteFontMode==="CMS"?plainCardText(v):v})} onPaste={(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)?e=>pasteCardText(e,selected.id,item,"subtitleVi"):undefined} disabled={!canEdit}/>
                  <Field label="Dòng nhỏ EN" value={cardFieldValue(item,"subtitleEn",selected.type==="HERO_SPLIT"&&index>=2&&index<=5)} onChange={v=>patchItem(selected.id,item.id,{subtitleEn:(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)&&cardStyle(item).pasteFontMode==="CMS"?plainCardText(v):v})} onPaste={(selected.type==="HERO_SPLIT"&&index>=2&&index<=5)?e=>pasteCardText(e,selected.id,item,"subtitleEn"):undefined} disabled={!canEdit}/>
                  <Area label="Nội dung VI" value={item.bodyVi} onChange={v=>patchItem(selected.id,item.id,{bodyVi:v})}/>
                  <Area label="Nội dung EN" value={item.bodyEn} onChange={v=>patchItem(selected.id,item.id,{bodyEn:v})}/>
                  <div className="grid gap-3 md:grid-cols-2"><Field label="Nút VI" value={item.ctaVi} onChange={v=>patchItem(selected.id,item.id,{ctaVi:v})}/><Field label="Nút EN" value={item.ctaEn} onChange={v=>patchItem(selected.id,item.id,{ctaEn:v})}/></div>
                  <Field label="Link khi bấm" value={item.link} onChange={v=>patchItem(selected.id,item.id,{link:v})} placeholder="/collections/all"/>

                  <details className="rounded-xl border bg-neutral-50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Style riêng của thẻ này</summary>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <Field label="Margin trên" value={String((item as any).style?.marginTopPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),marginTopPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                      <Field label="Margin phải" value={String((item as any).style?.marginRightPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),marginRightPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                      <Field label="Margin dưới" value={String((item as any).style?.marginBottomPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),marginBottomPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                      <Field label="Margin trái" value={String((item as any).style?.marginLeftPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),marginLeftPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <Field label="Padding trên" value={String((item as any).style?.paddingTopPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),paddingTopPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                      <Field label="Padding phải" value={String((item as any).style?.paddingRightPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),paddingRightPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                      <Field label="Padding dưới" value={String((item as any).style?.paddingBottomPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),paddingBottomPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                      <Field label="Padding trái" value={String((item as any).style?.paddingLeftPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),paddingLeftPx:Math.max(0,Math.min(160,Number(v||0)))}} as any)}/>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <Field label="Bo góc (%)" value={String((item as any).style?.radiusPct ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),radiusPct:Math.max(0,Math.min(50,Number(v||0)))}} as any)}/>
                      <Field label="Opacity (%)" value={String((item as any).style?.opacityPct ?? 100)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),opacityPct:Math.max(0,Math.min(100,Number(v||100)))}} as any)}/>
                      <Field label="Viền (px)" value={String((item as any).style?.borderWidthPx ?? 0)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),borderWidthPx:Math.max(0,Math.min(8,Number(v||0)))}} as any)}/>
                      <Field label="Màu nền" value={String((item as any).style?.backgroundColor ?? "")} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),backgroundColor:v}} as any)} placeholder="#ffffff"/>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <Field label="Màu viền" value={String((item as any).style?.borderColor ?? "")} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),borderColor:v}} as any)} placeholder="#ddd"/>
                      <label><div className="mb-1 text-xs font-semibold text-neutral-500">Shadow</div>
                        <select value={(item as any).style?.shadow||"NONE"} onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),shadow:e.target.value}} as any)} className="h-11 w-full rounded-xl border px-3 text-sm">
                          <option value="NONE">Không</option><option value="SOFT">Nhẹ</option><option value="MEDIUM">Vừa</option><option value="STRONG">Đậm</option>
                        </select>
                      </label>
                      <label><div className="mb-1 text-xs font-semibold text-neutral-500">Ảnh hiển thị</div>
                        <select value={(item as any).style?.imageFit||"COVER"} onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),imageFit:e.target.value}} as any)} className="h-11 w-full rounded-xl border px-3 text-sm">
                          <option value="COVER">Cover</option><option value="CONTAIN">Contain</option>
                        </select>
                      </label>
                      <label><div className="mb-1 text-xs font-semibold text-neutral-500">Vị trí ảnh</div>
                        <select value={(item as any).style?.imagePosition||"CENTER"} onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),imagePosition:e.target.value}} as any)} className="h-11 w-full rounded-xl border px-3 text-sm">
                          <option value="CENTER">Giữa</option><option value="TOP">Trên</option><option value="BOTTOM">Dưới</option><option value="LEFT">Trái</option><option value="RIGHT">Phải</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label><div className="mb-1 text-xs font-semibold text-neutral-500">Hiệu ứng vào màn hình</div>
                        <select value={(item as any).style?.enterAnimation||"NONE"} onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),enterAnimation:e.target.value}} as any)} className="h-11 w-full rounded-xl border px-3 text-sm">
                          <option value="NONE">Không</option><option value="FADE">Fade</option><option value="FADE_UP">Fade + đi lên</option><option value="ZOOM_IN">Zoom in</option>
                        </select>
                      </label>
                      <label><div className="mb-1 text-xs font-semibold text-neutral-500">Hover</div>
                        <select value={(item as any).style?.hoverEffect||"NONE"} onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),hoverEffect:e.target.value}} as any)} className="h-11 w-full rounded-xl border px-3 text-sm">
                          <option value="NONE">Không</option><option value="LIFT">Nhấc nhẹ</option><option value="ZOOM">Zoom ảnh</option><option value="BRIGHTEN">Sáng hơn</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <div className="mb-3 text-sm font-semibold">Chữ & vị trí nội dung</div>
                      {selected.type==="HERO_SPLIT" && index>=2 && index<=5 ? (
                        <div className="mb-4 space-y-3 rounded-xl border bg-white p-3">
                          <label className="block">
                            <div className="mb-1 text-xs font-semibold text-neutral-500">Font khi dán chữ</div>
                            <select disabled={!canEdit} value={cardStyle(item).pasteFontMode==="CMS"?"CMS":"KEEP"}
                              onChange={e=>patchItem(selected.id,item.id,{style:{...cardStyle(item),pasteFontMode:e.target.value}} as Partial<HomepageItem>)}
                              className="h-11 w-full rounded-xl border px-3 text-sm disabled:opacity-50">
                              <option value="KEEP">Cho phép font dán đè font cài đặt</option>
                              <option value="CMS">Khóa font theo cài đặt của thẻ</option>
                            </select>
                          </label>
                          <p className="text-xs leading-5 text-neutral-500">{cardStyle(item).pasteFontMode==="CMS"?"Chữ Unicode cách điệu được hiển thị thành chữ thường (không đổi hoa/thường), dùng font bên dưới. Font HTML từ clipboard bị bỏ qua.":"Giữ ký tự Unicode cách điệu và font nguồn nếu clipboard có thông tin font. Font nguồn cần có trên thiết bị khách; không tự tải font bên ngoài."}</p>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[160px] flex-1">
                              <CaptionHeightField key={item.id} value={cardCaptionHeight(cardStyle(item).captionHeightPx)} disabled={!canEdit}
                                onChange={height=>patchItem(selected.id,item.id,{style:{...cardStyle(item),captionHeightPx:height}} as Partial<HomepageItem>)}/>
                            </div>
                            <button type="button" disabled={!canEdit} onClick={()=>applyMiniCaptionHeight(selected.id,cardCaptionHeight(cardStyle(item).captionHeightPx))}
                              className="h-11 rounded-xl border border-black px-3 text-xs font-semibold disabled:opacity-40">Áp dụng cho cả 4 thẻ</button>
                          </div>
                          <p className="text-xs leading-5 text-neutral-500">Mặc định 96 px. Cùng chiều cao sẽ giúp đường mép ảnh của 4 thẻ cân nhau. Nếu chữ dài, tăng chiều cao nền; chữ vượt khung có thể cuộn đọc.</p>
                        </div>
                      ) : null}


                      <div className="grid gap-3 md:grid-cols-3">
                        <label>
                          <div className="mb-1 text-xs font-semibold text-neutral-500">Vị trí khối chữ</div>
                          <select
                            disabled={!canEdit}
                            value={(item as any).style?.textPositionY || "BOTTOM"}
                            onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),textPositionY:e.target.value}} as any)}
                            className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100"
                          >
                            <option value="TOP">Trên</option>
                            <option value="CENTER">Giữa</option>
                            <option value="BOTTOM">Dưới</option>
                          </select>
                        </label>

                        <label>
                          <div className="mb-1 text-xs font-semibold text-neutral-500">Căn chữ</div>
                          <select
                            disabled={!canEdit}
                            value={(item as any).style?.textAlign || "LEFT"}
                            onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),textAlign:e.target.value}} as any)}
                            className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100"
                          >
                            <option value="LEFT">Trái</option>
                            <option value="CENTER">Giữa</option>
                            <option value="RIGHT">Phải</option>
                          </select>
                        </label>

                        <label>
                          <div className="mb-1 text-xs font-semibold text-neutral-500">Font tiêu đề</div>
                          <select
                            disabled={!canEdit}
                            value={(item as any).style?.titleFont || "SANS"}
                            onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),titleFont:e.target.value}} as any)}
                            className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100"
                          >
                            <option value="SANS">Sans</option>
                            <option value="SERIF">Serif</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <label>
                          <div className="mb-1 text-xs font-semibold text-neutral-500">Font dòng nhỏ</div>
                          <select
                            disabled={!canEdit}
                            value={(item as any).style?.subtitleFont || "SANS"}
                            onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),subtitleFont:e.target.value}} as any)}
                            className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100"
                          >
                            <option value="SANS">Sans</option>
                            <option value="SERIF">Serif</option>
                          </select>
                        </label>

                        <label>
                          <div className="mb-1 text-xs font-semibold text-neutral-500">Font nội dung</div>
                          <select
                            disabled={!canEdit}
                            value={(item as any).style?.bodyFont || "SANS"}
                            onChange={e=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),bodyFont:e.target.value}} as any)}
                            className="h-11 w-full rounded-xl border px-3 text-sm disabled:bg-neutral-100"
                          >
                            <option value="SANS">Sans</option>
                            <option value="SERIF">Serif</option>
                          </select>
                        </label>

                        <Field label="Cỡ dòng nhỏ (px)" value={String((item as any).style?.subtitleFontSizePx ?? (selected.type==="HERO_SPLIT"&&index>=2&&index<=5?10:11))} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),subtitleFontSizePx:Math.max(8,Math.min(40,Number(v||11)))}} as any)}/>
                        <Field label="Cỡ tiêu đề (px)" value={String((item as any).style?.titleFontSizePx ?? (selected.type==="HERO_SPLIT"&&index>=2&&index<=5?20:index===0?56:24))} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),titleFontSizePx:Math.max(12,Math.min(120,Number(v||24)))}} as any)}/>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <Field label="Cỡ nội dung (px)" value={String((item as any).style?.bodyFontSizePx ?? 15)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),bodyFontSizePx:Math.max(10,Math.min(60,Number(v||15)))}} as any)}/>
                        <Field label="Độ đậm tiêu đề" value={String((item as any).style?.titleFontWeight ?? (selected.type==="HERO_SPLIT"&&index>=2&&index<=5?300:600))} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),titleFontWeight:Math.max(100,Math.min(900,Number(v||600)))}} as any)}/>
                        <Field label="Line-height tiêu đề" value={String((item as any).style?.titleLineHeight ?? (selected.type==="HERO_SPLIT"&&index>=2&&index<=5?1.05:1.08))} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),titleLineHeight:Math.max(.8,Math.min(2,Number(v||1.08)))}} as any)}/>
                        <Field label="Độ rộng khối chữ (px)" value={String((item as any).style?.textMaxWidthPx ?? 500)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),textMaxWidthPx:Math.max(120,Math.min(1400,Number(v||500)))}} as any)}/>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="Lề ngang chữ (px)" value={String((item as any).style?.textInsetXPx ?? 28)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),textInsetXPx:Math.max(0,Math.min(240,Number(v||28)))}} as any)}/>
                        <Field label="Lề dọc chữ (px)" value={String((item as any).style?.textInsetYPx ?? 28)} onChange={v=>patchItem(selected.id,item.id,{style:{...((item as any).style||{}),textInsetYPx:Math.max(0,Math.min(240,Number(v||28)))}} as any)}/>
                      </div>
                    </div>
                  </details>

                  {selected.type==="FULL_BLEED_HERO"?<>
                    <label>
                      <div className="mb-1 text-xs font-semibold text-neutral-500">Media chính</div>
                      <select
                        disabled={!canEdit}
                        value={item.mediaType||"image"}
                        onChange={e=>patchItem(selected.id,item.id,{mediaType:e.target.value as "image"|"video"})}
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                      >
                        <option value="image">Ảnh / slideshow</option>
                        <option value="video">Video</option>
                      </select>
                    </label>
                    {(item.mediaType||"image")==="video"?(
                      <Field
                        label="URL video MP4 / WebM"
                        value={item.videoUrl||""}
                        onChange={v=>patchItem(selected.id,item.id,{videoUrl:v})}
                        placeholder="https://.../hero.mp4"
                      />
                    ):null}
                  </>:null}

                  {(selected.type!=="FULL_BLEED_HERO" || (item.mediaType||"image")==="image")?(
                    selected.type==="HERO_SPLIT" || selected.type==="FULL_BLEED_HERO" ? (
                      <div className="rounded-xl border bg-neutral-50 p-3">
                        <div className="mb-3 text-sm font-semibold">Chuyển ảnh slideshow</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label>
                            <div className="mb-1 text-xs font-semibold text-neutral-500">Chế độ chuyển ảnh</div>
                            <select disabled={!canEdit} value={slidePlaybackOf(item)}
                              onChange={e=>{
                                const mode=e.target.value as SlidePlayback;
                                const patch: Partial<SlideItem>={slidePlayback:mode,mediaMode:mode==="OFF"?"single":"slider"};
                                patchItem(selected.id,item.id,patch);
                              }} className="h-11 w-full rounded-xl border bg-white px-3 text-sm disabled:opacity-60">
                              <option value="AUTO">Tự động + bấm thủ công</option>
                              <option value="MANUAL">Chỉ bấm thủ công</option>
                              <option value="OFF">Tắt slideshow — chỉ ảnh đầu</option>
                            </select>
                          </label>
                          <SlideDelayField key={item.id} value={slideDelayMs(item.autoplayMs)}
                            disabled={!canEdit||slidePlaybackOf(item)!=="AUTO"}
                            onChange={ms=>patchItem(selected.id,item.id,{autoplayMs:ms})}/>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-neutral-500">
                          {slidePlaybackOf(item)==="AUTO"?"Ảnh tự chuyển theo thời gian; vẫn có thể bấm ảnh hoặc dấu chấm.":slidePlaybackOf(item)==="MANUAL"?"Không tự chuyển. Bấm ảnh hoặc dấu chấm để đổi ảnh.":"Chỉ hiện ảnh đầu tiên, không tự chuyển và không hiện dấu chấm. Các ảnh khác vẫn được lưu."}
                          {item.images.length<2?" Thêm ít nhất 2 ảnh để chạy slideshow.":""}
                        </div>
                      </div>
                    ) : <div className="grid gap-3 md:grid-cols-2">
                    <label><div className="mb-1 text-xs font-semibold text-neutral-500">Kiểu ảnh</div>
                      <select disabled={!canEdit} value={item.mediaMode} onChange={e=>patchItem(selected.id,item.id,{mediaMode:e.target.value as "single"|"slider"})} className="h-11 w-full rounded-xl border px-3 text-sm">
                        <option value="single">1 ảnh</option><option value="slider">Slider nhiều ảnh</option>
                      </select>
                    </label>
                    <Field label="Đổi ảnh mỗi (ms)" value={String(item.autoplayMs)} onChange={v=>patchItem(selected.id,item.id,{autoplayMs:Math.max(1500,Number(v||5000))})}/>
                  </div>
                  ):null}
                </div>
                <div>
                  {selected.type==="FULL_BLEED_HERO" && (item.mediaType||"image")==="video" ? (
                    <div className="rounded-xl border bg-neutral-50 p-5 text-sm text-neutral-600">
                      Video dùng URL MP4/WebM ở cột bên trái. Video ngoài website sẽ autoplay + muted + loop + playsInline.
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-neutral-50 px-4 py-7 text-center">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e=>void upload(selected.id,item,e.target.files)}/>
                      <div><div className="text-sm font-semibold">+ Upload ảnh</div><div className="mt-1 text-xs text-neutral-400">{selected.type==="HERO_SPLIT"||selected.type==="FULL_BLEED_HERO"?"Từ 2 ảnh: slideshow theo chế độ chuyển ảnh đã chọn.":"Có thể tải nhiều ảnh cho thẻ này."}</div></div>
                    </label>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3">{item.images.map((img,i)=><div key={img.id} className="overflow-hidden rounded-xl border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}<img src={img.url} alt="" className="aspect-[4/3] w-full object-cover"/>
                    <div className="p-2"><div className="mb-2 text-[11px] text-neutral-400">Ảnh {i+1}</div><div className="grid grid-cols-3 gap-1">
                      {canEdit ? <button onClick={()=>moveImage(selected.id,item,img.id,-1)} className="rounded border py-1 text-xs">←</button> : <span />}
                      {canEdit ? <button onClick={()=>moveImage(selected.id,item,img.id,1)} className="rounded border py-1 text-xs">→</button> : <span />}
                      {canDelete ? <button onClick={()=>removeImage(selected.id,item,img.id)} className="rounded py-1 text-xs text-red-600">Xóa</button> : <span />}
                    </div></div>
                  </div>)}</div>
                </div>
              </div>
            </section>)}
            {canEdit ? <button onClick={()=>addItem(selected.id)} className="w-full rounded-2xl border-2 border-dashed bg-white py-4 text-sm font-semibold text-neutral-600">+ Thêm thẻ vào block này</button> : null}
          </>:null}
        </div>}
      </main>
    </div>
  </div>
}

function Field({label,value,onChange,placeholder="",onPaste,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;onPaste?:(event:ClipboardEvent<HTMLInputElement>)=>void;disabled?:boolean}){
  return <label><div className="mb-1 text-xs font-semibold text-neutral-500">{label}</div><input value={value} placeholder={placeholder} disabled={disabled} onPaste={onPaste} onChange={e=>onChange(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-sm disabled:opacity-60"/></label>
}
function CaptionHeightField({value,disabled,onChange}:{value:number;disabled:boolean;onChange:(value:number)=>void}) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  return <label className="block"><div className="mb-1 text-xs font-semibold text-neutral-500">Chiều cao nền chữ (px)</div>
    <input type="number" min={48} max={200} step={1} value={draft} disabled={disabled} className="h-11 w-full rounded-xl border px-3 text-sm disabled:opacity-50"
      onChange={e=>{const v=e.target.value;setDraft(v);const n=Number(v);if(v.trim()&&Number.isFinite(n)&&n>=48&&n<=200)onChange(cardCaptionHeight(n));}}
      onBlur={()=>{const next=draft.trim()?cardCaptionHeight(draft):value;setDraft(String(next));onChange(next);}}/>
  </label>;
}
function Area({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  return <label><div className="mb-1 text-xs font-semibold text-neutral-500">{label}</div><textarea value={value} onChange={e=>onChange(e.target.value)} rows={4} className="w-full rounded-xl border px-3 py-2 text-sm"/></label>
}

function SlideDelayField({value,disabled,onChange}:{value:number;disabled:boolean;onChange:(ms:number)=>void}) {
  const [draft,setDraft]=useState(String(value/1000));
  useEffect(()=>{setDraft(String(value/1000));},[value]);
  return <label>
    <div className="mb-1 text-xs font-semibold text-neutral-500">Đổi ảnh mỗi (giây)</div>
    <input type="number" min={1.5} max={60} step="any" value={draft} disabled={disabled}
      onChange={e=>{
        const v=e.target.value;setDraft(v);
        const seconds=Number(v);
        if(v.trim()&&Number.isFinite(seconds)&&seconds>=1.5&&seconds<=60)onChange(slideDelayMs(seconds*1000));
      }}
      onBlur={()=>{
        const ms=draft.trim()?slideDelayMs(Number(draft)*1000):value;
        setDraft(String(ms/1000));if(ms!==value)onChange(ms);
      }} className="h-11 w-full rounded-xl border bg-white px-3 text-sm disabled:bg-neutral-100 disabled:opacity-60"/>
    <div className="mt-1 text-[11px] text-neutral-500">1,5–60 giây</div>
  </label>;
}
