from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

ZALO_APP_ID = os.getenv("ZALO_APP_ID")
ZALO_APP_SECRET = os.getenv("ZALO_APP_SECRET")


# Trang chủ
@app.route("/")
def home():
    return "Bao Lam 2 AI OK"


# File xác thực domain Zalo
@app.route("/zalo_verifierHTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm.html")
def zalo_verify():
    return "There Is No Limit To What You Can Accomplish Using Zalo!"


# OAuth Callback
@app.route("/oauth/callback")
def oauth_callback():

    code = request.args.get("code")
    state = request.args.get("state")

    print("===== ZALO OAUTH =====")
    print("CODE:", code)
    print("STATE:", state)

    if not code:
        return "No authorization code"

    try:

        token_url = "https://oauth.zaloapp.com/v4/oa/access_token"

        payload = {
            "app_id": ZALO_APP_ID,
            "grant_type": "authorization_code",
            "code": code
        }

        headers = {
            "secret_key": ZALO_APP_SECRET
        }

        response = requests.post(
            token_url,
            data=payload,
            headers=headers,
            timeout=30
        )

        result = response.json()

        print("===== TOKEN RESULT =====")
        print(result)

        access_token = result.get("access_token")
        refresh_token = result.get("refresh_token")

        return f"""
        <html>
        <body>
            <h2>OA ACCESS TOKEN</h2>
            <p>{access_token}</p>

            <h2>REFRESH TOKEN</h2>
            <p>{refresh_token}</p>

            <h2>RAW RESPONSE</h2>
            <pre>{result}</pre>
        </body>
        </html>
        """

    except Exception as e:
        return str(e)


# Webhook Zalo OA
@app.route("/webhook", methods=["GET", "POST"])
def webhook():

    if request.method == "GET":
        return "Webhook OK", 200

    data = request.get_json(silent=True)

    print("===== ZALO WEBHOOK =====")
    print(data)

    return jsonify({
        "success": True
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
