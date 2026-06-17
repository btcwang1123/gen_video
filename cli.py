"""命令列入口。把流程拆成兩步,讓你能在中間修字幕。

  步驟 1：轉字幕 → 產出可編輯的 .srt
      python cli.py transcribe "影片.mp4"
      → workspace/影片.srt（用記事本打開改錯字）

  步驟 2：把（改好的）字幕燒回影片
      python cli.py burn "影片.mp4"
      → workspace/影片_subtitled.mp4
      （若字幕檔不在預設位置，可指定：python cli.py burn "影片.mp4" "我的字幕.srt"）

  一次做完（不停下來修）：
      python cli.py auto "影片.mp4"
"""
from __future__ import annotations

import sys
from pathlib import Path

# Windows 主控台預設 cp1252/cp950,印中文會 UnicodeEncodeError;強制改用 UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from config import WORK_DIR
from core.audio import extract_audio
from core.compose import burn_subtitles
from core.subtitle import load_srt, save_srt
from core.transcribe import transcribe


def _default_srt(video: Path) -> Path:
    return WORK_DIR / f"{video.stem}.srt"


def do_transcribe(video: Path) -> None:
    print("① 抽音軌中…")
    audio = extract_audio(video)

    print("② 辨識字幕中(第一次會先下載 Whisper 模型,請稍候)…")
    segments = transcribe(audio, progress=lambda done, total: print(
        f"\r   {done:.0f}/{total:.0f} 秒", end="", flush=True))

    srt_path = _default_srt(video)
    save_srt(segments, srt_path)
    print(f"\n   共 {len(segments)} 句字幕")
    print(f"✅ 字幕檔已產生:{srt_path}")
    print("   → 用記事本打開修改錯字後,再執行:")
    print(f'     python cli.py burn "{video}"')


def do_burn(video: Path, srt: Path) -> None:
    if not srt.exists():
        print(f"找不到字幕檔:{srt}")
        print("   先執行:python cli.py transcribe \"影片\" 來產生字幕檔")
        sys.exit(1)

    print(f"③ 讀取字幕 {srt.name} 並燒錄到影片中…")
    segments = load_srt(srt)
    out = burn_subtitles(video, segments)
    print(f"✅ 完成:{out}")


def main() -> None:
    args = sys.argv[1:]
    # 相容舊用法:python cli.py 影片.mp4 → 等同 auto
    if len(args) == 1 and not args[0] in {"transcribe", "burn", "auto"}:
        args = ["auto", args[0]]

    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    cmd, video = args[0], Path(args[1])
    if not video.exists():
        print(f"找不到影片:{video}")
        sys.exit(1)

    if cmd == "transcribe":
        do_transcribe(video)
    elif cmd == "burn":
        srt = Path(args[2]) if len(args) > 2 else _default_srt(video)
        do_burn(video, srt)
    elif cmd == "auto":
        do_transcribe(video)
        do_burn(video, _default_srt(video))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
