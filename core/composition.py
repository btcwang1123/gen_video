"""把字幕 + 視覺化規格組成 Remotion 要吃的 composition props(props.json)。

這是 Python 後端與 Remotion 算圖層之間的橋樑:
  - 探測來源影片的尺寸/fps/長度
  - 把影片複製進 remotion/public/(Remotion 的 staticFile 只認得 public/)
  - 產出 props.json

visuals 的格式(由 Claude 分析逐字稿後產生)範例:
  {"type": "bar", "start": 60.0, "end": 68.0, "title": "市場比較",
   "position": "right", "data": [{"label": "A", "value": 30}, ...]}
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from config import FFPROBE_BIN, REMOTION_DIR, REMOTION_PUBLIC
from core.subtitle import Segment, wrap_segments


# 字幕一行最多顯示的中文字數(超過就切到下一條字幕)
SUBTITLE_MAX_CHARS = 15
# 章節目錄卡停留秒數(開場標題卡消失後,影片暫停讓觀眾看章節)
CHAPTER_MENU_DURATION = 3.0


def _insert_chapter_menu(props: dict, menu_duration: float = CHAPTER_MENU_DURATION) -> None:
    """在開場標題卡消失後插入「章節目錄」:列出所有章節,並暫停影片數秒。

    作法:把標題卡之後的所有字幕/視覺/章節時間整體往後挪 menu_duration 秒,
    騰出一段空檔給目錄卡;Remotion 端會在這段空檔把影片畫面凍結(暫停)。
    需要有章節 + 開場 title 卡才會插入。
    """
    chapters = props.get("chapters") or []
    if not chapters:
        return
    title = next((v for v in props.get("visuals", []) if v.get("type") == "title"), None)
    if title is None:
        return

    at = float(title["end"])      # 目錄卡出現時間 = 標題卡結束時間
    dur = float(menu_duration)
    eps = 1e-6

    for s in props["subtitles"]:
        if s["start"] >= at - eps:
            s["start"] = round(s["start"] + dur, 3)
            s["end"] = round(s["end"] + dur, 3)
    for v in props["visuals"]:
        if v is title:
            continue
        if v["start"] >= at - eps:
            v["start"] = round(v["start"] + dur, 3)
            v["end"] = round(v["end"] + dur, 3)
    items = [{"index": i + 1, "title": c["title"]} for i, c in enumerate(chapters)]
    for c in props["chapters"]:
        if c["start"] >= at - eps:
            c["start"] = round(c["start"] + dur, 3)

    props["durationInSeconds"] = round(props["durationInSeconds"] + dur, 3)
    props["chapterMenu"] = {"at": round(at, 3), "duration": dur, "items": items}


def probe_video(video_path: str | Path) -> dict:
    """用 ffprobe 取得影片的 width / height / fps / duration。"""
    out = subprocess.run(
        [
            FFPROBE_BIN, "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate",
            "-show_entries", "format=duration",
            "-of", "json",
            str(video_path),
        ],
        capture_output=True, text=True, check=True,
    )
    info = json.loads(out.stdout)
    stream = info["streams"][0]
    num, _, den = stream["r_frame_rate"].partition("/")
    fps = float(num) / float(den or 1)
    return {
        "src_width": int(stream["width"]),
        "src_height": int(stream["height"]),
        "fps": round(fps),
        "duration": float(info["format"]["duration"]),
    }


def build_composition(
    video_path: str | Path,
    segments: list[Segment],
    visuals: list[dict] | None = None,
    chapters: list[dict] | None = None,
    out_width: int | None = None,
    out_height: int | None = None,
    output_path: str | Path | None = None,
) -> Path:
    """產生 props.json (供 Remotion 算圖用),回傳其路徑。

    chapters:章節清單 [{"start": 秒, "title": "..."}],進度條會標分隔點、各章開頭跳過場卡。
    out_width/out_height:成品畫布尺寸;省略則沿用來源影片尺寸。
    output_path: props.json 寫入位置;省略則寫到 remotion/props.json。
    """
    video_path = Path(video_path)
    meta = probe_video(video_path)

    # 把影片放進 remotion/public/(Remotion staticFile 的根目錄)
    REMOTION_PUBLIC.mkdir(parents=True, exist_ok=True)
    public_video = REMOTION_PUBLIC / video_path.name
    if not public_video.exists() or public_video.stat().st_size != video_path.stat().st_size:
        shutil.copy2(video_path, public_video)

    # 把過長字幕切成多條短字幕(一行至多 SUBTITLE_MAX_CHARS 字)
    segments = wrap_segments(segments, max_chars=SUBTITLE_MAX_CHARS)

    props = {
        "videoSrc": video_path.name,
        "fps": meta["fps"],
        "durationInSeconds": meta["duration"],
        "width": out_width or meta["src_width"],
        "height": out_height or meta["src_height"],
        "subtitles": [
            {"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text}
            for s in segments
        ],
        "visuals": visuals or [],
        "chapters": chapters or [],
    }

    # 開場標題卡後插入章節目錄(會把後續時間往後挪、暫停影片)
    _insert_chapter_menu(props)

    props_path = Path(output_path) if output_path else REMOTION_DIR / "props.json"
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
    return props_path
