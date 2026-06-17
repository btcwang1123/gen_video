import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/** 底部置中字幕,淡入。 */
export const Subtitle: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "10%", // 留空間給底部的章節進度條,避免重疊
      }}
    >
      <div
        style={{
          opacity,
          fontFamily: FONT_FAMILY,
          fontSize: 40,
          fontWeight: 700,
          color: "white",
          textAlign: "center",
          maxWidth: "85%",
          lineHeight: 1.3,
          padding: "10px 26px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.45)",
          textShadow: "0 2px 6px rgba(0,0,0,0.9)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
