"""用 faster-whisper 把音軌轉成帶時間戳的字幕段落。

模型只在第一次使用時載入一次(lazy load),之後重複使用。
"""
from __future__ import annotations

from pathlib import Path

from faster_whisper import WhisperModel

from config import (
    WHISPER_COMPUTE_TYPE,
    WHISPER_DEVICE,
    WHISPER_LANGUAGE,
    WHISPER_MODEL,
)
from core.subtitle import Segment

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    """延遲載入 Whisper 模型(只載一次)。"""
    global _model
    if _model is None:
        _model = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
        )
    return _model


def transcribe(audio_path: str | Path, progress=None) -> list[Segment]:
    """辨識音軌,回傳字幕段落清單。

    progress: 可選的回呼,接收 (已處理秒數, 總秒數),給 UI 顯示進度用。
    """
    model = _get_model()
    segments_gen, info = model.transcribe(
        str(audio_path),
        language=WHISPER_LANGUAGE,
        vad_filter=True,          # 過濾靜音段,減少幻聽
        beam_size=5,
    )

    results: list[Segment] = []
    for seg in segments_gen:
        results.append(Segment(start=seg.start, end=seg.end, text=seg.text.strip()))
        if progress is not None:
            progress(seg.end, info.duration)
    return results
