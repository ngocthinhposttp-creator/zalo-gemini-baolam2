from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OA_ACCESS_TOKEN = os.getenv("OA_ACCESS_TOKEN")

@app.route("/")
def home():
    return "Bao Lam 2 AI OK"

@app.route("/zalo_verifierHTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm.html")
def zalo_verify():
    return "There Is No Limit To What You Can Accomplish Using Zalo!"

@app.route("/webhook", methods=["GET", "POST"])
def webhook():

    if request.method == "GET":
        return "Webhook OK", 200

    data = request.get_json(silent=True)

    print("===== ZALO WEBHOOK =====")
    print(data)

    try:
        if data.get("event_name") == "user_send_text":

            user_id = data["sender"]["id"]
            user_text = data["message"]["text"]

            ai_reply = ask_ai(user_text)

            send_zalo_message(user_id, ai_reply)

    except Exception as e:
        print("ERROR:", e)

    return jsonify({"success": True}), 200


def ask_ai(prompt):

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "nvidia/nemotron-3-super-49b-v1",
        "messages": [
            {
                "role": "system",
                "content": """
Bạn là trợ lý AI của UBND xã Bảo Lâm 2.
Trả lời bằng tiếng Việt.
Ngắn gọn, lịch sự, dễ hiểu.
"""
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    }

    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=60
    )

    result = r.json()

    return result["choices"][0]["message"]["content"]


def send_zalo_message(user_id, message):

    headers = {
        "access_token": OA_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }

    payload = {
        "recipient": {
            "user_id": user_id
        },
        "message": {
            "text": message[:2000]
        }
    }

    r = requests.post(
        "https://openapi.zalo.me/v3.0/oa/message/cs",
        headers=headers,
        json=payload
    )

    print("SEND RESULT:", r.text)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
