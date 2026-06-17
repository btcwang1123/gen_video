"""Gradio 網頁介面 —— 階段 1。

流程:上傳影片 → 自動轉字幕 → 用表格逐句編輯(人工確認)→ 一鍵燒錄輸出。

UI 層只負責「呼叫 core/ 的函式」與「顯示結果」,
所有實際邏輯都在 core/,日後換成 React 前端時這支檔案直接丟掉即可。
"""
from __future__ import annotations

import gradio as gr

from core.audio import extract_audio
from core.compose import burn_subtitles
from core.subtitle import Segment
from core.transcribe import transcribe


def step_transcribe(video_path, progress=gr.Progress()):
    """上傳影片後:抽音軌 + 轉字幕,把結果填進可編輯表格。"""
    if not video_path:
        raise gr.Error("請先上傳影片")

    progress(0, desc="抽音軌中…")
    audio = extract_audio(video_path)

    progress(0.2, desc="辨識字幕中(第一次會下載模型)…")
    segments = transcribe(audio)

    # 轉成表格資料:[開始秒, 結束秒, 文字]
    rows = [[round(s.start, 2), round(s.end, 2), s.text] for s in segments]
    return rows, gr.update(interactive=True)


def step_burn(video_path, table_rows, progress=gr.Progress()):
    """把(可能被編輯過的)表格字幕燒回影片。"""
    if not video_path:
        raise gr.Error("請先上傳影片")
    if not table_rows:
        raise gr.Error("沒有字幕可燒錄,請先轉字幕")

    progress(0.1, desc="燒錄字幕中…")
    segments = []
    for r in table_rows:
        # 跳過空白列或時間沒填的列
        if len(r) < 3 or not str(r[2]).strip():
            continue
        if r[0] in (None, "") or r[1] in (None, ""):
            continue
        segments.append(Segment(start=float(r[0]), end=float(r[1]), text=str(r[2])))

    if not segments:
        raise gr.Error("沒有有效的字幕可燒錄")
    out = burn_subtitles(video_path, segments)
    return str(out)


with gr.Blocks(title="finalCut — 自動字幕(階段 1)") as demo:
    gr.Markdown("## 🎬 finalCut — 自動字幕\n上傳影片 → 自動轉字幕 → 編輯確認 → 輸出帶字幕影片")

    with gr.Row():
        with gr.Column():
            video_in = gr.Video(label="① 上傳影片")
            btn_transcribe = gr.Button("② 自動轉字幕", variant="primary")
        with gr.Column():
            video_out = gr.Video(label="輸出結果(帶字幕)")

    subtitle_table = gr.Dataframe(
        headers=["開始(秒)", "結束(秒)", "字幕文字"],
        datatype=["number", "number", "str"],
        type="array",          # 以 list[list] 傳回(配合 step_burn 的逐列讀取)
        label="③ 字幕(可直接點格子編輯)",
        interactive=True,
        wrap=True,
    )

    btn_burn = gr.Button("④ 燒錄字幕並輸出", variant="primary", interactive=False)

    btn_transcribe.click(
        step_transcribe,
        inputs=[video_in],
        outputs=[subtitle_table, btn_burn],
    )
    btn_burn.click(
        step_burn,
        inputs=[video_in, subtitle_table],
        outputs=[video_out],
    )


if __name__ == "__main__":
    demo.launch(inbrowser=True)
