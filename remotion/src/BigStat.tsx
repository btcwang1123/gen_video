import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/** 大數字強調:滿版置中,放大一個關鍵數字/字串 + 說明文字。 */
export const BigStat: React.FC<{
  value: string;
  title?: string;
  accent?: string;
}> = ({ value, title, accent = "#3b82f6" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(enter, [0, 1], [0, 1]) * exit;
  const scale = interpolate(enter, [0, 1], [0.6, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.5)",
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
        <div
          style={{
            color: accent,
            fontSize: 140,
            fontWeight: 900,
            lineHeight: 1,
            textShadow: "0 6px 24px rgba(0,0,0,0.5)",
          }}
        >
          {value}
        </div>
        {title ? (
          <div style={{ color: "white", fontSize: 36, fontWeight: 700, marginTop: 18 }}>
            {title}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
