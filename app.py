from flask import Flask, request, jsonify

app = Flask(__name__)

# Trang chủ
@app.route("/")
def home():
    return "Bao Lam 2 AI OK"


# File xác thực domain Zalo
@app.route("/zalo_verifierHTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm.html")
def zalo_verify():
    return "There Is No Limit To What You Can Accomplish Using Zalo!"


# OAuth Callback URL
@app.route("/oauth/callback")
def oauth_callback():
    code = request.args.get("code")
    state = request.args.get("state")

    print("===== ZALO OAUTH =====")
    print("CODE:", code)
    print("STATE:", state)

    return f"""
    <html>
    <body>
        <h2>Zalo OAuth Success</h2>
        <p><b>Code:</b> {code}</p>
        <p><b>State:</b> {state}</p>
    </body>
    </html>
    """


# Webhook Zalo OA
@app.route("/webhook", methods=["GET", "POST"])
def webhook():

    # Kiểm tra webhook
    if request.method == "GET":
        return "Webhook OK", 200

    # Nhận sự kiện từ Zalo
    data = request.get_json(silent=True)

    print("===== ZALO WEBHOOK =====")
    print(data)

    return jsonify({
        "success": True
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
