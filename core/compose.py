"""用 ffmpeg 把字幕燒錄(burn-in)回影片。

階段 3 之後,疊圖表的邏輯也會加在這個模組。
"""
from __future__ import annotations

from pathlib import Path

import ffmpeg

from config import FFMPEG_BIN, WORK_DIR
from core.subtitle import Segment, save_srt


def _escape_for_filter(path: Path) -> str:
    """subtitles 濾鏡的路徑在 Windows 上要特別處理反斜線與冒號。"""
    p = str(path.resolve())
    p = p.replace("\\", "/")        # 反斜線改正斜線
    p = p.replace(":", "\\:")       # 磁碟機代號的冒號要跳脫(C: -> C\:)
    return p


def burn_subtitles(
    video_path: str | Path,
    segments: list[Segment],
    output_path: str | Path | None = None,
) -> Path:
    """把字幕燒進影片,回傳輸出影片路徑。"""
    video_path = Path(video_path)

    # 先把字幕寫成 srt 檔給 ffmpeg 的 subtitles 濾鏡用
    srt_path = WORK_DIR / f"{video_path.stem}.srt"
    save_srt(segments, srt_path)

    if output_path is None:
        output_path = WORK_DIR / f"{video_path.stem}_subtitled.mp4"
    output_path = Path(output_path)

    subtitle_arg = _escape_for_filter(srt_path)
    style = "FontSize=18,Outline=1,Shadow=0,MarginV=25"

    (
        ffmpeg
        .input(str(video_path))
        .output(
            str(output_path),
            vf=f"subtitles='{subtitle_arg}':force_style='{style}'",
            loglevel="error",
        )
        .overwrite_output()
        .run(cmd=FFMPEG_BIN)
    )
    return output_path
