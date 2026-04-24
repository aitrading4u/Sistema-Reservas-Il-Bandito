create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum (
      'pending', 'confirmed', 'cancelled', 'seated', 'finished', 'no_show'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_source') then
    create type reservation_source as enum ('web', 'phone', 'walk_in', 'google', 'instagram', 'admin');
  end if;
end $$;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  auth_user_id uuid unique,
  role text not null check (role in ('owner', 'manager', 'host')),
  is_active boolean not null default true,
  deleted_at timestamptz
);

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_code text not null,
  min_capacity smallint not null check (min_capacity >= 1),
  max_capacity smallint not null check (max_capacity >= min_capacity),
  is_active boolean not null default true,
  deleted_at timestamptz
);

create unique index if not exists uq_tables_code on public.tables (restaurant_id, lower(table_code)) where deleted_at is null;

create table if not exists public.table_combinations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_1_id uuid not null references public.tables(id) on delete cascade,
  table_2_id uuid not null references public.tables(id) on delete cascade,
  is_active boolean not null default true,
  deleted_at timestamptz,
  constraint chk_combination_distinct check (table_1_id <> table_2_id)
);

create unique index if not exists uq_table_combo on public.table_combinations (restaurant_id, table_1_id, table_2_id) where deleted_at is null;

create table if not exists public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  open_time time not null,
  close_time time not null check (close_time > open_time),
  is_active boolean not null default true,
  deleted_at timestamptz
);

create table if not exists public.special_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  closure_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  is_full_day boolean not null default true,
  is_active boolean not null default true,
  deleted_at timestamptz,
  constraint chk_closure_payload check (
    (is_full_day = true and closure_date is not null)
    or
    (is_full_day = false and starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create table if not exists public.reservation_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  slot_interval_minutes smallint not null default 15 check (slot_interval_minutes >= 5),
  default_buffer_before_minutes smallint not null default 0 check (default_buffer_before_minutes >= 0),
  default_buffer_after_minutes smallint not null default 15 check (default_buffer_after_minutes >= 0),
  is_active boolean not null default true,
  deleted_at timestamptz
);

create unique index if not exists uq_reservation_rules_active on public.reservation_rules (restaurant_id) where is_active = true and deleted_at is null;

create table if not exists public.reservation_duration_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  min_party_size smallint not null check (min_party_size >= 1),
  max_party_size smallint not null check (max_party_size >= min_party_size),
  duration_minutes smallint not null check (duration_minutes >= 30),
  is_active boolean not null default true,
  deleted_at timestamptz
);

create index if not exists idx_duration_rules_lookup
  on public.reservation_duration_rules (restaurant_id, min_party_size, max_party_size)
  where is_active = true and deleted_at is null;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  reservation_code text not null,
  status reservation_status not null default 'pending',
  source reservation_source not null default 'web',
  customer_name text not null,
  customer_phone text not null,
  customer_email citext not null,
  customer_comment text,
  party_size smallint not null check (party_size >= 1),
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  occupancy_start_at timestamptz not null,
  occupancy_end_at timestamptz not null check (occupancy_end_at > occupancy_start_at),
  cancelled_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_reservation_code on public.reservations (restaurant_id, reservation_code);
create index if not exists idx_reservations_start on public.reservations (restaurant_id, start_at);

create table if not exists public.reservation_tables (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete restrict,
  reservation_status reservation_status not null,
  occupancy_start_at timestamptz not null,
  occupancy_end_at timestamptz not null check (occupancy_end_at > occupancy_start_at),
  occupancy_range tstzrange generated always as (
    tstzrange(occupancy_start_at, occupancy_end_at, '[)')
  ) stored,
  is_blocking boolean generated always as (
    reservation_status in ('pending', 'confirmed', 'seated')
  ) stored,
  unique (reservation_id, table_id)
);

alter table public.reservation_tables
  drop constraint if exists ex_reservation_tables_no_overlap;

alter table public.reservation_tables
  add constraint ex_reservation_tables_no_overlap
  exclude using gist (
    table_id with =,
    occupancy_range with &&
  )
  where (is_blocking = true);

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text not null,
  created_by_admin_user_id uuid references public.admin_users(id) on delete set null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_blocked_slots_range on public.blocked_slots (restaurant_id, starts_at, ends_at)
  where is_active = true and deleted_at is null;

create table if not exists public.audit_logs (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_admin_user_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

create or replace function public.rpc_create_reservation_atomic(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_party_size int,
  p_start_at timestamptz,
  p_customer_comment text default null,
  p_source reservation_source default 'web',
  p_created_by_admin_user_id uuid default null,
  p_internal_notes text default null
)
returns table (
  reservation_id uuid,
  reservation_code text,
  status reservation_status,
  start_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_rule record;
  v_duration int;
  v_end_at timestamptz;
  v_occ_start timestamptz;
  v_occ_end timestamptz;
  v_candidate_table_ids uuid[];
  v_candidate_max_capacity int;
  v_status reservation_status;
  v_reservation_id uuid;
  v_code text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || date_trunc('day', p_start_at)::text, 42));

  select
    slot_interval_minutes,
    default_buffer_before_minutes,
    default_buffer_after_minutes
  into v_rule
  from public.reservation_rules
  where restaurant_id = p_restaurant_id
    and is_active = true
    and deleted_at is null
  limit 1;

  if v_rule is null then
    raise exception 'MISSING_RULES';
  end if;

  select duration_minutes
  into v_duration
  from public.reservation_duration_rules
  where restaurant_id = p_restaurant_id
    and is_active = true
    and deleted_at is null
    and p_party_size between min_party_size and max_party_size
  order by min_party_size asc
  limit 1;

  if v_duration is null then
    raise exception 'MISSING_DURATION_RULE';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);
  v_occ_start := p_start_at - make_interval(mins => v_rule.default_buffer_before_minutes);
  v_occ_end := v_end_at + make_interval(mins => v_rule.default_buffer_after_minutes);

  with single_candidates as (
    select
      array[t.id]::uuid[] as table_ids,
      t.max_capacity::int as max_capacity,
      1 as table_count
    from public.tables t
    where t.restaurant_id = p_restaurant_id
      and t.is_active = true
      and t.deleted_at is null
      and p_party_size between t.min_capacity and t.max_capacity
  ),
  combo_candidates as (
    select
      array[c.table_1_id, c.table_2_id]::uuid[] as table_ids,
      (t1.max_capacity + t2.max_capacity)::int as max_capacity,
      2 as table_count
    from public.table_combinations c
    join public.tables t1 on t1.id = c.table_1_id
    join public.tables t2 on t2.id = c.table_2_id
    where c.restaurant_id = p_restaurant_id
      and c.is_active = true
      and c.deleted_at is null
      and t1.is_active = true and t1.deleted_at is null
      and t2.is_active = true and t2.deleted_at is null
      and p_party_size between (t1.min_capacity + t2.min_capacity) and (t1.max_capacity + t2.max_capacity)
  ),
  candidates as (
    select * from single_candidates
    union all
    select * from combo_candidates
  ),
  available as (
    select c.table_ids, c.max_capacity, c.table_count
    from candidates c
    where not exists (
      select 1
      from public.blocked_slots b
      where b.restaurant_id = p_restaurant_id
        and b.is_active = true
        and b.deleted_at is null
        and (b.table_id is null or b.table_id = any(c.table_ids))
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_occ_start, v_occ_end, '[)')
    )
    and not exists (
      select 1
      from public.reservation_tables rt
      where rt.table_id = any(c.table_ids)
        and rt.is_blocking = true
        and rt.occupancy_range && tstzrange(v_occ_start, v_occ_end, '[)')
    )
    order by (c.max_capacity - p_party_size) asc, c.table_count asc
    limit 1
  )
  select table_ids, max_capacity
  into v_candidate_table_ids, v_candidate_max_capacity
  from available;

  if v_candidate_table_ids is null then
    raise exception 'NO_AVAILABILITY';
  end if;

  v_status := case when p_source = 'admin' then 'confirmed'::reservation_status else 'pending'::reservation_status end;
  v_code := 'IB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.reservations (
    restaurant_id,
    reservation_code,
    status,
    source,
    customer_name,
    customer_phone,
    customer_email,
    customer_comment,
    party_size,
    start_at,
    end_at,
    occupancy_start_at,
    occupancy_end_at,
    internal_notes
  ) values (
    p_restaurant_id,
    v_code,
    v_status,
    p_source,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_customer_comment,
    p_party_size,
    p_start_at,
    v_end_at,
    v_occ_start,
    v_occ_end,
    p_internal_notes
  ) returning id into v_reservation_id;

  insert into public.reservation_tables (
    reservation_id,
    table_id,
    reservation_status,
    occupancy_start_at,
    occupancy_end_at
  )
  select
    v_reservation_id,
    unnest(v_candidate_table_ids),
    v_status,
    v_occ_start,
    v_occ_end;

  insert into public.audit_logs (
    restaurant_id, actor_admin_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_restaurant_id, p_created_by_admin_user_id, 'create_reservation', 'reservation', v_reservation_id,
    jsonb_build_object('party_size', p_party_size, 'start_at', p_start_at, 'selected_capacity', v_candidate_max_capacity)
  );

  return query
  select v_reservation_id, v_code, v_status, p_start_at;
end;
$$;

create or replace function public.rpc_reschedule_reservation_atomic(
  p_reservation_id uuid,
  p_new_start_at timestamptz,
  p_new_party_size int,
  p_admin_user_id uuid default null
)
returns table (
  reservation_id uuid,
  start_at timestamptz,
  party_size int
)
language plpgsql
security definer
as $$
declare
  v_reservation record;
  v_rule record;
  v_duration int;
  v_end_at timestamptz;
  v_occ_start timestamptz;
  v_occ_end timestamptz;
  v_candidate_table_ids uuid[];
  v_candidate_max_capacity int;
begin
  select * into v_reservation
  from public.reservations
  where id = p_reservation_id;

  if v_reservation is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_reservation.restaurant_id::text || date_trunc('day', p_new_start_at)::text, 42));

  select
    slot_interval_minutes,
    default_buffer_before_minutes,
    default_buffer_after_minutes
  into v_rule
  from public.reservation_rules
  where restaurant_id = v_reservation.restaurant_id
    and is_active = true
    and deleted_at is null
  limit 1;

  if v_rule is null then
    raise exception 'MISSING_RULES';
  end if;

  select duration_minutes
  into v_duration
  from public.reservation_duration_rules
  where restaurant_id = v_reservation.restaurant_id
    and is_active = true
    and deleted_at is null
    and p_new_party_size between min_party_size and max_party_size
  order by min_party_size asc
  limit 1;

  if v_duration is null then
    raise exception 'MISSING_DURATION_RULE';
  end if;

  v_end_at := p_new_start_at + make_interval(mins => v_duration);
  v_occ_start := p_new_start_at - make_interval(mins => v_rule.default_buffer_before_minutes);
  v_occ_end := v_end_at + make_interval(mins => v_rule.default_buffer_after_minutes);

  with single_candidates as (
    select
      array[t.id]::uuid[] as table_ids,
      t.max_capacity::int as max_capacity,
      1 as table_count
    from public.tables t
    where t.restaurant_id = v_reservation.restaurant_id
      and t.is_active = true
      and t.deleted_at is null
      and p_new_party_size between t.min_capacity and t.max_capacity
  ),
  combo_candidates as (
    select
      array[c.table_1_id, c.table_2_id]::uuid[] as table_ids,
      (t1.max_capacity + t2.max_capacity)::int as max_capacity,
      2 as table_count
    from public.table_combinations c
    join public.tables t1 on t1.id = c.table_1_id
    join public.tables t2 on t2.id = c.table_2_id
    where c.restaurant_id = v_reservation.restaurant_id
      and c.is_active = true
      and c.deleted_at is null
      and t1.is_active = true and t1.deleted_at is null
      and t2.is_active = true and t2.deleted_at is null
      and p_new_party_size between (t1.min_capacity + t2.min_capacity) and (t1.max_capacity + t2.max_capacity)
  ),
  candidates as (
    select * from single_candidates
    union all
    select * from combo_candidates
  ),
  available as (
    select c.table_ids, c.max_capacity, c.table_count
    from candidates c
    where not exists (
      select 1
      from public.blocked_slots b
      where b.restaurant_id = v_reservation.restaurant_id
        and b.is_active = true
        and b.deleted_at is null
        and (b.table_id is null or b.table_id = any(c.table_ids))
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_occ_start, v_occ_end, '[)')
    )
    and not exists (
      select 1
      from public.reservation_tables rt
      where rt.table_id = any(c.table_ids)
        and rt.reservation_id <> p_reservation_id
        and rt.is_blocking = true
        and rt.occupancy_range && tstzrange(v_occ_start, v_occ_end, '[)')
    )
    order by (c.max_capacity - p_new_party_size) asc, c.table_count asc
    limit 1
  )
  select table_ids, max_capacity
  into v_candidate_table_ids, v_candidate_max_capacity
  from available;

  if v_candidate_table_ids is null then
    raise exception 'NO_AVAILABILITY';
  end if;

  update public.reservations
  set
    start_at = p_new_start_at,
    end_at = v_end_at,
    occupancy_start_at = v_occ_start,
    occupancy_end_at = v_occ_end,
    party_size = p_new_party_size
  where id = p_reservation_id;

  delete from public.reservation_tables where reservation_id = p_reservation_id;
  insert into public.reservation_tables (
    reservation_id, table_id, reservation_status, occupancy_start_at, occupancy_end_at
  )
  select
    p_reservation_id,
    unnest(v_candidate_table_ids),
    v_reservation.status,
    v_occ_start,
    v_occ_end;

  insert into public.audit_logs (
    restaurant_id, actor_admin_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_reservation.restaurant_id, p_admin_user_id, 'reschedule_reservation', 'reservation', p_reservation_id,
    jsonb_build_object('new_start_at', p_new_start_at, 'party_size', p_new_party_size, 'selected_capacity', v_candidate_max_capacity)
  );

  return query
  select p_reservation_id, p_new_start_at, p_new_party_size;
end;
$$;
