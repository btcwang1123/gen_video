import type { FinalCutProps, Layout, Visual } from "../src/schema";

/** 目前選取的元素:字幕或某個視覺。 */
export type Selection =
  | { kind: "subtitle"; index: number }
  | { kind: "visual"; index: number }
  | null;

/** 取得選取元素的時間區間 + layout。 */
export function getItem(props: FinalCutProps, sel: Selection) {
  if (!sel) return null;
  if (sel.kind === "subtitle") return props.subtitles[sel.index] ?? null;
  return props.visuals[sel.index] ?? null;
}

/** 不可變更新:回傳套用 patch 後的新 props(只動到選取的那一項)。 */
export function patchItem(
  props: FinalCutProps,
  sel: Selection,
  patch: Record<string, unknown>
): FinalCutProps {
  if (!sel) return props;
  const next = structuredClone(props) as FinalCutProps;
  const arr = sel.kind === "subtitle" ? next.subtitles : next.visuals;
  arr[sel.index] = { ...arr[sel.index], ...patch } as never;
  return next;
}

export function patchLayout(
  props: FinalCutProps,
  sel: Selection,
  layout: Layout
): FinalCutProps {
  return patchItem(props, sel, { layout });
}

/**
 * 每種元素「原本版位」的近似框(以合成畫布比例 0~1 表示)。
 * 選取框畫在這裡;拖拉/縮放會寫進 layout(x,y px 位移 + scale),
 * 真正的元件會在 Player 裡跟著一起動(Video.tsx 的 <Layer> 套同一組 transform)。
 */
export function anchorRect(
  props: FinalCutProps,
  kind: "subtitle" | "visual",
  item: { type?: Visual["type"]; position?: Visual["position"] }
): { x: number; y: number; w: number; h: number } {
  if (kind === "subtitle") {
    return { x: 0.16, y: 0.82, w: 0.68, h: 0.12 };
  }
  const t = item.type;
  switch (t) {
    case "callout":
      return { x: 0.04, y: 0.05, w: 0.5, h: 0.16 };
    case "bar": {
      const pos = item.position ?? "right";
      const x = pos === "left" ? 0.04 : pos === "center" ? 0.3 : 0.62;
      return { x, y: 0.2, w: 0.34, h: 0.55 };
    }
    case "title":
      return { x: 0.2, y: 0.34, w: 0.6, h: 0.32 };
    case "stat":
      return { x: 0.28, y: 0.32, w: 0.44, h: 0.36 };
    case "panel":
    case "compare":
    case "checklist":
      return { x: 0.17, y: 0.18, w: 0.66, h: 0.64 };
    default:
      return { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
  }
}

/** 元素的顯示標籤(時間軸 / 列表用)。 */
export function itemLabel(
  kind: "subtitle" | "visual",
  item: { text?: string; type?: string; title?: string; value?: string }
): string {
  if (kind === "subtitle") return item.text ?? "";
  const head = item.type ?? "";
  const body = item.title || item.value || "";
  return body ? `${head} · ${body}` : head;
}
