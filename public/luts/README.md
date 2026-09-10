# LUTs de color

Formato **.cube 3D** (Adobe / DaVinci Resolve). Las 1D no están soportadas: se
cubren de sobra con el fallback de curvas.

Para activar una LUT, apunta a ella desde el estilo correspondiente en
`PHOTO_STYLES` (`src/config.ts`):

```ts
grading: {
  lutPath: '/luts/signature.cube',
  lutAmount: 1,   // 0..1, mezcla contra el original
  ...
}
```

Con `lutPath: null` —o si el archivo no carga— se usan las curvas por canal
definidas en ese mismo estilo. El cambio no requiere tocar el pipeline.
