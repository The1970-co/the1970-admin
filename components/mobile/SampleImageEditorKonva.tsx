"use client";

import Konva from "konva";
import { saveAs } from "file-saver";
import {
  Arrow,
  Circle,
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { useEffect, useMemo, useRef, useState } from "react";

type Tool = "select" | "arrow" | "text" | "rect" | "ellipse" | "pen";

type Point = { x: number; y: number };

type EditorObject =
  | {
      id: string;
      type: "arrow";
      start: Point;
      end: Point;
      text: string;
      textPos: Point;
      color: string;
      strokeWidth: number;
      fontSize: number;
      fontFamily: string;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      text: string;
      color: string;
      fontSize: number;
      fontFamily: string;
      rotation?: number;
    }
  | {
      id: string;
      type: "rect" | "ellipse";
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      type: "pen";
      x: number;
      y: number;
      points: number[];
      color: string;
      strokeWidth: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    };

type Props = {
  imageUrl: string;
  filename: string;
  busy?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
};

const uid = () => `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function useHtmlImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setImage(null);
    setError("");
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => alive && setImage(img);
    img.onerror = () => alive && setError("Không tải được ảnh để chỉnh sửa.");
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return { image, error };
}

export default function SampleImageEditorKonva({
  imageUrl,
  filename,
  busy = false,
  onCancel,
  onSave,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageRef = useRef<Konva.Image | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const drawingRef = useRef(false);
  const creatingRef = useRef<{ id: string; start: Point } | null>(null);
  const snapshotRef = useRef<EditorObject[] | null>(null);

  const { image, error: imageError } = useHtmlImage(imageUrl);
  const [size, setSize] = useState({ width: 360, height: 520 });
  const [tool, setTool] = useState<Tool>("select");
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState("#ff2d21");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(0);
  const [history, setHistory] = useState<EditorObject[][]>([]);
  const [future, setFuture] = useState<EditorObject[][]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      const w = Math.max(280, Math.min(window.innerWidth, wrapRef.current?.clientWidth || window.innerWidth));
      const maxH = Math.max(320, window.innerHeight - 270);
      if (!image) {
        setSize({ width: w, height: Math.min(520, maxH) });
        return;
      }
      const ratio = image.naturalWidth / image.naturalHeight;
      let width = w;
      let height = width / ratio;
      if (height > maxH) {
        height = maxH;
        width = height * ratio;
      }
      setSize({ width: Math.round(width), height: Math.round(height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [image]);

  useEffect(() => {
    if (!imageRef.current || !image) return;
    const node = imageRef.current;
    node.cache({ pixelRatio: 1 });
    node.filters([Konva.Filters.Brightness, Konva.Filters.Contrast]);
    node.brightness(brightness);
    node.contrast(contrast);
    node.getLayer()?.batchDraw();
  }, [image, brightness, contrast, size]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const selected = selectedId ? objects.find((x) => x.id === selectedId) : null;
    if (!selected || selected.type === "arrow") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = nodeRefs.current[selected.id];
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, objects]);

  const selected = useMemo(
    () => objects.find((x) => x.id === selectedId) || null,
    [objects, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    if ("color" in selected) setColor(selected.color);
    if ("strokeWidth" in selected) setStrokeWidth(selected.strokeWidth);
    if (selected.type === "text" || selected.type === "arrow") {
      setFontSize(selected.fontSize);
      setFontFamily(selected.fontFamily);
    }
  }, [selectedId]);

  function stagePoint(): Point | null {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getPointerPosition();
  }

  function beginHistory() {
    snapshotRef.current = clone(objects);
  }

  function endHistory() {
    if (!snapshotRef.current) return;
    setHistory((h) => [...h, snapshotRef.current!].slice(-50));
    setFuture([]);
    snapshotRef.current = null;
  }

  function commit(next: EditorObject[]) {
    setHistory((h) => [...h, clone(objects)].slice(-50));
    setFuture([]);
    setObjects(next);
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [clone(objects), ...f].slice(0, 50));
      setObjects(clone(prev));
      setSelectedId(null);
      return h.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h, clone(objects)].slice(-50));
      setObjects(clone(next));
      setSelectedId(null);
      return f.slice(1);
    });
  }

  function patchObject(id: string, patch: Partial<EditorObject>, track = false) {
    if (track) beginHistory();
    setObjects((rows) => rows.map((x) => (x.id === id ? ({ ...x, ...patch } as EditorObject) : x)));
    if (track) setTimeout(endHistory, 0);
  }

  function setSelectedStyle(patch: any) {
    if (!selectedId) return;
    setObjects((rows) => rows.map((x) => (x.id === selectedId ? ({ ...x, ...patch } as EditorObject) : x)));
  }

  function handleStageDown(e: any) {
    const p = stagePoint();
    if (!p) return;
    const clickedStage = e.target === e.target.getStage();

    if (tool === "select") {
      if (clickedStage) setSelectedId(null);
      return;
    }

    if (tool === "text") {
      const id = uid();
      commit([
        ...objects,
        {
          id,
          type: "text",
          x: p.x,
          y: p.y,
          text: "Ghi chú",
          color,
          fontSize,
          fontFamily,
        },
      ]);
      setSelectedId(id);
      setTool("select");
      return;
    }

    if (tool === "arrow") {
      const id = uid();
      beginHistory();
      setObjects((rows) => [
        ...rows,
        {
          id,
          type: "arrow",
          start: p,
          end: p,
          text: "Ghi chú",
          textPos: { x: p.x + 30, y: p.y - 30 },
          color,
          strokeWidth,
          fontSize,
          fontFamily,
        },
      ]);
      creatingRef.current = { id, start: p };
      return;
    }

    if (tool === "rect" || tool === "ellipse") {
      const id = uid();
      beginHistory();
      setObjects((rows) => [
        ...rows,
        {
          id,
          type: tool,
          x: p.x,
          y: p.y,
          width: 1,
          height: 1,
          color,
          strokeWidth,
        },
      ]);
      creatingRef.current = { id, start: p };
      return;
    }

    if (tool === "pen") {
      const id = uid();
      beginHistory();
      drawingRef.current = true;
      setObjects((rows) => [
        ...rows,
        { id, type: "pen", x: 0, y: 0, points: [p.x, p.y], color, strokeWidth },
      ]);
      creatingRef.current = { id, start: p };
    }
  }

  function handleStageMove() {
    const p = stagePoint();
    const creating = creatingRef.current;
    if (!p || !creating) return;

    setObjects((rows) =>
      rows.map((obj) => {
        if (obj.id !== creating.id) return obj;

        if (obj.type === "arrow") {
          return {
            ...obj,
            end: p,
            textPos: { x: p.x + (p.x > size.width - 150 ? -130 : 24), y: p.y - 36 },
          };
        }

        if (obj.type === "rect" || obj.type === "ellipse") {
          return {
            ...obj,
            x: Math.min(creating.start.x, p.x),
            y: Math.min(creating.start.y, p.y),
            width: Math.max(4, Math.abs(p.x - creating.start.x)),
            height: Math.max(4, Math.abs(p.y - creating.start.y)),
          };
        }

        if (obj.type === "pen" && drawingRef.current) {
          return { ...obj, points: [...obj.points, p.x, p.y] };
        }

        return obj;
      }),
    );
  }

  function handleStageUp() {
    if (!creatingRef.current) return;
    const id = creatingRef.current.id;
    creatingRef.current = null;
    drawingRef.current = false;
    endHistory();
    setSelectedId(id);
    setTool("select");
  }

  function applyDrag(id: string, e: any) {
    const x = e.target.x();
    const y = e.target.y();
    setObjects((rows) =>
      rows.map((obj) => {
        if (obj.id !== id) return obj;
        if (obj.type === "text" || obj.type === "rect" || obj.type === "ellipse" || obj.type === "pen") {
          return { ...obj, x, y } as EditorObject;
        }
        return obj;
      }),
    );
  }

  function handleTransformEnd(id: string, e: any) {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    setObjects((rows) =>
      rows.map((obj) => {
        if (obj.id !== id) return obj;
        if (obj.type === "rect" || obj.type === "ellipse") {
          return {
            ...obj,
            x: node.x(),
            y: node.y(),
            width: Math.max(8, obj.width * scaleX),
            height: Math.max(8, obj.height * scaleY),
            rotation: node.rotation(),
          };
        }
        if (obj.type === "text") {
          return {
            ...obj,
            x: node.x(),
            y: node.y(),
            fontSize: Math.max(10, obj.fontSize * Math.max(Math.abs(scaleX), Math.abs(scaleY))),
            rotation: node.rotation(),
          };
        }
        if (obj.type === "pen") {
          return {
            ...obj,
            x: node.x(),
            y: node.y(),
            scaleX: (obj.scaleX || 1) * scaleX,
            scaleY: (obj.scaleY || 1) * scaleY,
            rotation: node.rotation(),
          };
        }
        return obj;
      }),
    );
    endHistory();
  }

  function deleteSelected() {
    if (!selectedId) return;
    commit(objects.filter((x) => x.id !== selectedId));
    setSelectedId(null);
  }

  async function exportBlob() {
    const stage = stageRef.current;
    if (!stage) throw new Error("Editor chưa sẵn sàng.");
    setSelectedId(null);
    transformerRef.current?.nodes([]);
    stage.batchDraw();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const pixelRatio = image
      ? Math.min(3, Math.max(1, image.naturalWidth / Math.max(1, size.width)))
      : 2;
    const canvas = stage.toCanvas({ pixelRatio });
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Không xuất được ảnh."))),
        "image/jpeg",
        0.94,
      ),
    );
  }

  async function download() {
    try {
      setMessage("");
      const blob = await exportBlob();
      saveAs(blob, filename.endsWith(".jpg") ? filename : `${filename}.jpg`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không tải được ảnh.");
    }
  }

  async function save() {
    try {
      setMessage("");
      const blob = await exportBlob();
      await onSave(blob);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không lưu được ảnh.");
    }
  }

  const toolButton = (id: Tool, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTool(id);
        setSelectedId(null);
      }}
      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${
        tool === id ? "bg-amber-300 text-black" : "bg-white/10 text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black text-white">
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/15 p-2">
        {toolButton("select", "Chọn")}
        {toolButton("arrow", "Mũi tên + chữ")}
        {toolButton("text", "Chữ")}
        {toolButton("rect", "Khung")}
        {toolButton("ellipse", "Khoanh")}
        {toolButton("pen", "Vẽ tay")}
        <button disabled={!history.length} onClick={undo} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black disabled:opacity-30">Lùi</button>
        <button disabled={!future.length} onClick={redo} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black disabled:opacity-30">Tiến</button>
        <button disabled={!selectedId} onClick={deleteSelected} className="shrink-0 rounded-xl bg-red-500/20 px-3 py-2 text-xs font-black text-red-200 disabled:opacity-30">Xóa</button>
      </div>

      <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-1" style={{ touchAction: "none" }}>
        {imageError ? (
          <div className="p-6 text-center text-sm text-red-300">{imageError}</div>
        ) : !image ? (
          <div className="p-6 text-sm text-white/50">Đang mở ảnh...</div>
        ) : (
          <Stage
            ref={(n) => {
              stageRef.current = n;
            }}
            width={size.width}
            height={size.height}
            onMouseDown={handleStageDown}
            onMouseMove={handleStageMove}
            onMouseUp={handleStageUp}
            onMouseLeave={handleStageUp}
            onTouchStart={handleStageDown}
            onTouchMove={handleStageMove}
            onTouchEnd={handleStageUp}
            onTap={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
            style={{ touchAction: "none", background: "#111" }}
          >
            <Layer>
              <KonvaImage
                ref={(n) => {
                  imageRef.current = n;
                }}
                image={image}
                x={0}
                y={0}
                width={size.width}
                height={size.height}
                listening={false}
              />

              {objects.map((obj) => {
                if (obj.type === "arrow") {
                  const selectedArrow = selectedId === obj.id;
                  return (
                    <>
                      <Arrow
                        key={`${obj.id}_arrow`}
                        points={[obj.start.x, obj.start.y, obj.end.x, obj.end.y]}
                        stroke={obj.color}
                        fill={obj.color}
                        strokeWidth={obj.strokeWidth}
                        pointerLength={Math.max(12, obj.strokeWidth * 4)}
                        pointerWidth={Math.max(12, obj.strokeWidth * 4)}
                        hitStrokeWidth={26}
                        onTap={() => setSelectedId(obj.id)}
                        onClick={() => setSelectedId(obj.id)}
                      />
                      <Text
                        key={`${obj.id}_text`}
                        text={obj.text}
                        x={obj.textPos.x}
                        y={obj.textPos.y}
                        fontSize={obj.fontSize}
                        fontFamily={obj.fontFamily}
                        fontStyle="bold"
                        fill={obj.color}
                        padding={7}
                        draggable={tool === "select"}
                        onTap={() => setSelectedId(obj.id)}
                        onClick={() => setSelectedId(obj.id)}
                        onDragStart={beginHistory}
                        onDragMove={(e) => {
                          const p = { x: e.target.x(), y: e.target.y() };
                          setObjects((rows) => rows.map((x) => x.id === obj.id && x.type === "arrow" ? { ...x, textPos: p } : x));
                        }}
                        onDragEnd={endHistory}
                      />
                      {selectedArrow && (
                        <>
                          <Circle
                            key={`${obj.id}_start`}
                            x={obj.start.x}
                            y={obj.start.y}
                            radius={11}
                            fill="white"
                            stroke={obj.color}
                            strokeWidth={4}
                            draggable
                            onDragStart={beginHistory}
                            onDragMove={(e) =>
                              setObjects((rows) =>
                                rows.map((x) =>
                                  x.id === obj.id && x.type === "arrow"
                                    ? { ...x, start: { x: e.target.x(), y: e.target.y() } }
                                    : x,
                                ),
                              )
                            }
                            onDragEnd={endHistory}
                          />
                          <Circle
                            key={`${obj.id}_end`}
                            x={obj.end.x}
                            y={obj.end.y}
                            radius={11}
                            fill="white"
                            stroke={obj.color}
                            strokeWidth={4}
                            draggable
                            onDragStart={beginHistory}
                            onDragMove={(e) =>
                              setObjects((rows) =>
                                rows.map((x) =>
                                  x.id === obj.id && x.type === "arrow"
                                    ? { ...x, end: { x: e.target.x(), y: e.target.y() } }
                                    : x,
                                ),
                              )
                            }
                            onDragEnd={endHistory}
                          />
                        </>
                      )}
                    </>
                  );
                }

                if (obj.type === "text") {
                  return (
                    <Text
                      key={obj.id}
                      ref={(n) => {
                        nodeRefs.current[obj.id] = n;
                      }}
                      x={obj.x}
                      y={obj.y}
                      text={obj.text}
                      fontSize={obj.fontSize}
                      fontFamily={obj.fontFamily}
                      fontStyle="bold"
                      fill={obj.color}
                      rotation={obj.rotation || 0}
                      draggable={tool === "select"}
                      onTap={() => setSelectedId(obj.id)}
                      onClick={() => setSelectedId(obj.id)}
                      onDragStart={beginHistory}
                      onDragEnd={(e) => {
                        applyDrag(obj.id, e);
                        endHistory();
                      }}
                      onTransformStart={beginHistory}
                      onTransformEnd={(e) => handleTransformEnd(obj.id, e)}
                    />
                  );
                }

                if (obj.type === "rect") {
                  return (
                    <Rect
                      key={obj.id}
                      ref={(n) => {
                        nodeRefs.current[obj.id] = n;
                      }}
                      x={obj.x}
                      y={obj.y}
                      width={obj.width}
                      height={obj.height}
                      rotation={obj.rotation || 0}
                      stroke={obj.color}
                      strokeWidth={obj.strokeWidth}
                      fill="rgba(0,0,0,0.001)"
                      draggable={tool === "select"}
                      onTap={() => setSelectedId(obj.id)}
                      onClick={() => setSelectedId(obj.id)}
                      onDragStart={beginHistory}
                      onDragEnd={(e) => {
                        applyDrag(obj.id, e);
                        endHistory();
                      }}
                      onTransformStart={beginHistory}
                      onTransformEnd={(e) => handleTransformEnd(obj.id, e)}
                    />
                  );
                }

                if (obj.type === "ellipse") {
                  return (
                    <Ellipse
                      key={obj.id}
                      ref={(n) => {
                        nodeRefs.current[obj.id] = n;
                      }}
                      x={obj.x + obj.width / 2}
                      y={obj.y + obj.height / 2}
                      radiusX={obj.width / 2}
                      radiusY={obj.height / 2}
                      rotation={obj.rotation || 0}
                      stroke={obj.color}
                      strokeWidth={obj.strokeWidth}
                      fill="rgba(0,0,0,0.001)"
                      draggable={tool === "select"}
                      onTap={() => setSelectedId(obj.id)}
                      onClick={() => setSelectedId(obj.id)}
                      onDragStart={beginHistory}
                      onDragEnd={(e) => {
                        beginHistory();
                        const nx = e.target.x() - obj.width / 2;
                        const ny = e.target.y() - obj.height / 2;
                        setObjects((rows) => rows.map((x) => x.id === obj.id && x.type === "ellipse" ? { ...x, x: nx, y: ny } : x));
                        endHistory();
                      }}
                      onTransformStart={beginHistory}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const sx = node.scaleX();
                        const sy = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        setObjects((rows) =>
                          rows.map((x) =>
                            x.id === obj.id && x.type === "ellipse"
                              ? {
                                  ...x,
                                  width: Math.max(8, obj.width * sx),
                                  height: Math.max(8, obj.height * sy),
                                  x: node.x() - (obj.width * sx) / 2,
                                  y: node.y() - (obj.height * sy) / 2,
                                  rotation: node.rotation(),
                                }
                              : x,
                          ),
                        );
                        endHistory();
                      }}
                    />
                  );
                }

                if (obj.type === "pen") {
                  return (
                    <Line
                      key={obj.id}
                      ref={(n) => {
                        nodeRefs.current[obj.id] = n;
                      }}
                      x={obj.x}
                      y={obj.y}
                      points={obj.points}
                      stroke={obj.color}
                      strokeWidth={obj.strokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      tension={0.25}
                      scaleX={obj.scaleX || 1}
                      scaleY={obj.scaleY || 1}
                      rotation={obj.rotation || 0}
                      hitStrokeWidth={24}
                      draggable={tool === "select"}
                      onTap={() => setSelectedId(obj.id)}
                      onClick={() => setSelectedId(obj.id)}
                      onDragStart={beginHistory}
                      onDragEnd={(e) => {
                        applyDrag(obj.id, e);
                        endHistory();
                      }}
                      onTransformStart={beginHistory}
                      onTransformEnd={(e) => handleTransformEnd(obj.id, e)}
                    />
                  );
                }

                return null;
              })}

              <Transformer
                ref={(n) => {
                  transformerRef.current = n;
                }}
                rotateEnabled
                keepRatio={false}
                flipEnabled={false}
                anchorSize={18}
                anchorCornerRadius={9}
                borderStroke="#ffd12e"
                anchorFill="#fff"
                anchorStroke="#ffd12e"
                anchorStrokeWidth={3}
                enabledAnchors={[
                  "top-left",
                  "top-center",
                  "top-right",
                  "middle-left",
                  "middle-right",
                  "bottom-left",
                  "bottom-center",
                  "bottom-right",
                ]}
                boundBoxFunc={(oldBox, newBox) =>
                  Math.abs(newBox.width) < 16 || Math.abs(newBox.height) < 16 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/15 bg-black p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {selected && (selected.type === "text" || selected.type === "arrow") && (
          <input
            value={selected.text}
            onChange={(e) => setSelectedStyle({ text: e.target.value })}
            className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black outline-none"
            placeholder="Nhập ghi chú kỹ thuật..."
          />
        )}

        <div className="grid grid-cols-[48px_1fr] gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setSelectedStyle({ color: e.target.value });
            }}
            className="h-10 w-full rounded-xl bg-white/10 p-1"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                setSelectedStyle({ fontFamily: e.target.value });
              }}
              className="rounded-xl bg-white/10 px-2 text-xs font-bold text-white"
            >
              <option className="text-black" value="Arial">Arial</option>
              <option className="text-black" value="Helvetica">Helvetica</option>
              <option className="text-black" value="Georgia">Georgia</option>
              <option className="text-black" value="Courier New">Mono</option>
              <option className="text-black" value="Times New Roman">Times</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl bg-white/10 px-2 text-[10px] font-black">
              Nét
              <input
                type="range"
                min="1"
                max="14"
                value={strokeWidth}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setStrokeWidth(v);
                  setSelectedStyle({ strokeWidth: v });
                }}
                className="min-w-0 flex-1"
              />
              <b>{strokeWidth}</b>
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black">
          Cỡ chữ
          <input
            type="range"
            min="12"
            max="64"
            value={fontSize}
            onInput={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              setFontSize(v);
              setSelectedStyle({ fontSize: v });
            }}
            className="min-w-0 flex-1"
          />
          <b className="w-7 text-right">{fontSize}</b>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[10px] font-black uppercase text-white/60">
            Sáng <b className="text-white">{Math.round(brightness * 100)}%</b>
            <input
              type="range"
              min="0.4"
              max="1.8"
              step="0.02"
              value={brightness}
              onInput={(e) => setBrightness(Number((e.target as HTMLInputElement).value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-[10px] font-black uppercase text-white/60">
            Tương phản <b className="text-white">{contrast}</b>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={contrast}
              onInput={(e) => setContrast(Number((e.target as HTMLInputElement).value))}
              className="mt-1 w-full"
            />
          </label>
        </div>

        {message && <div className="rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200">{message}</div>}

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/20 py-3 text-xs font-black">Đóng</button>
          <button type="button" onClick={() => void download()} className="rounded-xl bg-white/10 py-3 text-xs font-black">Tải về</button>
          <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-white py-3 text-xs font-black text-black disabled:opacity-50">
            {busy ? "Đang lưu..." : "Lưu ảnh"}
          </button>
        </div>
      </div>
    </div>
  );
}
