#!/bin/bash
# ローカルサーバー起動スクリプト
# このスクリプトを実行すると http://localhost:8000 でクイズアプリにアクセスできます。

DIRECTORY="/Users/imotokeisuke/.gemini/antigravity/scratch"
cd "$DIRECTORY"

echo "------------------------------------------------"
echo "ChronoQuiz ローカルサーバーを起動しています..."
echo "アクセス先: http://localhost:8000"
echo "終了するには Ctrl + C を押してください。"
echo "------------------------------------------------"

python3 -m http.server 8000
