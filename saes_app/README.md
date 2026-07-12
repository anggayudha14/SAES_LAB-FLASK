# S-AES Lab — Web Simulasi Simplified AES

Aplikasi web (Flask) untuk simulasi enkripsi & dekripsi **Simplified AES (S-AES)**
lengkap dengan tampilan detail setiap langkah perhitungan: Key Expansion,
SubNibbles/InvSubNibbles, ShiftRows/InvShiftRows, MixColumns/InvMixColumns,
AddRoundKey, hingga detail perkalian di GF(2⁴).

## Struktur Proyek

```
saes_app/
├── app.py              # Flask app & endpoint API
├── saes_core.py         # Implementasi murni algoritma S-AES (tanpa Flask)
├── requirements.txt
├── templates/
│   └── index.html       # Tampilan utama (Bootstrap 5)
└── static/
    ├── css/style.css     # Tema "Cipher Lab" (dark, modern)
    └── js/app.js         # Logika form, panggilan API, render langkah-langkah
```

## Cara Menjalankan

1. Pastikan Python 3.9+ terpasang.
2. (Opsional tapi disarankan) buat virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   ```
3. Install dependensi:
   ```bash
   pip install -r requirements.txt
   ```
4. Jalankan server:
   ```bash
   python app.py
   ```
5. Buka browser ke:
   ```
   http://127.0.0.1:5000
   ```

## Cara Pakai

1. Pilih mode **Enkripsi** atau **Dekripsi**.
2. Isi kolom **Plaintext/Ciphertext** (16-bit biner, hanya `0` dan `1`).
3. Isi kolom **Kunci** (16-bit biner).
4. Klik **SUBMIT** untuk melihat hasil dan seluruh langkah perhitungan
   (Key Expansion, Initial AddRoundKey, Round 1, Round 2, hasil akhir).
5. Klik **RESET** untuk mengosongkan form, atau **Contoh** untuk mengisi nilai uji.

### Contoh nilai uji (cocok untuk perhitungan manual)

| Item        | Biner              | Hex   |
|-------------|--------------------|-------|
| Plaintext   | 1101011100101000   | D728  |
| Kunci       | 0100101011110101   | 4AF5  |
| Ciphertext  | 0010010011101100   | 24EC  |

(Sudah diverifikasi: enkripsi nilai di atas menghasilkan `24EC`,
dan dekripsi `24EC` dengan kunci yang sama mengembalikan `D728`.)

## Spesifikasi Algoritma yang Diimplementasikan

- GF(2⁴) dengan polinomial irredusibel `x⁴ + x + 1` (`0x13`)
- S-Box & Inverse S-Box 4-bit
- Key Expansion: `w0..w5` → `K0, K1, K2`
- SubNibbles / InvSubNibbles
- ShiftRows / InvShiftRows (self-invers)
- MixColumns / InvMixColumns dengan matriks `[[1,4],[4,1]]` dan `[[9,2],[2,9]]`
- AddRoundKey
- Alur Enkripsi: `AddRoundKey(K0) → Round1(Sub,Shift,Mix,ARK-K1) → Round2(Sub,Shift,ARK-K2)`
- Alur Dekripsi: `AddRoundKey(K2) → InvRound1(Shift,Sub,ARK-K1,InvMix) → InvRound2(Shift,Sub,ARK-K0)`

Semua fungsi inti algoritma ada di `saes_core.py` dan bisa diuji mandiri
(tanpa Flask) dengan menjalankan:

```bash
python saes_core.py
```

File ini menjalankan 200 uji round-trip acak (enkripsi lalu dekripsi harus
menghasilkan kembali plaintext semula) sebagai sanity check.
