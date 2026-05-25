import os
from flask import Flask, render_template, request, jsonify
from core.prices import load_all, save_all, default_preise_materialverkauf, default_preise_leinwandproduktion
from core import calculator

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/leinwandpreise")
def leinwandpreise():
    return render_template("leinwandpreise.html")


@app.route("/materialpreise")
def materialpreise():
    mat_prices, _ = load_all()
    return render_template("materialpreise.html", prices=mat_prices)


@app.route("/aenderung-preise")
def aenderung_preise():
    mat_prices, canvas_prices = load_all()
    return render_template(
        "aenderung_preise.html",
        material_prices=mat_prices,
        canvas_prices=canvas_prices,
    )


@app.route("/preisanpassung")
def preisanpassung():
    return render_template("preisanpassung.html")


# ── API ──────────────────────────────────────────────────────────────────────


@app.route("/api/calculate/canvas", methods=["POST"])
def api_calculate_canvas():
    d = request.get_json(force=True)
    try:
        result = calculator.berechne_leinwand(
            length=float(d["length"]),
            width=float(d["width"]),
            fabric_type=d["fabric_type"],
            wood_type=d["wood_type"],
            anz_strebe_lang=int(d.get("anz_strebe_lang", 0)),
            anz_strebe_kurz=int(d.get("anz_strebe_kurz", 0)),
            markup_factor=float(d.get("markup_factor", 4.2)),
        )
        return jsonify({"ok": True, **result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/calculate/material", methods=["POST"])
def api_calculate_material():
    d = request.get_json(force=True)
    try:
        result = calculator.berechne_material(d.get("items", []))
        return jsonify({"ok": True, **result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/update-prices", methods=["POST"])
def api_update_prices():
    d = request.get_json(force=True)
    try:
        save_all(d["material_prices"], d["canvas_prices"])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/preisanpassung-data")
def api_preisanpassung_data():
    params = {k: float(request.args[k]) for k in request.args if k in {
        "a_baumwolle", "b_baumwolle", "y0_baumwolle",
        "a_baumwolle_o", "b_baumwolle_o", "y0_baumwolle_o",
        "a_leinen", "b_leinen", "y0_leinen",
    }}
    try:
        data = calculator.get_preisanpassung_data(**params)
        return jsonify({"ok": True, **data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
