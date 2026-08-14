"use client";

import React, { useEffect, useMemo, useState } from "react";

export type AutomationLevel = "manual" | "semi" | "auto";

export type AdsMapping = {
  id: string;
  sku: string;
  productName: string;
  campaignName: string;
  campaignId: string;
  adsetName: string;
  adsetId: string;
  channel: string;
  status: string;
  spendToday: number;
  revenueToday: number;
  roasToday: number;
  budgetDaily: number;
  lastAction?: string;
};

export type DecisionLog = {
  id: string;
  time: string;
  sku: string;
  decision: string;
  reason: string;
  action: "applied" | "suggested" | "preview" | "rollback";
  rollbackBudget?: number;
  nextBudget?: number;
};

export type LiveAlert = {
  id: string;
  level: "good" | "high" | "critical";
  title: string;
  desc: string;
};

export type LiveAdControlRow = {
  id: string;
  metaAdId: string;
  adName: string;
  campaignName: string;
  campaignId: string;
  adSetName: string;
  adSetId: string;
  status?: string | null;
  effectiveStatus?: string | null;
  thumbnailUrl?: string | null;
  spend: number;
  revenue: number;
  roas: number;
  budgetDaily: number;
  budgetLevel?: "ADSET" | "CAMPAIGN" | null;
  budgetEntityId?: string | null;
  canScale: boolean;
  scaleReasons?: string[];
  spend24h?: number;
  revenue24h?: number;
  roas24h?: number;
  orderCount24h?: number;
  runHours?: number;
  autoScaleEligible?: boolean;
  autoScaleReasons?: string[];
  nextScaleAt?: string | null;
  productAttribution?: any;
  inventory?: any;
};

export type ScaleHistoryItem = {
  id: string;
  at: string | null;
  metaAdId?: string | null;
  metaAdSetId?: string | null;
  metaCampaignId?: string | null;
  budgetLevel: "ADSET" | "CAMPAIGN";
  budgetEntityId?: string | null;
  source: string;
  percent: number;
  oldBudget: number;
  newBudget: number;
  roas?: number | null;
  spend?: number | null;
};

export type AutopilotPageProps = {
  mappings: AdsMapping[];
  setMappings: React.Dispatch<React.SetStateAction<AdsMapping[]>>;
  pushActivity?: (message: string) => void;
  apiBaseUrl?: string;
  defaultAccountId?: string;
  defaultDryRun?: boolean;
  defaultAutomationLevel?: AutomationLevel;
};

const currency = (n: number) => new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
const compactMoney = (n: number) => `${Math.round((Number(n || 0) || 0) / 1000)}k`;
const formatDate = () => new Date().toLocaleString("vi-VN");

function toneForStatus(value: string) {
  if (["ACTIVE", "CONFIRMED", "FULFILLED", "PAID", "COMPLETED", "CONNECTED"].includes(value)) return "green";
  if (["AWAITING_PAYMENT", "PENDING", "PENDING_COD", "PROCESSING", "IN_PROGRESS"].includes(value)) return "amber";
  if (["CANCELLED", "FAILED", "INACTIVE", "NEEDS_MAPPING"].includes(value)) return "red";
  return "gray";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>;
}

function Badge({ children, tone = "gray", className = "" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue"; className?: string }) {
  const styles = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-600",
    green: "border-emerald-200 bg-emerald-50 text-emerald-600",
    amber: "border-amber-200 bg-amber-50 text-amber-600",
    red: "border-rose-200 bg-rose-50 text-rose-500",
    blue: "border-blue-200 bg-blue-50 text-blue-600",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tone]} ${className}`}>{children}</span>;
}

function StatCard({ title, value, sub }: { title: string; value: React.ReactNode; sub: string }) {
  return (
    <Panel>
      <div className="p-4">
        <div className="text-[12px] text-neutral-400">{title}</div>
        <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-neutral-900">{value}</div>
        <div className="mt-1 text-[11px] text-neutral-400">{sub}</div>
      </div>
    </Panel>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "soft";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800",
    secondary: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
    soft: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[14px] px-4 py-2 text-[12px] font-medium transition ${styles[variant]} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export default function AutopilotPage({
  mappings,
  setMappings,
  pushActivity = () => {},
  apiBaseUrl = "https://the1970-core-api-production.up.railway.app",
  defaultAccountId = "act_123456789",
  defaultDryRun = true,
  defaultAutomationLevel = "manual",
}: AutopilotPageProps) {
  const [automationLevel, setAutomationLevel] = useState<AutomationLevel>(defaultAutomationLevel);
  const [metaConnected, setMetaConnected] = useState(false);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [dryRun, setDryRun] = useState(defaultDryRun);
  const [performanceEnabled, setPerformanceEnabled] = useState(false);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [scaleRoas, setScaleRoas] = useState(3);
  const [scalePercent, setScalePercent] = useState(20);
  const [minSpend, setMinSpend] = useState(200000);
  const [cooldownMinutes, setCooldownMinutes] = useState(1440);
  const [maxScalePerDay, setMaxScalePerDay] = useState(1);
  const [exactRolling24h, setExactRolling24h] = useState(true);
  const [rolling24hFallbackReason, setRolling24hFallbackReason] = useState("");
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [inventoryStatus, setInventoryStatus] = useState<any>(null);
  const [backendBusy, setBackendBusy] = useState(false);
  const [liveAds, setLiveAds] = useState<LiveAdControlRow[]>([]);
  const [scalePreviews, setScalePreviews] = useState<Record<string, {
    oldBudget: number;
    newBudget: number;
    percent: number;
    budgetLevel: "ADSET" | "CAMPAIGN" | null;
    budgetEntityId: string | null;
    dryRun: boolean;
    at: string;
  }>>({});
  const [scaleHistory, setScaleHistory] = useState<ScaleHistoryItem[]>([]);
  const [scaleCountByEntity, setScaleCountByEntity] = useState<Record<string, number>>({});
  const [historyPopupAdId, setHistoryPopupAdId] = useState<string | null>(null);
  const [adsBusy, setAdsBusy] = useState(false);
  const [adFilter, setAdFilter] = useState<"all" | "active" | "paused" | "scale" | "stock">("active");
  const selectedMappingId = mappings[0]?.id || "";
  const [executionOutput, setExecutionOutput] = useState("Chưa chạy execute nào.");
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);

  const selectedMapping = useMemo(() => mappings.find((m) => m.id === selectedMappingId) || mappings[0], [mappings, selectedMappingId]);
  const connectedCount = useMemo(() => liveAds.length || mappings.filter((m) => m.status === "CONNECTED").length, [liveAds, mappings]);
  const scaleCandidates = useMemo(() => liveAds.length ? liveAds.filter((m) => Boolean(m.autoScaleEligible ?? m.canScale)).length : mappings.filter((m) => m.status === "CONNECTED" && m.roasToday >= scaleRoas).length, [liveAds, mappings, scaleRoas]);
  const weakCandidates = useMemo(() => liveAds.length ? liveAds.filter((m) => m.inventory?.groups?.some((g: any) => (g.criticalSizes || []).length > 0)).length : mappings.filter((m) => m.status === "CONNECTED" && m.roasToday < 1.8).length, [liveAds, mappings]);

  const filteredLiveAds = useMemo(() => liveAds.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toUpperCase();
    if (adFilter === "active") return status === "ACTIVE";
    if (adFilter === "paused") return status === "PAUSED";
    if (adFilter === "scale") return Boolean(row.autoScaleEligible ?? row.canScale);
    if (adFilter === "stock") return row.inventory?.groups?.some((g: any) => (g.lowSizes || []).length > 0);
    return true;
  }), [liveAds, adFilter]);



  const apiJson = async (path: string, init?: RequestInit, timeoutMs = 15000) => {
    const auth = typeof window !== "undefined" ? localStorage.getItem("access_token") || localStorage.getItem("token") || "" : "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          ...(init?.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || JSON.stringify(data) || `HTTP ${res.status}`);
      return data;
    } catch (error: any) {
      if (error?.name === "AbortError") throw new Error(`API timeout ${Math.round(timeoutMs / 1000)}s: ${path}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const normalizeLiveAd = (ad: any): LiveAdControlRow => {
    const groups = Array.isArray(ad?.inventory?.groups)
      ? ad.inventory.groups
      : Array.isArray(ad?.stockGroups)
        ? ad.stockGroups
        : Array.isArray(ad?.sizes) && ad?.stockLevel && ad?.stockLevel !== "UNMAPPED"
          ? [{
              colorKey: ad?.sku || ad?.familySku || ad?.productName || ad?.adName || "",
              sizes: ad.sizes,
              lowSizes: ad.sizes.filter((x: any) => Number(x?.qty || 0) < 10).map((x: any) => x?.size),
              criticalSizes: ad.sizes.filter((x: any) => Number(x?.qty || 0) < 5).map((x: any) => x?.size),
            }]
          : [];

    const spend24h = Number(ad?.spend24h ?? ad?.spend ?? ad?.metrics?.spend ?? 0) || 0;
    const revenue24h = Number(ad?.revenue24h ?? ad?.revenue ?? ad?.productAttribution?.revenue ?? ad?.productAttribution?.orderRevenue ?? 0) || 0;
    const roas24h = Number(ad?.roas24h ?? ad?.roas ?? (spend24h > 0 ? revenue24h / spend24h : 0)) || 0;
    const scaleReasons = Array.isArray(ad?.autoScaleReasons)
      ? ad.autoScaleReasons
      : Array.isArray(ad?.scaleReasons)
        ? ad.scaleReasons
        : [];

    return {
      id: String(ad?.metaAdId || ad?.id || ""),
      metaAdId: String(ad?.metaAdId || ad?.id || ""),
      adName: String(ad?.adName || ad?.name || ""),
      campaignName: String(ad?.campaignName || ""),
      campaignId: String(ad?.metaCampaignId || ad?.campaignId || ""),
      adSetName: String(ad?.adSetName || ""),
      adSetId: String(ad?.metaAdSetId || ad?.adSetId || ""),
      status: ad?.status || null,
      effectiveStatus: ad?.effectiveStatus || ad?.status || null,
      thumbnailUrl: ad?.thumbnailUrl || ad?.imageUrl || null,
      spend: spend24h,
      revenue: revenue24h,
      roas: roas24h,
      spend24h,
      revenue24h,
      roas24h,
      orderCount24h: Number(ad?.orderCount24h || ad?.productAttribution?.orderCount || 0) || 0,
      runHours: Number(ad?.runHours || 0) || 0,
      budgetDaily: Number(ad?.budgetDaily ?? ad?.adSetDailyBudget ?? ad?.campaignDailyBudget ?? ad?.dailyBudget ?? ad?.daily_budget ?? 0) || 0,
      budgetLevel: (ad?.budgetLevel || (Number(ad?.adSetDailyBudget || 0) > 0 ? "ADSET" : Number(ad?.campaignDailyBudget || 0) > 0 ? "CAMPAIGN" : null)) as "ADSET" | "CAMPAIGN" | null,
      budgetEntityId: String(ad?.budgetEntityId || (Number(ad?.adSetDailyBudget || 0) > 0 ? (ad?.metaAdSetId || ad?.adSetId || "") : Number(ad?.campaignDailyBudget || 0) > 0 ? (ad?.metaCampaignId || ad?.campaignId || "") : "")) || null,
      canScale: Boolean(ad?.autoScaleEligible ?? ad?.canScale),
      autoScaleEligible: Boolean(ad?.autoScaleEligible ?? ad?.canScale),
      scaleReasons,
      autoScaleReasons: scaleReasons,
      nextScaleAt: ad?.nextScaleAt || null,
      productAttribution: ad?.productAttribution || (ad?.sku || ad?.familySku || ad?.productName ? {
        sku: ad?.sku || null,
        familySku: ad?.familySku || ad?.sku || null,
        productName: ad?.productName || null,
        confidence: ad?.attributionConfidence || 0,
        allocationMode: ad?.allocationMode || null,
      } : null),
      inventory: groups.length ? {
        groups,
        safe: ad?.stockSafe ?? !groups.some((g: any) => (g.lowSizes || []).length > 0),
        level: ad?.stockLevel || null,
        reason: ad?.stockReason || null,
      } : null,
    };
  };

  const enrichRowsWithBudgets = async (rows: LiveAdControlRow[]) => {
    if (!rows.length) return rows;
    const metaAdSetIds = Array.from(new Set(rows.map((row) => String(row.adSetId || '')).filter(Boolean)));
    const metaCampaignIds = Array.from(new Set(rows.map((row) => String(row.campaignId || '')).filter(Boolean)));
    if (!metaAdSetIds.length && !metaCampaignIds.length) return rows;

    try {
      const snapshot = await apiJson('/meta-ads/autopilot/budgets', {
        method: 'POST',
        body: JSON.stringify({ metaAdSetIds, metaCampaignIds }),
      }, 20000);
      const adSetMap = new Map((snapshot?.adSets || []).map((item: any) => [String(item.metaAdSetId || ''), item]));
      const campaignMap = new Map((snapshot?.campaigns || []).map((item: any) => [String(item.metaCampaignId || ''), item]));

      return rows.map((row) => {
        const adSet = adSetMap.get(String(row.adSetId || '')) as any;
        const campaignId = String(row.campaignId || adSet?.metaCampaignId || '');
        const campaign = campaignMap.get(campaignId) as any;
        const adSetBudget = Number(adSet?.dailyBudget || 0);
        const campaignBudget = Number(campaign?.dailyBudget || 0);
        if (adSetBudget > 0) {
          return { ...row, campaignId: campaignId || row.campaignId, budgetDaily: adSetBudget, budgetLevel: 'ADSET' as const, budgetEntityId: row.adSetId };
        }
        if (campaignBudget > 0) {
          return { ...row, campaignId: campaignId || row.campaignId, budgetDaily: campaignBudget, budgetLevel: 'CAMPAIGN' as const, budgetEntityId: campaignId };
        }
        return row;
      });
    } catch (error) {
      setExecutionOutput(`Không tải được ngân sách Meta: ${String(error)}`);
      return rows;
    }
  };

  const buildAlertsFromRows = (rows: LiveAdControlRow[]) => {
    const alerts: LiveAlert[] = [];
    for (const row of rows) {
      const groups = row?.inventory?.groups || [];
      const critical = groups.filter((g: any) => (g.criticalSizes || []).length > 0);
      const low = groups.filter((g: any) => (g.lowSizes || []).length > 0 && !(g.criticalSizes || []).length);
      if (critical.length) {
        alerts.push({
          id: `stock-${row.metaAdId}`,
          level: "critical",
          title: `${row.productAttribution?.familySku || row.adName} cần pause`,
          desc: critical.map((g: any) => `${g.colorKey}: ${g.criticalSizes.join(", ")} dưới 5`).join(" · "),
        });
      } else if (row.autoScaleEligible ?? row.canScale) {
        alerts.push({
          id: `scale-${row.metaAdId}`,
          level: "good",
          title: `${row.productAttribution?.familySku || row.adName} đủ điều kiện scale`,
          desc: `ROAS 24h ${Number(row.roas24h ?? row.roas ?? 0).toFixed(2)} · Spend 24h ${currency(row.spend24h ?? row.spend ?? 0)} · tồn size an toàn.`,
        });
      } else if (low.length) {
        alerts.push({
          id: `low-${row.metaAdId}`,
          level: "high",
          title: `${row.productAttribution?.familySku || row.adName} sắp thiếu size`,
          desc: low.map((g: any) => `${g.colorKey}: ${g.lowSizes.join(", ")} dưới 10`).join(" · "),
        });
      }
    }
    setLiveAlerts(alerts.slice(0, 20));
  };

  const loadScaleHistory = async () => {
    try {
      const data = await apiJson('/meta-ads/autopilot/scale-history?limit=2000', undefined, 12000);
      setScaleHistory(Array.isArray(data?.items) ? data.items : []);
      setScaleCountByEntity(data?.countByEntity && typeof data.countByEntity === 'object' ? data.countByEntity : {});
    } catch (error) {
      // History không được làm hỏng bảng Ads nếu endpoint tạm lỗi.
      console.warn('Không tải được lịch sử scale', error);
    }
  };

  const historyForRow = (row: LiveAdControlRow) => {
    const entityId = String(row.budgetEntityId || (row.budgetLevel === 'CAMPAIGN' ? row.campaignId : row.adSetId) || '');
    return scaleHistory.filter((item) => {
      if (entityId && String(item.budgetEntityId || '') === entityId) return true;
      if (row.adSetId && String(item.metaAdSetId || '') === String(row.adSetId)) return true;
      if (row.campaignId && row.budgetLevel === 'CAMPAIGN' && String(item.metaCampaignId || '') === String(row.campaignId)) return true;
      return false;
    });
  };

  const scaleCountForRow = (row: LiveAdControlRow) => {
    const entityId = String(row.budgetEntityId || (row.budgetLevel === 'CAMPAIGN' ? row.campaignId : row.adSetId) || '');
    if (entityId && scaleCountByEntity[entityId] != null) return Number(scaleCountByEntity[entityId] || 0);
    return historyForRow(row).length;
  };

  const enrichRowsWithInventory = async (rows: LiveAdControlRow[]) => {
    if (!rows.length) return rows;
    try {
      const data = await apiJson("/meta-ads/autopilot/inventory/assess", {
        method: "POST",
        body: JSON.stringify({
          ads: rows.map((row) => ({
            metaAdId: row.metaAdId,
            id: row.metaAdId,
            name: row.adName,
            adName: row.adName,
            metaAdSetId: row.adSetId,
            adSetId: row.adSetId,
            adSetName: row.adSetName,
            metaCampaignId: row.campaignId,
            campaignId: row.campaignId,
            campaignName: row.campaignName,
            status: row.status,
            effectiveStatus: row.effectiveStatus,
          })),
        }),
      }, 20000);

      const checks = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.items) ? data.items : [];
      const byAd = new Map(checks.map((item: any) => [String(item?.metaAdId || item?.id || ""), item]));
      return rows.map((row) => {
        const check: any = byAd.get(String(row.metaAdId));
        if (!check) return row;
        const groups = Array.isArray(check?.groups) ? check.groups : [];
        return {
          ...row,
          inventory: {
            groups,
            safe: Boolean(check?.safe),
            level: check?.level || null,
            reason: check?.reason || null,
            matchScore: check?.matchScore ?? null,
            ambiguous: Boolean(check?.ambiguous),
          },
          productAttribution: row.productAttribution || (groups[0] ? {
            sku: groups[0]?.productCode || null,
            familySku: groups[0]?.colorKey || groups[0]?.productCode || null,
            productName: groups[0]?.productName || null,
            confidence: check?.matchScore || 0,
            allocationMode: "inventory_name_match",
          } : null),
        };
      });
    } catch (error) {
      setRolling24hFallbackReason((prev) => `${prev ? `${prev} · ` : ""}Inventory match lỗi: ${String(error)}`);
      return rows;
    }
  };

  const loadControlCenter = async () => {
    setAdsBusy(true);
    setRolling24hFallbackReason("");

    let baseRows: LiveAdControlRow[] = [];
    let structureError: any = null;

    // 1) Ưu tiên tải structure trước để bảng hiện ads ngay, không chờ rolling-24h + attribution.
    try {
      const rawAds = await apiJson("/meta-ads/autopilot/live-ads?limit=5000", undefined, 12000);
      const sourceRows = Array.isArray(rawAds) ? rawAds : Array.isArray(rawAds?.rows) ? rawAds.rows : Array.isArray(rawAds?.ads) ? rawAds.ads : [];
      baseRows = sourceRows.map(normalizeLiveAd);
      setLiveAds(baseRows);
      buildAlertsFromRows(baseRows);
      setExactRolling24h(false);
      if (baseRows.length) setAdsBusy(false);

      // Budget phải hiện ngay trên list, không chờ người dùng bấm Scale.
      if (baseRows.length) {
        const withBudget = await enrichRowsWithBudgets(baseRows);
        const withInventory = await enrichRowsWithInventory(withBudget);
        baseRows = withInventory;
        setLiveAds(withInventory);
        buildAlertsFromRows(withInventory);
      }
    } catch (error) {
      structureError = error;
    }

    // 2) Sau đó mới enrich metrics 24h / attribution / tồn kho. Endpoint này có timeout riêng.
    try {
      const data = await apiJson("/meta-ads/autopilot/control-center", undefined, 30000);
      const rawRows = Array.isArray(data?.ads) ? data.ads : Array.isArray(data?.rows) ? data.rows : [];
      const normalizedRows = rawRows.map(normalizeLiveAd);
      const withBudget = normalizedRows.length ? await enrichRowsWithBudgets(normalizedRows) : normalizedRows;
      const enrichedRows = withBudget.length ? await enrichRowsWithInventory(withBudget) : withBudget;

      if (enrichedRows.length) {
        setLiveAds(enrichedRows);
        buildAlertsFromRows(enrichedRows);
      } else if (!baseRows.length) {
        throw new Error("Control Center trả về 0 ads");
      }

      setExactRolling24h(data?.exactRolling24h === true);
      setRolling24hFallbackReason(String(data?.fallbackReason || data?.rolling24hFallbackReason || ""));
      return;
    } catch (controlCenterError) {
      // Nếu structure đã tải được thì giữ bảng đó, không xóa ads chỉ vì phần metrics 24h lỗi/chậm.
      if (baseRows.length) {
        setExactRolling24h(false);
        setRolling24hFallbackReason(`Đã tải Ads live; metrics rolling 24h chưa xong: ${String(controlCenterError)}`);
        return;
      }

      // 3) Fallback cuối cùng: live-insights hôm nay, để không bao giờ treo màn hình loading vô hạn.
      try {
        const live = await apiJson("/meta-ads/live-insights?range=today&level=ad&limit=1000", undefined, 15000);
        const sourceRows = Array.isArray(live?.topAds) ? live.topAds : [];
        const fallbackRows = sourceRows.map(normalizeLiveAd);
        const fallbackRowsWithBudget = await enrichRowsWithBudgets(fallbackRows);
        const fallbackRowsWithInventory = await enrichRowsWithInventory(fallbackRowsWithBudget);
        setLiveAds(fallbackRowsWithInventory);
        buildAlertsFromRows(fallbackRowsWithInventory);
        setExactRolling24h(false);
        setRolling24hFallbackReason(`Fallback live-insights. Structure lỗi: ${String(structureError)} · Control Center lỗi: ${String(controlCenterError)}`);
      } catch (fallbackError) {
        setLiveAds([]);
        setExecutionOutput(`Không tải được Ads Meta. live-ads: ${String(structureError)} | control-center: ${String(controlCenterError)} | live-insights: ${String(fallbackError)}`);
      }
    } finally {
      setAdsBusy(false);
    }
  };

  const loadBackendStatus = async () => {
    setBackendBusy(true);
    try {
      const [perf, inv] = await Promise.all([
        apiJson("/meta-ads/autopilot/performance/status"),
        apiJson("/meta-ads/autopilot/inventory/status"),
      ]);
      setBackendStatus(perf);
      setInventoryStatus(inv);
      setPerformanceEnabled(Boolean(perf?.enabled));
      setInventoryEnabled(Boolean(inv?.enabled));
      setDryRun(Boolean(perf?.dryRun));
      setAutomationLevel((perf?.level || defaultAutomationLevel) as AutomationLevel);
      setScaleRoas(Number(perf?.scaleRoas || 3));
      setScalePercent(Number(perf?.scalePercent || 20));
      setMinSpend(Number(perf?.minSpend || 200000));
      setCooldownMinutes(Number(perf?.scaleWindowHours || perf?.minRunHours || 24) * 60);
      setMaxScalePerDay(Number(perf?.maxScalePerAdSetPer24h || 1));
    } catch (error) {
      setExecutionOutput(`Không tải được Autopilot backend: ${String(error)}`);
    } finally {
      setBackendBusy(false);
    }
  };

  useEffect(() => {
    void loadBackendStatus();
    void loadControlCenter();
    void loadScaleHistory();
    void connectMeta();
  }, []);

  const connectMeta = async () => {
    try {
      const data = await apiJson("/meta-ads/test");
      const first = data?.data?.[0];
      setMetaConnected(true);
      if (first?.id) setAccountId(first.id);
      pushActivity(`Meta Ads backend đã kết nối${first?.id ? ` ${first.id}` : ""}.`);
    } catch (error) {
      setMetaConnected(false);
      setExecutionOutput(`Meta connection lỗi: ${String(error)}`);
    }
  };

  const saveAutomationConfig = async (patch: Record<string, any> = {}) => {
    setBackendBusy(true);
    try {
      const next = await apiJson("/meta-ads/autopilot/performance/config", {
        method: "POST",
        body: JSON.stringify({
          enabled: performanceEnabled,
          dryRun,
          level: automationLevel,
          scaleRoas,
          scalePercent,
          minSpend,
          ...patch,
        }),
      });
      setBackendStatus(next);
      if (typeof next?.enabled === "boolean") setPerformanceEnabled(next.enabled);
      if (next?.level) setAutomationLevel(next.level);
      pushActivity("Đã cập nhật rule Auto Scale trên backend.");
      return next;
    } finally {
      setBackendBusy(false);
    }
  };

  const saveInventoryConfig = async (enabled: boolean) => {
    setBackendBusy(true);
    try {
      const next = await apiJson("/meta-ads/autopilot/inventory/config", {
        method: "POST",
        body: JSON.stringify({ enabled, dryRun }),
      });
      setInventoryStatus(next);
      setInventoryEnabled(Boolean(next?.enabled));
      pushActivity(`Auto pause tồn kho: ${next?.enabled ? "BẬT" : "TẮT"}.`);
    } finally {
      setBackendBusy(false);
    }
  };

  const logDecision = (
    mapping: AdsMapping,
    decision: string,
    reason: string,
    action: DecisionLog["action"],
    nextBudget?: number,
    rollbackBudget?: number
  ) => {
    setDecisionLogs((prev) => [
      {
        id: `d-${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        sku: mapping.sku,
        decision,
        reason,
        action,
        nextBudget,
        rollbackBudget,
      },
      ...prev,
    ]);
  };

  const rollbackDecision = (logId: string) => {
    const item = decisionLogs.find((log) => log.id === logId);
    if (!item) return;
    const target = mappings.find((m) => m.sku === item.sku);
    if (!target) return;

    setMappings((prev) =>
      prev.map((m) =>
        m.id === target.id
          ? {
              ...m,
              budgetDaily: item.rollbackBudget || m.budgetDaily,
              lastAction: "Rollback 1 click",
            }
          : m
      )
    );

    logDecision(target, `Rollback ${item.decision}`, "Khôi phục về mức trước thay đổi.", "rollback", item.rollbackBudget, item.nextBudget);
    pushActivity(`Autopilot: rollback cho ${item.sku}.`);
  };

  const runAutoDecision = async () => {
    if (automationLevel === "manual" && !performanceEnabled) return;
    setBackendBusy(true);
    try {
      await saveAutomationConfig();
      const data = await apiJson("/meta-ads/autopilot/performance/run", {
        method: "POST",
        body: JSON.stringify({ dryRun }),
      });
      setExecutionOutput(JSON.stringify(data, null, 2));
      await loadBackendStatus();
      pushActivity(`Performance Autopilot: quét ${data?.scannedAdSets || 0} ad set, scale ${data?.scaled || 0}.`);
    } catch (error) {
      setExecutionOutput(String(error));
    } finally {
      setBackendBusy(false);
    }
  };

  const setLiveAdStatus = async (row: LiveAdControlRow, nextStatus: "ACTIVE" | "PAUSED") => {
    setBackendBusy(true);
    try {
      const data = await apiJson("/meta-ads/actions/ad-status", {
        method: "POST",
        body: JSON.stringify({ metaAdId: row.metaAdId, status: nextStatus }),
      });
      setExecutionOutput(JSON.stringify(data, null, 2));
      pushActivity(`Meta Ad ${row.adName}: ${nextStatus}.`);
      await loadControlCenter();
    } catch (error) {
      setExecutionOutput(String(error));
    } finally {
      setBackendBusy(false);
    }
  };

  const scaleLiveAdSet = async (row: LiveAdControlRow, percent: number) => {
    if (!row.adSetId) return;
    const safePercent = Math.min(50, Math.max(1, Number(percent || 0)));
    setBackendBusy(true);
    try {
      const data = await apiJson("/meta-ads/actions/scale-adset", {
        method: "POST",
        body: JSON.stringify({
          metaAdSetId: row.adSetId,
          metaAdId: row.metaAdId,
          percent: safePercent,
          dryRun,
        }),
      });
      setExecutionOutput(JSON.stringify(data, null, 2));

      if (Number(data?.oldBudget || 0) > 0 && Number(data?.newBudget || 0) > 0) {
        setScalePreviews((prev) => ({
          ...prev,
          [row.metaAdId]: {
            oldBudget: Number(data.oldBudget),
            newBudget: Number(data.newBudget),
            percent: Number(data.percent || safePercent),
            budgetLevel: (data?.budgetLevel || row.budgetLevel || null) as "ADSET" | "CAMPAIGN" | null,
            budgetEntityId: String(data?.budgetEntityId || row.budgetEntityId || "") || null,
            dryRun: Boolean(data?.dryRun),
            at: new Date().toISOString(),
          },
        }));
      }

      pushActivity(`${dryRun ? "DRY RUN" : "LIVE"}: scale ${row.adSetName || row.adSetId} +${safePercent}%.`);
      await Promise.all([loadControlCenter(), loadBackendStatus(), loadScaleHistory()]);
    } catch (error) {
      setExecutionOutput(String(error));
    } finally {
      setBackendBusy(false);
    }
  };

  const saveDryRunConfig = async (nextDryRun: boolean) => {
    setDryRun(nextDryRun);
    try {
      await Promise.all([
        apiJson("/meta-ads/autopilot/performance/config", {
          method: "POST",
          body: JSON.stringify({ dryRun: nextDryRun }),
        }),
        apiJson("/meta-ads/autopilot/inventory/config", {
          method: "POST",
          body: JSON.stringify({ enabled: inventoryEnabled, dryRun: nextDryRun }),
        }),
      ]);
      pushActivity(`Autopilot DRY RUN: ${nextDryRun ? "BẬT" : "TẮT"}.`);
      await loadBackendStatus();
    } catch (error) {
      setExecutionOutput(`Không đồng bộ được DRY RUN: ${String(error)}`);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[14px] font-semibold text-neutral-900">Autopilot</h2>
        <p className="mt-1 text-[12px] text-neutral-400">Trung tâm điều khiển Ads: Auto Scale theo rolling 24 giờ + Auto Pause ad con theo tồn kho.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Meta connection" value={metaConnected ? "Connected" : "Not connected"} sub={metaConnected ? accountId : "Cần token + ad account"} />
        <StatCard title="Automation level" value={automationLevel.toUpperCase()} sub={`Mức ${automationLevel === "manual" ? "1" : automationLevel === "semi" ? "2" : "3"} / 3`} />
        <StatCard title="SKU đã map" value={connectedCount} sub="Connected to Meta" />
        <StatCard title="Nên scale" value={scaleCandidates} sub={`ROAS 24h >= ${scaleRoas}`} />
        <StatCard title="Thiếu size critical" value={weakCandidates} sub="Có size dưới 5" />
      </div>


      <Panel>
        <div className="p-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-neutral-900">Auto Scale theo rolling 24 giờ</h3>
                  <p className="mt-1 text-[12px] text-neutral-500">Đủ điều kiện ROAS · tồn size an toàn · chưa chạm cooldown → tăng đúng cấp Budget (Campaign hoặc Ad Set).</p>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-neutral-600">
                  <input type="checkbox" checked={performanceEnabled} onChange={(e) => { const enabled = e.target.checked; setPerformanceEnabled(enabled); void saveAutomationConfig({ enabled }); }} />
                  {performanceEnabled ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <label className="text-[11px] text-neutral-500">ROAS 24h scale
                  <input type="number" step="0.1" value={scaleRoas} onChange={(e) => setScaleRoas(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Tăng mỗi lần %
                  <input type="number" value={scalePercent} onChange={(e) => setScalePercent(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Spend tối thiểu
                  <input type="number" value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Chu kỳ scale (phút)
                  <div className="mt-1 flex h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[12px] font-medium text-neutral-700">1440 · cố định 24h</div>
                </label>
                <label className="text-[11px] text-neutral-500">Max scale / 24h
                  <div className="mt-1 flex h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[12px] font-medium text-neutral-700">1 lần / 24h</div>
                </label>
              </div>
            </div>
            <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-neutral-800">Auto Pause theo tồn kho</div>
                <label className="flex items-center gap-2 text-[12px] text-neutral-600">
                  <input type="checkbox" checked={inventoryEnabled} onChange={(e) => void saveInventoryConfig(e.target.checked)} />
                  {inventoryEnabled ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
              <div className="mt-2 text-[12px] text-neutral-500">Cảnh báo size &lt; {inventoryStatus?.warnThreshold ?? 10}. Size &lt; {inventoryStatus?.pauseThreshold ?? 5} sẽ pause đúng ad con của mã + màu.</div>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone={dryRun ? "amber" : "green"}>{dryRun ? "DRY RUN" : "LIVE"}</Badge>
                <label className="flex items-center gap-2 text-[11px] text-neutral-500"><input type="checkbox" checked={dryRun} onChange={(e) => void saveDryRunConfig(e.target.checked)} /> Test trước khi chạy thật</label>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold text-neutral-900">Ads đang chạy · Live Meta</h3>
              <p className="mt-1 text-[12px] text-neutral-400">Scale đúng cấp ngân sách Campaign/Ad Set · bật/tắt ở cấp Ad con · tồn kho theo đúng mã + màu.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "active", "paused", "scale", "stock"] as const).map((item) => (
                <button key={item} onClick={() => setAdFilter(item)} className={`rounded-full border px-3 py-1.5 text-[11px] ${adFilter === item ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600"}`}>
                  {item === "all" ? `Tất cả ${liveAds.length}` : item === "active" ? `ACTIVE ${liveAds.filter((x) => String(x.effectiveStatus || x.status || "").toUpperCase() === "ACTIVE").length}` : item === "paused" ? `PAUSED ${liveAds.filter((x) => String(x.effectiveStatus || x.status || "").toUpperCase() === "PAUSED").length}` : item === "scale" ? `Có thể scale ${liveAds.filter((x) => x.canScale).length}` : `Thiếu size ${liveAds.filter((x) => x.inventory?.groups?.some((g: any) => (g.lowSizes || []).length > 0)).length}`}
                </button>
              ))}
              <ActionButton variant="secondary" onClick={loadControlCenter} disabled={adsBusy || backendBusy}>{adsBusy ? "Đang tải..." : "Làm mới"}</ActionButton>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[18px] border border-neutral-200">
            <table className="w-full min-w-[1320px] text-left">
              <thead className="bg-neutral-50">
                <tr className="border-b border-neutral-200 text-[11px] text-neutral-400">
                  <th className="px-3 py-3 font-medium">Ad</th>
                  <th className="px-3 py-3 font-medium">Mã / màu</th>
                  <th className="px-3 py-3 font-medium">Campaign → Ad Set</th>
                  <th className="px-3 py-3 font-medium">Tồn từng size</th>
                  <th className="px-3 py-3 font-medium text-right">Spend</th>
                  <th className="px-3 py-3 font-medium text-right">DT nội bộ</th>
                  <th className="px-3 py-3 font-medium text-right">ROAS</th>
                  <th className="px-3 py-3 font-medium text-right">Budget</th>
                  <th className="px-3 py-3 font-medium">Đánh giá</th>
                  <th className="px-3 py-3 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredLiveAds.map((row) => {
                  const status = String(row.effectiveStatus || row.status || "UNKNOWN").toUpperCase();
                  const groups = row.inventory?.groups || [];
                  const critical = groups.some((g: any) => (g.criticalSizes || []).length > 0);
                  const low = groups.some((g: any) => (g.lowSizes || []).length > 0);
                  return (
                    <tr key={row.metaAdId} className="border-b border-neutral-100 align-top last:border-b-0">
                      <td className="px-3 py-4">
                        <div className="flex min-w-[230px] gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[12px] border border-neutral-200 bg-neutral-100">
                            {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] text-neutral-400">NO IMG</div>}
                          </div>
                          <div>
                            <div className="max-w-[240px] text-[12px] font-medium text-neutral-800">{row.adName || row.metaAdId}</div>
                            <div className="mt-1 font-mono text-[10px] text-neutral-400">{row.metaAdId}</div>
                            <div className="mt-2"><Badge tone={status === "ACTIVE" ? "green" : status === "PAUSED" ? "amber" : "gray"}>{status}</Badge></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-[12px] font-medium text-neutral-800">{groups[0]?.colorKey || row.productAttribution?.familySku || "Chưa map"}</div>
                        <div className="mt-1 max-w-[180px] text-[11px] text-neutral-400">{row.productAttribution?.productName || row.productAttribution?.label || "—"}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="max-w-[220px] text-[11px] text-neutral-700">{row.campaignName || "—"}</div>
                        <div className="mt-1 max-w-[220px] text-[11px] font-medium text-neutral-900">{row.adSetName || "—"}</div>
                      </td>
                      <td className="px-3 py-4">
                        {groups.length ? groups.map((g: any, gi: number) => (
                          <div key={`${row.metaAdId}-${gi}`} className={gi ? "mt-2" : ""}>
                            <div className="flex flex-wrap gap-1.5">
                              {(g.sizes || []).map((sz: any) => (
                                <span key={sz.size} className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${Number(sz.qty) < 5 ? "border-rose-200 bg-rose-50 text-rose-600" : Number(sz.qty) < 10 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-neutral-200 bg-white text-neutral-600"}`}>{sz.size}: {sz.qty}</span>
                              ))}
                            </div>
                          </div>
                        )) : <span className="text-[11px] text-neutral-400">Chưa match tồn kho</span>}
                      </td>
                      <td className="px-3 py-4 text-right text-[12px] text-neutral-700">{compactMoney(row.spend24h ?? row.spend)}</td>
                      <td className="px-3 py-4 text-right text-[12px] text-neutral-700">{compactMoney(row.revenue24h ?? row.revenue)}</td>
                      <td className="px-3 py-4 text-right"><span className={`text-[13px] font-semibold ${row.roas >= scaleRoas ? "text-emerald-600" : "text-neutral-800"}`}>{Number(row.roas || 0).toFixed(2)}</span></td>
                      <td className="px-3 py-4 text-right">
                        {(() => {
                          const preview = scalePreviews[row.metaAdId];
                          const visibleBudget = Number(row.budgetDaily || preview?.oldBudget || 0);
                          const visibleLevel = row.budgetLevel || preview?.budgetLevel || null;
                          return visibleBudget > 0 ? (
                            <div>
                              <div className="text-[12px] font-semibold text-neutral-800">{compactMoney(visibleBudget)}</div>
                              <div className="mt-1 text-[9px] font-medium uppercase tracking-wide text-neutral-400">{visibleLevel === "CAMPAIGN" ? "Campaign" : visibleLevel === "ADSET" ? "Ad Set" : "Budget"}</div>
                              {!row.budgetDaily && preview?.oldBudget ? <div className="mt-1 text-[9px] text-amber-600">Lấy từ lần kiểm tra gần nhất</div> : null}
                            </div>
                          ) : <span className="text-[12px] text-neutral-400">—</span>;
                        })()}
                      </td>
                      <td className="px-3 py-4">
                        {critical ? <Badge tone="red">CRITICAL STOCK</Badge> : low ? <Badge tone="amber">LOW STOCK</Badge> : (row.autoScaleEligible ?? row.canScale) ? <Badge tone="green">AUTO SCALE</Badge> : <Badge tone="gray">THEO DÕI</Badge>}
                        {!row.canScale && row.scaleReasons?.length ? <div className="mt-2 max-w-[220px] text-[10px] leading-4 text-neutral-400">{row.scaleReasons.slice(0, 2).join(" · ")}</div> : null}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex min-w-[190px] flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <ActionButton variant="soft" disabled={backendBusy || !row.adSetId || status !== "ACTIVE"} onClick={() => scaleLiveAdSet(row, 20)}>+20%</ActionButton>
                            <ActionButton variant="soft" disabled={backendBusy || !row.adSetId || status !== "ACTIVE"} onClick={() => scaleLiveAdSet(row, 30)}>+30%</ActionButton>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            {scaleCountForRow(row) > 0 ? (
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700" title={`${scaleCountForRow(row)} lần scale thật`}>✓ {scaleCountForRow(row)}</span>
                            ) : <span className="text-[10px] text-neutral-300">Chưa scale</span>}
                            <button type="button" onClick={() => setHistoryPopupAdId(row.metaAdId)} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-50">Lịch sử</button>
                          </div>
                          {scalePreviews[row.metaAdId] ? (() => {
                            const preview = scalePreviews[row.metaAdId];
                            return (
                              <div className={`rounded-xl border px-3 py-2 text-[10px] leading-4 ${preview.dryRun ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                                <div className="font-semibold">{preview.dryRun ? "DRY RUN · Chưa đổi Meta" : "ĐÃ SCALE TRÊN META"}</div>
                                <div className="mt-1">{compactMoney(preview.oldBudget)} → <span className="font-semibold">{compactMoney(preview.newBudget)}</span> (+{preview.percent}%)</div>
                                <div className="mt-0.5 opacity-70">Cấp: {preview.budgetLevel === "CAMPAIGN" ? "Campaign" : preview.budgetLevel === "ADSET" ? "Ad Set" : "—"}</div>
                              </div>
                            );
                          })() : null}
                          {status === "ACTIVE" ? <ActionButton variant="danger" disabled={backendBusy} onClick={() => setLiveAdStatus(row, "PAUSED")}>Pause Ad</ActionButton> : <ActionButton variant="secondary" disabled={backendBusy || status !== "PAUSED"} onClick={() => setLiveAdStatus(row, "ACTIVE")}>Bật lại Ad</ActionButton>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredLiveAds.length && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-[12px] text-neutral-400">{adsBusy ? "Đang tải ads từ Meta..." : "Không có ads phù hợp bộ lọc."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      {historyPopupAdId ? (() => {
        const row = liveAds.find((item) => item.metaAdId === historyPopupAdId);
        if (!row) return null;
        const items = historyForRow(row);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4" onClick={() => setHistoryPopupAdId(null)}>
            <div className="max-h-[70vh] w-full max-w-[560px] overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-neutral-100 px-5 py-4">
                <div>
                  <div className="text-[13px] font-semibold text-neutral-900">Lịch sử scale · {row.adName}</div>
                  <div className="mt-1 text-[11px] text-neutral-400">Đã scale thật {items.length} lần · {row.budgetLevel === 'CAMPAIGN' ? 'Campaign budget' : row.budgetLevel === 'ADSET' ? 'Ad Set budget' : 'Budget'}</div>
                </div>
                <button type="button" onClick={() => setHistoryPopupAdId(null)} className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px] text-neutral-500">Đóng</button>
              </div>
              <div className="max-h-[56vh] overflow-y-auto p-4">
                {items.length ? (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={item.id || `${item.at}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold text-neutral-800">✓ Lần {items.length - index} · +{Number(item.percent || 0)}%</div>
                          <div className="text-[10px] text-neutral-400">{item.at ? new Date(item.at).toLocaleString('vi-VN') : '—'}</div>
                        </div>
                        <div className="mt-2 text-[12px] text-neutral-700">{compactMoney(item.oldBudget)} → <span className="font-semibold text-neutral-900">{compactMoney(item.newBudget)}</span></div>
                        <div className="mt-1 text-[10px] text-neutral-400">{item.budgetLevel === 'CAMPAIGN' ? 'Campaign' : 'Ad Set'} · {String(item.source || '').toLowerCase().includes('auto') ? 'Tự động' : 'Thủ công'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-[12px] text-neutral-400">Chưa có lần scale LIVE nào được ghi nhận.</div>
                )}
              </div>
            </div>
          </div>
        );
      })() : null}

      {(
        <>
          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <Panel>
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Real-time alert</h3>
                  <Badge tone="blue">Live feed</Badge>
                </div>
                <div className="space-y-3">
                  {liveAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-[16px] border px-4 py-3 ${alert.level === "critical" ? "border-rose-200 bg-rose-50/60" : alert.level === "high" ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-medium text-neutral-800">{alert.title}</p>
                          <p className="mt-1 text-[12px] text-neutral-500">{alert.desc}</p>
                        </div>
                        <Badge tone={alert.level === "critical" ? "red" : alert.level === "high" ? "amber" : "green"}>{alert.level}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Scale gần đây</h3>
                  <Badge tone="blue">Backend history</Badge>
                </div>
                <div className="space-y-2">
                  {scaleHistory.slice(0, 6).map((item, index) => (
                    <div key={item.id || `${item.at}-${index}`} className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold text-neutral-800">+{Number(item.percent || 0)}% · {item.budgetLevel === "CAMPAIGN" ? "Campaign" : "Ad Set"}</div>
                        <div className="text-[10px] text-neutral-400">{item.at ? new Date(item.at).toLocaleString("vi-VN") : "—"}</div>
                      </div>
                      <div className="mt-1 text-[12px] text-neutral-700">{compactMoney(item.oldBudget)} → <span className="font-semibold text-neutral-900">{compactMoney(item.newBudget)}</span></div>
                      <div className="mt-1 text-[10px] text-neutral-400">{String(item.source || "").toLowerCase().includes("auto") ? "Tự động" : "Thủ công"}</div>
                    </div>
                  ))}
                  {!scaleHistory.length ? <div className="rounded-[14px] border border-dashed border-neutral-200 px-4 py-8 text-center text-[12px] text-neutral-400">Chưa có lần scale LIVE nào được backend ghi nhận.</div> : null}
                </div>
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-neutral-900">Decision log</h3>
                <Badge tone="blue">Tại sao scale / cut</Badge>
              </div>

              <div className="space-y-3">
                {!decisionLogs.length && <div className="rounded-[16px] border border-dashed border-neutral-200 px-4 py-8 text-center text-[12px] text-neutral-400">Chưa có hành động mới trong phiên này.</div>}
                {decisionLogs.map((log) => (
                  <div key={log.id} className="rounded-[16px] border border-neutral-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-neutral-800">{log.sku}</span>
                          <Badge tone={log.action === "applied" ? "green" : log.action === "suggested" ? "blue" : log.action === "rollback" ? "amber" : "gray"}>{log.action}</Badge>
                        </div>
                        <div className="mt-1 text-[13px] text-neutral-900">{log.decision}</div>
                        <div className="mt-1 text-[12px] text-neutral-500">{log.reason}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-400">{log.time}</span>
                        <ActionButton variant="secondary" onClick={() => rollbackDecision(log.id)}>Rollback 1 click</ActionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </>
      )}

      {(
        <>
          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <Panel>
              <div className="p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div>
                    <h3 className="text-[14px] font-semibold text-neutral-900">Kết nối Meta</h3>
                    <div className="mt-4 space-y-3">
                      <input value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-10 w-full rounded-[14px] border border-neutral-200 px-3 text-[13px] outline-none" placeholder="act_123456789" />
                      <div className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-500">Token lấy từ backend ENV · không nhập token trong trình duyệt</div>
                      <input value={apiBaseUrl} readOnly className="h-10 w-full rounded-[14px] border border-neutral-200 bg-neutral-50 px-3 text-[13px] outline-none" />
                      <div className="flex items-center gap-3">
                        <ActionButton variant="primary" onClick={connectMeta} disabled={backendBusy}>Kiểm tra Meta</ActionButton>
                        <label className="flex items-center gap-2 text-[12px] text-neutral-500">
                          <input type="checkbox" checked={dryRun} onChange={(e) => void saveDryRunConfig(e.target.checked)} />
                          Dry run
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold text-neutral-900">Mức vận hành Auto Scale</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
                      <button onClick={() => { setAutomationLevel("manual"); void saveAutomationConfig({ level: "manual", enabled: false }); }} className={`rounded-[16px] border p-4 text-left ${automationLevel === "manual" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 1</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "manual" ? "text-white/75" : "text-neutral-400"}`}>Manual · chỉ theo dõi/gợi ý, vẫn bấm tay được</div>
                      </button>
                      <button onClick={() => { setAutomationLevel("semi"); setPerformanceEnabled(true); void saveAutomationConfig({ level: "semi", enabled: true }); }} className={`rounded-[16px] border p-4 text-left ${automationLevel === "semi" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 2</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "semi" ? "text-white/75" : "text-neutral-400"}`}>Semi · backend đề xuất, người dùng duyệt/bấm</div>
                      </button>
                      <button onClick={() => { setAutomationLevel("auto"); setPerformanceEnabled(true); void saveAutomationConfig({ level: "auto", enabled: true }); }} className={`rounded-[16px] border p-4 text-left ${automationLevel === "auto" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 3</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "auto" ? "text-white/75" : "text-neutral-400"}`}>Auto · rule tự scale theo cấu hình</div>
                      </button>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <ActionButton variant="secondary" onClick={runAutoDecision} disabled={backendBusy}>Chạy Auto Scale ngay</ActionButton>
                      <Badge tone="blue">{automationLevel.toUpperCase()}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

        </>
      )}
    </div>
  );
}
