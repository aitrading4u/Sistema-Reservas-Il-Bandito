-- Zona (sala / barra / terraza) y posición aproximada en el plano del panel.
-- barra: layout del bloque "BARRA" en el restaurante (un solo rectángulo).

alter table public.restaurants
  add column if not exists floor_bar_layout jsonb;

comment on column public.restaurants.floor_bar_layout is
  'JSON: {x,y,width,height} para el bloque barra en el plano admin.';

alter table public.tables
  add column if not exists dining_area text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_tables_dining_area' and conrelid = 'public.tables'::regclass
  ) then
    alter table public.tables
      add constraint chk_tables_dining_area
      check (dining_area is null or dining_area in ('sala', 'barra', 'terraza'));
  end if;
end $$;

alter table public.tables
  add column if not exists plan_x double precision;

alter table public.tables
  add column if not exists plan_y double precision;

comment on column public.tables.dining_area is 'sala, barra o terraza (panel admin / plano).';
comment on column public.tables.plan_x is 'Posición X en el plano (píxeles relativos al canvas).';
comment on column public.tables.plan_y is 'Posición Y en el plano.';
