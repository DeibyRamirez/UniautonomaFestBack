# Landing Uniautónoma Fest 2026

Página estática de una sola vista. No necesita backend, base de datos ni framework:
solo un servidor web que sirva archivos (Apache, Nginx, IIS, Netlify, Vercel, GitHub Pages
o una carpeta dentro del sitio institucional).

## Contenido del paquete
- `index.html`  — toda la página (HTML + CSS + JS en un solo archivo).
- `img/`        — 17 imágenes en WebP (1,3 MB en total). Las rutas son relativas (`img/...`),
                  así que la carpeta debe quedar junto al index.html.

## Dependencias externas
- Tipografía **Archivo** desde Google Fonts (una línea `<link>` en el `<head>`).
  Si el sitio no puede llamar a Google, descargar la fuente y servirla localmente con `@font-face`.
- YouTube (solo si se incrusta el video desde allí).

## Pendientes que debe completar quien publique
Buscar en `index.html`:
1. `data-video=""` (sección Registro 01): pegar la URL del reel. Acepta enlaces de YouTube
   (normal o Shorts) o la ruta a un archivo `.mp4` propio. Instagram no permite incrustar reels.
2. Botones con `href="#"`: Hackatón, Carrera 5K, "Quiero un stand", "Comprar kit uniautónomo",
   "Comprar kit externo", Instagram, TikTok y WhatsApp. Reemplazar `#` por el enlace real.
3. Precios de los kits: buscar `$ 00.000` (aparece dos veces) y poner el valor.
4. Cuenta regresiva: apunta a `2026-10-19T09:00:00-05:00`. Cambiar si cambia la fecha de inicio.

## Cómo publicar
1. Subir la carpeta completa al servidor (por ejemplo `/fest/` → https://www.uniautonoma.edu.co/fest/).
2. Verificar que `index.html` e `img/` queden en el mismo nivel.
3. Abrir en un celular y en un computador. En iPhone aparece un botón "Activar movimiento"
   porque iOS pide permiso para usar el giroscopio; es normal.

## Notas técnicas
- Responsive (móvil, tablet, escritorio) y respeta `prefers-reduced-motion`.
- El parallax del hero usa mouse, giroscopio y scroll; todo está en el `<script>` al final.
- Para editar textos o la programación, están en HTML plano dentro de las secciones
  `#video`, `#senal`, `#programacion`, `#camiseta` y `#kit`.
- Si se quiere separar CSS y JS en archivos propios, basta cortar los bloques `<style>` y
  `<script>` y enlazarlos; no hay ninguna dependencia entre ellos y el HTML más allá de los ids.
