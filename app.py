from flask import Flask, request, jsonify
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

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "nvidia/nemotron-3-super-120b-a12b:free",
                "messages": [
                    {
                        "role": "user",
                        "content": question
                    }
                ]
            },
            timeout=60
        )

        data = r.json()

        if r.status_code != 200:
            return jsonify(data), r.status_code

        answer = data["choices"][0]["message"]["content"]

        return answer

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
