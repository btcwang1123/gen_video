import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/** 結尾功能總覽:標題 + 逐項打勾浮現的清單,置中卡片。 */
export const Checklist: React.FC<{
  title: string;
  items: string[];
  accent?: string;
}> = ({ title, items, accent = "#10b981" }) => {
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

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.55)",
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          background: "rgba(17,24,39,0.95)",
          borderRadius: 18,
          padding: "30px 42px",
          minWidth: 460,
          boxShadow: "0 16px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 34,
            fontWeight: 900,
            marginBottom: 22,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        {items.map((item, i) => {
          // 每項依序浮現
          const p = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 200 } });
          const itemOpacity = interpolate(p, [0, 1], [0, 1]);
          const x = interpolate(p, [0, 1], [-20, 0]);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 14,
                opacity: itemOpacity,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: accent,
                  color: "white",
                  fontSize: 18,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <span style={{ color: "#e5e7eb", fontSize: 24 }}>{item}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
