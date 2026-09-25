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

---

## Ampliaciones del repositorio (compra de kits y admin)

El proyecto ya incluye más que la landing sola. Referencia rápida para no olvidar piezas al desplegar o dar soporte.

| Área | Ubicación | Notas |
|------|-----------|--------|
| Compra (modal Wompi) | `js/modal-compra.js` | Tras pagar, confirma con la API y muestra código de reclamo. |
| API backend | `backend/` + `api/index.js` (Vercel) | Express, Firestore, Wompi, Resend. |
| Panel admin | `admin/login.html`, `admin/index.html` | Login separado del panel; pestañas Financiera y Administradores. |
| Variables de entorno | `backend/.env.example` | Copiar a `backend/.env` en local; mismas claves en Vercel. |
| Reglas Firestore | `firebase/firestore.rules` | Desplegar reglas si cambian permisos. |
| Mapa Carrera 5K | `js/mapa-carrera-5k.js`, `data/carrera-5k.gpx` (opcional) | MapLibre + OpenFreeMap, sin API key. Ruta exacta: GPX o GeoJSON en `data/`. |
| Documentación técnica | [`README.md`](README.md) | Arquitectura, endpoints, diagramas. |
| CI/CD y Gitflow | [`docs/CICD.md`](docs/CICD.md), [`docs/GITFLOW.md`](docs/GITFLOW.md) | GitHub Actions + Vercel. |

### URLs en local (`npm run dev` en `backend/`, puerto 3000)

- Sitio: `http://localhost:3000/`
- Admin login: `http://localhost:3000/admin/login.html`
- Panel: `http://localhost:3000/admin/`

### Kit uniautónomo (validación actual en checkout)

- Correo debe terminar en `@uniautonoma.edu.co`.
- Código de estudiante obligatorio.
- Montos y URL pública: variables `MONTO_KIT_*` y `URL_BASE` en `.env`.

### Checklist antes de abrir ventas en producción

- [ ] Wompi: llaves de **producción**, webhook apuntando a `https://<dominio>/api/payments/webhook`.
- [ ] Resend: dominio verificado; `CORREO_REMITENTE` con el mismo dominio (ej. `@send.tudominio.com`).
- [ ] Firebase: credenciales admin en Vercel; reglas Firestore desplegadas; índices del admin con `firebase deploy --only firestore:indexes`.
- [ ] Admin: semilla o super admin (`npm run semilla-admin` / `crear-super-admin`).
- [ ] Probar flujo completo: compra → APPROVED → correo con código `UAF26-…` → búsqueda en panel admin.
- [ ] `URL_BASE` en producción = URL canónica del sitio (enlaces y callbacks correctos).

### Soporte frecuente

- Pago quedó en PENDING: el front puede llamar confirmación; revisar logs y estado en Wompi.
- Correo no llegó: `npm run reenviar-correo -- <referencia>` (pago ya APPROVED); revisar `emailError` en Firestore.
- Login admin falla: `npm run verificar-admin`; campos con `name` en el formulario; Firebase Auth habilitado.

### Pendientes editoriales extra (además de la lista inicial)

- Mapa 5K: subir `data/carrera-5k.gpx` cuando exista el trazado oficial.
- Revisar que los botones de compra de kit apunten al modal y no queden en `#` si ya hay integración Wompi.
