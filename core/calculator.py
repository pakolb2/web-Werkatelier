import csv
import math
from core.prices import load_all

# Piecewise linear segments: (area_cm2_low, area_cm2_high, m, b)
# Sales price = m * material_cost + b
SEG_PARAMS = [
    (    324,    800, 5.2910,   -2.6995),
    (    800,   1600, 4.9478,  -12.1552),
    (   1600,   6400, 6.4257,  -57.9238),
    (   6400,  22500, 3.8769,   20.7967),
    (  22500,  44100, 5.8232, -152.8603),
    (  44100, 160000, 3.2826,  135.9062),
    ( 160000,   None, 3.2826,  135.9062),
]

SUPPORT_MAP = {
    "no_support":              (0, 0),
    "single_support":          (0, 1),
    "double_support_cross":    (1, 1),
    "double_support_parallel": (0, 2),
    "triple_support":          (1, 2),
    "quad_support":            (2, 2),
}


def _verkaufspreis(materialpreis: float, area_cm2: float) -> float:
    for low, high, m, b in SEG_PARAMS:
        if area_cm2 >= low and (high is None or area_cm2 < high):
            return m * materialpreis + b
    _, _, m, b = SEG_PARAMS[-1]
    return m * materialpreis + b


def _qcm_berechnen(length, width, wood):
    top = length * width
    if wood == "classic_single":
        side = 2 * (length + width) * 1.8
        fabric = (length + 10) * (width + 10)
    elif wood == "classic_double":
        side = 2 * (length + width) * 3.6
        fabric = (length + 14) * (width + 14)
    else:  # museo
        side = 2 * (length + width) * 4.5
        fabric = (length + 18) * (width + 18)
    return fabric, top + side


def berechne_leinwand(length, width, fabric_type, wood_type, anz_strebe_lang, anz_strebe_kurz, markup_factor=4.2):
    mat_prices, prod_prices = load_all()

    qcm_arles = prod_prices["arles_4x10m2_roll"] / (4 * 100_000)
    qcm_leine = prod_prices["leine_2x10m2_roll"] / (2 * 100_000)
    cm_classic = prod_prices["keilrahmen_classic_1m"] / 100
    cm_museo   = prod_prices["keilrahmen_museo_1m"] / 100
    qcm_glue   = prod_prices["leim_5l"] / ((50 / 1.5) * 10_000)
    qcm_color  = prod_prices["farbe_5l"] / ((50 / 0.6) * 10_000)

    qcm_fabric, qcm_liquids = _qcm_berechnen(length, width, wood_type)

    if fabric_type == "Baumwolle":
        fabric_price = qcm_arles * qcm_fabric
        qm_price_tuch = round(qcm_arles * 10_000, 2)
    else:
        fabric_price = qcm_leine * qcm_fabric
        qm_price_tuch = round(qcm_leine * 10_000, 2)
    fabric_price = round(fabric_price, 2)
    qm_fabric_size = round(qcm_fabric / 10_000, 2)

    if wood_type == "classic_single":
        wood_frame_cm = 2 * (width + length)
        m_price_rahmen = round(prod_prices["keilrahmen_classic_1m"], 2)
        price_frame = wood_frame_cm * cm_classic
        holzrahmen = "Classic 45 - Einfachrahmen"
    elif wood_type == "classic_double":
        wood_frame_cm = 2 * (width + length) * 2
        m_price_rahmen = round(prod_prices["keilrahmen_classic_1m"] * 2, 2)
        price_frame = wood_frame_cm * cm_classic
        holzrahmen = "Classic 45 - Doppelrahmen"
    else:  # museo
        wood_frame_cm = 2 * (width + length)
        m_price_rahmen = round(prod_prices["keilrahmen_museo_1m"], 2)
        price_frame = wood_frame_cm * cm_museo
        holzrahmen = "Museo 45"

    wood_support_cm = anz_strebe_lang * length + anz_strebe_kurz * width
    price_support = wood_support_cm * cm_classic
    price_frame = round(price_frame, 2)
    price_support = round(price_support, 2)

    price_glue_color = round(
        qcm_glue * qcm_liquids + qcm_color * qcm_liquids * 6, 2
    )
    qm_liquids = round(qcm_liquids / 10_000, 2)
    qm_glue_color_per_m2 = round((qcm_glue + qcm_color) * 10_000, 2)

    total_material = round((fabric_price + price_frame + price_support + price_glue_color) * 20) / 20

    verkauf = round(total_material * markup_factor * 20) / 20

    rows = [
        {
            "produkt": f"Tuch ({fabric_type})",
            "stueckpreis": f"{qm_price_tuch} CHF/m²",
            "anzahl": f"{qm_fabric_size} m²",
            "betrag": f"{fabric_price:.2f}",
        },
        {
            "produkt": f"Holzrahmen ({holzrahmen})",
            "stueckpreis": f"{m_price_rahmen} CHF/m",
            "anzahl": f"{round(wood_frame_cm / 100, 2)} m",
            "betrag": f"{price_frame:.2f}",
        },
    ]
    if anz_strebe_lang > 0 or anz_strebe_kurz > 0:
        rows.append({
            "produkt": "Zwischenstück (Classic 45)",
            "stueckpreis": f"{prod_prices['keilrahmen_classic_1m']} CHF/m",
            "anzahl": f"{round(wood_support_cm / 100, 2)} m",
            "betrag": f"{price_support:.2f}",
        })
    rows.append({
        "produkt": "Leim & Farbe",
        "stueckpreis": f"{qm_glue_color_per_m2} CHF/m²",
        "anzahl": f"{qm_liquids} m²",
        "betrag": f"{price_glue_color:.2f}",
    })

    return {
        "rows": rows,
        "total_material": f"{total_material:.2f}",
        "verkaufspreis": f"{verkauf:.2f}",
    }


def _runde_halbwert(x):
    return round(round(x * 2) / 2, 2)


def berechne_material(items):
    mat_prices, _ = load_all()

    groups = {}
    total = 0.0

    for item in items:
        kategorie = item["kategorie"]
        name = item["name"]
        preis_key = item["preis_key"]
        menge = float(item["menge"])

        einheitspreis = mat_prices[preis_key]
        gesamtpreis = _runde_halbwert(einheitspreis * menge)
        total += gesamtpreis

        if kategorie not in groups:
            groups[kategorie] = {"rows": [], "subtotal": 0.0}
        groups[kategorie]["rows"].append({
            "produkt": name,
            "preis_einheit": f"{einheitspreis:.2f} CHF",
            "menge": f"{menge:.4g}",
            "gesamtpreis": f"{gesamtpreis:.2f} CHF",
        })
        groups[kategorie]["subtotal"] += gesamtpreis

    result_groups = {}
    for k, v in groups.items():
        result_groups[k] = {
            "rows": v["rows"],
            "subtotal": f"{_runde_halbwert(v['subtotal']):.2f} CHF",
        }

    return {
        "groups": result_groups,
        "total": f"{_runde_halbwert(total):.2f} CHF",
    }


def get_preisanpassung_data(
    a_baumwolle=0.18, b_baumwolle=1.51, y0_baumwolle=0.0,
    a_baumwolle_o=3.47, b_baumwolle_o=0.66, y0_baumwolle_o=26.04,
    a_leinen=6.39, b_leinen=0.9, y0_leinen=34.2,
):
    import os

    # ── pure-Python linspace (no numpy) ──────────────────────────────────────
    def linspace(start, stop, n):
        if n == 1:
            return [start]
        return [start + (stop - start) * i / (n - 1) for i in range(n)]

    # ── material cost for a square canvas of given area ───────────────────────
    def mat_area(area_m2, fabric, support):
        side = math.sqrt(area_m2 * 10_000)
        anz_lang, anz_kurz = SUPPORT_MAP[support]
        _, prod = load_all()
        qcm_arles = prod["arles_4x10m2_roll"] / (4 * 100_000)
        qcm_leine = prod["leine_2x10m2_roll"] / (2 * 100_000)
        cm_cl  = prod["keilrahmen_classic_1m"] / 100
        qcm_gl = prod["leim_5l"] / ((50 / 1.5) * 10_000)
        qcm_co = prod["farbe_5l"] / ((50 / 0.6) * 10_000)
        qcm_f, qcm_liq = _qcm_berechnen(side, side, "classic_double")
        fp = (qcm_arles if fabric == "Baumwolle" else qcm_leine) * qcm_f
        wp = (2 * (side + side) * 2 + (anz_lang + anz_kurz) * side) * cm_cl
        lp = (qcm_gl + qcm_co * 6) * qcm_liq
        return round(fp + wp + lp, 2)

    def verk_curve(mat_list, a, b, y0):
        return [round(a * (m ** b) + y0, 2) for m in mat_list]

    LABELS = {
        "no_support":              "Kein Zwischenstück",
        "single_support":          "Eins",
        "double_support_cross":    "Zwei (Kreuz)",
        "double_support_parallel": "Zwei (Parallel)",
        "triple_support":          "Drei (Doppelkreuz)",
        "quad_support":            "Vier (Viererkreuz)",
    }

    supports_b = [
        ("no_support",              linspace(0.01, 1.58, 80)),
        ("single_support",          linspace(1.58, 10.0, 80)),
    ]
    supports_l = [
        ("no_support",              linspace(0.01, 0.64, 80)),
        ("single_support",          linspace(0.144, 1.68, 80)),
        ("double_support_cross",    linspace(0.378, 3.2,  80)),
        ("double_support_parallel", linspace(0.64,  4.41, 80)),
        ("triple_support",          linspace(1.68,  7.0,  80)),
        ("quad_support",            linspace(4.41,  10.0, 80)),
    ]

    curves_b, curves_l = [], []

    for sup, xs in supports_b:
        mat = [mat_area(x, "Baumwolle", sup) for x in xs]
        is_large = sup == "single_support"
        verk = (verk_curve(mat, a_baumwolle_o, b_baumwolle_o, y0_baumwolle_o)
                if is_large else
                verk_curve(mat, a_baumwolle, b_baumwolle, y0_baumwolle))
        curves_b.append({"label": LABELS[sup], "x": [round(v, 4) for v in xs], "y": verk})

    for sup, xs in supports_l:
        mat  = [mat_area(x, "Leinen", sup) for x in xs]
        verk = verk_curve(mat, a_leinen, b_leinen, y0_leinen)
        curves_l.append({"label": LABELS[sup], "x": [round(v, 4) for v in xs], "y": verk})

    # ── CSV scatter points (stdlib csv, no pandas) ────────────────────────────
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    csv_path = os.path.join(data_dir, "Preisliste_DR_Classic.csv")

    scatter_b, scatter_l = [], []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                area = float(row["Fläche_m2"]) / 10_000
            except (ValueError, KeyError):
                continue
            bp = row.get("Baumwolle_preis", "").strip()
            lp = row.get("Leinen_preis",    "").strip()
            if bp:
                try:
                    scatter_b.append({"x": round(area, 4), "y": float(bp)})
                except ValueError:
                    pass
            if lp:
                try:
                    scatter_l.append({"x": round(area, 4), "y": float(lp)})
                except ValueError:
                    pass

    return {
        "curves_baumwolle": curves_b,
        "curves_leinen":    curves_l,
        "scatter_baumwolle": scatter_b,
        "scatter_leinen":    scatter_l,
    }
