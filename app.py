from flask import Flask, request
import requests
import os

app = Flask(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

@app.route("/")
def home():
    return "UBND xa Bao Lam 2 - OpenRouter OK"

@app.route("/chat")
def chat():

    question = request.args.get("q", "Xin chao")

    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "deepseek/deepseek-chat-v3-0324:free",
            "messages": [
                {
                    "role": "system",
                    "content": """Bạn là trợ lý ảo của UBND xã Bảo Lâm 2.
Trả lời ngắn gọn, lịch sự, bằng tiếng Việt.
Nếu không chắc chắn thì nói người dân liên hệ UBND xã để được hướng dẫn."""
                },
                {
                    "role": "user",
                    "content": question
                }
            ]
        }
    )

    return r.json()

if __name__ == "__main__":
    app.run()
