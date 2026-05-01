"use client";

import { API_BASE } from "@/lib/api-base";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Stage,
    Layer,
    Rect,
    Text,
    Group,
    Line,
    Transformer,
} from "react-konva";
import type Konva from "konva";
import {
    createRack,
    deleteRack,
    updateRack,
    createWarehouseDoor,
    updateWarehouseDoor,
    deleteWarehouseDoor,
    createWarehouseZone,
    updateWarehouseZone,
    deleteWarehouseZone,
    type FullWarehouseMap,
    type WarehouseDoor,
    type WarehouseFloor,
    type WarehouseRack,
    type WarehouseZone,
} from "@/lib/warehouse-map-api";

type ObjectKind = "rack" | "zone" | "door";
type ToolMode = "select" | "box" | "pan";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type CanvasObject = {
    kind: ObjectKind;
    id: string;
};

type EditorDoc = {
    racks: WarehouseRack[];
    zones: WarehouseZone[];
    doors: WarehouseDoor[];
};

type SelectionBox = {
    x: number;
    y: number;
    w: number;
    h: number;
} | null;

type DragBase = Record<string, { x: number; y: number }>;

type Props = {
    map: FullWarehouseMap;
    branchId: string;
    currentFloor: WarehouseFloor | null;
    selectedRackId?: string;
    scanRackCode?: string | null;
    onSelectRack: (rack: WarehouseRack | null) => void;
    onSelectRackDetail?: (rack: WarehouseRack | null) => void;
    onChange?: () => Promise<void> | void;
    onEditingChange?: (editing: boolean) => void;
    onSelectionChange?: (racks: WarehouseRack[]) => void;
    operationMode?: "layout" | "scan" | "picking" | "heatmap" | "rebalance";
    highlightRackIds?: string[];
    pickingPath?: Array<{ x: number; y: number; rackId?: string; label?: string }>;
    heatmapByRackId?: Record<string, { color?: string; heat?: string; qty?: number; skuCount?: number }>;
    rebalanceRackIds?: string[];
};

const GRID = 20;
const STAGE_W = 1500;
const STAGE_H = 920;
const RACK_W = 132;
const RACK_H = 30;
const MIN_SIZE = 20;
const SAVE_DEBOUNCE_MS = 700;

function snap(value: number) {
    return Math.round(value / GRID) * GRID;
}

function safeNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function objectKey(obj: CanvasObject) {
    return `${obj.kind}:${obj.id}`;
}

function cloneDoc(doc: EditorDoc): EditorDoc {
    return {
        racks: doc.racks.map((item) => ({ ...item })),
        zones: doc.zones.map((item) => ({ ...item })),
        doors: doc.doors.map((item) => ({ ...item })),
    };
}

function zoneColor(type?: string) {
    if (type === "OFFICE") return "#dbeafe";
    if (type === "PACKING") return "#fef3c7";
    if (type === "RETURN") return "#fee2e2";
    if (type === "WALKWAY") return "#f3f4f6";
    return "#dcfce7";
}

function rackColor(status?: string, highlighted?: boolean) {
    if (highlighted) return "#2563eb";
    if (status === "FINISHED") return "#16a34a";
    if (status === "IN_PROGRESS") return "#f59e0b";
    if (status === "MISMATCH") return "#dc2626";
    return "#111827";
}


function rackOperationColor(rack: any, highlighted?: boolean) {
    if (highlighted) return "#2563eb";

    const status = String(rack.status || "PENDING").toUpperCase();
    if (status === "IN_PROGRESS") return "#f59e0b";
    if (status === "FINISHED") return "#16a34a";
    if (status === "MISMATCH") return "#dc2626";

    const qty = Number(rack.totalQty ?? rack.qty ?? 0);
    const skuCount = Number(rack.skuCount ?? rack.totalSku ?? rack.totalSkus ?? 0);
    if (skuCount <= 0 && qty <= 0) return "#334155";
    if (qty <= 3) return "#f59e0b";
    if (qty >= 30) return "#16a34a";
    return "#0f172a";
}

function buildDoc(map: FullWarehouseMap, floorId?: string | null): EditorDoc {
    const racks = (map.racks || []).filter((rack: any) => {
        if (!floorId) return true;
        return !rack.floorId || rack.floorId === floorId;
    });

    const currentFloor = (map.floors || []).find((floor) => floor.id === floorId);
    const zones = currentFloor?.zones?.length ? currentFloor.zones : map.zones || [];
    const doors = currentFloor?.doors?.length ? currentFloor.doors : map.doors || [];

    return {
        racks: racks.map((rack: any) => ({
            ...rack,
            x: safeNumber(rack.x),
            y: safeNumber(rack.y),
            w: safeNumber(rack.w, RACK_W),
            h: safeNumber(rack.h, RACK_H),
        })),
        zones: zones.map((zone: any) => ({ ...zone })),
        doors: doors.map((door: any) => ({ ...door })),
    };
}

function intersects(
    box: SelectionBox,
    object: { x: number; y: number; w: number; h: number }
) {
    if (!box) return false;

    const boxX = Math.min(box.x, box.x + box.w);
    const boxY = Math.min(box.y, box.y + box.h);
    const boxW = Math.abs(box.w);
    const boxH = Math.abs(box.h);

    return (
        boxX < object.x + object.w &&
        boxX + boxW > object.x &&
        boxY < object.y + object.h &&
        boxY + boxH > object.y
    );
}

function normalizeImportText(text: string) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) return [];

    const rows = lines.map((line) => {
        const delimiter = line.includes("\t") ? "\t" : ",";
        return line.split(delimiter).map((cell) => cell.trim());
    });

    const header = rows[0].map((cell) => cell.toLowerCase());
    const hasHeader = header.some((cell) => ["aisle", "dãy", "day", "rack", "kệ", "ke"].includes(cell));
    const body = hasHeader ? rows.slice(1) : rows;

    return body.map((cells, index) => {
        if (hasHeader) {
            const get = (...keys: string[]) => {
                const idx = header.findIndex((cell) => keys.includes(cell));
                return idx >= 0 ? cells[idx] : undefined;
            };

            return {
                aisle: get("aisle", "dãy", "day") || "A",
                rackNo: get("rack", "rackno", "kệ", "ke") || `K${String(index + 1).padStart(2, "0")}`,
                floors: Number(get("floors", "tầng", "tang") || 5),
            };
        }

        return {
            aisle: cells[0] || "A",
            rackNo: cells[1] || `K${String(index + 1).padStart(2, "0")}`,
            floors: Number(cells[2] || 5),
        };
    });
}

export default function WarehouseMap2DEditor({
    map,
    branchId,
    currentFloor,
    selectedRackId,
    scanRackCode,
    onSelectRack,
    onSelectRackDetail,
    onChange,
    onEditingChange,
    onSelectionChange,
    operationMode = "layout",
    highlightRackIds = [],
    pickingPath = [],
    heatmapByRackId = {},
    rebalanceRackIds = [],
}: Props) {
    const stageRef = useRef<Konva.Stage | null>(null);
    const transformerRef = useRef<Konva.Transformer | null>(null);
    const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
    const docRef = useRef<EditorDoc>({ racks: [], zones: [], doors: [] });
    const historyRef = useRef<EditorDoc[]>([]);
    const redoRef = useRef<EditorDoc[]>([]);
    const saveTimerRef = useRef<number | null>(null);
    const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
    const loadedKeyRef = useRef("");
    const dragBaseRef = useRef<DragBase>({});
    const boxStartRef = useRef<{ x: number; y: number } | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const [rackInventory, setRackInventory] = useState<any[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [doc, setDoc] = useState<EditorDoc>(() => buildDoc(map, currentFloor?.id));
    const [selected, setSelected] = useState<CanvasObject[]>([]);
    const [tool, setTool] = useState<ToolMode>("select");
    const [scale, setScale] = useState(0.78);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
    const [guides, setGuides] = useState<number[][]>([]);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveProgress, setSaveProgress] = useState(0);
    // PRO V2: boot overlay removed to avoid blocking the editor.
    const [isBooting, setIsBooting] = useState(false);

    const selectedKeys = useMemo(
        () => new Set(selected.map((item) => objectKey(item))),
        [selected]
    );

    const highlightedRackSet = useMemo(() => new Set(highlightRackIds), [highlightRackIds]);
    const rebalanceRackSet = useMemo(() => new Set(rebalanceRackIds), [rebalanceRackIds]);

    const selectedRack = useMemo(() => {
        if (selected.length !== 1 || selected[0].kind !== "rack") return null;
        return doc.racks.find((rack) => rack.id === selected[0].id) || null;
    }, [doc.racks, selected]);

    const aisles = useMemo(() => {
        return Array.from(new Set(doc.racks.map((rack) => rack.aisle || "A"))).sort();
    }, [doc.racks]);

    const selectedRackCodes = useMemo(() => {
        return selected
            .filter((item) => item.kind === "rack")
            .map((item) => doc.racks.find((rack) => rack.id === item.id))
            .filter(Boolean)
            .map((rack) => `${rack!.aisle || "A"}-${rack!.rackNo || "K"}`);
    }, [doc.racks, selected]);

    const selectedRacks = useMemo(() => {
        const selectedIds = new Set(
            selected.filter((item) => item.kind === "rack").map((item) => item.id)
        );

        return doc.racks.filter((rack) => selectedIds.has(rack.id));
    }, [doc.racks, selected]);

    useEffect(() => {
        onSelectionChange?.(selectedRacks);
    }, [onSelectionChange, selectedRacks]);

    const commit = useCallback(
        (next: EditorDoc, options?: { history?: boolean; dirty?: boolean }) => {
            if (options?.history !== false) {
                historyRef.current.push(cloneDoc(docRef.current));
                if (historyRef.current.length > 80) historyRef.current.shift();
                redoRef.current = [];
            }

            const cloned = cloneDoc(next);
            docRef.current = cloned;
            setDoc(cloneDoc(cloned));

            if (options?.dirty !== false) {
                setSaveState("dirty");
                onEditingChange?.(true);
            }
        },
        [onEditingChange]
    );

    useEffect(() => {
        const key = `${map.id}:${currentFloor?.id || "all"}:${map.racks?.length || 0}:${map.zones?.length || 0}:${map.doors?.length || 0}`;
        if (loadedKeyRef.current === key) return;

        loadedKeyRef.current = key;
        const next = buildDoc(map, currentFloor?.id);

        docRef.current = cloneDoc(next);
        setDoc(cloneDoc(next));
        setSelected([]);
        onSelectRack(null);
        onSelectRackDetail?.(null);
        setSaveState("idle");
        // PRO V2: never show blocking boot overlay. The canvas is already usable.
        setIsBooting(false);
        return undefined;
    }, [map, currentFloor?.id, onSelectRack, onSelectRackDetail]);

    useEffect(() => {
        if (!transformerRef.current) return;

        if (selected.length !== 1) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer()?.batchDraw();
            return;
        }

        const node = nodeRefs.current[objectKey(selected[0])];
        if (node) {
            transformerRef.current.nodes([node]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [doc, selected]);

    useEffect(() => {
        if (!selectedRackId) return;
        const found = doc.racks.some((rack) => rack.id === selectedRackId);
        if (found) setSelected([{ kind: "rack", id: selectedRackId }]);
    }, [doc.racks, selectedRackId]);

    const persistOne = useCallback(async (obj: CanvasObject, snapshot: EditorDoc) => {
        if (obj.kind === "rack") {
            const rack = snapshot.racks.find((item) => item.id === obj.id);
            if (!rack) return;

            await updateRack(rack.id, {
                x: snap(safeNumber(rack.x)),
                y: snap(safeNumber(rack.y)),
                w: Math.max(MIN_SIZE, snap(safeNumber((rack as any).w, RACK_W))),
                h: Math.max(MIN_SIZE, snap(safeNumber((rack as any).h, RACK_H))),
                status: rack.status,
            } as any);
        }

        if (obj.kind === "zone") {
            const zone = snapshot.zones.find((item) => item.id === obj.id);
            if (!zone) return;

            await updateWarehouseZone(zone.id, {
                x: snap(safeNumber(zone.x)),
                y: snap(safeNumber(zone.y)),
                width: Math.max(MIN_SIZE, snap(safeNumber(zone.width, 260))),
                height: Math.max(MIN_SIZE, snap(safeNumber(zone.height, 180))),
            });
        }

        if (obj.kind === "door") {
            const door = snapshot.doors.find((item) => item.id === obj.id);
            if (!door) return;

            await updateWarehouseDoor(door.id, {
                x: snap(safeNumber(door.x)),
                y: snap(safeNumber(door.y)),
                width: Math.max(60, snap(safeNumber(door.width, 180))),
            });
        }
    }, []);

    const persist = useCallback(
        async (items?: CanvasObject[]) => {
            const snapshot = cloneDoc(docRef.current);
            const targets = items?.length
                ? items
                : [
                    ...snapshot.racks.map((rack) => ({ kind: "rack" as const, id: rack.id })),
                    ...snapshot.zones.map((zone) => ({ kind: "zone" as const, id: zone.id })),
                    ...snapshot.doors.map((door) => ({ kind: "door" as const, id: door.id })),
                ];

            if (!targets.length) return;

            setSaveState("saving");
            setSaveProgress(5);
            onEditingChange?.(true);

            saveQueueRef.current = saveQueueRef.current
                .then(async () => {
                    let done = 0;

                    for (const target of targets) {
                        await persistOne(target, snapshot);
                        done += 1;
                        setSaveProgress(Math.round((done / targets.length) * 100));
                    }

                    setSaveState("saved");
                    setSaveProgress(100);
                    onEditingChange?.(false);

                    window.setTimeout(() => {
                        setSaveState((state) => (state === "saved" ? "idle" : state));
                    }, 900);
                })
                .catch((err) => {
                    console.error(err);
                    setSaveState("error");
                    onEditingChange?.(false);
                });

            return saveQueueRef.current;
        },
        [onEditingChange, persistOne]
    );

    const scheduleSave = useCallback(
        (items?: CanvasObject[]) => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

            setSaveState("dirty");
            onEditingChange?.(true);

            saveTimerRef.current = window.setTimeout(() => {
                void persist(items);
            }, SAVE_DEBOUNCE_MS);
        },
        [onEditingChange, persist]
    );

    const selectObject = useCallback(
        (obj: CanvasObject, additive?: boolean) => {
            setSelected((prev) => {
                if (!additive) return [obj];

                const exists = prev.some((item) => objectKey(item) === objectKey(obj));
                if (exists) return prev.filter((item) => objectKey(item) !== objectKey(obj));
                return [...prev, obj];
            });

            if (obj.kind === "rack") {
                const rack = docRef.current.racks.find((item) => item.id === obj.id) || null;
                onSelectRack(rack);
                onSelectRackDetail?.(rack);
            } else {
                onSelectRack(null);
                onSelectRackDetail?.(null);
            }
        },
        [onSelectRack, onSelectRackDetail]
    );

    const clearSelection = useCallback(() => {
        setSelected([]);
        onSelectRack(null);
        onSelectRackDetail?.(null);
    }, [onSelectRack, onSelectRackDetail]);

    const addRack = useCallback(async () => {
        const count = docRef.current.racks.length + 1;
        const aisle = "A";
        const rackNo = `K${String(count).padStart(2, "0")}`;

        setSaveState("saving");

        try {
            const created = await createRack({
                mapId: map.id,
                branchId,
                floorId: currentFloor?.id,
                name: `Dãy ${aisle} - ${rackNo}`,
                zone: "A",
                aisle,
                rackNo,
                floors: 5,
                x: 80 + ((count - 1) % 8) * 160,
                y: 80 + Math.floor((count - 1) / 8) * 52,
                w: RACK_W,
                h: RACK_H,
            } as any);

            const next = cloneDoc(docRef.current);
            next.racks.push(created);
            commit(next, { history: true, dirty: false });
            setSelected([{ kind: "rack", id: created.id }]);
            onSelectRack(created);
            onSelectRackDetail?.(created);
            setSaveState("saved");
        } catch (err) {
            console.error(err);
            setSaveState("error");
        }
    }, [branchId, commit, currentFloor?.id, map.id, onSelectRack, onSelectRackDetail]);

    const addZone = useCallback(
        async (type: string, name: string) => {
            if (!currentFloor?.id) return;

            setSaveState("saving");

            try {
                const created = await createWarehouseZone(map.id, {
                    floorId: currentFloor.id,
                    name,
                    type,
                    x: type === "OFFICE" ? 60 : 960,
                    y: type === "OFFICE" ? 80 : 120,
                    width: type === "OFFICE" ? 300 : 260,
                    height: type === "OFFICE" ? 220 : 160,
                    color: zoneColor(type),
                });

                const next = cloneDoc(docRef.current);
                next.zones.push(created);
                commit(next, { history: true, dirty: false });
                setSelected([{ kind: "zone", id: created.id }]);
                onSelectRack(null);
                onSelectRackDetail?.(null);
                setSaveState("saved");
            } catch (err) {
                console.error(err);
                setSaveState("error");
            }
        },
        [commit, currentFloor?.id, map.id, onSelectRack, onSelectRackDetail]
    );

    const addDoor = useCallback(async () => {
        if (!currentFloor?.id) return;

        setSaveState("saving");

        try {
            const created = await createWarehouseDoor(map.id, {
                floorId: currentFloor.id,
                name: "Cửa kho",
                side: "BOTTOM",
                x: 620,
                y: 820,
                width: 180,
            });

            const next = cloneDoc(docRef.current);
            next.doors.push(created);
            commit(next, { history: true, dirty: false });
            setSelected([{ kind: "door", id: created.id }]);
            onSelectRack(null);
            onSelectRackDetail?.(null);
            setSaveState("saved");
        } catch (err) {
            console.error(err);
            setSaveState("error");
        }
    }, [commit, currentFloor?.id, map.id, onSelectRack, onSelectRackDetail]);

    const duplicateSelected = useCallback(async () => {
        if (!selected.length) return;

        setSaveState("saving");

        try {
            const createdRefs: CanvasObject[] = [];

            for (const obj of selected) {
                if (obj.kind !== "rack") continue;

                const rack = docRef.current.racks.find((item) => item.id === obj.id);
                if (!rack) continue;

                const rackNo = `K${String(docRef.current.racks.length + createdRefs.length + 1).padStart(2, "0")}`;
                const created = await createRack({
                    mapId: map.id,
                    branchId,
                    floorId: currentFloor?.id,
                    name: `Dãy ${rack.aisle || "A"} - ${rackNo}`,
                    zone: rack.zone || "A",
                    aisle: rack.aisle || "A",
                    rackNo,
                    floors: rack.floors || 5,
                    x: snap(safeNumber(rack.x) + 40),
                    y: snap(safeNumber(rack.y) + 40),
                    w: safeNumber((rack as any).w, RACK_W),
                    h: safeNumber((rack as any).h, RACK_H),
                } as any);

                docRef.current.racks.push(created);
                createdRefs.push({ kind: "rack", id: created.id });
            }

            commit(docRef.current, { history: true, dirty: false });
            setSelected(createdRefs);
            setSaveState("saved");
        } catch (err) {
            console.error(err);
            setSaveState("error");
        }
    }, [branchId, commit, currentFloor?.id, map.id, selected]);

    const deleteSelected = useCallback(async () => {
        if (!selected.length) return;
        if (!window.confirm(`Xóa ${selected.length} đối tượng?`)) return;

        setSaveState("saving");

        try {
            for (const obj of selected) {
                if (obj.kind === "rack") await deleteRack(obj.id);
                if (obj.kind === "zone") await deleteWarehouseZone(obj.id);
                if (obj.kind === "door") await deleteWarehouseDoor(obj.id);
            }

            const selectedSet = new Set(selected.map((item) => objectKey(item)));
            const next = cloneDoc(docRef.current);

            next.racks = next.racks.filter(
                (rack) => !selectedSet.has(objectKey({ kind: "rack", id: rack.id }))
            );
            next.zones = next.zones.filter(
                (zone) => !selectedSet.has(objectKey({ kind: "zone", id: zone.id }))
            );
            next.doors = next.doors.filter(
                (door) => !selectedSet.has(objectKey({ kind: "door", id: door.id }))
            );

            commit(next, { history: true, dirty: false });
            clearSelection();
            setSaveState("saved");
        } catch (err) {
            console.error(err);
            setSaveState("error");
        }
    }, [clearSelection, commit, selected]);

    const undo = useCallback(() => {
        const previous = historyRef.current.pop();
        if (!previous) return;

        redoRef.current.push(cloneDoc(docRef.current));
        docRef.current = cloneDoc(previous);
        setDoc(cloneDoc(previous));
        setSaveState("dirty");
        scheduleSave();
    }, [scheduleSave]);

    const redo = useCallback(() => {
        const next = redoRef.current.pop();
        if (!next) return;

        historyRef.current.push(cloneDoc(docRef.current));
        docRef.current = cloneDoc(next);
        setDoc(cloneDoc(next));
        setSaveState("dirty");
        scheduleSave();
    }, [scheduleSave]);

    const alignDistribute = useCallback(() => {
        const rackIds = selected.filter((item) => item.kind === "rack").map((item) => item.id);
        if (rackIds.length < 2) return;

        const selectedRacks = docRef.current.racks
            .filter((rack) => rackIds.includes(rack.id))
            .sort((a, b) => safeNumber(a.x) - safeNumber(b.x));

        const minX = Math.min(...selectedRacks.map((rack) => safeNumber(rack.x)));
        const maxX = Math.max(...selectedRacks.map((rack) => safeNumber(rack.x)));
        const targetY = snap(Math.min(...selectedRacks.map((rack) => safeNumber(rack.y))));
        const gap = selectedRacks.length <= 1 ? 0 : (maxX - minX) / (selectedRacks.length - 1);

        const next = cloneDoc(docRef.current);
        next.racks = next.racks.map((rack) => {
            const index = selectedRacks.findIndex((item) => item.id === rack.id);
            if (index < 0) return rack;
            return {
                ...rack,
                x: snap(minX + index * gap),
                y: targetY,
            };
        });

        commit(next, { history: true });
        scheduleSave(selected);
    }, [commit, scheduleSave, selected]);

    const moveAisle = useCallback(
        (aisle: string, dx: number, dy: number) => {
            const refs = docRef.current.racks
                .filter((rack) => (rack.aisle || "A") === aisle)
                .map((rack) => ({ kind: "rack" as const, id: rack.id }));

            if (!refs.length) return;

            const next = cloneDoc(docRef.current);
            next.racks = next.racks.map((rack) => {
                if ((rack.aisle || "A") !== aisle) return rack;
                return {
                    ...rack,
                    x: snap(safeNumber(rack.x) + dx),
                    y: snap(safeNumber(rack.y) + dy),
                };
            });

            commit(next, { history: true });
            setSelected(refs);
            scheduleSave(refs);
        },
        [commit, scheduleSave]
    );

    const updateSelectedStatus = useCallback(
        (status: string) => {
            const refs = selected.filter((item) => item.kind === "rack");
            if (!refs.length) return;

            const selectedIds = new Set(refs.map((item) => item.id));
            const next = cloneDoc(docRef.current);
            next.racks = next.racks.map((rack) =>
                selectedIds.has(rack.id) ? { ...rack, status } : rack
            );

            commit(next, { history: true });
            scheduleSave(refs);
        },
        [commit, scheduleSave, selected]
    );

    const finishTransform = useCallback(
        (obj: CanvasObject, node: Konva.Node) => {
            setGuides([]);

            const x = snap(node.x());
            const y = snap(node.y());
            const width = Math.max(MIN_SIZE, snap((node.width() || MIN_SIZE) * node.scaleX()));
            const height = Math.max(MIN_SIZE, snap((node.height() || MIN_SIZE) * node.scaleY()));

            node.scaleX(1);
            node.scaleY(1);
            node.x(x);
            node.y(y);

            const next = cloneDoc(docRef.current);

            if (obj.kind === "rack") {
                next.racks = next.racks.map((rack) =>
                    rack.id === obj.id ? { ...rack, x, y, w: width, h: height } : rack
                );
            }

            if (obj.kind === "zone") {
                next.zones = next.zones.map((zone) =>
                    zone.id === obj.id ? { ...zone, x, y, width, height } : zone
                );
            }

            if (obj.kind === "door") {
                next.doors = next.doors.map((door) =>
                    door.id === obj.id ? { ...door, x, y, width } : door
                );
            }

            commit(next, { history: true });
            scheduleSave([obj]);
        },
        [commit, scheduleSave]
    );
    const loadRackInventory = async (rackId: string) => {
        try {
            setLoadingInventory(true);

            const res = await fetch(
                `${API_BASE}/inventory/by-rack/${rackId}`
            );

            const data = await res.json();
            setRackInventory(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingInventory(false);
        }
    };

    const handleDragMove = useCallback((node: Konva.Node) => {
        node.x(snap(node.x()));
        node.y(snap(node.y()));

        const x = node.x();
        const y = node.y();
        const w = node.width() * node.scaleX();
        const h = node.height() * node.scaleY();

        setGuides([
            [x, 0, x, STAGE_H],
            [x + w, 0, x + w, STAGE_H],
            [0, y, STAGE_W, y],
            [0, y + h, STAGE_W, y + h],
        ]);
    }, []);

    const startGroupDrag = useCallback(() => {
        const base: DragBase = {};

        selected.forEach((item) => {
            const node = nodeRefs.current[objectKey(item)];
            if (node) base[objectKey(item)] = { x: node.x(), y: node.y() };
        });

        dragBaseRef.current = base;
    }, [selected]);

    const groupDragMove = useCallback(
        (obj: CanvasObject, node: Konva.Node) => {
            if (selected.length <= 1 || !selectedKeys.has(objectKey(obj))) {
                handleDragMove(node);
                return;
            }

            const start = dragBaseRef.current[objectKey(obj)];
            if (!start) return;

            const deltaX = snap(node.x()) - start.x;
            const deltaY = snap(node.y()) - start.y;

            selected.forEach((item) => {
                const otherNode = nodeRefs.current[objectKey(item)];
                const base = dragBaseRef.current[objectKey(item)];
                if (!otherNode || !base) return;

                otherNode.x(snap(base.x + deltaX));
                otherNode.y(snap(base.y + deltaY));
            });
        },
        [handleDragMove, selected, selectedKeys]
    );

    const groupDragEnd = useCallback(
        (obj: CanvasObject, node: Konva.Node) => {
            if (selected.length <= 1 || !selectedKeys.has(objectKey(obj))) {
                finishTransform(obj, node);
                return;
            }

            const refs = selected;
            const next = cloneDoc(docRef.current);

            refs.forEach((item) => {
                const targetNode = nodeRefs.current[objectKey(item)];
                if (!targetNode) return;

                const patch = {
                    x: snap(targetNode.x()),
                    y: snap(targetNode.y()),
                };

                if (item.kind === "rack") {
                    next.racks = next.racks.map((rack) =>
                        rack.id === item.id ? { ...rack, ...patch } : rack
                    );
                }

                if (item.kind === "zone") {
                    next.zones = next.zones.map((zone) =>
                        zone.id === item.id ? { ...zone, ...patch } : zone
                    );
                }

                if (item.kind === "door") {
                    next.doors = next.doors.map((door) =>
                        door.id === item.id ? { ...door, ...patch } : door
                    );
                }
            });

            setGuides([]);
            commit(next, { history: true });
            scheduleSave(refs);
        },
        [commit, finishTransform, scheduleSave, selected, selectedKeys]
    );

    const gridLines = useMemo(() => {
        const items: React.ReactNode[] = [];

        for (let x = 0; x <= STAGE_W; x += GRID) {
            items.push(
                <Line
                    key={`v-${x}`}
                    points={[x, 0, x, STAGE_H]}
                    stroke={x % 100 === 0 ? "#dbeafe" : "#eef2f7"}
                    strokeWidth={x % 100 === 0 ? 1.4 : 1}
                    listening={false}
                />
            );
        }

        for (let y = 0; y <= STAGE_H; y += GRID) {
            items.push(
                <Line
                    key={`h-${y}`}
                    points={[0, y, STAGE_W, y]}
                    stroke={y % 100 === 0 ? "#dbeafe" : "#eef2f7"}
                    strokeWidth={y % 100 === 0 ? 1.4 : 1}
                    listening={false}
                />
            );
        }

        return items;
    }, []);

    const startSelectionBox = useCallback(
        (e: Konva.KonvaEventObject<MouseEvent>) => {
            if (tool !== "box") return;
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (!pointer) return;

            const x = (pointer.x - stagePos.x) / scale;
            const y = (pointer.y - stagePos.y) / scale;

            boxStartRef.current = { x, y };
            setSelectionBox({ x, y, w: 0, h: 0 });
        },
        [scale, stagePos.x, stagePos.y, tool]
    );

    const moveSelectionBox = useCallback(
        (e: Konva.KonvaEventObject<MouseEvent>) => {
            if (tool !== "box" || !boxStartRef.current) return;
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (!pointer) return;

            const x = (pointer.x - stagePos.x) / scale;
            const y = (pointer.y - stagePos.y) / scale;

            setSelectionBox({
                x: boxStartRef.current.x,
                y: boxStartRef.current.y,
                w: x - boxStartRef.current.x,
                h: y - boxStartRef.current.y,
            });
        },
        [scale, stagePos.x, stagePos.y, tool]
    );

    const endSelectionBox = useCallback(() => {
        if (!selectionBox) return;

        const refs: CanvasObject[] = [];

        doc.racks.forEach((rack) => {
            if (
                intersects(selectionBox, {
                    x: safeNumber(rack.x),
                    y: safeNumber(rack.y),
                    w: safeNumber((rack as any).w, RACK_W),
                    h: safeNumber((rack as any).h, RACK_H),
                })
            ) {
                refs.push({ kind: "rack", id: rack.id });
            }
        });

        doc.zones.forEach((zone) => {
            if (
                intersects(selectionBox, {
                    x: safeNumber(zone.x),
                    y: safeNumber(zone.y),
                    w: safeNumber(zone.width, 260),
                    h: safeNumber(zone.height, 180),
                })
            ) {
                refs.push({ kind: "zone", id: zone.id });
            }
        });

        doc.doors.forEach((door) => {
            if (
                intersects(selectionBox, {
                    x: safeNumber(door.x),
                    y: safeNumber(door.y),
                    w: safeNumber(door.width, 180),
                    h: 34,
                })
            ) {
                refs.push({ kind: "door", id: door.id });
            }
        });

        setSelected(refs);
        if (refs.length === 1 && refs[0].kind === "rack") {
            const rack = doc.racks.find((item) => item.id === refs[0].id) || null;
            onSelectRack(rack);
            onSelectRackDetail?.(rack);
        }
        // PRO V2: after drawing a selection box, return to select mode so the group can be dragged immediately.
        setTool("select");
        setSelectionBox(null);
        boxStartRef.current = null;
    }, [doc.doors, doc.racks, doc.zones, selectionBox]);

    const handleImportFile = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const text = await file.text();
            const rows = normalizeImportText(text);
            if (!rows.length) return;

            setSaveState("saving");

            try {
                const next = cloneDoc(docRef.current);
                const createdRefs: CanvasObject[] = [];

                for (let index = 0; index < rows.length; index++) {
                    const row = rows[index];
                    const created = await createRack({
                        mapId: map.id,
                        branchId,
                        floorId: currentFloor?.id,
                        name: `Dãy ${row.aisle} - ${row.rackNo}`,
                        zone: "A",
                        aisle: String(row.aisle || "A").toUpperCase(),
                        rackNo: String(row.rackNo || `K${index + 1}`).toUpperCase(),
                        floors: Number(row.floors || 5),
                        x: 80 + (index % 8) * 160,
                        y: 80 + Math.floor(index / 8) * 52,
                        w: RACK_W,
                        h: RACK_H,
                    } as any);

                    next.racks.push(created);
                    createdRefs.push({ kind: "rack", id: created.id });
                }

                commit(next, { history: true, dirty: false });
                setSelected(createdRefs);
                setSaveState("saved");
            } catch (err) {
                console.error(err);
                setSaveState("error");
            } finally {
                event.target.value = "";
            }
        },
        [branchId, commit, currentFloor?.id, map.id]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const mod = event.metaKey || event.ctrlKey;

            if (mod && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void persist();
            }

            if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
                event.preventDefault();
                undo();
            }

            if ((mod && event.key.toLowerCase() === "z" && event.shiftKey) || (mod && event.key.toLowerCase() === "y")) {
                event.preventDefault();
                redo();
            }

            if ((event.key === "Backspace" || event.key === "Delete") && selected.length) {
                event.preventDefault();
                void deleteSelected();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [deleteSelected, persist, redo, selected.length, undo]);

    return (
        <div className="rounded-b-3xl bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold ${tool === "select" ? "bg-blue-600 text-white" : "border bg-white text-neutral-700"
                            }`}
                        onClick={() => setTool("select")}
                    >
                        Chọn
                    </button>

                    <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold ${tool === "box" ? "bg-blue-600 text-white" : "border bg-white text-neutral-700"
                            }`}
                        onClick={() => setTool("box")}
                    >
                        Box select
                    </button>

                    <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold ${tool === "pan" ? "bg-blue-600 text-white" : "border bg-white text-neutral-700"
                            }`}
                        onClick={() => setTool("pan")}
                    >
                        Di chuyển canvas
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={addRack}>
                        + Kệ
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => addZone("OFFICE", "Văn phòng")}>
                        + Văn phòng
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => addZone("PACKING", "Khu đóng hàng")}>
                        + Đóng hàng
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => addZone("RETURN", "Khu hàng lỗi")}>
                        + Hàng lỗi
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => addZone("WALKWAY", "Lối đi")}>
                        + Lối đi
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={addDoor}>
                        + Cửa
                    </button>

                    <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => importInputRef.current?.click()}>
                        Import CSV/Excel
                    </button>

                    <input ref={importInputRef} type="file" accept=".csv,.txt,.tsv" hidden onChange={handleImportFile} />

                    <button
                        type="button"
                        className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        onClick={duplicateSelected}
                        disabled={!selected.length}
                    >
                        Nhân bản
                    </button>

                    <button
                        type="button"
                        className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        onClick={alignDistribute}
                        disabled={selected.length < 2}
                    >
                        Giãn đều
                    </button>

                    <button
                        type="button"
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                        onClick={deleteSelected}
                        disabled={!selected.length}
                    >
                        Xóa chọn
                    </button>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <button type="button" className="rounded-xl border bg-white px-3 py-2" onClick={undo}>
                        Undo
                    </button>
                    <button type="button" className="rounded-xl border bg-white px-3 py-2" onClick={redo}>
                        Redo
                    </button>
                    <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white" onClick={() => void persist()}>
                        Lưu ngay
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500">
                <div className="flex flex-wrap gap-3">
                    <span>Grid {GRID}px</span>
                    <span>{doc.racks.length} kệ</span>
                    <span>{doc.zones.length} khu</span>
                    <span>{doc.doors.length} cửa</span>
                    <span>{selected.length ? `Đang chọn ${selected.length}` : "Chưa chọn"}</span>
                    {selectedRackCodes.length ? <span>Rack: {selectedRackCodes.join(", ")}</span> : null}
                    {aisles.map((aisle) => (
                        <button key={aisle} type="button" className="rounded border px-2 py-1" onClick={() => moveAisle(aisle, 40, 0)}>
                            Dịch dãy {aisle} →
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {saveState === "saving" ? (
                        <>
                            <span className="font-semibold text-blue-600">Đang lưu...</span>
                            <span className="h-1.5 w-20 overflow-hidden rounded bg-neutral-200">
                                <span className="block h-full rounded bg-blue-600" style={{ width: `${saveProgress}%` }} />
                            </span>
                        </>
                    ) : null}
                    {saveState === "dirty" ? <span className="font-semibold text-amber-600">Chưa lưu</span> : null}
                    {saveState === "saved" ? <span className="font-semibold text-green-600">Đã lưu</span> : null}
                    {saveState === "error" ? <span className="font-semibold text-red-600">Lưu lỗi</span> : null}

                    <button type="button" className="rounded border px-3 py-1" onClick={() => setScale((s) => Math.max(0.42, Number((s - 0.06).toFixed(2))))}>
                        -
                    </button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button type="button" className="rounded border px-3 py-1" onClick={() => setScale((s) => Math.min(1.5, Number((s + 0.06).toFixed(2))))}>
                        +
                    </button>
                </div>
            </div>

            <div className="relative overflow-auto bg-neutral-100 p-5">
                {false ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold shadow">Đang tải sơ đồ...</div>
                    </div>
                ) : null}

                <div className="mx-auto w-fit rounded-3xl border bg-white p-4 shadow-sm">
                    <Stage
                        ref={stageRef}
                        width={STAGE_W * scale}
                        height={STAGE_H * scale}
                        scaleX={scale}
                        scaleY={scale}
                        x={stagePos.x}
                        y={stagePos.y}
                        draggable={tool === "pan"}
                        onDragEnd={(event) => {
                            if (tool === "pan") setStagePos({ x: event.target.x(), y: event.target.y() });
                        }}
                        onMouseDown={(event) => {
                            if (event.target === event.target.getStage()) {
                                clearSelection();
                                startSelectionBox(event);
                            }
                        }}
                        onMouseMove={moveSelectionBox}
                        onMouseUp={endSelectionBox}
                    >
                        <Layer listening={false}>
                            <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f8fafc" stroke="#d1d5db" strokeWidth={2} cornerRadius={18} />
                            {gridLines}
                        </Layer>

                        <Layer>
                            {doc.zones.map((zone) => {
                                const obj = { kind: "zone" as const, id: zone.id };
                                const key = objectKey(obj);
                                const x = snap(safeNumber(zone.x));
                                const y = snap(safeNumber(zone.y));
                                const width = Math.max(MIN_SIZE, snap(safeNumber(zone.width, 260)));
                                const height = Math.max(MIN_SIZE, snap(safeNumber(zone.height, 180)));
                                const isSelected = selectedKeys.has(key);

                                return (
                                    <Group key={zone.id}>
                                        <Rect
                                            ref={(node) => {
                                                nodeRefs.current[key] = node;
                                            }}
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            fill={zone.color || zoneColor(zone.type)}
                                            opacity={0.72}
                                            stroke={isSelected ? "#2563eb" : "#94a3b8"}
                                            strokeWidth={isSelected ? 3 : 1}
                                            dash={zone.type === "WALKWAY" ? [8, 6] : undefined}
                                            cornerRadius={10}
                                            draggable={tool === "select"}
                                            onClick={(event) => {
                                                event.cancelBubble = true;
                                                selectObject(obj, event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
                                            }}
                                            onDragStart={startGroupDrag}
                                            onDragMove={(event) => groupDragMove(obj, event.target)}
                                            onDragEnd={(event) => groupDragEnd(obj, event.target)}
                                            onTransformEnd={(event) => finishTransform(obj, event.target)}
                                        />
                                        <Text x={x + 12} y={y + 12} text={zone.name} fontSize={15} fontStyle="bold" fill="#0f172a" listening={false} />
                                        <Text x={x + 12} y={y + 34} text={`${Math.round(width / GRID)}m × ${Math.round(height / GRID)}m`} fontSize={12} fill="#64748b" listening={false} />
                                    </Group>
                                );
                            })}

                            {pickingPath.length > 1 ? (
                                <Group listening={false}>
                                    <Line
                                        points={pickingPath.flatMap((point) => [point.x, point.y])}
                                        stroke="#7c3aed"
                                        strokeWidth={4}
                                        lineCap="round"
                                        lineJoin="round"
                                        opacity={0.86}
                                    />
                                    {pickingPath.map((point, index) => (
                                        <Group key={`${point.rackId || index}-${index}`}>
                                            <Rect x={point.x - 12} y={point.y - 12} width={24} height={24} cornerRadius={12} fill="#7c3aed" />
                                            <Text x={point.x - 5} y={point.y - 7} text={String(index + 1)} fontSize={12} fontStyle="bold" fill="#ffffff" />
                                        </Group>
                                    ))}
                                </Group>
                            ) : null}

                            {doc.racks.map((rack) => {
                                const obj = { kind: "rack" as const, id: rack.id };
                                const key = objectKey(obj);
                                const x = snap(safeNumber(rack.x));
                                const y = snap(safeNumber(rack.y));
                                const width = Math.max(MIN_SIZE, snap(safeNumber((rack as any).w, RACK_W)));
                                const height = Math.max(MIN_SIZE, snap(safeNumber((rack as any).h, RACK_H)));
                                const isSelected = selectedKeys.has(key) || selectedRackId === rack.id;
                                const heatmapItem = heatmapByRackId[rack.id];
                                const isHighlighted = Boolean(
                                    highlightedRackSet.has(rack.id) ||
                                    (scanRackCode &&
                                        (rack.code === scanRackCode || `${rack.aisle}-${rack.rackNo}` === scanRackCode))
                                );
                                const isPickingRack = operationMode === "picking" && highlightedRackSet.has(rack.id);
                                const isRebalanceRack = operationMode === "rebalance" && rebalanceRackSet.has(rack.id);
                                const rackFill = isHighlighted
                                    ? "#2563eb"
                                    : isPickingRack
                                        ? "#7c3aed"
                                        : isRebalanceRack
                                            ? "#dc2626"
                                            : operationMode === "heatmap" && heatmapItem?.color
                                                ? heatmapItem.color
                                                : rackOperationColor({ ...rack, totalQty: heatmapItem?.qty ?? (rack as any).totalQty, skuCount: heatmapItem?.skuCount ?? (rack as any).skuCount }, false);
                                const rackLine2 = heatmapItem
                                    ? `${heatmapItem.skuCount || 0} SKU · ${heatmapItem.qty || 0}`
                                    : `${(rack as any).skuCount ?? 0} SKU · ${(rack as any).totalQty ?? 0}`;

                                return (
                                    <Group key={rack.id}>
                                        <Rect
                                            ref={(node) => {
                                                nodeRefs.current[key] = node;
                                            }}
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            fill={rackFill}
                                            opacity={0.96}
                                            cornerRadius={6}
                                            stroke={isSelected ? "#2563eb" : "#020617"}
                                            strokeWidth={isSelected ? 3 : 1}
                                            shadowColor={isHighlighted ? "#2563eb" : undefined}
                                            shadowBlur={isHighlighted ? 18 : 0}
                                            draggable={tool === "select"}
                                            onClick={(event) => {
                                                event.cancelBubble = true;
                                                selectObject(obj, event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
                                                loadRackInventory(rack.id);
                                            }}
                                            onDblClick={() => onSelectRackDetail?.(rack)}
                                            onDragStart={startGroupDrag}
                                            onDragMove={(event) => groupDragMove(obj, event.target)}
                                            onDragEnd={(event) => groupDragEnd(obj, event.target)}
                                            onTransformEnd={(event) => finishTransform(obj, event.target)}
                                        />
                                        {scale > 0.45 ? (
                                            <Text
                                                x={x + 6}
                                                y={y + 5}
                                                text={`${rack.aisle || "A"}-${rack.rackNo || "K"}\n${rack.floors || 5} tầng · ${rack.status === "IN_PROGRESS" ? "Đang kiểm" : rack.status === "FINISHED" ? "Đã kiểm" : rack.status === "MISMATCH" ? "Có lệch" : "Chưa kiểm"}`}
                                                fontSize={10}
                                                fill="#ffffff"
                                                listening={false}
                                            />
                                        ) : null}
                                    </Group>
                                );
                            })}

                            {doc.doors.map((door) => {
                                const obj = { kind: "door" as const, id: door.id };
                                const key = objectKey(obj);
                                const x = snap(safeNumber(door.x));
                                const y = snap(safeNumber(door.y));
                                const width = Math.max(60, snap(safeNumber(door.width, 180)));
                                const isSelected = selectedKeys.has(key);

                                return (
                                    <Group key={door.id}>
                                        <Rect
                                            ref={(node) => {
                                                nodeRefs.current[key] = node;
                                            }}
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={34}
                                            fill="#1e3a8a"
                                            cornerRadius={8}
                                            stroke={isSelected ? "#60a5fa" : "#111827"}
                                            strokeWidth={2}
                                            draggable={tool === "select"}
                                            onClick={(event) => {
                                                event.cancelBubble = true;
                                                selectObject(obj, event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
                                            }}
                                            onDragStart={startGroupDrag}
                                            onDragMove={(event) => groupDragMove(obj, event.target)}
                                            onDragEnd={(event) => groupDragEnd(obj, event.target)}
                                            onTransformEnd={(event) => finishTransform(obj, event.target)}
                                        />
                                        <Text x={x + 18} y={y + 9} text={door.name || "Cửa kho"} fontSize={12} fontStyle="bold" fill="#ffffff" listening={false} />
                                    </Group>
                                );
                            })}

                            {guides.map((points, index) => (
                                <Line key={index} points={points} stroke="#2563eb" strokeWidth={1.5} dash={[6, 6]} listening={false} />
                            ))}

                            {selectionBox ? (
                                <Rect
                                    x={selectionBox.x}
                                    y={selectionBox.y}
                                    width={selectionBox.w}
                                    height={selectionBox.h}
                                    fill="rgba(37,99,235,.08)"
                                    stroke="#2563eb"
                                    dash={[6, 6]}
                                    listening={false}
                                />
                            ) : null}

                            <Transformer
                                ref={transformerRef}
                                rotateEnabled={false}
                                ignoreStroke
                                enabledAnchors={[
                                    "top-left",
                                    "top-right",
                                    "bottom-left",
                                    "bottom-right",
                                    "middle-left",
                                    "middle-right",
                                    "top-center",
                                    "bottom-center",
                                ]}
                                boundBoxFunc={(oldBox, newBox) => {
                                    if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) return oldBox;
                                    return newBox;
                                }}
                            />
                        </Layer>
                    </Stage>
                </div>
            </div>

            {selected.length ? (
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 py-3 text-sm">
                    <button type="button" className="rounded-xl border bg-white px-3 py-2 font-semibold" onClick={() => updateSelectedStatus("IN_PROGRESS")}>
                        Đánh dấu đang kiểm
                    </button>
                    <button type="button" className="rounded-xl border bg-white px-3 py-2 font-semibold" onClick={() => updateSelectedStatus("FINISHED")}>
                        Đánh dấu đã kiểm
                    </button>
                    <button type="button" className="rounded-xl border bg-white px-3 py-2 font-semibold" onClick={() => updateSelectedStatus("MISMATCH")}>
                        Đánh dấu lệch
                    </button>
                    {selectedRack ? <span className="ml-auto text-neutral-500">Đang chọn: {selectedRack.name}</span> : null}
                </div>
            ) : null}
        </div>
    );
}
