import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadState,
  saveState,
  createInitialState,
  type DocState,
  type Stroke,
} from "./lib/db";

export default function App() {
  const [local, setLocal] = useState<DocState>(createInitialState());
  const [synced, setSynced] = useState<DocState | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok">(
    "idle"
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);
  const localRef = useRef(local);
  localRef.current = local;

  useEffect(() => {
    loadState()
      .then((d) => {
        if (d) {
          setLocal(d);
          setSynced(d);
        }
      })
      .catch((err) => console.error("Failed to load state:", err));
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of strokes) {
        ctx.beginPath();
        s.points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        );
        ctx.stroke();
      }
    },
    []
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx, local.canvas);
  }, [local.canvas, draw]);

  useEffect(() => {
    const ctx = rightRef.current?.getContext("2d");
    if (ctx && synced) draw(ctx, synced.canvas);
  }, [synced?.canvas, draw]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawing.current = true;
    currentStroke.current = [getPos(e)];
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    currentStroke.current.push(getPos(e));
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx)
      draw(ctx, [...local.canvas, { points: [...currentStroke.current] }]);
  };

  const endDraw = () => {
    if (!isDrawing.current || currentStroke.current.length === 0) return;
    isDrawing.current = false;
    const next = {
      ...local,
      canvas: [...local.canvas, { points: [...currentStroke.current] }],
      version: local.version + 1,
    };
    setLocal(next);
    saveState(next).catch((err) =>
      console.error("Failed to save canvas:", err)
    );
    currentStroke.current = [];
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = { ...local, text: e.target.value, version: local.version + 1 };
    setLocal(next);
    saveState(next).catch((err) => console.error("Failed to save text:", err));
  };

  const handleResetText = () => {
    const next = { ...local, text: "", version: local.version + 1 };
    setLocal(next);
    saveState(next).catch((err) => console.error("Failed to reset text:", err));
  };

  const handleResetCanvas = () => {
    const next = { ...local, canvas: [], version: local.version + 1 };
    setLocal(next);
    saveState(next).catch((err) =>
      console.error("Failed to reset canvas:", err)
    );
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      const curr = localRef.current;
      if (curr.version <= curr.lastSyncedVersion) {
        setSyncStatus("idle");
        return;
      }
      setSyncStatus("syncing");
      try {
        const res = await fetch("http://localhost:3000/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(curr),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DocState;
        setLocal((p) => ({
          ...p,
          version: data.version,
          lastSyncedVersion: data.version,
        }));
        setSynced(data);
        setSyncStatus("ok");
        setTimeout(() => setSyncStatus("idle"), 2000);
      } catch (e) {
        console.error("Sync error", e);
        setSyncStatus("idle");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Левая панель - редактирование */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Новый документ
          </h2>

          {/* Текстовое поле */}
          <div className="mb-4 relative group">
            <button
              onClick={handleResetText}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 z-10"
            >
              Очистить текст
            </button>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Текст документа
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
              value={local.text}
              onChange={handleTextChange}
              placeholder="Введите текст..."
              rows={4}
            />
          </div>

          {/* Canvas */}
          <div className="mb-4 relative group">
            <button
              onClick={handleResetCanvas}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 z-10"
            >
              Очистить рисунок
            </button>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Рисунок
            </label>
            <canvas
              ref={canvasRef}
              width={600}
              height={300}
              className="w-full border border-gray-300 rounded-md bg-white cursor-crosshair touch-none"
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Версия: {local.version}</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                syncStatus === "syncing"
                  ? "bg-yellow-100 text-yellow-800"
                  : syncStatus === "ok"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {syncStatus === "syncing"
                ? "Синхронизация..."
                : syncStatus === "ok"
                ? "Сохранено"
                : "Ожидание"}
            </span>
          </div>
        </div>

        {/* Правая панель - синхронизированные данные */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Синхронизировано
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Текст документа
            </label>
            <div className="w-full p-3 border border-gray-200 rounded-md bg-gray-50 font-mono text-sm min-h-[100px] whitespace-pre-wrap">
              {synced?.text || "Загрузка..."}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Рисунок
            </label>
            <div className="w-full border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
              <canvas
                ref={rightRef}
                width={600}
                height={300}
                className="w-full bg-white"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>Версия на сервере: {synced?.version || 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              ID: {synced?.id || "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
