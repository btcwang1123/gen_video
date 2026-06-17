import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { PALETTE } from "./theme";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

type Datum = { label: string; value: number };

/** 卡片式長條圖,長條會「生長」動畫,整體淡入。 */
export const BarChart: React.FC<{
  title?: string;
  data: Datum[];
  position: "left" | "right" | "center";
}> = ({ title, data, position }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(appear, [0, 1], [0, 1]);
  const slide = interpolate(appear, [0, 1], [40, 0]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const justify =
    position === "left"
      ? "flex-start"
      : position === "center"
        ? "center"
        : "flex-end";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: justify,
        padding: "4%",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateX(${position === "left" ? -slide : slide}px)`,
          width: "38%",
          minWidth: 360,
          background: "rgba(17,24,39,0.92)",
          borderRadius: 16,
          padding: "24px 28px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          fontFamily: FONT_FAMILY,
        }}
      >
        {title ? (
          <div
            style={{
              color: "white",
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 18,
            }}
          >
            {title}
          </div>
        ) : null}

        {data.map((d, i) => {
          // 每根長條依序生長
          const barProgress = spring({
            frame: frame - 6 - i * 4,
            fps,
            config: { damping: 200 },
          });
          const widthPct = interpolate(
            barProgress,
            [0, 1],
            [0, (d.value / maxValue) * 100],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#e5e7eb",
                  fontSize: 20,
                  marginBottom: 6,
                }}
              >
                <span>{d.label}</span>
                <span style={{ fontWeight: 700 }}>{d.value}</span>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  height: 22,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    borderRadius: 8,
                    background: PALETTE[i % PALETTE.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
