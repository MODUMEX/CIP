-- =====================================================================
-- CIP · Cálculo de Materiales — 01 · Esquema
-- Pegar en el SQL Editor de Supabase (proyecto xvqpwddrxrglrsaetzle).
--
-- El CIP arma TODO el trabajo en un solo objeto en memoria (STATE): la
-- identificación, las piezas, los cortes, los sobrantes y las decisiones
-- manuales de la hoja de corte. Por eso el proyecto se guarda tal cual, en
-- una columna jsonb: abrir un proyecto es volver a poner ese objeto donde
-- estaba, sin tener que desarmarlo en tablas que después habría que
-- mantener a la par del cálculo.
--
-- Las columnas sueltas de arriba son SOLO para la lista: buscar por obra o
-- por expediente sin leer el json entero.
-- =====================================================================

create table if not exists public.proyecto (
  proyecto_id    bigint generated always as identity primary key,
  -- lo que se ve en la lista. El NOMBRE lo pone quien guarda; el ID es el
  -- numero de la izquierda y es con lo que se piden los proyectos en planta.
  nombre         text not null default '',
  exp            text not null default '',
  obra           text not null default '',
  cliente        text not null default '',
  linea          text not null default '',
  modelo         text not null default '',
  region         text not null default 'CR',
  color          text not null default '',
  piezas         integer not null default 0,
  -- el trabajo completo
  app_json       jsonb not null,
  -- control
  creado_por     uuid references auth.users(id) on delete set null,
  creado_el      timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

create index if not exists ix_proyecto_actualizado on public.proyecto(actualizado_el desc);
create index if not exists ix_proyecto_exp         on public.proyecto(exp);
create index if not exists ix_proyecto_nombre      on public.proyecto(nombre);

-- ---------------------------------------------------------------------
-- Quién ve qué
--
-- El CIP es una herramienta INTERNA de producción: los de planta trabajan
-- sobre los mismos expedientes, así que todo el que tenga cuenta ve y edita
-- todo. No hay dueños ni roles por ahora; si más adelante hacen falta, se
-- agregan sin tocar los datos.
-- ---------------------------------------------------------------------
alter table public.proyecto enable row level security;

drop policy if exists proyecto_todo on public.proyecto;
create policy proyecto_todo on public.proyecto
  for all
  using ( auth.uid() is not null )
  with check ( auth.uid() is not null );

-- `actualizado_el` se pone solo: si lo manda el navegador, un reloj mal
-- puesto desordena la lista.
create or replace function public.tocar_proyecto() returns trigger
  language plpgsql as
$$
begin
  new.actualizado_el := now();
  return new;
end $$;

drop trigger if exists trg_tocar_proyecto on public.proyecto;
create trigger trg_tocar_proyecto
  before update on public.proyecto
  for each row execute function public.tocar_proyecto();
