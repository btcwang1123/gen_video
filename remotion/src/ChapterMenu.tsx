import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, PALETTE } from "./theme";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/**
 * 章節目錄卡:開場標題卡消失後跳出,列出整部影片所有章節
 * (數字 + 標題),並停留數秒,讓觀眾先看到全貌、決定要跳到哪一段。
 */
export const ChapterMenu: React.FC<{
  items: { index: number; title: string }[];
}> = ({ items }) => {
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
        background: "rgba(0,0,0,0.62)",
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ width: "78%", maxWidth: 1100, maxHeight: "92%" }}>
        <div
          style={{
            color: "white",
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 4,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          本片章節
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {items.map((it, i) => {
            // 入場時逐列浮現
            const rowIn = interpolate(
              frame,
              [4 + i * 3, 14 + i * 3],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const color = PALETTE[i % PALETTE.length];
            return (
              <div
                key={it.index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: rowIn,
                  transform: `translateX(${interpolate(rowIn, [0, 1], [-20, 0])}px)`,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "6px 16px",
                  borderLeft: `4px solid ${color}`,
                }}
              >
                <div
                  style={{
                    flex: "0 0 auto",
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: color,
                    color: "#fff",
                    fontSize: 21,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {it.index}
                </div>
                <div
                  style={{
                    color: "#f3f4f6",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {it.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
