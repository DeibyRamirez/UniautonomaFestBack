## Resumen

<!-- Qué cambia y por qué (1–3 frases) -->

## Tipo de cambio

- [ ] Feature (`feature/*` → `develop`)
- [ ] Release (`release/*` → `main`)
- [ ] Hotfix (`hotfix/*` → `main`)
- [ ] Documentación / CI

## Checklist

- [ ] CI pasa en GitHub Actions
- [ ] Probado en local (`cd backend && npm run dev`)
- [ ] Sin secretos en el diff (`.env`, JSON de Firebase, keys)
- [ ] Si afecta pagos: probado flujo Wompi sandbox
- [ ] Si afecta correos: Resend sandbox o dominio verificado

## Rama Gitflow

- Base: `develop` o `main` (según tipo de PR)
- Preview Vercel: revisar URL del job **CD Vercel** en el PR
