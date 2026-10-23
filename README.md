# Mentax

Conócete, comprende y mejora. Diario de reflexión personal: escribes tu día, Mentax reflexiona contigo y te hace preguntas para profundizar. Con resumen semanal, objetivos y evolución.

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
- **Diario**: cada día el usuario escribe libremente (`components/mentax/screens/write.tsx`). Mentax lee la entrada, reflexiona, hace 2 preguntas y, tras las respuestas, cierra con un comentario y un aprendizaje (`components/mentax/screens/diary.tsx`). Si el texto menciona objetivos, propone añadirlos. Utilidades y migración de la v1 en `lib/entries.ts`.
- **IA**: `POST /api/ai` (`app/api/ai/route.ts`) llama a Cloudflare Workers AI con las tareas `reflect`, `close`, `ideas` y `week`. Prompts en `lib/ai/prompts.ts`; validación y limpieza en `lib/ai/contract.ts`. Si algo es grave, Mentax termina recomendando ayuda profesional.
- **Variables**: ver `.env.example` (`CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_AI_MODEL`).
