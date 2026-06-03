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
            "model": "qwen/qwen3-32b:free",
            "messages": [
                {
                    "role": "user",
                    "content": question
                }
            ]
        }
    )

    return {
        "status_code": r.status_code,
        "response": r.json()
    }

if __name__ == "__main__":
    app.run()
