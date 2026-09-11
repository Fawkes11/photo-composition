"""
Monta la comparativa visual del bake-off.

    .venv/Scripts/python.exe bakeoff/build_report.py

Compone cada recorte sobre el ROJO DE MARCA, no sobre blanco ni sobre un
tablero de ajedrez. Es deliberado: los errores que importan son los que se van
a ver en la pieza final, y sobre ese rojo concreto. Un halo claro que sobre
blanco pasa desapercibido, sobre el rojo canta.

Genera además un zoom de la zona de la cabeza, que es donde se decide: el pelo
es el caso difícil y el que separa a un modelo de otro.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).parent
ENTRADA = RAIZ / "input"
SALIDA = RAIZ / "salida"
INFORME = SALIDA / "report.html"

ROJO = (142, 12, 30)  # BRAND.colors.primaryDeep del kiosco
METODOS = ["mediapipe", "u2net", "isnet", "isnet-matting"]
ANCHO = 260


def cargar_mascara(metodo: str, nombre: str) -> Image.Image | None:
    ruta = SALIDA / metodo / f"{Path(nombre).stem}_mask.png"
    return Image.open(ruta).convert("L") if ruta.exists() else None


def componer(original: Image.Image, mascara: Image.Image) -> Image.Image:
    """Recorte sobre el rojo de marca."""
    if mascara.size != original.size:
        mascara = mascara.resize(original.size, Image.LANCZOS)
    fondo = Image.new("RGB", original.size, ROJO)
    fondo.paste(original, (0, 0), mascara)
    return fondo


def main() -> None:
    fotos = sorted(ENTRADA.glob("*.png"), key=lambda p: int(p.stem) if p.stem.isdigit() else 0)
    comp_dir = SALIDA / "_comparativa"
    comp_dir.mkdir(parents=True, exist_ok=True)

    tiempos_py = json.loads((SALIDA / "tiempos.json").read_text(encoding="utf-8"))
    mp_meta_path = SALIDA / "mediapipe" / "tiempos.json"
    tiempos_mp = json.loads(mp_meta_path.read_text(encoding="utf-8")) if mp_meta_path.exists() else {}

    filas: list[str] = []

    for foto in fotos:
        original = Image.open(foto).convert("RGB")
        escala = ANCHO / original.width
        alto = int(original.height * escala)

        celdas = [f'<td><img src="../input/{foto.name}"><div class="pie">original</div></td>']

        # Zoom a la cabeza: tercio superior, mitad central. Ahí está el pelo.
        zw, zh = original.width // 2, original.height // 3
        zx = (original.width - zw) // 2
        caja_zoom = (zx, 0, zx + zw, zh)
        zooms = [f'<td><img src="../input/{foto.name}" style="object-fit:none"></td>']

        for metodo in METODOS:
            mascara = cargar_mascara(metodo, foto.name)
            if mascara is None:
                celdas.append('<td class="falta">sin datos</td>')
                zooms.append('<td class="falta">—</td>')
                continue

            compuesta = componer(original, mascara)
            nombre_out = f"{foto.stem}_{metodo}.png"
            compuesta.resize((ANCHO, alto), Image.LANCZOS).save(comp_dir / nombre_out)

            zoom = compuesta.crop(caja_zoom)
            zoom = zoom.resize((ANCHO, int(zoom.height * ANCHO / zoom.width)), Image.LANCZOS)
            nombre_zoom = f"{foto.stem}_{metodo}_zoom.png"
            zoom.save(comp_dir / nombre_zoom)

            ms = tiempos_mp.get(foto.name, {}).get("ms") if metodo == "mediapipe" else tiempos_py.get(metodo, {}).get(foto.name)
            etiqueta = f"{metodo} · {ms:.0f} ms" if ms else metodo
            celdas.append(f'<td><img src="_comparativa/{nombre_out}"><div class="pie">{etiqueta}</div></td>')
            zooms.append(f'<td><img src="_comparativa/{nombre_zoom}"></td>')

        filas.append(f'<tr class="sep"><td colspan="5" class="titulo">{foto.name}</td></tr>')
        filas.append("<tr>" + "".join(celdas) + "</tr>")
        filas.append('<tr class="zoom">' + "".join(zooms) + "</tr>")

    resumen = []
    for metodo in METODOS:
        if metodo == "mediapipe":
            t = [v["ms"] for v in tiempos_mp.values()] if tiempos_mp else []
        else:
            t = list(tiempos_py.get(metodo, {}).values())
        if t:
            resumen.append(f"<li><b>{metodo}</b> — media {sum(t)/len(t):.0f} ms (min {min(t):.0f} · max {max(t):.0f})</li>")

    INFORME.write_text(
        f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Bake-off de recorte</title>
<style>
 body{{background:#141414;color:#eee;font:13px/1.5 ui-monospace,monospace;padding:24px;margin:0}}
 h1{{font-size:17px;margin:0 0 4px}}
 p.sub{{color:#999;margin:0 0 20px}}
 ul{{color:#ccc}}
 table{{border-collapse:collapse}}
 td{{padding:4px;vertical-align:top;text-align:center}}
 td img{{display:block;width:{ANCHO}px;border-radius:4px}}
 .pie{{color:#aaa;padding-top:4px;font-size:12px}}
 .titulo{{text-align:left;color:#ffb;padding-top:26px;font-size:14px}}
 .falta{{color:#f66}}
 tr.zoom td img{{border:1px solid #333}}
 tr.zoom::after{{content:''}}
</style></head><body>
<h1>Bake-off de recorte — MediaPipe contra rembg</h1>
<p class="sub">Cada recorte compuesto sobre el rojo de marca, que es donde se van a ver los fallos.
La segunda fila de cada foto amplía la zona de la cabeza: el pelo es lo que separa a un modelo de otro.</p>
<ul>{''.join(resumen)}</ul>
<table>{''.join(filas)}</table>
</body></html>""",
        encoding="utf-8",
    )
    print(f"Informe en {INFORME}")


if __name__ == "__main__":
    main()
