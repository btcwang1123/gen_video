import React, { useLayoutEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { FinalCutVideo } from "../src/Video";
import type { FinalCutProps, Layout } from "../src/schema";
import { anchorRect, type Selection } from "./model";

interface Props {
  props: FinalCutProps;
  durationInFrames: number;
  frame: number;
  selection: Selection;
  setSelection: (s: Selection) => void;
  onLayoutChange: (sel: Selection, layout: Layout) => void;
  playerRef: React.RefObject<PlayerRef | null>;
}

interface Box {
  sel: Selection;
  left: number;
  top: number;
  w: number;
  h: number;
}

type Corner = "nw" | "ne" | "sw" | "se";

const CORNER_CURSORS: Record<Corner, string> = {
  nw: "nw-resize",
  ne: "ne-resize",
  sw: "sw-resize",
  se: "se-resize",
};

const CORNER_POS: Record<Corner, { right?: number; left?: number; top?: number; bottom?: number }> = {
  nw: { left: -7, top: -7 },
  ne: { right: -7, top: -7 },
  sw: { left: -7, bottom: -7 },
  se: { right: -7, bottom: -7 },
};

export const PreviewPane: React.FC<Props> = ({
  props,
  durationInFrames,
  frame,
  selection,
  setSelection,
  onLayoutChange,
  playerRef,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dispW, setDispW] = useState(0);

  const aspect = props.height / props.width;
  const dispH = dispW * aspect;
  const sf = dispW / props.width;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setDispW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sec = props.fps ? frame / props.fps : 0;

  const boxFor = (sel: NonNullable<Selection>): Box => {
    const item =
      sel.kind === "subtitle" ? props.subtitles[sel.index] : props.visuals[sel.index];
    const r = anchorRect(props, sel.kind, item as never);
    const layout: Layout = (item as { layout?: Layout }).layout ?? { x: 0, y: 0, scale: 1 };
    const W = props.width;
    const H = props.height;
    const cx = W / 2;
    const cy = H / 2;
    const acx = (r.x + r.w / 2) * W;
    const acy = (r.y + r.h / 2) * H;
    const dcx = cx + layout.scale * (acx - cx) + layout.x;
    const dcy = cy + layout.scale * (acy - cy) + layout.y;
    const w = r.w * W * layout.scale;
    const h = r.h * H * layout.scale;
    return {
      sel,
      left: (dcx - w / 2) * sf,
      top: (dcy - h / 2) * sf,
      w: w * sf,
      h: h * sf,
    };
  };

  const activeBoxes: Box[] = [];
  props.subtitles.forEach((s, i) => {
    if (sec >= s.start && sec < s.end)
      activeBoxes.push(boxFor({ kind: "subtitle", index: i }));
  });
  props.visuals.forEach((v, i) => {
    if (sec >= v.start && sec < v.end)
      activeBoxes.push(boxFor({ kind: "visual", index: i }));
  });

  const selKey = selection ? `${selection.kind}:${selection.index}` : null;

  const drag = useRef<{
    mode: "move" | "corner";
    corner?: Corner;
    startX: number;
    startY: number;
    startLayout: Layout;
    // for corner scale: center of element in screen px
    cx: number;
    cy: number;
    startDist: number;
  } | null>(null);

  const currentLayout = (sel: NonNullable<Selection>): Layout => {
    const item =
      sel.kind === "subtitle" ? props.subtitles[sel.index] : props.visuals[sel.index];
    return (item as { layout?: Layout }).layout ?? { x: 0, y: 0, scale: 1 };
  };

  const onPointerDownBody = (e: React.PointerEvent, sel: NonNullable<Selection>) => {
    e.stopPropagation();
    setSelection(sel);
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      startLayout: currentLayout(sel),
      cx: 0, cy: 0, startDist: 0,
    };
  };

  const onPointerDownCorner = (
    e: React.PointerEvent,
    sel: NonNullable<Selection>,
    box: Box,
    corner: Corner
  ) => {
    e.stopPropagation();
    setSelection(sel);
    (e.target as Element).setPointerCapture(e.pointerId);
    const rect = wrapRef.current!.getBoundingClientRect();
    // element center in screen coords (relative to wrapper)
    const elemCx = box.left + box.w / 2;
    const elemCy = box.top + box.h / 2;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    drag.current = {
      mode: "corner",
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startLayout: currentLayout(sel),
      cx: elemCx,
      cy: elemCy,
      startDist: Math.hypot(px - elemCx, py - elemCy) || 1,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !selection) return;
    if (d.mode === "move") {
      const ddx = (e.clientX - d.startX) / sf;
      const ddy = (e.clientY - d.startY) / sf;
      onLayoutChange(selection, {
        x: Math.round(d.startLayout.x + ddx),
        y: Math.round(d.startLayout.y + ddy),
        scale: d.startLayout.scale,
      });
    } else {
      const rect = wrapRef.current!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const dist = Math.hypot(px - d.cx, py - d.cy);
      const next = Math.max(0.1, Math.min(5, (d.startLayout.scale * dist) / d.startDist));
      onLayoutChange(selection, {
        x: d.startLayout.x,
        y: d.startLayout.y,
        scale: Math.round(next * 100) / 100,
      });
    }
  };

  const onPointerUp = () => { drag.current = null; };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", lineHeight: 0 }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {dispW > 0 && (
        <Player
          ref={playerRef}
          component={FinalCutVideo}
          inputProps={props}
          durationInFrames={Math.max(1, durationInFrames)}
          compositionWidth={props.width}
          compositionHeight={props.height}
          fps={props.fps || 30}
          style={{ width: dispW, height: dispH }}
          controls={false}
          acknowledgeRemotionLicense
        />
      )}

      <div
        style={{ position: "absolute", inset: 0, cursor: "default" }}
        onPointerDown={() => setSelection(null)}
      >
        {activeBoxes.map((b) => {
          const key = `${b.sel!.kind}:${b.sel!.index}`;
          const selected = key === selKey;
          return (
            <div
              key={key}
              onPointerDown={(e) => onPointerDownBody(e, b.sel!)}
              style={{
                position: "absolute",
                left: b.left,
                top: b.top,
                width: b.w,
                height: b.h,
                border: selected
                  ? "2px solid #6B7F99"
                  : "1px dashed rgba(255,255,255,0.45)",
                background: selected ? "rgba(107,127,153,0.12)" : "transparent",
                cursor: "move",
                touchAction: "none",
              }}
            >
              {selected &&
                (["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
                  <div
                    key={corner}
                    onPointerDown={(e) => onPointerDownCorner(e, b.sel!, b, corner)}
                    style={{
                      position: "absolute",
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: "#6B7F99",
                      border: "2px solid #fff",
                      cursor: CORNER_CURSORS[corner],
                      touchAction: "none",
                      ...CORNER_POS[corner],
                    }}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
