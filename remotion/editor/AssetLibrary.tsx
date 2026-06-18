import React, { useState } from "react";
import type { Visual } from "../src/schema";

interface Props {
  onAddVisual: (v: Visual) => void;
}

type Tab = "visuals" | "transitions";

// Visual type presets
const VISUAL_PRESETS: Array<{ emoji: string; label: string; v: Partial<Visual> }> = [
  { emoji: "🏷", label: "標題卡", v: { type: "title", title: "標題", subtitle: "副標" } },
  { emoji: "💬", label: "說明框", v: { type: "callout", title: "說明文字" } },
  { emoji: "📊", label: "長條圖", v: { type: "bar", title: "數據", position: "right", data: [{ label: "A", value: 80 }, { label: "B", value: 60 }, { label: "C", value: 40 }] } },
  { emoji: "📋", label: "資訊板", v: { type: "panel", title: "重點", items: ["項目一", "項目二", "項目三"] } },
  { emoji: "✅", label: "功能清單", v: { type: "checklist", title: "功能總覽", items: ["功能一", "功能二", "功能三"] } },
  { emoji: "⚖️", label: "比較表", v: { type: "compare", title: "比較", columns: [{ title: "A", items: ["優點一"] }, { title: "B", items: ["優點二"] }] } },
  { emoji: "💯", label: "大數字", v: { type: "stat", value: "99%", title: "滿意度" } },
];

// Transition-style visuals (enter effects stored as accent hint)
const TRANSITION_PRESETS: Array<{ emoji: string; label: string; desc: string; v: Partial<Visual> }> = [
  { emoji: "🌅", label: "標題淡入", desc: "開場白底標題淡入", v: { type: "title", title: "開場標題", accent: "#6B7F99" } },
  { emoji: "▶️", label: "章節過場", desc: "章節切換用橫條", v: { type: "callout", title: "第一章：開始", accent: "#7C9885" } },
  { emoji: "📌", label: "左上提示", desc: "左上角浮動說明", v: { type: "callout", title: "重點提示", accent: "#A78A7F" } },
  { emoji: "🖼", label: "中央公告", desc: "全螢幕資訊板", v: { type: "panel", title: "重要公告", items: ["說明文字"], accent: "#8A8FA8" } },
];

const ACCENT_PALETTE = ["#6B7F99", "#7C9885", "#A78A7F", "#8A8FA8", "#9AA67C"];

const card: React.CSSProperties = {
  border: "1px solid #2a2f38",
  borderRadius: 6,
  padding: "8px 10px",
  cursor: "pointer",
  background: "#1b1f26",
  marginBottom: 6,
  transition: "background 0.15s",
};

export const AssetLibrary: React.FC<Props> = ({ onAddVisual }) => {
  const [tab, setTab] = useState<Tab>("visuals");
  const [accentIdx, setAccentIdx] = useState(0);

  const accent = ACCENT_PALETTE[accentIdx];

  const addPreset = (partial: Partial<Visual>) => {
    const v: Visual = {
      type: partial.type ?? "callout",
      start: 0,
      end: 4,
      accent,
      ...partial,
    } as Visual;
    onAddVisual(v);
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#cdd3dc", marginBottom: 8 }}>
        素材庫
      </div>

      {/* tab */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["visuals", "transitions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "4px 0",
              fontSize: 11,
              border: "1px solid #2a2f38",
              borderRadius: 4,
              background: tab === t ? "#283041" : "#1b1f26",
              color: tab === t ? "#e6e9ee" : "#6b7280",
              cursor: "pointer",
            }}
          >
            {t === "visuals" ? "視覺元件" : "轉場 / 動畫"}
          </button>
        ))}
      </div>

      {/* accent color picker */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>強調色</div>
        <div style={{ display: "flex", gap: 5 }}>
          {ACCENT_PALETTE.map((c, i) => (
            <div
              key={c}
              onClick={() => setAccentIdx(i)}
              style={{
                width: 20, height: 20, borderRadius: 4,
                background: c,
                cursor: "pointer",
                border: i === accentIdx ? "2px solid #fff" : "2px solid transparent",
              }}
            />
          ))}
        </div>
      </div>

      {tab === "visuals" ? (
        <>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
            點擊 → 在播放頭位置新增（預設 4 秒）
          </div>
          {VISUAL_PRESETS.map((p) => (
            <div
              key={p.label}
              style={card}
              onClick={() => addPreset(p.v)}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#252c38")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#1b1f26")}
            >
              <span style={{ marginRight: 8 }}>{p.emoji}</span>
              <span style={{ fontSize: 12, color: "#cdd3dc" }}>{p.label}</span>
              <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 6 }}>
                {p.v.type}
              </span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
            點擊 → 在播放頭位置新增轉場元件
          </div>
          {TRANSITION_PRESETS.map((p) => (
            <div
              key={p.label}
              style={card}
              onClick={() => addPreset(p.v)}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#252c38")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#1b1f26")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{p.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, color: "#cdd3dc" }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{p.desc}</div>
                </div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: 10, background: "#1a1e26", borderRadius: 6, border: "1px solid #2a2f38" }}>
            <div style={{ fontSize: 11, color: "#9aa3b0", marginBottom: 4 }}>提示</div>
            <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.5 }}>
              真正的影片轉場（淡出淡入、推拉）需要透過 ffmpeg 後製合成，
              目前這些元件是視覺卡片型轉場，可在 Remotion 中即時預覽。
            </div>
          </div>
        </>
      )}
    </div>
  );
};
