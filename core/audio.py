"""用 ffmpeg 從影片抽出音軌,供 Whisper 辨識用。

Whisper 吃 16kHz 單聲道 wav 效果最好,這裡直接轉好。
"""
from __future__ import annotations

from pathlib import Path

import ffmpeg

from config import FFMPEG_BIN, WORK_DIR


def extract_audio(video_path: str | Path) -> Path:
    """從影片抽出 16kHz 單聲道 wav,回傳 wav 檔路徑。"""
    video_path = Path(video_path)
    audio_path = WORK_DIR / f"{video_path.stem}.wav"

    (
        ffmpeg
        .input(str(video_path))
        .output(str(audio_path), ac=1, ar=16000, format="wav", loglevel="error")
        .overwrite_output()
        .run(cmd=FFMPEG_BIN)
    )
    return audio_path
