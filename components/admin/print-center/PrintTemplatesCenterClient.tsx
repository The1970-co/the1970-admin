"use client";

import Link from "next/link";
import PrintTemplatesTab from "@/components/admin/settings/PrintTemplatesTab";

export default function PrintTemplatesCenterClient() {
  return (
    <div className="space-y-5">
      <div>
        <Link href="/print-center" className="text-sm text-neutral-500 hover:text-neutral-950">
          ← Trung tâm in ấn
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Mẫu in / cấu hình
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Dùng chung đúng component Mẫu in trong trang Cài đặt, nên dữ liệu/template không bị lệch giữa hai nơi.
        </p>
      </div>

      <PrintTemplatesTab />
    </div>
  );
}
