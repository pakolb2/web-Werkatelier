import csv
import math
import os
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

WOOD_LABELS = {
    "classic_single": "Classic 45 – Einfach",
    "classic_double": "Classic 45 – Doppel",
    "museo":          "Museo 45",
}

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


# ── Support auto-selection (mirrors JS autoSupport()) ─────────────────────────

def auto_support(length: float, width: float) -> tuple[int, int, str]:
    """Return (anz_lang, anz_kurz, label) for a canvas after normalising so length >= width."""
    l, w = max(length, width), min(length, width)
    if l < 70:                      return 0, 0, "Kein Zwischenstück"
    if l < 80:                      return 0, 0, "Kein Zwischenstück"
    if l < 210 and w < 80:          return 0, 1, "Eins"
    if l < 210:                     return 1, 1, "Zwei (Kreuz)"
    if w < 80:                      return 0, 2, "Zwei (Parallel)"
    if w < 210:                     return 1, 2, "Drei (Doppelkreuz)"
    return 2, 2, "Vier (Viererkreuz)"


# ── Frame-type comparison ─────────────────────────────────────────────────────

def compare_canvas(length: float, width: float, fabric_type: str,
                   markup_factor: float = 4.2) -> list[dict]:
    """Calculate all three wood types for one canvas and return them as a list."""
    al, ak, sup_label = auto_support(length, width)
    results = []
    for wood in ("classic_single", "classic_double", "museo"):
        r = berechne_leinwand(length, width, fabric_type, wood, al, ak, markup_factor)
        r["wood_label"]   = WOOD_LABELS[wood]
        r["wood_key"]     = wood
        r["support_label"] = sup_label
        results.append(r)
    return results


# ── Pre-calculated price list ─────────────────────────────────────────────────

_STANDARD_SIZES = [
    (18,24),(24,30),(30,30),(30,40),(40,40),(40,50),(50,50),(50,60),(50,70),
    (60,60),(60,80),(70,70),(70,100),(80,80),(80,100),(80,120),
    (100,100),(100,120),(100,140),(100,150),(120,120),(120,150),(150,150),(150,200),
]

def generate_preisliste(markup_factor: float = 4.2) -> list[dict]:
    """
    Returns a list of rows, one per size.
    Each row: {label, area_m2, support_label, prices: {fabric: {wood: verkaufspreis}}}
    """
    rows = []
    for l_in, w_in in _STANDARD_SIZES:
        l, w = max(l_in, w_in), min(l_in, w_in)
        al, ak, sup_label = auto_support(l, w)
        prices: dict = {}
        for fabric in ("Baumwolle", "Leinen"):
            prices[fabric] = {}
            for wood in ("classic_single", "classic_double", "museo"):
                r = berechne_leinwand(l, w, fabric, wood, al, ak, markup_factor)
                prices[fabric][wood] = r["verkaufspreis"]
        rows.append({
            "label":       f"{l_in}×{w_in}",
            "area_m2":     round(l * w / 10_000, 2),
            "support":     sup_label,
            "prices":      prices,
        })
    return rows


# ── Reference-price chart data (from the supplier CSV tables) ─────────────────

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

_CSV_MAP = {
    # wood_type → (filename, area_col, baumwolle_col, leinen_col)
    # area column holds cm² values (divide by 10 000 → m²)
    "classic_double": ("Preisliste_DR_Classic.csv",    "Fläche_m2",       "Baumwolle_preis", "Leinen_preis"),
    "classic_single": ("Preisliste_SR_Classic.csv",    "size",             "price_baumwolle", "price_Leinen"),
    "museo":          ("Preisliste_Museo_Classic.csv", "size",             "price_baumwolle", "price_Leinen"),
}

def get_csv_chart_data(wood_type: str, fabric: str) -> list[dict]:
    """
    Return sorted list of {area_m2, price} dicts read directly from the
    supplier price-list CSVs (the raw reference prices, not computed markup).
    """
    entry = _CSV_MAP.get(wood_type, _CSV_MAP["classic_double"])
    filename, area_col, baumwolle_col, leinen_col = entry
    price_col = baumwolle_col if fabric == "Baumwolle" else leinen_col

    csv_path = os.path.join(_DATA_DIR, filename)
    points: list[dict] = []

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                area_m2   = float(row[area_col]) / 10_000
                price_str = row.get(price_col, "").strip()
                if not price_str:
                    continue
                points.append({"area_m2": round(area_m2, 5), "price": float(price_str)})
            except (ValueError, KeyError):
                continue

    points.sort(key=lambda p: p["area_m2"])
    return points
