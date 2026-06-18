import React, { useLayoutEffect, useRef, useState, useCallback } from "react";
import type { PlayerRef } from "@remotion/player";
import type { FinalCutProps } from "../src/schema";
import { itemLabel, type Selection } from "./model";

interface Props {
  props: FinalCutProps;
  frame: number;
  selection: Selection;
  setSelection: (s: Selection) => void;
  onTimeChange: (sel: Selection, start: number, end: number) => void;
  playerRef: React.RefObject<PlayerRef | null>;
  onSplitClip: () => void;
}

const MIN_DUR = 0.2;
const LABEL_W = 64;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${ss}`;
};

export const Timeline: React.FC<Props> = ({
  props,
  frame,
  selection,
  setSelection,
  onTimeChange,
  playerRef,
  onSplitClip,
}) => {
  const containerRef = useRef<HTMLDivElement>(null); // scrollable outer
  const rulerRef = useRef<HTMLDivElement>(null);      // inner ruler (full zoom width)
  const [containerW, setContainerW] = useState(800);
  const [zoom, setZoom] = useState(1);          // 1 = fit all
  const [rowH, setRowH] = useState(26);         // track height (26 / 40 / 56)

  const total = Math.max(1, props.durationInSeconds);
  const fullW = containerW * zoom;              // total scrollable width in px
  const pps = fullW / total;                   // pixels per second

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const m = () => setContainerW(el.clientWidth);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fps = props.fps || 30;
  const playheadSec = frame / fps;

  // ── drag state ──
  const drag = useRef<{
    sel: NonNullable<Selection>;
    mode: "move" | "l" | "r";
    startX: number;
    start0: number;
    end0: number;
  } | null>(null);

  const getItem = (sel: NonNullable<Selection>) =>
    sel.kind === "subtitle" ? props.subtitles[sel.index] : props.visuals[sel.index];

  const onDown = (
    e: React.PointerEvent,
    sel: NonNullable<Selection>,
    mode: "move" | "l" | "r"
  ) => {
    e.stopPropagation();
    setSelection(sel);
    (e.target as Element).setPointerCapture(e.pointerId);
    const it = getItem(sel);
    drag.current = { sel, mode, startX: e.clientX, start0: it.start, end0: it.end };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = (e.clientX - d.startX) / pps;
    let start = d.start0;
    let end = d.end0;
    if (d.mode === "move") {
      start = d.start0 + dt;
      end = d.end0 + dt;
      if (start < 0) { end -= start; start = 0; }
      if (end > total) { start -= end - total; end = total; }
    } else if (d.mode === "l") {
      start = Math.min(Math.max(0, d.start0 + dt), d.end0 - MIN_DUR);
    } else {
      end = Math.max(Math.min(total, d.end0 + dt), d.start0 + MIN_DUR);
    }
    onTimeChange(d.sel, round(start), round(end));
  };

  const onUp = () => { drag.current = null; };

  const seekToX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xInScroll = (clientX - rect.left) + el.scrollLeft - LABEL_W;
    const sec = Math.max(0, Math.min(total, xInScroll / pps));
    playerRef.current?.seekTo(Math.round(sec * fps));
  };

  // scroll wheel over timeline → zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(20, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
  }, []);

  const clip = (
    sel: NonNullable<Selection>,
    start: number,
    end: number,
    color: string,
    label: string,
    speed?: number
  ) => {
    const selected = selection?.kind === sel.kind && selection.index === sel.index;
    const w = Math.max(3, (end - start) * pps);
    return (
      <div
        key={`${sel.kind}:${sel.index}`}
        onPointerDown={(e) => onDown(e, sel, "move")}
        title={label}
        style={{
          position: "absolute",
          left: start * pps,
          width: w,
          top: 2,
          height: rowH - 4,
          background: color,
          opacity: selected ? 1 : 0.72,
          border: selected ? "1.5px solid #fff" : "1px solid rgba(0,0,0,0.4)",
          borderRadius: 4,
          color: "#fff",
          fontSize: 11,
          lineHeight: `${rowH - 6}px`,
          padding: "0 6px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          cursor: "grab",
          touchAction: "none",
          boxSizing: "border-box",
        }}
      >
        <span onPointerDown={(e) => onDown(e, sel, "l")} style={edgeStyle("left")} />
        {speed && speed !== 1 ? (
          <span style={{ fontSize: 9, opacity: 0.85, marginRight: 3 }}>
            {speed}×
          </span>
        ) : null}
        {label}
        <span onPointerDown={(e) => onDown(e, sel, "r")} style={edgeStyle("right")} />
      </div>
    );
  };

  const rowHOptions = [26, 40, 56];
  const nextRowH = rowHOptions[(rowHOptions.indexOf(rowH) + 1) % rowHOptions.length];

  const Track: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
      <div
        style={{
          width: LABEL_W,
          flexShrink: 0,
          fontSize: 11,
          color: "#9aa3b0",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          position: "sticky",
          left: 0,
          background: "#141820",
          zIndex: 2,
        }}
      >
        {label}
      </div>
      <div style={{ position: "relative", width: fullW, height: rowH, flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ userSelect: "none" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>縮放</span>
        <button onClick={() => setZoom((z) => Math.max(1, z / 1.5))} style={smBtn}>－</button>
        <input
          type="range" min={1} max={20} step={0.1} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 80, accentColor: "#6B7F99" }}
        />
        <button onClick={() => setZoom((z) => Math.min(20, z * 1.5))} style={smBtn}>＋</button>
        <button onClick={() => setZoom(1)} style={smBtn} title="重設縮放">↺</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setRowH(nextRowH)}
          style={smBtn}
          title="切換軌道高度"
        >
          軌道高 {nextRowH}
        </button>
      </div>

      {/* scrollable timeline body */}
      <div
        ref={containerRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
        style={{ overflowX: "auto", overflowY: "hidden", position: "relative" }}
      >
        {/* ruler row */}
        <div style={{ display: "flex", flexShrink: 0 }}>
          {/* sticky label placeholder */}
          <div style={{
            width: LABEL_W, flexShrink: 0,
            position: "sticky", left: 0, background: "#141820", zIndex: 3,
          }} />
          <div
            ref={rulerRef}
            onPointerDown={(e) => seekToX(e.clientX)}
            style={{
              position: "relative",
              width: fullW,
              height: 18,
              flexShrink: 0,
              borderBottom: "1px solid #2a2f38",
              cursor: "text",
            }}
          >
            {ticks(total, pps, containerW).map((t) => (
              <div
                key={t}
                style={{
                  position: "absolute",
                  left: t * pps,
                  top: 0,
                  fontSize: 9,
                  color: "#6b7280",
                  borderLeft: "1px solid #2a2f38",
                  paddingLeft: 2,
                  height: 18,
                }}
              >
                {fmt(t)}
              </div>
            ))}
            {/* playhead line extends through all tracks */}
            <div
              style={{
                position: "absolute",
                left: playheadSec * pps,
                top: 0,
                width: 2,
                height: 18 + rowH * 3 + 6,
                background: "#e2574c",
                pointerEvents: "none",
                zIndex: 5,
              }}
            />
          </div>
        </div>

        <Track label="字幕">
          {props.subtitles.map((s, i) =>
            clip(
              { kind: "subtitle", index: i },
              s.start, s.end,
              "#6B7F99",
              s.text,
              (s as { speed?: number }).speed
            )
          )}
        </Track>
        <Track label="視覺">
          {props.visuals.map((v, i) =>
            clip(
              { kind: "visual", index: i },
              v.start, v.end,
              "#7C9885",
              itemLabel("visual", v),
              (v as { speed?: number }).speed
            )
          )}
        </Track>
        <Track label="章節">
          {(props.chapters ?? []).map((c, i) => (
            <div
              key={i}
              title={c.title}
              style={{
                position: "absolute",
                left: c.start * pps,
                top: 4,
                fontSize: 10,
                color: "#caa46f",
                borderLeft: "2px solid #caa46f",
                paddingLeft: 3,
                height: rowH - 8,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {i + 1}. {c.title}
            </div>
          ))}
        </Track>
      </div>
    </div>
  );
};

function edgeStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    [side]: 0,
    width: 7,
    height: "100%",
    cursor: "ew-resize",
    background: "rgba(255,255,255,0.25)",
  } as React.CSSProperties;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function ticks(total: number, pps: number, viewW: number): number[] {
  // aim for a tick roughly every 80px
  const rawStep = 80 / pps;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s >= rawStep) ?? 600;
  const out: number[] = [];
  for (let t = 0; t <= total; t += step) out.push(t);
  return out;
}

const smBtn: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: 11,
  border: "1px solid #2a2f38",
  borderRadius: 4,
  background: "#1b1f26",
  color: "#cdd3dc",
  cursor: "pointer",
  fontFamily: "inherit",
};
