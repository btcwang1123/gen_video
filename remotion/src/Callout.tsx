import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

/**
 * 重點字卡 / 下標標題條。放畫面上方,從左側滑入。
 * 適合「功能介紹」類影片:講到某功能時標註重點。
 */
export const Callout: React.FC<{
  title: string;
  subtitle?: string;
  accent?: string; // 左側色條顏色
}> = ({ title, subtitle, accent = "#3b82f6" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 進場:滑入 + 淡入
  const enter = spring({ frame, fps, config: { damping: 200 } });
  // 退場:結束前 8 frame 淡出
  const exit = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(enter, [0, 1], [0, 1]) * exit;
  const x = interpolate(enter, [0, 1], [-60, 0]);

  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-start", alignItems: "flex-start" }}
    >
      <div
        style={{
          opacity,
          transform: `translateX(${x}px)`,
          margin: "5% 0 0 4%",
          display: "flex",
          alignItems: "stretch",
          background: "rgba(17,24,39,0.9)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
          fontFamily: FONT_FAMILY,
          maxWidth: "60%",
        }}
      >
        <div style={{ width: 8, background: accent }} />
        <div style={{ padding: "14px 22px" }}>
          <div style={{ color: "white", fontSize: 30, fontWeight: 800 }}>
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                color: "#cbd5e1",
                fontSize: 20,
                marginTop: 4,
                lineHeight: 1.3,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
