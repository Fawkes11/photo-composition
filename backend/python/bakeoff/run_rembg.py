"""
Pasa las fotos de `input/` por varios modelos de rembg y guarda máscaras y
tiempos.

    .venv/Scripts/python.exe bakeoff/run_rembg.py

Por qué varios modelos y no solo el que viene por defecto: `u2net` es el más
flojo en pelo, y probar solo con él daría un "no vale la pena" por el motivo
equivocado. Lo que puede mover la aguja es la resolución de inferencia y el
alpha matting, que es el mecanismo pensado justo para pelo y semitransparencias.

La comparación contra MediaPipe NO se hace aquí: sus máscaras se exportan desde
el propio kiosco (ver export_mediapipe.mjs), porque reimplementarlo en Python
compararía rembg contra otra cosa, no contra lo que corre en el tótem.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

RAIZ = Path(__file__).parent
ENTRADA = RAIZ / "input"
SALIDA = RAIZ / "salida"

# (carpeta, modelo, kwargs). El alpha matting va aparte para poder medir cuánto
# aporta por sí solo, que es la pregunta interesante.
VARIANTES: list[tuple[str, str, dict]] = [
    ("u2net", "u2net", {}),
    ("isnet", "isnet-general-use", {}),
    ("isnet-matting", "isnet-general-use", {
        "alpha_matting": True,
        "alpha_matting_foreground_threshold": 240,
        "alpha_matting_background_threshold": 20,
        "alpha_matting_erode_size": 5,
    }),
]


def fotos() -> list[Path]:
    return sorted(ENTRADA.glob("*.png"), key=lambda p: int(p.stem) if p.stem.isdigit() else 0)


def main() -> None:
    imagenes = fotos()
    if not imagenes:
        print(f"No hay imágenes en {ENTRADA}")
        return

    print(f"{len(imagenes)} fotos · {len(VARIANTES)} variantes\n")
    medidas: dict[str, dict[str, float]] = {}

    for carpeta, modelo, kwargs in VARIANTES:
        destino = SALIDA / carpeta
        destino.mkdir(parents=True, exist_ok=True)

        print(f"--- {carpeta} ({modelo}) ---")
        t0 = time.time()
        # La sesión se crea una sola vez por modelo: incluye la carga de los
        # pesos, que es lo caro. Crearla por imagen falsearía los tiempos.
        sesion = new_session(modelo)
        print(f"   modelo cargado en {time.time() - t0:.1f} s")

        medidas[carpeta] = {}
        for ruta in imagenes:
            origen = Image.open(ruta).convert("RGB")
            t = time.time()
            recorte = remove(origen, session=sesion, **kwargs)
            ms = (time.time() - t) * 1000
            medidas[carpeta][ruta.name] = round(ms, 1)

            recorte.save(destino / ruta.name)
            # La máscara sola, en escala de grises: es lo que se compara.
            recorte.getchannel("A").save(destino / f"{ruta.stem}_mask.png")
            print(f"   {ruta.name:>8}  {ms:7.0f} ms")

        tiempos = list(medidas[carpeta].values())
        print(f"   media {sum(tiempos) / len(tiempos):.0f} ms\n")

    (SALIDA / "tiempos.json").write_text(json.dumps(medidas, indent=2), encoding="utf-8")
    print(f"Listo. Resultados en {SALIDA}")


if __name__ == "__main__":
    main()
