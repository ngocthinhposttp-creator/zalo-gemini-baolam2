from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@app.route("/")
def home():
    return "UBND xa Bao Lam 2 - Gemini API"

@app.route("/chat", methods=["POST"])
def chat():

    data = request.json

    question = data.get("message", "")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [{
            "parts": [{
                "text": question
            }]
        }]
    }

    r = requests.post(url, json=payload)

    result = r.json()

    answer = result["candidates"][0]["content"]["parts"][0]["text"]

    return jsonify({
        "answer": answer
    })

if __name__ == "__main__":
    app.run()
