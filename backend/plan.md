# Backend Python — ¿mejora el recorte lo suficiente para valer la pena?

Este plan responde **una** pregunta antes que ninguna otra:

> ¿Un pipeline de Python recorta a la persona mejor que el que ya existe en
> JS/TS, lo bastante mejor como para justificar meter Python en el tótem?

Todo lo demás (IA, QR, storage, jobs) viene después, y solo si la respuesta es
que sí. La idea original se mantiene intacta: **se crea la ruta de Python y se
conserva la ruta de JS/TS**, en paralelo, partiendo de la misma foto.

---

## 0. Punto de partida — lo que ya existe y está medido

No partimos de cero. El kiosco ya compone piezas y hay números reales:

| Qué | Valor medido |
| --- | --- |
| Segmentación actual | MediaPipe Selfie Segmentation (`selfie_segmenter.tflite`) |
| **Peso del modelo** | **243 KB** |
| Pieza completa (en caliente) | 50 / 64 / 89 ms (mín / media / máx) |
| Solo el tratamiento fotográfico | 26 ms sobre 1.62 M px |
| Primera pieza (modelos en frío) | ~330 ms |
| Salida | JPEG 1080×1920 |

Y hay un **defecto conocido y documentado**: la máscara se traga fondo
alrededor del pelo. Está capturado en
[`dev/shots/fase1-zoom-pelo.png`](../dev/shots/fase1-zoom-pelo.png) — se ve la
mancha oscura del fondo original metida en el recorte, en el pelo y bajo la
mandíbula.

### La hipótesis, en una frase

**El modelo actual pesa 243 KB. Los de `rembg` pesan entre 170 MB y 900 MB.**

Esa diferencia de tres órdenes de magnitud es la razón por la que Python
*podría* ganar, y es una hipótesis física, no una corazonada: MediaPipe Selfie
Segmentation es un modelo pensado para correr en un teléfono en tiempo real, y
su inferencia ocurre a resolución baja (del orden de 256×256) y luego se
reescala. **Ningún postproceso en JS recupera el detalle de pelo que el modelo
nunca llegó a capturar.** Erosionar, difuminar o descontaminar el borde
maquilla el problema; no lo resuelve.

Si Python gana, ganará por ahí. Si no gana por ahí, no ganará por ningún lado.

### Lo que hay al otro lado de la balanza

La pregunta no es «¿es mejor?» sino «¿es mejor **lo suficiente**?». Meter
Python en el tótem cuesta:

- un runtime de Python + ONNX que instalar y mantener en la máquina;
- entre 170 MB y 900 MB de pesos de modelo;
- un servicio que tiene que arrancar solo, sobrevivir a reinicios y no
  quedarse colgado a mitad de feria;
- una dependencia más que puede fallar mientras hay alguien esperando delante.

Hoy el kiosco es una app de navegador sin instalación: se abre y funciona.
Eso vale mucho para una activación de tres semanas. **La mejora tiene que ser
visible a simple vista en la pieza final, no solo medible.**

### ⚠️ Conflicto con el brief que hay que decidir

El brief original dice: *«Todo debe funcionar sin internet una vez cargada la
página»*. Un backend en `localhost` **no rompe** esa regla. Pero las fases de
storage en la nube y de IA generativa **sí la rompen**. Antes de llegar ahí hay
que decidir explícitamente si la campaña acepta depender de conexión. No se
puede dejar para el final.

---

## 1. Alcance

Un tótem, una campaña de tres semanas.

**No** diseñar todavía: múltiples tiendas, múltiples tótems, Kubernetes,
balanceadores ni autoescalado.

Separación por módulos sí; sobreingeniería no.

---

## 2. FASE 0 — El bake-off (empezar por aquí)

> **Esta fase es la aportación más importante de esta revisión.**
> El plan original tardaba cinco fases en dar la primera respuesta. No hace
> falta: para saber si `rembg` recorta mejor el pelo que MediaPipe **no se
> necesita FastAPI, ni pantalla de debug, ni integración con React**. Se
> necesita una carpeta de fotos y un script.
>
> Si Python no gana claramente aquí, te has ahorrado el backend entero.

### Qué se construye

Un único script, fuera de la app:

```
backend/bakeoff/
├── input/            # las fotos de prueba
├── run.py            # corre los modelos y vuelca resultados
├── report.html       # comparación lado a lado
└── output/
    ├── <foto>/
    │   ├── mediapipe.png       # máscara + recorte de la ruta actual
    │   ├── u2net.png
    │   ├── isnet.png
    │   ├── birefnet.png
    │   └── comparativa.png     # los cuatro juntos, con zoom al pelo
```

La máscara de MediaPipe se exporta desde el kiosco reutilizando lo que ya hay:
el banco de pruebas [`dev/pipeline-check.html`](../dev/pipeline-check.html) ya
compone piezas sin cámara. Se le añade un volcado de la máscara alfa a PNG.

### Modelos a probar — esto importa mucho

Probar **solo `u2net`** daría un falso negativo y mataría la idea por el motivo
equivocado. `u2net` es el modelo por defecto de `rembg` y es el más flojo en
pelo. Hay que probar como mínimo:

| Modelo | Por qué |
| --- | --- |
| `u2net` | La referencia por defecto, el suelo |
| `isnet-general-use` | Bastante mejor en bordes finos |
| `birefnet-general` | El mejor en pelo hoy; también el más lento y pesado |
| Cualquiera + **alpha matting** | `rembg` trae matting opcional: es justo el mecanismo pensado para pelo y semitransparencias |

El *alpha matting* es la palanca que más puede mover la aguja para este caso
concreto. Probarlo con y sin, no solo el modelo.

### El set de fotos

Mínimo 12 fotos **tomadas con la webcam real del tótem, en el sitio o en
condiciones equivalentes** — no fotos de stock, no fotos de móvil. Cubriendo:

- buena luz / luz normal de interior / poca luz;
- luz lateral y rostro parcialmente en sombra;
- pelo suelto, pelo recogido, pelo oscuro, pelo claro, pelo rizado;
- ropa oscura y ropa clara;
- fondo limpio y fondo con gente o cosas detrás.

Las mismas fotos servirán para todas las fases siguientes. Merece la pena
tomarlas bien una vez.

### Criterio de decisión — medible, no «a ojo»

Para cada foto y cada modelo, registrar:

1. **Tiempo de inferencia**, medido **en la máquina destino**, no en la de
   desarrollo. Un i3 con gráficos integrados no es un portátil de desarrollo.
2. **Defectos visibles**, marcando sí/no sobre una lista fija: fondo pegado al
   pelo · pelo comido · dedos perdidos · agujero entre brazo y cuerpo mal
   resuelto · borde duro · manchas sueltas de fondo · parte del cuerpo perdida.
3. **Veredicto lado a lado**: para cada foto, ¿cuál gana? MediaPipe / Python /
   empate.

**Se avanza solo si Python gana claramente en al menos 8 de las 12 fotos, y el
tiempo de inferencia en la máquina destino es aceptable.**

Sobre el tiempo: hoy la pieza entera tarda 64 ms y la pantalla de "procesando"
tiene un mínimo de 1.5 s. Eso da margen real. Un presupuesto sano es **hasta
~2 s de inferencia** — por encima de eso la cola en feria empieza a doler y hay
que rediseñar la espera.

### Salidas de esta fase

- El `report.html` con las comparativas.
- Una recomendación de una línea: **seguir con Python / no seguir**.
- Si es «no seguir»: se cierra aquí y se invierte el esfuerzo en mejorar la
  ruta JS (FASE 2 del plan de calidad: erosión, descontaminación de borde,
  anclaje al borde inferior).

---

## 3. Cómo encaja esto con el plan de calidad que ya estaba en marcha

Hay un plan de calidad en curso con cuatro fases; las 2 y 3 **se solapan
directamente** con lo que este backend haría en Python:

| Plan de calidad (JS) | Equivalente en este plan (Python) |
| --- | --- |
| FASE 2 — erosión, descontaminación de borde, anclaje abajo | MaskRefiner |
| FASE 3 — cadena fotográfica en WebGL con shaders | PhotoEnhancer |

**No tiene sentido construir las dos.** El resultado del bake-off decide:

- **Python gana** → no se construye la cadena WebGL en JS. El tratamiento
  fotográfico se hace en Python, donde OpenCV/NumPy lo dan casi gratis y sin
  pelearse con shaders en gráficos integrados.
- **Python no gana** → se cierra el backend y se hacen las FASES 2-4 en JS
  como estaba previsto.

En ambos casos **la FASE 4 del plan de calidad (ayuda en la captura: aviso de
escena oscura, validación de distancia, no cortar los brazos) se hace igual**.
Es independiente del motor de segmentación, y es la que más sube la calidad de
entrada — que es el techo real de todo lo demás.

> Dicho claro: la mejor foto de entrada mejora más el resultado que el mejor
> segmentador. Si hay que elegir una sola cosa, es la FASE 4.

---

## 4. FASE 1 — Backend mínimo (solo si el bake-off dice que sí)

```
backend/
├── app/
│   ├── api/            # endpoints FastAPI
│   ├── services/       # BackgroundRemovalService, etc.
│   ├── processing/     # ImageProcessor, MaskRefiner, PhotoEnhancer
│   ├── schemas/        # modelos Pydantic
│   └── config/         # settings, rutas, parámetros
├── models/             # pesos descargados (NO al control de versiones)
├── bakeoff/            # lo de la FASE 0, se queda como herramienta
├── temp/
├── output/
├── tests/
├── requirements.txt
└── README.md
```

Stack: **FastAPI + Uvicorn + Pillow + OpenCV + NumPy + rembg**.

Entorno virtual, `.gitignore` para `models/`, `temp/`, `output/` y `.venv`.

Resultado esperado: arrancar el backend y llegar a un endpoint de salud.

### Regla que no se negocia

**El kiosco tiene que seguir funcionando con el backend caído.** La ruta JS es
la ruta por defecto y la que se puede desplegar sola. Python es aditivo y
desmontable. Si el servicio no responde, el tótem compone con JS y nadie se
entera.

---

## 5. FASE 2 — React → FastAPI

Un endpoint que recibe la foto, valida, guarda temporalmente, devuelve un id.

Sin IA, sin QR, sin storage, sin base de datos, sin cola.

### Detalle metodológico que decide el resultado

**Las dos rutas tienen que partir de los mismos bytes.** El frontend captura
hoy un `ImageBitmap` a resolución nativa del recorte. Para mandarlo a Python
hay que codificarlo, y **debe ser PNG (sin pérdida)**. Si se manda JPEG, Python
recibe una imagen ya degradada y la comparación queda viciada a su favor... o
en su contra. Sería un error silencioso y difícil de detectar después.

```
                  FOTO ORIGINAL (mismos bytes)
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
             JS/TS                Python
                │                   │
                ▼                   ▼
          Resultado JS        Resultado Python
```

Nunca `Foto → JS → Python`. Eso no compara nada.

---

## 6. FASE 3 — ImageProcessor

Abrir, validar, corregir orientación EXIF, normalizar formato, controlar
dimensiones, generar copia de trabajo sin perder calidad innecesariamente.

Entrada consistente para lo que viene detrás. Nada más.

---

## 7. FASE 4 — BackgroundRemovalService

El módulo importante.

```
Foto original → ImageProcessor → BackgroundRemovalService → PNG con alfa
```

- Sin IA generativa.
- El modelo concreto queda **detrás del servicio**: el resto de la aplicación
  no importa `rembg` directamente. Cambiar de modelo es cambiar una clase.
- Los parámetros (modelo, alpha matting, umbrales) van a configuración, no
  incrustados en el código — la misma regla que sigue `config.ts` en el
  frontend.

---

## 8. FASE 5 — Pantalla DEBUG en el kiosco

Ahora sí, la comparación dentro de la app real, con capturas reales y con la
composición completa encima — que es donde de verdad se ve si el recorte
aguanta.

```
TOMAR FOTO → PANTALLA DEBUG → [ Procesar con JS/TS ] | [ Procesar con Python ]
```

- El botón JS/TS **invoca el pipeline que ya existe** (`composePiece`). No se
  escribe una segunda implementación.
- El botón Python manda la misma foto al backend y muestra lo que vuelve.
- Los dos resultados, uno al lado del otro, con el tiempo de cada uno.

**Integración con lo que ya hay:** esta pantalla va detrás del bloque `DEBUG`
que ya existe en [`src/config.ts`](../src/config.ts), junto a `downloadPiece` y
`framingHud`, y con el mismo turquesa de los marcadores. Todos esos
interruptores tienen que quedar en `false` para la activación — la pantalla
DEBUG no forma parte del flujo de producción.

### 🛑 PARADA OBLIGATORIA

Aquí se para y se evalúa con fotos reales. No se sigue a IA, QR, storage ni
nada más hasta tener el veredicto por escrito.

---

## 9. FASE 6 — MaskRefiner

Solo si el recorte base ya es bueno. Refinar no arregla un mal recorte.

- Quitar manchas sueltas.
- Suavizar el borde de forma controlada.
- Morfología cuando haga falta.
- **Descontaminación de color de borde**: en los píxeles semitransparentes,
  restar la influencia del fondo original. Es lo que quita el halo de color, y
  es el defecto que ya tenemos documentado.

Sin destruir detalle fino. Sin bordes artificialmente duros.

---

## 10. FASE 7 — PhotoEnhancer

Correcciones conservadoras, en este orden:

1. Reducción de ruido ligera (las capturas de interior traen ruido).
2. **Normalización de exposición**: medir el brillo medio **del sujeto ya
   recortado** —no de la foto entera, que incluye fondo— y llevarlo a un
   objetivo. Así una foto oscura no sale apagada.
3. Suavizado de piel selectivo: desenfoque mezclado solo en zonas de bajo
   contraste, preservando ojos, labios y bordes.
4. Color grading con soporte de LUT `.cube`, con curvas por canal de respaldo.
5. Glow suave: copia desenfocada compuesta en `screen` al 20-30 %.
6. Viñeteado radial.

**No cambiar** identidad, estructura facial, edad aparente, proporciones,
cuerpo ni pose.

Con poca luz: no inventar información que la foto no tiene.

> Nota: los parámetros de estas seis etapas ya están definidos y calibrados en
> `PHOTO_STYLES` (`src/config.ts`). Portarlos, no reinventarlos — y mantener un
> único sitio donde se ajustan.

---

## 11. FASE 8 — Composer

Colocar persona, fondo, gráficos, textos, logos y marcos. Determinista.

Los textos y el branding **nunca** se generan con IA. La app controla la marca.

> La composición actual en JS ya está medida contra el Figma del diseñador
> (`LAYOUT`, `TEXT_LAYERS`, `PIECE_LOGO`, `CLAIM_TEXT`). Si la composición pasa
> a Python, esos números son la fuente y hay que decidir **un solo sitio** donde
> vivan; tener las coordenadas duplicadas en dos lenguajes es una fuente
> garantizada de derivas.

---

## 12. FASE 9 — Pipeline orquestado

```
Recibir → Validar → Preprocesar → Quitar fondo → Refinar máscara
        → Corregir foto → [IA opcional] → Postprocesar → Componer → Guardar
```

Cada etapa separada. Nada de una función monolítica.

---

## 13. FASE 10 — IA generativa (opcional, y probablemente innecesaria)

Solo cuando el procesamiento sin IA sea correcto.

- Detrás de una abstracción `ImageGenerationService`; el pipeline no llama a
  fal.ai / OpenAI / Gemini directamente.
- `AI_ENABLED = false` tiene que ser un camino completo y válido.
- Los prompts viven en el backend. El frontend solo elige un estilo por número.

> **Recordatorio incómodo:** activar IA generativa rompe el requisito de
> funcionamiento sin internet, mete latencia de red en mitad de la cola y pone
> la cara de una persona real en manos de un tercero. Para una activación de
> marca de tres semanas, el listón para justificarlo debería ser muy alto.
> Y nunca como parche para un recorte malo.

---

## 14. Lo que se aparca (y por qué)

El plan original desarrollaba a fondo jobs con estados, cola, storage en la
nube, URLs firmadas, QR e infraestructura de producción. Para **un tótem y tres
semanas** eso es sobreingeniería, y además parte ya está resuelto:

| Tema | Estado real |
| --- | --- |
| QR | **Ya funciona** en la pantalla 05 (`qrcode`) |
| Subida | **Stub listo** en `src/lib/upload.ts`, con la firma pensada para no cambiar cuando exista el endpoint |
| Jobs / cola | Innecesario con un tótem: las fotos llegan de una en una, con una persona delante |
| Storage nube | Solo hace falta si la descarga por QR debe funcionar fuera de la red local |
| Estados de progreso | La pantalla 04 ya existe, con mínimo de 1.5 s |

Cuando toque, se retoman. Ahora no aportan a la pregunta que hay que responder.

---

## 15. Errores

El usuario del tótem no ve errores técnicos. Los detalles van al log.

Cubrir: archivo inválido, imagen fuera de rango, fallo de segmentación,
timeout, fallo de proveedor, fallo de storage, resultado inválido.

**Y el más importante:** si el backend no responde, **el kiosco compone con JS
y sigue adelante**. Nunca una pantalla congelada, nunca una cola parada por un
servicio caído.

---

## 16. Orden de ejecución

```
FASE 0   Bake-off offline            ← EMPEZAR AQUÍ
   │
   ├── Python NO gana → cerrar backend, seguir con FASES 2-4 en JS
   │
   └── Python SÍ gana
         ↓
FASE 1   Backend mínimo
         ↓
FASE 2   React → FastAPI (mismos bytes, PNG)
         ↓
FASE 3   ImageProcessor
         ↓
FASE 4   BackgroundRemovalService
         ↓
FASE 5   Pantalla DEBUG   🛑 PARADA Y EVALUACIÓN
         ↓
FASE 6   MaskRefiner
         ↓
FASE 7   PhotoEnhancer
         ↓
FASE 8   Composer
         ↓
FASE 9   Pipeline orquestado
         ↓
FASE 10  IA opcional (probablemente no)
```

En paralelo y con independencia del resultado: **FASE 4 del plan de calidad
(ayuda en la captura)**.

---

## 17. Nota de licencias

Esto es una activación **comercial** de marca. Antes de fijar un modelo hay que
comprobar la licencia de sus pesos, no solo la de `rembg` (que es MIT). Los
pesos van cada uno por su cuenta y algunos restringen uso comercial. Es un
trámite de cinco minutos que evita un problema serio a destiempo.

---

## 18. En una frase

Antes de construir un backend, gastar un día en comprobar con fotos reales si
el recorte mejora de verdad. Si mejora, construirlo por fases y sin perder
nunca la ruta JS. Si no mejora, haberlo sabido pronto ya es ganar.
