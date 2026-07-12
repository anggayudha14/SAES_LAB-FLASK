# -*- coding: utf-8 -*-
"""
app.py - Aplikasi Web Simulasi Simplified AES (S-AES)
Dijalankan dengan: python app.py
Lalu buka http://127.0.0.1:5000 di browser.
"""

from flask import Flask, render_template, request, jsonify

import saes_core as saes

app = Flask(__name__)


@app.route("/")
def index():
    return render_template(
        "index.html",
        sbox=saes.SBOX,
        inv_sbox=saes.INV_SBOX,
        mix_matrix=saes.MIX_MATRIX,
        inv_mix_matrix=saes.INV_MIX_MATRIX,
        rcon1=saes.RCON1,
        rcon2=saes.RCON2,
    )


def _validate_bits(value, name):
    value = (value or "").strip()
    if len(value) != 16 or any(c not in "01" for c in value):
        return f"{name} harus berupa 16 digit biner (hanya karakter 0 dan 1)."
    return None


@app.route("/api/process", methods=["POST"])
def process():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode")
    input_bits = data.get("input", "")
    key_bits = data.get("key", "")

    err = _validate_bits(input_bits, "Plaintext/Ciphertext")
    if err:
        return jsonify({"error": err}), 400

    err = _validate_bits(key_bits, "Kunci")
    if err:
        return jsonify({"error": err}), 400

    if mode not in ("encrypt", "decrypt"):
        return jsonify({"error": "Mode harus 'encrypt' atau 'decrypt'."}), 400

    input_val = saes.bin_to_int(input_bits)
    key_val = saes.bin_to_int(key_bits)

    if mode == "encrypt":
        output_val, steps, keys = saes.encrypt(input_val, key_val)
    else:
        output_val, steps, keys = saes.decrypt(input_val, key_val)

    response = {
        "mode": mode,
        "input": {
            "bin": saes.int_to_bin(input_val, 16),
            "hex": format(input_val, "04X"),
        },
        "key": {
            "bin": saes.int_to_bin(key_val, 16),
            "hex": format(key_val, "04X"),
        },
        "output": {
            "bin": saes.int_to_bin(output_val, 16),
            "hex": format(output_val, "04X"),
        },
        "keys": {
            "K0": {"val": keys["K0"], "bin": saes.int_to_bin(keys["K0"], 16), "hex": format(keys["K0"], "04X")},
            "K1": {"val": keys["K1"], "bin": saes.int_to_bin(keys["K1"], 16), "hex": format(keys["K1"], "04X")},
            "K2": {"val": keys["K2"], "bin": saes.int_to_bin(keys["K2"], 16), "hex": format(keys["K2"], "04X")},
            "kexp_trace": keys["kexp_trace"],
        },
        "steps": steps,
    }
    return jsonify(response)


if __name__ == "__main__":
    app.run(debug=True)
