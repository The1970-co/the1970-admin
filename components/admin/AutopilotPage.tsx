"use client";

import React, { useMemo, useState } from "react";

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
  const [token, setToken] = useState("");
  const [dryRun, setDryRun] = useState(defaultDryRun);
  const [selectedMappingId, setSelectedMappingId] = useState(mappings[0]?.id || "");
  const [executionOutput, setExecutionOutput] = useState("Chưa chạy execute nào.");
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([
    {
      id: "d1",
      time: "09:12",
      sku: "QS794-GREEN-S",
      decision: "Scale +20%",
      reason: "ROAS 3.36, tồn còn tốt, budget còn room",
      action: "applied",
      rollbackBudget: 1200000,
      nextBudget: 1440000,
    },
    {
      id: "d2",
      time: "08:46",
      sku: "SM902-REUDEN-M",
      decision: "Giảm -15%",
      reason: "ROAS dưới ngưỡng 1.5 trong khi spend vẫn đang tăng.",
      action: "suggested",
      rollbackBudget: 800000,
      nextBudget: 680000,
    },
  ]);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([
    {
      id: "a1",
      level: "high",
      title: "QS794 Palm đủ điều kiện scale",
      desc: "ROAS đang vượt 3.0 và tồn kho còn an toàn.",
    },
    {
      id: "a2",
      level: "critical",
      title: "SM902 cần giảm budget",
      desc: "ROAS dưới ngưỡng 1.5 trong khi spend vẫn đang tăng.",
    },
  ]);

  const selectedMapping = useMemo(() => mappings.find((m) => m.id === selectedMappingId) || mappings[0], [mappings, selectedMappingId]);
  const connectedCount = useMemo(() => mappings.filter((m) => m.status === "CONNECTED").length, [mappings]);
  const scaleCandidates = useMemo(() => mappings.filter((m) => m.status === "CONNECTED" && m.roasToday >= 2.5).length, [mappings]);
  const weakCandidates = useMemo(() => mappings.filter((m) => m.status === "CONNECTED" && m.roasToday < 1.8).length, [mappings]);

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

  const endpointPreview = `${apiBaseUrl.replace(/\/$/, "")}/autopilot/execute`;

  const connectMeta = () => {
    setMetaConnected(true);
    pushActivity(`Đã kết nối Meta Ads account ${accountId}.`);
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

  const runAutoDecision = () => {
    if (automationLevel === "manual") return;

    const candidates = mappings.filter((m) => m.status === "CONNECTED");
    candidates.forEach((item) => {
      if (item.roasToday >= 2.5) {
        logDecision(
          item,
          automationLevel === "auto" ? "Auto scale +20%" : "Đề xuất scale +20%",
          `ROAS ${item.roasToday.toFixed(2)} vượt ngưỡng 2.5`,
          automationLevel === "auto" ? "applied" : "suggested",
          Math.round(item.budgetDaily * 1.2),
          item.budgetDaily
        );
      }
      if (automationLevel === "auto" && item.roasToday < 1.5) {
        logDecision(item, "Auto pause", `ROAS ${item.roasToday.toFixed(2)} dưới 1.5`, "applied", item.budgetDaily, item.budgetDaily);
      }
    });

    pushActivity(`Autopilot: chạy rule ${automationLevel}.`);
  };

  const executeAgainstApi = async (action: AutopilotAction) => {
    if (!selectedMapping) return;

    const payload = {
      token,
      action,
      adsetId: selectedMapping.adsetId,
      currentBudgetMinor: selectedMapping.budgetDaily,
      dryRun,
    };

    try {
      const res = await fetch(endpointPreview, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      setExecutionOutput(JSON.stringify(data, null, 2));
      logDecision(selectedMapping, `Execute ${action}`, dryRun ? "Dry run từ UI Autopilot" : "Live execute từ UI Autopilot", dryRun ? "preview" : "applied", selectedMapping.budgetDaily, selectedMapping.budgetDaily);
      pushActivity(`Autopilot API execute ${action} cho ${selectedMapping.sku}.`);
    } catch (error) {
      setExecutionOutput(String(error));
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
        <p className="mt-1 text-[12px] text-neutral-400">Gộp Ads + Automation vào một chỗ: overview, control và automation engine.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Meta connection" value={metaConnected ? "Connected" : "Not connected"} sub={metaConnected ? accountId : "Cần token + ad account"} />
        <StatCard title="Automation level" value={automationLevel.toUpperCase()} sub={`Mức ${automationLevel === "manual" ? "1" : automationLevel === "semi" ? "2" : "3"} / 3`} />
        <StatCard title="SKU đã map" value={connectedCount} sub="Connected to Meta" />
        <StatCard title="Nên scale" value={scaleCandidates} sub="ROAS >= 2.5" />
        <StatCard title="Yếu / nên pause" value={weakCandidates} sub="ROAS < 1.8" />
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
                      <input value={token} onChange={(e) => setToken(e.target.value)} className="h-10 w-full rounded-[14px] border border-neutral-200 px-3 text-[13px] outline-none" placeholder="Access token" />
                      <input value={apiBaseUrl} readOnly className="h-10 w-full rounded-[14px] border border-neutral-200 bg-neutral-50 px-3 text-[13px] outline-none" />
                      <div className="flex items-center gap-3">
                        <ActionButton variant="primary" onClick={connectMeta}>Connect Meta</ActionButton>
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
                      <button onClick={() => setAutomationLevel("manual")} className={`rounded-[16px] border p-4 text-left ${automationLevel === "manual" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 1</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "manual" ? "text-white/75" : "text-neutral-400"}`}>Chỉ gợi ý</div>
                      </button>
                      <button onClick={() => setAutomationLevel("semi")} className={`rounded-[16px] border p-4 text-left ${automationLevel === "semi" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 2</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "semi" ? "text-white/75" : "text-neutral-400"}`}>Có nút bấm scale</div>
                      </button>
                      <button onClick={() => setAutomationLevel("auto")} className={`rounded-[16px] border p-4 text-left ${automationLevel === "auto" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
                        <div className="text-[14px] font-medium">Mức 3</div>
                        <div className={`mt-1 text-[12px] ${automationLevel === "auto" ? "text-white/75" : "text-neutral-400"}`}>Rule tự động</div>
                      </button>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <ActionButton variant="secondary" onClick={runAutoDecision}>Run rule now</ActionButton>
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
                              <ActionButton variant="soft" disabled={m.status !== "CONNECTED" || automationLevel === "manual"} onClick={() => updateBudget(m.id, 20, "Scale")}>+20%</ActionButton>
                              <ActionButton variant="secondary" disabled={m.status !== "CONNECTED"} onClick={() => suggestCut(m.id)}>-15%</ActionButton>
                              <ActionButton variant="danger" disabled={m.status !== "CONNECTED"} onClick={() => pauseAdset(m.id)}>Pause</ActionButton>
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
                    <ActionButton variant="soft" disabled={!selectedMapping || !token} onClick={() => executeAgainstApi("scale15")}>Execute +15%</ActionButton>
                    <ActionButton variant="secondary" disabled={!selectedMapping || !token} onClick={() => executeAgainstApi("scale25")}>Execute +25%</ActionButton>
                    <ActionButton variant="secondary" disabled={!selectedMapping || !token} onClick={() => executeAgainstApi("cut15")}>Execute -15%</ActionButton>
                    <ActionButton variant="danger" disabled={!selectedMapping || !token} onClick={() => executeAgainstApi("pause")}>Pause thật</ActionButton>
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
                  <h3 className="text-[14px] font-semibold text-neutral-900">Code execute + Meta API</h3>
                  <ActionButton variant="secondary" className="!rounded-full !px-3 !py-1 !text-[11px]" onClick={() => navigator.clipboard.writeText(productionCode)}>Copy</ActionButton>
                </div>
                <pre className="max-h-[310px] overflow-auto rounded-[18px] bg-black p-4 text-[11px] leading-5 text-neutral-200">{productionCode}</pre>
              </div>
            </Panel>

            <Panel>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Nest API /autopilot/execute</h3>
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
