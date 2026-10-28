"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getHomepageAdmin, publishHomepage, saveHomepageDraft,
  type HomepageBlock, type HomepageBlockType, type HomepageConfig,
  type HomepageImage, type HomepageItem,
} from "@/lib/website-homepage-api";
import { uploadWebsiteImage } from "@/lib/website-products-api";
import { useAuth } from "@/components/admin/auth/AuthProvider";

const TYPES: {value:HomepageBlockType;label:string}[] = [
  {value:"FULL_BLEED_HERO",label:"Hero tràn viền ảnh / video"},
  {value:"HERO_SPLIT",label:"Hero chia 2 cột"},
  {value:"CARD_ROW",label:"Hàng thẻ ảnh"},
  {value:"STORY_WIDE",label:"Bài ảnh lớn ngang"},
  {value:"STORY_SPLIT",label:"Hai bài ảnh song song"},
  {value:"PRODUCT_GRID",label:"Lưới sản phẩm"},
];

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
  const [config,setConfig]=useState<HomepageConfig>({version:1,blocks:[]});
  const [selectedId,setSelectedId]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{ void load(); },[]);
  async function load(){
    try{
      setLoading(true);setError("");
      const row=await getHomepageAdmin("VN");
      const next=(row?.draftConfig||row?.publishedConfig||{version:1,blocks:[]}) as HomepageConfig;
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

  async function save(){
    try{setSaving(true);setError("");await saveHomepageDraft(config,"VN");}
    catch(e){setError(e instanceof Error?e.message:"Không lưu được.");}
    finally{setSaving(false);}
  }
  async function publish(){
    try{
      setPublishing(true);setError("");await saveHomepageDraft(config,"VN");await publishHomepage("VN");alert("Đã xuất bản homepage.");
    }catch(e){setError(e instanceof Error?e.message:"Không xuất bản được.");}
    finally{setPublishing(false);}
  }

  if(loading)return <div className="p-8 text-sm text-neutral-500">Đang tải...</div>;

  return <div className="min-h-screen bg-neutral-100">
    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-6 py-4">
      <div><div className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">Website / Trang chủ</div><h1 className="mt-1 text-xl font-semibold">Bố cục homepage</h1></div>
      <div className="flex gap-2">
        {canEdit ? <button onClick={()=>void save()} disabled={saving} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">{saving?"Đang lưu...":"Lưu nháp"}</button> : null}
        {canPublish ? <button onClick={()=>void publish()} disabled={saving||publishing} className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">{publishing?"Đang xuất bản...":"Xuất bản"}</button> : null}
      </div>
    </div>

    {error?<div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>:null}

    <div className="grid min-h-[calc(100vh-78px)] grid-cols-[330px_minmax(0,1fr)]">
      <aside className="border-r bg-white p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Các block</div>
        <div className="space-y-2">
          {config.blocks.map((b,index)=><div key={b.id} className={`rounded-2xl border p-3 ${selectedId===b.id?"border-black bg-neutral-50":"border-neutral-200"}`}>
            <button className="w-full text-left" onClick={()=>setSelectedId(b.id)}>
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
          <section className="rounded-2xl border bg-white p-5">
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
            {selected.type==="PRODUCT_GRID"?<div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Số sản phẩm" value={String(selected.settings?.limit||8)} onChange={v=>patchBlock(selected.id,{settings:{...selected.settings,limit:Number(v||8)}})}/>
              <label className="flex items-center gap-3 rounded-xl border p-3"><input disabled={!canEdit} type="checkbox" checked={selected.settings?.onlyFeatured===true} onChange={e=>patchBlock(selected.id,{settings:{...selected.settings,onlyFeatured:e.target.checked}})}/><span className="text-sm">Chỉ sản phẩm nổi bật</span></label>
            </div>:null}
          </section>

          {selected.type!=="PRODUCT_GRID"?<>
            {selected.items.map((item,index)=><section key={item.id} className="rounded-2xl border bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><div className="text-sm font-semibold">Thẻ {index+1}</div><div className="text-xs text-neutral-400">{item.mediaMode==="slider"?`Slider · ${item.images.length} ảnh`:"1 ảnh"}</div></div>
                <div className="flex gap-1">
                  {canEdit ? <><button onClick={()=>moveItem(selected.id,item.id,-1)} className="rounded border px-2 py-1 text-xs">↑</button><button onClick={()=>moveItem(selected.id,item.id,1)} className="rounded border px-2 py-1 text-xs">↓</button></> : null}
                  {canDelete ? <button onClick={()=>removeItem(selected.id,item.id)} className="rounded px-2 py-1 text-xs text-red-600">Xóa thẻ</button> : null}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Field label="Tiêu đề VI" value={item.titleVi} onChange={v=>patchItem(selected.id,item.id,{titleVi:v})}/>
                  <Field label="Tiêu đề EN" value={item.titleEn} onChange={v=>patchItem(selected.id,item.id,{titleEn:v})}/>
                  <Field label="Dòng nhỏ VI" value={item.subtitleVi} onChange={v=>patchItem(selected.id,item.id,{subtitleVi:v})}/>
                  <Field label="Dòng nhỏ EN" value={item.subtitleEn} onChange={v=>patchItem(selected.id,item.id,{subtitleEn:v})}/>
                  <Area label="Nội dung VI" value={item.bodyVi} onChange={v=>patchItem(selected.id,item.id,{bodyVi:v})}/>
                  <Area label="Nội dung EN" value={item.bodyEn} onChange={v=>patchItem(selected.id,item.id,{bodyEn:v})}/>
                  <div className="grid gap-3 md:grid-cols-2"><Field label="Nút VI" value={item.ctaVi} onChange={v=>patchItem(selected.id,item.id,{ctaVi:v})}/><Field label="Nút EN" value={item.ctaEn} onChange={v=>patchItem(selected.id,item.id,{ctaEn:v})}/></div>
                  <Field label="Link khi bấm" value={item.link} onChange={v=>patchItem(selected.id,item.id,{link:v})} placeholder="/collections/all"/>

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

                  {(selected.type!=="FULL_BLEED_HERO" || (item.mediaType||"image")==="image")?<div className="grid gap-3 md:grid-cols-2">
                    <label><div className="mb-1 text-xs font-semibold text-neutral-500">Kiểu ảnh</div>
                      <select disabled={!canEdit} value={item.mediaMode} onChange={e=>patchItem(selected.id,item.id,{mediaMode:e.target.value as "single"|"slider"})} className="h-11 w-full rounded-xl border px-3 text-sm">
                        <option value="single">1 ảnh</option><option value="slider">Slider nhiều ảnh</option>
                      </select>
                    </label>
                    <Field label="Đổi ảnh mỗi (ms)" value={String(item.autoplayMs)} onChange={v=>patchItem(selected.id,item.id,{autoplayMs:Math.max(1500,Number(v||5000))})}/>
                  </div>:null}
                </div>
                <div>
                  {selected.type==="FULL_BLEED_HERO" && (item.mediaType||"image")==="video" ? (
                    <div className="rounded-xl border bg-neutral-50 p-5 text-sm text-neutral-600">
                      Video dùng URL MP4/WebM ở cột bên trái. Video ngoài website sẽ autoplay + muted + loop + playsInline.
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-neutral-50 px-4 py-7 text-center">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e=>void upload(selected.id,item,e.target.files)}/>
                      <div><div className="text-sm font-semibold">+ Upload ảnh</div><div className="mt-1 text-xs text-neutral-400">Nếu có từ 2 ảnh trở lên, ngoài website sẽ tự chạy slideshow.</div></div>
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

function Field({label,value,onChange,placeholder=""}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){
  return <label><div className="mb-1 text-xs font-semibold text-neutral-500">{label}</div><input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-sm"/></label>
}
function Area({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  return <label><div className="mb-1 text-xs font-semibold text-neutral-500">{label}</div><textarea value={value} onChange={e=>onChange(e.target.value)} rows={4} className="w-full rounded-xl border px-3 py-2 text-sm"/></label>
}
