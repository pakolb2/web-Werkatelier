import json
import os

_dir = os.path.dirname(os.path.abspath(__file__))
_materialpreise_path = os.path.join(_dir, "materialpreise.json")
_leinwandpreise_path = os.path.join(_dir, "leinwandpreise.json")

# ── In-memory runtime cache ───────────────────────────────────────────────────
# Populated on first load; updated immediately when prices are saved via the UI.
# Survives within the current server process — prices won't reset mid-session
# even on Render's ephemeral filesystem.
_cache: dict = {}

# ── Defaults (used when nothing else is available) ────────────────────────────

default_preise_materialverkauf = {
    "baumwolle_qm":     11.0,
    "leinen_qm":        30.0,
    "classic_single_m":  6.5,
    "classic_double_m": 13.0,
    "museo_m":          20.0,
    "support_m":         6.5,
    "binder_l":         15.0,
    "farbe_l":          11.0,
}

default_preise_leinwandproduktion = {
    "arles_4x10m2_roll":     214.0,
    "leine_2x10m2_roll":     293.25,
    "keilrahmen_classic_1m":   3.75,
    "keilrahmen_museo_1m":    11.0,
    "leim_5l":                54.6,
    "farbe_5l":               33.53,
}


def _load_file(path, fallback):
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"Warning: could not load {path}: {e}")
    return dict(fallback)


def load_all():
    """
    Priority order:
      1. Runtime cache (updated when prices are saved via UI)
      2. PRICES_MATERIAL / PRICES_CANVAS env vars (set in Render dashboard)
      3. JSON files committed to the repo
      4. Hard-coded defaults
    """
    if _cache:
        return _cache["material"], _cache["canvas"]

    env_mat = os.environ.get("PRICES_MATERIAL")
    env_can = os.environ.get("PRICES_CANVAS")
    if env_mat and env_can:
        try:
            mat = json.loads(env_mat)
            can = json.loads(env_can)
            _cache["material"] = mat
            _cache["canvas"]   = can
            return mat, can
        except Exception as e:
            print(f"Warning: could not parse price env vars: {e}")

    mat = _load_file(_materialpreise_path, default_preise_materialverkauf)
    can = _load_file(_leinwandpreise_path, default_preise_leinwandproduktion)
    _cache["material"] = mat
    _cache["canvas"]   = can
    return mat, can


def save_all(material_prices: dict, canvas_prices: dict) -> tuple[bool, str, str]:
    """
    Save prices.  Returns (saved_to_disk, json_material, json_canvas).
    The JSON strings are returned so the caller can show them as Render env-var hints.
    """
    _cache["material"] = material_prices
    _cache["canvas"]   = canvas_prices

    json_mat = json.dumps(material_prices, ensure_ascii=False)
    json_can = json.dumps(canvas_prices,   ensure_ascii=False)

    saved_to_disk = False
    try:
        with open(_materialpreise_path, "w", encoding="utf-8") as f:
            json.dump(material_prices, f, indent=4, ensure_ascii=False)
        with open(_leinwandpreise_path, "w", encoding="utf-8") as f:
            json.dump(canvas_prices, f, indent=4, ensure_ascii=False)
        saved_to_disk = True
    except Exception as e:
        print(f"Warning: could not write price files: {e}")

    return saved_to_disk, json_mat, json_can
