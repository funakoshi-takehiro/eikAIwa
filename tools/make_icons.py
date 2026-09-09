#!/usr/bin/env python3
"""
アプリアイコンを生成する。

この環境には PIL も ImageMagick も無いため、zlib と struct だけで PNG を書く。
依存パッケージを増やさない方針（社内の既存プロダクトと同じ）にも合っている。

デザイン:
  - 背景: ブランド teal の 135度グラデーション (#028DAE → #015F78) の角丸正方形
  - 前景: 白い吹き出し（会話＝英会話アプリ）に、社の命名モチーフである
          大文字の "AI" を teal で重ねる
  - maskable 版は角丸を付けず全面を塗り、内容を安全領域(中央80%)に収める

使い方:  python3 tools/make_icons.py
"""
import os
import struct
import zlib

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "icons"))

BRAND = (0x02, 0x8D, 0xAE)
BRAND_DEEP = (0x01, 0x5F, 0x78)
WHITE = (0xFF, 0xFF, 0xFF)

SS = 3  # スーパーサンプリング倍率（アンチエイリアス用）


# ---------------------------------------------------------------- PNG 書き出し
def write_png(path, w, h, rgba):
    """rgba: bytearray, 長さ w*h*4"""
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)  # フィルタ種別 None
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


# ---------------------------------------------------------------- 図形
def rounded_rect_hit(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    # 角の内側だけ円で判定
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= r * r


def poly_hit(x, y, pts):
    """交差数法。pts は [(x,y), ...]"""
    inside = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


def tri_hit(x, y, a, b, c):
    return poly_hit(x, y, [a, b, c])


def lerp(c0, c1, t):
    return (
        int(round(c0[0] + (c1[0] - c0[0]) * t)),
        int(round(c0[1] + (c1[1] - c0[1]) * t)),
        int(round(c0[2] + (c1[2] - c0[2]) * t)),
    )


# ---------------------------------------------------------------- 描画
def build(size, maskable=False):
    """1ピクセルごとに SSxSS 回サンプリングして色を平均する。"""
    S = size * SS
    # レイヤ判定を関数で持ち、サンプル点ごとに評価する
    if maskable:
        # マスカブルは全面塗り。内容は中央 80% の安全領域に収める
        pad = S * 0.10
        corner = 0.0
        content_scale = 0.80
    else:
        pad = 0.0
        corner = S * 0.22
        content_scale = 1.0

    cx = S / 2.0
    cy = S / 2.0
    cs = S * content_scale

    # 吹き出し（角丸長方形 + しっぽ）
    bw = cs * 0.62
    bh = cs * 0.46
    bx0 = cx - bw / 2
    bx1 = cx + bw / 2
    by0 = cy - bh / 2 - cs * 0.045
    by1 = by0 + bh
    br = bh * 0.30

    tail = [
        (cx - bw * 0.20, by1 - 1),
        (cx - bw * 0.02, by1 - 1),
        (cx - bw * 0.26, by1 + cs * 0.13),
    ]

    # "AI" のストローク
    lw = cs * 0.052              # 線幅
    ah = bh * 0.46               # 文字高さ
    ay0 = (by0 + by1) / 2 - ah / 2
    ay1 = ay0 + ah
    aw = ah * 0.78               # A の幅
    a_cx = cx - cs * 0.075       # A の中心
    i_x = cx + cs * 0.115        # I の位置

    a_left = [
        (a_cx - aw / 2, ay1), (a_cx - aw / 2 + lw * 1.15, ay1),
        (a_cx + lw * 0.55, ay0), (a_cx - lw * 0.55, ay0),
    ]
    a_right = [
        (a_cx + aw / 2 - lw * 1.15, ay1), (a_cx + aw / 2, ay1),
        (a_cx + lw * 0.55, ay0), (a_cx - lw * 0.55, ay0),
    ]
    bar_y = ay0 + ah * 0.66
    a_bar = (a_cx - aw * 0.30, bar_y, a_cx + aw * 0.30, bar_y + lw * 0.92)
    i_bar = (i_x - lw * 0.5, ay0, i_x + lw * 0.5, ay1)

    buf = bytearray(size * size * 4)
    inv = 1.0 / (SS * SS)

    for py in range(size):
        for px in range(size):
            rs = gs = bs = as_ = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    x = px * SS + sx + 0.5
                    y = py * SS + sy + 0.5

                    # 背景（角丸 + グラデーション 135度）
                    if not rounded_rect_hit(x, y, pad, pad, S - pad, S - pad, corner):
                        continue
                    t = ((x / S) + (y / S)) / 2.0
                    col = lerp(BRAND, BRAND_DEEP, t)
                    a = 255

                    # 吹き出し（白）
                    in_bubble = (rounded_rect_hit(x, y, bx0, by0, bx1, by1, br)
                                 or tri_hit(x, y, tail[0], tail[1], tail[2]))
                    if in_bubble:
                        col = WHITE

                        # "AI"（teal）
                        in_ai = (
                            poly_hit(x, y, a_left) or poly_hit(x, y, a_right)
                            or (a_bar[0] <= x <= a_bar[2] and a_bar[1] <= y <= a_bar[3])
                            or (i_bar[0] <= x <= i_bar[2] and i_bar[1] <= y <= i_bar[3])
                        )
                        if in_ai:
                            col = lerp(BRAND, BRAND_DEEP, t)

                    rs += col[0]; gs += col[1]; bs += col[2]; as_ += a

            o = (py * size + px) * 4
            if as_ <= 0:
                buf[o:o + 4] = b"\x00\x00\x00\x00"
            else:
                # 色は「塗られたサンプル」の平均、アルファは被覆率
                n = as_ / 255.0
                buf[o] = int(round(rs / n))
                buf[o + 1] = int(round(gs / n))
                buf[o + 2] = int(round(bs / n))
                buf[o + 3] = int(round(as_ * inv))
    return buf


FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#028DAE"/>
      <stop offset="1" stop-color="#015F78"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M18 16h28a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H30l-9 8v-8h-3a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5z"
        fill="#ffffff"/>
  <g fill="url(#g)">
    <path d="M26.4 36.5l4.6-13h2.9l4.6 13h-3.1l-.95-2.9h-4.1l-.95 2.9zM31.1 31.2h2.7l-1.35-4.2z"/>
    <rect x="40.2" y="23.5" width="2.9" height="13" rx=".6"/>
  </g>
</svg>
"""


def main():
    os.makedirs(OUT, exist_ok=True)

    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in targets:
        buf = build(size, maskable)
        path = os.path.join(OUT, name)
        write_png(path, size, size, buf)
        print("  %-26s %4dx%-4d %7d bytes" % (name, size, size, os.path.getsize(path)))

    svg_path = os.path.join(OUT, "favicon.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(FAVICON_SVG)
    print("  %-26s %18d bytes" % ("favicon.svg", os.path.getsize(svg_path)))


if __name__ == "__main__":
    main()
