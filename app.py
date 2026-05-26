import os
from functools import wraps
from flask import Flask, render_template, request, jsonify, Response
from core.prices import (
    load_all, save_all,
    default_preise_materialverkauf, default_preise_leinwandproduktion,
    load_business_info, save_business_info, default_business_info,
)
from core import calculator

app = Flask(__name__)


# ── HTTP Basic Auth ───────────────────────────────────────────────────────────

def _check_auth(password: str) -> bool:
    pw = os.environ.get("ADMIN_PASSWORD", "")
    if not pw:
        return True   # No password configured → open access (dev / first deploy)
    return password == pw


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _check_auth(""):  # fast-path: open if no password set
            auth = request.authorization
            if not auth or not _check_auth(auth.password):
                return Response(
                    "Login erforderlich",
                    401,
                    {"WWW-Authenticate": 'Basic realm="Werkatelier Admin"'},
                )
        return f(*args, **kwargs)
    return decorated


# ── Page routes ───────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/leinwandpreise")
def leinwandpreise():
    biz_info = load_business_info()
    return render_template("leinwandpreise.html", business_info=biz_info)


@app.route("/materialpreise")
def materialpreise():
    mat_prices, _ = load_all()
    return render_template("materialpreise.html", prices=mat_prices)


@app.route("/einstellungen")
@requires_auth
def einstellungen():
    mat_prices, canvas_prices = load_all()
    biz_info = load_business_info()
    return render_template(
        "einstellungen.html",
        material_prices=mat_prices,
        canvas_prices=canvas_prices,
        business_info=biz_info,
    )


@app.route("/statistik")
def statistik():
    return render_template("statistik.html")


@app.route("/preisliste")
def preisliste():
    markup = float(request.args.get("markup", 4.2))
    rows = calculator.generate_preisliste(markup)
    return render_template("preisliste.html", rows=rows, markup=markup)


# ── API routes ────────────────────────────────────────────────────────────────

@app.route("/api/calculate/canvas", methods=["POST"])
def api_calculate_canvas():
    d = request.get_json(force=True)
    try:
        result = calculator.berechne_leinwand(
            length       = float(d["length"]),
            width        = float(d["width"]),
            fabric_type  = d["fabric_type"],
            wood_type    = d["wood_type"],
            anz_strebe_lang = int(d.get("anz_strebe_lang", 0)),
            anz_strebe_kurz = int(d.get("anz_strebe_kurz", 0)),
            markup_factor   = float(d.get("markup_factor", 4.2)),
        )
        return jsonify({"ok": True, **result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/compare/canvas", methods=["POST"])
def api_compare_canvas():
    d = request.get_json(force=True)
    try:
        results = calculator.compare_canvas(
            length        = float(d["length"]),
            width         = float(d["width"]),
            fabric_type   = d["fabric_type"],
            markup_factor = float(d.get("markup_factor", 4.2)),
        )
        return jsonify({"ok": True, "comparisons": results})
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
@requires_auth
def api_update_prices():
    d = request.get_json(force=True)
    try:
        saved, json_mat, json_can = save_all(
            d["material_prices"], d["canvas_prices"]
        )
        return jsonify({
            "ok": True,
            "saved_to_disk": saved,
            # Return these so the operator can paste them into Render env vars
            # for persistence across server restarts.
            "env_hints": {
                "PRICES_MATERIAL": json_mat,
                "PRICES_CANVAS":   json_can,
            },
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/business-info")
def api_business_info():
    return jsonify(load_business_info())


@app.route("/api/update-business-info", methods=["POST"])
@requires_auth
def api_update_business_info():
    d = request.get_json(force=True)
    try:
        saved, json_str = save_business_info(d)
        return jsonify({
            "ok": True,
            "saved_to_disk": saved,
            "env_hint": {"BUSINESS_INFO": json_str},
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/chart-data")
def api_chart_data():
    fabric = request.args.get("fabric", "Baumwolle")
    wood   = request.args.get("wood",   "classic_double")
    markup = float(request.args.get("markup", 4.2))
    try:
        rows = calculator.generate_preisliste(markup)
        points = [
            {
                "label":   row["label"],
                "area_m2": row["area_m2"],
                "price":   row["prices"][fabric][wood],
            }
            for row in rows
            if fabric in row["prices"] and wood in row["prices"][fabric]
        ]
        return jsonify({"ok": True, "points": points})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
