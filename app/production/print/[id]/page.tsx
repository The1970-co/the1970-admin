import ProductionPrintClient from "@/components/admin/production/ProductionPrintClient";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ProductionPrintClient id={id}/>}
