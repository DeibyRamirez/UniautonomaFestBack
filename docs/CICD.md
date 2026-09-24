# CI/CD y despliegue en Vercel

## Pipelines

| Workflow | Archivo | Cuándo corre |
|----------|---------|--------------|
| **CI** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Push/PR en ramas Gitflow |
| **CD Vercel** | [`.github/workflows/cd-vercel.yml`](../.github/workflows/cd-vercel.yml) | Push `main`/`develop`, PRs, manual |

### CI local

```bash
cd backend
npm ci
npm run verify
cd ..
npm ci
node --check api/index.js
```

## Secretos de GitHub (Settings → Secrets and variables → Actions)

| Secreto | Descripción |
|---------|-------------|
| `VERCEL_TOKEN` | Token en [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | ID de equipo/usuario (`.vercel/project.json` o `vercel project ls`) |
| `VERCEL_PROJECT_ID` | ID del proyecto Vercel |

Obtener IDs tras vincular el repo:

```bash
npm i -g vercel
vercel link
cat .vercel/project.json
```

**No commitear** `.vercel/` ni tokens.

## Entornos en GitHub Actions

El workflow CD usa **environments**:

- `production` — rama `main`
- `staging` — rama `develop`
- `preview` — pull requests

Opcional: en GitHub → Environments → `production` → **Required reviewers** antes de desplegar.

## Variables en Vercel

Copia todas las claves de `backend/.env.example` al proyecto Vercel:

- **Production** → rama `main`
- **Preview** → `develop` y PRs (puedes usar Wompi sandbox y Resend sandbox)

Incluye: `FIREBASE_*`, `WOMPI_*`, `RESEND_*`, `URL_BASE` (URL pública del deploy), montos, etc.

Para Firebase Admin en Vercel, usa variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (private key con `\n` escapados) **o** sube credenciales vía integración segura; no uses `service-account.json` en el repo.

## Wompi en producción

1. URL de eventos: `https://<tu-dominio-vercel>/api/payments/webhook`
2. Llaves de **producción** en entorno Production de Vercel.
3. `URL_BASE` = URL canónica del sitio en producción.

## Alternativa: integración Git nativa de Vercel

Puedes conectar el repositorio en el dashboard de Vercel **además** del workflow CD, o **solo** usar Vercel Git (previews automáticos) y dejar GitHub Actions **solo CI**. Si usas ambos CD, evita despliegues duplicados desactivando uno.

Recomendación del repo: **CI en GitHub Actions + CD con `cd-vercel.yml`** para control explícito por rama Gitflow.

## Checklist primer despliegue

- [ ] Proyecto Vercel creado y `vercel link`
- [ ] Secretos `VERCEL_*` en GitHub
- [ ] Rama `develop` creada y pusheada
- [ ] Variables de entorno Preview y Production en Vercel
- [ ] Webhook Wompi apuntando a producción
- [ ] Dominio Resend verificado para producción
- [ ] PR de prueba → CI verde + URL preview en el job CD
