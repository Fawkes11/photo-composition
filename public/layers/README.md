# Capas del diseñador

Suelta aquí los PNG. La app los detecta sola: si el archivo no existe usa un
placeholder de color sólido, y en cuanto aparece empieza a usarlo sin tocar
código.

| Archivo            | Capa  | Qué lleva                                          |
| ------------------ | ----- | -------------------------------------------------- |
| `back-default.png` | FONDO | Fondo completo, incluido el texto "SÉ INOLVIDABLE" |

- Tamaño exacto: el de `EXPORT` en `src/config.ts` (hoy 1080 x 1920).

## No hace falta un PNG de capa FRENTE

Lo único que va por encima de la persona es texto: la palabra que eligió el
usuario, su frase y el wordmark REVLON. Los tres los dibuja la app en
`src/compose/pipeline.ts` (`drawWordText` y `drawLogo`) a partir de `WORDS`,
`TEXT_LAYERS` y `PIECE_LOGO` — tienen que ser texto de verdad porque cambian
con cada pieza, así que no pueden venir aplanados en un PNG.

Hubo un `front-default.png` declarado como capa por defecto. Nunca existió, y
cada arranque hacía un fetch condenado a fallar; además su placeholder pintaba
un marco rojo sobre el fondo rojo de la pieza, que se colaba en la composición
como si fuera parte del diseño. Se quitó.

## Si alguna vez sí hace falta un grafismo delante

El punto de extensión sigue abierto, por palabra. En la entrada de `WORDS` de
`src/config.ts`:

```ts
{ id: 'audaz', word: 'AUDAZ', /* … */ frontLayer: '/layers/front-audaz.png' }
```

Ese PNG debe cumplir:

- 1080 x 1920 exacto
- **Con canal alfa**
- Transparente en la zona de la persona (`PERSON.box`) y en las dos cajas de
  texto (`TEXT_LAYERS`), que la app pinta por encima

`backLayer` funciona igual para dar a una palabra un fondo distinto.
