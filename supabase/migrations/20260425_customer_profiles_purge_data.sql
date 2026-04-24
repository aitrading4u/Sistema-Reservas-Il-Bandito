-- Per-restaurant customer profile (one row per email per restaurant); linked from reservations.
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  display_name text not null,
  customer_email citext not null,
  customer_phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_customer_profiles_restaurant_email
  on public.customer_profiles (restaurant_id, customer_email);

alter table public.reservations
  add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;

create index if not exists idx_reservations_customer_profile
  on public.reservations (customer_profile_id)
  where customer_profile_id is not null;

drop trigger if exists trg_customer_profiles_updated_at on public.customer_profiles;
create trigger trg_customer_profiles_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

-- Purge reservations, blockages, blacklist, audit, and customer profiles (keeps config and admins).
create or replace function public.rpc_purge_restaurant_operational_data(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reservations where restaurant_id = p_restaurant_id;
  delete from public.customer_blacklist where restaurant_id = p_restaurant_id;
  delete from public.blocked_slots where restaurant_id = p_restaurant_id;
  delete from public.audit_logs where restaurant_id = p_restaurant_id;
  delete from public.customer_profiles where restaurant_id = p_restaurant_id;
end;
$$;

-- Recreate reservation RPC: upsert customer profile and attach to reservation.
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
  v_profile_id uuid;
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

  insert into public.customer_profiles (restaurant_id, display_name, customer_email, customer_phone)
  values (p_restaurant_id, p_customer_name, p_customer_email, p_customer_phone)
  on conflict (restaurant_id, customer_email)
  do update set
    display_name = excluded.display_name,
    customer_phone = excluded.customer_phone,
    updated_at = now()
  returning id into v_profile_id;

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
    internal_notes,
    customer_profile_id
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
    p_internal_notes,
    v_profile_id
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
    jsonb_build_object('party_size', p_party_size, 'start_at', p_start_at, 'selected_capacity', v_candidate_max_capacity, 'customer_profile_id', v_profile_id)
  );

  return query
  select v_reservation_id, v_code, v_status, p_start_at;
end;
$$;
