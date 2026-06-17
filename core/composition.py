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
from core.subtitle import Segment


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
) -> Path:
    """產生 remotion/props.json,回傳其路徑。

    chapters:章節清單 [{"start": 秒, "title": "..."}],進度條會標分隔點、各章開頭跳過場卡。
    out_width/out_height:成品畫布尺寸;省略則沿用來源影片尺寸。
    """
    video_path = Path(video_path)
    meta = probe_video(video_path)

    # 把影片放進 remotion/public/(Remotion staticFile 的根目錄)
    REMOTION_PUBLIC.mkdir(parents=True, exist_ok=True)
    public_video = REMOTION_PUBLIC / video_path.name
    if not public_video.exists() or public_video.stat().st_size != video_path.stat().st_size:
        shutil.copy2(video_path, public_video)

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

    props_path = REMOTION_DIR / "props.json"
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
    return props_path
