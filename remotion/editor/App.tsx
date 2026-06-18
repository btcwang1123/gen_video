import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { FinalCutProps, Layout, SubtitleCue, Visual } from "../src/schema";
import {
  fetchRuns,
  fetchProps,
  saveProps,
  videoUrl,
  startRender,
  renderStatus,
  type RunInfo,
  type RenderStatus,
} from "./api";
import { PreviewPane } from "./PreviewPane";
import { Timeline } from "./Timeline";
import { Inspector } from "./Inspector";
import { AssetLibrary } from "./AssetLibrary";
import { patchItem, getItem, type Selection } from "./model";

const MAX_HISTORY = 60;

export const App: React.FC = () => {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [run, setRun] = useState<string | null>(null);
  const [props, setProps] = useState<FinalCutProps | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [frame, setFrame] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [render, setRender] = useState<RenderStatus>({ state: "idle", message: "" });
  const [leftTab, setLeftTab] = useState<"runs" | "assets">("runs");
  const playerRef = useRef<PlayerRef | null>(null);

  // undo/redo history
  const historyRef = useRef<FinalCutProps[]>([]);
  const historyIdxRef = useRef(-1);

  // clipboard for copy/paste
  const clipboardRef = useRef<SubtitleCue | Visual | null>(null);

  useEffect(() => {
    fetchRuns().then(setRuns).catch(() => setRuns([]));
  }, []);

  const loadRun = useCallback((id: string) => {
    setRun(id);
    setSelection(null);
    setProps(null);
    historyRef.current = [];
    historyIdxRef.current = -1;
    fetchProps(id).then((p) => {
      setProps(p);
      historyRef.current = [p];
      historyIdxRef.current = 0;
      setDirty(false);
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = playerRef.current;
      if (p) {
        const f = p.getCurrentFrame();
        setFrame((prev) => (prev === f ? prev : f));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fps = props?.fps || 30;
  const durationInFrames = props ? Math.max(1, Math.ceil(props.durationInSeconds * fps)) : 1;

  const previewProps = useMemo(() => {
    if (!props || !run) return null;
    return { ...props, videoSrc: videoUrl(run) };
  }, [props, run]);

  const applyProps = useCallback((next: FinalCutProps) => {
    setProps(next);
    setDirty(true);
    // push to history, drop redo tail
    const stack = historyRef.current.slice(0, historyIdxRef.current + 1);
    stack.push(next);
    if (stack.length > MAX_HISTORY) stack.shift();
    historyRef.current = stack;
    historyIdxRef.current = stack.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const p = historyRef.current[historyIdxRef.current];
    setProps(p);
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const p = historyRef.current[historyIdxRef.current];
    setProps(p);
    setDirty(true);
  }, []);

  const onLayoutChange = (sel: Selection, layout: Layout) => {
    if (!props) return;
    applyProps(patchItem(props, sel, { layout }));
  };

  const onTimeChange = (sel: Selection, start: number, end: number) => {
    if (!props) return;
    applyProps(patchItem(props, sel, { start, end }));
  };

  const onPatch = (patch: Record<string, unknown>) => {
    if (!props) return;
    applyProps(patchItem(props, selection, patch));
  };

  // split clip at current playhead
  const onSplitClip = useCallback(() => {
    if (!props || !selection) return;
    const item = getItem(props, selection);
    if (!item) return;
    const splitSec = frame / fps;
    if (splitSec <= item.start + 0.05 || splitSec >= item.end - 0.05) return;
    const next = structuredClone(props) as FinalCutProps;
    const arr = selection.kind === "subtitle" ? next.subtitles : next.visuals;
    const clip = arr[selection.index] as Record<string, unknown>;
    const second = structuredClone(clip) as Record<string, unknown>;
    clip.end = Math.round(splitSec * 1000) / 1000;
    second.start = Math.round(splitSec * 1000) / 1000;
    arr.splice(selection.index + 1, 0, second as never);
    applyProps(next);
  }, [props, selection, frame, fps, applyProps]);

  // add visual from asset library at current playhead
  const onAddVisual = useCallback((visual: Visual) => {
    if (!props) return;
    const next = structuredClone(props) as FinalCutProps;
    const dur = 4;
    const startSec = Math.round((frame / fps) * 1000) / 1000;
    next.visuals.push({ ...visual, start: startSec, end: startSec + dur });
    applyProps(next);
  }, [props, frame, fps, applyProps]);

  const doSave = useCallback(async () => {
    if (!run || !props) return;
    setSaving(true);
    try {
      await saveProps(run, props);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [run, props]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);

      // Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
        return;
      }

      // Ctrl+Z undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y redo
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.shiftKey ? e.key.toLowerCase() === "z" : e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
        return;
      }

      if (inInput) return;

      // Ctrl+C copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selection && props) {
        const item = getItem(props, selection);
        if (item) clipboardRef.current = structuredClone(item) as SubtitleCue | Visual;
        return;
      }

      // Ctrl+V paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && props) {
        const cb = clipboardRef.current;
        if (!cb) return;
        e.preventDefault();
        const next = structuredClone(props) as FinalCutProps;
        const dur = (cb as { end?: number; start?: number }).end! - (cb as { start?: number }).start!;
        const startSec = Math.round((frame / fps) * 1000) / 1000;
        const pasted = { ...structuredClone(cb), start: startSec, end: startSec + dur };
        if ("text" in cb) {
          next.subtitles.push(pasted as SubtitleCue);
          setSelection({ kind: "subtitle", index: next.subtitles.length - 1 });
        } else {
          next.visuals.push(pasted as Visual);
          setSelection({ kind: "visual", index: next.visuals.length - 1 });
        }
        applyProps(next);
        return;
      }

      // Delete / Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selection && props) {
        e.preventDefault();
        const next = structuredClone(props) as FinalCutProps;
        if (selection.kind === "subtitle") next.subtitles.splice(selection.index, 1);
        else next.visuals.splice(selection.index, 1);
        setSelection(null);
        applyProps(next);
        return;
      }

      // S — split at playhead
      if (e.key.toLowerCase() === "s" && selection && props) {
        e.preventDefault();
        onSplitClip();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doSave, undo, redo, selection, props, frame, fps, applyProps, onSplitClip]);

  const doRender = async () => {
    if (!run) return;
    await startRender(run);
    setRender({ state: "queued", message: "排隊中…" });
  };

  useEffect(() => {
    if (!run) return;
    if (render.state !== "queued" && render.state !== "rendering") return;
    const id = setInterval(async () => {
      setRender(await renderStatus(run));
    }, 1500);
    return () => clearInterval(id);
  }, [run, render.state]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    p.isPlaying() ? p.pause() : p.play();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 290px", height: "100vh" }}>
      {/* 左側:tab 切換 runs / 素材庫 */}
      <aside style={{ borderRight: "1px solid #232830", display: "flex", flexDirection: "column" }}>
        {/* tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #232830" }}>
          {(["runs", "assets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setLeftTab(t)}
              style={{
                flex: 1,
                padding: "7px 0",
                fontSize: 11,
                border: "none",
                background: leftTab === t ? "#1e232b" : "transparent",
                color: leftTab === t ? "#e6e9ee" : "#6b7280",
                cursor: "pointer",
                borderBottom: leftTab === t ? "2px solid #6B7F99" : "2px solid transparent",
              }}
            >
              {t === "runs" ? "専案" : "素材庫"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {leftTab === "runs" ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#cdd3dc" }}>
                finalCut 編輯器
              </div>
              <button onClick={doSave} disabled={!dirty || saving} style={btn(dirty)}>
                {saving ? "存檔中…" : dirty ? "● 存檔 (Ctrl+S)" : "已存檔"}
              </button>
              <button onClick={doRender} disabled={!run} style={btn(false)}>
                算圖輸出 mp4
              </button>
              {render.state !== "idle" && (
                <div style={{ fontSize: 11, color: "#9aa3b0", margin: "6px 0" }}>
                  算圖:{render.state}
                  {render.state === "done" && " ✅"}
                  {render.state === "error" && ` ❌ ${render.message}`}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#6b7280", margin: "12px 0 4px" }}>
                專案 (runs)
              </div>
              {runs.map((r) => (
                <div
                  key={r.id}
                  onClick={() => loadRun(r.id)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 11,
                    marginBottom: 3,
                    background: r.id === run ? "#283041" : "transparent",
                    color: r.id === run ? "#fff" : "#aeb6c2",
                  }}
                >
                  {r.id}
                  <div style={{ color: "#6b7280" }}>
                    字幕 {r.subtitleCount} · 視覺 {r.visualCount}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <AssetLibrary onAddVisual={onAddVisual} />
          )}
        </div>
      </aside>

      {/* 中:預覽 + 時間軸 */}
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflow: "hidden",
          }}
        >
          {previewProps ? (
            <div style={{ width: "100%", maxWidth: 1000 }}>
              <PreviewPane
                props={previewProps}
                durationInFrames={durationInFrames}
                frame={frame}
                selection={selection}
                setSelection={setSelection}
                onLayoutChange={onLayoutChange}
                playerRef={playerRef}
              />
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>← 從左側選一個專案開始編輯</div>
          )}
        </div>

        {props && (
          <div style={{ borderTop: "1px solid #232830", padding: "6px 10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <button onClick={togglePlay} style={{ ...btn(false), width: "auto", margin: 0, padding: "4px 12px" }}>
                ▶ / ⏸
              </button>
              <span style={{ fontSize: 11, color: "#9aa3b0" }}>
                {(frame / fps).toFixed(2)}s / {props.durationInSeconds.toFixed(1)}s
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={undo}
                title="還原 (Ctrl+Z)"
                style={{ ...iconBtn, opacity: historyIdxRef.current <= 0 ? 0.3 : 1 }}
              >
                ↩
              </button>
              <button
                onClick={redo}
                title="重做 (Ctrl+Shift+Z)"
                style={{ ...iconBtn, opacity: historyIdxRef.current >= historyRef.current.length - 1 ? 0.3 : 1 }}
              >
                ↪
              </button>
              <button
                onClick={onSplitClip}
                title="切割片段 (S)"
                disabled={!selection}
                style={{ ...iconBtn, opacity: selection ? 1 : 0.3 }}
              >
                ✂
              </button>
            </div>
            <Timeline
              props={props}
              frame={frame}
              selection={selection}
              setSelection={setSelection}
              onTimeChange={onTimeChange}
              playerRef={playerRef}
              onSplitClip={onSplitClip}
            />
          </div>
        )}
      </main>

      {/* 右:屬性面板 */}
      <aside style={{ borderLeft: "1px solid #232830", overflowY: "auto" }}>
        {props && (
          <Inspector props={props} selection={selection} onPatch={onPatch} />
        )}
      </aside>
    </div>
  );
};

function btn(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    display: "block",
    marginBottom: 6,
    padding: "7px 10px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid #2a2f38",
    background: active ? "#6B7F99" : "#1b1f26",
    color: active ? "#fff" : "#cdd3dc",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

const iconBtn: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 14,
  border: "1px solid #2a2f38",
  borderRadius: 5,
  background: "#1b1f26",
  color: "#cdd3dc",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
};
