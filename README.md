# Il Bandito Reservas

Proyecto base en Next.js (App Router) + TypeScript + Tailwind + Supabase.

## Scripts

- `npm run dev`: entorno local
- `npm run build`: build de produccion
- `npm run start`: ejecutar build
- `npm run lint`: lint
- `npm run typecheck`: chequeo de tipos
- `npm run test`: tests (Vitest)
- `npm run test:watch`: tests en modo watch

## Estructura

- `src/app/(public)`: frontend publico de reservas
- `src/app/(admin)/admin`: panel interno
- `src/modules`: modulos de dominio/aplicacion/infra/ui
- `src/lib/supabase`: clientes y config de Supabase
- `src/lib/validations`: esquemas Zod
- `src/components`: componentes reutilizables

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

- `NEXT_PUBLIC_DEMO_MODE` (`true` para demo sin backend, `false` para entorno real)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESERVATIONS_DEFAULT_RESTAURANT_ID`
- `RESEND_API_KEY`
- `EMAIL_FROM` (ej. `Il Bandito <reservas@ilbanditoaltea.es>`)
- `EMAIL_REPLY_TO` (opcional)
- `EMAIL_INTERNAL_TO` (opcional, destinatario interno restaurante)
- `EMAIL_ENABLE_INTERNAL_NOTIFY` (`true`/`false`)

### Modo demo rapido

Para revisar UX/flujo sin configurar Supabase:

1. En `.env.local`: `NEXT_PUBLIC_DEMO_MODE=true`
2. Reinicia `npm run dev`
3. Entra en `/admin/login` y usa `Entrar a demo`

## Backend API

- Publico:
  - `GET /api/public/availability`
  - `POST /api/public/reservations`
- Admin (requiere `Authorization: Bearer <supabase_jwt_admin>`):
  - `GET|POST /api/admin/reservations`
  - `PATCH|DELETE /api/admin/reservations/:id`
  - `GET|POST /api/admin/blocks`
  - `GET /api/admin/calendar`

## SQL / Migraciones

- Ejecuta `supabase/migrations/20260423_backend_core.sql` en tu proyecto Supabase.
- Incluye:
  - esquema de reservas
  - constraint anti-solape por mesa (`EXCLUDE USING gist`)
  - `rpc_create_reservation_atomic` (transaccional y segura en concurrencia)
  - `rpc_reschedule_reservation_atomic`

## Seed de desarrollo

- Carga datos demo completos con:
  - `supabase/seeds/dev_seed.sql`
- Incluye:
  - mesas y combinaciones
  - horarios y reglas
  - cierres y bloqueos
  - reservas demo con varios estados

## Emails transaccionales

- Confirmacion de reserva para cliente (ES/EN, base IT)
- Cancelacion de reserva para cliente
- Copia interna opcional al restaurante
- Implementado con Resend en:
  - `src/modules/notifications/application/transactional-email.service.ts`
  - `src/modules/notifications/templates/reservation-email.templates.ts`

## Despliegue economico (Vercel + Supabase)

Guia completa y detallada (con bloques para copiar/pegar):

- `docs/deploy-cheap-vercel-supabase.md`
