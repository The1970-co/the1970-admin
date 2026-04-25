"use client";

import React, { useEffect, useMemo, useState } from "react";

type Tone = "safe" | "warning" | "critical";
type WarRoomTab = "realtime" | "7days" | "forecast";
type DecisionMode = "profit" | "growth" | "inventory";

type DashboardData = {
  hero: {
    status: Tone;
    title: string;
    subtitle: string;
    chips: string[];
    autoMode: "SAFE" | "SEMI" | "LIVE";
    metaMode: "DRY RUN" | "LIVE" | "DISCONNECTED";
    metaAccount: string;
    scheduler: { label: string; times: string[] };
  };
  warningSummary: {
    level: Tone;
    title: string;
    subtitle: string;
    revenue: string;
    roas: string;
    inventory: string;
  };
  filters: {
    range: string;
    channel: string;
    warehouse: string;
  };
  decisionCards: Array<{
    id: string;
    eyebrow: string;
    title: string;
    desc: string;
    source: string;
    score: string;
    tag: string;
    tone: Tone;
  }>;
  commandCenter: {
    title: string;
    subtitle: string;
  };
  insightRow: Array<{
    id: string;
    title: string;
    desc: string;
    tone: Tone;
    badge: string;
  }>;
  realtime: {
    delta: string;
    deltaPct: string;
    checkoutPurchase: string;
    chokeLabel: string;
    lowStock: string[];
  };
  kpis: Array<{ id: string; label: string; value: string; delta: string }>;
  dailyRows: Array<{
    day: string;
    note: string;
    revenue: string;
    profit: string;
    orders: string;
    roas: string;
    compare: string;
    positive?: boolean;
    isToday?: boolean;
  }>;
  drilldown: Array<{ label: string; value: string; tone?: "dark" | "mint" }>;
  funnel: Array<{ label: string; value: string; width: string }>;
  moneyFlow: Array<{
    channel: string;
    text: string;
    badge: string;
    tone: "green" | "amber" | "red";
  }>;
  topProducts: Array<{
    rank: number;
    name: string;
    meta: string;
    qty: string;
    revenue: string;
  }>;
  channelRevenue: Array<{ name: string; width: string; value: string }>;
  warehouseMix: Array<{ name: string; value: string; note: string }>;
  quickInsights: string[];
  floatingApproval: { count: string; title: string; subtitle: string };
};

function Panel({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[28px] border border-neutral-200 bg-white shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function toneClass(tone: Tone) {
  if (tone === "safe") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-[#e0bb4c] bg-[#fbf3d9] text-[#b7791f]";
}

function softToneClass(tone: Tone) {
  if (tone === "safe") return "border-emerald-200 bg-emerald-50/45";
  if (tone === "critical") return "border-rose-200 bg-rose-50/40";
  return "border-[#d7b24a] bg-[#fbf6df]";
}

function Badge({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: Tone | "dark" | "muted";
}) {
  const cls =
    tone === "dark"
      ? "border-neutral-900 bg-neutral-900 text-white"
      : tone === "muted"
      ? "border-neutral-200 bg-neutral-100 text-neutral-600"
      : toneClass(tone);

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">{children}</p>;
}

function metricTone(delta: string) {
  return delta.trim().startsWith("-") ? "text-rose-500" : "text-emerald-600";
}

function fallbackData(): DashboardData {
  return {
    hero: {
      status: "warning",
      title: "SYSTEM STATUS: WARNING",
      subtitle: "ROAS ổn · Doanh thu giảm · 1 SKU cảnh báo tồn",
      chips: ["ROAS ổn", "Doanh thu giảm", "1 SKU cảnh báo tồn"],
      autoMode: "SEMI",
      metaMode: "DRY RUN",
      metaAccount: "act_2384_The1970",
      scheduler: { label: "2 lịch chạy", times: ["09:00 / 20:00"] },
    },
    warningSummary: {
      level: "warning",
      title: "Có tín hiệu rủi ro cần theo dõi sát",
      subtitle: "Một số chỉ số đã chạm ngưỡng cảnh báo.",
      revenue: "Đang giảm",
      roas: "An toàn",
      inventory: "1 SKU sắp hết",
    },
    filters: {
      range: "30 ngày",
      channel: "Tất cả kênh",
      warehouse: "Tất cả chi nhánh / kho",
    },
    decisionCards: [
      {
        id: "d1",
        eyebrow: "Bảo vệ tồn",
        title: "Sắp hết hàng QS794 Palm",
        desc: "ROAS TB 4.01x · tồn 22 sp · lãi ước tính 4.6M · còn 22 sp · ước tính hết sau 3 ngày",
        source: "Website",
        score: "96%",
        tag: "Cảnh báo",
        tone: "warning",
      },
      {
        id: "d2",
        eyebrow: "Bảo vệ tồn",
        title: "Sắp hết hàng SM902 Rêu Đen",
        desc: "còn 8 sp · ước tính hết sau 2 ngày",
        source: "Facebook Ads",
        score: "96%",
        tag: "Cảnh báo",
        tone: "warning",
      },
      {
        id: "d3",
        eyebrow: "Fix checkout",
        title: "Tối ưu bước checkout",
        desc: "Checkout → Purchase mới 28.9%. Nên kiểm tra phí ship và UX thanh toán.",
        source: "Funnel system",
        score: "93%",
        tag: "Cảnh báo",
        tone: "warning",
      },
      {
        id: "d4",
        eyebrow: "Bảo vệ tồn",
        title: "Sắp hết hàng Vintage Olive Tee",
        desc: "còn 15 sp · ước tính hết sau 4 ngày",
        source: "Website",
        score: "88%",
        tag: "Ưu tiên cao",
        tone: "warning",
      },
    ],
    commandCenter: {
      title: "Hành động ngay trên Tổng quan",
      subtitle: "Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý tại đây.",
    },
    insightRow: [
      {
        id: "i1",
        title: "Doanh thu hôm nay đang thấp hơn hôm qua",
        desc: "42.8M so với 49.5M. Nên kiểm tra ads và checkout ngay.",
        tone: "critical",
        badge: "Cảnh báo",
      },
      {
        id: "i2",
        title: "ROAS hôm nay vẫn ở mức tốt",
        desc: "ROAS hiện tại 3.92x, vẫn đủ dư địa để giữ ngân sách.",
        tone: "safe",
        badge: "Ổn định",
      },
      {
        id: "i3",
        title: "Có SKU cần theo dõi tồn kho gấp",
        desc: "SM902 Rêu Đen đang tồn thấp, nên cân nhắc nhập thêm hoặc giảm ads.",
        tone: "warning",
        badge: "Theo dõi",
      },
    ],
    realtime: {
      delta: "-6.7M",
      deltaPct: "-13.5%",
      checkoutPurchase: "28.9%",
      chokeLabel: "Điểm nghẽn funnel",
      lowStock: ["SM902 Rêu Đen • 2 ngày", "QS794 Palm • 3 ngày", "Vintage Olive Tee • 4 ngày"],
    },
    kpis: [
      { id: "k1", label: "Doanh thu hôm nay", value: "42.8M", delta: "+12.4%" },
      { id: "k2", label: "Đơn hàng", value: "128", delta: "+8.1%" },
      { id: "k3", label: "AOV", value: "334K", delta: "+4.7%" },
      { id: "k4", label: "ROAS", value: "3.92x", delta: "+0.31" },
      { id: "k5", label: "Lợi nhuận ước tính", value: "11.6M", delta: "+9.2%" },
    ],
    dailyRows: [
      {
        day: "25",
        note: "Hôm nay",
        revenue: "42.8M",
        profit: "13.7M",
        orders: "128",
        roas: "3.92x",
        compare: "-13.5%",
        positive: false,
        isToday: true,
      },
      {
        day: "24",
        note: "Hôm qua",
        revenue: "49.5M",
        profit: "15.4M",
        orders: "108",
        roas: "4.19x",
        compare: "+13.3%",
        positive: true,
      },
      {
        day: "23",
        note: "Trong tháng",
        revenue: "43.7M",
        profit: "12.9M",
        orders: "95",
        roas: "3.90x",
        compare: "-7.6%",
        positive: false,
      },
      {
        day: "22",
        note: "Trong tháng",
        revenue: "47.3M",
        profit: "14.8M",
        orders: "102",
        roas: "4.11x",
        compare: "+13.2%",
        positive: true,
      },
      {
        day: "21",
        note: "Trong tháng",
        revenue: "41.8M",
        profit: "12.1M",
        orders: "91",
        roas: "3.62x",
        compare: "-7.3%",
        positive: false,
      },
      {
        day: "20",
        note: "Trong tháng",
        revenue: "45.1M",
        profit: "13.6M",
        orders: "96",
        roas: "4.05x",
        compare: "+14.5%",
        positive: true,
      },
      {
        day: "19",
        note: "Trong tháng",
        revenue: "39.4M",
        profit: "11.5M",
        orders: "86",
        roas: "3.41x",
        compare: "-7.5%",
        positive: false,
      },
      {
        day: "18",
        note: "Trong tháng",
        revenue: "42.6M",
        profit: "12.8M",
        orders: "92",
        roas: "3.88x",
        compare: "+12.4%",
        positive: true,
      },
      {
        day: "17",
        note: "Trong tháng",
        revenue: "37.9M",
        profit: "10.9M",
        orders: "83",
        roas: "3.33x",
        compare: "-7.1%",
        positive: false,
      },
    ],
    drilldown: [
      { label: "Doanh thu", value: "42.8M" },
      { label: "Đơn hàng", value: "128" },
      { label: "Chi phí ads", value: "10.9M" },
      { label: "ROAS ngày", value: "3.92x", tone: "dark" },
      { label: "Lợi nhuận ước tính", value: "13.7M", tone: "mint" },
    ],
    funnel: [
      { label: "Visits", value: "18.4K", width: "100%" },
      { label: "Add to cart", value: "2.96K", width: "68%" },
      { label: "Checkout", value: "1.12K", width: "42%" },
      { label: "Purchase", value: "324", width: "22%" },
    ],
    moneyFlow: [
      {
        channel: "Facebook",
        text: "Chi 52% ngân sách nhưng mang về 30% doanh thu.",
        badge: "Inefficient",
        tone: "red",
      },
      {
        channel: "Website",
        text: "Chi 31% ngân sách nhưng mang về 52% doanh thu.",
        badge: "Efficient",
        tone: "green",
      },
      {
        channel: "Shopify checkout",
        text: "Chi 2% ngân sách nhưng mang về 6% doanh thu.",
        badge: "Balanced",
        tone: "amber",
      },
      {
        channel: "TikTok",
        text: "Chi 15% ngân sách nhưng mang về 12% doanh thu.",
        badge: "Balanced",
        tone: "amber",
      },
    ],
    topProducts: [
      { rank: 1, name: "QS794 Palm", meta: "T-Shirt · Tồn kho: 22", qty: "48 sp", revenue: "14.4M" },
      { rank: 2, name: "SM902 Rêu Đen", meta: "Shirt · Tồn kho: 8", qty: "33 sp", revenue: "12.1M" },
      { rank: 3, name: "Vintage Olive Tee", meta: "T-Shirt · Tồn kho: 15", qty: "29 sp", revenue: "8.7M" },
      { rank: 4, name: "Heritage Sage Tee", meta: "T-Shirt · Tồn kho: 11", qty: "21 sp", revenue: "6.5M" },
    ],
    channelRevenue: [
      { name: "Website", width: "72%", value: "61.2M" },
      { name: "Facebook", width: "45%", value: "34.8M" },
      { name: "TikTok", width: "20%", value: "14.5M" },
      { name: "Shopify checkout", width: "8%", value: "7.1M" },
    ],
    warehouseMix: [
      { name: "Kho Hà Nội", value: "46%", note: "Tỷ trọng tồn kho hiện tại" },
      { name: "Kho Sài Gòn", value: "32%", note: "Tỷ trọng tồn kho hiện tại" },
      { name: "Kho Online", value: "22%", note: "Tỷ trọng tồn kho hiện tại" },
    ],
    quickInsights: [
      "Website đang đóng góp 52% doanh thu toàn kênh.",
      "Mẫu SM902 Rêu Đen chỉ còn tồn thấp, nên nhập thêm sớm.",
      "Funnel từ checkout → purchase cần tối ưu thêm hôm nay.",
    ],
    floatingApproval: { count: "1 pending", title: "Scale QS794 Palm", subtitle: "scale15" },
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(fallbackData());
  const [warRoomTab, setWarRoomTab] = useState<WarRoomTab>("realtime");
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("profit");
  const [autoAction, setAutoAction] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);
  const [autoMode, setAutoMode] = useState<"SAFE" | "SEMI" | "LIVE">("SEMI");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>("");
  const [approvalOpen, setApprovalOpen] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [commandNote, setCommandNote] = useState<string>(
    "Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý tại đây."
  );

  const [selectedRange, setSelectedRange] = useState("30d");
  const [selectedChannel, setSelectedChannel] = useState("Tất cả kênh");
  const [selectedWarehouse, setSelectedWarehouse] = useState("Tất cả chi nhánh / kho");
  const [selectedInsightId, setSelectedInsightId] = useState("i1");
  const [selectedDay, setSelectedDay] = useState("25");
  const [selectedProductRank, setSelectedProductRank] = useState(1);
  const [selectedMoneyFlowChannel, setSelectedMoneyFlowChannel] = useState("Website");

  const [actionLog, setActionLog] = useState<
    Array<{ id: string; title: string; desc: string; time: string }>
  >([
    {
      id: "log-1",
      title: "SIM • Rà soát ngay • BẢO VỆ TỒN",
      desc: "Đưa vào danh sách kiểm tra trong ngày",
      time: "Bây giờ",
    },
    {
      id: "log-2",
      title: "Tăng ngân sách QS794 Palm",
      desc: "Tăng ngân sách theo điều kiện scale hiện tại",
      time: "Bây giờ",
    },
    {
      id: "log-3",
      title: "Theo dõi checkout",
      desc: "Đánh dấu cần kiểm tra phí ship",
      time: "Bây giờ",
    },
  ]);
  const [scaleLocked, setScaleLocked] = useState(false);
  const [decisionFlag, setDecisionFlag] = useState<"normal" | "low_stock" | "review">("normal");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<
    Array<{ id: string; title: string; actionType: string; createdAt: string }>
  >([
    { id: "pa-1", title: "Scale QS794 Palm", actionType: "scale15", createdAt: "09:26" },
  ]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!ignore) {
          const base = fallbackData();
          setData({
            ...base,
            ...json,
            hero: { ...base.hero, ...(json.hero || {}) },
          });
          if (json?.hero?.autoMode) setAutoMode(json.hero.autoMode);
        }
      } catch {
        // fallback
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  const decisionPills = useMemo(
    () => [
      { id: "profit", label: "Ưu tiên profit" },
      { id: "growth", label: "Ưu tiên tăng trưởng" },
      { id: "inventory", label: "Ưu tiên tồn kho" },
    ],
    []
  );

 const selectedDecision =
  selectedDecisionId
    ? data.decisionCards.find((card) => card.id === selectedDecisionId) || null
    : null;

  const selectedDailyRow =
    data.dailyRows.find((row) => row.day === selectedDay) || data.dailyRows[0];

  const selectedProduct =
    data.topProducts.find((item) => item.rank === selectedProductRank) || data.topProducts[0] || null;

  const selectedMoneyFlow =
    data.moneyFlow.find((item) => item.channel === selectedMoneyFlowChannel) || data.moneyFlow[0];

  const filteredDecisionCards = useMemo(() => {
    if (decisionMode === "growth") {
      return [...data.decisionCards].sort((a, b) => {
        const av = a.title.toLowerCase().includes("checkout") ? -1 : 1;
        const bv = b.title.toLowerCase().includes("checkout") ? -1 : 1;
        return av - bv;
      });
    }

    if (decisionMode === "inventory") {
      return [...data.decisionCards].sort((a, b) => {
        const av = a.eyebrow.includes("Bảo vệ tồn") ? -1 : 1;
        const bv = b.eyebrow.includes("Bảo vệ tồn") ? -1 : 1;
        return av - bv;
      });
    }

    return data.decisionCards;
  }, [data.decisionCards, decisionMode]);

  function openDecision(cardId: string) {
    const found = data.decisionCards.find((card) => card.id === cardId);
    setSelectedDecisionId(cardId);
    if (found) {
      setCommandNote(`Đang xem: ${found.title} · Nguồn ${found.source} · Score ${found.score}.`);
      setApprovalOpen(true);
      setApprovalStatus("pending");
    }
  }

  function executeDecision(cardId: string) {
    const found = data.decisionCards.find((card) => card.id === cardId);
    setSelectedDecisionId(cardId);
    if (found) {
      setCommandNote(`Đã đưa ${found.title} vào Command Center. Chờ xác nhận bước tiếp theo.`);
      setApprovalStatus("pending");
      setApprovalOpen(true);
    }
  }

  function approveCurrentDecision() {
    setApprovalStatus("approved");
    setCommandNote(`Đã duyệt hành động cho ${selectedDecision?.title || "decision hiện tại"}.`);
    window.setTimeout(() => {
      setApprovalOpen(false);
    }, 250);
  }

  function rejectCurrentDecision() {
    setApprovalStatus("rejected");
    setCommandNote(`Đã từ chối hành động cho ${selectedDecision?.title || "decision hiện tại"}.`);
  }

  function selectInsight(id: string) {
    const found = data.insightRow.find((item) => item.id === id);
    setSelectedInsightId(id);
    if (found) {
      setCommandNote(`Insight đang xem: ${found.title}`);
    }
  }

  function pushLog(title: string, desc: string) {
    setActionLog((prev) => [
      { id: `log-${Date.now()}`, title, desc, time: "Bây giờ" },
      ...prev,
    ]);
  }

  function toggleScaleLock() {
    const next = !scaleLocked;
    setScaleLocked(next);
    pushLog(
      next ? "SIM • Khóa scale • BẢO VỆ TỒN" : "SIM • Mở khóa scale • BẢO VỆ TỒN",
      next ? "Đã khóa scale cho decision đang chọn." : "Đã mở khóa scale cho decision đang chọn."
    );
  }

  function markLowStock() {
    setDecisionFlag("low_stock");
    pushLog("SIM • Sắp hết hàng • BẢO VỆ TỒN", "Giảm ưu tiên ads và theo dõi tồn kho sát hơn.");
    if (selectedDecision) {
      setCommandNote(`Đã đánh dấu sắp hết hàng cho ${selectedDecision.title}.`);
    }
  }

  function markNeedsReview() {
    setDecisionFlag("review");
    pushLog("SIM • Rà soát ngay • BẢO VỆ TỒN", "Đưa vào danh sách kiểm tra trong ngày.");
    if (selectedDecision) {
      setCommandNote(`Đã chuyển ${selectedDecision.title} sang trạng thái cần kiểm tra.`);
    }
  }

  function resolveAllApprovals(type: "approve" | "reject") {
    setApprovalStatus(type === "approve" ? "approved" : "rejected");
    setPendingApprovals([]);
    pushLog(
      type === "approve" ? "Duyệt tất approvals" : "Từ chối tất approvals",
      type === "approve" ? "Đã duyệt toàn bộ approval đang chờ." : "Đã từ chối toàn bộ approval đang chờ."
    );
  }

  function addNote() {
    pushLog("Ghi chú nhanh", `Đã thêm ghi chú cho ${selectedDecision?.title || "decision hiện tại"}.`);
  }

  function undoLog(id: string) {
    setActionLog((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleScheduler() {
    const next = !schedulerEnabled;
    setSchedulerEnabled(next);
    pushLog(
      next ? "Bật Auto Scheduler" : "Tắt Auto Scheduler",
      next ? "Lịch tự động đã được bật lại." : "Lịch tự động đã được tắt."
    );
  }

  function runScheduledTask(time: string) {
    pushLog("Chạy Auto Scheduler", `Đã chạy tác vụ lịch ${time}.`);
  }

  function resolveApproval(id: string, approved: boolean) {
    const target = pendingApprovals.find((item) => item.id === id);
    setPendingApprovals((prev) => prev.filter((item) => item.id !== id));
    setApprovalStatus(approved ? "approved" : "rejected");
    if (target) {
      pushLog(
        approved ? `Duyệt ${target.title}` : `Từ chối ${target.title}`,
        approved ? `Đã duyệt action ${target.actionType}.` : `Đã từ chối action ${target.actionType}.`
      );
      setCommandNote(
        approved ? `Đã duyệt ${target.title}.` : `Đã từ chối ${target.title}.`
      );
    }
  }

  return (
    <div className="relative space-y-4 pb-20 text-[12px]">
      <Panel className="p-4 md:p-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <SectionEyebrow>Autopilot Ecom System</SectionEyebrow>
            <h1 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[34px]">
              {data.hero.title}
            </h1>
            <p className="mt-3 text-sm text-amber-700">{data.hero.subtitle}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Panel className="p-4">
              <SectionEyebrow>Auto Mode</SectionEyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["SAFE", "SEMI", "LIVE"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAutoMode(mode)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      autoMode === mode
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-600"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <SectionEyebrow>Meta</SectionEyebrow>
              <p className="mt-4 text-[16px] font-semibold">{data.hero.metaMode}</p>
              <p className="mt-2 text-sm text-neutral-500">{data.hero.metaAccount}</p>
            </Panel>

            <Panel className="p-4">
              <SectionEyebrow>Auto Scheduler</SectionEyebrow>
              <p className="mt-4 text-[16px] font-semibold">{data.hero.scheduler.label}</p>
              <p className="mt-2 text-sm text-neutral-500">{data.hero.scheduler.times.join(" / ")}</p>
            </Panel>
          </div>
        </div>
      </Panel>

    <Panel
  className="p-5"
  style={{
    backgroundColor: "#fbf6df",
    borderColor: "#d8b34a",
    borderWidth: "2px",
  }}
>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionEyebrow>WARNING</SectionEyebrow>
            <h2 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
              {data.warningSummary.title}
            </h2>
            <p className="mt-2 text-sm text-neutral-600">{data.warningSummary.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">Theo dõi</Badge>
            <Badge tone="muted">War Room Activated</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-neutral-500">Doanh thu</p>
            <p className="mt-2 text-[16px] font-semibold text-rose-500">{data.warningSummary.revenue}</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-neutral-500">ROAS</p>
            <p className="mt-2 text-[16px] font-semibold text-emerald-600">{data.warningSummary.roas}</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-neutral-500">Tồn kho</p>
            <p className="mt-2 text-[16px] font-semibold text-rose-500">{data.warningSummary.inventory}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm text-neutral-500">Ưu tiên xử lý: kiểm tra ads → checkout → tồn kho.</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoAction} onChange={(e) => setAutoAction(e.target.checked)} />
              Auto Action
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={soundAlert} onChange={(e) => setSoundAlert(e.target.checked)} />
              Sound Alert
            </label>
            <Badge tone="dark">{data.hero.metaMode}</Badge>
          </div>
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <SectionEyebrow>Bộ lọc nhanh</SectionEyebrow>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { id: "today", label: "Hôm nay" },
                { id: "7d", label: "7 ngày" },
                { id: "30d", label: "30 ngày" },
                { id: "month", label: "Tháng này" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedRange(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    selectedRange === item.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
            >
              {["Tất cả kênh", "Website", "Facebook", "TikTok", "Shopify checkout"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              {["Tất cả chi nhánh / kho", "Hoàn Kiếm", "Hai Bà Trưng", "Online Warehouse"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <Panel className="p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionEyebrow>Decision AI Pro</SectionEyebrow>
            <h2 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
              Động cơ ra quyết định
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Ưu tiên theo lợi nhuận, tồn kho, ROAS và điểm nghẽn funnel.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {decisionPills.map((pill) => (
              <button
                key={pill.id}
                onClick={() => setDecisionMode(pill.id as DecisionMode)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  decisionMode === pill.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.02fr_0.98fr]">
  <div className="grid content-start items-start gap-3 md:grid-cols-2">
    {filteredDecisionCards.map((card) => (
      <div
        key={card.id}
        onClick={() => openDecision(card.id)}
        className={`h-fit cursor-pointer self-start rounded-[24px] border p-4 text-left transition ${
          selectedDecisionId === card.id
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-200 bg-white hover:shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <SectionEyebrow>{card.eyebrow}</SectionEyebrow>
          <Badge tone={card.tone}>{card.tag}</Badge>
        </div>

        <h3 className="mt-3 font-serif text-[16px] font-medium tracking-tight">{card.title}</h3>
        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm text-neutral-500">{card.desc}</p>

        <div className="mt-5 flex items-center justify-between text-sm text-neutral-500">
          <span>{card.source}</span>
          <span>{card.score}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-xs text-neutral-600">
            {card.title}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                executeDecision(card.id);
              }}
              className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-white"
            >
              Execute
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDecision(card.id);
              }}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-800"
            >
              Open
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>

  <div className="h-fit self-start rounded-3xl border border-stone-200 bg-stone-900 p-5 text-white shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-stone-400">Command Center</div>
        <h3 className="mt-2 text-2xl font-serif">Hành động ngay trên Tổng quan</h3>
      </div>

      <div className="flex items-center gap-2">
        {selectedDecision ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            {selectedDecision.tag}
          </span>
        ) : null}
        {selectedDecision ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-900">
            Score {selectedDecision.score}
          </span>
        ) : null}
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
          Dry run only
        </span>
        {!selectedDecision ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Chọn 1 decision</span>
        ) : null}
      </div>
    </div>

    {!selectedDecision ? (
      <div className="mt-5 rounded-3xl border border-stone-700 bg-white/5 p-4 text-sm text-stone-300">
        Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý ngay tại màn Tổng quan.
      </div>
    ) : (
      <>
        <div className="mt-5 rounded-3xl border border-stone-700 bg-white/5 p-4">
          <div className="text-lg font-medium">{selectedDecision.title}</div>
          <div className="mt-2 text-sm text-stone-300">{selectedDecision.desc}</div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-stone-400">SKU / nhóm</div>
              <div className="mt-1 text-white">{selectedDecision.title}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-stone-400">Kênh</div>
              <div className="mt-1 text-white">{selectedDecision.source}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-stone-400">Decision score</div>
              <div className="mt-1 text-white">{selectedDecision.score}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-stone-400">Action cuối</div>
              <div className="mt-1 text-white">{approvalStatus === "approved" ? "Đã duyệt" : decisionFlag === "low_stock" ? "Auto giảm ngân sách" : decisionFlag === "review" ? "Rà soát ngay" : "Chờ xử lý"}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <button
            onClick={toggleScaleLock}
            className="rounded-2xl bg-white px-4 py-3 font-medium text-stone-900"
          >
            {scaleLocked ? "🔓 Mở khóa scale" : "🔒 Khóa scale"}
          </button>
          <button
            onClick={toggleScaleLock}
            className="rounded-2xl bg-white/10 px-4 py-3 font-medium text-white"
          >
            {scaleLocked ? "🔓 Mở khóa scale" : "🔒 Khóa scale"}
          </button>
          <button
            onClick={markLowStock}
            className="rounded-2xl border border-stone-700 px-4 py-3 text-white hover:bg-white/10"
          >
            Sắp hết hàng
          </button>
          <button
            onClick={markNeedsReview}
            className="rounded-2xl border border-stone-700 px-4 py-3 text-white hover:bg-white/10"
          >
            Cần kiểm tra
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-amber-700 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-amber-400">Approval Queue</div>
          {pendingApprovals.length > 0 ? (
            <div className="mt-3 space-y-2">
              {pendingApprovals.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-stone-400">{item.actionType} · {item.createdAt}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveApproval(item.id, true)}
                      className="rounded-full bg-white px-4 py-2 text-xs font-medium text-stone-900"
                    >
                      Duyệt
                    </button>
                    <button
                      onClick={() => resolveApproval(item.id, false)}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-stone-300">
              Không còn approval nào đang chờ.
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-stone-400">Auto Scheduler</div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleScheduler}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                {schedulerEnabled ? "Đang bật" : "Đang tắt"}
              </button>
              <button
                onClick={() => runScheduledTask("09:00")}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                09:00
              </button>
              <button
                onClick={() => runScheduledTask("20:00")}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                20:00
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-stone-300">
          Meta Ads đang ở chế độ DRY RUN. Hệ thống hiện chỉ mô phỏng lệnh và ghi log.
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-stone-400">Action Log</div>
            <div className="flex gap-2">
              <button
                onClick={() => resolveAllApprovals("approve")}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                Duyệt tất
              </button>
              <button
                onClick={() => resolveAllApprovals("reject")}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                Từ chối tất
              </button>
              <button
                onClick={addNote}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                Ghi chú
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {actionLog.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-stone-400">{item.time}</div>
                </div>
                <div className="mt-2 text-sm text-stone-300">{item.desc}</div>
                <button
                  onClick={() => undoLog(item.id)}
                  className="mt-3 rounded-full border border-white/10 px-3 py-1 text-[11px]"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
</div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        {data.insightRow.map((item) => (
          <button key={item.id} onClick={() => selectInsight(item.id)} className="w-full text-left">
            <Panel
              className={`p-4 transition ${softToneClass(item.tone)} ${
                selectedInsightId === item.id ? "ring-2 ring-neutral-900/10" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-[16px] font-medium tracking-tight">{item.title}</h3>
                <Badge tone={item.tone}>{item.badge}</Badge>
              </div>
              <p className="mt-3 text-sm text-neutral-600">{item.desc}</p>
            </Panel>
          </button>
        ))}
      </div>

      <Panel className="p-4 md:p-5">
        <SectionEyebrow>War Room</SectionEyebrow>
        <h2 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
          Tình trạng realtime hôm nay
        </h2>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { id: "realtime", label: "Realtime" },
            { id: "7days", label: "So với 7 ngày" },
            { id: "forecast", label: "Forecast tồn kho" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setWarRoomTab(item.id as WarRoomTab)}
              className={`rounded-full border px-4 py-2 text-sm ${
                warRoomTab === item.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-[24px] bg-neutral-50 p-5">
            <p className="text-sm text-neutral-500">So với hôm qua</p>
            <p className="mt-4 text-[32px] font-semibold tracking-tight xl:text-[40px]">
              {warRoomTab === "7days" ? "-3.1M" : warRoomTab === "forecast" ? "4 SKU" : data.realtime.delta}
            </p>
            <p
              className={`mt-3 text-sm font-medium ${metricTone(
                warRoomTab === "7days" ? "-6.1%" : warRoomTab === "forecast" ? "+2.0%" : data.realtime.deltaPct
              )}`}
            >
              {warRoomTab === "7days" ? "-6.1%" : warRoomTab === "forecast" ? "+2.0%" : data.realtime.deltaPct}
            </p>
          </div>

          <div className="rounded-[24px] border border-rose-200 bg-rose-50/40 p-5">
            <p className="text-sm text-neutral-500">
              {warRoomTab === "forecast" ? "Forecast tồn kho" : "Checkout → Purchase"}
            </p>
            <p className="mt-4 text-[32px] font-semibold tracking-tight xl:text-[40px]">
              {warRoomTab === "forecast" ? "3 ngày" : warRoomTab === "7days" ? "31.4%" : data.realtime.checkoutPurchase}
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              {warRoomTab === "forecast"
                ? "SKU gần chạm ngưỡng"
                : warRoomTab === "7days"
                ? "Trung bình 7 ngày"
                : data.realtime.chokeLabel}
            </p>
          </div>

          <div className="rounded-[24px] bg-neutral-50 p-5">
            <p className="text-sm text-neutral-500">Sắp hết hàng</p>
            <div className="mt-4 space-y-3 text-[15px] font-medium text-neutral-700">
              {(warRoomTab === "forecast"
                ? ["QS794 Palm • 3 ngày", "SM902 Rêu Đen • 2 ngày", "Vintage Olive Tee • 4 ngày"]
                : data.realtime.lowStock
              ).map((row) => (
                <div key={row}>{row}</div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {data.kpis.map((item) => (
          <Panel key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-neutral-500">{item.label}</p>
              <Badge tone="muted">{item.delta}</Badge>
            </div>
            <p className="mt-4 text-[28px] font-semibold tracking-tight xl:text-[34px]">{item.value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel className="overflow-hidden p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
                  Doanh thu từng ngày trong tháng
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Mở ra là thấy ngay hôm nay, hôm qua và các ngày gần nhất bán được bao nhiêu
                </p>
              </div>
              <Badge tone="muted">Tháng 03</Badge>
            </div>

            <div className="mt-4 overflow-x-auto rounded-[24px] border border-neutral-200">
              <table className="min-w-[920px] w-full text-left">
                <thead className="bg-neutral-950 text-sm text-white">
                  <tr>
                    <th className="px-4 py-4 font-medium">Ngày</th>
                    <th className="px-4 py-4 font-medium">Ghi chú</th>
                    <th className="px-4 py-4 font-medium">Doanh thu</th>
                    <th className="px-4 py-4 font-medium">Lợi nhuận</th>
                    <th className="px-4 py-4 font-medium">Đơn</th>
                    <th className="px-4 py-4 font-medium">ROAS</th>
                    <th className="px-4 py-4 text-right font-medium">So với hôm qua</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyRows.map((row) => (
                    <tr
                      key={row.day}
                      onClick={() => setSelectedDay(row.day)}
                      className={`border-t border-neutral-200 text-sm cursor-pointer ${
                        selectedDay === row.day ? "bg-neutral-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4 font-medium">{row.day}</td>
                      <td className="px-4 py-4">
                        <Badge tone={row.isToday ? "dark" : "muted"}>{row.note}</Badge>
                      </td>
                      <td className="px-4 py-4">{row.revenue}</td>
                      <td className="px-4 py-4">{row.profit}</td>
                      <td className="px-4 py-4">{row.orders}</td>
                      <td className="px-4 py-4">{row.roas}</td>
                      <td
                        className={`px-4 py-4 text-right font-medium ${
                          row.positive ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {row.compare}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-[24px] border border-neutral-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionEyebrow>Drill-down ngày {selectedDay}</SectionEyebrow>
                  <h3 className="mt-4 font-serif text-[24px] font-medium tracking-tight xl:text-[30px]">
                    Chi tiết vận hành trong ngày
                  </h3>
                </div>
                <button className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600">
                  Đóng chi tiết
                </button>
              </div>

              <div className="mt-2 text-sm text-neutral-500">
                Đang xem: {selectedDailyRow.note} · Doanh thu {selectedDailyRow.revenue} · Lợi nhuận{" "}
                {selectedDailyRow.profit}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {data.drilldown.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-[24px] p-5 ${
                      item.tone === "dark"
                        ? "bg-neutral-950 text-white"
                        : item.tone === "mint"
                        ? "bg-emerald-100 text-emerald-900"
                        : "border border-neutral-200 bg-white"
                    }`}
                  >
                    <p className={`text-sm ${item.tone ? "opacity-80" : "text-neutral-500"}`}>{item.label}</p>
                    <p className="mt-4 text-[34px] font-semibold tracking-tight">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel className="p-5">
              <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">Top sản phẩm</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Đang chọn: {selectedProduct?.name || "Chưa có sản phẩm"}
              </p>
              <p className="mt-2 text-sm text-neutral-500">Những SKU đang kéo doanh thu mạnh nhất</p>

              <div className="mt-5 space-y-3">
                {(data.topProducts || []).map((item) => (
                  <button
                    key={item.rank}
                    onClick={() => setSelectedProductRank(item.rank)}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left ${
                      selectedProductRank === item.rank ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-sm font-medium text-white">
                        {item.rank}
                      </div>
                      <div>
                        <p className="text-[16px] font-medium tracking-tight">{item.name}</p>
                        <p className="mt-1 text-sm text-neutral-500">{item.meta}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-500">{item.qty}</p>
                      <p className="mt-1 text-[16px] font-semibold">{item.revenue}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Doanh thu theo kênh
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Nhìn nhanh website, Facebook, TikTok, Shopify checkout
              </p>

              <div className="mt-6 space-y-5">
                {data.channelRevenue
                  .filter((item) => selectedChannel === "Tất cả kênh" || item.name === selectedChannel)
                  .map((item) => (
                    <div key={item.name}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span>{item.name}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-4 rounded-full bg-neutral-100">
                        <div className="h-4 rounded-full bg-neutral-950" style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.8fr_0.9fr]">
            <Panel className="p-5">
              <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Kho & phân bổ tồn
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Theo từng kho để nhập hàng và điều chuyển cho chuẩn
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {data.warehouseMix.map((item) => (
                  <div key={item.name} className="rounded-[24px] bg-neutral-50 p-5 text-center">
                    <p className="text-sm text-neutral-500">{item.name}</p>
                    <p className="mt-4 text-[34px] font-semibold tracking-tight">{item.value}</p>
                    <p className="mt-2 text-sm text-neutral-500">{item.note}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="bg-[#171312] p-5 text-white">
              <SectionEyebrow>Quick Insight</SectionEyebrow>
              <h2 className="mt-3 font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Điểm cần chú ý hôm nay
              </h2>

              <div className="mt-6 space-y-3">
                {data.quickInsights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-neutral-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">Funnel</h2>
            <p className="mt-2 text-sm text-neutral-500">Từ traffic tới purchase</p>

            <div className="mt-6 space-y-5">
              {data.funnel.map((step) => (
                <div key={step.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span>{step.label}</span>
                    <span>{step.value}</span>
                  </div>
                  <div className="h-4 rounded-full bg-neutral-100">
                    <div className="h-4 rounded-full bg-neutral-950" style={{ width: step.width }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
              Money Flow Insight
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Tiền đang chảy ở đâu, kênh nào đang đốt mạnh hơn phần doanh thu mang về.
            </p>

            <div className="mt-5 space-y-3">
              {data.moneyFlow.map((item) => (
                <button
                  key={item.channel}
                  onClick={() => setSelectedMoneyFlowChannel(item.channel)}
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selectedMoneyFlowChannel === item.channel ? "ring-2 ring-neutral-900/10" : ""
                  } ${
                    item.tone === "green"
                      ? "border-emerald-200 bg-emerald-50/45"
                      : item.tone === "red"
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-amber-200 bg-amber-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-[16px] font-medium tracking-tight">{item.channel}</h3>
                    <Badge tone={item.tone === "green" ? "safe" : item.tone === "red" ? "critical" : "warning"}>
                      {item.badge}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-neutral-600">{item.text}</p>
                </button>
              ))}

              <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
                Đang focus: {selectedMoneyFlow.channel}.
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {approvalOpen && !selectedDecision ? (
        <div className="fixed bottom-5 right-5 z-40 w-[320px] rounded-[28px] bg-[#171312] p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionEyebrow>Approval</SectionEyebrow>
              <p className="mt-1 text-sm text-neutral-300">{data.floatingApproval.count}</p>
            </div>

            <div className="flex gap-2">
              <Badge tone="muted">Duyệt tất</Badge>
              <button onClick={() => setApprovalOpen(false)} className="text-sm text-neutral-400">
                Ẩn
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-[18px] font-medium tracking-tight">
              {selectedDecision?.title || data.floatingApproval.title}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              {selectedDecision?.id ? selectedDecision.id : data.floatingApproval.subtitle}
            </p>
            <p
              className={`mt-2 text-xs ${
                approvalStatus === "approved"
                  ? "text-emerald-400"
                  : approvalStatus === "rejected"
                  ? "text-rose-400"
                  : "text-neutral-400"
              }`}
            >
              {approvalStatus === "approved"
                ? "Đã duyệt"
                : approvalStatus === "rejected"
                ? "Đã từ chối"
                : "Đang chờ duyệt"}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={approveCurrentDecision}
                className="rounded-full bg-white px-4 py-3 text-sm font-medium text-neutral-900"
              >
                Duyệt
              </button>
              <button
                onClick={rejectCurrentDecision}
                className="rounded-full border border-white/15 px-4 py-3 text-sm font-medium text-white"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}