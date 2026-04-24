create table if not exists public.customer_blacklist (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_name text not null,
  customer_email citext not null,
  customer_phone text not null,
  reason text not null,
  is_active boolean not null default true,
  created_by_admin_user_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by_admin_user_id uuid references public.admin_users(id) on delete set null
);

create unique index if not exists uq_customer_blacklist_active
  on public.customer_blacklist (restaurant_id, customer_email, customer_phone)
  where is_active = true and removed_at is null;

create table if not exists public.customer_blacklist_events (
  id uuid primary key default gen_random_uuid(),
  blacklist_id uuid not null references public.customer_blacklist(id) on delete cascade,
  event_type text not null check (event_type in ('added_manual', 'added_automatic', 'removed', 'repeat_no_show')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_admin_user_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_blacklist_events_blacklist_id
  on public.customer_blacklist_events (blacklist_id, created_at desc);
