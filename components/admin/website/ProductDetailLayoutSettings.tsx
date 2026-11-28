"use client";
import { useEffect, useState } from "react";
import { getWebsiteProducts } from "@/lib/website-products-api";
import { DEFAULT_DETAIL_OPTIONS, normalizeDetailConfig, parseMeasurements, type ProductDetailConfig, type ProductDetailOptions, type ProductDetailContent } from "@/lib/product-detail-layout";

type WebsiteRow = { slug?: string; titleVi?: string; product?: { name?: string } };
export default function ProductDetailLayoutSettings({ value, onChange, disabled }: {value: unknown; onChange: (value: ProductDetailConfig) => void; disabled: boolean}) {
  const config = normalizeDetailConfig(value);
  const options = config.options;
  const [rows,setRows] = useState<WebsiteRow[]>([]);
  const [slug,setSlug] = useState("");
  const [error,setError] = useState("");
  const [query,setQuery] = useState("");
  useEffect(() => {
    let alive = true;
    getWebsiteProducts("").then(raw => {
      if (!alive) return;
      setRows(Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : []);
    }).catch(() => { if (alive) setError("Không tải được danh sách; có thể nhập slug sản phẩm trực tiếp."); });
    return () => { alive = false; };
  }, []);
  const item = Object.prototype.hasOwnProperty.call(config.products, slug) ? config.products[slug] : {};
  function patch(p: Partial<ProductDetailOptions>) { if (!disabled) onChange({...config, options: {...options,...p}}); }
  function patchItem(p: Partial<ProductDetailContent>) { if (!disabled && slug && !["__proto__","constructor","prototype"].includes(slug)) onChange({...config,products:{...config.products,[slug]:{...item,...p}}}); }
  const inputClass = "h-10 w-full rounded-xl border bg-white px-3 text-sm disabled:opacity-50";
  const labels: Array<{key: keyof ProductDetailOptions; label:string; min:number; max:number}> = [
    {key:"maxWidth",label:"Chiều rộng tối đa trang (px)",min:900,max:1900}, {key:"heroWidth",label:"Tỷ lệ cột ảnh chính (%)",min:45,max:72},
    {key:"gap",label:"Khoảng cách ảnh / cột (px)",min:0,max:90}, {key:"imageColumns",label:"Số cột ảnh chi tiết",min:1,max:3},
    {key:"titleSize",label:"Cỡ tiêu đề (px)",min:14,max:48}, {key:"drawerWidth",label:"Độ rộng bảng bên phải (px)",min:300,max:720},
    {key:"relatedColumns",label:"Số cột sản phẩm gợi ý",min:2,max:6}, {key:"relatedLimit",label:"Số sản phẩm gợi ý tối đa",min:4,max:36},
  ];
  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Bố cục chi tiết sản phẩm</h2><p className="mt-1 text-sm text-neutral-500">Cấu hình toàn website VN. Lưu nháp / Xuất bản bằng nút ở trên; xuất bản cùng các thay đổi homepage hiện tại.</p></div><button disabled={disabled} type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={()=>patch(DEFAULT_DETAIL_OPTIONS)}>Khôi phục bố cục mặc định</button></div>
    <fieldset disabled={disabled} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">{(["ZARA","CLASSIC"] as const).map(mode => <button key={mode} type="button" onClick={()=>patch({layout:mode})} className={`rounded-xl border p-3 text-left ${options.layout===mode?"border-black ring-1 ring-black":""}`}><div className="mb-2 grid h-24 grid-cols-[2fr_1fr] gap-2 bg-neutral-50 p-2"><div className={mode==="CLASSIC"?"grid grid-cols-2 gap-1":"grid grid-cols-1 gap-1"}><div className="bg-neutral-300"/>{mode==="CLASSIC"?<div className="bg-neutral-300"/>:null}</div><div className="space-y-2 pt-2"><div className="h-2 bg-neutral-400"/><div className="h-1 bg-neutral-300"/><div className="h-3 border border-neutral-400"/><div className="h-1 bg-neutral-300"/></div></div><strong className="text-sm">{mode==="ZARA"?"Editorial / Zara":"Classic / Taylor Stitch"}</strong><p className="text-xs text-neutral-500">{mode==="ZARA"?"Ảnh chính lớn, ảnh chi tiết bên dưới":"Lưới ảnh bên trái, thông tin bên phải"}</p></button>)}</div>
      <div className="grid gap-3 md:grid-cols-3">{labels.map(f=><label key={f.key} className="text-xs font-medium text-neutral-600">{f.label}<input className={inputClass+" mt-1"} type="number" min={f.min} max={f.max} key={`${f.key}-${options[f.key]}`} defaultValue={String(options[f.key])} onBlur={e=>{const n=Number(e.target.value);const v=e.target.value.trim()&&Number.isFinite(n)?Math.max(f.min,Math.min(f.max,Math.round(n))):Number(options[f.key]); e.target.value=String(v);patch({[f.key]:v});}} /></label>)}
      <label className="text-xs font-medium text-neutral-600">Tỷ lệ ảnh chi tiết<select className={inputClass+" mt-1"} value={options.imageRatio} onChange={e=>patch({imageRatio:e.target.value as ProductDetailOptions["imageRatio"]})}><option value="NATURAL">Giữ tỷ lệ gốc</option><option value="PORTRAIT">Dọc 4:5</option><option value="SQUARE">Vuông 1:1</option></select></label>
      <label className="text-xs font-medium text-neutral-600">Font thông tin<select className={inputClass+" mt-1"} value={options.font} onChange={e=>patch({font:e.target.value as ProductDetailOptions["font"]})}><option value="SANS">Sans</option><option value="SERIF">Serif</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.relatedEnabled} onChange={e=>patch({relatedEnabled:e.target.checked})}/> Hiện sản phẩm gợi ý</label></div>
    </fieldset>
    <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Thông tin riêng từng sản phẩm</h3><p className="text-xs text-neutral-500">Chọn sản phẩm để nhập số đo thật, chất liệu, cách chăm sóc, nguồn gốc hoặc chọn kiểu bố cục riêng.</p>{error?<p className="text-xs text-neutral-500">{error}</p>:null}
    <div className="grid gap-2 md:grid-cols-2"><input className={inputClass} placeholder="Tìm tên / slug sản phẩm" value={query} onChange={e=>setQuery(e.target.value)}/><select className={inputClass} value={slug} onChange={e=>setSlug(e.target.value)}><option value="">Chọn sản phẩm</option>{Array.from(new Map([...rows.filter(r=>r.slug && `${r.titleVi||r.product?.name||""} ${r.slug}`.toLowerCase().includes(query.toLowerCase())).map(r=>[String(r.slug),r.titleVi||r.product?.name||String(r.slug)] as const),...(slug?[[slug,rows.find(r=>r.slug===slug)?.titleVi||slug] as const]:[]),...Object.keys(config.products).map(s=>[s,rows.find(r=>r.slug===s)?.titleVi||s] as const)]).entries()).map(([s,label])=><option key={s} value={s}>{label}</option>)}</select></div>
    <label className="block text-xs text-neutral-600">Hoặc nhập slug chính xác<input className={inputClass+" mt-1"} value={slug} onChange={e=>setSlug(e.target.value.trim())} placeholder="premium-suede-jacket-dark-brown"/></label>
    {slug?<fieldset key={slug} disabled={disabled} className="space-y-3"><label className="block text-xs font-medium">Bố cục riêng<select className={inputClass+" mt-1"} value={item.layout||""} onChange={e=>patchItem({layout:e.target.value?e.target.value as ProductDetailContent["layout"]:undefined})}><option value="">Theo cài đặt chung</option><option value="ZARA">Editorial / Zara</option><option value="CLASSIC">Classic</option></select></label>
    <div className="grid gap-3 md:grid-cols-2">{([ ["material","Chất liệu"],["care","Cách chăm sóc"],["origin","Nguồn gốc"],["fit","Phom dáng / ghi chú kích thước"],["mixSlugs","Sản phẩm phối cùng (slug, cách nhau bằng dấu phẩy)"]] as const).map(([key,label])=><label key={key} className="block text-xs font-medium">{label}<textarea rows={3} className="mt-1 w-full rounded-xl border p-3 text-sm" value={item[key]||""} onChange={e=>patchItem({[key]:e.target.value})}/></label>)}</div>
    <label className="block text-xs font-medium">Bảng thông số (cm) — mỗi dòng một vị trí, phân cột bằng dấu | hoặc dán từ Excel<textarea rows={5} className="mt-1 w-full rounded-xl border p-3 font-mono text-sm" placeholder={"Vị trí | S | M | L\nNgực | ... | ... | ...\nDài áo | ... | ... | ..."} value={item.measurements||""} onChange={e=>patchItem({measurements:e.target.value})}/></label>
    {item.measurements?.trim()&&!parseMeasurements(item.measurements)?<p className="text-xs text-red-600">Bảng cần hàng tiêu đề và ít nhất một hàng số đo, tất cả hàng cùng số cột.</p>:null}
    <button type="button" className="text-sm text-red-600" onClick={()=>{const next={...config.products};delete next[slug];onChange({...config,products:next});}}>Xóa cấu hình riêng của sản phẩm</button></fieldset>:null}</div>
  </section>;
}
