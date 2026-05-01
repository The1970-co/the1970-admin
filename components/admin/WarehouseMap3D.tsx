"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Line, Transformer } from "react-konva";
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

type ToolMode = "select" | "rack" | "zone" | "door";
type SelectedObject =
  | { type: "rack"; id: string }
  | { type: "zone"; id: string }
  | { type: "door"; id: string }
  | null;

type Props = {
  map: FullWarehouseMap;
  branchId: string;
  currentFloor: WarehouseFloor | null;
  selectedRackId?: string;
  onSelectRack: (rack: WarehouseRack | null) => void;
  onChange: () => Promise<void> | void;
};

const GRID = 20;
const STAGE_W = 1200;
const STAGE_H = 760;

function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

function zoneColor(type?: string) {
  if (type === "OFFICE") return "#dbeafe";
  if (type === "PACKING") return "#fef3c7";
  if (type === "RETURN") return "#fee2e2";
  if (type === "WALKWAY") return "#f3f4f6";
  return "#dcfce7";
}

function statusColor(status?: string) {
  if (status === "FINISHED") return "#16a34a";
  if (status === "IN_PROGRESS") return "#f59e0b";
  if (status === "MISMATCH") return "#dc2626";
  return "#111827";
}

function getRackNumber(rackNo?: string) {
  return Number(String(rackNo || "K01").replace(/\D/g, "")) || 1;
}

export default function WarehouseMap2DEditor({
  map,
  branchId,
  currentFloor,
  selectedRackId,
  onSelectRack,
  onChange,
}: Props) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});

  const [tool, setTool] = useState<ToolMode>("select");
  const [selected, setSelected] = useState<SelectedObject>(null);
  const [scale, setScale] = useState(0.86);
  const [saving, setSaving] = useState(false);

  const racks = useMemo(() => {
    return (map.racks || []).filter((rack: any) => {
      if (!currentFloor?.id) return true;
      return !rack.floorId || rack.floorId === currentFloor.id;
    });
  }, [map.racks, currentFloor?.id]);

  const zones = useMemo(() => {
    const floorZones = currentFloor?.zones || [];
    return floorZones.length ? floorZones : map.zones || [];
  }, [currentFloor?.zones, map.zones]);

  const doors = useMemo(() => {
    const floorDoors = currentFloor?.doors || [];
    return floorDoors.length ? floorDoors : map.doors || [];
  }, [currentFloor?.doors, map.doors]);

  useEffect(() => {
    if (!trRef.current) return;
    if (!selected) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
      return;
    }

    const key = `${selected.type}:${selected.id}`;
    const node = nodeRefs.current[key];
    if (node) {
      trRef.current.nodes([node]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected, map]);

  const selectRack = (rack: WarehouseRack) => {
    setSelected({ type: "rack", id: rack.id });
    onSelectRack(rack);
  };

  const handleAddRack = async () => {
    if (!map.id || !branchId) return;
    setSaving(true);
    try {
      const aisle = "A";
      const rackNo = `K${String(racks.length + 1).padStart(2, "0")}`;
      await createRack({
        mapId: map.id,
        branchId,
        name: `Dãy ${aisle} - ${rackNo}`,
        zone: "A",
        aisle,
        rackNo,
        floors: 5,
        x: 100 + (racks.length % 6) * 80,
        y: 100 + Math.floor(racks.length / 6) * 160,
        w: 50,
        h: 140,
      } as any);
      await onChange();
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async (type: string, name: string) => {
    if (!currentFloor?.id) return;
    setSaving(true);
    try {
      await createWarehouseZone(map.id, {
        floorId: currentFloor.id,
        name,
        type,
        x: type === "OFFICE" ? 60 : 820,
        y: type === "OFFICE" ? 80 : 100,
        width: type === "OFFICE" ? 260 : 220,
        height: type === "OFFICE" ? 240 : 160,
        color: zoneColor(type),
      });
      await onChange();
    } finally {
      setSaving(false);
    }
  };

  const handleAddDoor = async () => {
    if (!currentFloor?.id) return;
    setSaving(true);
    try {
      await createWarehouseDoor(map.id, {
        floorId: currentFloor.id,
        name: "Cửa kho",
        side: "BOTTOM",
        x: 520,
        y: 700,
        width: 180,
      });
      await onChange();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected) return;
    const ok = window.confirm("Xóa đối tượng đang chọn?");
    if (!ok) return;

    setSaving(true);
    try {
      if (selected.type === "rack") await deleteRack(selected.id);
      if (selected.type === "zone") await deleteWarehouseZone(selected.id);
      if (selected.type === "door") await deleteWarehouseDoor(selected.id);
      setSelected(null);
      onSelectRack(null);
      await onChange();
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedTransform = async (node: Konva.Node, selected: SelectedObject) => {
    if (!selected) return;

    const x = snap(node.x());
    const y = snap(node.y());
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const width = Math.max(20, snap((node.width?.() || 60) * scaleX));
    const height = Math.max(20, snap((node.height?.() || 60) * scaleY));

    node.scaleX(1);
    node.scaleY(1);
    node.x(x);
    node.y(y);

    if (selected.type === "rack") {
      await updateRack(selected.id, { x, y, w: width, h: height } as any);
    }

    if (selected.type === "zone") {
      await updateWarehouseZone(selected.id, { x, y, width, height });
    }

    if (selected.type === "door") {
      await updateWarehouseDoor(selected.id, { x, y, width });
    }
  };

  const gridLines = [];
  for (let x = 0; x <= STAGE_W; x += GRID) gridLines.push(<Line key={`v-${x}`} points={[x, 0, x, STAGE_H]} stroke="#eef2f7" strokeWidth={1} />);
  for (let y = 0; y <= STAGE_H; y += GRID) gridLines.push(<Line key={`h-${y}`} points={[0, y, STAGE_W, y]} stroke="#eef2f7" strokeWidth={1} />);

  return (
    <div className="rounded-b-3xl bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${tool === "select" ? "bg-blue-600 text-white" : "border bg-white"}`} onClick={() => setTool("select")}>Chọn</button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={handleAddRack}>+ Kệ</button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => handleAddZone("OFFICE", "Văn phòng")}>+ Văn phòng</button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => handleAddZone("PACKING", "Khu đóng hàng")}>+ Đóng hàng</button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={() => handleAddZone("RETURN", "Khu hàng lỗi")}>+ Hàng lỗi</button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={handleAddDoor}>+ Cửa</button>
          <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600" onClick={handleDeleteSelected} disabled={!selected}>Xóa chọn</button>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span>Snap {GRID}px</span>
          <button className="rounded-xl border bg-white px-3 py-2" onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))}>-</button>
          <span>{Math.round(scale * 100)}%</span>
          <button className="rounded-xl border bg-white px-3 py-2" onClick={() => setScale((s) => Math.min(1.2, Number((s + 0.1).toFixed(2))))}>+</button>
          {saving ? <span className="font-semibold text-blue-600">Đang lưu...</span> : <span>Auto-save khi thả chuột</span>}
        </div>
      </div>

      <div className="overflow-auto bg-neutral-100 p-5">
        <div className="mx-auto w-fit rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <Stage
            ref={stageRef}
            width={STAGE_W * scale}
            height={STAGE_H * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) {
                setSelected(null);
                onSelectRack(null);
              }
            }}
          >
            <Layer>
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f8fafc" stroke="#d1d5db" strokeWidth={2} cornerRadius={18} />
              {gridLines}

              {zones.map((zone: WarehouseZone) => {
                const key = `zone:${zone.id}`;
                return (
                  <Group key={zone.id}>
                    <Rect
                      ref={(node) => { nodeRefs.current[key] = node; }}
                      x={zone.x}
                      y={zone.y}
                      width={zone.width}
                      height={zone.height}
                      fill={zone.color || zoneColor(zone.type)}
                      opacity={0.72}
                      stroke={selected?.type === "zone" && selected.id === zone.id ? "#2563eb" : "#94a3b8"}
                      strokeWidth={selected?.type === "zone" && selected.id === zone.id ? 3 : 1}
                      dash={zone.type === "WALKWAY" ? [8, 6] : undefined}
                      cornerRadius={10}
                      draggable
                      onClick={(e) => { e.cancelBubble = true; setSelected({ type: "zone", id: zone.id }); }}
                      onDragEnd={async (e) => {
                        const node = e.target;
                        await updateWarehouseZone(zone.id, { x: snap(node.x()), y: snap(node.y()) });
                        await onChange();
                      }}
                      onTransformEnd={async (e) => {
                        await updateSelectedTransform(e.target, { type: "zone", id: zone.id });
                        await onChange();
                      }}
                    />
                    <Text x={zone.x + 12} y={zone.y + 12} text={zone.name} fontSize={16} fontStyle="bold" fill="#0f172a" listening={false} />
                    <Text x={zone.x + 12} y={zone.y + 34} text={`${Math.round(zone.width / 20)}m × ${Math.round(zone.height / 20)}m`} fontSize={12} fill="#64748b" listening={false} />
                  </Group>
                );
              })}

              {racks.map((rack: WarehouseRack) => {
                const key = `rack:${rack.id}`;
                const selectedRack = selected?.type === "rack" && selected.id === rack.id;
                return (
                  <Group key={rack.id}>
                    <Rect
                      ref={(node) => { nodeRefs.current[key] = node; }}
                      x={Number(rack.x || 0)}
                      y={Number(rack.y || 0)}
                      width={Number((rack as any).w || 50)}
                      height={Number((rack as any).h || 140)}
                      fill={statusColor(rack.status)}
                      opacity={0.94}
                      cornerRadius={6}
                      stroke={selectedRack || selectedRackId === rack.id ? "#2563eb" : "#020617"}
                      strokeWidth={selectedRack || selectedRackId === rack.id ? 3 : 1}
                      draggable
                      onClick={(e) => { e.cancelBubble = true; selectRack(rack); }}
                      onDragEnd={async (e) => {
                        const node = e.target;
                        await updateRack(rack.id, { x: snap(node.x()), y: snap(node.y()) } as any);
                        await onChange();
                      }}
                      onTransformEnd={async (e) => {
                        await updateSelectedTransform(e.target, { type: "rack", id: rack.id });
                        await onChange();
                      }}
                    />
                    <Text
                      x={Number(rack.x || 0) + 6}
                      y={Number(rack.y || 0) + 8}
                      text={`${rack.aisle}-${rack.rackNo}\n${rack.floors || 5} tầng`}
                      fontSize={11}
                      fill="#ffffff"
                      listening={false}
                    />
                  </Group>
                );
              })}

              {doors.map((door: WarehouseDoor) => {
                const key = `door:${door.id}`;
                return (
                  <Group key={door.id}>
                    <Rect
                      ref={(node) => { nodeRefs.current[key] = node; }}
                      x={door.x}
                      y={door.y}
                      width={door.width || 180}
                      height={32}
                      fill="#1e3a8a"
                      cornerRadius={8}
                      stroke={selected?.type === "door" && selected.id === door.id ? "#60a5fa" : "#111827"}
                      strokeWidth={2}
                      draggable
                      onClick={(e) => { e.cancelBubble = true; setSelected({ type: "door", id: door.id }); }}
                      onDragEnd={async (e) => {
                        const node = e.target;
                        await updateWarehouseDoor(door.id, { x: snap(node.x()), y: snap(node.y()) });
                        await onChange();
                      }}
                      onTransformEnd={async (e) => {
                        await updateSelectedTransform(e.target, { type: "door", id: door.id });
                        await onChange();
                      }}
                    />
                    <Text x={door.x + 18} y={door.y + 8} text={door.name || "Cửa kho"} fontSize={12} fontStyle="bold" fill="#ffffff" listening={false} />
                  </Group>
                );
              })}

              <Transformer
                ref={trRef}
                rotateEnabled={false}
                ignoreStroke
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
