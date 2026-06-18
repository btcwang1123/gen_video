import React from "react";
import type { FinalCutProps, Visual } from "../src/schema";
import { getItem, type Selection } from "./model";

interface Props {
  props: FinalCutProps;
  selection: Selection;
  onPatch: (patch: Record<string, unknown>) => void;
}

const lbl: React.CSSProperties = {
  fontSize: 11,
  color: "#9aa3b0",
  margin: "10px 0 3px",
};
const inp: React.CSSProperties = {
  width: "100%",
  background: "#1b1f26",
  border: "1px solid #2a2f38",
  borderRadius: 5,
  color: "#e6e9ee",
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
};

const VISUAL_TYPES: Visual["type"][] = [
  "callout",
  "bar",
  "title",
  "checklist",
  "panel",
  "compare",
  "stat",
];

export const Inspector: React.FC<Props> = ({ props, selection, onPatch }) => {
  const item = getItem(props, selection);
  if (!selection || !item) {
    return (
      <div style={{ padding: 14, color: "#6b7280", fontSize: 13 }}>
        在畫面或時間軸點選一個字幕 / 視覺來編輯。
      </div>
    );
  }

  const isSub = selection.kind === "subtitle";
  const v = item as Visual;
  const layout = (item as { layout?: { x: number; y: number; scale: number } })
    .layout ?? { x: 0, y: 0, scale: 1 };

  const num = (val: number, key: string, step = 0.1) => (
    <input
      type="number"
      step={step}
      value={val}
      style={inp}
      onChange={(e) => onPatch({ [key]: Number(e.target.value) })}
    />
  );

  return (
    <div style={{ padding: 14, overflowY: "auto" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#cdd3dc" }}>
        {isSub ? "字幕" : `視覺 · ${v.type}`}
        <span style={{ color: "#6b7280", fontWeight: 400 }}>
          {" "}
          #{selection.index}
        </span>
      </div>

      {/* 時間 */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>開始 (秒)</div>
          {num(item.start, "start")}
        </div>
        <div style={{ flex: 1 }}>
          <div style={lbl}>結束 (秒)</div>
          {num(item.end, "end")}
        </div>
      </div>

      {/* 速度 */}
      <div style={lbl}>播放速度 (speed)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={(item as { speed?: number }).speed ?? 1}
          style={{ flex: 1, accentColor: "#6B7F99" }}
          onChange={(e) => onPatch({ speed: Number(e.target.value) })}
        />
        <span style={{ fontSize: 12, color: "#cdd3dc", minWidth: 36, textAlign: "right" }}>
          {((item as { speed?: number }).speed ?? 1).toFixed(2)}×
        </span>
        <button
          style={{ ...inp, width: "auto", padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#9aa3b0" }}
          onClick={() => onPatch({ speed: 1 })}
        >
          重設
        </button>
      </div>

      {/* 版位 */}
      <div style={lbl}>版位 (位移 px / 縮放)</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          value={layout.x}
          style={inp}
          title="X 位移"
          onChange={(e) =>
            onPatch({ layout: { ...layout, x: Number(e.target.value) } })
          }
        />
        <input
          type="number"
          value={layout.y}
          style={inp}
          title="Y 位移"
          onChange={(e) =>
            onPatch({ layout: { ...layout, y: Number(e.target.value) } })
          }
        />
        <input
          type="number"
          step={0.05}
          value={layout.scale}
          style={inp}
          title="縮放"
          onChange={(e) =>
            onPatch({ layout: { ...layout, scale: Number(e.target.value) } })
          }
        />
      </div>
      <button
        style={{
          ...inp,
          marginTop: 6,
          cursor: "pointer",
          color: "#9aa3b0",
          width: "auto",
          padding: "4px 10px",
        }}
        onClick={() => onPatch({ layout: { x: 0, y: 0, scale: 1 } })}
      >
        重設版位
      </button>

      {/* 內容 */}
      {isSub ? (
        <>
          <div style={lbl}>字幕文字</div>
          <textarea
            value={item.text}
            rows={2}
            style={{ ...inp, resize: "vertical" }}
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </>
      ) : (
        <VisualFields v={v} onPatch={onPatch} />
      )}
    </div>
  );
};

const VisualFields: React.FC<{
  v: Visual;
  onPatch: (p: Record<string, unknown>) => void;
}> = ({ v, onPatch }) => {
  return (
    <>
      <div style={lbl}>類型</div>
      <select
        value={v.type}
        style={inp}
        onChange={(e) => onPatch({ type: e.target.value })}
      >
        {VISUAL_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {["callout", "title", "panel", "checklist", "compare", "bar"].includes(
        v.type
      ) && (
        <>
          <div style={lbl}>標題</div>
          <input
            style={inp}
            value={v.title ?? ""}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </>
      )}

      {["callout", "title"].includes(v.type) && (
        <>
          <div style={lbl}>副標</div>
          <input
            style={inp}
            value={v.subtitle ?? ""}
            onChange={(e) => onPatch({ subtitle: e.target.value })}
          />
        </>
      )}

      {v.type === "stat" && (
        <>
          <div style={lbl}>數值 / 大字</div>
          <input
            style={inp}
            value={v.value ?? ""}
            onChange={(e) => onPatch({ value: e.target.value })}
          />
        </>
      )}

      {v.type === "bar" && (
        <>
          <div style={lbl}>位置</div>
          <select
            style={inp}
            value={v.position ?? "right"}
            onChange={(e) => onPatch({ position: e.target.value })}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
          <div style={lbl}>資料 (每行: 標籤,數值)</div>
          <textarea
            rows={4}
            style={{ ...inp, resize: "vertical" }}
            value={(v.data ?? [])
              .map((d) => `${d.label},${d.value}`)
              .join("\n")}
            onChange={(e) =>
              onPatch({
                data: e.target.value
                  .split("\n")
                  .map((line) => line.split(","))
                  .filter((p) => p[0]?.trim())
                  .map((p) => ({
                    label: (p[0] ?? "").trim(),
                    value: Number(p[1] ?? 0) || 0,
                  })),
              })
            }
          />
        </>
      )}

      {["checklist", "panel"].includes(v.type) && (
        <>
          <div style={lbl}>項目 (每行一條)</div>
          <textarea
            rows={5}
            style={{ ...inp, resize: "vertical" }}
            value={(v.items ?? []).join("\n")}
            onChange={(e) =>
              onPatch({
                items: e.target.value
                  .split("\n")
                  .filter((l) => l.trim()),
              })
            }
          />
        </>
      )}

      {v.type === "compare" && (
        <>
          <div style={lbl}>兩欄對比 (JSON)</div>
          <JsonField
            value={v.columns ?? []}
            onChange={(val) => onPatch({ columns: val })}
          />
        </>
      )}

      {["callout", "title", "checklist", "panel", "compare", "stat"].includes(
        v.type
      ) && (
        <>
          <div style={lbl}>強調色 accent (#hex)</div>
          <input
            style={inp}
            value={v.accent ?? ""}
            placeholder="#6B7F99"
            onChange={(e) => onPatch({ accent: e.target.value })}
          />
        </>
      )}
    </>
  );
};

/** 複雜結構(compare columns)的 JSON 編輯框,只有合法 JSON 才送出。 */
const JsonField: React.FC<{
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ value, onChange }) => {
  const [text, setText] = React.useState(JSON.stringify(value, null, 2));
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [JSON.stringify(value)]);
  return (
    <>
      <textarea
        rows={8}
        style={{
          ...inp,
          resize: "vertical",
          fontFamily: "monospace",
          borderColor: err ? "#e2574c" : "#2a2f38",
        }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            setErr(false);
            onChange(parsed);
          } catch {
            setErr(true);
          }
        }}
      />
      {err && (
        <div style={{ color: "#e2574c", fontSize: 11 }}>JSON 格式錯誤,尚未套用</div>
      )}
    </>
  );
};
