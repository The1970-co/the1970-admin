"use client";

import { apiJson } from "@/lib/api";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileJson2,
  Image as ImageIcon,
  MessageCircle,
  PackageCheck,
  Play,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AnyRow = Record<string, any>;
type ReviewData = {
  version: number;
  createdAt: string;
  post: {
    postId: string;
    message: string;
    createdTime?: string | null;
    image?: string | null;
  };
  mapping: {
    productCode: string;
    color: string;
    productName?: string;
    totalQty?: number | null;
    minQty?: number | null;
    level?: string | null;
    sizes?: AnyRow[];
  };
  launch: {
    level: "manual" | "semi" | "auto";
    dryRun: boolean;
    launchMode: string;
    dailyBudget: number;
    waitHours: number;
    templateAdSetId: string;
    templateAdSetName?: string;
    templateCampaignName?: string;
    requireInventoryMatch: boolean;
    blockCriticalStock: boolean;
    autoActivate: boolean;
    adName: string;
  };
};

const money = (v: any) => `${Math.round(Number(v || 0)).toLocaleString("vi-VN")}đ`;

function Line({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="border-t border-neutral-100 px-4 py-3 first:border-t-0">
      <div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`mt-1 text-[13px] font-bold leading-5 text-neutral-950 ${mono ? "break-all font-mono text-[11px]" : ""}`}>{value}</div>
    </div>
  );
}

function MetaField({ ok = true, field, value, note }: { ok?: boolean; field: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="border-t border-neutral-100 px-4 py-3 first:border-t-0">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {ok ? "✓" : "!"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] font-black text-neutral-500">{field}</div>
          <div className="mt-1 break-words text-[12px] font-bold text-neutral-950">{value}</div>
          {note ? <div className="mt-1 text-[10px] leading-4 text-neutral-400">{note}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function MobileAutopilotReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnyRow | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [templateComparison, setTemplateComparison] = useState<AnyRow | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("autopilotLaunchReview");
      if (!raw) throw new Error("Không có dữ liệu duyệt Ads. Quay lại Autopilot và bấm Chạy bài này.");
      setReview(JSON.parse(raw));
    } catch (e: any) {
      setError(e?.message || "Không đọc được cấu hình duyệt Ads");
    } finally {
      setLoading(false);
    }
  }, []);

  const expected = useMemo(() => {
    if (!review) return null;
    const l = review.launch;
    const m = review.mapping;

    return {
      campaign: {
        name: l.adName,
        objective: "OUTCOME_ENGAGEMENT",
        buying_type: "AUCTION",
        daily_budget: l.dailyBudget,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        bid_amount: "OMIT",
        cost_per_result_goal: "OMIT",
        special_ad_categories: "[]",
        status: "PAUSED",
      },
      adset: {
        name: l.adName,
        campaign_id: "ID Campaign vừa tạo",
        optimization_goal: "CONVERSATIONS",
        billing_event: "IMPRESSIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        bid_amount: "OMIT",
        targeting: `COPY FROM TEMPLATE ${l.templateAdSetId || "—"}`,
        promoted_object: `COPY FROM TEMPLATE ${l.templateAdSetId || "—"}`,
        destination_type: `COPY/NORMALIZE FROM TEMPLATE`,
        attribution_spec: `COPY FROM TEMPLATE IF VALID`,
        status: "PAUSED",
      },
      creative: {
        name: `${l.adName} · Creative`,
        object_story_id: review.post.postId,
      },
      ad: {
        name: l.adName,
        adset_id: "ID Ad Set vừa tạo",
        creative_id: "ID Creative vừa tạo",
        status: "PAUSED",
      },
      mapping: {
        productCode: m.productCode,
        color: m.color,
      },
    };
  }, [review]);

  async function loadTemplateComparison() {
    if (!review || templateComparison || comparisonLoading) return;
    setComparisonLoading(true);
    setComparisonError("");
    try {
      const r = await apiJson("/meta-ads/autopilot/launch/template-comparison", {
        method: "POST",
        body: JSON.stringify({
          launchMode: review.launch.launchMode,
          templateAdSetId: review.launch.templateAdSetId,
          dailyBudget: review.launch.dailyBudget,
          name: review.launch.adName,
        }),
      });
      setTemplateComparison(r);
    } catch (e: any) {
      setComparisonError(e?.message || "Không đọc được Ad Set mẫu từ Meta");
    } finally {
      setComparisonLoading(false);
    }
  }

  async function confirmRun() {
    if (!review) return;
    if (templateComparison && templateComparison?.validation?.valid === false) {
      setError("Payload chưa qua validator. Mở Xem chi tiết đối chiếu Meta để kiểm tra.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const r = await apiJson("/meta-ads/autopilot/launch/run", {
        method: "POST",
        body: JSON.stringify({
          postId: review.post.postId,
          force: true,
          manualOverride: true,
          manualProductCode: review.mapping.productCode,
          manualColor: review.mapping.color || undefined,
          dryRun: review.launch.dryRun,
        }),
      });

      const items = Array.isArray(r?.results) ? r.results : [];
      const item =
        items.find((x: AnyRow) => String(x?.postId || x?.id || "") === String(review.post.postId)) ||
        items[0] ||
        null;

      const state = String(item?.state || "").toUpperCase();
      if (state === "ERROR") {
        throw new Error(item?.error || item?.reason || item?.assessment?.reason || "Meta không tạo được Ads.");
      }
      if (["BLOCKED_STOCK", "UNMAPPED"].includes(state)) {
        throw new Error(item?.reason || item?.assessment?.reason || "Bài đang bị chặn bởi mapping/tồn kho.");
      }

      setResult(item || r);

      if (review.launch.dryRun || state === "DRY_RUN") {
        setMessage("Preview OK. Chưa tạo Ads thật.");
      } else if (state === "CREATED_PAUSED") {
        setMessage("Đã tạo Campaign / Ad Set / Ad ở trạng thái PAUSED.");
      } else if (state === "ACTIVE") {
        setMessage("Đã tạo và bật Ads thành công.");
      } else if (state === "ALREADY_AD") {
        setMessage("Bài này đã có Ads trên Meta.");
      } else {
        setMessage(`Meta đã nhận lệnh${state ? ` · ${state}` : ""}.`);
      }
    } catch (e: any) {
      setError(e?.message || "Không tạo được Ads");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="grid min-h-[100dvh] place-items-center bg-[#f4f4f2] text-sm font-bold text-neutral-400">Đang mở cấu hình...</main>;
  }

  if (!review) {
    return (
      <main className="min-h-[100dvh] bg-[#f4f4f2] p-5 pt-[calc(24px+env(safe-area-inset-top))]">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-5">
          <div className="text-lg font-black">Không có dữ liệu duyệt</div>
          <div className="mt-2 text-sm text-neutral-500">{error}</div>
          <button onClick={() => router.replace("/mobile/autopilot")} className="mt-4 h-12 w-full rounded-2xl bg-neutral-950 text-sm font-black text-white">Về Autopilot</button>
        </div>
      </main>
    );
  }

  const l = review.launch;
  const m = review.mapping;
  const stockCritical = String(m.level || "").toUpperCase() === "CRITICAL";

  return (
    <main className="min-h-[100dvh] bg-[#f4f4f2] pb-[calc(120px+env(safe-area-inset-bottom))] text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-[#f4f4f2]/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Meta Ads · Review</div>
            <h1 className="text-xl font-black tracking-tight">Kiểm tra trước khi chạy</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-5 text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-5 text-emerald-700">{message}</div> : null}

        <section className="overflow-hidden rounded-[28px] bg-neutral-950 text-white shadow-sm">
          {review.post.image ? <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-800"><img src={review.post.image} alt="" className="h-full w-full object-cover" /></div> : null}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.16em] text-neutral-400">Sẽ tạo cùng một tên</div>
                <div className="mt-2 text-xl font-black leading-7">{l.adName}</div>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${l.dryRun ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{l.dryRun ? "DRY RUN" : "LIVE"}</span>
            </div>
            <div className="mt-4 line-clamp-3 text-[11px] leading-5 text-neutral-300">{review.post.message}</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 px-4 py-4">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <div className="text-sm font-black">Cài đặt vận hành</div>
              <div className="text-[10px] text-neutral-400">Các thông tin mày cần kiểm tra trước khi gửi Meta.</div>
            </div>
          </div>
          <Line label="Tên Campaign / Ad Set / Ad" value={l.adName} />
          <Line label="Mục tiêu" value="Lượt tương tác → Tin nhắn" />
          <Line label="Mục tiêu hiệu quả" value="Tối đa hóa số cuộc trò chuyện qua tin nhắn" />
          <Line label="Chiến lược giá thầu" value="Mặc định Meta · Mức cao nhất" />
          <Line label="Mục tiêu chi phí / kết quả" value="Không đặt · Meta tự quyết" />
          <Line label="Ngân sách" value={`${money(l.dailyBudget)} / ngày · Campaign`} />
          <Line label="Lịch chạy" value="Bắt đầu khi xác nhận · chạy liên tục" />
          <Line label="Ad Set mẫu" value={l.templateAdSetName ? `${l.templateAdSetName}${l.templateCampaignName ? ` · ${l.templateCampaignName}` : ""}` : l.templateAdSetId || "Chưa chọn"} />
          <Line label="Đối tượng" value="Copy từ Ad Set mẫu" />
          <Line label="Vị trí quảng cáo" value="Advantage+ / theo Ad Set mẫu" />
          <Line label="Đích tin nhắn" value="Copy Page / Instagram / messaging từ Ad Set mẫu" />
          <Line label="Trạng thái lúc tạo" value={l.level === "auto" && l.autoActivate ? "Tạo PAUSED → backend bật ACTIVE sau khi tạo thành công" : "PAUSED để duyệt"} />
        </section>

        <section className={`overflow-hidden rounded-[26px] border bg-white shadow-sm ${stockCritical ? "border-rose-300" : "border-neutral-200"}`}>
          <div className="flex items-center gap-2 px-4 py-4">
            <PackageCheck className="h-5 w-5" />
            <div>
              <div className="text-sm font-black">Mapping & tồn kho</div>
              <div className="text-[10px] text-neutral-400">Nguồn kiểm soát pause/scale sau khi Ads chạy.</div>
            </div>
          </div>
          <Line label="Mã + màu" value={`${m.productCode} · ${m.color || "—"}`} />
          <Line label="Tên sản phẩm" value={m.productName || "—"} />
          <Line label="Tổng tồn / min size" value={`${m.totalQty ?? "—"} / ${m.minQty ?? "—"}`} />
          <Line label="Đánh giá tồn" value={m.level || "—"} />
          {Array.isArray(m.sizes) && m.sizes.length ? (
            <div className="border-t border-neutral-100 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Tồn từng size</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {m.sizes.map((x: AnyRow, i: number) => <span key={`${x.size}-${i}`} className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-black">{x.size}: {x.qty}</span>)}
              </div>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm">
          <button
            onClick={() => {
              const next = !showPayload;
              setShowPayload(next);
              if (next) void loadTemplateComparison();
            }}
            className="flex w-full items-center justify-between px-4 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <FileJson2 className="h-5 w-5" />
              <div>
                <div className="text-sm font-black">Xem chi tiết đối chiếu Meta</div>
                <div className="text-[10px] text-neutral-400">Ẩn mặc định · chỉ mở khi cần kiểm tra raw mẫu ↔ payload sẽ gửi.</div>
              </div>
            </div>
            {showPayload ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showPayload ? <div className="border-t border-neutral-100">
            {comparisonLoading ? <div className="px-4 py-8 text-center text-sm font-bold text-neutral-400">Đang query raw Ad Set mẫu từ Meta...</div> : null}
            {comparisonError ? <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">{comparisonError}</div> : null}

            {templateComparison ? <>
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">Ad Set mẫu Meta trả thật</div>
                    <div className="mt-1 text-sm font-black">{templateComparison?.templateRaw?.name || review.launch.templateAdSetName || "—"}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${templateComparison?.validation?.valid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {templateComparison?.validation?.valid ? "VALID" : "CHECK"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_1fr] border-b border-neutral-100 bg-white px-4 py-2 text-[9px] font-black uppercase tracking-wide text-neutral-400">
                <div>Meta mẫu trả</div>
                <div>Auto Launch sẽ gửi</div>
              </div>

              {(templateComparison?.comparison?.adSet || []).map((x: AnyRow) => (
                <div key={x.field} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="font-mono text-[11px] font-black text-neutral-700">{x.field}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${
                      x.state === "SAME" ? "bg-emerald-100 text-emerald-700" :
                      x.state === "OMITTED" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{x.state}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0 rounded-xl bg-neutral-50 p-2.5">
                      <div className="break-all font-mono text-[9px] leading-4 text-neutral-500">
                        {x.raw === null ? "null / không có" : typeof x.raw === "object" ? JSON.stringify(x.raw) : String(x.raw)}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-xl bg-neutral-950 p-2.5">
                      <div className="break-all font-mono text-[9px] leading-4 text-white">
                        {x.send === null ? "OMIT / không gửi" : typeof x.send === "object" ? JSON.stringify(x.send) : String(x.send)}
                      </div>
                    </div>
                  </div>
                  {x.note ? <div className="mt-2 text-[9px] leading-4 text-neutral-400">{x.note}</div> : null}
                </div>
              ))}

              <div className="bg-neutral-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">Validator trước khi gửi</div>
                <div className="mt-2 space-y-2">
                  {(templateComparison?.validation?.checks || []).map((x: AnyRow) => (
                    <div key={x.key} className="flex items-start gap-2 text-[11px] font-semibold">
                      <span className={x.ok ? "text-emerald-600" : "text-rose-600"}>{x.ok ? "✓" : "✕"}</span>
                      <span>{x.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              <details className="border-t border-neutral-100">
                <summary className="cursor-pointer px-4 py-3 text-[11px] font-black">Raw JSON đầy đủ</summary>
                <div className="space-y-3 px-4 pb-4">
                  <div>
                    <div className="mb-1 text-[9px] font-black uppercase text-neutral-400">templateRaw</div>
                    <pre className="max-h-72 overflow-auto rounded-xl bg-neutral-950 p-3 text-[9px] leading-4 text-neutral-200">{JSON.stringify(templateComparison?.templateRaw, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="mb-1 text-[9px] font-black uppercase text-neutral-400">willSend.adSet</div>
                    <pre className="max-h-72 overflow-auto rounded-xl bg-neutral-950 p-3 text-[9px] leading-4 text-neutral-200">{JSON.stringify(templateComparison?.willSend?.adSet, null, 2)}</pre>
                  </div>
                  {templateComparison?.willSend?.campaign ? <div>
                    <div className="mb-1 text-[9px] font-black uppercase text-neutral-400">willSend.campaign</div>
                    <pre className="max-h-72 overflow-auto rounded-xl bg-neutral-950 p-3 text-[9px] leading-4 text-neutral-200">{JSON.stringify(templateComparison.willSend.campaign, null, 2)}</pre>
                  </div> : null}
                </div>
              </details>
            </> : !comparisonLoading && !comparisonError ? <div className="px-4 py-6 text-center text-[11px] font-bold text-neutral-400">Mở mục này để query trực tiếp Ad Set mẫu từ Meta.</div> : null}
          </div> : null}
        </section>

        <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <div className="text-sm font-black text-emerald-900">Checklist trước khi gửi</div>
              <div className="mt-2 space-y-1.5 text-[11px] font-semibold leading-5 text-emerald-800">
                <div>✓ Có mã + màu tồn kho.</div>
                <div>✓ Có Ad Set mẫu.</div>
                <div>✓ Budget đặt ở Campaign.</div>
                <div>✓ Giá thầu để mặc định Meta (không ép strategy nếu mẫu raw không có).</div>
                <div>✓ Không gửi bid_amount / bid_constraints / cost target.</div>
                <div>✓ Creative dùng đúng bài Page.</div>
              </div>
            </div>
          </div>
        </section>

        {result ? <section className="rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-600" /><div className="text-sm font-black">Kết quả tạo Ads</div></div>
          <div className="mt-3 rounded-2xl bg-neutral-50 p-3 font-mono text-[10px] leading-5 text-neutral-600">
            state: {String(result?.state || "OK")}<br />
            metaCampaignId: {String(result?.metaCampaignId || "—")}<br />
            metaAdSetId: {String(result?.metaAdSetId || "—")}<br />
            metaCreativeId: {String(result?.metaCreativeId || "—")}<br />
            metaAdId: {String(result?.metaAdId || "—")}
          </div>
        </section> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-[0.8fr_1.2fr] gap-2">
          <button onClick={() => router.back()} disabled={busy} className="h-12 rounded-2xl border border-neutral-200 bg-white text-sm font-black text-neutral-600">Quay lại</button>
          <button onClick={() => void confirmRun()} disabled={busy || stockCritical} className="h-12 rounded-2xl bg-neutral-950 text-sm font-black text-white disabled:opacity-40">
            {busy ? "Đang tạo Ads..." : stockCritical ? "Tồn kho CRITICAL" : l.dryRun ? "Preview cấu hình" : "Xác nhận chạy Ads"}
          </button>
        </div>
      </div>
    </main>
  );
}
