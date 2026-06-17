import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/** 開場標題卡:置中、半透明深色底,標題放大淡入,副標隨後浮現。 */
export const TitleCard: React.FC<{
  title: string;
  subtitle?: string;
  accent?: string;
}> = ({ title, subtitle, accent = "#3b82f6" }) => {
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
  const scale = interpolate(enter, [0, 1], [0.85, 1]);

  const subOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.45)",
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div
          style={{
            width: 70,
            height: 6,
            background: accent,
            borderRadius: 3,
            margin: "0 auto 22px",
          }}
        />
        <div style={{ color: "white", fontSize: 64, fontWeight: 900, letterSpacing: 2 }}>
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              color: "#e5e7eb",
              fontSize: 26,
              marginTop: 14,
              opacity: subOpacity,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
