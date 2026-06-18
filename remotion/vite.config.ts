import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * 網頁時間軸編輯器(@remotion/player)的 vite 設定。
 * - root 指向 editor/,但允許 import ../src 的 Remotion 元件(共用同一份)
 * - /api 代理到 FastAPI 後端(server.py),省去 CORS 麻煩
 */
export default defineConfig({
  root: path.resolve(__dirname, "editor"),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 只攔 /api/ 開頭(避免把編輯器自己的 api.ts 模組也代理走)
      "^/api/": "http://127.0.0.1:8000",
    },
    fs: {
      // 允許讀取 editor/ 外層的 src/ 元件
      allow: [path.resolve(__dirname)],
    },
  },
});
