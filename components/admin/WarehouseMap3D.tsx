"use client";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { WarehouseMap, WarehouseRack } from "@/lib/warehouse-map-api";

type ViewMode = "isometric" | "top" | "front" | "side";

type WarehouseZoneLike = {
  id: string;
  floorId?: string | null;
  name: string;
  type?: string | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  color?: string | null;
};

type WarehouseDoorLike = {
  id: string;
  floorId?: string | null;
  name?: string | null;
  side?: string | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
};

type Props = {
  map: WarehouseMap & {
    zones?: WarehouseZoneLike[];
    doors?: WarehouseDoorLike[];
    floors?: { id: string; name: string; level: number }[];
  };
  selectedRackId?: string;
  highlightedRackId?: string;
  viewMode: ViewMode;
  currentFloorId?: string;
  onSelectRack: (rack: WarehouseRack) => void;
};

type AisleGroup = {
  aisle: string;
  racks: WarehouseRack[];
};

function getRackNumber(rackNo?: string) {
  return Number(String(rackNo || "K01").replace(/\D/g, "")) || 1;
}

function getCamera(viewMode: ViewMode) {
  if (viewMode === "top") {
    return {
      position: [0, 26, 0.1] as [number, number, number],
      fov: 42,
    };
  }

  if (viewMode === "front") {
    return {
      position: [0, 8, -24] as [number, number, number],
      fov: 40,
    };
  }

  if (viewMode === "side") {
    return {
      position: [24, 9, 2] as [number, number, number],
      fov: 40,
    };
  }

  return {
    position: [11, 11, -18] as [number, number, number],
    fov: 38,
  };
}

function aisleTone(aisle: string) {
  const tones = [
    {
      rack: "#243246",
      box: "#c69c6d",
      label: "bg-neutral-100 text-neutral-800",
      guide: "#9ca3af",
    },
    {
      rack: "#b58900",
      box: "#facc15",
      label: "bg-amber-100 text-amber-900",
      guide: "#f59e0b",
    },
    {
      rack: "#263445",
      box: "#c69c6d",
      label: "bg-neutral-100 text-neutral-800",
      guide: "#9ca3af",
    },
    {
      rack: "#15803d",
      box: "#86efac",
      label: "bg-green-100 text-green-900",
      guide: "#22c55e",
    },
    {
      rack: "#1d4ed8",
      box: "#93c5fd",
      label: "bg-blue-100 text-blue-900",
      guide: "#3b82f6",
    },
  ];

  const index =
    Math.abs(
      aisle.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
    ) % tones.length;

  return tones[index];
}

function rackStatusColor(status?: string, selected?: boolean) {
  if (selected) return "#2563eb";
  if (status === "FINISHED") return "#16a34a";
  if (status === "IN_PROGRESS") return "#f59e0b";
  if (status === "MISMATCH") return "#dc2626";
  return undefined;
}

function groupRacksByAisle(racks: WarehouseRack[]) {
  const groups = new Map<string, WarehouseRack[]>();

  for (const rack of racks) {
    const aisle = String(rack.aisle || "A").toUpperCase();
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle)!.push(rack);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([aisle, group]) => ({
      aisle,
      racks: group.sort((a, b) => getRackNumber(a.rackNo) - getRackNumber(b.rackNo)),
    }));
}

function WarehouseShell({
  width,
  depth,
  showDefaultDoor = true,
}: {
  width: number;
  depth: number;
  showDefaultDoor?: boolean;
}) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#d7d7d7" roughness={0.88} />
      </mesh>

      <mesh position={[0, 2.15, depth / 2]}>
        <boxGeometry args={[width, 4.3, 0.22]} />
        <meshStandardMaterial color="#c9d0d6" roughness={0.78} />
      </mesh>

      <mesh position={[-width / 2, 2.15, 0]}>
        <boxGeometry args={[0.22, 4.3, depth]} />
        <meshStandardMaterial color="#c9d0d6" roughness={0.78} />
      </mesh>

      <mesh position={[width / 2, 2.15, 0]}>
        <boxGeometry args={[0.22, 4.3, depth]} />
        <meshStandardMaterial color="#c9d0d6" roughness={0.78} />
      </mesh>

      {showDefaultDoor ? (
        <>
          <mesh position={[0, 0.12, -depth / 2 - 0.05]}>
            <boxGeometry args={[4.6, 0.24, 0.56]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>

          <Html position={[0, 0.55, -depth / 2 - 0.05]} center>
            <div className="rounded-lg bg-blue-900 px-9 py-2 text-xs font-bold text-white shadow-lg">
              CỬA KHO
            </div>
          </Html>

          <mesh position={[-3.2, 0.18, -depth / 2 + 0.15]}>
            <boxGeometry args={[1.6, 0.36, 0.22]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>

          <mesh position={[3.2, 0.18, -depth / 2 + 0.15]}>
            <boxGeometry args={[1.6, 0.36, 0.22]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
        </>
      ) : null}
    </>
  );
}


function zoneColor(type?: string | null, customColor?: string | null) {
  if (customColor) return customColor;
  if (type === "OFFICE") return "#bfdbfe";
  if (type === "PACKING") return "#fde68a";
  if (type === "RETURN") return "#fecaca";
  if (type === "WALKWAY") return "#e5e7eb";
  return "#d9f99d";
}

function zoneText(type?: string | null) {
  if (type === "OFFICE") return "Văn phòng";
  if (type === "PACKING") return "Đóng hàng";
  if (type === "RETURN") return "Hàng lỗi / hoàn";
  if (type === "WALKWAY") return "Lối đi";
  return "Khu kho";
}

function mapRectToScene(
  rect: { x?: number | null; y?: number | null; width?: number | null; height?: number | null },
  width: number,
  depth: number
) {
  const layoutWidth = 1200;
  const layoutDepth = 760;
  const rx = Number(rect.x ?? 0);
  const ry = Number(rect.y ?? 0);
  const rw = Number(rect.width ?? 300);
  const rh = Number(rect.height ?? 200);

  return {
    x: ((rx + rw / 2) / layoutWidth - 0.5) * width,
    z: ((ry + rh / 2) / layoutDepth - 0.5) * depth,
    w: Math.max((rw / layoutWidth) * width, 1.2),
    d: Math.max((rh / layoutDepth) * depth, 1.2),
  };
}

function ZoneBlock({ zone, width, depth }: { zone: WarehouseZoneLike; width: number; depth: number }) {
  const rect = mapRectToScene(zone, width, depth);
  const color = zoneColor(zone.type, zone.color);

  return (
    <group position={[rect.x, 0.025, rect.z]}>
      <mesh>
        <boxGeometry args={[rect.w, 0.05, rect.d]} />
        <meshStandardMaterial color={color} transparent opacity={0.68} roughness={0.75} />
      </mesh>

      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[rect.w, 0.06, 0.06]} />
        <meshStandardMaterial color="#64748b" transparent opacity={0.35} />
      </mesh>

      <Html position={[0, 0.25, 0]} center>
        <div className="rounded-xl bg-white/90 px-3 py-1 text-center text-[11px] font-bold text-neutral-800 shadow">
          <div>{zone.name}</div>
          <div className="text-[10px] font-medium text-neutral-500">{zoneText(zone.type)}</div>
        </div>
      </Html>
    </group>
  );
}

function DoorBlock({ door, width, depth }: { door: WarehouseDoorLike; width: number; depth: number }) {
  const side = String(door.side || "BOTTOM").toUpperCase();
  const doorWidth = Math.max(Number(door.width ?? 180) / 100, 1.2);
  const offset = Number(door.x ?? 0) / 100;
  const x = side === "LEFT" ? -width / 2 - 0.04 : side === "RIGHT" ? width / 2 + 0.04 : offset;
  const z = side === "TOP" ? depth / 2 + 0.04 : side === "BOTTOM" ? -depth / 2 - 0.04 : offset;
  const isHorizontal = side === "TOP" || side === "BOTTOM";

  return (
    <group position={[x, 0.16, z]}>
      <mesh>
        <boxGeometry args={isHorizontal ? [doorWidth, 0.22, 0.5] : [0.5, 0.22, doorWidth]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>
      <Html position={[0, 0.42, 0]} center>
        <div className="rounded-lg bg-blue-900 px-5 py-1.5 text-[11px] font-bold text-white shadow-lg">
          {door.name || "CỬA KHO"}
        </div>
      </Html>
    </group>
  );
}

function RackUnit({
  rack,
  selected,
  color,
  boxColor,
  x,
  z,
  onClick,
}: {
  rack: WarehouseRack;
  selected: boolean;
  color: string;
  boxColor: string;
  x: number;
  z: number;
  onClick: () => void;
}) {
  const floors = Number(rack.floors || 5);
  const selectedColor = rackStatusColor(rack.status, selected);
  const frameColor = selectedColor || color;

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.45, 0.08, 1.08]} />
        <meshStandardMaterial color={selected ? "#60a5fa" : "#9ca3af"} />
      </mesh>

      {[
        [-0.66, 2.18, -0.45],
        [0.66, 2.18, -0.45],
        [-0.66, 2.18, 0.45],
        [0.66, 2.18, 0.45],
      ].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]}>
          <boxGeometry args={[0.08, 4.36, 0.08]} />
          <meshStandardMaterial color={frameColor} metalness={0.4} roughness={0.38} />
        </mesh>
      ))}

      {Array.from({ length: floors }).map((_, index) => {
        const y = 0.42 + index * 0.78;

        return (
          <group key={index} position={[0, y, 0]}>
            <mesh>
              <boxGeometry args={[1.42, 0.07, 1]} />
              <meshStandardMaterial color={frameColor} metalness={0.3} roughness={0.36} />
            </mesh>

            <mesh position={[-0.36, 0.29, 0]}>
              <boxGeometry args={[0.46, 0.34, 0.46]} />
              <meshStandardMaterial color={boxColor} roughness={0.65} />
            </mesh>

            <mesh position={[0.22, 0.29, 0]}>
              <boxGeometry args={[0.46, 0.34, 0.46]} />
              <meshStandardMaterial color={boxColor} roughness={0.65} />
            </mesh>
          </group>
        );
      })}

      {selected ? (
        <>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[1.85, 0.05, 1.36]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.45} />
          </mesh>

          <Html position={[0, floors * 0.78 + 1.15, 0]} center>
            <div className="rounded-xl bg-blue-600 px-3 py-1 text-center text-[11px] font-bold text-white shadow-lg">
              <div>{rack.name}</div>
              <div className="text-[10px] font-medium text-blue-100">
                {rack.rackNo} · {floors} tầng
              </div>
            </div>
          </Html>
        </>
      ) : null}
    </group>
  );
}

function AisleBlock({
  group,
  index,
  total,
  selectedRackId,
  highlightedRackId,
  onSelectRack,
}: {
  group: AisleGroup;
  index: number;
  total: number;
  selectedRackId?: string;
  highlightedRackId?: string;
  onSelectRack: (rack: WarehouseRack) => void;
}) {
  const tone = aisleTone(group.aisle);
  const aisleSpacing = 4.1;
  const rackSpacing = 1.17;
  const x = (index - (total - 1) / 2) * aisleSpacing;
  const depthOffset = -((group.racks.length - 1) * rackSpacing) / 2;

  return (
    <group>
      <Html position={[x, 5.25, depthOffset - 1.05]} center>
        <div className={`rounded-xl px-4 py-2 text-center text-sm font-bold shadow-md ${tone.label}`}>
          <div>Dãy {group.aisle}</div>
          <div className="text-xs font-medium opacity-70">{group.racks.length} kệ</div>
        </div>
      </Html>

      <mesh position={[x, 0.02, 0]}>
        <boxGeometry args={[2.1, 0.03, Math.max(group.racks.length * rackSpacing + 0.8, 2)]} />
        <meshStandardMaterial color={tone.guide} transparent opacity={0.18} />
      </mesh>

      <mesh position={[x - 1.32, 0.03, 0]}>
        <boxGeometry args={[0.035, 0.04, Math.max(group.racks.length * rackSpacing + 0.8, 2)]} />
        <meshStandardMaterial color={tone.guide} transparent opacity={0.75} />
      </mesh>

      <mesh position={[x + 1.32, 0.03, 0]}>
        <boxGeometry args={[0.035, 0.04, Math.max(group.racks.length * rackSpacing + 0.8, 2)]} />
        <meshStandardMaterial color={tone.guide} transparent opacity={0.75} />
      </mesh>

      {group.racks.map((rack, rackIndex) => {
        const z = depthOffset + rackIndex * rackSpacing;

        return (
          <RackUnit
            key={rack.id}
            rack={rack}
            selected={rack.id === selectedRackId || rack.id === highlightedRackId}
            color={tone.rack}
            boxColor={tone.box}
            x={x}
            z={z}
            onClick={() => onSelectRack(rack)}
          />
        );
      })}
    </group>
  );
}

export default function WarehouseMap3D({
  map,
  selectedRackId,
  highlightedRackId,
  viewMode,
  currentFloorId,
  onSelectRack,
}: Props) {
  const groups = groupRacksByAisle(map?.racks || []);
  const zones = (map?.zones || []).filter((zone) => !currentFloorId || zone.floorId === currentFloorId);
  const doors = (map?.doors || []).filter((door) => !currentFloorId || door.floorId === currentFloorId);
  const rackMax = Math.max(...groups.map((g) => g.racks.length), 1);
  const width = Math.max(groups.length * 4.4 + 5, 18);
  const depth = Math.max(rackMax * 1.18 + 6, 16);
  const camera = getCamera(viewMode);

  return (
    <div className="h-[720px] w-full overflow-hidden rounded-b-3xl bg-[#f4f6f8]">
      <Canvas key={viewMode} camera={camera}>
        <color attach="background" args={["#f8fafc"]} />

        <ambientLight intensity={0.72} />
        <directionalLight position={[7, 12, -8]} intensity={1.5} />
        <directionalLight position={[-8, 7, 8]} intensity={0.55} />

        <WarehouseShell width={width} depth={depth} showDefaultDoor={!doors.length} />

        {zones.map((zone) => (
          <ZoneBlock key={zone.id} zone={zone} width={width} depth={depth} />
        ))}

        {doors.map((door) => (
          <DoorBlock key={door.id} door={door} width={width} depth={depth} />
        ))}

        {groups.map((group, index) => (
          <AisleBlock
            key={group.aisle}
            group={group}
            index={index}
            total={groups.length}
            selectedRackId={selectedRackId}
            highlightedRackId={highlightedRackId}
            onSelectRack={onSelectRack}
          />
        ))}



        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={8}
          maxDistance={35}
          maxPolarAngle={Math.PI / 2.04}
          target={[0, 2, 0]}
        />
      </Canvas>
    </div>
  );
}