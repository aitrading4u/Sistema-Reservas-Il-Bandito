# Despliegue barato paso a paso (Vercel + Supabase)

Esta guia es para dejar el MVP funcionando de forma economica y estable usando:

- Frontend/API: Vercel
- Base de datos + Auth: Supabase
- Sin Render (de momento)

---

## 0) Que voy a hacer por ti y que haces tu

Yo ya he dejado el proyecto preparado en codigo.

Tu solo tienes que hacer estas acciones en paneles (Vercel/Supabase), porque yo no puedo entrar en tus cuentas.

---

## 1) Supabase: crear proyecto y sacar claves

1. Entra en Supabase y crea un proyecto nuevo.
2. Ve a `Project Settings -> API`.
3. Copia estos valores:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`

---

## 2) Supabase: ejecutar migraciones SQL (copiar/pegar)

Abre `SQL Editor -> New query` y ejecuta, primero:

1. `supabase/migrations/20260423_backend_core.sql`
2. `supabase/migrations/20260424_blacklist_contacts.sql`

Hazlo exactamente en ese orden.

---

## 3) Supabase: cargar datos base (recomendado para arrancar)

En `SQL Editor -> New query`, ejecuta:

- `supabase/seeds/dev_seed.sql`

Esto te crea restaurante, mesas, reglas, horarios y reservas demo.

---

## 4) Supabase: crear usuario admin real

### 4.1 Crear usuario en Auth

En Supabase:

- `Authentication -> Users -> Add user`
- Crea email/password admin (el que usaras para entrar en `/admin/login`)

### 4.2 Vincular ese usuario a `admin_users`

Ejecuta este SQL (copiar/pegar), reemplazando el email:

```sql
-- 1) Ver el auth user id del admin
select id, email
from auth.users
where email = 'TU_EMAIL_ADMIN@EJEMPLO.COM';
```

Copia el `id` que devuelve y luego ejecuta:

```sql
-- 2) Ver restaurante disponible
select id, name
from public.restaurants
order by created_at asc;
```

Si usaste el seed, puedes usar directamente:

- restaurant_id = `11111111-1111-1111-1111-111111111111`

Ahora vincula el admin (reemplaza los valores):

```sql
insert into public.admin_users (
  restaurant_id,
  auth_user_id,
  role,
  is_active
)
values (
  '11111111-1111-1111-1111-111111111111', -- tu restaurant_id real
  'PEGA_AQUI_EL_AUTH_USER_ID',
  'manager',
  true
)
on conflict (auth_user_id)
do update set
  restaurant_id = excluded.restaurant_id,
  role = excluded.role,
  is_active = true,
  deleted_at = null;
```

---

## 5) Variables de entorno para Vercel (copiar/pegar)

En Vercel, dentro del proyecto:

- `Settings -> Environment Variables`

Crea estas variables:

```bash
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=TU_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
RESERVATIONS_DEFAULT_RESTAURANT_ID=11111111-1111-1111-1111-111111111111
RESEND_API_KEY=TU_RESEND_API_KEY
EMAIL_FROM=Il Bandito <reservas@ilbanditoaltea.es>
EMAIL_REPLY_TO=reservas@ilbanditoaltea.es
EMAIL_INTERNAL_TO=reservas@ilbanditoaltea.es
EMAIL_ENABLE_INTERNAL_NOTIFY=false
```

Notas:

- `RESERVATIONS_DEFAULT_RESTAURANT_ID` debe ser el `id` real de `public.restaurants`.
- Si no quieres activar email aun, deja `RESEND_API_KEY` vacia y luego la pones.

---

## 6) Desplegar en Vercel (barato)

1. Sube repo a GitHub (si no esta ya).
2. En Vercel: `Add New -> Project`.
3. Importa el repo.
4. Framework detectado: `Next.js`.
5. Deploy.

Listo: frontend + API quedaran en el mismo despliegue.

---

## 7) Dominio/subdominio final

Para usar `reservas.ilbanditoaltea.es`:

1. En Vercel -> `Project -> Settings -> Domains`
2. Añade `reservas.ilbanditoaltea.es`
3. Crea el registro DNS que te indique Vercel (normalmente `CNAME`)
4. Espera propagacion

Luego prueba:

- `https://reservas.ilbanditoaltea.es/reservas`
- `https://reservas.ilbanditoaltea.es/admin/login`

---

## 8) Checklist de validacion (rapida)

1. Publico:
   - Entrar en `/reservas`
   - Buscar disponibilidad
   - Crear una reserva
2. Admin:
   - Login con email/password
   - Ver reservas del dia
   - Cambiar estado a `no_show`
   - Ver lista negra/contactos
3. Concurrencia:
   - Intentar dos reservas mismo slot/mesa
   - Debe rechazar conflicto (sin doble reserva)

---

## 9) Ajustes para no gastar de mas

- Mantener `NEXT_PUBLIC_DEMO_MODE=false` en produccion.
- Un unico proyecto Vercel + un unico proyecto Supabase.
- Sin servicios extra (Redis/colas/workers) en MVP.
- Activar solo emails esenciales (confirmacion/cancelacion).

---

## 10) Si algo falla: SQL de chequeo rapido

```sql
-- Ver restaurantes
select id, name, timezone from public.restaurants;

-- Ver admin users activos
select id, restaurant_id, auth_user_id, role, is_active
from public.admin_users
where is_active = true and deleted_at is null;

-- Ver reservas recientes
select reservation_code, status, customer_name, start_at
from public.reservations
order by created_at desc
limit 20;
```

Si quieres, en el siguiente paso te preparo una mini sesion de "vamos haciendolo juntos" y me vas pegando capturas/errores en cada paso (Supabase -> Vercel -> dominio) y lo dejamos cerrado al 100%.
