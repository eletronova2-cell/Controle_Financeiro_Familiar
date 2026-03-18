#!/usr/bin/env python3
"""Gera PNGs placeholder simples para o PWA funcionar sem cairosvg."""
import struct, zlib, os

def make_png(size, r, g, b):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", c)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(size):
        row = b"\x00"
        for _ in range(size):
            row += struct.pack("BBB", r, g, b)
        raw += row
    idat = zlib.compress(raw)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", idat)
            + chunk(b"IEND", b""))

out = os.path.join(os.path.dirname(__file__), "public")
os.makedirs(out, exist_ok=True)

# Dark bg color #0f1117 = 15, 17, 23
for name, sz in [("pwa-192x192.png", 192), ("pwa-512x512.png", 512), ("apple-touch-icon.png", 180)]:
    path = os.path.join(out, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(make_png(sz, 15, 17, 23))
        print(f"Criado: {name}")
    else:
        print(f"Já existe: {name}")
