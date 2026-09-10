# Tipografías

| Archivo         | Familia CSS    | Fuente          | Peso/estilo real     | Uso                                    |
| ---------------- | -------------- | --------------- | --------------------- | --------------------------------------- |
| `display.ttf`    | `KioskDisplay` | URW DIN Cond    | **Bold** (700)         | La palabra elegida, titulares, botones |
| `body.otf`       | `KioskBody`    | Gotham Book     | Book ≈ Regular (400)   | Frases, textos de interfaz            |
| `script.ttf`     | `KioskScript`  | Square Peg      | Regular (400), NO cursiva | "Tú Eres Inolvidable" (pantalla 01) |
| `script-OFL.txt` | —              | —               | —                      | Licencia de Square Peg (Open Font License) |

> `script.ttf` fue **Arapey Italic** hasta que se comprobó contra el Figma, que
> pide **Square Peg**. Son fuentes muy distintas: Arapey es una serif con
> cursiva, Square Peg es manuscrita informal.
>
> Ojo con el estilo al declararla: Square Peg tiene `italicAngle: 0` y no marca
> ITALIC en su `fsSelection`. Mientras estuvo registrada como `style: 'italic'`
> en `FONT_FACES`, el navegador le añadía una inclinación sintética sobre una
> letra que ya viene manuscrita. Va como `'normal'`.

No se cargan por `@font-face` en CSS: un `@font-face` normal no se descarga
hasta que un elemento del DOM lo usa, y pintar en canvas no cuenta. Se
registran a mano con la API `FontFace` en
[`src/lib/assets.ts`](../../src/lib/assets.ts) (`ensureFontsReady`), a partir
del manifiesto `FONT_FACES` en [`src/config.ts`](../../src/config.ts). Si
algún archivo faltara, la carga falla en silencio y la app cae al stack de
respaldo del sistema — sigue funcionando, pero la pieza exportada no lleva la
tipografía de marca.

Verificado con `document.fonts` (las tres cargan, `status: 'loaded'`) y con
`measureText` en canvas real (el ancho de un mismo texto difiere entre la
fuente registrada y su respaldo) que las tres se aplican de verdad, no solo
que "cargan".

## Historial de `display.ttf`

La primera entrega de este archivo era un **subconjunto roto de solo 85
glifos** (nombre interno `OLJZIJ+URWDINCond-Regular` — el prefijo `OLJZIJ+`
es la marca estándar que dejan las herramientas de subsetting), al que le
faltaban F, O, X, Y, Z, varios dígitos y **todas** las vocales acentuadas.
Se notaba letra por letra: "FEROZ" o "AUDAZ" salían con alguna letra en una
tipografía visiblemente distinta al resto.

El archivo actual es el corte **Bold completo** de URW DIN Condensed — 649
glifos, cobertura 100 % del alfabeto español (mayúsculas y minúsculas
acentuadas, Ñ, dígitos, puntuación habitual). Verificado con `fontTools` y
confirmado visualmente componiendo piezas reales con palabras que antes
fallaban ("FEROZ", "AUDAZ", "ÚNICA"). Sin problemas pendientes.

Para verificar la cobertura de glifos de un archivo de fuente nuevo (con
Python + `fonttools`, `pip install fonttools`):

```python
from fontTools.ttLib import TTFont
f = TTFont('display.ttf')
cmap = f.getBestCmap()
alfabeto = 'AÁÉÍÓÚÑBCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
faltan = [c for c in alfabeto if ord(c) not in cmap]
print('faltan:', faltan or 'ninguno — completo')
```

## `body.otf` y `script.ttf`

Verificados con la misma herramienta desde la primera entrega: **cobertura
completa** del alfabeto español. No han requerido corrección.
