import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/** 重點資訊大圖板:中央約 2/3 螢幕,標題 + 條列重點(逐項浮現)。 */
export const InfoPanel: React.FC<{
  title: string;
  items: string[];
  accent?: string;
}> = ({ title, items, accent = "#3b82f6" }) => {
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
  const scale = interpolate(enter, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.4)",
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          width: "66%",
          height: "66%",
          transform: `scale(${scale})`,
          background: "rgba(17,24,39,0.95)",
          borderRadius: 20,
          padding: "40px 56px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 10,
              height: 44,
              background: accent,
              borderRadius: 5,
              marginRight: 18,
            }}
          />
          <div style={{ color: "white", fontSize: 42, fontWeight: 900 }}>
            {title}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {items.map((item, i) => {
            const p = spring({ frame: frame - 10 - i * 6, fps, config: { damping: 200 } });
            const o = interpolate(p, [0, 1], [0, 1]);
            const x = interpolate(p, [0, 1], [-24, 0]);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: 20,
                  opacity: o,
                  transform: `translateX(${x}px)`,
                }}
              >
                <span style={{ color: accent, fontSize: 32, marginRight: 16, lineHeight: 1.2 }}>
                  ●
                </span>
                <span style={{ color: "#e5e7eb", fontSize: 30, lineHeight: 1.4 }}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
