from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return "Bao Lam 2 AI OK"

@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == "GET":
        return "Webhook OK", 200

    data = request.json
    print(data)

    return jsonify({
        "message": "received"
    }), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
