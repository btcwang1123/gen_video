"""全域設定。

之後接 React 前端時,這層完全不用改 —— 前後端共用同一份設定。
"""
import shutil
import sys
from pathlib import Path

# ── 路徑 ────────────────────────────────────
BASE_DIR = Path(__file__).parent
WORK_DIR = BASE_DIR / "workspace"        # 中間檔(音軌、字幕)與輸出影片都放這
WORK_DIR.mkdir(exist_ok=True)


def _find_ffmpeg() -> str:
    """找出 ffmpeg 執行檔（跨平台: Windows / macOS）。

    搜尋順序:
      1. PATH 環境變數 (shutil.which)
      2. Windows → WinGet 安裝路徑
      3. macOS   → Homebrew 安裝路徑 (Intel / Apple Silicon)
    回傳可執行檔路徑;都找不到就回 "ffmpeg" 讓底層自己報錯。
    """
    # 1. PATH
    found = shutil.which("ffmpeg")
    if found:
        return found

    system = sys.platform

    # 2. Windows: WinGet
    if system == "win32":
        winget_pkgs = Path.home() / "AppData/Local/Microsoft/WinGet/Packages"
        if winget_pkgs.is_dir():
            for exe in winget_pkgs.glob("Gyan.FFmpeg*/**/bin/ffmpeg.exe"):
                return str(exe)

    # 3. macOS: Homebrew
    elif system == "darwin":
        for brew_prefix in ("/opt/homebrew", "/usr/local"):
            p = Path(brew_prefix) / "bin/ffmpeg"
            if p.is_file():
                return str(p)

    return "ffmpeg"


# 整個專案都用這個路徑呼叫 ffmpeg,不依賴 PATH 是否已更新
FFMPEG_BIN = _find_ffmpeg()
# ffprobe 與 ffmpeg 在同一個資料夾
_ffmpeg_path = Path(FFMPEG_BIN)
_ffprobe_candidate = _ffmpeg_path.with_name(
    "ffprobe.exe" if sys.platform == "win32" else "ffprobe"
)
FFPROBE_BIN = str(_ffprobe_candidate) if _ffprobe_candidate.is_file() else "ffprobe"

# ── Remotion(算圖/合成層)────────────────────
REMOTION_DIR = BASE_DIR / "remotion"
REMOTION_PUBLIC = REMOTION_DIR / "public"

# ── Whisper 設定 ────────────────────────────
# 模型越大越準但越慢。沒有 GPU 時建議先用 "small" 或 "base" 試流程。
#   tiny / base / small / medium / large-v3
WHISPER_MODEL = "small"

# "cuda" 用 NVIDIA GPU(快很多);沒有 GPU 就用 "cpu"
WHISPER_DEVICE = "cpu"

# GPU 用 "float16" 省記憶體;CPU 用 "int8" 較快
WHISPER_COMPUTE_TYPE = "int8"

# 影片主要語言;設 None 讓 Whisper 自動偵測
WHISPER_LANGUAGE = "zh"
