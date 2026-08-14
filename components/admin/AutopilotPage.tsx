"use client";

import React, { useEffect, useMemo, useState } from "react";

export type AutopilotAction = "scale15" | "scale25" | "cut15" | "pause";
export type AutomationLevel = "manual" | "semi" | "auto";
export type AutopilotTab = "overview" | "control" | "automation";

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
  canScale: boolean;
  scaleReasons?: string[];
  productAttribution?: any;
  inventory?: any;
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

function TabPill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[12px] font-medium transition ${active ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}
    >
      {children}
    </button>
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
  const [autopilotTab, setAutopilotTab] = useState<AutopilotTab>("overview");
  const [automationLevel, setAutomationLevel] = useState<AutomationLevel>(defaultAutomationLevel);
  const [metaConnected, setMetaConnected] = useState(false);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [dryRun, setDryRun] = useState(defaultDryRun);
  const [performanceEnabled, setPerformanceEnabled] = useState(false);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [scaleRoas, setScaleRoas] = useState(3);
  const [scalePercent, setScalePercent] = useState(20);
  const [minSpend, setMinSpend] = useState(200000);
  const [cooldownMinutes, setCooldownMinutes] = useState(360);
  const [maxScalePerDay, setMaxScalePerDay] = useState(2);
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [inventoryStatus, setInventoryStatus] = useState<any>(null);
  const [backendBusy, setBackendBusy] = useState(false);
  const [liveAds, setLiveAds] = useState<LiveAdControlRow[]>([]);
  const [adsBusy, setAdsBusy] = useState(false);
  const [adFilter, setAdFilter] = useState<"all" | "active" | "paused" | "scale" | "stock">("active");
  const [selectedMappingId, setSelectedMappingId] = useState(mappings[0]?.id || "");
  const [executionOutput, setExecutionOutput] = useState("Chưa chạy execute nào.");
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);

  const selectedMapping = useMemo(() => mappings.find((m) => m.id === selectedMappingId) || mappings[0], [mappings, selectedMappingId]);
  const connectedCount = useMemo(() => liveAds.length || mappings.filter((m) => m.status === "CONNECTED").length, [liveAds, mappings]);
  const scaleCandidates = useMemo(() => liveAds.length ? liveAds.filter((m) => m.canScale).length : mappings.filter((m) => m.status === "CONNECTED" && m.roasToday >= scaleRoas).length, [liveAds, mappings, scaleRoas]);
  const weakCandidates = useMemo(() => liveAds.length ? liveAds.filter((m) => m.inventory?.groups?.some((g: any) => (g.criticalSizes || []).length > 0)).length : mappings.filter((m) => m.status === "CONNECTED" && m.roasToday < 1.8).length, [liveAds, mappings]);

  const filteredLiveAds = useMemo(() => liveAds.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toUpperCase();
    if (adFilter === "active") return status === "ACTIVE";
    if (adFilter === "paused") return status === "PAUSED";
    if (adFilter === "scale") return row.canScale;
    if (adFilter === "stock") return row.inventory?.groups?.some((g: any) => (g.lowSizes || []).length > 0);
    return true;
  }), [liveAds, adFilter]);

  const selectedHistory = useMemo(() => {
    const target = selectedMapping || mappings.find((m) => m.status === "CONNECTED") || mappings[0];
    if (!target) return null;
    return {
      sku: target.sku,
      roas: target.roasToday,
      spend: target.spendToday,
      revenue: target.revenueToday,
      budget: target.budgetDaily,
      points: [54, 58, 63, 69, 74, 79, 86],
    };
  }, [mappings, selectedMapping]);

  const endpointPreview = `${apiBaseUrl.replace(/\/$/, "")}/meta-ads/autopilot/performance/run`;

  const apiJson = async (path: string, init?: RequestInit) => {
    const auth = typeof window !== "undefined" ? localStorage.getItem("access_token") || localStorage.getItem("token") || "" : "";
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(init?.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || JSON.stringify(data) || `HTTP ${res.status}`);
    return data;
  };

  const loadControlCenter = async () => {
    setAdsBusy(true);
    try {
      const data = await apiJson("/meta-ads/autopilot/control-center");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setLiveAds(rows);

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
        } else if (row.canScale) {
          alerts.push({
            id: `scale-${row.metaAdId}`,
            level: "good",
            title: `${row.productAttribution?.familySku || row.adName} đủ điều kiện scale`,
            desc: `ROAS ${Number(row.roas || 0).toFixed(2)} · Spend ${currency(row.spend)} · tồn size an toàn.`,
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
    } catch (error) {
      setExecutionOutput(`Không tải được danh sách ads live: ${String(error)}`);
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
      setCooldownMinutes(Number(perf?.cooldownMinutes || 360));
      setMaxScalePerDay(Number(perf?.maxScalePerAdSetPerDay || 2));
    } catch (error) {
      setExecutionOutput(`Không tải được Autopilot backend: ${String(error)}`);
    } finally {
      setBackendBusy(false);
    }
  };

  useEffect(() => {
    void loadBackendStatus();
    void loadControlCenter();
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
          cooldownMinutes,
          maxScalePerAdSetPerDay: maxScalePerDay,
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

  const updateBudget = (id: string, percent: number, label: string) => {
    const target = mappings.find((m) => m.id === id);
    if (!target) return;
    const nextBudget = Math.round(target.budgetDaily * (1 + percent / 100));

    setMappings((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              budgetDaily: nextBudget,
              lastAction: percent > 0 ? "Đã scale" : "Đã giảm",
            }
          : m
      )
    );

    logDecision(
      target,
      `${label} ${percent > 0 ? `+${percent}%` : `${percent}%`}`,
      percent > 0 ? `ROAS ${target.roasToday.toFixed(2)}, tồn còn tốt, budget còn room` : `ROAS ${target.roasToday.toFixed(2)}, cần hạ ngân sách`,
      "applied",
      nextBudget,
      target.budgetDaily
    );

    pushActivity(`Autopilot: ${label} cho ${target.sku}.`);
  };

  const suggestCut = (id: string) => {
    const target = mappings.find((m) => m.id === id);
    if (!target) return;
    const nextBudget = Math.round(target.budgetDaily * 0.85);
    logDecision(target, "Giảm -15%", `ROAS ${target.roasToday.toFixed(2)} dưới ngưỡng an toàn.`, "suggested", nextBudget, target.budgetDaily);
    pushActivity(`Autopilot: gợi ý giảm budget cho ${target.sku}.`);
  };

  const pauseAdset = (id: string) => {
    const target = mappings.find((m) => m.id === id);
    if (!target) return;

    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, lastAction: "Đã pause" } : m)));
    logDecision(target, "Pause", `ROAS ${target.roasToday.toFixed(2)} dưới ngưỡng, cần dừng ad set.`, "applied", target.budgetDaily, target.budgetDaily);
    pushActivity(`Autopilot: pause ad set cho ${target.sku}.`);
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

  const executeAgainstApi = async (action: AutopilotAction) => {
    if (!selectedMapping) return;
    setBackendBusy(true);
    try {
      if (action === "scale15" || action === "scale25") {
        const percent = action === "scale15" ? 15 : 25;
        const data = await apiJson("/meta-ads/actions/scale-adset", {
          method: "POST",
          body: JSON.stringify({ metaAdSetId: selectedMapping.adsetId, percent, dryRun }),
        });
        setExecutionOutput(JSON.stringify(data, null, 2));
        if (!dryRun && data?.newBudget) {
          setMappings((prev) => prev.map((m) => m.id === selectedMapping.id ? { ...m, budgetDaily: Number(data.newBudget), lastAction: `Scale +${percent}%` } : m));
        }
        logDecision(selectedMapping, `Scale +${percent}%`, `Execute backend · ROAS ${selectedMapping.roasToday.toFixed(2)}`, dryRun ? "preview" : "applied", data?.newBudget, data?.oldBudget);
      } else {
        setExecutionOutput("Performance Autopilot mới chỉ tự SCALE. Giảm/pause theo ROAS chưa bật; pause hết hàng do Inventory Autopilot xử lý ở level ad con.");
      }
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

  const scaleLiveAdSet = async (row: LiveAdControlRow) => {
    if (!row.adSetId) return;
    setBackendBusy(true);
    try {
      const data = await apiJson("/meta-ads/actions/scale-adset", {
        method: "POST",
        body: JSON.stringify({ metaAdSetId: row.adSetId, percent: scalePercent, dryRun }),
      });
      setExecutionOutput(JSON.stringify(data, null, 2));
      pushActivity(`${dryRun ? "DRY RUN" : "LIVE"}: scale ${row.adSetName || row.adSetId} +${scalePercent}%.`);
      await loadControlCenter();
      await loadBackendStatus();
    } catch (error) {
      setExecutionOutput(String(error));
    } finally {
      setBackendBusy(false);
    }
  };

  const productionCode = `export class MetaAdsService {
  constructor(private readonly token: string, private readonly apiVersion = "v20.0") {}

  async updateAdsetBudget(adsetId: string, budgetMinor: number) {
    const url = new URL(\`https://graph.facebook.com/\${this.apiVersion}/\${adsetId}\`);
    const body = new URLSearchParams({
      access_token: this.token,
      daily_budget: String(budgetMinor),
    });
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async pauseAdset(adsetId: string) {
    const url = new URL(\`https://graph.facebook.com/\${this.apiVersion}/\${adsetId}\`);
    const body = new URLSearchParams({
      access_token: this.token,
      status: "PAUSED",
    });
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}`;

  const autopilotApiCode = `import { Body, Controller, Post } from "@nestjs/common";

class ExecuteDto {
  token!: string;
  action!: "scale15" | "scale25" | "cut15" | "pause";
  adsetId!: string;
  currentBudgetMinor!: number;
  dryRun?: boolean;
}

@Controller("autopilot")
export class AutopilotController {
  @Post("execute")
  async execute(@Body() dto: ExecuteDto) {
    if (dto.dryRun) {
      return { ok: true, mode: "dry_run", preview: dto };
    }
    return executeAutopilotDecision(dto);
  }
}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[14px] font-semibold text-neutral-900">Autopilot</h2>
        <p className="mt-1 text-[12px] text-neutral-400">Trung tâm điều khiển Ads: Auto Scale theo ROAS + Auto Pause ad con theo tồn kho.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Meta connection" value={metaConnected ? "Connected" : "Not connected"} sub={metaConnected ? accountId : "Cần token + ad account"} />
        <StatCard title="Automation level" value={automationLevel.toUpperCase()} sub={`Mức ${automationLevel === "manual" ? "1" : automationLevel === "semi" ? "2" : "3"} / 3`} />
        <StatCard title="SKU đã map" value={connectedCount} sub="Connected to Meta" />
        <StatCard title="Nên scale" value={scaleCandidates} sub={`ROAS >= ${scaleRoas}`} />
        <StatCard title="Thiếu size critical" value={weakCandidates} sub="Có size dưới 5" />
      </div>

      <Panel>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            <TabPill active={autopilotTab === "overview"} onClick={() => setAutopilotTab("overview")}>Overview</TabPill>
            <TabPill active={autopilotTab === "control"} onClick={() => setAutopilotTab("control")}>Control</TabPill>
            <TabPill active={autopilotTab === "automation"} onClick={() => setAutopilotTab("automation")}>Automation</TabPill>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="p-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-neutral-900">Auto Scale theo ROAS</h3>
                  <p className="mt-1 text-[12px] text-neutral-500">Chỉ scale Ad Set khi ROAS nội bộ đủ cao, attribution chắc và tồn tất cả size vẫn an toàn.</p>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-neutral-600">
                  <input type="checkbox" checked={performanceEnabled} onChange={(e) => { const enabled = e.target.checked; setPerformanceEnabled(enabled); void saveAutomationConfig({ enabled }); }} />
                  {performanceEnabled ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <label className="text-[11px] text-neutral-500">ROAS scale
                  <input type="number" step="0.1" value={scaleRoas} onChange={(e) => setScaleRoas(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Tăng mỗi lần %
                  <input type="number" value={scalePercent} onChange={(e) => setScalePercent(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Spend tối thiểu
                  <input type="number" value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Cooldown phút
                  <input type="number" value={cooldownMinutes} onChange={(e) => setCooldownMinutes(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
                </label>
                <label className="text-[11px] text-neutral-500">Max scale / 24h
                  <input type="number" value={maxScalePerDay} onChange={(e) => setMaxScalePerDay(Number(e.target.value))} onBlur={() => void saveAutomationConfig()} className="mt-1 h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />
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
                <label className="flex items-center gap-2 text-[11px] text-neutral-500"><input type="checkbox" checked={dryRun} onChange={(e) => { setDryRun(e.target.checked); void saveAutomationConfig({ dryRun: e.target.checked }); }} /> Test trước khi chạy thật</label>
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
              <p className="mt-1 text-[12px] text-neutral-400">Scale ở cấp Ad Set · bật/tắt ở cấp Ad con · tồn kho theo đúng mã + màu.</p>
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
                      <td className="px-3 py-4 text-right text-[12px] text-neutral-700">{compactMoney(row.spend)}</td>
                      <td className="px-3 py-4 text-right text-[12px] text-neutral-700">{compactMoney(row.revenue)}</td>
                      <td className="px-3 py-4 text-right"><span className={`text-[13px] font-semibold ${row.roas >= scaleRoas ? "text-emerald-600" : "text-neutral-800"}`}>{Number(row.roas || 0).toFixed(2)}</span></td>
                      <td className="px-3 py-4 text-right text-[12px] text-neutral-700">{row.budgetDaily ? compactMoney(row.budgetDaily) : "—"}</td>
                      <td className="px-3 py-4">
                        {critical ? <Badge tone="red">CRITICAL STOCK</Badge> : low ? <Badge tone="amber">LOW STOCK</Badge> : row.canScale ? <Badge tone="green">AUTO SCALE</Badge> : <Badge tone="gray">THEO DÕI</Badge>}
                        {!row.canScale && row.scaleReasons?.length ? <div className="mt-2 max-w-[220px] text-[10px] leading-4 text-neutral-400">{row.scaleReasons.slice(0, 2).join(" · ")}</div> : null}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex min-w-[160px] flex-col gap-2">
                          <ActionButton variant="soft" disabled={backendBusy || !row.adSetId || status !== "ACTIVE"} onClick={() => scaleLiveAdSet(row)}>Scale +{scalePercent}%</ActionButton>
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

      {autopilotTab === "overview" && (
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
                  <h3 className="text-[14px] font-semibold text-neutral-900">History graph</h3>
                  <Badge tone="amber">7 phiên gần nhất</Badge>
                </div>

                {selectedHistory && (
                  <>
                    <div className="mb-3 flex items-center justify-between text-[12px] text-neutral-500">
                      <span>{selectedHistory.sku}</span>
                      <span>ROAS {selectedHistory.roas.toFixed(2)} · Budget {compactMoney(selectedHistory.budget)}</span>
                    </div>

                    <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex h-[130px] items-end gap-2">
                        {selectedHistory.points.map((point, index) => (
                          <div key={index} className="flex-1">
                            <div className="w-full rounded-t-[10px] bg-neutral-900" style={{ height: `${point}%` }} />
                            <div className="mt-2 text-center text-[10px] text-neutral-400">D{index + 1}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="rounded-[14px] border border-neutral-200 px-3 py-3 text-[12px]">
                        <div className="text-neutral-400">Spend</div>
                        <div className="mt-1 font-medium text-neutral-800">{compactMoney(selectedHistory.spend)}</div>
                      </div>
                      <div className="rounded-[14px] border border-neutral-200 px-3 py-3 text-[12px]">
                        <div className="text-neutral-400">Revenue</div>
                        <div className="mt-1 font-medium text-neutral-800">{compactMoney(selectedHistory.revenue)}</div>
                      </div>
                      <div className="rounded-[14px] border border-neutral-200 px-3 py-3 text-[12px]">
                        <div className="text-neutral-400">Budget</div>
                        <div className="mt-1 font-medium text-neutral-800">{compactMoney(selectedHistory.budget)}</div>
                      </div>
                    </div>
                  </>
                )}
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

      {autopilotTab === "control" && (
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
                          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                          Dry run
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold text-neutral-900">3 mức tự động</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
                      <button onClick={() => { setAutomationLevel("manual"); void saveAutomationConfig({ level: "manual", enabled: false }); }} className={`rounded-[16px] border p-4 text-left ${automationLevel === "manual" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 1</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "manual" ? "text-white/75" : "text-neutral-400"}`}>Chỉ gợi ý</div>
                      </button>
                      <button onClick={() => { setAutomationLevel("semi"); setPerformanceEnabled(true); void saveAutomationConfig({ level: "semi", enabled: true }); }} className={`rounded-[16px] border p-4 text-left ${automationLevel === "semi" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 2</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "semi" ? "text-white/75" : "text-neutral-400"}`}>Có nút bấm scale</div>
                      </button>
                      <button onClick={() => { setAutomationLevel("auto"); setPerformanceEnabled(true); void saveAutomationConfig({ level: "auto", enabled: true }); }} className={`rounded-[16px] border p-4 text-left ${automationLevel === "auto" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 3</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "auto" ? "text-white/75" : "text-neutral-400"}`}>Rule tự động</div>
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

          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <Panel>
              <div className="p-4">
                <h3 className="text-[14px] font-semibold text-neutral-900">SKU ↔ Campaign / Ad Set Mapping</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[12px] text-neutral-400">
                        <th className="pb-3 font-medium">SKU</th>
                        <th className="pb-3 font-medium">Campaign</th>
                        <th className="pb-3 font-medium">Ad set</th>
                        <th className="pb-3 font-medium">ROAS hôm nay</th>
                        <th className="pb-3 font-medium">Budget ngày</th>
                        <th className="pb-3 font-medium">Trạng thái</th>
                        <th className="pb-3 font-medium">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => (
                        <tr key={m.id} className={`border-b border-neutral-100 align-top ${selectedMappingId === m.id ? "bg-neutral-50" : ""}`}>
                          <td className="py-4">
                            <button onClick={() => setSelectedMappingId(m.id)} className="text-left">
                              <div className="text-[13px] font-medium text-neutral-800">{m.sku}</div>
                              <div className="mt-1 text-[12px] text-neutral-400">{m.productName}</div>
                            </button>
                          </td>
                          <td className="py-4 text-[12px] text-neutral-700">
                            <div>{m.campaignName}</div>
                            <div className="mt-1 text-neutral-400">{m.campaignId}</div>
                          </td>
                          <td className="py-4 text-[12px] text-neutral-700">
                            <div>{m.adsetName}</div>
                            <div className="mt-1 text-neutral-400">{m.adsetId}</div>
                          </td>
                          <td className="py-4 text-[13px] text-neutral-700">{m.roasToday.toFixed(2)}</td>
                          <td className="py-4 text-[13px] text-neutral-700">{currency(m.budgetDaily)}</td>
                          <td className="py-4">
                            <Badge tone={toneForStatus(m.status) as any}>{m.status}</Badge>
                            <div className="mt-2 text-[12px] text-neutral-400">{m.lastAction || "Không có"}</div>
                          </td>
                          <td className="py-4">
                            <div className="flex flex-col gap-2">
                              <ActionButton variant="soft" disabled={m.status !== "CONNECTED" || backendBusy} onClick={() => { setSelectedMappingId(m.id); setTimeout(() => void executeAgainstApi("scale25"), 0); }}>Scale +25%</ActionButton>
                              <ActionButton variant="secondary" disabled>Không auto giảm</ActionButton>
                              <ActionButton variant="danger" disabled>Pause do tồn kho</ActionButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Execute thật qua API</h3>
                  <Badge tone="amber">{dryRun ? "DRY RUN" : "LIVE"}</Badge>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[14px] border border-neutral-200 px-3 py-3 text-[12px]">
                    <div className="text-neutral-400">Endpoint</div>
                    <div className="mt-1 break-all font-mono text-[11px] text-neutral-700">{endpointPreview}</div>
                  </div>

                  <div className="rounded-[14px] border border-neutral-200 px-3 py-3 text-[12px]">
                    <div className="text-neutral-400">Ad set đang chọn</div>
                    <div className="mt-1 text-neutral-700">{selectedMapping?.adsetId || "—"}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ActionButton variant="soft" disabled={!selectedMapping || backendBusy} onClick={() => executeAgainstApi("scale15")}>Execute +15%</ActionButton>
                    <ActionButton variant="secondary" disabled={!selectedMapping || backendBusy} onClick={() => executeAgainstApi("scale25")}>Execute +25%</ActionButton>
                    <ActionButton variant="secondary" disabled={!selectedMapping || backendBusy} onClick={() => executeAgainstApi("cut15")}>Execute -15%</ActionButton>
                    <ActionButton variant="danger" disabled={!selectedMapping || backendBusy} onClick={() => executeAgainstApi("pause")}>Pause thật</ActionButton>
                  </div>

                  <div className="rounded-[18px] bg-neutral-900 p-4 text-white">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[13px] font-medium">Execution output</div>
                      <ActionButton variant="secondary" className="!rounded-full !px-3 !py-1 !text-[11px]" onClick={() => navigator.clipboard.writeText(executionOutput)}>Copy</ActionButton>
                    </div>
                    <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap text-[11px] text-neutral-200">{executionOutput}</pre>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      {autopilotTab === "automation" && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Performance Auto Scale backend</h3>
                  <ActionButton variant="secondary" className="!rounded-full !px-3 !py-1 !text-[11px]" onClick={() => navigator.clipboard.writeText(productionCode)}>Copy</ActionButton>
                </div>
                <pre className="max-h-[310px] overflow-auto rounded-[18px] bg-black p-4 text-[11px] leading-5 text-neutral-200">{productionCode}</pre>
              </div>
            </Panel>

            <Panel>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Inventory Auto Pause backend</h3>
                  <ActionButton variant="secondary" className="!rounded-full !px-3 !py-1 !text-[11px]" onClick={() => navigator.clipboard.writeText(autopilotApiCode)}>Copy</ActionButton>
                </div>
                <pre className="max-h-[310px] overflow-auto rounded-[18px] bg-black p-4 text-[11px] leading-5 text-neutral-200">{autopilotApiCode}</pre>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <div className="p-4">
                <h3 className="text-[14px] font-semibold text-neutral-900">3 mức vận hành</h3>
                <div className="mt-4 space-y-3">
                  <div className="rounded-[16px] border border-neutral-300 px-4 py-3">
                    <div className="text-[13px] font-medium text-neutral-800">Mức 1 · Manual</div>
                    <div className="mt-1 text-[12px] text-neutral-500">Chỉ hiển thị gợi ý. Người vận hành tự quyết định ngoài Ads Manager.</div>
                  </div>
                  <div className="rounded-[16px] border border-neutral-300 px-4 py-3">
                    <div className="text-[13px] font-medium text-neutral-800">Mức 2 · Semi-auto</div>
                    <div className="mt-1 text-[12px] text-neutral-500">Dashboard gợi ý, staff bấm scale / giảm / pause ngay trong hệ thống.</div>
                  </div>
                  <div className="rounded-[16px] border border-neutral-300 px-4 py-3">
                    <div className="text-[13px] font-medium text-neutral-800">Mức 3 · Auto</div>
                    <div className="mt-1 text-[12px] text-neutral-500">Rule tự động có guardrail: scale nhẹ ad set tốt, pause ad set yếu.</div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="p-4">
                <h3 className="text-[14px] font-semibold text-neutral-900">Nguyên tắc an toàn</h3>
                <div className="mt-4 space-y-3 text-[12px] text-neutral-500">
                  <div>• Chỉ scale nếu SKU còn hàng và ROAS đủ tốt.</div>
                  <div>• Chỉ tăng ngân sách nhẹ 15–25% mỗi lần.</div>
                  <div>• Tự động pause khi ROAS quá thấp ở mức 3.</div>
                  <div>• Mọi hành động đều ghi vào decision log và có rollback 1 click.</div>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
