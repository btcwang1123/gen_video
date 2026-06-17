"""finalCut Pipeline Orchestrator —— 每支影片獨立目錄。

用 per-video 目錄隔離每支影片的中間檔與成品,
讓 Claude Code 的 /finalCut skill 可以自動化呼叫。

Usage (給 Claude 用,非手動執行):
  python pipeline.py transcribe <video-name>
  python pipeline.py build <video-name> --visuals <json-file>
  python pipeline.py render <video-name> [--frames 起-迄]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

# Windows 主控台預設 cp1252,印中文會 UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# 確保可以 import core/
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from config import WORK_DIR, REMOTION_DIR, REMOTION_PUBLIC, FFMPEG_BIN
from core.audio import extract_audio
from core.transcribe import transcribe
from core.subtitle import save_srt, load_srt
from core.composition import build_composition
from core.render import render


# ── 影片來源 ──────────────────────────────────
SOURCE_DIR = PROJECT_ROOT / "source"


def find_video(name: str) -> Path:
    """在 source/ 裡模糊搜尋影片檔。

    依序嘗試:
      1. 精確名稱(含副檔名): source/<name>
      2. 加上 .mp4:         source/<name>.mp4
      3. 開頭模糊:          source/<name>*.mp4
      4. 不分大小寫:        忽略大小寫重找一次

    回傳 Path;找不到就拋出 SystemExit。
    """
    candidates: list[Path] = []

    # 1. 精確
    p = SOURCE_DIR / name
    if p.is_file():
        return p

    # 2. + .mp4
    p = SOURCE_DIR / f"{name}.mp4"
    if p.is_file():
        return p

    # 3. 開頭模糊 (glob)
    candidates = sorted(SOURCE_DIR.glob(f"{name}*.mp4"))
    if candidates:
        return candidates[0]

    # 4. 不分大小寫
    name_lower = name.lower()
    candidates = sorted(SOURCE_DIR.glob("*.mp4"))
    for c in candidates:
        if c.stem.lower() == name_lower:
            return c
    for c in candidates:
        if c.stem.lower().startswith(name_lower):
            return c

    print(f"❌ 找不到影片「{name}」")
    print(f"   在 {SOURCE_DIR} 內的 mp4 有:")
    for f in sorted(SOURCE_DIR.glob("*.mp4")):
        print(f"     - {f.name}")
    sys.exit(1)


def video_dir(name: str) -> Path:
    """回傳 workspace/<name>/ 並確保存在。"""
    d = WORK_DIR / name
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── 指令實作 ──────────────────────────────────

def cmd_transcribe(video_name: str) -> dict:
    """轉字幕: 抽音軌 → Whisper → SRT。

    產出:
      workspace/<name>/audio.wav
      workspace/<name>/subtitles_raw.srt

    回傳 dict { video_path, srt_path, segments_count } 供後續步驟用。
    """
    video_path = find_video(video_name)
    out_dir = video_dir(video_name)
    video_copy = out_dir / video_path.name

    # 把影片複製進工作目錄(讓一切自含)
    if not video_copy.exists():
        print(f"  📄 複製影片到工作目錄…")
        shutil.copy2(video_path, video_copy)

    print(f"  🎵 抽音軌…")
    audio_path = extract_audio(video_copy)

    # extract_audio 把 wav 產在 WORK_DIR/,搬進 per-video 目錄
    old_audio = WORK_DIR / f"{video_copy.stem}.wav"
    target_audio = out_dir / "audio.wav"
    if old_audio.exists():
        shutil.move(str(old_audio), str(target_audio))

    print(f"  🗣️ 辨識字幕(Whisper)…")
    segments = transcribe(
        target_audio,
        progress=lambda done, total: print(
            f"\r     {done:.0f}/{total:.0f} 秒", end="", flush=True
        ),
    )
    print()

    srt_path = out_dir / "subtitles_raw.srt"
    save_srt(segments, srt_path)
    print(f"  ✅ 共 {len(segments)} 句,已寫入 {srt_path}")

    return {
        "video_path": str(video_copy),
        "srt_path": str(srt_path),
        "segments_count": len(segments),
        "out_dir": str(out_dir),
    }


def cmd_build(
    video_name: str,
    visuals_file: str | None = None,
    chapters_file: str | None = None,
) -> dict:
    """組 composition: 讀校正後字幕 + visuals → 產 props.json。

    預設讀 workspace/<name>/subtitles_corrected.srt,
    若不存在則退回 subtitles_raw.srt。

    visuals 與 chapters 用 JSON 檔案傳入(由 Claude 產出)。
    """
    out_dir = video_dir(video_name)
    video_copy = out_dir / f"{video_name}.mp4"

    # 找影片(可能已被複製過來,也可能還沒)
    if not video_copy.exists():
        video_copy = find_video(video_name)
        vc = out_dir / video_copy.name
        if not vc.exists():
            shutil.copy2(video_copy, vc)
        video_copy = vc

    # 找字幕(優先取校正版)
    srt_corrected = out_dir / "subtitles_corrected.srt"
    srt_path = srt_corrected if srt_corrected.exists() else out_dir / "subtitles_raw.srt"
    if not srt_path.exists():
        print(f"❌ 找不到字幕檔,請先執行 transcribe")
        sys.exit(1)

    segments = load_srt(srt_path)
    print(f"  📖 載入字幕: {srt_path.name} ({len(segments)} 句)")

    # 讀 visuals
    visuals = []
    if visuals_file:
        vp = Path(visuals_file)
        if vp.exists():
            with open(vp, encoding="utf-8") as f:
                visuals = json.load(f)
            print(f"  🎨 載入 visuals: {len(visuals)} 個元件")
        else:
            print(f"  ⚠️ visuals 檔不存在: {visuals_file},跳過")

    # 讀 chapters
    chapters = []
    if chapters_file:
        cp = Path(chapters_file)
        if cp.exists():
            with open(cp, encoding="utf-8") as f:
                chapters = json.load(f)
            print(f"  📑 載入 chapters: {len(chapters)} 章")
        else:
            print(f"  ⚠️ chapters 檔不存在: {chapters_file},跳過")

    print(f"  🔧 組 composition…")
    props_path = build_composition(video_copy, segments, visuals, chapters)

    # 也蓋 props.example.json(供 Remotion Studio 即時預覽)
    example = REMOTION_DIR / "props.example.json"
    shutil.copy(props_path, example)
    print(f"  ✅ props.json → {props_path}")
    print(f"  ✅ props.example.json (供 Studio 預覽)")

    return {
        "props_path": str(props_path),
        "out_dir": str(out_dir),
    }


def cmd_render(
    video_name: str,
    frames: str | None = None,
) -> dict:
    """算圖: 用 Remotion 把 props.json 算成最終影片。

    輸出到 workspace/<name>/output.mp4。
    """
    out_dir = video_dir(video_name)
    output_path = out_dir / "output.mp4"

    props_path = REMOTION_DIR / "props.json"
    if not props_path.exists():
        print(f"❌ 找不到 props.json,請先執行 build")
        sys.exit(1)

    label = f"  🎬 算圖{(' (frames '+frames+')') if frames else ''}…"
    print(label)
    render(props_path, output_path, frames=frames)
    print(f"  ✅ {output_path}")

    return {"output_path": str(output_path)}


def cmd_auto(video_name: str) -> None:
    """全自動模式: 僅轉字幕+燒錄(無視覺元件)。"""
    res = cmd_transcribe(video_name)
    print(f"\n📌 下一步: Claude 校正字幕並設計 visuals")
    print(f"   字幕: {res['srt_path']}")


# ── CLI ──────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="finalCut Pipeline Orchestrator",
    )
    parser.add_argument("command", choices=["transcribe", "build", "render", "auto"])
    parser.add_argument("video_name", help="影片名稱(不用副檔名)")
    parser.add_argument("--visuals", help="visuals JSON 檔案路徑(build 用)")
    parser.add_argument("--chapters", help="chapters JSON 檔案路徑(build 用)")
    parser.add_argument("--frames", help="算圖 frame 區間(render 用,如 450-810)")

    args = parser.parse_args()

    if args.command == "transcribe":
        cmd_transcribe(args.video_name)
    elif args.command == "build":
        cmd_build(args.video_name, args.visuals, args.chapters)
    elif args.command == "render":
        cmd_render(args.video_name, args.frames)
    elif args.command == "auto":
        cmd_auto(args.video_name)


if __name__ == "__main__":
    main()
