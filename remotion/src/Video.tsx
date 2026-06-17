import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Subtitle } from "./Subtitles";
import { BarChart } from "./BarChart";
import { Callout } from "./Callout";
import { TitleCard } from "./TitleCard";
import { Checklist } from "./Checklist";
import { InfoPanel } from "./InfoPanel";
import { Comparison } from "./Comparison";
import { BigStat } from "./BigStat";
import { ChapterTransition } from "./ChapterTransition";
import { COLORS } from "./theme";
import { FinalCutProps } from "./schema";

// 型別定義集中在 schema.ts(同時供 Remotion Studio 產生編輯表單)
export type { FinalCutProps, SubtitleCue, Visual, Chapter } from "./schema";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

const sec = (s: number, fps: number) => Math.round(s * fps);

// 出現時要讓背景影片模糊聚焦的「全螢幕/中央」元件類型
const FOCUS_TYPES = new Set(["title", "panel", "compare", "stat", "checklist"]);
const BLUR_MAX = 7; // 模糊強度(px)
const BLUR_RAMP = 8; // 進出場漸變的 frame 數

/**
 * 算出目前 frame 該套用多少背景模糊:
 * 只要落在任一「聚焦視窗」(全螢幕元件 / 章節過場)內就模糊,邊緣平滑漸入漸出。
 */
const computeBlur = (frame: number, windows: [number, number][]) => {
  let blur = 0;
  for (const [a, b] of windows) {
    if (frame < a || frame > b) continue;
    const rampIn = interpolate(frame, [a, a + BLUR_RAMP], [0, BLUR_MAX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const rampOut = interpolate(frame, [b - BLUR_RAMP, b], [BLUR_MAX, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    blur = Math.max(blur, Math.min(rampIn, rampOut));
  }
  return blur;
};

/**
 * 章節進度條(底部):每個章節一段,段上方顯示章節標題,
 * 目前章節高亮、字體放大,該段內顯示播放進度。
 */
const ChapterBar: React.FC<{
  chapters: { start: number; title: string }[];
  accent?: string;
}> = ({ chapters, accent = COLORS.accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const total = Math.max(1, durationInFrames);

  // 沒有章節時退回單一進度條
  const segs =
    chapters.length > 0
      ? chapters.map((c, i) => ({
          title: c.title,
          startF: Math.round(c.start * fps),
          endF:
            i + 1 < chapters.length
              ? Math.round(chapters[i + 1].start * fps)
              : total,
        }))
      : [{ title: "", startF: 0, endF: total }];

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          padding: "0 14px 12px",
          fontFamily: FONT_FAMILY,
        }}
      >
        {segs.map((s, i) => {
          const active = frame >= s.startF && frame < s.endF;
          const done = frame >= s.endF;
          const span = Math.max(1, s.endF - s.startF);
          const fillPct = done
            ? 100
            : active
              ? ((frame - s.startF) / span) * 100
              : 0;
          const widthPct = (span / total) * 100;
          return (
            <div
              key={i}
              style={{
                width: `${widthPct}%`,
                minWidth: 0,
                position: "relative",
                height: 40,
                borderRadius: 9,
                overflow: "hidden",
                boxSizing: "border-box",
                background: "rgba(0,0,0,0.55)",
                border: active
                  ? `2px solid ${accent}`
                  : "2px solid rgba(255,255,255,0.18)",
              }}
            >
              {/* 進度填色(在文字底下) */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${fillPct}%`,
                  background: done ? "rgba(255,255,255,0.30)" : accent,
                }}
              />
              {/* 章節標題:顯示在色條「裡面」置中 */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 8px",
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    fontSize: active ? 20 : 17,
                    fontWeight: active ? 900 : 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textShadow: "0 1px 4px rgba(0,0,0,0.95)",
                    opacity: active || done ? 1 : 0.8,
                  }}
                >
                  {s.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 右上角品牌浮水印。 */
const Watermark: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-end" }}>
    <div
      style={{
        margin: "16px 20px 0 0",
        padding: "6px 14px",
        background: "rgba(0,0,0,0.35)",
        borderRadius: 8,
        color: "rgba(255,255,255,0.85)",
        fontSize: 18,
        fontWeight: 700,
        fontFamily: FONT_FAMILY,
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);

export const FinalCutVideo: React.FC<FinalCutProps> = ({
  videoSrc,
  subtitles,
  visuals,
  chapters = [],
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // 聚焦視窗:全螢幕元件 + 章節過場(第一章略過),背景影片在這些時段稍微模糊
  const focusWindows: [number, number][] = [];
  visuals.forEach((v) => {
    if (FOCUS_TYPES.has(v.type))
      focusWindows.push([sec(v.start, fps), sec(v.end, fps)]);
  });
  chapters.forEach((c, i) => {
    if (i > 0) focusWindows.push([sec(c.start, fps), sec(c.start + 2, fps)]);
  });
  const blur = computeBlur(frame, focusWindows);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* 影片外框:留邊 + 圓角 + 細邊框 + 柔陰影(聚焦元件出現時影片稍微模糊) */}
      <AbsoluteFill style={{ padding: "1.8%" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 12px 48px rgba(0,0,0,0.55)",
          }}
        >
          <OffthreadVideo
            src={staticFile(videoSrc)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* 全程元素:浮水印 + 章節進度條 */}
      <Watermark text="停車百寶袋" />
      <ChapterBar chapters={chapters} />

      {/* 字幕:每句在自己的時間區間出現 */}
      {subtitles.map((cue, i) => (
        <Sequence
          key={`sub-${i}`}
          from={sec(cue.start, fps)}
          durationInFrames={Math.max(1, sec(cue.end - cue.start, fps))}
        >
          <Subtitle text={cue.text} />
        </Sequence>
      ))}

      {/* 章節過場卡:每章開頭跳出 2 秒(第一章交給開場標題卡,故略過) */}
      {chapters.map((ch, i) =>
        i === 0 ? null : (
          <Sequence
            key={`ch-${i}`}
            from={sec(ch.start, fps)}
            durationInFrames={sec(2, fps)}
          >
            <ChapterTransition index={i + 1} title={ch.title} />
          </Sequence>
        )
      )}

      {/* 視覺化元件:各自照時間區間出現 */}
      {visuals.map((v, i) => (
        <Sequence
          key={`vis-${i}`}
          from={sec(v.start, fps)}
          durationInFrames={Math.max(1, sec(v.end - v.start, fps))}
        >
          {v.type === "bar" ? (
            <BarChart
              title={v.title}
              data={v.data ?? []}
              position={v.position ?? "right"}
            />
          ) : v.type === "callout" ? (
            <Callout title={v.title ?? ""} subtitle={v.subtitle} accent={v.accent} />
          ) : v.type === "title" ? (
            <TitleCard title={v.title ?? ""} subtitle={v.subtitle} accent={v.accent} />
          ) : v.type === "checklist" ? (
            <Checklist title={v.title ?? ""} items={v.items ?? []} accent={v.accent} />
          ) : v.type === "panel" ? (
            <InfoPanel title={v.title ?? ""} items={v.items ?? []} accent={v.accent} />
          ) : v.type === "compare" ? (
            <Comparison title={v.title} columns={v.columns ?? []} accent={v.accent} />
          ) : v.type === "stat" ? (
            <BigStat value={v.value ?? ""} title={v.title} accent={v.accent} />
          ) : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
