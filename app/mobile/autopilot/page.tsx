"use client";

import { apiJson } from "@/lib/api";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Bot,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Save,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AutomationLevel = "manual" | "semi" | "auto";
type TabKey = "ads" | "posts" | "settings";
type AnyRow = Record<string, any>;

const money = (v: any) => `${Math.round(Number(v || 0)).toLocaleString("vi-VN")}đ`;

function postImage(post: AnyRow) {
  const direct = String(post?.fullPicture || post?.full_picture || post?.imageUrl || post?.image_url || "").trim();
  if (direct) return direct;

  const attachments =
    post?.attachments?.data ||
    post?.attachments ||
    post?.raw?.attachments?.data ||
    post?.rawPost?.attachments?.data ||
    [];

  const first = Array.isArray(attachments) ? attachments[0] : null;
  const media =
    first?.media?.image?.src ||
    first?.media?.source ||
    first?.media?.src ||
    first?.url ||
    "";

  if (media) return String(media);

  const subs = first?.subattachments?.data || [];
  const sub = Array.isArray(subs) ? subs[0] : null;
  return String(sub?.media?.image?.src || sub?.media?.source || sub?.url || "").trim();
}

const num = (v: any) => Number(v || 0) || 0;
const pct = (v: any) => Number(v || 0).toFixed(2);

function toneClass(value: string) {
  const s = String(value || "").toUpperCase();
  if (s.includes("ACTIVE") || s.includes("NORMAL") || s.includes("READY")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s.includes("CRITICAL") || s.includes("ERROR") || s.includes("BLOCKED")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (s.includes("LOW") || s.includes("WAIT") || s.includes("PAUSED") || s.includes("WARN")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function Badge({ children, value }: { children: React.ReactNode; value?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${toneClass(value || String(children))}`}>{children}</span>;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-neutral-950" : "bg-neutral-200"} ${disabled ? "opacity-50" : ""}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1.5 text-[11px] font-bold text-neutral-500">{label}</div>{children}</label>;
}

const inputClass = "h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-semibold outline-none focus:border-neutral-400";

export default function MobileAutopilotPage() {
  const [tab, setTab] = useState<TabKey>("ads");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [launchAvailable, setLaunchAvailable] = useState(true);
  const [launchError, setLaunchError] = useState("");
  const [adFilter, setAdFilter] = useState<"all" | "active" | "paused" | "scale" | "stock">("active");
  const [selectedLevel, setSelectedLevel] = useState<AutomationLevel>("manual");
  const [postFilter, setPostFilter] = useState<"all" | "no_ad" | "has_ad">("no_ad");
  const [mappingOptions, setMappingOptions] = useState<AnyRow[]>([]);
  const [manualProductByPost, setManualProductByPost] = useState<Record<string, string>>({});
  const [manualColorByPost, setManualColorByPost] = useState<Record<string, string>>({});
  const [productSearchByPost, setProductSearchByPost] = useState<Record<string, string>>({});
  const [confirmRunPostId, setConfirmRunPostId] = useState<string | null>(null);

  const [performance, setPerformance] = useState<AnyRow>({});
  const [inventory, setInventory] = useState<AnyRow>({});
  const [launch, setLaunch] = useState<AnyRow>({});
  const [launchPosts, setLaunchPosts] = useState<AnyRow[]>([]);
  const [liveAds, setLiveAds] = useState<AnyRow[]>([]);
  const [assessments, setAssessments] = useState<Record<string, AnyRow>>({});
  const [budgets, setBudgets] = useState<{ adSets: AnyRow[]; campaigns: AnyRow[] }>({ adSets: [], campaigns: [] });
  const [scaleHistory, setScaleHistory] = useState<AnyRow[]>([]);

  const [level, setLevel] = useState<AutomationLevel>("manual");
  const [dryRun, setDryRun] = useState(true);
  const [performanceEnabled, setPerformanceEnabled] = useState(false);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [launchEnabled, setLaunchEnabled] = useState(false);

  const [scaleRoas, setScaleRoas] = useState(3);
  const [scalePercent, setScalePercent] = useState(20);
  const [minSpend, setMinSpend] = useState(200000);

  const [warnThreshold, setWarnThreshold] = useState(10);
  const [pauseThreshold, setPauseThreshold] = useState(5);
  const [criticalSizeCount, setCriticalSizeCount] = useState(2);
  const [pauseTotalQty, setPauseTotalQty] = useState(40);
  const [requireBoth, setRequireBoth] = useState(true);

  const [waitHours, setWaitHours] = useState(48);
  const [launchMode, setLaunchMode] = useState<"EXISTING_ADSET" | "CLONE_ADSET" | "NEW_CAMPAIGN">("NEW_CAMPAIGN");
  const [targetAdSetId, setTargetAdSetId] = useState("");
  const [templateAdSetId, setTemplateAdSetId] = useState("");
  const [launchDailyBudget, setLaunchDailyBudget] = useState(1000000);
  const [requireInventoryMatch, setRequireInventoryMatch] = useState(true);
  const [blockCriticalStock, setBlockCriticalStock] = useState(true);
  const [autoActivate, setAutoActivate] = useState(true);

  async function loadAll(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError("");
    setLaunchError("");

    try {
      // Core Autopilot không được phụ thuộc Auto Launch.
      const core = await Promise.allSettled([
        apiJson("/meta-ads/autopilot/performance/status"),
        apiJson("/meta-ads/autopilot/inventory/status"),
        apiJson("/meta-ads/autopilot/live-ads?limit=500"),
        apiJson("/meta-ads/autopilot/scale-history?limit=500"),
        apiJson("/meta-ads/autopilot/control-center"),
      ]);

      const value = (i: number) => core[i]?.status === "fulfilled" ? (core[i] as PromiseFulfilledResult<any>).value : null;
      const perf = value(0) || {};
      const inv = value(1) || {};
      const rawLive = value(2);
      const history = value(3);
      const control = value(4);

      setPerformance(perf);
      setInventory(inv);

      const rawLiveRows = Array.isArray(rawLive) ? rawLive : rawLive?.items || rawLive?.ads || rawLive?.rows || [];
      const controlRows = Array.isArray(control?.ads) ? control.ads : Array.isArray(control?.rows) ? control.rows : [];

      // Không được chọn 1 trong 2 nguồn rồi làm mất field của nguồn còn lại.
      // rawLive giữ structure Meta: tên Ad, Ad Set, Campaign, budget, thumbnail.
      // control-center bổ sung metrics/ROAS/attribution/inventory/canScale.
      const controlById = new Map<string, AnyRow>(
        controlRows.map((row: AnyRow) => [String(row.metaAdId || row.adId || row.id || ''), row] as [string, AnyRow]),
      );
      const rawById = new Map<string, AnyRow>(
        rawLiveRows.map((row: AnyRow) => [String(row.metaAdId || row.adId || row.id || ''), row] as [string, AnyRow]),
      );
      const allIds = Array.from(new Set([...rawById.keys(), ...controlById.keys()])).filter(Boolean);

      const adRows = allIds.map((id) => {
        const raw = rawById.get(id) || {};
        const ctl = controlById.get(id) || {};
        return {
          ...raw,
          ...ctl,
          // Structure ưu tiên raw live nếu control-center trả thiếu/rỗng.
          name: ctl.adName || ctl.name || raw.adName || raw.name || raw.ad_name || '',
          adName: ctl.adName || ctl.name || raw.adName || raw.name || raw.ad_name || '',
          campaignName: ctl.campaignName || raw.campaignName || raw.campaign_name || '',
          adSetName: ctl.adSetName || raw.adSetName || raw.adsetName || raw.adset_name || '',
          metaAdId: ctl.metaAdId || raw.metaAdId || raw.adId || raw.id || id,
          metaAdSetId: ctl.metaAdSetId || ctl.adSetId || raw.metaAdSetId || raw.adSetId || raw.adset_id || '',
          metaCampaignId: ctl.metaCampaignId || ctl.campaignId || raw.metaCampaignId || raw.campaignId || raw.campaign_id || '',
          thumbnailUrl: ctl.thumbnailUrl || raw.thumbnailUrl || raw.thumbnail_url || raw.imageUrl || raw.image_url || null,
          // Budget ưu tiên live structure; control-center không được ghi null đè mất.
          adSetDailyBudget: num(ctl.adSetDailyBudget) > 0 ? ctl.adSetDailyBudget : raw.adSetDailyBudget,
          campaignDailyBudget: num(ctl.campaignDailyBudget) > 0 ? ctl.campaignDailyBudget : raw.campaignDailyBudget,
          currentBudget: num(ctl.currentBudget) > 0 ? ctl.currentBudget : raw.currentBudget,
          budgetLevel: ctl.budgetLevel || raw.budgetLevel || null,
          // Metrics ưu tiên control-center.
          spend24h: ctl.spend24h ?? ctl.metrics?.spend ?? raw.spend24h ?? raw.spend,
          revenue24h: ctl.revenue24h ?? ctl.productAttribution?.familyOrderRevenue ?? ctl.productAttribution?.orderRevenue ?? raw.revenue24h ?? raw.revenue,
          roas24h: ctl.roas24h ?? ctl.productAttribution?.realRoasEstimate ?? raw.roas24h ?? raw.roas,
        };
      });

      setLiveAds(adRows);
      setScaleHistory(Array.isArray(history) ? history : history?.items || history?.rows || []);

      const pickedLevel = (perf?.level || inv?.level || "manual") as AutomationLevel;
      setLevel(pickedLevel);
      setSelectedLevel(pickedLevel);
      setDryRun(Boolean(perf?.dryRun ?? inv?.dryRun ?? true));
      setPerformanceEnabled(Boolean(perf?.enabled));
      setInventoryEnabled(Boolean(inv?.enabled));
      setScaleRoas(num(perf?.scaleRoas) || 3);
      setScalePercent(num(perf?.scalePercent) || 20);
      setMinSpend(num(perf?.minSpend) || 200000);
      setWarnThreshold(num(inv?.warnThreshold) || 10);
      setPauseThreshold(num(inv?.pauseThreshold) || 5);
      setCriticalSizeCount(num(inv?.criticalSizeCount) || 2);
      setPauseTotalQty(num(inv?.pauseTotalQty) || 40);
      setRequireBoth(inv?.requireBoth !== false);

      // Enrich tồn kho + budget, nhưng lỗi enrich không được xóa Ads.
      if (adRows.length) {
        const enrich = await Promise.allSettled([
          apiJson("/meta-ads/autopilot/inventory/assess", {
            method: "POST",
            body: JSON.stringify({ ads: adRows }),
          }),
          apiJson("/meta-ads/autopilot/budgets", {
            method: "POST",
            body: JSON.stringify({
              metaAdSetIds: Array.from(new Set(adRows.map((x: AnyRow) => String(x.metaAdSetId || x.adSetId || "")).filter(Boolean))),
              metaCampaignIds: Array.from(new Set(adRows.map((x: AnyRow) => String(x.metaCampaignId || x.campaignId || "")).filter(Boolean))),
            }),
          }),
        ]);

        if (enrich[0].status === "fulfilled") {
          const assessmentRows: any = enrich[0].value;
          const assessList = Array.isArray(assessmentRows) ? assessmentRows : assessmentRows?.items || assessmentRows?.rows || [];
          const map: Record<string, AnyRow> = {};
          assessList.forEach((x: AnyRow) => { map[String(x.metaAdId || x.id || "")] = x; });
          setAssessments(map);
        }

        if (enrich[1].status === "fulfilled") {
          const budgetRows: any = enrich[1].value;
          setBudgets({ adSets: budgetRows?.adSets || [], campaigns: budgetRows?.campaigns || [] });
        }
      } else {
        setAssessments({});
        setBudgets({ adSets: [], campaigns: [] });
      }

      // Auto Launch là module optional. 404 ở đây không được làm hỏng Ads/Scale/Inventory.
      const launchResults = await Promise.allSettled([
        apiJson("/meta-ads/autopilot/launch/status"),
        apiJson("/meta-ads/autopilot/launch/posts?limit=100"),
        apiJson("/meta-ads/autopilot/inventory/mapping-options?limit=1500"),
      ]);

      if (launchResults[0].status === "fulfilled") {
        const lau: any = launchResults[0].value || {};
        setLaunchAvailable(true);
        setLaunch(lau);
        setLaunchEnabled(Boolean(lau?.enabled));
        setWaitHours(num(lau?.waitHours) || 48);
        {
          const mode = String(lau?.launchMode || "NEW_CAMPAIGN").toUpperCase();
          setLaunchMode(mode === "EXISTING_ADSET" ? "EXISTING_ADSET" : mode === "CLONE_ADSET" ? "CLONE_ADSET" : "NEW_CAMPAIGN");
        }
        setTargetAdSetId(String(lau?.targetAdSetId || ""));
        setTemplateAdSetId(String(lau?.templateAdSetId || ""));
        setLaunchDailyBudget(num(lau?.dailyBudget) || 1000000);
        setRequireInventoryMatch(lau?.requireInventoryMatch !== false);
        setBlockCriticalStock(lau?.blockCriticalStock !== false);
        setAutoActivate(lau?.autoActivate !== false);
      } else {
        setLaunchAvailable(false);
        setLaunch({});
        setLaunchEnabled(false);
        setLaunchError("Auto Launch backend chưa được deploy. Ads / Scale / tồn kho vẫn hoạt động bình thường.");
      }

      if (launchResults[1].status === "fulfilled") {
        const posts: any = launchResults[1].value;
        setLaunchPosts(Array.isArray(posts) ? posts : posts?.items || posts?.posts || []);
      } else {
        setLaunchPosts([]);
      }

      if (launchResults[2].status === "fulfilled") {
        const options: any = launchResults[2].value;
        setMappingOptions(Array.isArray(options) ? options : options?.items || []);
      }

      const coreFailed = core.slice(0, 4).filter((x) => x.status === "rejected");
      if (coreFailed.length >= 3) {
        const first = coreFailed[0] as PromiseRejectedResult;
        setError(first.reason?.message || "Không tải được dữ liệu Autopilot core.");
      }
    } catch (e: any) {
      setError(e?.message || "Không tải được Autopilot");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  const adSetOptions = useMemo(() => {
    const m = new Map<string, AnyRow>();
    liveAds.forEach((x) => {
      const id = String(x.metaAdSetId || x.adSetId || "");
      if (id && !m.has(id)) m.set(id, { id, name: x.adSetName || id, campaignName: x.campaignName || "" });
    });
    return Array.from(m.values());
  }, [liveAds]);

  const activeAds = liveAds.filter((x) => String(x.effectiveStatus || x.status || "").toUpperCase() === "ACTIVE" && Boolean(String(x.thumbnailUrl || x.thumbnail_url || "").trim()));
  const criticalAds = liveAds.filter((x) => String(assessments[String(x.metaAdId || x.id || "")]?.level || "").toUpperCase().includes("CRITICAL"));
  const readyPosts = launchPosts.filter((x) => ["READY", "CREATED_PAUSED"].includes(String(x.state || "").toUpperCase()));
  const operationalAds = liveAds.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toUpperCase();
    const hasCreative = Boolean(String(row.thumbnailUrl || row.thumbnail_url || "").trim());
    return status === "ACTIVE" && hasCreative;
  });
  const filteredAds = operationalAds.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toUpperCase();
    const stock = assessments[String(row.metaAdId || row.id || "")] || {};
    if (adFilter === "active") return status === "ACTIVE";
    if (adFilter === "paused") return status === "PAUSED";
    if (adFilter === "stock") return ["LOW_STOCK", "CRITICAL"].includes(String(stock.level || "").toUpperCase());
    if (adFilter === "scale") {
      const spend = num(row.spend24h ?? row.spend);
      const roas = num(row.roas24h ?? row.roas);
      return status === "ACTIVE" && spend >= minSpend && roas >= scaleRoas && String(stock.level || "").toUpperCase() !== "CRITICAL";
    }
    return true;
  });

  function budgetOf(row: AnyRow) {
    const directCurrent = num(row.currentBudget);
    if (directCurrent > 0) {
      const level = String(row.budgetLevel || '').toUpperCase() === 'ADSET' ? 'Ad Set' : 'Campaign';
      return { value: directCurrent, level };
    }

    const directAdSetBudget = num(row.adSetDailyBudget ?? row.adsetDailyBudget ?? row.adset_daily_budget);
    if (directAdSetBudget > 0) return { value: directAdSetBudget, level: 'Ad Set' };

    const directCampaignBudget = num(row.campaignDailyBudget ?? row.campaign_daily_budget);
    if (directCampaignBudget > 0) return { value: directCampaignBudget, level: 'Campaign' };

    const adSetId = String(row.metaAdSetId || row.adSetId || '');
    const campaignId = String(row.metaCampaignId || row.campaignId || '');
    const adSet = budgets.adSets.find((x) => String(x.metaAdSetId || x.id || '') === adSetId);
    if (num(adSet?.dailyBudget ?? adSet?.daily_budget) > 0) return { value: num(adSet?.dailyBudget ?? adSet?.daily_budget), level: 'Ad Set' };
    const campaign = budgets.campaigns.find((x) => String(x.metaCampaignId || x.id || '') === campaignId);
    if (num(campaign?.dailyBudget ?? campaign?.daily_budget) > 0) return { value: num(campaign?.dailyBudget ?? campaign?.daily_budget), level: 'Campaign' };
    return { value: 0, level: '—' };
  }

  function scaleCount(row: AnyRow) {
    const adSetId = String(row.metaAdSetId || row.adSetId || "");
    return scaleHistory.filter((x) => String(x.metaAdSetId || x?.errorJson?.metaAdSetId || "") === adSetId).length;
  }

  async function saveSettings() {
    setBusy(true); setError(""); setMessage("");
    try {
      const tasks: Promise<any>[] = [
        apiJson("/meta-ads/autopilot/performance/config", { method: "POST", body: JSON.stringify({ enabled: performanceEnabled, dryRun, level, scaleRoas, scalePercent, minSpend }) }),
        apiJson("/meta-ads/autopilot/inventory/config", { method: "POST", body: JSON.stringify({ enabled: inventoryEnabled, dryRun, level, warnThreshold, pauseThreshold, criticalSizeCount, pauseTotalQty, requireBoth }) }),
      ];
      if (launchAvailable) {
        tasks.push(apiJson("/meta-ads/autopilot/launch/config", { method: "POST", body: JSON.stringify({ enabled: launchEnabled, dryRun, level, waitHours, launchMode: "NEW_CAMPAIGN", targetAdSetId: "", templateAdSetId, dailyBudget: launchDailyBudget, requireInventoryMatch, blockCriticalStock, autoActivate }) }));
      }
      await Promise.all(tasks);
      setMessage("Đã lưu cấu hình Autopilot."); await loadAll(false);
    } catch (e: any) { setError(e?.message || "Không lưu được cấu hình"); }
    finally { setBusy(false); }
  }

  async function changeLevel(next: AutomationLevel) {
    setLevel(next); setSelectedLevel(next); setBusy(true);
    try {
      const tasks: Promise<any>[] = [
        apiJson("/meta-ads/autopilot/performance/config", { method: "POST", body: JSON.stringify({ level: next }) }),
        apiJson("/meta-ads/autopilot/inventory/config", { method: "POST", body: JSON.stringify({ level: next }) }),
      ];
      if (launchAvailable) tasks.push(apiJson("/meta-ads/autopilot/launch/config", { method: "POST", body: JSON.stringify({ level: next }) }));
      await Promise.all(tasks);
      setMessage(`Đã chuyển sang ${next === "manual" ? "Mức 1 Manual" : next === "semi" ? "Mức 2 Semi" : "Mức 3 Auto"}.`);
    } catch (e: any) { setError(e?.message || "Không đổi được chế độ"); }
    finally { setBusy(false); }
  }

  async function setAdStatus(row: AnyRow, status: "ACTIVE" | "PAUSED") {
    const id = String(row.metaAdId || row.id || ""); if (!id) return;
    setBusy(true); setError("");
    try {
      await apiJson("/meta-ads/actions/ad-status", { method: "POST", body: JSON.stringify({ metaAdId: id, status }) });
      setMessage(status === "ACTIVE" ? "Đã bật Ad." : "Đã pause Ad."); await loadAll(false);
    } catch (e: any) { setError(e?.message || "Không đổi được trạng thái Ad"); }
    finally { setBusy(false); }
  }

  async function scaleAd(row: AnyRow, percent: number) {
    const adSetId = String(row.metaAdSetId || row.adSetId || ""); if (!adSetId) return;
    setBusy(true); setError("");
    try {
      const result = await apiJson("/meta-ads/actions/scale-adset", { method: "POST", body: JSON.stringify({ metaAdSetId: adSetId, percent, dryRun, metaAdId: row.metaAdId || row.id, source: "mobile_manual" }) });
      setMessage(dryRun ? `DRY RUN: ${money(result?.oldBudget)} → ${money(result?.newBudget)}` : `Đã scale +${percent}%: ${money(result?.oldBudget)} → ${money(result?.newBudget)}`);
      await loadAll(false);
    } catch (e: any) { setError(e?.message || "Không scale được"); }
    finally { setBusy(false); }
  }

  async function runPerformanceNow() {
    setBusy(true); setError("");
    try {
      const r = await apiJson("/meta-ads/autopilot/performance/run", {
        method: "POST",
        body: JSON.stringify({ dryRun }),
      });
      setMessage(`Auto Scale: quét ${r?.scannedAdSets || r?.summary?.scannedAdSets || 0} ad set · scale ${r?.scaled || r?.summary?.scaled || 0}.`);
      await loadAll(false);
    } catch (e: any) { setError(e?.message || "Không chạy được Auto Scale"); }
    finally { setBusy(false); }
  }

  async function runInventoryNow() {
    setBusy(true); setError("");
    try {
      const r = await apiJson("/meta-ads/autopilot/inventory/run", {
        method: "POST",
        body: JSON.stringify({ dryRun }),
      });
      setMessage(`Check ${r?.activeAds || 0} Ads ACTIVE · match ${r?.matchedAds || 0} · critical ${r?.criticalGroups || 0} · pause ${r?.pausedAds || 0}.`);
      await loadAll(false);
    } catch (e: any) { setError(e?.message || "Không chạy được check tồn"); }
    finally { setBusy(false); }
  }

  async function scanPublishedPosts() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await apiJson("/meta-ads/autopilot/launch/run", {
        method: "POST",
        body: JSON.stringify({ discoverOnly: true, scanLimit: 100, dryRun: true }),
      });
      setMessage(`Đã quét ${r?.summary?.scanned || 0} bài đã đăng · chưa chạy Ads ${r?.summary?.withoutAds || 0} · đã có Ads ${r?.summary?.withAds || 0}.`);
      await loadAll(false);
      setPostFilter("no_ad");
    } catch (e: any) { setError(e?.message || "Không quét được bài đã đăng"); }
    finally { setBusy(false); }
  }

  async function savePostMapping(post: AnyRow) {
    const postId = String(post.postId || post.id || "");
    const currentAssessment = post.assessment || {};
    const productCode = String(manualProductByPost[postId] ?? currentAssessment.productCode ?? "").trim().toUpperCase();
    const color = String(manualColorByPost[postId] ?? currentAssessment.color ?? "").trim();

    if (!productCode) {
      setError("Chọn mã sản phẩm trước.");
      return;
    }

    setBusy(true); setError(""); setMessage("");
    try {
      const r = await apiJson("/meta-ads/autopilot/launch/map", {
        method: "POST",
        body: JSON.stringify({ postId, productCode, color: color || undefined }),
      });
      if (r?.ok === false) throw new Error(r?.error || r?.assessment?.reason || "Mapping chưa chính xác");
      setMessage(`Đã lưu mapping ${r?.assessment?.productCode || productCode}${r?.assessment?.color ? ` · ${r.assessment.color}` : ""}. Chưa chạy Ads.`);
      await loadAll(false);
    } catch (e: any) {
      setError(e?.message || "Không lưu được mapping");
    } finally {
      setBusy(false);
    }
  }

  async function runLaunch() {
    setBusy(true); setError("");
    try {
      const r = await apiJson("/meta-ads/autopilot/launch/run", { method: "POST", body: JSON.stringify({ dryRun }) });
      setMessage(`Đã quét ${r?.summary?.scanned || 0} bài · xử lý ${r?.summary?.launched || 0}.`); await loadAll(false);
    } catch (e: any) { setError(e?.message || "Không chạy được Auto Launch"); }
    finally { setBusy(false); }
  }

  async function skipPost(postId: string) {
    setBusy(true);
    try { await apiJson("/meta-ads/autopilot/launch/skip", { method: "POST", body: JSON.stringify({ postId }) }); setMessage("Đã bỏ qua bài viết."); await loadAll(false); }
    catch (e: any) { setError(e?.message || "Không bỏ qua được bài"); }
    finally { setBusy(false); }
  }

  const visiblePosts = launchPosts.filter((post) => {
    const hasAd = Boolean(post?.hasAd || post?.metaAdId || String(post?.state || "").toUpperCase() === "ALREADY_AD");
    if (postFilter === "has_ad") return hasAd;
    if (postFilter === "no_ad") return !hasAd;
    return true;
  });

  const levelInfo: Record<AutomationLevel, { title: string; desc: string; points: string[] }> = {
    manual: {
      title: "Mức 1 · Theo dõi",
      desc: "Hệ thống chỉ theo dõi, cảnh báo và hiển thị đề xuất. Không tự thay đổi Meta.",
      points: ["Không tự scale", "Không tự pause", "Bài đủ 48h chỉ chuyển READY để mày tự xử lý"],
    },
    semi: {
      title: "Mức 2 · Xét duyệt",
      desc: "Backend đánh giá và chuẩn bị hành động, nhưng các thay đổi quan trọng vẫn chờ mày duyệt.",
      points: ["Scale chỉ đề xuất", "Pause tồn kho chỉ cảnh báo", "Bài đủ 48h có thể tạo Ad PAUSED để duyệt"],
    },
    auto: {
      title: "Mức 3 · Tự động",
      desc: "Các module đang bật sẽ tự tác động Meta theo rule đã lưu khi DRY RUN tắt.",
      points: ["Tự scale khi đủ ROAS/spend/tồn", "Tự pause đúng Ad thiếu hàng", "Tự tạo/bật Ads bài đủ điều kiện"],
    },
  };


  return (
    <main className="min-h-[100dvh] bg-[#f4f4f2] pb-[calc(96px+env(safe-area-inset-bottom))] text-neutral-950">
      <div className="sticky top-0 z-30 border-b border-neutral-200 bg-[#f4f4f2]/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile/home" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
            <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Meta Ads</div><h1 className="text-xl font-black tracking-tight">Autopilot</h1></div>
          </div>
          <button onClick={() => void loadAll()} disabled={loading || busy} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}

        <section className="overflow-hidden rounded-[28px] bg-neutral-950 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><div className="flex items-center gap-2 text-[11px] font-bold text-neutral-400"><Sparkles className="h-4 w-4" /> AUTOPILOT LIVE</div><div className="mt-2 text-2xl font-black">{level === "manual" ? "Mức 1 · Manual" : level === "semi" ? "Mức 2 · Semi" : "Mức 3 · Auto"}</div></div>
            <Badge value={dryRun ? "WAIT" : "ACTIVE"}>{dryRun ? "DRY RUN" : "LIVE"}</Badge>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3"><div className="text-[10px] text-neutral-400">Ads active</div><div className="mt-1 text-xl font-black">{activeAds.length}</div></div>
            <div className="rounded-2xl bg-white/10 p-3"><div className="text-[10px] text-neutral-400">Critical</div><div className="mt-1 text-xl font-black">{criticalAds.length}</div></div>
            <div className="rounded-2xl bg-white/10 p-3"><div className="text-[10px] text-neutral-400">Chờ duyệt</div><div className="mt-1 text-xl font-black">{readyPosts.length}</div></div>
          </div>
        </section>

        <section className="rounded-[26px] border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            {([
              ["manual", "Mức 1", "Theo dõi"], ["semi", "Mức 2", "Xét duyệt"], ["auto", "Mức 3", "Tự động"],
            ] as Array<[AutomationLevel, string, string]>).map(([id, title, desc]) => (
              <button key={id} disabled={busy} onClick={() => setSelectedLevel(id)} className={`relative rounded-2xl border px-2 py-3 text-center ${selectedLevel === id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50"}`}>
                {level === id ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" /> : null}
                <div className="text-xs font-black">{title}</div><div className={`mt-1 text-[10px] ${selectedLevel === id ? "text-neutral-300" : "text-neutral-400"}`}>{desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
            <div className="text-sm font-black">{levelInfo[selectedLevel].title}</div>
            <div className="mt-1 text-[11px] leading-5 text-neutral-500">{levelInfo[selectedLevel].desc}</div>
            <div className="mt-2 space-y-1">{levelInfo[selectedLevel].points.map((p) => <div key={p} className="text-[11px] font-semibold text-neutral-600">• {p}</div>)}</div>
          </div>
          <button disabled={busy || selectedLevel === level} onClick={() => void changeLevel(selectedLevel)} className="mt-3 h-11 w-full rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:bg-neutral-200 disabled:text-neutral-500">
            {selectedLevel === level ? `Đang bật ${levelInfo[level].title}` : `Bật ${levelInfo[selectedLevel].title}`}
          </button>
        </section>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-neutral-200/70 p-1">
          {([['ads','Ads',Zap],['posts','Bài mới',Rocket],['settings','Cài đặt',Settings2]] as Array<[TabKey,string,any]>).map(([id,label,Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-black ${tab === id ? "bg-white shadow-sm" : "text-neutral-500"}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>

        {loading ? <div className="py-16 text-center text-sm font-bold text-neutral-400">Đang tải Autopilot...</div> : null}

        {!loading && tab === "ads" ? <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              ["all","Tất cả"],["active","ACTIVE"],["paused","PAUSED"],["scale","Có thể scale"],["stock","Thiếu size"],
            ] as Array<[typeof adFilter,string]>).map(([id,label]) => (
              <button key={id} onClick={() => setAdFilter(id)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${adFilter === id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-500"}`}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => void runPerformanceNow()} className="h-11 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40">Chạy Auto Scale</button>
            <button disabled={busy} onClick={() => void runInventoryNow()} className="h-11 rounded-2xl border border-neutral-200 bg-white text-xs font-black text-neutral-700 disabled:opacity-40">Check tồn ngay</button>
          </div>
          {filteredAds.map((row) => {
            const id = String(row.metaAdId || row.id || "");
            const stock = assessments[id] || {};
            const budget = budgetOf(row);
            const status = String(row.effectiveStatus || row.status || "—").toUpperCase();
            const expanded = expandedId === id;
            const historyCount = scaleCount(row);
            return <article key={id} className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm">
              <div className="flex gap-3 p-4">
                {row.thumbnailUrl || row.thumbnail_url ? <img src={row.thumbnailUrl || row.thumbnail_url} alt="" className="h-20 w-20 rounded-2xl object-cover bg-neutral-100" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-neutral-100"><Activity className="h-6 w-6 text-neutral-400" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-black leading-5">{row.adName || row.name || row.ad_name || `Ad ${String(row.metaAdId || row.id || "").slice(-6)}`}</div>
                  <div className="mt-1 flex flex-wrap gap-1"><Badge value={status}>{status}</Badge>{stock?.level ? <Badge value={stock.level}>{stock.level}</Badge> : null}{historyCount ? <Badge value="ACTIVE">✓{historyCount}</Badge> : null}</div>
                  <div className="mt-2 text-xs font-bold text-neutral-600">{stock?.productCode ? `${stock.productCode} · ${stock.color || ""}` : "Chưa map mã / màu"}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-y border-neutral-100 bg-neutral-50">
                <div className="p-3"><div className="text-[10px] text-neutral-400">Budget</div><div className="mt-1 text-xs font-black">{budget.value ? money(budget.value) : "Chưa lấy được"}</div><div className="text-[9px] text-neutral-400">{budget.value ? budget.level : "Meta chưa trả budget"}</div></div>
                <div className="p-3"><div className="text-[10px] text-neutral-400">Tồn màu</div><div className="mt-1 text-xs font-black">{stock?.totalQty ?? "—"}</div><div className="text-[9px] text-neutral-400">min size {stock?.minQty ?? "—"}</div></div>
                <div className="p-3"><div className="text-[10px] text-neutral-400">Ad Set</div><div className="mt-1 truncate text-xs font-black">{row.adSetName || row.metaAdSetId || row.adSetId || "—"}</div><div className="text-[9px] text-neutral-400">{row.campaignName || row.metaCampaignId || row.campaignId || "—"}</div></div>
              </div>
              <button onClick={() => setExpandedId(expanded ? "" : id)} className="flex w-full items-center justify-between px-4 py-3 text-xs font-black"><span>Chi tiết & thao tác</span>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
              {expanded ? <div className="space-y-3 border-t border-neutral-100 p-4">
                <div><div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">Tồn từng size</div><div className="flex flex-wrap gap-2">{Array.isArray(stock?.sizes) && stock.sizes.length ? stock.sizes.map((s: AnyRow) => <span key={String(s.size)} className={`rounded-xl border px-2.5 py-1.5 text-xs font-black ${num(s.qty) < pauseThreshold ? "border-rose-200 bg-rose-50 text-rose-700" : num(s.qty) < warnThreshold ? "border-amber-200 bg-amber-50 text-amber-700" : "border-neutral-200 bg-neutral-50"}`}>{s.size}: {s.qty}</span>) : <span className="text-xs text-neutral-400">Chưa có dữ liệu tồn.</span>}</div></div>
                <div className="rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">{stock?.reason || "Chưa có đánh giá tồn kho."}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Spend 24h</div><div className="mt-1 text-xs font-black">{money(row.spend24h ?? row.spend ?? 0)}</div></div>
                  <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">DT nội bộ</div><div className="mt-1 text-xs font-black">{money(row.revenue24h ?? row.revenue ?? 0)}</div></div>
                  <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">ROAS</div><div className="mt-1 text-xs font-black">{pct(row.roas24h ?? row.roas ?? 0)}</div></div>
                </div>
                {historyCount ? <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">Lịch sử scale</div>
                  <div className="space-y-2">
                    {scaleHistory.filter((x) => String(x.metaAdSetId || x?.errorJson?.metaAdSetId || "") === String(row.metaAdSetId || row.adSetId || "")).slice(0,5).map((x,idx) => (
                      <div key={String(x.id || idx)} className="rounded-xl bg-neutral-50 px-3 py-2 text-[11px]">
                        <div className="font-black">+{num(x.percent || x?.errorJson?.percent)}% · {String(x.budgetLevel || x?.errorJson?.budgetLevel || "ADSET")}</div>
                        <div className="mt-0.5 text-neutral-500">{money(x.oldBudget || x?.errorJson?.oldBudget)} → {money(x.newBudget || x?.errorJson?.newBudget)} · {x.source || x?.errorJson?.source || "manual"}</div>
                      </div>
                    ))}
                  </div>
                </div> : null}
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={busy || status !== "ACTIVE"} onClick={() => void scaleAd(row, 20)} className="h-11 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40">+20%</button>
                  <button disabled={busy || status !== "ACTIVE"} onClick={() => void scaleAd(row, 30)} className="h-11 rounded-2xl bg-neutral-800 text-xs font-black text-white disabled:opacity-40">+30%</button>
                  {status === "ACTIVE" ? <button disabled={busy} onClick={() => void setAdStatus(row, "PAUSED")} className="col-span-2 h-11 rounded-2xl bg-rose-600 text-xs font-black text-white"><Pause className="mr-1 inline h-4 w-4" /> Pause Ad</button> : <button disabled={busy || status !== "PAUSED"} onClick={() => void setAdStatus(row, "ACTIVE")} className="col-span-2 h-11 rounded-2xl bg-emerald-700 text-xs font-black text-white disabled:opacity-40"><Play className="mr-1 inline h-4 w-4" /> Bật lại / Duyệt Ad</button>}
                </div>
              </div> : null}
            </article>;
          })}
          {!filteredAds.length ? <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-neutral-400">Không có Ads phù hợp bộ lọc.</div> : null}
        </div> : null}

        {!loading && tab === "posts" ? <div className="space-y-3">
          {!launchAvailable ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-800">{launchError || "Auto Launch backend chưa sẵn sàng."}</div> : null}
          <button disabled={busy || !launchAvailable} onClick={() => void scanPublishedPosts()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40"><RefreshCw className="h-4 w-4" /> Quét 100 bài đã đăng</button>
          <div className="rounded-2xl bg-neutral-100 p-3 text-[11px] leading-5 text-neutral-500">Quét cả bài cũ trong 100 bài published gần nhất, không chỉ bài hôm nay. Chế độ quét này chỉ phát hiện trạng thái, không tự tạo Ads.</div>
          <div className="grid grid-cols-3 gap-2">
            {([["no_ad","Chưa chạy Ads"],["has_ad","Đã có Ads"],["all","Tất cả"]] as Array<[typeof postFilter,string]>).map(([id,label]) => <button key={id} onClick={() => setPostFilter(id)} className={`rounded-xl border px-2 py-2 text-[10px] font-black ${postFilter === id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-500"}`}>{label}</button>)}
          </div>
          {visiblePosts.map((post) => {
            const state = String(post.state || "WAITING").toUpperCase();
            const a = post.assessment || {};
            const image = postImage(post);
            return <article key={String(post.postId)} className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm">
              {image ? <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100"><img src={image} alt="" className="h-full w-full object-cover" /></div> : null}
              <div className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="line-clamp-3 text-sm font-black leading-5">{post.message || post.postId}</div><div className="mt-1 text-[10px] text-neutral-400">{post.createdTime ? new Date(post.createdTime).toLocaleString("vi-VN") : "—"}</div></div><div className="flex flex-col items-end gap-1"><Badge value={state === "WAITING_MAPPED" ? "READY" : state}>{state === "WAITING_MAPPED" ? "MAPPED" : state}</Badge><span className={`text-[9px] font-black ${post?.hasAd || post?.metaAdId || state === "ALREADY_AD" ? "text-emerald-700" : "text-amber-700"}`}>{post?.hasAd || post?.metaAdId || state === "ALREADY_AD" ? "ĐÃ CÓ ADS" : "CHƯA CHẠY ADS"}</span></div></div>
              <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
                <div className="text-[10px] font-black uppercase text-neutral-400">Mapping</div>
                <div className="mt-1 text-sm font-black">{a.productCode ? `${a.productCode} · ${a.color || "Chưa màu"}` : "Chưa xác định sản phẩm"}</div>
                <div className="mt-1 text-xs text-neutral-500">{a.productCode ? `Tổng tồn ${a.totalQty ?? "—"} · min size ${a.minQty ?? "—"}` : a.reason || "Hashtag mã SP hoặc xác nhận mapping trước khi chạy."}</div>

                <div className="mt-3 border-t border-neutral-200 pt-3">
                  <div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Xác nhận / sửa thủ công</div>
                  {(() => {
                    const postId = String(post.postId || post.id || "");
                    const selectedCode = String(manualProductByPost[postId] ?? a.productCode ?? "").toUpperCase();
                    const selectedProduct = mappingOptions.find((x) => String(x.productCode || "").toUpperCase() === selectedCode);
                    const colors = Array.isArray(selectedProduct?.colors) ? selectedProduct.colors : [];
                    return <div className="mt-2 space-y-2">
                      <input
                        value={productSearchByPost[postId] ?? ""}
                        onChange={(e) => setProductSearchByPost((prev) => ({ ...prev, [postId]: e.target.value }))}
                        placeholder="Gõ mã hoặc tên SP để tìm..."
                        className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold outline-none"
                      />
                      <select
                        className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold outline-none"
                        value={selectedCode}
                        onChange={(e) => {
                          const code = e.target.value.toUpperCase();
                          setManualProductByPost((prev) => ({ ...prev, [postId]: code }));
                          setManualColorByPost((prev) => ({ ...prev, [postId]: "" }));
                        }}
                      >
                        <option value="">Chọn mã sản phẩm...</option>
                        {mappingOptions
                          .filter((x) => {
                            const q = String(productSearchByPost[postId] || "").trim().toLowerCase();
                            if (!q) return true;
                            return String(x.productCode || "").toLowerCase().includes(q) ||
                                   String(x.productName || "").toLowerCase().includes(q);
                          })
                          .slice(0, 80)
                          .map((x) => <option key={String(x.productCode)} value={String(x.productCode)}>{x.productCode} · {x.productName}</option>)}
                      </select>

                      <select
                        className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                        value={manualColorByPost[postId] ?? a.color ?? ""}
                        disabled={!selectedCode}
                        onChange={(e) => setManualColorByPost((prev) => ({ ...prev, [postId]: e.target.value }))}
                      >
                        <option value="">{colors.length > 1 ? "Chọn màu..." : colors.length === 1 ? colors[0]?.color : "Chưa có màu"}</option>
                        {colors.map((c: AnyRow) => <option key={String(c.color)} value={String(c.color)}>{c.color} · tồn {c.totalQty}</option>)}
                      </select>

                      <button
                        disabled={busy || !selectedCode || (colors.length > 1 && !(manualColorByPost[postId] ?? a.color))}
                        onClick={() => void savePostMapping(post)}
                        className="h-10 w-full rounded-xl border border-neutral-950 bg-white text-xs font-black text-neutral-950 disabled:border-neutral-200 disabled:text-neutral-300"
                      >
                        Lưu mapping với kho
                      </button>
                    </div>;
                  })()}
                </div>
              </div>
              {post.metaAdId ? <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700"><BadgeCheck className="h-4 w-4" /> Ad: {post.metaAdId}</div> : null}
              {state === "UNMAPPED" ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-800">Bài chưa map mã + màu. Chọn đúng mã và màu rồi lưu mapping trước khi chạy Ads.</div> : null}
              {state === "WAITING_MAPPED" ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold leading-5 text-emerald-800">Đã lưu mapping với kho. Chưa tạo Ads. Bấm “Chạy bài này” để sang bước xác nhận.</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {state === "CREATED_PAUSED" && post.metaAdId ? (
                  <button disabled={busy} onClick={() => void setAdStatus({ metaAdId: post.metaAdId }, "ACTIVE")} className="h-11 rounded-2xl bg-emerald-700 text-xs font-black text-white">Duyệt & bật Ad</button>
                ) : confirmRunPostId === String(post.postId || post.id || "") ? (
                  <div className="col-span-2 rounded-2xl border border-neutral-950 bg-neutral-50 p-3">
                    <div className="text-xs font-black">Xác nhận chạy Ads?</div>
                    <div className="mt-1 text-[10px] leading-4 text-neutral-500">Sau bước này hệ thống mới tạo Campaign / Ad Set / Ad theo cấu hình Auto Launch đã lưu.</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button disabled={busy} onClick={() => setConfirmRunPostId(null)} className="h-10 rounded-xl border border-neutral-200 bg-white text-xs font-black text-neutral-600">Huỷ</button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const postId = String(post.postId || post.id || "");
                          void apiJson("/meta-ads/autopilot/launch/run", {
                            method: "POST",
                            body: JSON.stringify({
                              postId,
                              force: true,
                              manualOverride: true,
                              manualProductCode: manualProductByPost[postId] || a.productCode || undefined,
                              manualColor: manualColorByPost[postId] || a.color || undefined,
                              dryRun,
                            }),
                          }).then(() => {
                            setConfirmRunPostId(null);
                            return loadAll(false);
                          }).catch((e) => setError(e.message));
                        }}
                        className="h-10 rounded-xl bg-neutral-950 text-xs font-black text-white"
                      >
                        Xác nhận chạy Ads
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={busy || !["READY","WAITING","WAITING_MAPPED"].includes(state)}
                    onClick={() => setConfirmRunPostId(String(post.postId || post.id || ""))}
                    className="h-11 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40"
                  >
                    {dryRun ? "Xem trước chạy Ads" : "Chạy bài này"}
                  </button>
                )}
                <button disabled={busy} onClick={() => void skipPost(String(post.postId))} className="h-11 rounded-2xl border border-neutral-200 bg-white text-xs font-black text-neutral-600">Bỏ qua</button>
              </div>
              </div>
            </article>;
          })}
          {!visiblePosts.length ? <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-neutral-400">Không có bài phù hợp bộ lọc. Bấm “Quét 100 bài đã đăng”.</div> : null}
        </div> : null}

        {!loading && tab === "settings" ? <div className="space-y-4">
          <section className="rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-black"><ShieldAlert className="h-4 w-4" /> Chế độ an toàn</div><div className="mt-1 text-[11px] text-neutral-400">DRY RUN không ghi thay đổi lên Meta.</div></div><Toggle checked={dryRun} onChange={setDryRun} /></div>
          </section>

          <section className="rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-black"><CircleDollarSign className="h-4 w-4" /> Auto Scale</div><div className="mt-1 text-[11px] text-neutral-400">Scale theo ROAS và tồn kho.</div></div><Toggle checked={performanceEnabled} onChange={setPerformanceEnabled} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><Field label="ROAS tối thiểu"><input className={inputClass} type="number" step="0.1" value={scaleRoas} onChange={e => setScaleRoas(num(e.target.value))} /></Field><Field label="Tăng mỗi lần (%)"><input className={inputClass} type="number" value={scalePercent} onChange={e => setScalePercent(num(e.target.value))} /></Field><div className="col-span-2"><Field label="Spend tối thiểu"><input className={inputClass} type="number" value={minSpend} onChange={e => setMinSpend(num(e.target.value))} /></Field></div></div>
          </section>

          <section className="rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-black"><PackageCheck className="h-4 w-4" /> Auto Pause tồn kho</div><div className="mt-1 text-[11px] text-neutral-400">Dừng đúng Ad con khi hàng xuống thấp.</div></div><Toggle checked={inventoryEnabled} onChange={setInventoryEnabled} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><Field label="Warning size <"><input className={inputClass} type="number" value={warnThreshold} onChange={e => setWarnThreshold(num(e.target.value))} /></Field><Field label="Critical size <"><input className={inputClass} type="number" value={pauseThreshold} onChange={e => setPauseThreshold(num(e.target.value))} /></Field><Field label="Số size critical"><input className={inputClass} type="number" value={criticalSizeCount} onChange={e => setCriticalSizeCount(num(e.target.value))} /></Field><Field label="Tổng tồn màu <"><input className={inputClass} type="number" value={pauseTotalQty} onChange={e => setPauseTotalQty(num(e.target.value))} /></Field></div>
            <button onClick={() => setRequireBoth(!requireBoth)} className={`mt-3 flex w-full items-center justify-between rounded-2xl border p-3 text-left text-xs font-bold ${requireBoth ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200"}`}><span>Pause khi đồng thời đủ 2 điều kiện</span><span>{requireBoth ? "AND" : "OR"}</span></button>
          </section>

          <section className={`rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm ${!launchAvailable ? "opacity-70" : ""}`}>
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-black"><Rocket className="h-4 w-4" /> Auto Launch bài mới</div><div className="mt-1 text-[11px] text-neutral-400">Phát hiện bài Page, chờ rồi tạo Ads.</div></div><Toggle checked={launchEnabled} onChange={setLaunchEnabled} disabled={!launchAvailable} /></div>
            {!launchAvailable ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-800">Backend Auto Launch chưa có route. Deploy 3 file backend kèm bộ này để bật phần Bài mới.</div> : null}
            <div className="mt-4 space-y-3">
              <Field label="Chờ sau khi đăng (giờ)"><input className={inputClass} type="number" value={waitHours} onChange={e => setWaitHours(num(e.target.value))} /></Field>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs font-black">Rule tạo Ads</div>
                <div className="mt-2 space-y-1 text-[11px] leading-5 text-neutral-600">
                  <div>• Tạo Campaign mới cho từng bài.</div>
                  <div>• Campaign / Ad Set / Ad dùng cùng một tên.</div>
                  <div>• Mục tiêu: Tương tác → Tin nhắn.</div>
                  <div>• Budget mặc định: {money(launchDailyBudget)} / ngày ở Campaign.</div>
                  <div>• Tên: tên sản phẩm + ngày tạo.</div>
                </div>
              </div>
              <Field label="Ad Set mẫu (chỉ lấy tệp khách hàng/targeting)">
                <select className={inputClass} value={templateAdSetId} onChange={e => setTemplateAdSetId(e.target.value)}>
                  <option value="">Chọn Ad Set mẫu...</option>
                  {adSetOptions.map(x => <option key={x.id} value={x.id}>{x.name} · {x.campaignName}</option>)}
                </select>
              </Field>
              <Field label="Ngân sách Campaign mới / ngày">
                <input className={inputClass} type="number" value={launchDailyBudget} onChange={e => setLaunchDailyBudget(num(e.target.value))} />
              </Field>
            </div>
            <div className="mt-3 space-y-2">{[[requireInventoryMatch,setRequireInventoryMatch,"Chỉ chạy khi match mã + màu"],[blockCriticalStock,setBlockCriticalStock,"Chặn bài tồn CRITICAL"],[autoActivate,setAutoActivate,"Mức 3 tự ACTIVE"]].map(([v,setter,label]: any) => <button key={label} onClick={() => setter(!v)} className="flex w-full items-center justify-between rounded-2xl bg-neutral-50 p-3 text-xs font-bold"><span>{label}</span><Toggle checked={v} onChange={setter} /></button>)}</div>
          </section>

          <button disabled={busy} onClick={() => void saveSettings()} className="flex h-13 w-full items-center justify-center gap-2 rounded-[20px] bg-neutral-950 py-4 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Lưu toàn bộ cài đặt</button>
          <div className="rounded-2xl bg-neutral-100 p-3 text-[11px] leading-5 text-neutral-500"><SlidersHorizontal className="mr-1 inline h-4 w-4" /> Rule hiện tại: ROAS ≥ <b>{scaleRoas}</b>, scale +<b>{scalePercent}%</b>; warning size &lt; <b>{warnThreshold}</b>; critical khi ≥ <b>{criticalSizeCount}</b> size &lt; <b>{pauseThreshold}</b> {requireBoth ? "và" : "hoặc"} tổng tồn màu &lt; <b>{pauseTotalQty}</b>; bài mới chờ <b>{waitHours}h</b>.</div>
        </div> : null}
      </div>
    </main>
  );
}
