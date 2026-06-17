import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

type Column = { title: string; items: string[] };

/** 左右比較表:兩欄並排對比,中間一個 VS。 */
export const Comparison: React.FC<{
  title?: string;
  columns: Column[];
  accent?: string;
}> = ({ title, columns, accent = "#3b82f6" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(enter, [0, 1], [0, 1]) * exit;

  const colColors = [accent, "#f59e0b"];
  const left = columns[0] ?? { title: "", items: [] };
  const right = columns[1] ?? { title: "", items: [] };

  const renderCol = (col: Column, idx: number) => {
    const slide = interpolate(enter, [0, 1], [idx === 0 ? -40 : 40, 0]);
    return (
      <div
        style={{
          flex: 1,
          transform: `translateX(${slide}px)`,
          background: "rgba(17,24,39,0.95)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            background: colColors[idx % colColors.length],
            color: "white",
            fontSize: 30,
            fontWeight: 900,
            padding: "16px 22px",
            textAlign: "center",
          }}
        >
          {col.title}
        </div>
        <div style={{ padding: "22px 26px" }}>
          {col.items.map((item, i) => (
            <div
              key={i}
              style={{
                color: "#e5e7eb",
                fontSize: 24,
                marginBottom: 14,
                lineHeight: 1.35,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.45)",
        opacity,
        fontFamily: FONT_FAMILY,
        flexDirection: "column",
      }}
    >
      {title ? (
        <div style={{ color: "white", fontSize: 40, fontWeight: 900, marginBottom: 26 }}>
          {title}
        </div>
      ) : null}
      <div
        style={{
          width: "80%",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        {renderCol(left, 0)}
        <div style={{ color: "white", fontSize: 34, fontWeight: 900, opacity: 0.85 }}>
          VS
        </div>
        {renderCol(right, 1)}
      </div>
    </AbsoluteFill>
  );
};
