"""finalCut 編輯器後端 (FastAPI)。

提供網頁時間軸編輯器所需的 API:
  GET  /api/runs              列出所有可編輯的 run(含 props.json 者)
  GET  /api/props?run=<id>    讀取某 run 的 props.json
  PUT  /api/props?run=<id>    存回 props.json(同時同步給 Remotion Studio 預覽)
  GET  /api/video?run=<id>    串流該 run 的來源影片(支援 Range,可拖時間軸)
  POST /api/render?run=<id>   觸發 Remotion 算圖(背景執行)
  GET  /api/render?run=<id>   查詢算圖狀態 / 進度

設計原則同 app.py:這層只是「介面之一」,core/ 完全不依賴它。
run-id 形如 `YYYY-MM-DD/HHmm_name`(含斜線),一律用查詢參數 ?run= 傳遞。
"""
from __future__ import annotations

import json
import sys
import threading
from pathlib import Path

# Windows 主控台預設 cp1252,印中文會 UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from config import WORK_DIR, REMOTION_DIR
from core.render import render

app = FastAPI(title="finalCut Editor API")

# 編輯器在 vite dev server(另一個埠)跑,開發階段全開 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── run-id 安全解析 ───────────────────────────

def resolve_run_dir(run: str) -> Path:
    """把 run-id 轉成 workspace 內的目錄,並擋掉路徑穿越。"""
    if not run:
        raise HTTPException(400, "缺少 run 參數")
    # 正規化並確認落在 WORK_DIR 內
    base = WORK_DIR.resolve()
    target = (base / run).resolve()
    if base not in target.parents and target != base:
        raise HTTPException(400, "非法的 run 路徑")
    if not target.is_dir():
        raise HTTPException(404, f"找不到 run: {run}")
    return target


# ── 列出 runs ────────────────────────────────

@app.get("/api/runs")
def list_runs() -> list[dict]:
    """列出 workspace 內所有含 props.json 的 run,新到舊排序。"""
    base = WORK_DIR.resolve()
    runs: list[dict] = []
    for props in base.rglob("props.json"):
        run_dir = props.parent
        run_id = run_dir.relative_to(base).as_posix()
        try:
            data = json.loads(props.read_text(encoding="utf-8"))
        except Exception:
            continue
        runs.append(
            {
                "id": run_id,
                "videoSrc": data.get("videoSrc"),
                "durationInSeconds": data.get("durationInSeconds"),
                "subtitleCount": len(data.get("subtitles", [])),
                "visualCount": len(data.get("visuals", [])),
                "hasOutput": (run_dir / "output.mp4").exists(),
                "mtime": props.stat().st_mtime,
            }
        )
    runs.sort(key=lambda r: r["id"], reverse=True)
    return runs


# ── 讀 / 存 props ────────────────────────────

@app.get("/api/props")
def get_props(run: str) -> JSONResponse:
    run_dir = resolve_run_dir(run)
    props_path = run_dir / "props.json"
    if not props_path.exists():
        raise HTTPException(404, "此 run 沒有 props.json")
    data = json.loads(props_path.read_text(encoding="utf-8"))
    return JSONResponse(data)


@app.put("/api/props")
async def put_props(run: str, request: Request) -> dict:
    """存回 props.json:寫回 run 目錄,並同步到 remotion/ 供 Studio 預覽。

    存回的 props.json 與 render pipeline 完全相容,可直接算圖。
    """
    run_dir = resolve_run_dir(run)
    data = await request.json()

    text = json.dumps(data, ensure_ascii=False, indent=2)
    (run_dir / "props.json").write_text(text, encoding="utf-8")
    # 同步給 Remotion Studio(defaultProps 讀 props.example.json)
    (REMOTION_DIR / "props.json").write_text(text, encoding="utf-8")
    (REMOTION_DIR / "props.example.json").write_text(text, encoding="utf-8")
    return {"ok": True, "run": run}


# ── 串流來源影片(支援 Range) ─────────────────

@app.get("/api/video")
def get_video(run: str) -> FileResponse:
    """回傳該 run 的來源影片。Starlette FileResponse 會自動處理 Range 請求,
    讓 @remotion/player 能任意 seek。"""
    run_dir = resolve_run_dir(run)
    props_path = run_dir / "props.json"
    if not props_path.exists():
        raise HTTPException(404, "此 run 沒有 props.json")
    data = json.loads(props_path.read_text(encoding="utf-8"))
    video_name = data.get("videoSrc")
    video_path = run_dir / video_name if video_name else None
    if not video_path or not video_path.is_file():
        raise HTTPException(404, f"找不到來源影片: {video_name}")
    return FileResponse(video_path, media_type="video/mp4")


# ── 算圖(背景執行 + 進度查詢) ────────────────

# run-id → {"state": queued|rendering|done|error, "message": str}
_render_jobs: dict[str, dict] = {}


def _do_render(run: str, run_dir: Path, frames: str | None) -> None:
    _render_jobs[run] = {"state": "rendering", "message": "算圖中…"}
    try:
        props_path = run_dir / "props.json"
        output_path = run_dir / "output.mp4"
        render(props_path, output_path, frames=frames)
        _render_jobs[run] = {"state": "done", "message": str(output_path)}
    except Exception as e:  # noqa: BLE001
        _render_jobs[run] = {"state": "error", "message": str(e)}


@app.post("/api/render")
def start_render(run: str, frames: str | None = None) -> dict:
    """觸發算圖(背景執行緒)。frames 可選,如 "0-150" 只算片段預覽。"""
    run_dir = resolve_run_dir(run)
    if _render_jobs.get(run, {}).get("state") == "rendering":
        return {"ok": False, "message": "已在算圖中"}
    _render_jobs[run] = {"state": "queued", "message": "排隊中…"}
    threading.Thread(
        target=_do_render, args=(run, run_dir, frames), daemon=True
    ).start()
    return {"ok": True, "run": run}


@app.get("/api/render")
def render_status(run: str) -> dict:
    return _render_jobs.get(run, {"state": "idle", "message": ""})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
