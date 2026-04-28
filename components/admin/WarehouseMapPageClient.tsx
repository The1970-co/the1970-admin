"use client";

import { useEffect, useMemo, useState } from "react";
import { getBranches, type BranchItem } from "@/lib/products-api";
import WarehouseMap3D from "@/components/admin/WarehouseMap3D";
import { createStocktakeArea } from "@/lib/stocktake-area-api";
import {
  createCustomWarehouseLayout,
  createQuickLayout,
  createRack,
  createWarehouseMap,
  deleteRack,
  getWarehouseMap,
  listWarehouseMaps,
  resetWarehouseLayout,
  updateRack,
  type CustomLayoutAisle,
  type WarehouseMap,
  type WarehouseRack,
} from "@/lib/warehouse-map-api";

type ViewMode = "isometric" | "top" | "front" | "side";
type RightTab = "info" | "history" | "settings";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "green" | "blue" | "softRed";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition";
  const tone =
    variant === "green"
      ? "bg-green-600 text-white hover:bg-green-500"
      : variant === "blue"
        ? "bg-blue-600 text-white hover:bg-blue-500"
        : variant === "primary"
          ? "bg-neutral-900 text-white hover:bg-neutral-800"
          : variant === "danger"
            ? "bg-red-600 text-white hover:bg-red-500"
            : variant === "softRed"
              ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function StatTile({
  title,
  value,
  sub,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  const color =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
        ? "text-green-700"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "red"
            ? "text-red-700"
            : "text-neutral-900";

  return (
    <div className="border-r border-neutral-100 px-4 last:border-r-0">
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
      {sub ? <p className="mt-1 text-xs text-neutral-400">{sub}</p> : null}
    </div>
  );
}

const statusMeta: Record<
  string,
  {
    label: string;
    tone: "gray" | "green" | "amber" | "red" | "blue";
  }
> = {
  PENDING: { label: "Chưa kiểm", tone: "gray" },
  IN_PROGRESS: { label: "Đang kiểm", tone: "amber" },
  FINISHED: { label: "Đã kiểm", tone: "green" },
  MISMATCH: { label: "Có lệch", tone: "red" },
};

const viewModeLabel: Record<ViewMode, string> = {
  isometric: "3D",
  top: "2D Top view",
  front: "Mặt trước",
  side: "Mặt bên",
};

type WarehouseFloorLite = {
  id: string;
  mapId: string;
  name: string;
  level: number;
};

type WarehouseZoneLite = {
  id: string;
  mapId: string;
  floorId: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string | null;
};

type WarehouseDoorLite = {
  id: string;
  mapId: string;
  floorId: string;
  name: string;
  side: string;
  x: number;
  y: number;
  width: number;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

function getTokenFromStorage() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function warehouseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getTokenFromStorage();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

export default function WarehouseMapPageClient() {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [branchId, setBranchId] = useState("");
  const [maps, setMaps] = useState<WarehouseMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState("");
  const [map, setMap] = useState<WarehouseMap | null>(null);
  const [selectedRack, setSelectedRack] = useState<WarehouseRack | null>(null);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("isometric");
  const [rightTab, setRightTab] = useState<RightTab>("info");

  const [newMapName, setNewMapName] = useState("Kho A");
  const [newRackName, setNewRackName] = useState("");
  const [newRackAisle, setNewRackAisle] = useState("A");
  const [newRackNo, setNewRackNo] = useState("K01");

  const [editRackName, setEditRackName] = useState("");
  const [editRackAisle, setEditRackAisle] = useState("");
  const [editRackNo, setEditRackNo] = useState("");
  const [editRackFloors, setEditRackFloors] = useState(5);

  const [stocktakeSessionId, setStocktakeSessionId] = useState("");

  const [floors, setFloors] = useState<WarehouseFloorLite[]>([]);
  const [currentFloorId, setCurrentFloorId] = useState("");
  const [highlightedRackId, setHighlightedRackId] = useState("");

  const [layoutRows, setLayoutRows] = useState<CustomLayoutAisle[]>([
    { aisle: "A", rackCount: 5, floors: 5 },
    { aisle: "B", rackCount: 10, floors: 5 },
  ]);
  const [resetBeforeCreate, setResetBeforeCreate] = useState(true);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await getBranches();
        setBranches(data);
        setBranchId(data[0]?.id || "");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Không tải được chi nhánh.");
      }
    };

    void loadBranches();
  }, []);

  useEffect(() => {
    if (!selectedRack) return;

    setEditRackName(selectedRack.name || "");
    setEditRackAisle(selectedRack.aisle || "");
    setEditRackNo(selectedRack.rackNo || "");
    setEditRackFloors(Number(selectedRack.floors || 5));
  }, [selectedRack]);

  const loadMaps = async (selectedBranchId = branchId) => {
    if (!selectedBranchId) return;

    const data = await listWarehouseMaps(selectedBranchId);
    setMaps(data);

    if (data.length && !selectedMapId) {
      setSelectedMapId(data[0].id);
    }

    if (!data.length) {
      setSelectedMapId("");
      setMap(null);
    }
  };

  const loadMap = async (id = selectedMapId) => {
    if (!id) return;

    try {
      const data = await warehouseRequest<WarehouseMap & {
        floors?: WarehouseFloorLite[];
        zones?: WarehouseZoneLite[];
        doors?: WarehouseDoorLite[];
      }>(`/warehouse-map/${id}/full`);

      setMap({ ...data, racks: data.racks || [] });
      setFloors(data.floors || []);
      setCurrentFloorId((prev) => prev || data.floors?.[0]?.id || "");

      setSelectedRack((prev) =>
        prev ? (data.racks || []).find((rack) => rack.id === prev.id) || null : null
      );
    } catch {
      const data = await getWarehouseMap(id);
      setMap({ ...data, racks: data.racks || [] });
      setSelectedRack((prev) =>
        prev ? (data.racks || []).find((rack) => rack.id === prev.id) || null : null
      );
    }
  };

  useEffect(() => {
    if (!branchId) return;
    void loadMaps(branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (!selectedMapId) return;
    void loadMap(selectedMapId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapId]);

  const stats = useMemo(() => {
    const racks = map?.racks || [];
    const finished = racks.filter((r) => r.status === "FINISHED").length;
    const inProgress = racks.filter((r) => r.status === "IN_PROGRESS").length;
    const mismatch = racks.filter((r) => r.status === "MISMATCH").length;
    const pending = racks.filter((r) => !r.status || r.status === "PENDING").length;
    const floors = racks.reduce((sum, rack) => sum + Number(rack.floors || 0), 0);
    const aisles = Array.from(new Set(racks.map((rack) => rack.aisle))).length;

    return {
      total: racks.length,
      finished,
      inProgress,
      mismatch,
      pending,
      floors,
      aisles,
    };
  }, [map]);

  const aisleSummary = useMemo(() => {
    const racks = map?.racks || [];
    const aisles = Array.from(new Set(racks.map((rack) => rack.aisle))).sort();

    return aisles.map((aisle) => {
      const aisleRacks = racks.filter((rack) => rack.aisle === aisle);
      const finished = aisleRacks.filter((rack) => rack.status === "FINISHED").length;
      const inProgress = aisleRacks.filter((rack) => rack.status === "IN_PROGRESS").length;
      const mismatch = aisleRacks.filter((rack) => rack.status === "MISMATCH").length;
      const progress = aisleRacks.length ? Math.round((finished / aisleRacks.length) * 100) : 0;
      const status =
        mismatch > 0
          ? "MISMATCH"
          : inProgress > 0
            ? "IN_PROGRESS"
            : progress === 100 && aisleRacks.length
              ? "FINISHED"
              : "PENDING";

      return {
        aisle,
        rackCount: aisleRacks.length,
        floors: aisleRacks[0]?.floors || 5,
        totalSlots: aisleRacks.reduce((sum, rack) => sum + Number(rack.floors || 0), 0),
        progress,
        status,
      };
    });
  }, [map]);

  const currentBranchName =
    branches.find((branch) => branch.id === branchId)?.name || branchId;

  const handleCreateMap = async () => {
    if (!branchId) return;

    try {
      setLoading(true);
      setMessage("");

      const created = await createWarehouseMap({
        branchId,
        name: newMapName,
        code: `${branchId}-MAP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        width: 1200,
        height: 760,
      });

      const data = await listWarehouseMaps(branchId);
      setMaps(data);
      setSelectedMapId(created.id);
      setMap({ ...created, racks: created.racks || [] });
      setSelectedRack(null);
      setMessage(`Đã tạo sơ đồ ${created.name}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được sơ đồ.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLayout = async () => {
    if (!map?.id) {
      setMessage("Chưa có sơ đồ kho để tạo layout.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Đang tạo nhanh layout...");

      const result = await createQuickLayout(map.id);
      setMessage(result.message || `Đã tạo/cập nhật layout ${result.total || result.created} kệ.`);
      await loadMap(map.id);
      await loadMaps(branchId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được layout.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomLayout = async () => {
    if (!map?.id) {
      setMessage("Chưa có sơ đồ kho để lưu layout.");
      return;
    }

    const validRows = layoutRows
      .map((row) => ({
        aisle: String(row.aisle || "").trim().toUpperCase(),
        rackCount: Number(row.rackCount || 0),
        floors: Number(row.floors || 5),
      }))
      .filter((row) => row.aisle && row.rackCount > 0);

    if (!validRows.length) {
      setMessage("Cần ít nhất 1 dãy có số kệ > 0.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Đang lưu layout kho...");

      const result = await createCustomWarehouseLayout(map.id, {
        zone: "A",
        resetBeforeCreate,
        aisles: validRows,
      });

      setMessage(result.message || `Đã lưu layout kho ${result.total} kệ.`);
      setSelectedRack(null);
      await loadMap(map.id);
      await loadMaps(branchId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không lưu được layout kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleInitLayout = async () => {
    if (!map?.id) {
      setMessage("Chưa có sơ đồ kho để khởi tạo layout.");
      return;
    }

    const validRows = layoutRows
      .map((row) => ({
        aisle: String(row.aisle || "").trim().toUpperCase(),
        rackCount: Number(row.rackCount || 0),
        floors: Number(row.floors || 5),
      }))
      .filter((row) => row.aisle && row.rackCount > 0);

    if (!validRows.length) {
      setMessage("Cần ít nhất 1 dãy có số kệ > 0.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Đang khởi tạo layout kho...");

      const result = await createCustomWarehouseLayout(map.id, {
        zone: "A",
        resetBeforeCreate: true,
        aisles: validRows,
      });

      setMessage(result.message || `Đã khởi tạo layout kho ${result.total} kệ.`);
      setSelectedRack(null);
      await loadMap(map.id);
      await loadMaps(branchId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không khởi tạo được layout kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLayout = async () => {
    if (!map?.id) return;

    const ok = window.confirm(
      "Reset toàn bộ kệ trong sơ đồ này? Dữ liệu kệ sẽ bị ẩn để tạo lại layout."
    );
    if (!ok) return;

    try {
      setLoading(true);
      setMessage("Đang reset layout...");

      const result = await resetWarehouseLayout(map.id);
      setMessage(result.message || "Đã reset layout.");
      setSelectedRack(null);
      await loadMap(map.id);
      await loadMaps(branchId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không reset được layout.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRack = async () => {
    if (!map?.id || !branchId) return;

    try {
      setLoading(true);
      setMessage("");

      const rackCount = map.racks?.length || 0;
      const created = await createRack({
        mapId: map.id,
        branchId,
        name: newRackName || `Dãy ${newRackAisle} - ${newRackNo}`,
        zone: "A",
        aisle: newRackAisle.trim().toUpperCase(),
        rackNo: newRackNo.trim().toUpperCase(),
        floors: 5,
        x: 80 + (rackCount % 4) * 230,
        y: 60 + Math.floor(rackCount / 4) * 46,
        w: 160,
        h: 34,
      });

      setMessage(`Đã thêm kệ ${created.name}.`);
      await loadMap(map.id);
      await loadMaps(branchId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thêm được kệ.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSelectedRack = async () => {
    if (!map?.id || !selectedRack) {
      setMessage("Chưa chọn kệ để chỉnh sửa.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Đang cập nhật kệ...");

      const updated = await updateRack(selectedRack.id, {
        name: editRackName,
        aisle: editRackAisle.trim().toUpperCase(),
        rackNo: editRackNo.trim().toUpperCase(),
        floors: Number(editRackFloors || 5),
      });

      setSelectedRack(updated);
      setMessage(`Đã cập nhật ${updated.name}.`);
      await loadMap(map.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không cập nhật được kệ.");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateRack = async () => {
    if (!map?.id || !branchId || !selectedRack) {
      setMessage("Chưa chọn kệ để nhân bản.");
      return;
    }

    try {
      setLoading(true);
      const created = await createRack({
        mapId: map.id,
        branchId,
        name: `${selectedRack.name} copy`,
        zone: selectedRack.zone || "A",
        aisle: selectedRack.aisle,
        rackNo: `${selectedRack.rackNo}-COPY`,
        floors: selectedRack.floors || 5,
        x: Number(selectedRack.x || 0) + 35,
        y: Number(selectedRack.y || 0) + 35,
        w: selectedRack.w || 160,
        h: selectedRack.h || 34,
      });

      setMessage(`Đã nhân bản ${created.name}.`);
      await loadMap(map.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không nhân bản được kệ.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFloorToSelected = async () => {
    if (!map?.id || !selectedRack) {
      setMessage("Chưa chọn kệ để thêm tầng.");
      return;
    }

    await updateRack(selectedRack.id, {
      floors: Number(selectedRack.floors || 0) + 1,
    });
    await loadMap(map.id);
    setMessage(`Đã thêm tầng cho ${selectedRack.name}.`);
  };

  const handleMoveRack = async (rack: WarehouseRack, dx: number, dy: number) => {
    if (!map?.id) return;

    await updateRack(rack.id, {
      x: Number(rack.x || 0) + dx,
      y: Number(rack.y || 0) + dy,
    });

    await loadMap(map.id);
  };

  const handleStatus = async (rack: WarehouseRack, status: string) => {
    if (!map?.id) return;

    await updateRack(rack.id, { status });
    await loadMap(map.id);
  };

  const handleDeleteRack = async (rack: WarehouseRack) => {
    if (!map?.id) return;
    if (!window.confirm(`Xóa kệ ${rack.name}?`)) return;

    await deleteRack(rack.id);
    setSelectedRack(null);
    await loadMap(map.id);
    await loadMaps(branchId);
  };

  const handleAddLayoutRow = () => {
    const nextIndex = layoutRows.length;
    const nextLetter = String.fromCharCode(65 + nextIndex);
    setLayoutRows([...layoutRows, { aisle: nextLetter, rackCount: 10, floors: 5 }]);
    setRightTab("settings");
    setMessage("Đã thêm một dãy trong phần Cài đặt sơ đồ. Bấm Lưu hoặc Khởi tạo để áp dụng.");
  };

  const handleUpdateLayoutRow = (
    index: number,
    field: keyof CustomLayoutAisle,
    value: string
  ) => {
    setLayoutRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: field === "aisle" ? value : Number(value || 0),
            }
          : row
      )
    );
  };

  const handleRemoveLayoutRow = (index: number) => {
    setLayoutRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleCreateAreaFromMap = async () => {
    if (!map?.id || !branchId) return setMessage("Chưa có sơ đồ kho.");
    if (!stocktakeSessionId.trim()) return setMessage("Cần nhập Session ID phiên kiểm kho.");

    try {
      setLoading(true);
      const area = await createStocktakeArea({
        sessionId: stocktakeSessionId.trim(),
        branchId,
        mapId: map.id,
        scopeType: "MAP",
        label: `Kiểm toàn bộ ${map.name}`,
      });
      setMessage(`Đã tạo khu kiểm: ${area.label}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được khu kiểm.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAreaFromAisle = async () => {
    if (!map?.id || !branchId) return setMessage("Chưa có sơ đồ kho.");
    if (!selectedRack) return setMessage("Hãy chọn một kệ thuộc dãy cần kiểm trước.");
    if (!stocktakeSessionId.trim()) return setMessage("Cần nhập Session ID phiên kiểm kho.");

    try {
      setLoading(true);
      const area = await createStocktakeArea({
        sessionId: stocktakeSessionId.trim(),
        branchId,
        mapId: map.id,
        scopeType: "AISLE",
        aisle: selectedRack.aisle,
        label: `Kiểm dãy ${selectedRack.aisle}`,
      });
      setMessage(`Đã tạo khu kiểm: ${area.label}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được khu kiểm.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAreaFromRack = async () => {
    if (!map?.id || !branchId) return setMessage("Chưa có sơ đồ kho.");
    if (!selectedRack) return setMessage("Hãy chọn một kệ cần kiểm trước.");
    if (!stocktakeSessionId.trim()) return setMessage("Cần nhập Session ID phiên kiểm kho.");

    try {
      setLoading(true);
      const area = await createStocktakeArea({
        sessionId: stocktakeSessionId.trim(),
        branchId,
        mapId: map.id,
        scopeType: "RACK",
        aisle: selectedRack.aisle,
        rackId: selectedRack.id,
        rackCode: selectedRack.code,
        label: `Kiểm ${selectedRack.name}`,
      });
      setMessage(`Đã tạo khu kiểm: ${area.label}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được khu kiểm.");
    } finally {
      setLoading(false);
    }
  };

  const currentFloor = floors.find((floor) => floor.id === currentFloorId) || floors[0];

  const handleCreateFloor = async () => {
    if (!map?.id) return setMessage("Chưa có sơ đồ kho.");

    try {
      setLoading(true);
      const nextLevel = floors.length + 1;
      const floor = await warehouseRequest<WarehouseFloorLite>(`/warehouse-map/${map.id}/floors`, {
        method: "POST",
        body: JSON.stringify({
          name: `Tầng ${nextLevel}`,
          level: nextLevel,
        }),
      });
      setFloors((prev) => [...prev, floor]);
      setCurrentFloorId(floor.id);
      setMessage(`Đã tạo ${floor.name}.`);
      await loadMap(map.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được tầng.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async (type: string) => {
    if (!map?.id) return setMessage("Chưa có sơ đồ kho.");
    if (!currentFloor?.id) return setMessage("Chưa có tầng. Bấm + Tầng trước.");

    const preset: Record<string, { name: string; width: number; height: number; color: string; x: number; y: number }> = {
      STORAGE: { name: "Kho A", width: 620, height: 420, color: "#d9f99d", x: 80, y: 80 },
      OFFICE: { name: "Văn phòng", width: 500, height: 1000, color: "#bfdbfe", x: 760, y: 80 },
      PACKING: { name: "Khu đóng hàng", width: 360, height: 220, color: "#fde68a", x: 80, y: 540 },
      RETURN: { name: "Hàng lỗi / hoàn", width: 320, height: 200, color: "#fecaca", x: 470, y: 540 },
    };
    const item = preset[type] || preset.STORAGE;

    try {
      setLoading(true);
      await warehouseRequest(`/warehouse-map/${map.id}/zones`, {
        method: "POST",
        body: JSON.stringify({
          floorId: currentFloor.id,
          type,
          ...item,
        }),
      });
      setMessage(`Đã thêm ${item.name}.`);
      await loadMap(map.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thêm được khu vực.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoor = async () => {
    if (!map?.id) return setMessage("Chưa có sơ đồ kho.");
    if (!currentFloor?.id) return setMessage("Chưa có tầng. Bấm + Tầng trước.");

    try {
      setLoading(true);
      await warehouseRequest(`/warehouse-map/${map.id}/doors`, {
        method: "POST",
        body: JSON.stringify({
          floorId: currentFloor.id,
          name: "Cửa kho",
          side: "BOTTOM",
          x: 0,
          y: 0,
          width: 260,
        }),
      });
      setMessage("Đã thêm cửa kho.");
      await loadMap(map.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thêm được cửa kho.");
    } finally {
      setLoading(false);
    }
  };

  const selectedStatus = selectedRack?.status || "PENDING";
  const selectedStatusInfo = statusMeta[selectedStatus] || statusMeta.PENDING;

  const ToolButton = ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-5 bg-neutral-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Sơ đồ kho 3D</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Quản lý dãy kệ, tầng kệ, vị trí lưu trữ và trạng thái kiểm kho.
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
                {item.name}
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
            <h3 className="mt-2 text-xl font-semibold">{map?.name || newMapName}</h3>
            <p className="mt-1 text-xs text-neutral-500">{currentBranchName}</p>
          </div>
          <StatTile title="Số dãy kệ" value={stats.aisles} tone="blue" />
          <StatTile title="Tổng kệ" value={stats.total} tone="blue" />
          <StatTile title="Tổng tầng" value={stats.floors} tone="blue" />
          <StatTile title="Đang kiểm / đã kiểm" value={`${stats.inProgress}/${stats.finished}`} tone="green" />
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
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        viewMode === mode
                          ? "bg-blue-600 text-white shadow-sm"
                          : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {viewModeLabel[mode]}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="green" onClick={handleQuickLayout} disabled={loading}>
                    Tạo nhanh 4 dãy x 12 kệ
                  </Button>
                  <Button variant="secondary" onClick={() => void loadMap(map.id)} disabled={loading}>
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-4 z-10 w-36 space-y-2">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
                    <p className="mb-2 text-xs font-semibold text-neutral-500">Tầng</p>
                    <div className="space-y-1">
                      {floors.length ? (
                        floors.map((floor) => (
                          <button
                            key={floor.id}
                            type="button"
                            onClick={() => setCurrentFloorId(floor.id)}
                            className={`w-full rounded-xl px-2 py-1 text-left text-xs font-semibold ${
                              currentFloorId === floor.id
                                ? "bg-blue-600 text-white"
                                : "border border-neutral-200 bg-white text-neutral-700"
                            }`}
                          >
                            {floor.name}
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-neutral-400">Chưa có tầng</p>
                      )}
                    </div>
                  </div>

                  <ToolButton onClick={handleCreateFloor}>＋ Thêm tầng kho</ToolButton>
                  <ToolButton onClick={() => handleCreateZone("OFFICE")}>＋ Văn phòng</ToolButton>
                  <ToolButton onClick={() => handleCreateZone("PACKING")}>＋ Khu đóng hàng</ToolButton>
                  <ToolButton onClick={() => handleCreateZone("RETURN")}>＋ Khu hàng lỗi</ToolButton>
                  <ToolButton onClick={handleCreateDoor}>＋ Cửa kho</ToolButton>
                  <ToolButton onClick={handleAddLayoutRow}>＋ Thêm dãy</ToolButton>
                  <ToolButton onClick={handleCreateRack}>＋ Thêm kệ</ToolButton>
                  <ToolButton onClick={handleAddFloorToSelected} disabled={!selectedRack}>＋ Thêm tầng</ToolButton>
                  <ToolButton onClick={() => selectedRack && void handleDeleteRack(selectedRack)} disabled={!selectedRack}>⌫ Xóa chọn</ToolButton>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
                    <p className="mb-2 text-xs font-semibold text-neutral-500">Di chuyển</p>
                    <div className="grid grid-cols-3 gap-1">
                      <span />
                      <button className="rounded-lg border px-2 py-1 text-xs" disabled={!selectedRack} onClick={() => selectedRack && handleMoveRack(selectedRack, 0, -20)}>↑</button>
                      <span />
                      <button className="rounded-lg border px-2 py-1 text-xs" disabled={!selectedRack} onClick={() => selectedRack && handleMoveRack(selectedRack, -20, 0)}>←</button>
                      <button className="rounded-lg border px-2 py-1 text-xs" disabled={!selectedRack} onClick={() => selectedRack && handleMoveRack(selectedRack, 0, 20)}>↓</button>
                      <button className="rounded-lg border px-2 py-1 text-xs" disabled={!selectedRack} onClick={() => selectedRack && handleMoveRack(selectedRack, 20, 0)}>→</button>
                    </div>
                  </div>

                  <ToolButton>⌕ Thu phóng</ToolButton>
                  <ToolButton>◉ Xem góc nhìn</ToolButton>
                </div>

                <div className="absolute right-4 top-4 z-10 space-y-2 rounded-2xl border border-neutral-200 bg-white/90 p-2 shadow-sm backdrop-blur">
                  {[5, 4, 3, 2, 1].map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      className={`block h-9 w-9 rounded-xl text-sm font-semibold ${
                        selectedRack?.floors === floor
                          ? "bg-blue-600 text-white"
                          : "border border-neutral-200 bg-white text-neutral-600"
                      }`}
                    >
                      {floor}
                    </button>
                  ))}
                </div>

                <WarehouseMap3D
                  map={map as any}
                  selectedRackId={selectedRack?.id}
                  highlightedRackId={highlightedRackId}
                  viewMode={viewMode}
                  currentFloorId={currentFloorId}
                  onSelectRack={setSelectedRack}
                />

                <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-2 text-xs text-neutral-500 shadow-sm backdrop-blur">
                  <span>🖱 Kéo chuột để xoay</span>
                  <span>|</span>
                  <span>Scroll để zoom</span>
                  <span>|</span>
                  <span>Click kệ để chọn</span>
                </div>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h3 className="font-semibold">Danh sách dãy kệ trong {map.name}</h3>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Dãy kệ</th>
                      <th className="px-4 py-3 font-medium">Số kệ</th>
                      <th className="px-4 py-3 font-medium">Số tầng/kệ</th>
                      <th className="px-4 py-3 font-medium">Tổng tầng</th>
                      <th className="px-4 py-3 font-medium">Trạng thái kiểm</th>
                      <th className="px-4 py-3 font-medium">Tiến độ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {aisleSummary.map((row) => (
                      <tr key={row.aisle} className="border-t border-neutral-200">
                        <td className="px-4 py-3 font-medium">Dãy {row.aisle}</td>
                        <td className="px-4 py-3">{row.rackCount}</td>
                        <td className="px-4 py-3">{row.floors}</td>
                        <td className="px-4 py-3">{row.totalSlots}</td>
                        <td className="px-4 py-3">
                          <Badge tone={(statusMeta[row.status] || statusMeta.PENDING).tone}>
                            {(statusMeta[row.status] || statusMeta.PENDING).label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-neutral-200">
                              <div
                                className={`h-full ${
                                  row.status === "FINISHED"
                                    ? "bg-green-500"
                                    : row.status === "IN_PROGRESS"
                                      ? "bg-amber-400"
                                      : row.status === "MISMATCH"
                                        ? "bg-red-500"
                                        : "bg-neutral-300"
                                }`}
                                style={{ width: `${row.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-500">{row.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel className="overflow-hidden">
              <div className="grid grid-cols-3 border-b border-neutral-200 text-sm font-semibold">
                {[
                  ["info", "Thông tin"],
                  ["history", "Lịch sử kiểm"],
                  ["settings", "Cài đặt sơ đồ"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRightTab(key as RightTab)}
                    className={`border-b-2 px-3 py-3 ${
                      rightTab === key
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {rightTab === "info" ? (
                  !selectedRack ? (
                    <p className="text-sm text-neutral-500">Click vào một kệ trên sơ đồ để xem/sửa.</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <input
                        className="w-full rounded-2xl border border-neutral-300 px-3 py-2 text-sm"
                        value={editRackName}
                        onChange={(e) => setEditRackName(e.target.value)}
                        placeholder="Tên kệ"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          className="rounded-2xl border border-neutral-300 px-3 py-2 text-sm"
                          value={editRackAisle}
                          onChange={(e) => setEditRackAisle(e.target.value)}
                          placeholder="Dãy"
                        />
                        <input
                          className="rounded-2xl border border-neutral-300 px-3 py-2 text-sm"
                          value={editRackNo}
                          onChange={(e) => setEditRackNo(e.target.value)}
                          placeholder="Kệ"
                        />
                        <input
                          className="rounded-2xl border border-neutral-300 px-3 py-2 text-sm"
                          type="number"
                          value={editRackFloors}
                          onChange={(e) => setEditRackFloors(Number(e.target.value || 0))}
                          placeholder="Tầng"
                        />
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Mã vị trí</span>
                        <span className="font-semibold">{selectedRack.code}</span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Trạng thái</span>
                        <Badge tone={selectedStatusInfo.tone}>{selectedStatusInfo.label}</Badge>
                      </div>

                      <Button variant="blue" onClick={handleUpdateSelectedRack} disabled={loading}>
                        Lưu chỉnh sửa kệ
                      </Button>
                    </div>
                  )
                ) : null}

                {rightTab === "history" ? (
                  <div className="space-y-3 text-sm text-neutral-600">
                    <div className="rounded-2xl bg-neutral-50 p-3">Chưa có lịch sử kiểm cho kệ đang chọn.</div>
                    <div className="rounded-2xl bg-neutral-50 p-3">Khi chạy kiểm kho, log sẽ hiện tại đây.</div>
                  </div>
                ) : null}

                {rightTab === "settings" ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {layoutRows.map((row, index) => (
                        <div key={index} className="grid grid-cols-[1fr_64px_64px_32px] gap-2">
                          <input
                            className="min-w-0 rounded-2xl border border-neutral-300 px-2 py-2 text-sm"
                            value={row.aisle}
                            onChange={(e) => handleUpdateLayoutRow(index, "aisle", e.target.value)}
                            placeholder="Dãy A"
                          />
                          <input
                            className="min-w-0 rounded-2xl border border-neutral-300 px-2 py-2 text-sm"
                            type="number"
                            min={1}
                            value={row.rackCount}
                            onChange={(e) => handleUpdateLayoutRow(index, "rackCount", e.target.value)}
                            placeholder="Kệ"
                          />
                          <input
                            className="min-w-0 rounded-2xl border border-neutral-300 px-2 py-2 text-sm"
                            type="number"
                            min={1}
                            value={row.floors || 5}
                            onChange={(e) => handleUpdateLayoutRow(index, "floors", e.target.value)}
                            placeholder="Tầng"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveLayoutRow(index)}
                            className="rounded-2xl border border-neutral-300 text-sm hover:bg-neutral-50"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-sm text-neutral-600">
                      <input
                        type="checkbox"
                        checked={resetBeforeCreate}
                        onChange={(e) => setResetBeforeCreate(e.target.checked)}
                      />
                      Reset layout cũ trước khi lưu
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="secondary" onClick={handleAddLayoutRow}>+ Dãy</Button>
                      <Button variant="secondary" onClick={handleInitLayout} disabled={loading}>Khởi tạo</Button>
                      <Button variant="blue" onClick={handleSaveCustomLayout} disabled={loading}>Lưu</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-lg font-semibold">Tạo khu kiểm kho</h3>

              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm"
                  placeholder="Dán Session ID phiên kiểm kho"
                  value={stocktakeSessionId}
                  onChange={(e) => setStocktakeSessionId(e.target.value)}
                />

                <div className="grid grid-cols-1 gap-2">
                  <Button variant="blue" onClick={handleCreateAreaFromMap} disabled={loading || !map}>
                    Tạo khu kiểm: Kho tổng
                  </Button>
                  <Button variant="secondary" onClick={handleCreateAreaFromAisle} disabled={loading || !selectedRack}>
                    Tạo khu kiểm: Dãy đang chọn
                  </Button>
                  <Button variant="secondary" onClick={handleCreateAreaFromRack} disabled={loading || !selectedRack}>
                    Tạo khu kiểm: Kệ đang chọn
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-lg font-semibold">Công cụ thao tác</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="blue" onClick={() => selectedRack && void handleStatus(selectedRack, "IN_PROGRESS")} disabled={!selectedRack}>
                  Đang kiểm
                </Button>
                <Button variant="softRed" onClick={() => selectedRack && void handleDeleteRack(selectedRack)} disabled={!selectedRack}>
                  Xóa kệ
                </Button>
                <Button variant="green" onClick={handleDuplicateRack} disabled={!selectedRack || loading}>
                  Nhân bản
                </Button>
                <Button variant="secondary" onClick={() => selectedRack && void handleStatus(selectedRack, "FINISHED")} disabled={!selectedRack}>
                  Đã kiểm
                </Button>
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sơ đồ thu nhỏ</h3>
                <span className="text-xs text-neutral-400">Mini map</span>
              </div>
              <div className="relative h-44 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 p-4">
                <div className="absolute bottom-3 left-1/2 h-5 w-20 -translate-x-1/2 rounded-lg bg-blue-900 text-center text-[10px] font-semibold leading-5 text-white">
                  CỬA KHO
                </div>
                <div className="grid h-32 grid-cols-4 gap-3">
                  {aisleSummary.length ? (
                    aisleSummary.map((row) => (
                      <button
                        key={row.aisle}
                        type="button"
                        className={`rounded-xl border text-xs font-semibold ${
                          row.status === "FINISHED"
                            ? "border-green-300 bg-green-100 text-green-700"
                            : row.status === "IN_PROGRESS"
                              ? "border-amber-300 bg-amber-100 text-amber-700"
                              : row.status === "MISMATCH"
                                ? "border-red-300 bg-red-100 text-red-700"
                                : "border-neutral-300 bg-white text-neutral-600"
                        }`}
                      >
                        Dãy {row.aisle}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-4 flex items-center justify-center text-sm text-neutral-400">
                      Chưa có kệ
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-lg font-semibold">Chú thích</h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-400" /> Đã kiểm</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> Đang kiểm</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-neutral-300" /> Chưa kiểm</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-400" /> Có lệch</div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}