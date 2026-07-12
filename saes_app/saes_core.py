# -*- coding: utf-8 -*-
"""
saes_core.py
Implementasi lengkap Simplified AES (S-AES) beserta pencatatan (trace)
setiap langkah perhitungan: Key Expansion, SubNibbles, InvSubNibbles,
ShiftRows, InvShiftRows, MixColumns, InvMixColumns, AddRoundKey,
serta operasi Galois Field GF(2^4) dengan polinomial irredusibel x^4+x+1 (0x13).

Representasi state:
    16 bit plaintext/ciphertext dibagi menjadi 4 nibble (4 bit):
        n0 = bit 0-3   (nibble paling signifikan)
        n1 = bit 4-7
        n2 = bit 8-11
        n3 = bit 12-15 (nibble paling tidak signifikan)

    Disusun sebagai state matrix 2x2:
        | s00  s01 |     | n0  n2 |
        | s10  s11 |  =  | n1  n3 |
"""

# ---------------------------------------------------------------------------
# Konstanta S-AES
# ---------------------------------------------------------------------------

SBOX = [0x9, 0x4, 0xA, 0xB, 0xD, 0x1, 0x8, 0x5,
        0x6, 0x2, 0x0, 0x3, 0xC, 0xE, 0xF, 0x7]

INV_SBOX = [0xA, 0x5, 0x9, 0xB, 0x1, 0x7, 0x8, 0xF,
            0x6, 0x0, 0x2, 0x3, 0xC, 0x4, 0xD, 0xE]

MIX_MATRIX = [[1, 4], [4, 1]]
INV_MIX_MATRIX = [[9, 2], [2, 9]]

RCON1 = 0x80  # 1000 0000
RCON2 = 0x30  # 0011 0000

GF_POLY = 0x13  # x^4 + x + 1
GF_POLY_BITS = "10011"  # representasi 5-bit dari x^4+x+1


# ---------------------------------------------------------------------------
# Operasi Galois Field GF(2^4)
# ---------------------------------------------------------------------------

def gf_add(a, b):
    """Penjumlahan di GF(2^4) = XOR biasa."""
    return a ^ b


def gf_mult_trace(a, b):
    """
    Perkalian di GF(2^4) menggunakan metode 'peasant multiplication'
    dengan reduksi modulo x^4 + x + 1 (0x13).
    Mengembalikan (hasil, daftar_langkah) agar bisa ditampilkan detail
    perhitungannya di antarmuka.
    """
    a &= 0xF
    b &= 0xF
    result = 0
    steps = []
    aa, bb = a, b
    for i in range(4):
        bit = bb & 1
        before = result
        if bit:
            result ^= aa
        hi = 1 if (aa & 0x8) else 0
        shifted = (aa << 1) & 0x1F
        reduced = shifted
        did_reduce = False
        if hi:
            reduced = shifted ^ GF_POLY
            did_reduce = True
        reduced &= 0xF
        steps.append({
            "iter": i + 1,
            "a": aa,
            "b_bit": bit,
            "result_before": before,
            "result_after": result,
            "a_shifted": shifted & 0xF,
            "carry_out": hi,
            "reduced": did_reduce,
            "a_next": reduced,
        })
        aa = reduced
        bb >>= 1
    return result, steps


def gf_mult(a, b):
    return gf_mult_trace(a, b)[0]


# ---------------------------------------------------------------------------
# Util representasi
# ---------------------------------------------------------------------------

def bin_to_int(bits, width=16):
    return int(bits, 2) & ((1 << width) - 1)


def int_to_bin(val, width):
    return format(val, "0{}b".format(width))


def nibble_to_bin(n):
    return format(n & 0xF, "04b")


def state_from_int(val):
    """Pecah nilai 16-bit menjadi 4 nibble & susun sebagai state matrix."""
    n0 = (val >> 12) & 0xF
    n1 = (val >> 8) & 0xF
    n2 = (val >> 4) & 0xF
    n3 = val & 0xF
    return {"s00": n0, "s10": n1, "s01": n2, "s11": n3}


def state_to_int(state):
    return (state["s00"] << 12) | (state["s10"] << 8) | (state["s01"] << 4) | state["s11"]


def clone_state(state):
    return dict(state)


# ---------------------------------------------------------------------------
# Transformasi S-AES
# ---------------------------------------------------------------------------

def sub_nibbles(state, box=SBOX):
    return {k: box[v] for k, v in state.items()}


def shift_rows(state):
    """Menggeser baris kedua (s10, s11) satu posisi. Operasi ini self-invers."""
    return {
        "s00": state["s00"], "s01": state["s01"],
        "s10": state["s11"], "s11": state["s10"],
    }


def mix_columns(state, matrix=MIX_MATRIX):
    """
    Mengalikan setiap kolom state dengan matriks MixColumns di GF(2^4).
    Mengembalikan (state_baru, detail) dengan detail berisi jejak
    perkalian GF untuk setiap elemen hasil.
    """
    s00, s10 = state["s00"], state["s10"]
    s01, s11 = state["s01"], state["s11"]

    def col_calc(top, bot):
        p1, tr1 = gf_mult_trace(matrix[0][0], top)
        p2, tr2 = gf_mult_trace(matrix[0][1], bot)
        new_top = p1 ^ p2

        p3, tr3 = gf_mult_trace(matrix[1][0], top)
        p4, tr4 = gf_mult_trace(matrix[1][1], bot)
        new_bot = p3 ^ p4

        return new_top, new_bot, {
            "top_terms": [
                {"coef": matrix[0][0], "val": top, "product": p1, "trace": tr1},
                {"coef": matrix[0][1], "val": bot, "product": p2, "trace": tr2},
            ],
            "top_result": new_top,
            "bot_terms": [
                {"coef": matrix[1][0], "val": top, "product": p3, "trace": tr3},
                {"coef": matrix[1][1], "val": bot, "product": p4, "trace": tr4},
            ],
            "bot_result": new_bot,
        }

    new_s00, new_s10, col0_detail = col_calc(s00, s10)
    new_s01, new_s11, col1_detail = col_calc(s01, s11)

    new_state = {"s00": new_s00, "s10": new_s10, "s01": new_s01, "s11": new_s11}
    detail = {"col0": col0_detail, "col1": col1_detail, "matrix": matrix}
    return new_state, detail


def add_round_key(state, key_state):
    return {k: state[k] ^ key_state[k] for k in state}


# ---------------------------------------------------------------------------
# Key Expansion
# ---------------------------------------------------------------------------

def rot_word(w):
    """Menukar posisi 2 nibble dalam word 8-bit."""
    hi = (w >> 4) & 0xF
    lo = w & 0xF
    return (lo << 4) | hi


def sub_word(w, box=SBOX):
    hi = (w >> 4) & 0xF
    lo = w & 0xF
    return (box[hi] << 4) | box[lo]


def key_expansion(key_val):
    w0 = (key_val >> 8) & 0xFF
    w1 = key_val & 0xFF

    rw1 = rot_word(w1)
    sw1 = sub_word(rw1)
    w2 = w0 ^ sw1 ^ RCON1

    w3 = w2 ^ w1

    rw3 = rot_word(w3)
    sw3 = sub_word(rw3)
    w4 = w2 ^ sw3 ^ RCON2

    w5 = w4 ^ w3

    K0 = (w0 << 8) | w1
    K1 = (w2 << 8) | w3
    K2 = (w4 << 8) | w5

    trace = {
        "w0": w0, "w1": w1,
        "rot_w1": rw1, "sub_rot_w1": sw1, "rcon1": RCON1, "w2": w2,
        "w3": w3,
        "rot_w3": rw3, "sub_rot_w3": sw3, "rcon2": RCON2, "w4": w4,
        "w5": w5,
        "K0": K0, "K1": K1, "K2": K2,
    }
    return K0, K1, K2, trace


# ---------------------------------------------------------------------------
# Encrypt / Decrypt (lengkap dengan trace tiap langkah)
# ---------------------------------------------------------------------------

def encrypt(plaintext_val, key_val):
    K0, K1, K2, kexp_trace = key_expansion(key_val)
    steps = {}

    state = state_from_int(plaintext_val)
    k0_state = state_from_int(K0)
    steps["initial"] = {
        "label": "Initial AddRoundKey",
        "before": clone_state(state),
        "key": k0_state,
        "key_val": K0,
    }
    state = add_round_key(state, k0_state)
    steps["initial"]["after"] = clone_state(state)

    # Round 1
    r1 = {}
    r1["sub_before"] = clone_state(state)
    state = sub_nibbles(state, SBOX)
    r1["sub_after"] = clone_state(state)

    r1["shift_before"] = clone_state(state)
    state = shift_rows(state)
    r1["shift_after"] = clone_state(state)

    r1["mix_before"] = clone_state(state)
    state, mix_detail = mix_columns(state, MIX_MATRIX)
    r1["mix_after"] = clone_state(state)
    r1["mix_detail"] = mix_detail

    k1_state = state_from_int(K1)
    r1["ark_before"] = clone_state(state)
    r1["ark_key"] = k1_state
    r1["ark_key_val"] = K1
    state = add_round_key(state, k1_state)
    r1["ark_after"] = clone_state(state)
    steps["round1"] = r1

    # Round 2 (final, tanpa MixColumns)
    r2 = {}
    r2["sub_before"] = clone_state(state)
    state = sub_nibbles(state, SBOX)
    r2["sub_after"] = clone_state(state)

    r2["shift_before"] = clone_state(state)
    state = shift_rows(state)
    r2["shift_after"] = clone_state(state)

    k2_state = state_from_int(K2)
    r2["ark_before"] = clone_state(state)
    r2["ark_key"] = k2_state
    r2["ark_key_val"] = K2
    state = add_round_key(state, k2_state)
    r2["ark_after"] = clone_state(state)
    steps["round2"] = r2

    ciphertext_val = state_to_int(state)
    keys = {"K0": K0, "K1": K1, "K2": K2, "kexp_trace": kexp_trace}
    return ciphertext_val, steps, keys


def decrypt(ciphertext_val, key_val):
    K0, K1, K2, kexp_trace = key_expansion(key_val)
    steps = {}

    state = state_from_int(ciphertext_val)
    k2_state = state_from_int(K2)
    steps["initial"] = {
        "label": "Initial AddRoundKey (dengan K2)",
        "before": clone_state(state),
        "key": k2_state,
        "key_val": K2,
    }
    state = add_round_key(state, k2_state)
    steps["initial"]["after"] = clone_state(state)

    # Inverse Round 1: InvShiftRows, InvSubNibbles, AddRoundKey(K1), InvMixColumns
    r1 = {}
    r1["shift_before"] = clone_state(state)
    state = shift_rows(state)  # self-invers
    r1["shift_after"] = clone_state(state)

    r1["sub_before"] = clone_state(state)
    state = sub_nibbles(state, INV_SBOX)
    r1["sub_after"] = clone_state(state)

    k1_state = state_from_int(K1)
    r1["ark_before"] = clone_state(state)
    r1["ark_key"] = k1_state
    r1["ark_key_val"] = K1
    state = add_round_key(state, k1_state)
    r1["ark_after"] = clone_state(state)

    r1["mix_before"] = clone_state(state)
    state, mix_detail = mix_columns(state, INV_MIX_MATRIX)
    r1["mix_after"] = clone_state(state)
    r1["mix_detail"] = mix_detail
    steps["round1"] = r1

    # Inverse Round 2: InvShiftRows, InvSubNibbles, AddRoundKey(K0)
    r2 = {}
    r2["shift_before"] = clone_state(state)
    state = shift_rows(state)
    r2["shift_after"] = clone_state(state)

    r2["sub_before"] = clone_state(state)
    state = sub_nibbles(state, INV_SBOX)
    r2["sub_after"] = clone_state(state)

    k0_state = state_from_int(K0)
    r2["ark_before"] = clone_state(state)
    r2["ark_key"] = k0_state
    r2["ark_key_val"] = K0
    state = add_round_key(state, k0_state)
    r2["ark_after"] = clone_state(state)
    steps["round2"] = r2

    plaintext_val = state_to_int(state)
    keys = {"K0": K0, "K1": K1, "K2": K2, "kexp_trace": kexp_trace}
    return plaintext_val, steps, keys


# ---------------------------------------------------------------------------
# Self-test sederhana ketika file dijalankan langsung
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import random

    for _ in range(200):
        p = random.randint(0, 0xFFFF)
        k = random.randint(0, 0xFFFF)
        c, _, _ = encrypt(p, k)
        p2, _, _ = decrypt(c, k)
        assert p == p2, f"Round-trip gagal! p={p:04x} k={k:04x} c={c:04x} p2={p2:04x}"

    # Uji nilai tetap
    p = 0b1101011100101000
    k = 0b0100101011110101
    c, steps, keys = encrypt(p, k)
    p2, _, _ = decrypt(c, k)
    print("Plaintext :", format(p, "016b"))
    print("Key       :", format(k, "016b"))
    print("K0,K1,K2  :", format(keys["K0"], "04x"), format(keys["K1"], "04x"), format(keys["K2"], "04x"))
    print("Ciphertext:", format(c, "016b"), "=", format(c, "04X"))
    print("Decrypt   :", format(p2, "016b"), "OK" if p2 == p else "MISMATCH")
    print("Semua 200 uji round-trip acak: BERHASIL")
