import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "./theme";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/** 章節過場卡:進入新章節時短暫跳出「PART N · 章節名」。 */
export const ChapterTransition: React.FC<{
  index: number;
  title: string;
  accent?: string;
}> = ({ index, title, accent = COLORS.accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(enter, [0, 1], [0, 1]) * exit;
  // 底線從中間往兩側展開
  const lineWidth = interpolate(enter, [0, 1], [0, 220]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.6)",
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: accent,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 6,
            marginBottom: 14,
          }}
        >
          PART {index}
        </div>
        <div style={{ color: "white", fontSize: 56, fontWeight: 900 }}>{title}</div>
        <div
          style={{
            width: lineWidth,
            height: 4,
            background: accent,
            borderRadius: 2,
            margin: "20px auto 0",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
