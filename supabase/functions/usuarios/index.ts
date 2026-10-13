// =====================================================================
// Edge Function: usuarios
//
// Da de alta cuentas del CIP y les cambia la contraseña. Corre EN EL
// SERVIDOR con la service_role key, que es la única que puede tocar
// `auth.users` — y que el navegador no debe ver nunca.
//
// Solo el ADMIN. El rol no se lee de lo que mande el navegador: se busca en
// la tabla `usuario` a partir del token de quien llama.
//
// Desplegar:  npx supabase functions deploy usuarios --project-ref xvqpwddrxrglrsaetzle
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const URL_SUPA = Deno.env.get('SUPABASE_URL')!
    const SECRETA = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

    // 1) quién llama
    const auth = req.headers.get('Authorization') ?? ''
    const comoLlamante = createClient(URL_SUPA, ANON, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await comoLlamante.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(URL_SUPA, SECRETA)
    const { data: perfil } = await admin.from('usuario').select('rol,activo').eq('id', user.id).single()
    if (!perfil) return json({ error: 'Tu cuenta no está dada de alta en el CIP' }, 403)
    if (perfil.activo === false) return json({ error: 'Tu cuenta está desactivada' }, 403)
    if (perfil.rol !== 'admin') return json({ error: 'Solo un administrador maneja las cuentas' }, 403)

    const body = await req.json()
    const accion = body.accion

    // 2) la acción
    if (accion === 'listar') {
      const { data, error } = await admin
        .from('usuario')
        .select('id,nombre,email,rol,activo,creado_el')
        .order('nombre', { ascending: true })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, usuarios: data ?? [] })
    }

    if (accion === 'crear') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const nombre = String(body.nombre ?? '').trim()
      const password = String(body.password ?? '')
      const rol = body.rol === 'admin' ? 'admin' : 'usuario'
      if (!email || !nombre) return json({ error: 'Hacen falta el nombre y el correo' }, 400)
      if (password.length < 6) return json({ error: 'La contraseña tiene que tener al menos 6 caracteres' }, 400)

      // confirmado de una: en el CIP no hay correo de bienvenida que abrir
      const { data: creado, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre },
      })
      if (error) return json({ error: error.message }, 400)

      const { error: e2 } = await admin.from('usuario').insert({ id: creado.user!.id, nombre, email, rol })
      if (e2) {
        // si no se pudo dejar la ficha, no se deja la cuenta suelta en Auth
        await admin.auth.admin.deleteUser(creado.user!.id)
        return json({ error: e2.message }, 400)
      }
      return json({ ok: true, id: creado.user!.id })
    }

    if (accion === 'cambiar_clave') {
      const id = String(body.id ?? '')
      const password = String(body.password ?? '')
      if (!id) return json({ error: 'Falta el usuario' }, 400)
      if (password.length < 6) return json({ error: 'La contraseña tiene que tener al menos 6 caracteres' }, 400)
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (accion === 'actualizar') {
      const id = String(body.id ?? '')
      if (!id) return json({ error: 'Falta el usuario' }, 400)
      const cambios: Record<string, unknown> = {}
      if (body.nombre !== undefined) cambios.nombre = String(body.nombre).trim()
      if (body.rol !== undefined) cambios.rol = body.rol === 'admin' ? 'admin' : 'usuario'
      if (body.activo !== undefined) cambios.activo = !!body.activo
      // un admin no se puede dejar a sí mismo afuera y quedarse sin quien administre
      if (id === user.id && (cambios.rol === 'usuario' || cambios.activo === false)) {
        return json({ error: 'No podés quitarte a vos mismo el acceso de administrador' }, 400)
      }
      const { error } = await admin.from('usuario').update(cambios).eq('id', id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (accion === 'borrar') {
      const id = String(body.id ?? '')
      if (!id) return json({ error: 'Falta el usuario' }, 400)
      if (id === user.id) return json({ error: 'No podés borrar tu propia cuenta' }, 400)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida: ' + accion }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Falló' }, 500)
  }
})
