---
name: finalcut
description: "接影片名稱，自動完成後製全流程（轉字幕→校正→配視覺→Remotion算圖），output依日期時間區分"
---

# finalCut 後製全流程

使用者打了 `/finalcut <影片名稱>`，代表要你**自動執行整條產片 pipeline**。
你的任務：把 `source/` 裡的原始影片，一路產出到 `workspace/<日期>/<時間>_<影片名稱>/output.mp4`。

## 📦 Output 結構（日期/時間區分）

每次後製會產生一組 **run-id**，格式為 `YYYY-MM-DD/HHmm_<影片名稱>`，所有中間檔與成品都放在對應目錄：

```
workspace/
└── 2026-06-17/
    └── 1430_我的影片/
        ├── 我的影片.mp4          # 影片副本
        ├── audio.wav             # 抽出的音軌
        ├── subtitles_raw.srt     # Whisper 原始字幕
        ├── subtitles_corrected.srt  # 你校正後的字幕
        ├── visuals.json          # 你設計的視覺元件
        ├── chapters.json         # 章節定義
        ├── props.json            # composition props (永久保存)
        └── output.mp4            # 最終成品
```

好處：同一支影片後製多次也不會蓋掉，每次都有獨立的時間戳記。

## ✅ 執行步驟（照順序）

所有指令都在專案根目錄執行，用 `--run-id` 串接每一步。

### 第 1 步：轉字幕
```bash
python pipeline.py transcribe "<影片名稱>"
```
這會：
- 在 `source/` 模糊搜尋影片（自動補 `.mp4`、不分大小寫）
- 自動產生 run-id（如 `2026-06-17/1430_影片名稱`）
- 抽音軌 + Whisper 辨識 → `subtitles_raw.srt`

輸出會告訴你 run-id，**記下它**，後面步驟都需要。

### 第 2 步：校正字幕
讀 `workspace/<run-id>/subtitles_raw.srt`，用你的判斷修正 Whisper 的辨識錯誤：
- 專有名詞（如 TestFly → TestFlight、陸依薩 → 路易莎）
- 英文術語
- 明顯不通順處
- 把握的直接改，不確定的標出來問使用者

改完寫成 `workspace/<run-id>/subtitles_corrected.srt`。

**字幕長度不用自己切**：build 時會自動把過長的句子切成多條短字幕（一行至多 15 個中文字、儘量在標點斷句），讓觀眾一次只看一行、不會太累。字幕也固定在最上層（不會被字卡擋住）、位置偏下。所以校正時專心修「內容」就好，不用管斷行。

### 第 3 步：分析內容、設計視覺
讀整份校正後逐字稿，判斷各段落內容，設計：

**A. 章節 (chapters)**
- 根據內容主題切分章節
- `[{"start": 秒數, "title": "章節名稱"}, ...]`
- 第一章不跳過場卡（由開場標題卡擔任）
- **章節目錄會自動產生**：只要同時有「章節」+「開場 `title` 卡」，build 時會在標題卡消失後自動插入一張「本片章節」目錄卡（列出全部章節數字＋標題），並讓影片暫停 3 秒，讓觀眾先看到全貌、決定要跳到哪段。後續所有時間軸會自動往後挪 3 秒，不必自己算。
- 底部進度改成「小車開過一條路」：一台小車依整支影片播放進度從左慢慢開到右、會上下晃動顛簸（像真的在開）。章節變成路上的「里程標」（只標章節數字），小車開過後該里程標高亮。不再用分段進度條。

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

將 visuals 和 chapters 分別存成 JSON 到 **run 目錄**：
```
workspace/<run-id>/visuals.json
workspace/<run-id>/chapters.json
```

### 第 4 步：組 composition
```bash
python pipeline.py build "<影片名稱>" --run-id "<run-id>" --visuals workspace/<run-id>/visuals.json --chapters workspace/<run-id>/chapters.json
```
這會產出：
- `workspace/<run-id>/props.json`（永久保存）
- `remotion/props.json`（供 Studio 即時預覽）

### 第 5 步：預覽驗證（重要）
先算關鍵片段確認新元件運作正常，不要直接算整支：
```bash
# 算開場（title 卡 + 前幾秒）
python pipeline.py render "<影片名稱>" --run-id "<run-id>" --frames 0-150

# 算各新元件出現的片段（依 visuals 的時間點調整 frame 範圍）
python pipeline.py render "<影片名稱>" --run-id "<run-id>" --frames <起>-<迄>

# 算結尾（checklist）
python pipeline.py render "<影片名稱>" --run-id "<run-id>" --frames <結尾附近>
```

**若預覽有問題 → 回頭修 visuals，重複第 4~5 步。**

### 第 6 步：算整支
```bash
python pipeline.py render "<影片名稱>" --run-id "<run-id>"
```

### 第 7 步：告訴使用者
完成後告知：
- 成品路徑：`workspace/<run-id>/output.mp4`
- visuals 用了哪些元件
- 示意數據有標明「示意資料」
- 可進 Remotion Studio 微調：`cd remotion && npm run studio`

## ⚠️ 注意事項

1. **--run-id 很重要**：從 transcribe 的輸出取得，後續 build / render 都要帶
2. **示意資料要聲明**：`bar` / `compare` / `stat` 若沒有真實數據而是你填的示意值，要明確告訴使用者那是示意、可刪
3. **修字幕時 VS Code 不要開 SRT**（`utf-8-with-bom` 會讓 ffmpeg 字幕濾鏡報錯）
4. **Remotion 算圖前提**：`remotion/` 必須執行過 `npm install`（一次就好，已裝就不用重裝）
5. **跨平台**：指令在 Windows 和 macOS 都通用；macOS 使用者需先刪掉 `remotion/node_modules` 後 `npm install` 以取得原生 binary
6. **遇錯處理**：某步驟失敗時，印出錯誤訊息給使用者看並詢問是否要修復後重試，不要直接放棄
