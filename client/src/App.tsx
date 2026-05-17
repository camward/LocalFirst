import { useState, useEffect, useRef, useCallback } from "react";
import { loadState, saveState, type DocState, type Stroke } from "./lib/db";

const DOC_ID = "main-doc";

export default function App() {
  const [local, setLocal] = useState<DocState>({
    id: DOC_ID,
    text: "",
    canvas: [],
    version: 0,
    lastSyncedVersion: 0,
  });
  const [synced, setSynced] = useState<DocState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);
  const localRef = useRef(local);
  localRef.current = local;

  useEffect(() => {
    loadState(DOC_ID).then((d) => {
      if (d) {
        setLocal(d);
        setSynced(d);
      }
    });
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
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
    };
    setLocal(next);
    saveState(next);
    currentStroke.current = [];
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      const curr = localRef.current;
      if (curr.version <= curr.lastSyncedVersion) return;
      try {
        const res = await fetch("http://localhost:3000/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(curr),
        });
        const data = (await res.json()) as DocState;
        setLocal((p) => ({
          ...p,
          version: data.version,
          lastSyncedVersion: data.version,
        }));
        setSynced(data);
      } catch (e) {
        console.error("Sync error", e);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <div className="w-1/2 p-4 border-r flex flex-col gap-3">
        <h2 className="font-bold text-lg">📝 Локальное (редактируемое)</h2>
        <textarea
          className="w-full h-1/3 p-3 border rounded bg-white resize-none"
          value={local.text}
          onChange={(e) => {
            const n = { ...local, text: e.target.value };
            setLocal(n);
            saveState(n);
          }}
          placeholder="Текст..."
        />
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          className="w-full border rounded bg-white cursor-crosshair touch-none"
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>
      <div className="w-1/2 p-4 flex flex-col gap-3">
        <h2 className="font-bold text-lg">☁️ Синхронизированное (read-only)</h2>
        <div className="w-full h-1/3 p-3 border rounded bg-gray-100 whitespace-pre-wrap overflow-auto">
          {synced?.text || "Загрузка..."}
        </div>
        <div className="w-full border rounded bg-white overflow-hidden h-[300px] flex items-center justify-center">
          <canvas ref={rightRef} width={600} height={300} />
        </div>
        <div className="text-sm text-gray-500 mt-2">
          {local.version > local.lastSyncedVersion
            ? "⏳ Ожидание синхронизации..."
            : `✅ Версия ${local.lastSyncedVersion} сохранена`}
        </div>
      </div>
    </div>
  );
}
