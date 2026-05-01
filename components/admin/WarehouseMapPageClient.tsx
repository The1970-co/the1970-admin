"use client";

import { useEffect, useMemo, useState } from "react";
import { getBranches, type BranchItem } from "@/lib/products-api";
import WarehouseMap3D from "@/components/admin/WarehouseMap3D";
import WarehouseMap2DEditor from "@/components/admin/WarehouseMap2DEditor";
import { createStocktakeArea } from "@/lib/stocktake-area-api";
import {
    assignSkuToRack,
    createCustomWarehouseLayout,
    getPickingRoute,
    createQuickLayout,
    createWarehouseFloor,
    createWarehouseMap,
    deleteRack,
    getFullWarehouseMap,
    getRackInventory,
    getRebalanceSuggestions,
    getWarehouseHeatmap,
    listWarehouseMaps,
    removeSkuFromRack,
    resetWarehouseLayout,
    scanWarehouseRack,
    searchWarehouseVariants,
    updateRack,
    type CustomLayoutAisle,
    type FullWarehouseMap,
    type RackInventoryResponse,
    type WarehouseFloor,
    type WarehouseMap,
    type WarehouseRack,
} from "@/lib/warehouse-map-api";

type ViewMode = "editor2d" | "isometric" | "top" | "front" | "side";
type RightTab = "info" | "operation" | "history" | "settings";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", disabled = false, className = "" }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "danger" | "green" | "blue" | "softRed";
    disabled?: boolean;
    className?: string;
}) {
    const tone =
        variant === "green" ? "bg-green-600 text-white hover:bg-green-500" :
            variant === "blue" ? "bg-blue-600 text-white hover:bg-blue-500" :
                variant === "danger" ? "bg-red-600 text-white hover:bg-red-500" :
                    variant === "softRed" ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" :
                        variant === "secondary" ? "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50" :
                            "bg-neutral-900 text-white hover:bg-neutral-800";
    return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${tone} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}>{children}</button>;
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue" }) {
    const styles = {
        gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
        green: "bg-green-50 text-green-700 border-green-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        red: "bg-red-50 text-red-700 border-red-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
    };
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

function StatTile({ title, value, tone = "neutral" }: { title: string; value: string | number; tone?: "neutral" | "blue" | "green" | "amber" | "red" }) {
    const color = tone === "blue" ? "text-blue-700" : tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-neutral-900";
    return <div className="border-r border-neutral-100 px-4 last:border-r-0"><p className="text-xs font-medium text-neutral-500">{title}</p><div className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</div></div>;
}

const statusMeta: Record<string, { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }> = {
    PENDING: { label: "Chưa kiểm", tone: "gray" },
    IN_PROGRESS: { label: "Đang kiểm", tone: "amber" },
    FINISHED: { label: "Đã kiểm", tone: "green" },
    MISMATCH: { label: "Có lệch", tone: "red" },
};

const viewModeLabel: Record<ViewMode, string> = {
    editor2d: "2D Editor",
    isometric: "3D Preview",
    top: "2D Top view",
    front: "Mặt trước",
    side: "Mặt bên",
};

export default function WarehouseMapPageClient() {
    const [branches, setBranches] = useState<BranchItem[]>([]);
    const [branchId, setBranchId] = useState("");
    const [maps, setMaps] = useState<WarehouseMap[]>([]);
    const [selectedMapId, setSelectedMapId] = useState("");
    const [map, setMap] = useState<FullWarehouseMap | null>(null);
    const [currentFloorId, setCurrentFloorId] = useState("");
    const [selectedRack, setSelectedRack] = useState<WarehouseRack | null>(null);
    const [selectedEditorRacks, setSelectedEditorRacks] = useState<WarehouseRack[]>([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("editor2d");
    const [rightTab, setRightTab] = useState<RightTab>("info");
    const [newMapName, setNewMapName] = useState("Kho A");
    const [stocktakeSessionId, setStocktakeSessionId] = useState("");
    const [layoutRows, setLayoutRows] = useState<CustomLayoutAisle[]>([
        { aisle: "A", rackCount: 5, floors: 5 },
        { aisle: "B", rackCount: 10, floors: 5 },
    ]);
    const [resetBeforeCreate, setResetBeforeCreate] = useState(true);
    const [editorBusy, setEditorBusy] = useState(false);

    // Phase 2 operation state
    const [scanText, setScanText] = useState("");
    const [scanRackCode, setScanRackCode] = useState<string | null>(null);
    const [rackDetail, setRackDetail] = useState<RackInventoryResponse | null>(null);
    const [rackDetailLoading, setRackDetailLoading] = useState(false);
    const [editRackName, setEditRackName] = useState("");
    const [editAisle, setEditAisle] = useState("");
    const [editRackNo, setEditRackNo] = useState("");
    const [editFloors, setEditFloors] = useState(5);
    const [skuSearch, setSkuSearch] = useState("");
    const [variantOptions, setVariantOptions] = useState<Array<any>>([]);
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [pickingSkus, setPickingSkus] = useState("");
    const [pickingRoute, setPickingRoute] = useState<Array<any>>([]);
    const [missingPickSkus, setMissingPickSkus] = useState<string[]>([]);
    const [heatmap, setHeatmap] = useState<any | null>(null);
    const [rebalance, setRebalance] = useState<any | null>(null);
    const [operationMode, setOperationMode] = useState<"layout" | "scan" | "picking" | "heatmap" | "rebalance">("layout");
    const [highlightRackIds, setHighlightRackIds] = useState<string[]>([]);
    const [pickingPath, setPickingPath] = useState<Array<{ x: number; y: number; rackId?: string; label?: string }>>([]);
    const [heatmapByRackId, setHeatmapByRackId] = useState<Record<string, { color?: string; heat?: string; qty?: number; skuCount?: number }>>({});
    const [rebalanceRackIds, setRebalanceRackIds] = useState<string[]>([]);

    useEffect(() => {
        void (async () => {
            try {
                const data = await getBranches();
                setBranches(data);
                setBranchId(data[0]?.id || "");
            } catch (err) {
                setMessage(err instanceof Error ? err.message : "Không tải được chi nhánh.");
            }
        })();
    }, []);

    const loadMaps = async (selectedBranchId = branchId) => {
        if (!selectedBranchId) return;
        const data = await listWarehouseMaps(selectedBranchId);
        setMaps(data);
        if (data.length && !selectedMapId) setSelectedMapId(data[0].id);
        if (!data.length) { setSelectedMapId(""); setMap(null); }
    };

    const loadMap = async (id = selectedMapId) => {
        if (!id) return;
        const data = await getFullWarehouseMap(id);
        setMap({ ...data, racks: data.racks || [], floors: data.floors || [], zones: data.zones || [], doors: data.doors || [] });
        if (!currentFloorId && data.floors?.[0]?.id) setCurrentFloorId(data.floors[0].id);
        setSelectedRack((prev) => prev ? (data.racks || []).find((rack) => rack.id === prev.id) || null : null);
    };

    useEffect(() => { if (branchId) void loadMaps(branchId); /* eslint-disable-next-line */ }, [branchId]);
    useEffect(() => { if (selectedMapId) void loadMap(selectedMapId); /* eslint-disable-next-line */ }, [selectedMapId]);

    const currentFloor = useMemo(() => {
        if (!map?.floors?.length) return null;
        return map.floors.find((f) => f.id === currentFloorId) || map.floors[0];
    }, [map?.floors, currentFloorId]) as WarehouseFloor | null;

    const visibleRacks = useMemo(() => {
        const racks = map?.racks || [];
        if (!currentFloor?.id) return racks;
        return racks.filter((rack: any) => !rack.floorId || rack.floorId === currentFloor.id);
    }, [map?.racks, currentFloor?.id]);

    const stats = useMemo(() => {
        const finished = visibleRacks.filter((r) => r.status === "FINISHED").length;
        const inProgress = visibleRacks.filter((r) => r.status === "IN_PROGRESS").length;
        const mismatch = visibleRacks.filter((r) => r.status === "MISMATCH").length;
        const floors = visibleRacks.reduce((sum, rack) => sum + Number(rack.floors || 0), 0);
        const aisles = Array.from(new Set(visibleRacks.map((rack) => rack.aisle))).length;
        return { total: visibleRacks.length, finished, inProgress, mismatch, floors, aisles };
    }, [visibleRacks]);

    const aisleSummary = useMemo(() => {
        const aisles = Array.from(new Set(visibleRacks.map((rack) => rack.aisle))).sort();
        return aisles.map((aisle) => {
            const aisleRacks = visibleRacks.filter((rack) => rack.aisle === aisle);
            const finished = aisleRacks.filter((rack) => rack.status === "FINISHED").length;
            const inProgress = aisleRacks.filter((rack) => rack.status === "IN_PROGRESS").length;
            const mismatch = aisleRacks.filter((rack) => rack.status === "MISMATCH").length;
            const progress = aisleRacks.length ? Math.round((finished / aisleRacks.length) * 100) : 0;
            const status = mismatch > 0 ? "MISMATCH" : inProgress > 0 ? "IN_PROGRESS" : progress === 100 && aisleRacks.length ? "FINISHED" : "PENDING";
            return { aisle, rackCount: aisleRacks.length, floors: aisleRacks[0]?.floors || 5, totalSlots: aisleRacks.reduce((sum, rack) => sum + Number(rack.floors || 0), 0), progress, status };
        });
    }, [visibleRacks]);

    // PRO V2: hard-stop background polling inside the 2D editor.
    // Reloading the map while Konva is editing causes blur/lock/reset feeling.
    useEffect(() => {
        if (!map?.id) return;
        if (viewMode === "editor2d") return;

        const timer = window.setInterval(() => {
            void loadMap(map.id);
        }, 8000);

        return () => window.clearInterval(timer);
        /* eslint-disable-next-line */
    }, [map?.id, viewMode]);

    useEffect(() => {
        if (!selectedRack) {
            setRackDetail(null);
            setEditRackName("");
            setEditAisle("");
            setEditRackNo("");
            return;
        }
        setEditRackName(selectedRack.name || "");
        setEditAisle(selectedRack.aisle || "A");
        setEditRackNo(selectedRack.rackNo || "K01");
        setEditFloors(Number(selectedRack.floors || 5));
        void reloadRackDetail(selectedRack.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRack?.id]);

    const currentBranchName = branches.find((branch) => branch.id === branchId)?.name || branchId;

    const reloadRackDetail = async (rackId: string) => {
        try {
            setRackDetailLoading(true);
            const data = await getRackInventory(rackId);
            setRackDetail(data);
        } catch (err) {
            setRackDetail(null);
            setMessage(err instanceof Error ? err.message : "Không tải được tồn kệ.");
        } finally {
            setRackDetailLoading(false);
        }
    };

    const handleCreateMap = async () => {
        if (!branchId) return;
        const duplicate = maps.find((item) => item.branchId === branchId && item.name.trim().toLowerCase() === newMapName.trim().toLowerCase());
        if (duplicate) { setSelectedMapId(duplicate.id); await loadMap(duplicate.id); setMessage(`Sơ đồ ${duplicate.name} đã tồn tại, đã mở lại.`); return; }
        setLoading(true);
        try {
            const created = await createWarehouseMap({ branchId, name: newMapName, code: `${branchId}-MAP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, width: 1200, height: 760 });
            await loadMaps(branchId);
            setSelectedMapId(created.id);
            await loadMap(created.id);
            setMessage(`Đã tạo sơ đồ ${created.name}.`);
        } finally { setLoading(false); }
    };

    const handleAddFloor = async () => {
        if (!map?.id) return;
        setLoading(true);
        try {
            const floor = await createWarehouseFloor(map.id, { name: `Tầng ${(map.floors?.length || 0) + 1}`, level: (map.floors?.length || 0) + 1 });
            setCurrentFloorId(floor.id);
            await loadMap(map.id);
            setMessage(`Đã thêm ${floor.name}.`);
        } finally { setLoading(false); }
    };

    const handleQuickLayout = async () => { if (map?.id) { setLoading(true); try { const r = await createQuickLayout(map.id); setMessage(r.message || "Đã tạo layout."); await loadMap(map.id); } finally { setLoading(false); } } };
    const handleResetLayout = async () => { if (map?.id && window.confirm("Reset toàn bộ kệ trong sơ đồ này?")) { await resetWarehouseLayout(map.id); setSelectedRack(null); await loadMap(map.id); } };

    const handleSaveCustomLayout = async () => {
        if (!map?.id) return;
        const validRows = layoutRows.map((row) => ({ aisle: String(row.aisle || "").trim().toUpperCase(), rackCount: Number(row.rackCount || 0), floors: Number(row.floors || 5) })).filter((row) => row.aisle && row.rackCount > 0);
        if (!validRows.length) return setMessage("Cần ít nhất 1 dãy có số kệ > 0.");
        setLoading(true);
        try {
            const result = await createCustomWarehouseLayout(map.id, { zone: "A", resetBeforeCreate, floorId: currentFloor?.id, aisles: validRows });
            setMessage(result.message || `Đã lưu layout kho ${result.total} kệ.`);
            setSelectedRack(null);
            await loadMap(map.id);
        } finally { setLoading(false); }
    };

    const handleUpdateLayoutRow = (index: number, field: keyof CustomLayoutAisle, value: string) => {
        setLayoutRows((prev) => prev.map((row, i) => i === index ? { ...row, [field]: field === "aisle" ? value : Number(value || 0) } : row));
    };
    const handleAddLayoutRow = () => setLayoutRows((prev) => [...prev, { aisle: String.fromCharCode(65 + prev.length), rackCount: 10, floors: 5 }]);
    const handleRemoveLayoutRow = (index: number) => setLayoutRows((prev) => prev.filter((_, i) => i !== index));

    const patchRackStatuses = async (targets: WarehouseRack[], status: "IN_PROGRESS" | "FINISHED" | "MISMATCH") => {
        if (!map?.id || !targets.length) return;

        const targetIds = new Set(targets.map((rack) => rack.id));

        // Optimistic UI: đổi màu ngay, không đợi reload.
        setMap((prev) => prev ? {
            ...prev,
            racks: (prev.racks || []).map((rack) => targetIds.has(rack.id) ? { ...rack, status } : rack),
        } : prev);

        setSelectedEditorRacks((prev) => prev.map((rack) => targetIds.has(rack.id) ? { ...rack, status } : rack));

        if (selectedRack && targetIds.has(selectedRack.id)) {
            setSelectedRack({ ...selectedRack, status });
        }

        await Promise.all(targets.map((rack) => updateRack(rack.id, { status } as any)));
    };

    const handleCreateAreaFromMap = async () => {
        if (!map?.id || !branchId) return;

        const targets = visibleRacks;
        await patchRackStatuses(targets, "IN_PROGRESS");

        if (stocktakeSessionId.trim()) {
            const area = await createStocktakeArea({ sessionId: stocktakeSessionId.trim(), branchId, mapId: map.id, scopeType: "MAP", label: `Kiểm toàn bộ ${map.name}` });
            setMessage(`Đã tạo khu kiểm: ${area.label}. Đã đánh dấu ${targets.length} kệ đang kiểm.`);
        } else {
            setMessage(`Đã đánh dấu toàn kho: ${targets.length} kệ đang kiểm. Có Session ID thì hệ thống sẽ lưu thêm khu kiểm.`);
        }
    };

    const handleCreateAreaFromAisle = async () => {
        if (!map?.id || !branchId) return;

        const aisle = selectedEditorRacks[0]?.aisle || selectedRack?.aisle;
        if (!aisle) return setMessage("Chọn 1 kệ hoặc box select 1 dãy trước.");

        const targets = selectedEditorRacks.length
            ? selectedEditorRacks
            : visibleRacks.filter((rack) => rack.aisle === aisle);

        await patchRackStatuses(targets, "IN_PROGRESS");

        if (stocktakeSessionId.trim()) {
            const area = await createStocktakeArea({ sessionId: stocktakeSessionId.trim(), branchId, mapId: map.id, scopeType: "AISLE", aisle, label: `Kiểm dãy ${aisle}` });
            setMessage(`Đã tạo khu kiểm: ${area.label}. Đã đánh dấu ${targets.length} kệ đang kiểm.`);
        } else {
            setMessage(`Đã đánh dấu dãy ${aisle}: ${targets.length} kệ đang kiểm. Có Session ID thì hệ thống sẽ lưu thêm khu kiểm.`);
        }
    };

    const handleCreateAreaFromRack = async () => {
        if (!map?.id || !branchId) return;

        const targets = selectedEditorRacks.length ? selectedEditorRacks : selectedRack ? [selectedRack] : [];
        if (!targets.length) return setMessage("Chọn kệ trước.");

        await patchRackStatuses(targets, "IN_PROGRESS");

        if (stocktakeSessionId.trim() && targets.length === 1) {
            const rack = targets[0];
            const area = await createStocktakeArea({ sessionId: stocktakeSessionId.trim(), branchId, mapId: map.id, scopeType: "RACK", aisle: rack.aisle, rackId: rack.id, rackCode: rack.code, label: `Kiểm ${rack.name}` });
            setMessage(`Đã tạo khu kiểm: ${area.label}.`);
        } else {
            setMessage(`Đã đánh dấu ${targets.length} kệ đang kiểm. Có Session ID + chọn 1 kệ thì hệ thống sẽ lưu thêm khu kiểm.`);
        }
    };
    const handleStatus = async (rack: WarehouseRack, status: string) => {
        if (!map?.id) return;
        await updateRack(rack.id, { status } as any);
        setMap((prev) => prev ? {
            ...prev,
            racks: (prev.racks || []).map((item) => item.id === rack.id ? { ...item, status } : item),
        } : prev);
        if (selectedRack?.id === rack.id) setSelectedRack({ ...rack, status });
    };

    const handleBulkStatus = async (status: "IN_PROGRESS" | "FINISHED" | "MISMATCH") => {
        if (!map?.id) return;

        const targets = selectedEditorRacks.length ? selectedEditorRacks : selectedRack ? [selectedRack] : [];
        if (!targets.length) {
            setMessage("Chọn một kệ hoặc box select nhiều kệ trước.");
            return;
        }

        setLoading(true);
        try {
            await patchRackStatuses(targets, status);
            const label = status === "IN_PROGRESS" ? "đang kiểm" : status === "FINISHED" ? "đã kiểm" : "có lệch";
            setMessage(`Đã đánh dấu ${targets.length} kệ: ${label}.`);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Không cập nhật được trạng thái kiểm.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRack = async (rack: WarehouseRack) => { if (!map?.id || !window.confirm(`Xóa kệ ${rack.name}?`)) return; await deleteRack(rack.id); setSelectedRack(null); await loadMap(map.id); };

    const handleSaveRackInfo = async () => {
        if (!selectedRack || !map?.id) return;
        await updateRack(selectedRack.id, {
            name: editRackName.trim() || selectedRack.name,
            aisle: editAisle.trim().toUpperCase() || selectedRack.aisle,
            rackNo: editRackNo.trim().toUpperCase() || selectedRack.rackNo,
            floors: Number(editFloors || selectedRack.floors || 5),
        } as any);
        setMessage("Đã lưu thông tin kệ.");
        await loadMap(map.id);
        await reloadRackDetail(selectedRack.id);
    };

    const handleSearchSku = async () => {
        const q = skuSearch.trim();
        if (!q) return;
        const data = await searchWarehouseVariants({ q, branchId, limit: 30 });
        setVariantOptions(data);
        if (data[0]?.id) setSelectedVariantId(data[0].id);
    };

    const handleAssignSku = async () => {
        if (!selectedRack) return;
        if (!selectedVariantId && !skuSearch.trim()) return setMessage("Nhập SKU hoặc chọn SKU để gán.");
        const detail = await assignSkuToRack({ rackId: selectedRack.id, variantId: selectedVariantId || undefined, sku: selectedVariantId ? undefined : skuSearch.trim(), isPrimary: true });
        setRackDetail(detail as any);
        setMap((prev) => prev ? { ...prev, racks: (prev.racks || []).map((rack) => rack.id === selectedRack.id ? { ...rack, skuCount: detail.totalSkus || detail.totalSku || detail.items?.length || 0, totalQty: detail.totalQty || 0 } : rack) } : prev);
        setHeatmapByRackId((prev) => ({ ...prev, [selectedRack.id]: { ...(prev[selectedRack.id] || {}), skuCount: detail.totalSkus || detail.totalSku || detail.items?.length || 0, qty: detail.totalQty || 0 } }));
        setSkuSearch("");
        setVariantOptions([]);
        setSelectedVariantId("");
        setMessage("Đã gán SKU vào kệ.");
        await reloadRackDetail(selectedRack.id);
    };

    const handleRemoveLocation = async (locationId: string) => {
        if (!selectedRack || !window.confirm("Gỡ SKU khỏi kệ này?")) return;
        await removeSkuFromRack(locationId);
        await reloadRackDetail(selectedRack.id);
        setTimeout(() => { if (map?.id) void handleHeatmapAndRebalance(); }, 0);
    };

    const handleScanRack = async () => {
        if (!map?.id || !scanText.trim()) return;
        try {
            const result = await scanWarehouseRack({ code: scanText.trim(), mapId: map.id, branchId });
            setOperationMode("scan");
            setScanRackCode(result.scanRackCode);
            setHighlightRackIds([result.rack.id]);
            setPickingPath([]);
            setRebalanceRackIds([]);
            setSelectedRack(result.rack);
            setRightTab("operation");
            if (result.inventory) setRackDetail(result.inventory as any);
            else await reloadRackDetail(result.rack.id);
            setMessage(`Đã scan: ${result.shortCode}. Đã highlight kệ trên sơ đồ.`);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Không tìm thấy kệ.");
        }
    };

    const handleCreatePickingRoute = async () => {
        if (!map?.id) return;

        const skus = pickingSkus
            .split(/\r?\n|,/) // ✅ fix regex
            .map((x) => x.trim())
            .filter(Boolean);

        if (!skus.length) {
            return setMessage("Dán ít nhất 1 SKU để tạo tuyến pick.");
        }

        const result = await getPickingRoute(map.id, { skus, branchId });
        const route = result.route || [];

        setPickingRoute(route);
        setMissingPickSkus(result.missingSkus || []);
        setOperationMode("picking");

        setHighlightRackIds(
            Array.from(new Set(route.map((row: any) => row.rackId).filter(Boolean)))
        );

        setPickingPath(
            route.map((row: any) => ({
                x: Number(row.x || 0) + 80,
                y: Number(row.y || 0) + 18,
                rackId: row.rackId,
                label: row.sku,
            }))
        );

        setRebalanceRackIds([]);

        if (route?.[0]?.rackCode) {
            setScanRackCode(route[0].rackCode);
        }

        setRightTab("operation");

        setMessage(
            `Đã tạo tuyến pick: ${route.length}/${skus.length} SKU.` +
            (result.missingSkus?.length
                ? ` Thiếu: ${result.missingSkus.join(", ")}`
                : "")
        );
    };

    const handleHeatmapAndRebalance = async () => {
        if (!map?.id) return;
        const [h, r] = await Promise.all([getWarehouseHeatmap(map.id), getRebalanceSuggestions(map.id)]);
        setHeatmap(h);
        setRebalance(r);
        const heatById: Record<string, { color?: string; heat?: string; qty?: number; skuCount?: number }> = {};
        (h.racks || []).forEach((rack: any) => {
            heatById[rack.rackId] = { color: rack.color, heat: rack.heat || rack.level, qty: rack.qty, skuCount: rack.skuCount };
        });
        setHeatmapByRackId(heatById);
        const suggestionRackIds = Array.from(new Set((r.suggestions || []).flatMap((s: any) => [s.rackId, s.fromRackId, s.targetRackId, s.toRackId]).filter(Boolean))) as string[];
        setRebalanceRackIds(suggestionRackIds);
        setHighlightRackIds(suggestionRackIds);
        setPickingPath([]);
        setOperationMode(suggestionRackIds.length ? "rebalance" : "heatmap");
        setMap((prev) => prev ? {
            ...prev,
            racks: (prev.racks || []).map((rack) => heatById[rack.id] ? { ...rack, skuCount: heatById[rack.id].skuCount, totalQty: heatById[rack.id].qty } : rack),
        } : prev);
        setRightTab("operation");
        setMessage(`Đã bật heatmap: ${h.totalRacks} kệ, ${h.emptyRacks} trống, ${h.lowRacks} ít hàng, ${h.highRacks} nhiều hàng. Gợi ý: ${r.totalSuggestions || 0}.`);
    };

    const selectedStatus = selectedRack?.status || "PENDING";
    const selectedStatusInfo = statusMeta[selectedStatus] || statusMeta.PENDING;

    return (
        <div className="space-y-5 bg-neutral-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Sơ đồ kho 2D/3D
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        2D để chỉnh sửa nhanh, 3D chỉ để xem preview.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm"
                        value={branchId}
                        onChange={(e) => {
                            setBranchId(e.target.value);
                            setSelectedMapId("");
                            setMap(null);
                            setSelectedRack(null);
                        }}
                    >
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>

                    <select
                        className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm"
                        value={selectedMapId}
                        onChange={(e) => setSelectedMapId(e.target.value)}
                    >
                        <option value="">Chọn sơ đồ</option>
                        {maps.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} — {item.code?.slice(-6)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {message ? (
                <Panel className="p-4">
                    <p className="text-sm text-neutral-700">{message}</p>
                </Panel>
            ) : null}

            <Panel className="overflow-hidden">
                <div className="grid gap-0 py-4 md:grid-cols-3 xl:grid-cols-5">
                    <div className="px-4">
                        <p className="text-sm text-neutral-500">Kho</p>
                        <h3 className="mt-2 text-xl font-semibold">
                            {map?.name || newMapName}
                        </h3>
                        <p className="mt-1 text-xs text-neutral-500">{currentBranchName}</p>
                    </div>

                    <StatTile title="Số dãy kệ" value={stats.aisles} tone="blue" />
                    <StatTile title="Tổng kệ" value={stats.total} tone="blue" />
                    <StatTile title="Tổng tầng" value={stats.floors} tone="blue" />
                    <StatTile
                        title="Đang kiểm / đã kiểm"
                        value={`${stats.inProgress}/${stats.finished}`}
                        tone="green"
                    />
                </div>
            </Panel>

            {!map ? (
                <Panel className="p-5">
                    <h3 className="text-lg font-semibold">Tạo sơ đồ kho đầu tiên</h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <input
                            className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm"
                            value={newMapName}
                            onChange={(e) => setNewMapName(e.target.value)}
                            placeholder="Ví dụ: Kho A"
                        />

                        <Button onClick={handleCreateMap} disabled={loading}>
                            Tạo sơ đồ kho
                        </Button>
                    </div>
                </Panel>
            ) : (
                <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
                    <div className="space-y-4">
                        <Panel className="overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-3">
                                <div className="flex flex-wrap gap-2">
                                    {(Object.keys(viewModeLabel) as ViewMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setViewMode(mode)}
                                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${viewMode === mode
                                                    ? "bg-blue-600 text-white shadow-sm"
                                                    : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                                }`}
                                        >
                                            {viewModeLabel[mode]}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="green"
                                        onClick={handleQuickLayout}
                                        disabled={loading}
                                    >
                                        Tạo nhanh 4 dãy x 12 kệ
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        onClick={() => void loadMap(map.id)}
                                        disabled={loading || editorBusy}
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-2 border-b border-neutral-200 bg-white px-5 py-2">
                                <span className="text-sm font-semibold text-neutral-500">
                                    Tầng:
                                </span>

                                {(map.floors || []).map((floor) => (
                                    <button
                                        key={floor.id}
                                        type="button"
                                        onClick={() => setCurrentFloorId(floor.id)}
                                        className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${currentFloor?.id === floor.id
                                                ? "bg-blue-600 text-white"
                                                : "border bg-white"
                                            }`}
                                    >
                                        {floor.name}
                                    </button>
                                ))}

                                <Button
                                    variant="secondary"
                                    onClick={handleAddFloor}
                                    disabled={loading}
                                >
                                    + Tầng
                                </Button>
                            </div>

                            {viewMode === "editor2d" ? (
                                <WarehouseMap2DEditor
                                    map={map}
                                    branchId={branchId}
                                    currentFloor={currentFloor}
                                    selectedRackId={selectedRack?.id}
                                    scanRackCode={scanRackCode}
                                    operationMode={operationMode}
                                    highlightRackIds={highlightRackIds}
                                    pickingPath={pickingPath}
                                    heatmapByRackId={heatmapByRackId}
                                    rebalanceRackIds={rebalanceRackIds}
                                    onSelectRack={(rack) => {
                                        setSelectedRack(rack);
                                        if (rack) setRightTab("info");
                                    }}
                                    onSelectRackDetail={setSelectedRack}
                                    onChange={undefined}
                                    onEditingChange={setEditorBusy}
                                    onSelectionChange={setSelectedEditorRacks}
                                />
                            ) : (
                                <div className="relative">
                                    <WarehouseMap3D
                                        map={{
                                            ...map,
                                            racks: visibleRacks,
                                        } as any}
                                        selectedRackId={selectedRack?.id}
                                        onSelectRack={(rack) => {
                                            setSelectedRack(rack);
                                        }}
                                        branchId={branchId}
                                        currentFloor={currentFloor}
                                        onChange={() => {
                                            if (map?.id) {
                                                void loadMap(map.id);
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </Panel>
                    </div>

                    {/* PHẦN PANEL BÊN PHẢI CỦA M GIỮ NGUYÊN Ở DƯỚI */}
                </div>
            )}
        </div>
  );
}