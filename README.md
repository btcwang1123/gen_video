# finalCut

一個半自動的影片編輯器：自動上字幕，並根據影片內容產生圖表動畫（Remotion 算圖）。

## 🏗️ 架構

```
Python 層                    Remotion 層
┌──────────────┐           ┌────────────────┐
│  Whisper 轉字幕│──props──>│  React 合成影片 │
│  Claude 配視覺│   json   │  圖片+文字+動畫 │
│  ffmpeg 抽音軌│          │  輸出最終 mp4   │
└──────────────┘           └────────────────┘
```

## 🖥️ 跨平台支援

| 平台 | Python | Remotion |
|------|--------|----------|
| ✅ Windows | 支援 | 支援（`compositor-win32-x64-msvc`） |
| ✅ macOS (Intel) | 支援 | 支援（`compositor-darwin-x64`） |
| ✅ macOS (Apple Silicon) | 支援 | 支援（`compositor-darwin-arm64`） |

## 📦 環境需求

### 共同需求

1. **Python 3.10+**（建議 3.13）
2. **ffmpeg**（影片處理必需）
3. **Node.js 18+**（Remotion 算圖用）

### macOS 安裝 ffmpeg

```bash
brew install ffmpeg
```

### Windows 安裝 ffmpeg

```bash
winget install --id=Gyan.FFmpeg -e
```
裝完重開終端機，用 `ffmpeg -version` 確認。

## ⚙️ 安裝

### 1. Python 套件

```bash
pip install -r requirements.txt
```

### 2. Remotion（Node.js 套件）

> ⚠️ **macOS 使用者注意**：目前 `remotion/node_modules` 是 Windows 版 binary，
> 請先刪除後重新安裝：
> ```bash
> rm -rf remotion/node_modules
> cd remotion && npm install
> ```
> npm 會自動抓取對應你平台的 Remotion 原生 binary。
>
> Windows 使用者直接安裝即可：
> ```bash
> cd remotion && npm install
> ```

## 🚀 使用

### 網頁介面（階段 1：純字幕編輯）

```bash
python app.py
```

### 命令列（快速測試）

```bash
python cli.py 你的影片.mp4
```

### Pipeline（全自動後製，由 Claude Code 執行）

```bash
# 1. 轉字幕
python pipeline.py transcribe "影片名稱"

# 2. 組 composition（需先有 visuals.json + chapters.json）
python pipeline.py build "影片名稱" --visuals workspace/影片名稱/visuals.json --chapters workspace/影片名稱/chapters.json

# 3. 算圖
python pipeline.py render "影片名稱"

# 4. 只算局部預覽
python pipeline.py render "影片名稱" --frames 0-150
```

> 💡 在 Claude Code 中使用 `/finalcut 影片名稱` 即可自動執行完整流程。

## ⚙️ 設定

編輯 `config.py`：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `WHISPER_MODEL` | `"small"` | 模型大小：`tiny/base/small/medium/large-v3` |
| `WHISPER_DEVICE` | `"cpu"` | macOS Apple Silicon 可設 `"mlx"` 加速 |
| `WHISPER_COMPUTE_TYPE` | `"int8"` | CPU 用 `int8`，GPU 用 `float16` |
| `WHISPER_LANGUAGE` | `"zh"` | `None` = 自動偵測 |

## 🎨 風格規則

- 主色 `#6B7F99`（霧藍灰）
- 調色盤：`#6B7F99` / `#7C9885` / `#A78A7F` / `#8A8FA8` / `#9AA67C`
- 章節過場、背景模糊聚焦、進度條

## 📁 目錄結構

```
finalCut/
├── app.py                    # Gradio 網頁介面
├── cli.py                    # 命令列工具
├── pipeline.py               # 全流程 orchestrator
├── config.py                 # 全域設定（跨平台）
├── core/
│   ├── audio.py              # 抽音軌
│   ├── transcribe.py         # Whisper 轉字幕
│   ├── subtitle.py           # 字幕資料結構 & SRT 格式
│   ├── composition.py        # 組 props.json
│   └── render.py             # 呼叫 Remotion 算圖
├── remotion/
│   └── src/                  # React 合成影片原始碼
├── source/                   # 放原始影片（未追蹤）
└── workspace/                # 輸出目錄（未追蹤）
```

## 📌 開發路線

- [x] **階段 1**：影片 → 自動字幕 → 表格編輯 → 燒錄輸出（Gradio 介面）
- [ ] **階段 2**：逐字稿 → Claude → 修飾字幕 + 抽取可視化片段
- [ ] **階段 3**：由結構化資料產生圖表 → 疊回影片
- [ ] **階段 4**：整合進介面的人工確認流程
- [ ] **未來**：後端接 React 前端（時間軸編輯器）

> 架構原則：`core/` 是純後端邏輯，不依賴任何 UI。`app.py`（Gradio）只是其中一種介面，
> 日後換 React 時 `core/` 完全沿用。
