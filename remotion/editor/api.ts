import type { FinalCutProps } from "../src/schema";

export interface RunInfo {
  id: string;
  videoSrc: string;
  durationInSeconds: number;
  subtitleCount: number;
  visualCount: number;
  hasOutput: boolean;
  mtime: number;
}

export interface RenderStatus {
  state: "idle" | "queued" | "rendering" | "done" | "error";
  message: string;
}

export async function fetchRuns(): Promise<RunInfo[]> {
  const r = await fetch("/api/runs");
  if (!r.ok) throw new Error("無法取得 runs");
  return r.json();
}

export async function fetchProps(run: string): Promise<FinalCutProps> {
  const r = await fetch(`/api/props?run=${encodeURIComponent(run)}`);
  if (!r.ok) throw new Error("無法取得 props");
  return r.json();
}

export async function saveProps(
  run: string,
  props: FinalCutProps
): Promise<void> {
  const r = await fetch(`/api/props?run=${encodeURIComponent(run)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(props),
  });
  if (!r.ok) throw new Error("存檔失敗");
}

/** 編輯器預覽用的影片串流 URL(由 FastAPI 提供,支援 Range)。 */
export function videoUrl(run: string): string {
  return `/api/video?run=${encodeURIComponent(run)}`;
}

export async function startRender(
  run: string,
  frames?: string
): Promise<void> {
  const q = new URLSearchParams({ run });
  if (frames) q.set("frames", frames);
  await fetch(`/api/render?${q.toString()}`, { method: "POST" });
}

export async function renderStatus(run: string): Promise<RenderStatus> {
  const r = await fetch(`/api/render?run=${encodeURIComponent(run)}`);
  return r.json();
}
