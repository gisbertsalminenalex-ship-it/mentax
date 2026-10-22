# Mentax

Conócete, comprende y mejora. App de reflexión personal: preguntas diarias guiadas, historial, análisis con IA, resumen semanal, objetivos y evolución.

## Desarrollo

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # tests de lógica (fechas, racha, base local, contrato IA, copias)
pnpm typecheck
pnpm build
```

## Cómo funciona

- **Datos locales**: todo se guarda en el navegador (IndexedDB con Dexie, `lib/db.ts`). Sin cuentas. Copia de seguridad exportable/importable desde Perfil (`lib/backup.ts`).
- **Preguntas diarias**: tres objetivos fijos (lo que fue bien, dificultades, emociones/aprendizajes). Con IA se personalizan recordando reflexiones anteriores, objetivos y aprendizajes guardados; sin IA rotan desde un banco local (`lib/questions.ts`).
- **IA**: `POST /api/ai` (`app/api/ai/route.ts`) llama a Cloudflare Workers AI con las tareas `questions`, `analysis` y `week`. Prompts en `lib/ai/prompts.ts`; validación y limpieza en `lib/ai/contract.ts`. Si algo es grave, el análisis termina recomendando ayuda profesional.
- **Variables**: ver `.env.example` (`CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_AI_MODEL`).
