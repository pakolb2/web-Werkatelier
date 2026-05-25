import json
import os

_dir = os.path.dirname(os.path.abspath(__file__))
_materialpreise_path = os.path.join(_dir, "materialpreise.json")
_leinwandpreise_path = os.path.join(_dir, "leinwandpreise.json")

default_preise_materialverkauf = {
    "baumwolle_qm": 11.0,
    "leinen_qm": 30.0,
    "classic_single_m": 6.5,
    "classic_double_m": 13.0,
    "museo_m": 20.0,
    "support_m": 6.5,
    "binder_l": 15.0,
    "farbe_l": 11.0,
}

default_preise_leinwandproduktion = {
    "arles_4x10m2_roll": 214.0,
    "leine_2x10m2_roll": 293.25,
    "keilrahmen_classic_1m": 3.75,
    "keilrahmen_museo_1m": 11.0,
    "leim_5l": 54.6,
    "farbe_5l": 33.53,
}


def _load(path, fallback):
    try:
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except Exception as e:
        print(f"Fehler beim Laden von {path}: {e}")
    return dict(fallback)


def load_all():
    return (
        _load(_materialpreise_path, default_preise_materialverkauf),
        _load(_leinwandpreise_path, default_preise_leinwandproduktion),
    )


def save_all(material_prices, canvas_prices):
    with open(_materialpreise_path, "w") as f:
        json.dump(material_prices, f, indent=4)
    with open(_leinwandpreise_path, "w") as f:
        json.dump(canvas_prices, f, indent=4)
