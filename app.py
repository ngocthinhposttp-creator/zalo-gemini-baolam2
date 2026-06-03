from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# =========================
# CONFIG
# =========================

ZALO_APP_ID = os.getenv("ZALO_APP_ID")
ZALO_APP_SECRET = os.getenv("ZALO_APP_SECRET")

# PKCE Verifier đã dùng thành công
CODE_VERIFIER = "IBgl34nEyYr47Fvh0as8v2SHSPpa_aDKOKCynZayUMrLJ34o9fkOwlC7ZXGoGkxRX3IVD9tYkVhQioU1DiV3_g"


# =========================
# HOME
# =========================

@app.route("/")
def home():
    return "Bao Lam 2 AI OK"


# =========================
# ZALO DOMAIN VERIFY
# =========================

@app.route("/zalo_verifierHTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm.html")
def zalo_verify():
    return "There Is No Limit To What You Can Accomplish Using Zalo!"


# =========================
# OAUTH CALLBACK
# =========================

@app.route("/oauth/callback")
def oauth_callback():

    code = request.args.get("code")
    state = request.args.get("state")
    oa_id = request.args.get("oa_id")

    print("\n========== ZALO CALLBACK ==========")
    print("OA_ID:", oa_id)
    print("STATE:", state)
    print("CODE:", code)

    if not code:
        return "Khong nhan duoc authorization code"

    try:

        token_url = "https://oauth.zaloapp.com/v4/oa/access_token"

        payload = {
            "app_id": ZALO_APP_ID,
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": CODE_VERIFIER
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

        print("\n========== TOKEN RESULT ==========")
        print(result)

        access_token = result.get("access_token")
        refresh_token = result.get("refresh_token")

        return f"""
        <html>
        <body>
            <h1>OA ACCESS TOKEN</h1>
            <pre>{access_token}</pre>

            <h1>REFRESH TOKEN</h1>
            <pre>{refresh_token}</pre>

            <h1>RAW RESPONSE</h1>
            <pre>{result}</pre>
        </body>
        </html>
        """

    except Exception as e:
        return f"Loi: {str(e)}"


# =========================
# TEST
# =========================

@app.route("/test")
def test():
    return jsonify({
        "status": "ok",
        "app_id": ZALO_APP_ID
    })


# =========================
# WEBHOOK
# =========================

@app.route("/webhook", methods=["GET", "POST"])
def webhook():

    # Zalo kiểm tra webhook
    if request.method == "GET":
        return "Webhook OK", 200

    try:

        data = request.get_json(silent=True)

        print("\n========== WEBHOOK ==========")
        print(data)

        return jsonify({
            "success": True
        }), 200

    except Exception as e:

        print("WEBHOOK ERROR:", str(e))

        return jsonify({
            "success": False,
            "error": str(e)
        }), 200


# =========================
# RUN
# =========================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=10000
    )
