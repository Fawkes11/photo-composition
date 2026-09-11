# Kiosco · Sé Inolvidable

Frontend de la app de kiosco para la activación. Vite + React + TypeScript,
Tailwind, Zustand, canvas 2D nativo, MediaPipe y `qrcode`.

Todo se sirve desde `/public`: **una vez cargada la página no se toca la red**.
No hay backend; la subida de la pieza final es un stub.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run check    # verificaciones sin navegador (tipos, color y ajuste de texto)
npm run typecheck # solo TypeScript (ojo: `tsc --noEmit` a secas NO comprueba nada)
npm run shots    # capturas de las 5 pantallas en dev/shots (necesita npm run dev)
```

> La cámara necesita `localhost` o HTTPS. Si sirves el kiosco por IP en la red
> local, `getUserMedia` no arrancará sin certificado.

---

## Config: una sola fuente de verdad

Todo lo ajustable vive en [`src/config.ts`](src/config.ts). No hay valores
mágicos repartidos por los componentes: resoluciones, coordenadas, tiempos,
palabras, estilos fotográficos y textos salen de ahí.

| Bloque         | Qué controla                                                    |
| -------------- | --------------------------------------------------------------- |
| `DESIGN`       | Lienzo de autoría de la UI (1080x1920), escalado por CSS         |
| `EXPORT`       | Tamaño de la pieza final                                         |
| `CAMERA`       | Constraints, espejo de preview y de captura                      |
| `FRAMING`      | Guía de medio cuerpo, umbrales de validación, histéresis         |
| `DETECTION`    | Rutas de wasm/modelos, FPS de inferencia, fallback de 8 s        |
| `TIMING`       | Inactividad (45 s), cuenta regresiva, mínimo de la pantalla 04   |
| `PERSON`       | Caja, anclaje y escala de la persona; umbral, erosión y feather  |
| `TEXT_LAYERS`  | Cajas, tipografías, rangos de tamaño y sombras de los dos textos |
| `LAYERS`       | Rutas de los PNG y colores de los placeholders                   |
| `PHOTO_STYLES` | Los tres estilos fotográficos con todos sus parámetros           |
| `WORDS`        | Las 30 palabras y sus frases                                     |
| `LAYOUT`       | Geometría de cada pantalla, medida sobre las maquetas            |
| `BRAND_ARC`    | El arco blanco con el logotipo que corona las pantallas          |
| `IMAGES`       | Rutas de los recursos de interfaz, entregados y pendientes       |
| `MISSING_ASSET`| Marcadores de material pendiente (`show: false` los apaga)       |
| `FONT_FACES`   | Manifiesto real de las 3 tipografías: family/archivo/peso/estilo |
| `PIECE_LOGO`   | Posición, ancho y color del logo al pie de la pieza exportada    |
| `CLAIM_TEXT`   | Titular "SÉ INOLVIDABLE" de la pieza, que dibuja la app          |
| `DECOR`        | Haces de luz y destellos: aspecto compartido y anatomía del flare |
| `DEBUG`        | Interruptores de depuración — **todos a `false` para la activación** |

**Dos coordenadas, un solo mapeo.** La UI se escribe en px de `DESIGN` y se
escala una vez por CSS ([`Stage`](src/components/Stage.tsx)). La validación del
encuadre traduce la caja del rostro de px de vídeo a px de escenario con el
mismo mapeo *cover* que usa el `<video>` y que usará la captura
([`geometry.ts`](src/lib/geometry.ts)). Si los tres no coincidieran, la guía
mentiría.

---

## Flujo

Máquina de estados en Zustand, sin router
([`kioskStore.ts`](src/store/kioskStore.ts)). Cada pantalla se monta con `key`
propia: al salir de la 03 se desmonta de verdad y la cámara suelta sus tracks.

| # | Pantalla                                            | Notas                                                          |
| - | --------------------------------------------------- | -------------------------------------------------------------- |
| 01 | [Inicio](src/screens/StartScreen.tsx)              | Cualquier toque avanza. Precarga wasm, modelos y capas.         |
| 02 | [Palabra](src/screens/WordScreen.tsx)              | 30 opciones en una columna, scroll contenido.                   |
| 03 | [Foto](src/screens/CaptureScreen.tsx)              | Guía de medio cuerpo, detección, cuenta regresiva.              |
| 04 | [Procesando](src/screens/ProcessingScreen.tsx)     | Corre el pipeline. Mínimo 1,5 s en pantalla.                    |
| 05 | [Resultado](src/screens/ResultScreen.tsx)          | Pieza + QR, "TOMAR DE NUEVO" y "FINALIZAR".                     |

### Pantalla 03 en detalle

- Detección con **BlazeFace**, limitada a `DETECTION.previewFps` y saltando
  frames repetidos del vídeo.
- Se valida: **un solo rostro**, centro dentro de `FRAMING.headZone`, y ancho
  del rostro dentro de `FRAMING.faceWidthRatio` (la distancia).
- El estado se confirma por frames consecutivos y con histéresis: sin eso la
  guía parpadea cada vez que alguien respira.
- **Nunca se bloquea al usuario.** Dos escapes, ambos con temporizador propio y
  no colgados del bucle de rAF (si el navegador estrangula los frames, tienen
  que saltar igual):
  - a los **8 s sin ninguna detección** —incluido que el modelo no cargue— se
    pasa a `fallback` y el botón se habilita con el encuadre por defecto;
  - a los **16 s pase lo que pase** (`DETECTION.forceEnableAfterMs`), por si el
    modelo sí ve a la persona pero nunca da el encuadre por bueno. Sin este
    segundo escape, a quien el validador no aprueba nunca —alguien en silla de
    ruedas, una niña, alguien a contraluz— se le quedaría el botón apagado.
- Para calibrar la guía, pon `DEBUG.framingHud = true` en `config.ts`: dibuja
  la caja del rostro detectado, la zona objetivo y un panel con los números en
  vivo que decide `evaluateFraming`. Hazlo con la cámara real del kiosco: el
  campo de visión y la distancia de una selfie de celular no se parecen a los
  de una webcam de escritorio, y los umbrales saldrían mal calibrados.

---

## Pipeline de composición

Canvas offscreen al tamaño real de exportación
([`pipeline.ts`](src/compose/pipeline.ts)):

1. **FONDO** — PNG del diseñador + el titular "SÉ INOLVIDABLE", que dibuja la
   app porque el PNG entregado no lo trae incrustado (`CLAIM_TEXT`).
2. **MEDIO** — la persona segmentada, sin fondo, ya tratada.
3. **FRENTE** — PNG del diseñador + la palabra, la frase y el logo, que
   renderiza la app.

Sobre la capa MEDIO ([`segmentation.ts`](src/vision/segmentation.ts)):
segmentación con **MediaPipe Selfie Segmentation**, umbral, erosión y
**difuminado de 2,5 px del borde de la máscara** antes de componer
(`PERSON.featherPx`). Sin ese difuminado el recorte se ve duro.

La segmentación corre sobre `frame.bitmap` a su **resolución nativa capturada**
— nunca sobre el recuadro ya reescalado al tamaño de la caja de la persona.
Reescalar primero y segmentar después le entrega al modelo una imagen ya
suavizada por el remuestreo, y el borde de la máscara sale peor definido. La
máscara resultante se recorta con exactamente la misma región (`source`) que
se usa para el color en [`pipeline.ts`](src/compose/pipeline.ts) — si no,
máscara y foto quedan desalineadas entre sí.

La polaridad de la máscara se detecta sola: se mide la confianza en una banda
perimetral —que en un encuadre de medio cuerpo es fondo por definición— y si
sale alta, la máscara se invierte. Así no depende de qué índice de categoría
devuelva el build de MediaPipe que toque.

### Tratamiento de imagen

En este orden ([`imageTreatment.ts`](src/compose/imageTreatment.ts)), todo
parametrizado por estilo:

1. **Suavizado de piel** — desenfoque selectivo: se mezcla la versión
   desenfocada solo donde el detalle local es bajo. Ojos, pestañas, cejas y
   labios quedan intactos. El blur lo hace el navegador; solo la mezcla es JS.
2. **Color grading** — LUT `.cube` con interpolación trilineal, y **fallback de
   curvas por canal** (interpolación monótona Fritsch-Carlson) mientras el
   diseñador no entregue la LUT.
3. **Glow** — copia desenfocada con bright-pass, compuesta en `screen` al 25 %.
4. **Viñeteado radial**.

La segmentación corre sobre el recorte **sin tratar**: la LUT y el viñeteado
mueven los colores y el modelo acierta menos sobre una imagen ya graduada.

### Ajuste automático de texto

[`textLayout.ts`](src/lib/textLayout.ts) mide con `measureText` y baja el
`fontSize` hasta que el bloque entra en su caja. Prueba, en orden: una línea →
partir por el punto si hay dos oraciones → reparto por palabras. Con las 30
frases actuales ninguna baja de 63 px (`npm run check:text` lo verifica).

Cada bloque declara además `verticalAlign`. La frase usa `bottom`: en la
composición de referencia su línea base queda a solo ~24 px del techo de la
palabra, así que si una frase de dos líneas creciera desde el centro invadiría
la palabra. Anclada abajo, crece hacia arriba y el hueco se mantiene.

### Calibración contra la composición de referencia

Las medidas de `TEXT_LAYERS`, `PIECE_LOGO` y `CLAIM_TEXT` no están puestas a
ojo: se sacaron de la composición final del diseñador midiendo el ancho de
cada texto y resolviendo, con la fuente real ya cargada en el navegador, qué
`fontSize` produce ese ancho (`measureText`) y dónde cae la línea media
(`actualBoundingBoxAscent`/`Descent` con `textBaseline: 'middle'`).

| Bloque             | Ancho en el referente | Resultado                        |
| ------------------ | --------------------- | -------------------------------- |
| `SÉ INOLVIDABLE`   | ~956 px               | 158 px, línea media en y≈284     |
| `AUDAZ` (palabra)  | ~400 px               | 160 px, línea media en y≈1581    |
| Frase              | ~740 px               | 63 px, anclada abajo en y≈1494   |
| Logotipo           | ~250 px               | 100 px de margen inferior        |

El alto de mayúscula medido cuadró con el del referente (117 px vs. ~112
estimados en la palabra; 44 vs. ~46 en la frase), lo que confirma que las
proporciones son las del diseño y no una aproximación.

### Haces de luz y destellos

Los dos son **procedurales**, no imágenes: nada que esperar del diseñador y
escalan a cualquier resolución.

- **Haces** ([`LightBeam.tsx`](src/components/LightBeam.tsx)) — son el vector
  **exportado del Figma**, no una aproximación: una astilla blanca afilada con
  DOS copias del mismo trazo apiladas y desenfocadas a distinta intensidad
  (blur 7.6 y 11.2), que ya vienen dentro del SVG. Se mezclan en `overlay`,
  que es el modo del Figma. Se probaron antes una línea con blur y una cuña de
  `conic-gradient`; ninguna se parecía, porque la forma real se afila por las
  dos puntas. El blur se sale de la caja del grupo, así que el SVG se pinta un
  poco más grande (`bleed` en `DECOR.beamAssets`) — sin compensarlo el haz sale
  desplazado y con las puntas recortadas.
- **Destellos** ([`LensFlare.tsx`](src/components/LensFlare.tsx)) — se
  descartó `js.lensflare`: no está publicada en npm (es un script suelto de
  CodePen) y lo que hay en el registro es para three.js/aframe o monta un
  WebGL entero, caro y frágil para un tótem con gráficos integrados. Se dibuja
  la anatomía real del efecto en canvas 2D: núcleo, raya anamórfica y cadena
  de fantasmas sobre el eje fuente→centro, con hexágonos de diafragma y un
  anillo con franja cromática. **Se pinta una sola vez, sin bucle de
  animación**: después de pintar el coste de CPU es cero.

Posiciones por pantalla en `LAYOUT.<pantalla>.beams` y `.flares`; los assets y
el aspecto compartido, en `DECOR`.

**La geometría de las pantallas 01, 02 y 05 está medida directamente del
Figma** (archivo `zgyHuJ3qhU23ycy80Te7nL`), leído por el MCP de Figma: no hay
valores puestos a ojo. Los tamaños de fuente se derivaron midiendo con la
tipografía real qué `fontSize` produce el ancho de cada caja de texto del
Figma.

### Tipografías

Un `@font-face` normal de CSS no se descarga hasta que un elemento del DOM lo
usa — pintar texto en canvas no cuenta como "uso" para el navegador. Por eso
**no hay `@font-face` en `index.css`**: cada tipografía se registra a mano con
la API `FontFace`, se fuerza su descarga con `.load()` y se añade al registro
global con `document.fonts.add()` — el mismo registro que usa el DOM, así que
una vez cargada sirve para los dos ([`ensureFontsReady`](src/lib/assets.ts)).
`composePiece` la espera siempre antes de dibujar.

El manifiesto (`family`/archivo/peso/estilo) vive en `FONT_FACES`
(`src/config.ts`). Cada familia (`KioskDisplay`, `KioskBody`, `KioskScript`)
registra un único `FontFace`, así que en la práctica cualquier peso/estilo que
se pida para esa familia acaba resolviendo a esa misma cara — no hay otra
entre la que el navegador pueda "perderse". Aun así, `weight`/`style` en
`FONT_FACES` se mantienen fieles al archivo real (verificado con `fontTools`:
`display.ttf` es Bold/700, `body.otf` es Book≈400, `script.ttf` es Italic/400)
y `fontWeight` en `TEXT_LAYERS` coincide con eso — es la documentación viva de
qué corte es cada archivo, útil el día que llegue una segunda variante
(p. ej. un Regular de DIN Cond) y SÍ importe cuál es cuál.

### Logotipo

El wordmark de Revlon vive como un solo `<path>` vectorial en
[`src/lib/brandLogo.ts`](src/lib/brandLogo.ts) — única fuente de verdad, con
dos consumidores que nunca se pueden desincronizar:

- [`RevlonLogo.tsx`](src/components/RevlonLogo.tsx) — componente React
  reusable (`width`, `color`) para el arco de marca
  ([`BrandArc.tsx`](src/components/BrandArc.tsx)) y cualquier otro sitio de la UI.
- `loadLogoBitmap(color, width)` — rasteriza el mismo trazado a un
  `ImageBitmap`, cacheado por color+ancho, para componerlo en el canvas de la
  pieza final (`PIECE_LOGO` en config, dibujado al pie por `pipeline.ts`).

Ojo si tocas `brandLogo.ts`: `createImageBitmap()` alimentado directamente con
un `Blob` de SVG **no es fiable en Chromium** — falla con `InvalidStateError:
The source image could not be decoded` incluso con `width`/`height` explícitos
en la raíz del SVG. El camino que sí funciona en todos los motores es
decodificar primero a través de un `<img>` (su pipeline de carga de imágenes
sí soporta SVG) y recién ahí pedirle a `createImageBitmap` un bitmap de esa
imagen ya decodificada — no del blob crudo.

---

## Estado de la entrega

**Funcionando:** las cinco pantallas, la máquina de estados, cámara + guía +
detección + fallback, el pipeline completo (con las tres tipografías reales,
el logotipo oficial y la segmentación a resolución nativa), el ajuste de
texto, el QR, el modo kiosco y el reset por inactividad.

**Pendiente de recibir.** La app funciona sin ello y lo adopta sola en cuanto
el archivo aparezca con el nombre esperado — no hay que tocar código. Todo lo
que falta se señala en pantalla con un **marcador turquesa** (`FALTA · …`), así
la maqueta se puede revisar entera sabiendo exactamente qué queda pendiente:

| Qué                        | Dónde va                       | Mientras tanto                  |
| -------------------------- | ------------------------------ | ------------------------------- |
| LUT `.cube`                 | `public/luts/`                 | Curvas por canal de `PHOTO_STYLES` |

**El fondo terciopelo de la pantalla 04 tampoco está pendiente: no existe.**
Salía del brief inicial, pero el diseño no lo recogió: en el Figma las cuatro
pantallas con fondo (01, 02, 04 y 05) apuntan al MISMO nodo, con idéntica
posición y tamaño. La 04 usa `backdrop.png` como las demás, y la variante
`deep` del componente se eliminó. Mientras existió, esa pantalla pedía un
archivo que nadie iba a entregar y arrastraba el marcador turquesa en cada pase.

**La capa FRENTE ya no está pendiente: no existe.** Figuraba aquí un
`front-default.png` que nadie iba a entregar, porque lo que va por encima de la
persona no es un PNG sino texto — la palabra que eligió el usuario, su frase y
el wordmark, que la app dibuja en cada pieza (`drawWordText` / `drawLogo`).
Además su placeholder pintaba un marco rojo sobre el fondo rojo de la pieza y
acababa leyéndose como parte del diseño en vez de como un aviso. Se quitó la
capa por defecto; una palabra concreta puede seguir declarando `frontLayer` si
alguna vez hace falta un grafismo delante (ver `public/layers/README.md`).

Ya entregados y wireados: el logotipo, las tres tipografías, el fondo de la
pieza (`public/layers/back-default.png`), el fondo de las pantallas de UI
(`public/images/backdrop.png`), la marca de labios y el mockup del móvil.
Ojo: el fondo de las **pantallas de UI** (rojo profundo) y el de **la pieza
exportada** (rosa con haces marcados) son piezas distintas, no intercambiables.
`public/fonts/display.ttf` (URW DIN Cond) pasó por dos entregas: la primera
era un subconjunto roto de solo 85 glifos (le faltaban F, O, X, Y, Z, varios
dígitos y todas las vocales acentuadas — se notaba letra por letra en
palabras como "FEROZ" o "AUDAZ"); la segunda, ya en uso, es el corte **Bold**
completo (649 glifos, cobertura 100 % del alfabeto español, verificado con
`fontTools`). `mockup-phone.png` se re-exportó con canal alfa (verificado: 53,7 % de
píxeles transparentes) y ya no arrastra el fondo negro que traía.

**El fondo entregado no incluye "SÉ INOLVIDABLE".** El brief decía que ese
texto venía dentro del PNG de FONDO; el archivo real no lo trae, así que lo
dibuja la app (`CLAIM_TEXT` en config, pintado por `pipeline.ts` justo encima
del fondo y por debajo de la persona — el mismo orden del desglose de capas
del diseñador). Si algún día llega un FONDO con el texto ya incrustado, poner
`CLAIM_TEXT.render` en `false` o saldrá dos veces.

Como el titular va **detrás** de la persona, una cabeza muy alta puede taparle
la base. En la composición de referencia no pasa, pero si en feria se nota,
se sube `CLAIM_TEXT.centerY` o se baja `PERSON.box.y`.

Para una demo al cliente, `MISSING_ASSET.show = false` en `src/config.ts` apaga
todos los marcadores de golpe sin quitar nada del código.

**Stub:** [`upload.ts`](src/lib/upload.ts) no envía nada; genera un id local y
devuelve la URL que codifica el QR, para poder probar el flujo de punta a punta.
Cuando exista el endpoint, solo cambia el cuerpo de esa función — la firma se
mantiene a propósito.

**Asumido:** el brief traía un placeholder «ANCHO x ALTO» sin rellenar para la
pieza de exportación. Se ha asumido **1080 x 1920**, igual que el diseño. Se
cambia en `EXPORT` (`src/config.ts`) y el resto del pipeline se adapta solo.

**Cambiado respecto al brief inicial, siguiendo las maquetas:** la pantalla 02
usa **una columna**, no la retícula de tres que pedía el texto original. Se
controla con `LAYOUT.word.columns`. Y en la pieza final la **frase va encima de
la palabra** (`Eres inolvidable por ser` / `AUDAZ`), no debajo.

---

## Kiosco

- Sin scroll de documento, sin rebote ni pull-to-refresh, sin menú contextual,
  sin selección de texto, sin zoom por pellizco ni por doble toque.
  El único contenedor con scroll es la pantalla 02 (`touch-action: pan-y` +
  `overscroll-behavior: contain`).
- **Reset a la pantalla 01 tras 45 s de inactividad** en cualquier paso, con
  aviso en los últimos 8 s.
- Al salir de la pantalla de cámara se paran todos los tracks del stream.
- **Memoria:** los detectores de MediaPipe son singleton (crear y destruir el
  heap del wasm 300 veces al día es lo que hincha la pestaña); los lienzos
  temporales se reutilizan desde un pool
  ([`canvasPool.ts`](src/lib/canvasPool.ts)); y cada `reset`/`retake` cierra el
  `ImageBitmap` y revoca el object URL de la sesión.

---

## Depuración

Los interruptores viven en `DEBUG` (`src/config.ts`). **Todos tienen que
quedar en `false` antes de la activación** — se pintan en el turquesa de los
marcadores de material pendiente justamente para que canten si se olvidan
encendidos.

| Interruptor     | Qué hace                                                       |
| --------------- | -------------------------------------------------------------- |
| `downloadPiece` | Botón al pie de la pantalla 05 que descarga la pieza a resolución real, con sus dimensiones y peso en la etiqueta. En producción la pieza se entrega por QR. |
| `framingHud`    | HUD de calibración de la guía en la pantalla 03 (ver arriba).   |

El archivo sale como `pieza-<palabra>-<fecha>.jpg`. Para revisar la
composición sin montar la cámara, el banco de pruebas
[`/dev/pipeline-check.html`](dev/pipeline-check.html) la compone partiendo de
la foto de la modelo.

---

## Verificación

`npm run check` corre sin navegador, con Node:

- `typecheck` — TypeScript sobre todo el proyecto.
- `check:color` — curvas (identidad, monotonía de la S) y parser `.cube`.
- `check:text` — las 30 frases contra las cajas reales de `TEXT_LAYERS`.

> **Para comprobar tipos usa `npm run typecheck`, nunca `tsc --noEmit` a secas.**
>
> `tsconfig.json` es un archivo de solución: lleva `"files": []` y solo
> `references` a `tsconfig.app.json` y `tsconfig.node.json`. Un `tsc --noEmit`
> pelado lo resuelve, encuentra cero archivos, **no comprueba nada y sale con
> éxito**. Da una falsa sensación de seguridad muy convincente: pasa siempre,
> incluso con errores obvios. Hace falta `tsc -b`, que sigue las referencias, y
> es lo que hacen `npm run typecheck` y `npm run build`. Ambos tsconfig llevan
> `noEmit: true`, así que `-b` no escribe ningún archivo.

`npm run shots` recorre el flujo entero en Chrome headless —con la cámara
sintética de Chrome, así que también pasa por la pantalla 03 y el escape de los
8 s— y deja una captura de cada pantalla en [`dev/shots/`](dev/shots/), más la
pieza compuesta. Arranca Chrome solo; define `CHROME_PATH` si no lo encuentra.

Y hay un banco de pruebas del pipeline **sin cámara**: `npm run dev` y abre
[`/dev/pipeline-check.html`](dev/pipeline-check.html). Compone 25 piezas
seguidas partiendo de la foto de la modelo y reporta tiempos y heap. No entra
en el build de producción.

Medido en Chrome sobre esta máquina: **primera pieza ~330 ms** (modelos en
frío), **~70 ms de media en caliente**, salida JPEG de 1080x1920. A lo largo de
25 ciclos el heap oscila con el GC (90 → 185 → 102 MB) en lugar de crecer de
forma sostenida.
