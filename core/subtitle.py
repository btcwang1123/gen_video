"""字幕資料結構與 SRT 格式處理。

整個專案內部都用 list[Segment] 來傳遞字幕;只有要輸出 / 燒錄時才轉成 SRT 文字。
這樣 UI 層(Gradio 表格、未來 React 時間軸)拿到的都是乾淨的結構化資料。
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Segment:
    """一句字幕:起訖時間(秒)+ 文字。"""
    start: float
    end: float
    text: str


def _format_timestamp(seconds: float) -> str:
    """把秒數轉成 SRT 時間格式 HH:MM:SS,mmm。"""
    if seconds < 0:
        seconds = 0
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1_000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def segments_to_srt(segments: list[Segment]) -> str:
    """把字幕段落轉成 SRT 檔內容。"""
    blocks = []
    for i, seg in enumerate(segments, start=1):
        ts = f"{_format_timestamp(seg.start)} --> {_format_timestamp(seg.end)}"
        blocks.append(f"{i}\n{ts}\n{seg.text.strip()}")
    return "\n\n".join(blocks) + "\n"


def save_srt(segments: list[Segment], path) -> None:
    """寫出 .srt 檔(UTF-8)。"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(segments_to_srt(segments))


def _parse_timestamp(ts: str) -> float:
    """把 SRT 時間 HH:MM:SS,mmm(或用 . 當小數點)轉回秒數。"""
    ts = ts.strip().replace(".", ",")
    hms, _, ms = ts.partition(",")
    h, m, s = hms.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms or 0) / 1000


def parse_srt(text: str) -> list[Segment]:
    """把 SRT 檔內容解析回字幕段落清單(供編輯後重新載入)。"""
    segments: list[Segment] = []
    # 以空行切分每個字幕區塊
    blocks = [b for b in text.replace("\r\n", "\n").split("\n\n") if b.strip()]
    for block in blocks:
        lines = block.strip().split("\n")
        # 找出含有 "-->" 的那行就是時間軸;它上面通常是序號、下面是字幕文字
        ts_idx = next((i for i, ln in enumerate(lines) if "-->" in ln), None)
        if ts_idx is None:
            continue
        start_str, _, end_str = lines[ts_idx].partition("-->")
        text_lines = lines[ts_idx + 1:]
        if not text_lines:
            continue
        segments.append(Segment(
            start=_parse_timestamp(start_str),
            end=_parse_timestamp(end_str),
            text="\n".join(text_lines).strip(),
        ))
    return segments


def load_srt(path) -> list[Segment]:
    """從 .srt 檔讀回字幕段落。"""
    with open(path, "r", encoding="utf-8") as f:
        return parse_srt(f.read())
