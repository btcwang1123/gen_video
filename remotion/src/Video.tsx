import {
  AbsoluteFill,
  Freeze,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Subtitle } from "./Subtitles";
import { ChapterMenu } from "./ChapterMenu";
import { BarChart } from "./BarChart";
import { Callout } from "./Callout";
import { TitleCard } from "./TitleCard";
import { Checklist } from "./Checklist";
import { InfoPanel } from "./InfoPanel";
import { Comparison } from "./Comparison";
import { BigStat } from "./BigStat";
import { ChapterTransition } from "./ChapterTransition";
import { COLORS } from "./theme";
import { FinalCutProps, Layout } from "./schema";

// 型別定義集中在 schema.ts(同時供 Remotion Studio 產生編輯表單)
export type { FinalCutProps, SubtitleCue, Visual, Chapter } from "./schema";

const FONT_FAMILY =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

const sec = (s: number, fps: number) => Math.round(s * fps);

/**
 * 影片來源解析:算圖時 videoSrc 是 public/ 內的檔名(走 staticFile);
 * 網頁編輯器預覽時會傳完整 http(s) URL(由 FastAPI 串流),直接採用。
 */
const resolveVideoSrc = (src: string) =>
  /^https?:\/\//.test(src) || src.startsWith("/") ? src : staticFile(src);

/**
 * 版位層:把字幕/視覺元件依編輯器設定的位移(x,y px)與縮放(scale)整體平移縮放。
 * layout 省略時直接渲染原元件(維持其預設版位,向後相容)。
 */
const Layer: React.FC<{ layout?: Layout; children: React.ReactNode }> = ({
  layout,
  children,
}) => {
  if (!layout) return <>{children}</>;
  const { x = 0, y = 0, scale = 1 } = layout;
  return (
    <AbsoluteFill
      style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
    >
      {children}
    </AbsoluteFill>
  );
};

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

/** 一台簡約小車的 SVG(車身用主色,輪子會轉)。 */
const Car: React.FC<{ accent: string; wheelSpin: number }> = ({
  accent,
  wheelSpin,
}) => (
  <svg
    width="46"
    height="26"
    viewBox="0 0 46 26"
    style={{
      display: "block",
      overflow: "visible",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))",
    }}
  >
    {/* 車身下半 */}
    <rect x="2" y="11" width="42" height="9" rx="4.5" fill={accent} />
    {/* 駕駛艙 */}
    <path d="M11 12 L15 4 Q16 3 18 3 L28 3 Q30 3 31 5 L34 12 Z" fill={accent} />
    {/* 車窗 */}
    <path d="M16 5 L22 5 L22 11 L13.5 11 Z" fill="rgba(255,255,255,0.85)" />
    <path d="M24 5 L27.5 5 L30 11 L24 11 Z" fill="rgba(255,255,255,0.85)" />
    {/* 車頭燈 */}
    <circle cx="42" cy="15" r="1.4" fill="#FFE9A8" />
    {/* 輪子(會轉) */}
    {[14, 33].map((cx) => (
      <g key={cx} transform={`rotate(${wheelSpin} ${cx} 20)`}>
        <circle
          cx={cx}
          cy="20"
          r="4.2"
          fill="#1C2026"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1.2"
        />
        <circle cx={cx} cy="20" r="1.3" fill="rgba(255,255,255,0.7)" />
        <line
          x1={cx}
          y1="16.2"
          x2={cx}
          y2="23.8"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="0.9"
        />
      </g>
    ))}
  </svg>
);

/**
 * 底部進度(小車版):一條路 + 一台小車。
 * 車子依整支影片播放進度從左慢慢開到右,並隨 frame 上下輕微晃動、車身微幅顛簸、
 * 輪子轉動,看起來像真的在行駛。章節變成路上的里程標(數字),車子開過後高亮。
 */
const CarProgress: React.FC<{
  chapters: { start: number; title: string }[];
  accent?: string;
}> = ({ chapters, accent = COLORS.accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const total = Math.max(1, durationInFrames);

  // 整支影片的播放進度 0~1
  const progress = Math.min(1, Math.max(0, frame / total));
  const progressPct = progress * 100;

  // 章節里程標(以時間比例定位在路上)
  const marks =
    chapters.length > 0
      ? chapters.map((c, i) => ({
          num: i + 1,
          pct: Math.min(100, Math.max(0, (sec(c.start, fps) / total) * 100)),
        }))
      : [];

  // 顛簸感:相位用 frame(跟進度無關,所以一直在抖)
  const bob = Math.sin(frame / 3) * 2.4; // 垂直晃動(px)
  const tilt = Math.sin(frame / 3 + 1) * 1.8; // 車身傾斜(deg)
  const wheelSpin = frame * 22; // 輪子轉動(deg)

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", pointerEvents: "none" }}>
      <div
        style={{
          position: "relative",
          height: 50,
          margin: "0 18px 12px",
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* 路面 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 6,
            height: 6,
            borderRadius: 3,
            background: "rgba(0,0,0,0.55)",
            overflow: "hidden",
          }}
        >
          {/* 已開過的路段上色 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progressPct}%`,
              background: accent,
              opacity: 0.7,
            }}
          />
        </div>

        {/* 章節里程標 */}
        {marks.map((m, i) => {
          const passed = progressPct >= m.pct - 0.2;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${m.pct}%`,
                bottom: 6,
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  marginBottom: 2,
                  fontSize: 11,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: passed ? "#fff" : "rgba(255,255,255,0.5)",
                  textShadow: "0 1px 3px rgba(0,0,0,0.95)",
                }}
              >
                {m.num}
              </span>
              <div
                style={{
                  width: 2,
                  height: 9,
                  borderRadius: 1,
                  background: passed ? accent : "rgba(255,255,255,0.3)",
                }}
              />
            </div>
          );
        })}

        {/* 小車:left 跟著進度,translateX 用自身寬度補償,讓車頭/車尾不貼邊 */}
        <div
          style={{
            position: "absolute",
            left: `${progressPct}%`,
            bottom: 9,
            transform: `translate(${-progressPct}%, ${bob}px) rotate(${tilt}deg)`,
            transformOrigin: "center bottom",
          }}
        >
          <Car accent={accent} wheelSpin={wheelSpin} />
        </div>
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
  chapterMenu,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // 章節目錄卡的暫停視窗(frame):影片在這段時間凍結,目錄卡蓋在上面
  const menuStartF = chapterMenu ? sec(chapterMenu.at, fps) : 0;
  const menuLenF = chapterMenu ? sec(chapterMenu.duration, fps) : 0;
  const menuEndF = menuStartF + menuLenF;

  // 聚焦視窗:全螢幕元件 + 章節過場(第一章略過)+ 章節目錄,背景影片在這些時段稍微模糊
  const focusWindows: [number, number][] = [];
  visuals.forEach((v) => {
    if (FOCUS_TYPES.has(v.type))
      focusWindows.push([sec(v.start, fps), sec(v.end, fps)]);
  });
  chapters.forEach((c, i) => {
    if (i > 0) focusWindows.push([sec(c.start, fps), sec(c.start + 2, fps)]);
  });
  if (chapterMenu) focusWindows.push([menuStartF, menuEndF]);
  const blur = computeBlur(frame, focusWindows);

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* 影片外框:留邊 + 圓角 + 細邊框 + 柔陰影(聚焦元件出現時影片稍微模糊) */}
      <AbsoluteFill style={{ padding: "1.8%" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 12px 48px rgba(0,0,0,0.55)",
          }}
        >
          {chapterMenu ? (
            // 章節目錄期間影片要「暫停」:播到 at → 凍結 menu 秒 → 從 at 繼續
            <>
              <Sequence from={0} durationInFrames={Math.max(1, menuStartF)}>
                <OffthreadVideo src={resolveVideoSrc(videoSrc)} style={videoStyle} />
              </Sequence>
              <Sequence from={menuStartF} durationInFrames={Math.max(1, menuLenF)}>
                <Freeze frame={menuStartF}>
                  <OffthreadVideo
                    src={resolveVideoSrc(videoSrc)}
                    muted
                    style={videoStyle}
                  />
                </Freeze>
              </Sequence>
              <Sequence from={menuEndF}>
                <OffthreadVideo
                  src={resolveVideoSrc(videoSrc)}
                  trimBefore={menuStartF}
                  style={videoStyle}
                />
              </Sequence>
            </>
          ) : (
            <OffthreadVideo src={resolveVideoSrc(videoSrc)} style={videoStyle} />
          )}
        </div>
      </AbsoluteFill>

      {/* 全程元素:浮水印 + 小車進度 */}
      <Watermark text="停車百寶袋" />
      <CarProgress chapters={chapters} />

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
          <Layer layout={v.layout}>
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
          </Layer>
        </Sequence>
      ))}

      {/* 章節目錄卡:開場標題卡消失後跳出、影片暫停,列出所有章節 */}
      {chapterMenu ? (
        <Sequence from={menuStartF} durationInFrames={Math.max(1, menuLenF)}>
          <ChapterMenu items={chapterMenu.items} />
        </Sequence>
      ) : null}

      {/* 字幕:每句在自己的時間區間出現,放在最上層,不會被字卡擋住 */}
      {subtitles.map((cue, i) => (
        <Sequence
          key={`sub-${i}`}
          from={sec(cue.start, fps)}
          durationInFrames={Math.max(1, sec(cue.end - cue.start, fps))}
        >
          <Layer layout={cue.layout}>
            <Subtitle text={cue.text} />
          </Layer>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
