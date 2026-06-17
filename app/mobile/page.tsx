"use client";

import Link from "next/link";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { BarChart3, Boxes, ChevronRight, ClipboardList, WalletCards, AlertTriangle } from "lucide-react";

function EntryCard({ href, eyebrow, title, description, icon, accent = "white" }: { href: string; eyebrow: string; title: string; description: string; icon: React.ReactNode; accent?: "white" | "gold" | "red" }) {
  return (
    <Link href={href} className="group relative block overflow-hidden rounded-[2rem] bg-neutral-950 p-6 text-left text-white shadow-xl shadow-neutral-300 active:scale-[0.985] transition">
      <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/5" />
      <div className={`absolute -right-12 top-8 h-36 w-36 rounded-full ${accent === "gold" ? "bg-amber-400/15" : accent === "red" ? "bg-rose-500/15" : "bg-white/10"}`} />
      <div className="relative z-10 flex min-h-40 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950">{icon}</div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"><ChevronRight className="h-5 w-5" /></div>
        </div>
        <div>
          <div className="text-sm font-medium text-white/60">{eyebrow}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{title}</div>
          <div className="mt-3 text-sm leading-5 text-white/65">{description}</div>
        </div>
      </div>
    </Link>
  );
}

export default function MobileEntryPage() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 pt-14">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">The 1970 Operations</div>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-neutral-950">Bạn muốn xem gì hôm nay?</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">Chọn một khu vực để xem nhanh tình hình vận hành, đơn hàng, doanh thu và nguồn tiền trong ngày.</p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-5">
          <EntryCard href="/mobile/orders" eyebrow="Đơn hàng mobile" title="Danh sách đơn" description="Tra nhanh mã đơn, SĐT, khách hàng, trạng thái giao vận và chi tiết sản phẩm." icon={<ClipboardList className="h-6 w-6" />} />
          <EntryCard href="/mobile/reports/overview" eyebrow="Báo cáo vận hành" title="Tổng quan báo cáo" description="Đơn hàng đã tạo, doanh thu, sản phẩm bán chạy và cảnh báo tồn kho." icon={<BarChart3 className="h-6 w-6" />} />
          <EntryCard href="/mobile/finance/daily" eyebrow="Dòng tiền hôm nay" title="Tổng quan nguồn tiền" description="Tiền mặt, chuyển khoản, COD pending, phiếu thu chi và số dư cuối ngày." icon={<WalletCards className="h-6 w-6" />} accent="gold" />
          <div className="grid grid-cols-2 gap-4">
            <Link href="/mobile/products" className="rounded-[1.75rem] bg-white p-5 shadow-sm active:scale-[0.985] transition"><Boxes className="h-6 w-6 text-neutral-950" /><div className="mt-4 text-base font-bold">Sản phẩm</div><div className="mt-1 text-xs leading-5 text-neutral-500">Tra SKU, tồn kho, biến thể.</div></Link>
            <Link href="/mobile/reports/overview#alerts" className="rounded-[1.75rem] bg-white p-5 shadow-sm active:scale-[0.985] transition"><AlertTriangle className="h-6 w-6 text-amber-600" /><div className="mt-4 text-base font-bold">Cảnh báo</div><div className="mt-1 text-xs leading-5 text-neutral-500">SKU thiếu, đơn cần xử lý.</div></Link>
          </div>
        </div>
        <div className="mt-8 rounded-3xl border border-neutral-200 bg-white p-4 text-center text-xs leading-5 text-neutral-500 shadow-sm">Gợi ý: khi có push đơn mới, bấm thông báo sẽ mở thẳng chi tiết đơn trong app.</div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
