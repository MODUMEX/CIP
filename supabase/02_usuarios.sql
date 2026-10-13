-- =====================================================================
-- CIP · 02 · Usuarios y roles
-- Pegar en el SQL Editor de Supabase (proyecto xvqpwddrxrglrsaetzle).
--
-- Dos roles y nada más:
--   admin    da de alta cuentas, les cambia la contraseña y usa el CIP
--   usuario  usa el CIP
--
-- El NOMBRE es el punto: en la lista de proyectos tiene que verse quién hizo
-- cada despiece, y el correo solo no alcanza para saberlo de un vistazo.
-- =====================================================================

create table if not exists public.usuario (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null default '',
  email     text not null default '',
  rol       text not null default 'usuario' check (rol in ('admin','usuario')),
  activo    boolean not null default true,
  creado_el timestamptz not null default now()
);

alter table public.usuario enable row level security;

-- Todos los que entran pueden LEER la lista: es lo que convierte un
-- `creado_por` en un nombre al pintar los proyectos.
drop policy if exists usuario_leer on public.usuario;
create policy usuario_leer on public.usuario
  for select using ( auth.uid() is not null );

-- Nadie escribe desde el navegador: las altas y los cambios de contraseña
-- pasan por la Edge Function, que usa la llave secreta y verifica el rol.
-- Sin políticas de insert/update/delete, la tabla es de solo lectura acá.

-- ---------------------------------------------------------------------
-- Quién hizo cada proyecto
-- ---------------------------------------------------------------------
-- `creado_por` ya existe en `proyecto`, pero nada lo llenaba: se pone solo
-- con el usuario de la sesión, que es el único dato en el que se puede
-- confiar (el navegador podría mandar cualquier cosa).
create or replace function public.sellar_autor() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
  end if;
  new.actualizado_el := now();
  return new;
end $$;

drop trigger if exists trg_tocar_proyecto on public.proyecto;
drop trigger if exists trg_sellar_autor on public.proyecto;
create trigger trg_sellar_autor
  before insert or update on public.proyecto
  for each row execute function public.sellar_autor();

-- quién lo tocó de último, que es lo que de verdad se quiere ver en la lista
alter table public.proyecto add column if not exists guardado_por uuid references auth.users(id);

create or replace function public.sellar_guardado() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  new.guardado_por := auth.uid();
  return new;
end $$;

drop trigger if exists trg_sellar_guardado on public.proyecto;
create trigger trg_sellar_guardado
  before insert or update on public.proyecto
  for each row execute function public.sellar_guardado();

-- ---------------------------------------------------------------------
-- El primer admin
-- ---------------------------------------------------------------------
-- La cuenta que ya existe queda como admin; desde la aplicación ella crea
-- las demás. Cambiá el correo si el primer admin es otro.
insert into public.usuario (id, nombre, email, rol)
select u.id, coalesce(u.raw_user_meta_data->>'nombre', ''), u.email, 'admin'
  from auth.users u
 where u.email = 'dlizano@modumex.com'
on conflict (id) do update set rol = 'admin';
