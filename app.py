from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return "Bao Lam 2 AI OK"

# File xác thực domain Zalo
@app.route("/zalo_verifierHTIC3B7d9IrAvgKrYCbpOth3wMoMjJmwCJGm.html")
def zalo_verify():
    return "There Is No Limit To What You Can Accomplish Using Zalo!"

# Webhook Zalo
@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == "GET":
        return "Webhook OK", 200

    data = request.get_json(silent=True)

    print("Webhook received:")
    print(data)

    return jsonify({
        "success": True
    }), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
