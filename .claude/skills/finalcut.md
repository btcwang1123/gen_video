---
name: finalcut
description: "接影片名稱，自動完成後製全流程（轉字幕→校正→配視覺→Remotion算圖）"
---

# finalCut 後製全流程

使用者打了 `/finalcut <影片名稱>`，代表要你**自動執行整條產片 pipeline**。
你的任務：把 `source/` 裡的原始影片，一路產出到 `workspace/<影片名稱>/output.mp4`。

## 📦 每支影片獨立目錄

所有中間檔與成品都放 `workspace/<影片名稱>/`，不混在一起。

最終結構：
```
workspace/<影片名稱>/
  <影片>.mp4            # 影片副本
  audio.wav             # 抽出的音軌
  subtitles_raw.srt     # Whisper 原始字幕
  subtitles_corrected.srt  # 你校正後的字幕
  visuals.json          # 你設計的視覺元件
  chapters.json         # 章節定義
  output.mp4            # 最終成品
```

## ✅ 執行步驟（照順序）

### 第 1 步：轉字幕
```bash
cd D:/Project/finalCut && PYTHONUTF8=1 PYTHONPATH=D:/Project/finalCut python pipeline.py transcribe "<影片名稱>"
```
這會：
- 在 `source/` 模糊搜尋影片（自動補 `.mp4`、不分大小寫）
- 建立 `workspace/<影片名稱>/` 並複製影片進去
- 抽音軌 + Whisper 辨識 → `subtitles_raw.srt`

### 第 2 步：校正字幕
讀 `workspace/<影片名稱>/subtitles_raw.srt`，用你的判斷修正 Whisper 的辨識錯誤：
- 專有名詞（如 TestFly → TestFlight、陸依薩 → 路易莎）
- 英文術語
- 明顯不通順處
- 把握的直接改，不確定的標出來問使用者

改完寫成 `workspace/<影片名稱>/subtitles_corrected.srt`。

### 第 3 步：分析內容、設計視覺
讀整份校正後逐字稿，判斷各段落內容，設計：

**A. 章節 (chapters)**
- 根據內容主題切分章節
- `[{"start": 秒數, "title": "章節名稱"}, ...]`
- 第一章不跳過場卡（由開場標題卡擔任）

**B. 視覺元件 (visuals)**
依內容配置以下元件（照慣用版面配置）：

| type | 用途 | 位置 |
|------|------|------|
| `title` | 開場置中標題卡 | 全螢幕 |
| `callout` | 功能說明字卡 | 左上 |
| `bar` | 數據長條圖 | 右側 |
| `panel` | 重點資訊大圖板 | 中央 2/3 |
| `compare` | 左右比較表 | 中央 |
| `stat` | 大數字強調 | 中央 |
| `checklist` | 結尾功能總覽 | 全螢幕 |

**配色規則（重要）：**
- 主色 `#6B7F99`（霧藍灰）
- 所有 `accent` 從低飽和調色盤取：`#6B7F99` / `#7C9885` / `#A78A7F` / `#8A8FA8` / `#9AA67C`
- 不要用鮮豔原色

將 visuals 和 chapters 分別存成 JSON：
```bash
# 用 Write tool 寫入 workspace/<影片名稱>/visuals.json
# 用 Write tool 寫入 workspace/<影片名稱>/chapters.json
```

### 第 4 步：組 composition
```bash
cd D:/Project/finalCut && PYTHONUTF8=1 PYTHONPATH=D:/Project/finalCut python pipeline.py build "<影片名稱>" --visuals workspace/<影片名稱>/visuals.json --chapters workspace/<影片名稱>/chapters.json
```
這會產出 `remotion/props.json` + `remotion/props.example.json`（供 Studio 即時預覽）。

### 第 5 步：預覽驗證（重要）
先算關鍵片段確認新元件運作正常，不要直接算整支：
```bash
# 算開場（title 卡 + 前幾秒）
cd D:/Project/finalCut && PYTHONUTF8=1 PYTHONPATH=D:/Project/finalCut python pipeline.py render "<影片名稱>" --frames 0-150

# 算各新元件出現的片段（依 visuals 的時間點調整 frame 範圍）
python pipeline.py render "<影片名稱>" --frames <起>-<迄>

# 算結尾（checklist）
python pipeline.py render "<影片名稱>" --frames <結尾附近>
```

預覽檔會蓋掉 `output.mp4`，但沒關係，最後會重新算整支。

**若預覽有問題 → 回頭修 visuals，重複第 4~5 步。**

### 第 6 步：算整支
```bash
cd D:/Project/finalCut && PYTHONUTF8=1 PYTHONPATH=D:/Project/finalCut python pipeline.py render "<影片名稱>"
```

### 第 7 步：告訴使用者
完成後告知：
- 成品路徑：`workspace/<影片名稱>/output.mp4`
- visuals 用了哪些元件
- 示意數據有標明「示意資料」
- 可進 Remotion Studio 微調：`cd remotion && npm run studio`

## ⚠️ 注意事項

1. **示意資料要聲明**：`bar` / `compare` / `stat` 若沒有真實數據而是你填的示意值，要明確告訴使用者那是示意、可刪
2. **修字幕時 VS Code 不要開 SRT**（`utf-8-with-bom` 會讓 ffmpeg 字幕濾鏡報錯）
3. **Remotion 算圖前提**：`remotion/` 必須執行過 `npm install`（一次就好，已裝就不用重裝）
4. **路徑**：所有命令 `cd D:/Project/finalCut` 後執行，`PYTHONPATH` 設好確保 import 正確
5. 若有 Studio 預覽需求，props.example.json 已在第 4 步自動產出，直接 `cd remotion && npm run studio` 即可
6. **遇錯處理**：某步驟失敗時，印出錯誤訊息給使用者看並詢問是否要修復後重試，不要直接放棄
