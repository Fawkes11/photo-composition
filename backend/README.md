# Backend

Dos servicios **separados a propósito**, con requisitos opuestos:

| Carpeta | Qué es | Dónde corre |
| --- | --- | --- |
| [`qr/`](qr/) | Guarda la pieza y sirve el enlace del QR | Cloudflare Worker + R2 |
| `python/` | Procesado de imagen (experimental) | Contenedor aparte |

El del QR tiene que ser infalible: si falla, el visitante pierde su foto. El de
Python es un experimento. Si vivieran juntos, un experimento podría tumbar el
flujo principal — por eso el kiosco trata Python como opcional y con respaldo
local, y por eso ni siquiera comparten despliegue.

---

## `qr/` — subida y descarga

### Qué hace

```
POST /p       recibe la pieza, la guarda, devuelve { id, url }
GET  /p/:id   la sirve al móvil que escanea el QR
GET  /health  comprobar que está vivo
```

Sin base de datos. Las piezas son objetos en R2; las métricas, objetos
diminutos de JSON. Para 400 piezas al día, montar una base de datos sería pagar
complejidad por nada.

### Puesta en marcha

```bash
cd backend/qr
npm install
npx wrangler login
npx wrangler r2 bucket create revlon-piezas
npx wrangler deploy
```

Al terminar, `deploy` imprime la URL del Worker. Esa URL va en
`UPLOAD.baseUrl` de `src/config.ts` del kiosco. Mientras esté vacía, el kiosco
**no toca la red**: genera una URL local de mentira y el flujo se puede probar
entero sin depender de nada.

### Las caducidades — importante

**No están en el código.** Se configuran una sola vez en el panel:
*R2 → revlon-piezas → Settings → Object lifecycle rules*. Una regla por prefijo:

| Prefijo | Qué guarda | Caducidad sugerida |
| --- | --- | --- |
| `d/` | Copia de descarga (la del QR) | **3 días** |
| `a/` | Archivo, solo si está activado | según lo que autorice la marca |
| `m/` | Métricas, sin fotos | sin caducidad, ocupan nada |

Están separadas por prefijo justamente para esto: que la copia que ve el
visitante caduque pronto y el archivo —si se autoriza— viva aparte con sus
propias reglas.

### El archivo de piezas

`ARCHIVE_ENABLED` en `wrangler.toml`. **Apagado por defecto.**

Encenderlo guarda una segunda copia bajo `a/<fecha>/`. Son fotos de personas
identificables, así que antes hace falta:

- Instrucción **por escrito** de quien encarga el trabajo, con plazo concreto.
- Un aviso visible en el tótem diciéndoselo al visitante.

Y ojo: **encenderlo no es retroactivo.** Lo de los días anteriores ya habrá
caducado con la copia de descarga. La decisión tiene fecha límite: antes de
arrancar la campaña, no durante.

Se archiva **solo la pieza final**, nunca la foto original en bruto: la pieza ya
está compuesta y con la marca encima, que es lo que sirve para reportar.

### Métricas sin datos personales

Cada pieza deja un JSON de dos campos en `m/<fecha>/`: la palabra elegida y la
hora. Con eso sale el informe de la campaña —cuántas piezas, qué palabras
tiraron más— **sin guardar una sola cara**.

Si lo que la marca quiere es demostrar que la activación funcionó, esto
probablemente basta y hace innecesario el archivo. Vale la pena preguntarlo
antes de encender nada.

### Coste

Con 400 piezas/día durante 3 semanas: 8.400 piezas, ~2,1 GB, ~1.200
peticiones/día. El plan gratuito de R2 (10 GB) y de Workers (100.000
peticiones/día) lo cubre con mucho margen, y R2 no cobra por descarga.

### Si la subida falla

El kiosco **entrega la pieza igual**, sin QR, y la pantalla 05 lo dice. Esto
corre con el usuario delante y en una feria el wifi se cae: es preferible
entregar la foto sin código de descarga que dejar a alguien esperando sin fin o
perder su pieza por un problema de red.

`UPLOAD.timeoutMs` y `UPLOAD.retries` en `src/config.ts` ajustan cuánto se
insiste antes de rendirse.
