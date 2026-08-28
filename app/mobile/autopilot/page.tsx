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
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const hcmDateKey = (value: any) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

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
  const router = useRouter();
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
  const [productSearchOpenByPost, setProductSearchOpenByPost] = useState<Record<string, boolean>>({});
  const [manualProductByAd, setManualProductByAd] = useState<Record<string, string>>({});
  const [manualColorByAd, setManualColorByAd] = useState<Record<string, string>>({});
  const [productSearchByAd, setProductSearchByAd] = useState<Record<string, string>>({});
  const [productSearchOpenByAd, setProductSearchOpenByAd] = useState<Record<string, boolean>>({});
  const [savedMappingByAd, setSavedMappingByAd] = useState<Record<string, { productCode: string; color: string | null; savedAt: string }>>({});
  const [budgetAdjustOpenByAd, setBudgetAdjustOpenByAd] = useState<Record<string, boolean>>({});
  const [budgetAdjustModeByAd, setBudgetAdjustModeByAd] = useState<Record<string, "percent" | "amount">>({});
  const [budgetAdjustPercentByAd, setBudgetAdjustPercentByAd] = useState<Record<string, number>>({});
  const [targetBudgetByAd, setTargetBudgetByAd] = useState<Record<string, number>>({});

  const [performance, setPerformance] = useState<AnyRow>({});
  const [inventory, setInventory] = useState<AnyRow>({});
  const [launch, setLaunch] = useState<AnyRow>({});
  const [launchPosts, setLaunchPosts] = useState<AnyRow[]>([]);
  const [liveAds, setLiveAds] = useState<AnyRow[]>([]);
  const [assessments, setAssessments] = useState<Record<string, AnyRow>>({});
  const [budgets, setBudgets] = useState<{ adSets: AnyRow[]; campaigns: AnyRow[] }>({ adSets: [], campaigns: [] });
  const [scaleHistory, setScaleHistory] = useState<AnyRow[]>([]);
  const [insightRangeByAd, setInsightRangeByAd] = useState<Record<string, "today" | "yesterday" | "7d">>({});
  const [insightsByRange, setInsightsByRange] = useState<Record<string, Record<string, AnyRow>>>({});
  const [insightLoadingKey, setInsightLoadingKey] = useState("");


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
  const [templateAdSets, setTemplateAdSets] = useState<AnyRow[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [launchDailyBudget, setLaunchDailyBudget] = useState(1000000);
  const [requireInventoryMatch, setRequireInventoryMatch] = useState(true);
  const [blockCriticalStock, setBlockCriticalStock] = useState(true);
  const [autoActivate, setAutoActivate] = useState(true);

  async function ensureAdInsights(range: "today" | "yesterday" | "7d") {
    if (insightsByRange[range]) return;
    const key = `range:${range}`;
    setInsightLoadingKey(key);
    try {
      const payload = await apiJson(`/meta-ads/live-insights?range=${range}&level=ad&limit=1000`);
      const rows = Array.isArray(payload?.topAds) ? payload.topAds : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.rows) ? payload.rows : [];
      const map: Record<string, AnyRow> = {};
      for (const row of rows) {
        const id = String(row?.metaAdId || row?.adId || row?.id || "").trim();
        if (id) map[id] = row;
      }
      setInsightsByRange((prev) => ({ ...prev, [range]: map }));
    } catch (e: any) {
      setError(e?.message || "Không tải được kết quả Ads");
    } finally {
      setInsightLoadingKey("");
    }
  }

  function insightForAd(adId: string) {
    const range = insightRangeByAd[adId] || "today";
    return {
      range,
      row: insightsByRange[range]?.[adId] || null,
      loading: insightLoadingKey === `range:${range}`,
    };
  }

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
          revenue24h: ctl.revenue24h ?? ctl.productAttribution?.totalRevenue ?? ctl.productAttribution?.familyOrderRevenue ?? ctl.productAttribution?.orderRevenue ?? raw.revenue24h ?? raw.revenue,
          facebookRevenue24h: ctl.facebookRevenue24h ?? ctl.productAttribution?.facebookRevenue ?? raw.facebookRevenue24h,
          posRevenue24h: ctl.posRevenue24h ?? ctl.productAttribution?.posRevenue ?? raw.posRevenue24h,
          roasFacebook24h: ctl.roasFacebook24h ?? ctl.productAttribution?.facebookRoas ?? raw.roasFacebook24h,
          roasPos24h: ctl.roasPos24h ?? ctl.productAttribution?.posRoas ?? raw.roasPos24h,
          roas24h: ctl.roasTotal24h ?? ctl.roas24h ?? ctl.productAttribution?.totalRoas ?? ctl.productAttribution?.realRoasEstimate ?? raw.roas24h ?? raw.roas,
          manualProductCode: ctl.manualProductCode ?? raw.manualProductCode ?? ctl.manualMapping?.productCode ?? raw.manualMapping?.productCode ?? null,
          manualColor: ctl.manualColor ?? raw.manualColor ?? ctl.manualMapping?.color ?? raw.manualMapping?.color ?? null,
          manualMapping: ctl.manualMapping ?? raw.manualMapping ?? null,
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

    templateAdSets.forEach((x) => {
      const id = String(x.id || x.metaAdSetId || x.adSetId || "");
      if (id && !m.has(id)) m.set(id, {
        id,
        name: x.name || x.adSetName || id,
        campaignName: x.campaignName || "",
        effectiveStatus: x.effectiveStatus || x.status || "",
        updatedTime: x.updatedTime || null,
      });
    });

    liveAds.forEach((x) => {
      const id = String(x.metaAdSetId || x.adSetId || "");
      if (id && !m.has(id)) m.set(id, {
        id,
        name: x.adSetName || id,
        campaignName: x.campaignName || "",
        effectiveStatus: x.adSetEffectiveStatus || x.effectiveStatus || "",
      });
    });

    return Array.from(m.values());
  }, [liveAds, templateAdSets]);

  async function searchTemplateAdSets(q = templateSearch) {
    setTemplateLoading(true);
    setError("");
    try {
      const r = await apiJson(`/meta-ads/autopilot/launch/adset-templates?q=${encodeURIComponent(q.trim())}&limit=120`);
      setTemplateAdSets(Array.isArray(r?.items) ? r.items : []);
    } catch (e: any) {
      setError(e?.message || "Không tìm được Ad Set mẫu");
    } finally {
      setTemplateLoading(false);
    }
  }

  const activeAds = liveAds.filter((x) => String(x.effectiveStatus || x.status || "").toUpperCase() === "ACTIVE" && Boolean(String(x.thumbnailUrl || x.thumbnail_url || "").trim()));
  const criticalAds = liveAds.filter((x) => ["CRITICAL", "FAMILY_LOW_STOCK"].includes(String(assessments[String(x.metaAdId || x.id || "")]?.level || "").toUpperCase()));
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
    if (adFilter === "stock") return ["LOW_STOCK", "CRITICAL", "FAMILY_LOW_STOCK", "FAMILY_WATCH"].includes(String(stock.level || "").toUpperCase());
    if (adFilter === "scale") {
      const spend = num(row.spend24h ?? row.spend);
      const roas = num(row.roas24h ?? row.roas);
      return status === "ACTIVE" && spend >= minSpend && roas >= scaleRoas && String(stock.level || "").toUpperCase() !== "CRITICAL";
    }
    return true;
  });

  const todayScaleHistory = scaleHistory.filter(
    (item) => hcmDateKey(item?.startedAt || item?.createdAt) === hcmDateKey(new Date()),
  );

  function todayScaleLogsForAd(row: AnyRow) {
    const adId = String(row?.metaAdId || row?.id || "").trim();
    const adSetId = String(row?.metaAdSetId || row?.adSetId || "").trim();

    return todayScaleHistory.filter((item) => {
      const logAdId = String(item?.metaAdId || item?.errorJson?.metaAdId || "").trim();
      const logAdSetId = String(item?.metaAdSetId || item?.errorJson?.metaAdSetId || "").trim();

      if (logAdId) return Boolean(adId && logAdId === adId);
      return Boolean(adSetId && logAdSetId && logAdSetId === adSetId);
    });
  }

  const scaledAdsToday = liveAds.filter((row) => todayScaleLogsForAd(row).length > 0);

  function scaleBadgeText(row: AnyRow) {
    const logs = todayScaleLogsForAd(row);
    if (!logs.length) return "";

    const percents = Array.from(
      new Set(
        logs
          .map((item) => Math.round(num(item?.percent ?? item?.errorJson?.percent)))
          .filter((value) => value > 0),
      ),
    );

    return percents.length
      ? `Đã scale ${percents.map((value) => `+${value}%`).join(", ")} hôm nay`
      : "Đã scale hôm nay";
  }

  function autoScaleStatus(row: AnyRow) {
    const reasons = Array.isArray(row?.autoScaleReasons)
      ? row.autoScaleReasons.map((x: any) => String(x || "").trim()).filter(Boolean)
      : [];

    if (row?.autoScaleEligible) {
      if (level !== "auto") {
        return {
          eligible: true,
          title: "ĐỦ ĐIỀU KIỆN · CHỜ AUTO",
          reason: level === "semi"
            ? "Đang ở Mức 2 Semi nên hệ thống chỉ đề xuất, chưa tự tăng ngân sách."
            : "Đang ở Mức 1 Manual nên hệ thống chỉ theo dõi, chưa tự tăng ngân sách.",
        };
      }

      if (dryRun) {
        return {
          eligible: true,
          title: "ĐỦ ĐIỀU KIỆN · DRY RUN",
          reason: "Đang bật DRY RUN nên chưa ghi thay đổi ngân sách lên Meta.",
        };
      }

      return {
        eligible: true,
        title: "ĐỦ ĐIỀU KIỆN AUTO SCALE",
        reason: `ROAS 24h ${pct(row?.roas24h)} · Spend ${money(row?.spend24h)} · tồn an toàn.`,
      };
    }

    return {
      eligible: false,
      title: "CHƯA SCALE",
      reason: reasons.length ? reasons.join(" · ") : "Chưa đủ điều kiện Auto Scale.",
    };
  }

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

  async function scaleAd(row: AnyRow, percent: number, targetBudget?: number) {
    const adSetId = String(row.metaAdSetId || row.adSetId || "");
    if (!adSetId) return;

    const requestedPercent = Number(percent || 0);
    const requestedTargetBudget = Number(targetBudget || 0);

    if (!requestedPercent && !requestedTargetBudget) {
      setError("Nhập % hoặc số tiền ngân sách mới.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await apiJson("/meta-ads/actions/scale-adset", {
        method: "POST",
        body: JSON.stringify({
          metaAdSetId: adSetId,
          percent: requestedPercent || undefined,
          targetBudget: requestedTargetBudget > 0 ? Math.round(requestedTargetBudget) : undefined,
          dryRun,
          metaAdId: row.metaAdId || row.id,
          source: "mobile_manual",
        }),
      });

      const oldBudget = num(result?.oldBudget);
      const newBudget = num(result?.newBudget);
      const actualPercent = num(result?.percent);

      const actionLabel = requestedTargetBudget > 0
        ? `Đặt ngân sách ${money(newBudget || requestedTargetBudget)}`
        : actualPercent < 0 || requestedPercent < 0
          ? `Đã giảm ${Math.abs(actualPercent || requestedPercent)}%`
          : `Đã tăng +${actualPercent || requestedPercent}%`;

      setMessage(
        dryRun
          ? `DRY RUN · ${actionLabel}: ${money(oldBudget)} → ${money(newBudget)}`
          : `${actionLabel}: ${money(oldBudget)} → ${money(newBudget)}`,
      );

      const id = String(row.metaAdId || row.id || "");
      setBudgetAdjustOpenByAd((prev) => ({ ...prev, [id]: false }));
      await loadAll(false);
    } catch (e: any) {
      setError(e?.message || "Không điều chỉnh được ngân sách");
    } finally {
      setBusy(false);
    }
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

  async function saveAdMapping(row: AnyRow) {
    const metaAdId = String(row.metaAdId || row.id || "").trim();
    const stock = assessments[metaAdId] || {};

    const currentCode = String(
      row.manualProductCode ||
      row.manualMapping?.productCode ||
      stock.productCode ||
      ""
    ).trim().toUpperCase();

    const productCode = String(
      manualProductByAd[metaAdId] ?? currentCode
    ).trim().toUpperCase();

    const selectedProduct = mappingOptions.find(
      (x) => String(x.productCode || "").trim().toUpperCase() === productCode,
    );
    const colors = Array.isArray(selectedProduct?.colors) ? selectedProduct.colors : [];

    const currentColor = String(
      row.manualColor ||
      row.manualMapping?.color ||
      stock.color ||
      ""
    ).trim();

    const color = String(
      manualColorByAd[metaAdId] ?? currentColor
    ).trim();

    if (!metaAdId) {
      setError("Thiếu Meta Ad ID.");
      return;
    }
    if (!productCode || !selectedProduct) {
      setError("Chọn đúng mã sản phẩm nội bộ trước.");
      return;
    }
    if (colors.length > 1 && !color) {
      setError("Chọn màu sản phẩm trước.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const r = await apiJson("/meta-ads/autopilot/ads/map", {
        method: "POST",
        body: JSON.stringify({
          metaAdId,
          productCode,
          color: color || undefined,
        }),
      });

      if (r?.ok === false) {
        throw new Error(r?.error || "Không lưu được mapping Ads");
      }

      // Chỉ báo thành công khi backend xác nhận mapping đã persist vào nguồn nội bộ.
      if (r?.persisted !== true) {
        throw new Error("Backend chưa xác nhận mapping đã được lưu bền vững. Không coi là lưu thành công.");
      }

      const savedCode = String(r?.mapping?.productCode || productCode).trim().toUpperCase();
      const savedColor = String(r?.mapping?.color || color || "").trim();

      // Đọc lại qua đúng engine tồn kho để xác nhận luồng khác cũng đã nhận mapping.
      const verifyPayload = await apiJson("/meta-ads/autopilot/inventory/assess", {
        method: "POST",
        body: JSON.stringify({
          ads: [{
            ...row,
            metaAdId,
            id: metaAdId,
            manualProductCode: savedCode,
            manualColor: savedColor || null,
            manualMapping: r?.mapping || {
              productCode: savedCode,
              color: savedColor || null,
            },
          }],
        }),
      });

      const verifyRows = Array.isArray(verifyPayload)
        ? verifyPayload
        : verifyPayload?.items || verifyPayload?.rows || [];
      const verified = verifyRows.find(
        (x: AnyRow) => String(x?.metaAdId || x?.id || "") === metaAdId,
      ) || verifyRows[0];

      if (
        !verified ||
        String(verified?.productCode || "").trim().toUpperCase() !== savedCode ||
        (savedColor && String(verified?.color || "").trim().toLowerCase() !== savedColor.toLowerCase())
      ) {
        throw new Error("Đã ghi mapping nhưng kiểm tra lại qua tồn kho chưa nhận đúng mã/màu.");
      }

      setAssessments((prev) => ({ ...prev, [metaAdId]: verified }));
      setLiveAds((prev) => prev.map((item) =>
        String(item?.metaAdId || item?.id || "") === metaAdId
          ? {
              ...item,
              manualProductCode: savedCode,
              manualColor: savedColor || null,
              manualMapping: r?.mapping || {
                productCode: savedCode,
                color: savedColor || null,
              },
            }
          : item
      ));
      setManualProductByAd((prev) => ({ ...prev, [metaAdId]: savedCode }));
      setManualColorByAd((prev) => ({ ...prev, [metaAdId]: savedColor }));
      setSavedMappingByAd((prev) => ({
        ...prev,
        [metaAdId]: {
          productCode: savedCode,
          color: savedColor || null,
          savedAt: new Date().toISOString(),
        },
      }));

      setMessage(`✓ Đã lưu chắc chắn ${savedCode}${savedColor ? ` · ${savedColor}` : ""}. Backend + tồn kho đã xác nhận.`);

      // Refresh toàn bộ sau khi đã xác nhận; badge xanh vẫn giữ để người dùng biết thao tác vừa thành công.
      await loadAll(false);
    } catch (e: any) {
      setSavedMappingByAd((prev) => {
        const next = { ...prev };
        delete next[metaAdId];
        return next;
      });
      setError(e?.message || "Không lưu được mapping Ads");
    } finally {
      setBusy(false);
    }
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

  function manualSelectionForPost(post: AnyRow) {
    const postId = String(post.postId || post.id || "");
    const assessment = post.assessment || {};
    const productCode = String(manualProductByPost[postId] ?? assessment.productCode ?? "").trim().toUpperCase();
    const selectedProduct = mappingOptions.find((x) => String(x.productCode || "").trim().toUpperCase() === productCode);
    const colors = Array.isArray(selectedProduct?.colors) ? selectedProduct.colors : [];
    const color = String(manualColorByPost[postId] ?? assessment.color ?? "").trim();

    const valid =
      Boolean(productCode) &&
      Boolean(selectedProduct) &&
      (colors.length <= 1 || Boolean(color));

    return { postId, productCode, color, selectedProduct, colors, valid };
  }

  async function preparePostRun(post: AnyRow) {
    const selected = manualSelectionForPost(post);

    if (!selected.valid) {
      setError(selected.productCode ? "Chọn đúng màu sản phẩm trước." : "Chọn mã sản phẩm trước.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      // Bước 1 chỉ chốt mapping. Tuyệt đối chưa tạo Ads.
      const r = await apiJson("/meta-ads/autopilot/launch/map", {
        method: "POST",
        body: JSON.stringify({
          postId: selected.postId,
          productCode: selected.productCode,
          color: selected.color || undefined,
        }),
      });
      if (r?.ok === false) throw new Error(r?.error || r?.assessment?.reason || "Mapping chưa chính xác");

      const assessment = r?.assessment || post?.assessment || {};
      const template = adSetOptions.find((x) => String(x.id) === String(templateAdSetId)) || null;
      const image = postImage(post);

      const firstLine = String(post.message || "Bài viết").split(/\n+/)[0].replace(/#\S+/g, "").trim();
      const marketingTitle = (firstLine.split(/\bM[ẫâ]u\b/i)[0] || firstLine).trim();
      const codeUpper = String(assessment?.productCode || selected.productCode || "").trim().toUpperCase();
      const colorUpper = String(assessment?.color || selected.color || "").trim().toUpperCase();
      let baseName = marketingTitle || "Bài viết";
      if (codeUpper) baseName = baseName.replace(new RegExp(`\\b${codeUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), "").trim();
      if (colorUpper) baseName = baseName.replace(new RegExp(`\\b${colorUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), "").trim();
      const adName = [baseName, codeUpper, colorUpper, new Date().toLocaleDateString("vi-VN")]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 160);

      const review = {
        version: 1,
        createdAt: new Date().toISOString(),
        post: {
          postId: selected.postId,
          message: post.message || "",
          createdTime: post.createdTime || post.created_time || null,
          image,
        },
        mapping: {
          productCode: codeUpper,
          color: colorUpper,
          productName: assessment?.productName || selected.selectedProduct?.productName || "",
          totalQty: assessment?.totalQty ?? null,
          minQty: assessment?.minQty ?? null,
          level: assessment?.level || null,
          sizes: Array.isArray(assessment?.sizes) ? assessment.sizes : [],
        },
        launch: {
          level,
          dryRun,
          launchMode,
          dailyBudget: launchDailyBudget,
          waitHours,
          templateAdSetId,
          templateAdSetName: template?.name || "",
          templateCampaignName: template?.campaignName || "",
          requireInventoryMatch,
          blockCriticalStock,
          autoActivate,
          adName,
        },
      };

      sessionStorage.setItem("autopilotLaunchReview", JSON.stringify(review));
      router.push("/mobile/autopilot/review");
    } catch (e: any) {
      setError(e?.message || "Không chuẩn bị được cấu hình chạy Ads");
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
          <div className={`rounded-2xl border px-4 py-3 ${scaledAdsToday.length ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-[10px] font-black uppercase tracking-[.12em] ${scaledAdsToday.length ? "text-emerald-700" : "text-neutral-400"}`}>
                  Scale hôm nay
                </div>
                <div className="mt-1 text-sm font-black text-neutral-950">
                  {scaledAdsToday.length
                    ? `Đã scale ${scaledAdsToday.length} bài đang chạy`
                    : "Hôm nay chưa scale bài nào"}
                </div>
              </div>
              <div className={`grid h-10 min-w-10 place-items-center rounded-xl px-3 text-lg font-black ${scaledAdsToday.length ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-400"}`}>
                {scaledAdsToday.length}
              </div>
            </div>
          </div>
          {filteredAds.map((row) => {
            const id = String(row.metaAdId || row.id || "");
            const stock = assessments[id] || {};
            const familyMode = String(stock?.mappingMode || "").toUpperCase() === "PRODUCT_FAMILY";
            const familyGroups = Array.isArray(stock?.groups) ? stock.groups : [];
            const familyLowGroups = familyMode
              ? familyGroups.filter((g: AnyRow) => num(g?.totalQty) < pauseTotalQty)
              : [];
            const budget = budgetOf(row);
            const status = String(row.effectiveStatus || row.status || "—").toUpperCase();
            const expanded = expandedId === id;
            const historyCount = scaleCount(row);
            const todayScaleText = scaleBadgeText(row);
            const autoScale = autoScaleStatus(row);
            return <article
              id={`autopilot-ad-card-${id}`}
              key={id}
              className="scroll-mt-24 overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm"
            >
              <div className="flex gap-3 p-4">
                {row.thumbnailUrl || row.thumbnail_url ? <img src={row.thumbnailUrl || row.thumbnail_url} alt="" className="h-20 w-20 rounded-2xl object-cover bg-neutral-100" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-neutral-100"><Activity className="h-6 w-6 text-neutral-400" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-black leading-5">{row.adName || row.name || row.ad_name || `Ad ${String(row.metaAdId || row.id || "").slice(-6)}`}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge value={status}>{status}</Badge>
                    {familyLowGroups.length ? <Badge value="CRITICAL">MÀU TỒN THẤP</Badge> : stock?.level ? <Badge value={stock.level}>{familyMode ? "THEO MÃ CHÍNH" : stock.level}</Badge> : null}
                    {todayScaleText ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-black text-white">
                        <span className="h-2 w-2 rounded-[2px] bg-emerald-200" />
                        {todayScaleText}
                      </span>
                    ) : null}
                    {historyCount ? <Badge value="ACTIVE">✓{historyCount}</Badge> : null}
                  </div>
                  <div className="mt-2 text-xs font-bold text-neutral-600">
                    {stock?.productCode
                      ? familyMode
                        ? `${stock.productCode} · theo mã chính (${familyGroups.length} màu)`
                        : `${stock.productCode} · ${stock.color || ""}`
                      : row.manualProductCode || row.manualMapping?.productCode
                        ? `${row.manualProductCode || row.manualMapping?.productCode} · ${row.manualColor || row.manualMapping?.color || ""}`
                        : "Chưa map mã / màu"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-y border-neutral-100 bg-neutral-50">
                <div className="p-3"><div className="text-[10px] text-neutral-400">Budget</div><div className="mt-1 text-xs font-black">{budget.value ? money(budget.value) : "Chưa lấy được"}</div><div className="text-[9px] text-neutral-400">{budget.value ? budget.level : "Meta chưa trả budget"}</div></div>
                <div className="p-3">
                  <div className="text-[10px] text-neutral-400">{familyMode ? "Tồn mã" : "Tồn màu"}</div>
                  <div className="mt-1 text-xs font-black">{stock?.totalQty ?? "—"}</div>
                  <div className={`text-[9px] ${familyLowGroups.length ? "font-black text-rose-600" : "text-neutral-400"}`}>
                    {familyMode
                      ? familyLowGroups.length
                        ? `${familyLowGroups.length} màu dưới ${pauseTotalQty}`
                        : `${familyGroups.length} màu`
                      : `min size ${stock?.minQty ?? "—"}`}
                  </div>
                </div>
                <div className="p-3"><div className="text-[10px] text-neutral-400">Ad Set</div><div className="mt-1 truncate text-xs font-black">{row.adSetName || row.metaAdSetId || row.adSetId || "—"}</div><div className="text-[9px] text-neutral-400">{row.campaignName || row.metaCampaignId || row.campaignId || "—"}</div></div>
              </div>
              <button onClick={() => {
                if (expanded) {
                  setExpandedId("");
                  return;
                }

                // Mở card xong luôn đưa phần đầu card về đúng viewport.
                // Tránh browser scroll anchoring giữ vị trí cũ rồi đẩy người dùng xuống
                // tận phần cuối card / sang card kế tiếp khi nội dung dài được mount.
                setExpandedId(id);
                void ensureAdInsights(insightRangeByAd[id] || "today");

                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    document
                      .getElementById(`autopilot-ad-card-${id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                });
              }} className="flex w-full items-center justify-between px-4 py-3 text-xs font-black"><span>Chi tiết & thao tác</span>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
              {expanded ? <div className="space-y-3 border-t border-neutral-100 p-4">
                <div className={`rounded-2xl border p-3 ${autoScale.eligible ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-[3px] ${autoScale.eligible ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <div className="min-w-0">
                      <div className={`text-[10px] font-black uppercase tracking-[.12em] ${autoScale.eligible ? "text-emerald-700" : "text-amber-700"}`}>
                        Auto Scale
                      </div>
                      <div className="mt-1 text-xs font-black text-neutral-950">{autoScale.title}</div>
                      <div className="mt-1 text-[11px] font-semibold leading-5 text-neutral-600">{autoScale.reason}</div>
                    </div>
                  </div>
                </div>
                {(() => {
                  const currentCode = String(
                    manualProductByAd[id] ??
                    row.manualProductCode ??
                    row.manualMapping?.productCode ??
                    stock?.productCode ??
                    ""
                  ).trim().toUpperCase();

                  const selectedProduct = mappingOptions.find(
                    (x) => String(x.productCode || "").trim().toUpperCase() === currentCode,
                  );
                  const colors = Array.isArray(selectedProduct?.colors) ? selectedProduct.colors : [];
                  const currentColor = String(
                    manualColorByAd[id] ??
                    row.manualColor ??
                    row.manualMapping?.color ??
                    stock?.color ??
                    ""
                  ).trim();

                  return <div className={`rounded-2xl border p-3 ${stock?.productCode ? "border-neutral-200 bg-neutral-50" : "border-sky-200 bg-sky-50"}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Mapping mã sản phẩm</div>
                        <div className="mt-0.5 text-[11px] text-neutral-500">
                          {familyMode
                            ? `Không tìm được màu riêng. Hệ thống đang tự theo mã chính ${stock?.productCode || currentCode} và kiểm tra tất cả ${familyGroups.length} màu.`
                            : stock?.productCode
                              ? "Đã match với kho. Có thể đổi mapping thủ công nếu cần."
                              : "Ads chưa có mã trong tên · chọn mã nội bộ để tồn kho và ROAS tính chính xác."}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {familyMode ? <Badge value="WAIT">MÃ CHÍNH</Badge> : null}
                        {savedMappingByAd[id] ? <Badge value="ACTIVE">✓ ĐÃ LƯU</Badge> : row.manualProductCode || row.manualMapping?.productCode ? <Badge value="ACTIVE">MANUAL</Badge> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProductSearchOpenByAd((prev) => ({ ...prev, [id]: true }));
                        setProductSearchByAd((prev) => ({ ...prev, [id]: prev[id] ?? "" }));
                      }}
                      className="flex h-12 w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-wide text-neutral-400">Tìm mã sản phẩm</div>
                        <div className="truncate text-xs font-black text-neutral-900">
                          {currentCode
                            ? `${currentCode}${selectedProduct?.productName ? ` · ${selectedProduct.productName}` : ""}`
                            : "Bấm để tìm mã / tên SP"}
                        </div>
                      </div>
                      <Search className="ml-3 h-4 w-4 text-neutral-400" />
                    </button>

                    {productSearchOpenByAd[id] ? (() => {
                      const q = String(productSearchByAd[id] || "").trim().toLowerCase();
                      const rows = mappingOptions
                        .filter((x) => {
                          if (!q) return true;
                          return (
                            String(x.productCode || "").toLowerCase().includes(q) ||
                            String(x.productName || "").toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 100);

                      return <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-white">
                        <div className="border-b border-neutral-200 bg-white px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setProductSearchOpenByAd((prev) => ({ ...prev, [id]: false }));
                                setProductSearchByAd((prev) => ({ ...prev, [id]: "" }));
                              }}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl font-black"
                            >
                              ×
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Map Ads với kho</div>
                              <div className="text-base font-black text-neutral-950">Tìm mã hoặc tên SP</div>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <input
                              autoFocus
                              inputMode="search"
                              enterKeyHint="search"
                              value={productSearchByAd[id] ?? ""}
                              onChange={(e) => setProductSearchByAd((prev) => ({ ...prev, [id]: e.target.value }))}
                              placeholder="Ví dụ: QJ930 hoặc jean xanh..."
                              className="h-12 min-w-0 flex-1 rounded-2xl border border-neutral-300 bg-neutral-50 px-4 text-[16px] font-bold outline-none focus:border-neutral-950"
                            />
                            <button
                              type="button"
                              onClick={() => setProductSearchByAd((prev) => ({ ...prev, [id]: "" }))}
                              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-600"
                            >
                              Xoá
                            </button>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-3">
                          <div className="mb-2 text-[11px] font-semibold text-neutral-400">
                            {q ? `${rows.length} kết quả` : `Hiển thị ${Math.min(mappingOptions.length, 100)} sản phẩm đầu`}
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                            {rows.length ? rows.map((x) => {
                              const code = String(x.productCode || "").toUpperCase();
                              const active = currentCode === code;
                              return <button
                                type="button"
                                key={code}
                                onClick={() => {
                                  setManualProductByAd((prev) => ({ ...prev, [id]: code }));
                                  setManualColorByAd((prev) => ({ ...prev, [id]: "" }));
                                  setProductSearchByAd((prev) => ({ ...prev, [id]: "" }));
                                  setProductSearchOpenByAd((prev) => ({ ...prev, [id]: false }));
                                }}
                                className={`block w-full border-b border-neutral-100 px-4 py-4 text-left last:border-b-0 ${active ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-black">{code}</div>
                                    <div className={`mt-1 text-xs leading-5 ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                                      {x.productName || ""}
                                    </div>
                                  </div>
                                  {active ? <span className="text-sm font-black">✓</span> : null}
                                </div>
                              </button>;
                            }) : <div className="px-4 py-10 text-center text-sm font-bold text-neutral-400">Không tìm thấy sản phẩm</div>}
                          </div>
                        </div>
                      </div>;
                    })() : null}

                    <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                      <select
                        className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                        value={currentColor}
                        disabled={!currentCode}
                        onChange={(e) => setManualColorByAd((prev) => ({ ...prev, [id]: e.target.value }))}
                      >
                        <option value="">
                          {colors.length > 1 ? "Chọn màu..." : colors.length === 1 ? colors[0]?.color : "Chưa có màu"}
                        </option>
                        {colors.map((c: AnyRow) => (
                          <option key={String(c.color)} value={String(c.color)}>
                            {c.color} · tồn {c.totalQty}
                          </option>
                        ))}
                      </select>

                      <button
                        disabled={busy || !currentCode || (colors.length > 1 && !currentColor)}
                        onClick={() => void saveAdMapping(row)}
                        className="h-11 rounded-xl bg-neutral-950 px-4 text-xs font-black text-white disabled:bg-neutral-200 disabled:text-neutral-400"
                      >
                        Lưu
                      </button>
                    </div>
                    {savedMappingByAd[id] ? (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold leading-4 text-emerald-700">
                        ✓ Đã lưu chắc chắn {savedMappingByAd[id].productCode}{savedMappingByAd[id].color ? ` · ${savedMappingByAd[id].color}` : ""}. Backend và tồn kho đã đọc lại thành công.
                      </div>
                    ) : null}
                  </div>;
                })()}
                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">{familyMode ? "Tồn tất cả màu của mã chính" : "Tồn từng size"}</div>
                  {familyMode && familyGroups.length ? (
                    <div className="space-y-2">
                      {familyGroups.map((g: AnyRow, gi: number) => {
                        const total = num(g?.totalQty);
                        const lowTotal = total < pauseTotalQty;
                        return <div key={String(g?.colorKey || `${id}-${gi}`)} className={`rounded-2xl border p-3 ${lowTotal ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className={`text-xs font-black ${lowTotal ? "text-rose-700" : "text-neutral-800"}`}>{g?.color || g?.colorKey || `Màu ${gi + 1}`}</div>
                            <div className={`text-[10px] font-black ${lowTotal ? "text-rose-700" : "text-neutral-500"}`}>Tổng {total}{lowTotal ? ` · DƯỚI ${pauseTotalQty}` : ""}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(Array.isArray(g?.sizes) ? g.sizes : []).map((sz: AnyRow) => (
                              <span key={String(sz.size)} className={`rounded-xl border px-2 py-1 text-[10px] font-black ${num(sz.qty) < pauseThreshold ? "border-rose-300 bg-white text-rose-700" : num(sz.qty) < warnThreshold ? "border-amber-200 bg-amber-50 text-amber-700" : "border-neutral-200 bg-white text-neutral-600"}`}>{sz.size}: {sz.qty}</span>
                            ))}
                          </div>
                        </div>;
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">{Array.isArray(stock?.sizes) && stock.sizes.length ? stock.sizes.map((s: AnyRow) => <span key={String(s.size)} className={`rounded-xl border px-2.5 py-1.5 text-xs font-black ${num(s.qty) < pauseThreshold ? "border-rose-200 bg-rose-50 text-rose-700" : num(s.qty) < warnThreshold ? "border-amber-200 bg-amber-50 text-amber-700" : "border-neutral-200 bg-neutral-50"}`}>{s.size}: {s.qty}</span>) : <span className="text-xs text-neutral-400">Chưa có dữ liệu tồn.</span>}</div>
                  )}
                </div>
                <div className={`rounded-2xl p-3 text-xs font-semibold leading-5 ${familyLowGroups.length ? "border border-rose-200 bg-rose-50 text-rose-700" : familyMode ? "border border-amber-200 bg-amber-50 text-amber-800" : "bg-neutral-50 text-neutral-600"}`}>
                  {familyLowGroups.length
                    ? `⚠ Có ${familyLowGroups.length} màu tổng tồn dưới ${pauseTotalQty}: ${familyLowGroups.map((g: AnyRow) => `${g?.color || g?.colorKey} ${num(g?.totalQty)}`).join(", ")}. Xem xét tắt Ads hoặc đổi nội dung.`
                    : stock?.reason || "Chưa có đánh giá tồn kho."}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Spend 24h</div><div className="mt-1 text-xs font-black">{money(row.spend24h ?? row.spend ?? 0)}</div></div>
                  <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">DT tổng</div><div className="mt-1 text-xs font-black">{money(row.revenue24h ?? row.revenue ?? 0)}</div></div>
                  <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">ROAS Tổng</div><div className="mt-1 text-xs font-black">{pct(row.roas24h ?? row.roas ?? 0)}</div></div>
                </div>
                {(() => {
                  const result = insightForAd(id);
                  const m = result.row?.metrics || {};
                  return <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black">Kết quả sau khi chạy</div>
                        <div className="text-[9px] text-neutral-400">Meta Insights</div>
                      </div>
                      <div className="flex rounded-xl bg-neutral-100 p-1">
                        {(["today","yesterday","7d"] as const).map((range) => <button
                          key={range}
                          onClick={() => {
                            setInsightRangeByAd((prev) => ({ ...prev, [id]: range }));
                            void ensureAdInsights(range);
                          }}
                          className={`rounded-lg px-2 py-1.5 text-[9px] font-black ${result.range === range ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-400"}`}
                        >{range === "today" ? "Hôm nay" : range === "yesterday" ? "Hôm qua" : "7 ngày"}</button>)}
                      </div>
                    </div>

                    {result.loading ? <div className="py-5 text-center text-[11px] font-bold text-neutral-400">Đang tải kết quả...</div> : result.row ? <>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Đã chi tiêu</div><div className="mt-1 text-sm font-black">{money(m.spend || 0)}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Budget/ngày</div><div className="mt-1 text-sm font-black">{budget.value ? money(budget.value) : "—"}</div><div className="text-[9px] text-neutral-400">{budget.level || ""}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Bắt đầu hội thoại</div><div className="mt-1 text-sm font-black">{Math.round(num(m.conversationStarts))}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Chi phí / hội thoại</div><div className="mt-1 text-sm font-black">{money(m.costPerConversation || 0)}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Reach</div><div className="mt-1 text-sm font-black">{Math.round(num(m.reach)).toLocaleString("vi-VN")}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Impressions</div><div className="mt-1 text-sm font-black">{Math.round(num(m.impressions)).toLocaleString("vi-VN")}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Người liên hệ nhắn tin</div><div className="mt-1 text-sm font-black">{Math.round(num(m.messages))}</div></div>
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] text-neutral-400">Purchase Meta</div><div className="mt-1 text-sm font-black">{Math.round(num(m.metaPurchases))}</div></div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                         <div className="rounded-xl border border-neutral-200 p-3">
                           <div className="text-[9px] text-neutral-400">DT Facebook</div>
                           <div className="mt-1 text-sm font-black">{money(m.facebookRevenue ?? result.row?.facebookRevenue ?? 0)}</div>
                         </div>
                         <div className="rounded-xl border border-neutral-200 p-3">
                           <div className="text-[9px] text-neutral-400">DT POS</div>
                           <div className="mt-1 text-sm font-black">{money(m.posRevenue ?? result.row?.posRevenue ?? 0)}</div>
                         </div>
                         <div className="rounded-xl border border-neutral-200 p-3">
                           <div className="text-[9px] text-neutral-400">ROAS Facebook</div>
                           <div className="mt-1 text-sm font-black">{pct(m.facebookRoas ?? result.row?.facebookRoas ?? 0)}</div>
                         </div>
                         <div className="rounded-xl border border-neutral-200 p-3">
                           <div className="text-[9px] text-neutral-400">ROAS POS</div>
                           <div className="mt-1 text-sm font-black">{pct(m.posRoas ?? result.row?.posRoas ?? 0)}</div>
                         </div>
                         <div className="col-span-2 rounded-xl bg-neutral-950 p-3 text-white">
                           <div className="text-[9px] font-black uppercase tracking-wide text-neutral-400">ROAS Tổng · ngưỡng scale {pct(scaleRoas)}</div>
                           <div className="mt-1 flex items-end justify-between gap-3">
                             <div className="text-xl font-black">{pct(m.totalRoas ?? m.internalRoas ?? result.row?.totalRoas ?? row.roas24h ?? 0)}</div>
                             <div className="text-[10px] font-bold text-neutral-300">
                               {num(m.totalRoas ?? m.internalRoas ?? result.row?.totalRoas ?? row.roas24h ?? 0) >= scaleRoas ? "Đạt ngưỡng ROAS" : "Chưa đạt ngưỡng"}
                             </div>
                           </div>
                         </div>
                       </div>
                    </> : <div className="py-5 text-center text-[11px] font-bold text-neutral-400">Meta chưa có dữ liệu ở khoảng này.</div>}
                  </div>;
                })()}
                {historyCount ? <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">Lịch sử scale</div>
                  <div className="space-y-2">
                    {scaleHistory.filter((x) => String(x.metaAdSetId || x?.errorJson?.metaAdSetId || "") === String(row.metaAdSetId || row.adSetId || "")).slice(0,5).map((x,idx) => (
                      <div key={String(x.id || idx)} className="rounded-xl bg-neutral-50 px-3 py-2 text-[11px]">
                        {(() => {
                          const p = num(x.percent ?? x?.errorJson?.percent);
                          return <div className="font-black">{p >= 0 ? `Tăng +${p}%` : `Giảm ${p}%`} · {String(x.budgetLevel || x?.errorJson?.budgetLevel || "ADSET")}</div>;
                        })()}
                        <div className="mt-0.5 text-neutral-500">{money(x.oldBudget || x?.errorJson?.oldBudget)} → {money(x.newBudget || x?.errorJson?.newBudget)} · {x.source || x?.errorJson?.source || "manual"}</div>
                      </div>
                    ))}
                  </div>
                </div> : null}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={busy || status !== "ACTIVE"} onClick={() => void scaleAd(row, 20)} className="h-11 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40">+20%</button>
                    <button disabled={busy || status !== "ACTIVE"} onClick={() => void scaleAd(row, 30)} className="h-11 rounded-2xl bg-neutral-800 text-xs font-black text-white disabled:opacity-40">+30%</button>
                  </div>

                  <button
                    type="button"
                    disabled={busy || status !== "ACTIVE"}
                    onClick={() => setBudgetAdjustOpenByAd((prev) => ({ ...prev, [id]: !prev[id] }))}
                    className="h-11 w-full rounded-2xl border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:opacity-40"
                  >
                    Điều chỉnh / giảm ngân sách
                  </button>

                  {budgetAdjustOpenByAd[id] ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1">
                        <button
                          type="button"
                          onClick={() => setBudgetAdjustModeByAd((prev) => ({ ...prev, [id]: "percent" }))}
                          className={`h-9 rounded-lg text-[10px] font-black ${
                            (budgetAdjustModeByAd[id] || "percent") === "percent"
                              ? "bg-rose-600 text-white"
                              : "text-rose-700"
                          }`}
                        >
                          Theo %
                        </button>
                        <button
                          type="button"
                          onClick={() => setBudgetAdjustModeByAd((prev) => ({ ...prev, [id]: "amount" }))}
                          className={`h-9 rounded-lg text-[10px] font-black ${
                            budgetAdjustModeByAd[id] === "amount"
                              ? "bg-rose-600 text-white"
                              : "text-rose-700"
                          }`}
                        >
                          Theo số tiền
                        </button>
                      </div>

                      {(budgetAdjustModeByAd[id] || "percent") === "percent" ? (
                        <div className="mt-3">
                          <div className="text-[10px] font-bold text-rose-700">Giảm theo % ngân sách hiện tại</div>
                          <div className="mt-2 flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="1"
                                max="90"
                                step="1"
                                value={budgetAdjustPercentByAd[id] ?? 20}
                                onChange={(e) => setBudgetAdjustPercentByAd((prev) => ({
                                  ...prev,
                                  [id]: Math.min(90, Math.max(1, Number(e.target.value || 1))),
                                }))}
                                className="h-11 w-full rounded-xl border border-rose-200 bg-white px-3 pr-9 text-sm font-black outline-none"
                              />
                              <span className="pointer-events-none absolute right-3 top-3 text-xs font-black text-neutral-400">%</span>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void scaleAd(row, -Math.min(90, Math.max(1, Number(budgetAdjustPercentByAd[id] ?? 20))))}
                              className="h-11 rounded-xl bg-rose-600 px-4 text-xs font-black text-white disabled:opacity-40"
                            >
                              Giảm
                            </button>
                          </div>
                          <div className="mt-2 text-[10px] leading-4 text-rose-600">Ví dụ 20 = giảm 20% ngân sách hiện tại.</div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <div className="text-[10px] font-bold text-rose-700">Đặt ngân sách mới theo số tiền/ngày</div>
                          <div className="mt-2 flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="1"
                                step="10000"
                                value={targetBudgetByAd[id] ?? Math.max(1, Math.round(num(budget.value) * 0.8))}
                                onChange={(e) => setTargetBudgetByAd((prev) => ({
                                  ...prev,
                                  [id]: Math.max(1, Number(e.target.value || 1)),
                                }))}
                                className="h-11 w-full rounded-xl border border-rose-200 bg-white px-3 pr-8 text-sm font-black outline-none"
                              />
                              <span className="pointer-events-none absolute right-3 top-3 text-xs font-black text-neutral-400">đ</span>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void scaleAd(
                                row,
                                0,
                                Math.max(1, Number(targetBudgetByAd[id] ?? Math.round(num(budget.value) * 0.8))),
                              )}
                              className="h-11 rounded-xl bg-rose-600 px-4 text-xs font-black text-white disabled:opacity-40"
                            >
                              Đặt
                            </button>
                          </div>
                          <div className="mt-2 text-[10px] leading-4 text-rose-600">
                            Ví dụ nhập 1.500.000 = đặt ngân sách mới thành 1.500.000đ/ngày. Hệ thống tự nhận Campaign/Ad Set.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {status === "ACTIVE" ? <button disabled={busy} onClick={() => void setAdStatus(row, "PAUSED")} className="h-11 w-full rounded-2xl bg-rose-600 text-xs font-black text-white"><Pause className="mr-1 inline h-4 w-4" /> Pause Ad</button> : <button disabled={busy || status !== "PAUSED"} onClick={() => void setAdStatus(row, "ACTIVE")} className="h-11 w-full rounded-2xl bg-emerald-700 text-xs font-black text-white disabled:opacity-40"><Play className="mr-1 inline h-4 w-4" /> Bật lại / Duyệt Ad</button>}
                </div>
              </div> : null}
            </article>;
          })}
          {!filteredAds.length ? <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-neutral-400">Không có Ads phù hợp bộ lọc.</div> : null}
        </div> : null}

        {!loading && tab === "posts" ? <div className="space-y-3">
          {!launchAvailable ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-800">{launchError || "Auto Launch backend chưa sẵn sàng."}</div> : null}

          {/* REVIEW TEMP: giúp Meta reviewer nhìn rõ pages_show_list đang dùng cho Page The 1970.
              Sau khi App Review xong có thể bỏ block này nếu muốn gọn UI. */}
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1877F2] text-white">
                <span className="text-lg font-black leading-none">f</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[.14em] text-blue-600">Facebook Page được cấp quyền</div>
                <div className="mt-0.5 text-base font-black text-neutral-950">The 1970</div>
                <div className="mt-0.5 text-[10px] leading-4 text-neutral-500">Autopilot đang đọc danh sách bài viết đã đăng từ Facebook Page The 1970.</div>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-700">PAGE</span>
            </div>
            <div className="border-t border-blue-50 bg-blue-50/60 px-3 py-2 text-[10px] font-bold text-blue-800">
              DANH SÁCH BÀI VIẾT · FACEBOOK PAGE THE 1970
            </div>
          </div>
          <button disabled={busy || !launchAvailable} onClick={() => void scanPublishedPosts()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40"><RefreshCw className="h-4 w-4" /> Quét 100 bài từ Page The 1970</button>
          <div className="rounded-2xl bg-neutral-100 p-3 text-[11px] leading-5 text-neutral-500">Quét 100 bài published gần nhất từ Facebook Page The 1970, không chỉ bài hôm nay. Chế độ quét này chỉ phát hiện trạng thái, không tự tạo Ads.</div>
          <div className="grid grid-cols-3 gap-2">
            {([["no_ad","Chưa chạy Ads"],["has_ad","Đã có Ads"],["all","Tất cả"]] as Array<[typeof postFilter,string]>).map(([id,label]) => <button key={id} onClick={() => setPostFilter(id)} className={`rounded-xl border px-2 py-2 text-[10px] font-black ${postFilter === id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-500"}`}>{label}</button>)}
          </div>
          {visiblePosts.map((post) => {
            const state = String(post.state || "WAITING").toUpperCase();
            const a = post.assessment || {};
            const image = postImage(post);
            return <article key={String(post.postId)} className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-sm">
              {/* REVIEW TEMP: nhận diện rõ đây là Page Post của The 1970 */}
              <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1877F2] text-white">
                  <span className="text-sm font-black leading-none">f</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-neutral-950">The 1970</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">Bài viết từ Facebook Page The 1970</div>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">PAGE POST</span>
              </div>

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
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearchOpenByPost((prev) => ({ ...prev, [postId]: true }));
                            setProductSearchByPost((prev) => ({ ...prev, [postId]: prev[postId] ?? "" }));
                          }}
                          className="flex h-12 w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 text-left"
                        >
                          <div className="min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-wide text-neutral-400">Tìm mã sản phẩm</div>
                            <div className="truncate text-xs font-black text-neutral-900">
                              {selectedCode ? `${selectedCode}${selectedProduct?.productName ? ` · ${selectedProduct.productName}` : ""}` : "Bấm để tìm mã / tên SP"}
                            </div>
                          </div>
                          <span className="ml-3 text-lg font-black text-neutral-400">⌕</span>
                        </button>

                        {productSearchOpenByPost[postId] ? (() => {
                          const q = String(productSearchByPost[postId] || "").trim().toLowerCase();
                          const rows = mappingOptions
                            .filter((x) => {
                              if (!q) return true;
                              return String(x.productCode || "").toLowerCase().includes(q) ||
                                     String(x.productName || "").toLowerCase().includes(q);
                            })
                            .slice(0, 100);

                          return <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-white" style={{ touchAction: "manipulation" }}>
                            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProductSearchOpenByPost((prev) => ({ ...prev, [postId]: false }));
                                    setProductSearchByPost((prev) => ({ ...prev, [postId]: "" }));
                                    if (typeof document !== "undefined") (document.activeElement as HTMLElement | null)?.blur?.();
                                  }}
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl font-black"
                                >
                                  ×
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Chọn sản phẩm</div>
                                  <div className="text-base font-black text-neutral-950">Tìm mã hoặc tên SP</div>
                                </div>
                              </div>

                              <div className="mt-3 flex gap-2">
                                <input
                                  inputMode="search"
                                  enterKeyHint="search"
                                  value={productSearchByPost[postId] ?? ""}
                                  onChange={(e) => setProductSearchByPost((prev) => ({ ...prev, [postId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      setProductSearchOpenByPost((prev) => ({ ...prev, [postId]: false }));
                                      (e.currentTarget as HTMLInputElement).blur();
                                    }
                                  }}
                                  placeholder="Ví dụ: QSK941 hoặc quần short..."
                                  className="h-12 min-w-0 flex-1 rounded-2xl border border-neutral-300 bg-neutral-50 px-4 text-[16px] font-bold outline-none focus:border-neutral-950"
                                />
                                <button
                                  type="button"
                                  onClick={() => setProductSearchByPost((prev) => ({ ...prev, [postId]: "" }))}
                                  className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-600"
                                >
                                  Xoá
                                </button>
                              </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-3">
                              <div className="mb-2 text-[11px] font-semibold text-neutral-400">
                                {q ? `${rows.length} kết quả` : `Hiển thị ${Math.min(mappingOptions.length, 100)} sản phẩm đầu`}
                              </div>

                              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                                {rows.length ? rows.map((x) => {
                                  const code = String(x.productCode || "").toUpperCase();
                                  const active = selectedCode === code;
                                  return <button
                                    type="button"
                                    key={code}
                                    onClick={() => {
                                      setManualProductByPost((prev) => ({ ...prev, [postId]: code }));
                                      setManualColorByPost((prev) => ({ ...prev, [postId]: "" }));
                                      setProductSearchByPost((prev) => ({ ...prev, [postId]: "" }));
                                      setProductSearchOpenByPost((prev) => ({ ...prev, [postId]: false }));
                                      if (typeof document !== "undefined") (document.activeElement as HTMLElement | null)?.blur?.();
                                    }}
                                    className={`block w-full border-b border-neutral-100 px-4 py-4 text-left last:border-b-0 ${active ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"}`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-black">{code}</div>
                                        <div className={`mt-1 text-xs leading-5 ${active ? "text-neutral-300" : "text-neutral-500"}`}>{x.productName || ""}</div>
                                      </div>
                                      {active ? <span className="text-sm font-black">✓</span> : null}
                                    </div>
                                  </button>;
                                }) : <div className="px-4 py-10 text-center text-sm font-bold text-neutral-400">Không tìm thấy sản phẩm</div>}
                              </div>
                            </div>
                          </div>;
                        })() : null}
                      </div>

                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3">
                        <div className="text-[9px] font-black uppercase tracking-wide text-neutral-400">Mã đã chọn</div>
                        <div className="mt-1 text-xs font-black">{selectedCode ? `${selectedCode}${selectedProduct?.productName ? ` · ${selectedProduct.productName}` : ""}` : "Chưa chọn mã sản phẩm"}</div>
                      </div>

                      <select
                        className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[16px] font-bold outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
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
              {state === "UNMAPPED" ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-800">Bài chưa map mã + màu. Chọn đúng mã và màu; bấm “Chạy bài này” sẽ lưu mapping trước rồi mới sang bước xác nhận Ads.</div> : null}
              {state === "WAITING_MAPPED" ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold leading-5 text-emerald-800">Đã lưu mapping với kho. Chưa tạo Ads. Bấm “Chạy bài này” để sang bước xác nhận.</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {state === "CREATED_PAUSED" && post.metaAdId ? (
                  <button disabled={busy} onClick={() => void setAdStatus({ metaAdId: post.metaAdId }, "ACTIVE")} className="h-11 rounded-2xl bg-emerald-700 text-xs font-black text-white">Duyệt & bật Ad</button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => void preparePostRun(post)}
                    className="h-11 rounded-2xl bg-neutral-950 text-xs font-black text-white disabled:opacity-40"
                  >
                    {busy ? "Đang chuẩn bị..." : "Chạy bài này"}
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
              <Field label="Ad Set mẫu (lấy targeting / messaging)">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        className={`${inputClass} pl-9`}
                        value={templateSearch}
                        onChange={e => setTemplateSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") void searchTemplateAdSets(); }}
                        placeholder="Tìm tên Ad Set / Campaign..."
                      />
                    </div>
                    <button
                      type="button"
                      disabled={templateLoading}
                      onClick={() => void searchTemplateAdSets()}
                      className="min-w-[74px] rounded-2xl bg-neutral-950 px-3 text-xs font-black text-white disabled:opacity-40"
                    >
                      {templateLoading ? "Đang tìm" : "Tìm"}
                    </button>
                  </div>

                  <select
                    className={inputClass}
                    value={templateAdSetId}
                    onFocus={() => { if (!templateAdSets.length) void searchTemplateAdSets(""); }}
                    onChange={e => setTemplateAdSetId(e.target.value)}
                  >
                    <option value="">Chọn Ad Set mẫu...</option>
                    {adSetOptions.map(x => (
                      <option key={x.id} value={x.id}>
                        {x.name}{x.campaignName ? ` · ${x.campaignName}` : ""}{x.effectiveStatus ? ` · ${x.effectiveStatus}` : ""}
                      </option>
                    ))}
                  </select>

                  <div className="text-[10px] leading-4 text-neutral-400">
                    {templateLoading
                      ? "Đang tải Ad Set từ Meta..."
                      : templateAdSets.length
                        ? `Đã tải ${templateAdSets.length} Ad Set gần nhất. Gõ tên hoặc mã để lọc nhanh.`
                        : "Bấm vào danh sách hoặc Tìm để tải thêm Ad Set từ Meta; không còn giới hạn ở Ads đang chạy."}
                  </div>
                </div>
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
