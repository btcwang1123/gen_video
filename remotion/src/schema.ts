import { z } from "zod";

/**
 * composition 的欄位定義。
 * 有了這個 schema,Remotion Studio 右側的 Props 面板會變成「表單編輯器」,
 * 可以直接在網頁裡逐欄修改字幕與字卡,並即時預覽。
 */

export const subtitleSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
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
});

// 章節:進度條會標出分隔點,並在每章開頭跳出過場卡
export const chapterSchema = z.object({
  start: z.number(),
  title: z.string(),
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
});

export type FinalCutProps = z.infer<typeof finalCutSchema>;
export type SubtitleCue = z.infer<typeof subtitleSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
