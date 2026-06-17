"""呼叫 Remotion CLI 把 props.json 算成最終影片。

需要 remotion/ 已執行過 npm install。
第一次算圖時 Remotion 會自動下載一份無頭瀏覽器(Chromium),需要等一下。
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from config import REMOTION_DIR


def render(
    props_path: str | Path,
    output_path: str | Path,
    frames: str | None = None,
) -> Path:
    """算圖。

    props_path: build_composition() 產生的 props.json
    output_path: 輸出 mp4 路徑
    frames: 可選,只算某段 frame 區間(例如 "450-810"),用來快速預覽
    """
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "npx", "remotion", "render",
        "src/index.ts", "FinalCut",
        str(output_path),
        f"--props={Path(props_path).resolve()}",
    ]
    if frames:
        cmd.append(f"--frames={frames}")

    # shell=True 確保 Windows(npx.cmd) / macOS(npx shell script) 都能跑
    subprocess.run(cmd, cwd=REMOTION_DIR, shell=True, check=True)
    return output_path
