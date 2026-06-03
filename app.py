from flask import Flask, request, jsonify

app = Flask(__name__)


# Trang chủ
@app.route("/")
def home():
    return "Bao Lam 2 AI OK"


# File xác thực domain Zalo
@app.route("/zalo_verifierHTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm.html")
def zalo_verify():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta property="zalo-platform-site-verification"
          content="HTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm" />
</head>
<body>
There Is No Limit To What You Can Accomplish Using Zalo!
</body>
</html>
"""


# Webhook Zalo
@app.route("/webhook", methods=["GET", "POST"])
def webhook():

    # Kiểm tra webhook
    if request.method == "GET":
        return "Webhook OK", 200

    # Nhận dữ liệu từ Zalo
    data = request.get_json(silent=True)

    print("===== ZALO WEBHOOK =====")
    print(data)

    return jsonify({
        "success": True
    }), 200


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=10000
    )
