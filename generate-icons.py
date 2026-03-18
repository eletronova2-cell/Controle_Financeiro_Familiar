#!/usr/bin/env python3
"""
Gera os ícones PNG necessários para o PWA a partir do icon.svg.
Execute UMA VEZ antes do primeiro deploy:
  cd controle-financeiro
  python3 generate-icons.py
Requer: pip install cairosvg pillow
"""
try:
    import cairosvg
    from PIL import Image
    import io, os

    svg_path = os.path.join(os.path.dirname(__file__), "public", "icon.svg")
    out_dir  = os.path.join(os.path.dirname(__file__), "public")

    sizes = {
        "pwa-192x192.png": 192,
        "pwa-512x512.png": 512,
        "apple-touch-icon.png": 180,
    }

    for filename, size in sizes.items():
        png_bytes = cairosvg.svg2png(url=svg_path, output_width=size, output_height=size)
        img = Image.open(io.BytesIO(png_bytes))
        img.save(os.path.join(out_dir, filename))
        print(f"  ✓ {filename} ({size}x{size})")

    print("\nÍcones gerados com sucesso!")

except ImportError:
    print("Dependências não encontradas. Execute:")
    print("  pip install cairosvg pillow")
    print("\nOu gere manualmente os arquivos PNG em /public:")
    print("  pwa-192x192.png  (192x192)")
    print("  pwa-512x512.png  (512x512)")
    print("  apple-touch-icon.png (180x180)")
