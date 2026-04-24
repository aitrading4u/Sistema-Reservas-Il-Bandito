-- Max concurrent reservations (table bookings) that start in the same time bucket (aligned to slot_interval_minutes, Madrid time).
alter table public.reservation_rules
  add column if not exists max_reservations_per_slot smallint not null default 3
  check (max_reservations_per_slot between 1 and 100);

-- Recreate rpc: enforce slot cap before creating reservation.
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
  v_slot_interval int;
  v_buffer_before int;
  v_buffer_after int;
  v_max_per_slot int;
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
  v_bucket int;
  v_slot_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || date_trunc('day', p_start_at)::text, 42));

  select
    r.slot_interval_minutes,
    r.default_buffer_before_minutes,
    r.default_buffer_after_minutes,
    coalesce(r.max_reservations_per_slot, 3)
  into v_slot_interval, v_buffer_before, v_buffer_after, v_max_per_slot
  from public.reservation_rules r
  where r.restaurant_id = p_restaurant_id
    and r.is_active = true
    and r.deleted_at is null
  limit 1;

  if v_slot_interval is null then
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
  v_occ_start := p_start_at - make_interval(mins => v_buffer_before);
  v_occ_end := v_end_at + make_interval(mins => v_buffer_after);

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

  v_bucket := (
    (extract(hour from (p_start_at at time zone 'Europe/Madrid'))::int * 60
     + extract(minute from (p_start_at at time zone 'Europe/Madrid'))::int
  ) / v_slot_interval
  );

  select count(*)::int
  into v_slot_count
  from public.reservations r2
  where r2.restaurant_id = p_restaurant_id
    and (r2.start_at at time zone 'Europe/Madrid')::date
      = (p_start_at at time zone 'Europe/Madrid')::date
    and r2.status in ('pending', 'confirmed', 'seated')
    and (
      (extract(hour from (r2.start_at at time zone 'Europe/Madrid'))::int * 60
        + extract(minute from (r2.start_at at time zone 'Europe/Madrid'))::int
      ) / v_slot_interval
    ) = v_bucket;

  if v_slot_count >= v_max_per_slot then
    raise exception 'SLOT_CAP_REACHED';
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
