"use client";

import { ArrowLeft, Boxes, ChevronRight, Layers3, PackageOpen, Ruler, Scissors, Shirt } from "lucide-react";
import Link from "next/link";

const cards = [
  {
    href: "/mobile/fabric-library",
    title: "Bảng vải",
    description: "Thư viện mã bảng, thành phần, mùa và nhóm sản phẩm.",
    icon: Layers3,
  },
  {
    href: "/mobile/samples",
    title: "Triển khai mẫu",
    description: "Mẫu mã, ảnh tham khảo và tiến độ làm mẫu.",
    icon: Shirt,
  },
  {
    href: "/mobile/measurement-library",
    title: "Bảng thông số",
    description: "Thư viện size và bảng đo cho mẫu áo, quần.",
    icon: Ruler,
  },
  {
    href: "/mobile/fabric",
    title: "Vải về",
    description: "Phiếu nhập, cây vải, màu, mét/kg và ảnh từng cây.",
    icon: Scissors,
  },
  {
    href: "/mobile/production/orders",
    title: "Sản xuất",
    description: "Lệnh sản xuất, nhà may và trạng thái cắt/may/QC.",
    icon: Boxes,
  },
  {
    href: "/mobile/accessories",
    title: "Nguyên phụ liệu",
    description: "Cúc, mác, khóa, chun, tồn kho và NCC NPL.",
    icon: PackageOpen,
  },
];

export default function MobileProductionHubPage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(16px+env(safe-area-inset-bottom))] text-neutral-950">
      <div className="mx-auto max-w-md">
        <header className="border-b border-neutral-200 bg-white px-4 pb-5 pt-[calc(14px+env(safe-area-inset-top))]">
          <div className="flex items-start gap-3">
            <Link
              href="/mobile"
              aria-label="Quay lại trang chính"
              className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-neutral-100 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                Sản xuất / Nguyên liệu
              </div>
              <h1 className="mt-1 text-2xl font-black">Trung tâm sản xuất</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Chọn đúng phần cần làm, mỗi màn chỉ hiển thị nội dung của phần đó.
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-3 p-4">
          {cards.map(({ href, title, description, icon: Icon }, index) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 rounded-[28px] p-5 shadow-sm active:scale-[0.99] ${
                index === 1 ? "bg-neutral-950 text-white" : "bg-white"
              }`}
            >
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
                index === 1 ? "bg-white/10" : "bg-neutral-100"
              }`}>
                <Icon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black">{title}</div>
                <div className={`mt-1 text-xs leading-5 ${
                  index === 1 ? "text-neutral-300" : "text-neutral-500"
                }`}>
                  {description}
                </div>
              </div>
              <ChevronRight className={`h-5 w-5 shrink-0 ${
                index === 1 ? "text-neutral-400" : "text-neutral-300"
              }`} />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
