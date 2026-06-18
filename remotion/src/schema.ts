import { z } from "zod";

/**
 * composition 的欄位定義。
 * 有了這個 schema,Remotion Studio 右側的 Props 面板會變成「表單編輯器」,
 * 可以直接在網頁裡逐欄修改字幕與字卡,並即時預覽。
 */

/**
 * 版位覆寫:由網頁編輯器(拖拉/縮放)寫入。
 * x/y 是相對「元件原本版位」的位移(以合成畫布像素為單位),scale 是縮放倍率。
 * 省略時元件維持自身預設版位(向後相容舊 props.json)。
 */
export const layoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
});

export const subtitleSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
  layout: layoutSchema.optional(),
  speed: z.number().optional(), // playback speed multiplier (1 = normal)
});

export const visualSchema = z.object({
  type: z.enum([
    "bar",
    "callout",
    "title",
    "checklist",
    "panel", // 中央 2/3 重點資訊大圖板
    "compare", // 左右比較表
    "stat", // 大數字強調
  ]),
  start: z.number(),
  end: z.number(),
  title: z.string().optional(),
  // callout / title 用
  subtitle: z.string().optional(),
  accent: z.string().optional(),
  // bar 用
  position: z.enum(["left", "right", "center"]).optional(),
  data: z
    .array(z.object({ label: z.string(), value: z.number() }))
    .optional(),
  // checklist / panel 用(條列項目)
  items: z.array(z.string()).optional(),
  // stat 用(放大的數字/字串)
  value: z.string().optional(),
  // compare 用(兩欄對比)
  columns: z
    .array(z.object({ title: z.string(), items: z.array(z.string()) }))
    .optional(),
  // 版位覆寫(網頁編輯器拖拉/縮放寫入)
  layout: layoutSchema.optional(),
  speed: z.number().optional(), // animation speed multiplier (1 = normal)
});

// 章節:進度條會標出分隔點,並在每章開頭跳出過場卡
export const chapterSchema = z.object({
  start: z.number(),
  title: z.string(),
});

// 章節目錄卡:開場標題卡後跳出、暫停影片數秒,列出所有章節
export const chapterMenuSchema = z.object({
  at: z.number(), // 出現時間(秒,= 標題卡結束)
  duration: z.number(), // 暫停秒數
  items: z.array(z.object({ index: z.number(), title: z.string() })),
});

export const finalCutSchema = z.object({
  videoSrc: z.string(),
  fps: z.number(),
  durationInSeconds: z.number(),
  width: z.number(),
  height: z.number(),
  subtitles: z.array(subtitleSchema),
  visuals: z.array(visualSchema),
  chapters: z.array(chapterSchema).optional(),
  chapterMenu: chapterMenuSchema.optional(),
});

export type FinalCutProps = z.infer<typeof finalCutSchema>;
export type SubtitleCue = z.infer<typeof subtitleSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type ChapterMenu = z.infer<typeof chapterMenuSchema>;
export type Layout = z.infer<typeof layoutSchema>;
