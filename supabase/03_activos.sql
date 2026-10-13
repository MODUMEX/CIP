-- =====================================================================
-- CIP · 03 · Que desactivar sirva de algo
-- Pegar en el SQL Editor de Supabase (proyecto xvqpwddrxrglrsaetzle).
--
-- Hasta acá, "Desactivar" solo pintaba un letrero: la cuenta seguía
-- entrando y guardando despieces, porque la regla de la tabla `proyecto`
-- decía nada más "que haya alguien con sesión". Ahora la base exige que
-- esa persona esté dada de alta en el CIP y activa.
--
-- Esto también tapa el otro portillo: una cuenta creada a mano en el panel
-- de Auth, sin ficha en `usuario`, ya no puede tocar los proyectos.
-- =====================================================================

-- `security definer` para que la consulta a `usuario` no se choque con las
-- propias reglas de esa tabla; `stable` para que Postgres la resuelva una vez
-- por consulta y no una vez por renglón.
create or replace function public.cip_activo() returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.usuario u
     where u.id = auth.uid() and u.activo
  )
$$;

drop policy if exists proyecto_todo on public.proyecto;
create policy proyecto_todo on public.proyecto
  for all
  using ( public.cip_activo() )
  with check ( public.cip_activo() );

-- ---------------------------------------------------------------------
-- Nadie sin nombre
-- ---------------------------------------------------------------------
-- La columna "Guardado por" sale en blanco si la ficha no tiene nombre, y
-- entonces no cumple para lo que se hizo. A las fichas viejas se les pone el
-- correo como nombre provisional; desde la pestaña 05 se corrige.
update public.usuario
   set nombre = initcap(split_part(email, '@', 1))
 where coalesce(nombre, '') = '';

-- y que no vuelvan a aparecer en blanco. Se puede correr este archivo dos
-- veces sin que reclame.
alter table public.usuario drop constraint if exists usuario_nombre_no_vacio;
alter table public.usuario
  add constraint usuario_nombre_no_vacio check ( length(trim(nombre)) > 0 );
