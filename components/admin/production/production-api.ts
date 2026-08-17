"use client";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";

export async function productionApi<T=any>(path:string,init:RequestInit={}){
  return apiJson<T>(path,{...init,redirectOnUnauthorized:false} as any);
}
export async function uploadProductionImage(file:File){
  const fd=new FormData();fd.append("file",file);
  return productionApi<{url:string}>("/production/accessories/upload",{method:"POST",body:fd});
}
export function asset(url?:string|null){if(!url)return "";return /^https?:\/\//.test(url)?url:`${API_BASE}${url.startsWith("/")?"":"/"}${url}`}
export function fmt(v:any,d=3){return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(Number(v||0))}
export function money(v:any){return new Intl.NumberFormat("vi-VN").format(Number(v||0))+"đ"}
