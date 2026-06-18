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
        // 字幕位置往下一點(只留一點空間給變細的章節進度條)
        paddingBottom: "6%",
        // 字幕永遠在最上層,不會被字卡 / 圖表擋住
        zIndex: 100,
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
          // 一次只顯示一行(過長的句子已在後端切成多條字幕)
          whiteSpace: "nowrap",
          maxWidth: "92%",
          lineHeight: 1.3,
          padding: "8px 26px",
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
