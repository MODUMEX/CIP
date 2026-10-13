/**
 * Guardar y abrir proyectos del CIP en Supabase.
 *
 * El CIP arma todo el trabajo en un objeto en memoria —`STATE`— y hasta ahora
 * no lo guardaba en ningún lado: al cerrar la pestaña se perdía. Acá se manda
 * ese objeto tal cual a una columna jsonb y se vuelve a poner al abrir.
 *
 * Va sin librería y sin el SDK de Supabase: la API REST es un fetch con dos
 * cabeceras, y el CIP es un solo HTML que también se usa suelto. Todo lo que
 * agrega esta pantalla se arma desde acá, así que el index solo la carga.
 *
 * Sin llave configurada no se activa nada (ver js/config.js).
 */
;(function () {
  const CFG = window.CIP_SUPABASE || {}
  if (!CFG.URL || !CFG.LLAVE) return

  /**
   * El CIP declara `const STATE = {…}` en el tope de su script. Un `const`
   * de nivel superior NO queda como propiedad de `window` —solo un `var` o
   * una función lo hacen—, así que `window.STATE` es undefined y hay que
   * leerlo como identificador global. Los dos scripts son clásicos y comparten
   * ese ámbito, así que esto sí lo encuentra.
   */
  const estado = () => (typeof STATE !== 'undefined' ? STATE : window.STATE)

  const CLAVE_SESION = 'cip-sesion'
  let sesion = null
  try {
    sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null')
  } catch {
    sesion = null
  }

  const guardarSesion = (s) => {
    sesion = s
    try {
      if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s))
      else localStorage.removeItem(CLAVE_SESION)
    } catch {
      /* en una ventana privada no se puede: la sesión dura lo que la pestaña */
    }
  }

  const cabeceras = () => ({
    apikey: CFG.LLAVE,
    Authorization: 'Bearer ' + (sesion?.access_token || CFG.LLAVE),
    'Content-Type': 'application/json',
  })

  // ───────────────────────────── API

  async function entrar(email, password) {
    const r = await fetch(CFG.URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: CFG.LLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, mensaje: d.error_description || d.msg || 'No se pudo entrar.' }
    guardarSesion({ access_token: d.access_token, refresh_token: d.refresh_token, email })
    return { ok: true }
  }

  /**
   * El token de Supabase dura una hora. Cuando vence, en vez de dejar al
   * usuario con un 401 sin explicación se renueva con el refresh y se
   * reintenta una sola vez.
   */
  async function renovar() {
    if (!sesion?.refresh_token) return false
    const r = await fetch(CFG.URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: CFG.LLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sesion.refresh_token }),
    })
    if (!r.ok) {
      guardarSesion(null)
      return false
    }
    const d = await r.json()
    guardarSesion({ access_token: d.access_token, refresh_token: d.refresh_token, email: sesion.email })
    return true
  }

  async function pedir(ruta, opciones = {}, reintento = true) {
    const r = await fetch(CFG.URL + '/rest/v1/' + ruta, { ...opciones, headers: cabeceras() })
    if (r.status === 401 && reintento && (await renovar())) return pedir(ruta, opciones, false)
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      throw new Error(t.slice(0, 200) || 'Supabase respondió ' + r.status)
    }
    return r.status === 204 ? null : r.json()
  }

  const COLUMNAS = 'proyecto_id,exp,obra,cliente,linea,modelo,region,color,piezas,actualizado_el'

  const listar = () => pedir('proyecto?select=' + COLUMNAS + '&order=actualizado_el.desc&limit=200')

  const abrir = (id) => pedir('proyecto?select=app_json&proyecto_id=eq.' + id)

  /** lo que se ve en la lista; el resto viaja adentro del json */
  function resumen() {
    const S = estado() || {}
    return {
      exp: String(S.exp || '').trim() || 'sin expediente',
      obra: S.obra || '',
      cliente: S.cliente || '',
      linea: S.linea || '',
      modelo: S.modeloCod || S.modelo || '',
      region: S.region || 'CR',
      color: S.color || '',
      piezas: Array.isArray(S.pieces) ? S.pieces.length : 0,
    }
  }

  async function guardar(id) {
    const fila = { ...resumen(), app_json: estado() }
    if (id) {
      await pedir('proyecto?proyecto_id=eq.' + id, { method: 'PATCH', body: JSON.stringify(fila) })
      return id
    }
    const creado = await pedir('proyecto', {
      method: 'POST',
      headers: {},
      body: JSON.stringify([fila]),
    })
    return Array.isArray(creado) && creado[0] ? creado[0].proyecto_id : null
  }

  const borrar = (id) => pedir('proyecto?proyecto_id=eq.' + id, { method: 'DELETE' })

  // ───────────────────────────── pantalla

  let abiertoId = null

  // Los colores son los del CIP (variables del index): si el panel saliera
  // blanco sobre la pantalla oscura pareceria de otra aplicacion.
  const css = `
    .cip-nube-btn{position:fixed;right:18px;bottom:18px;z-index:9998;border:1px solid var(--cyan-dim,#007a8a);
      border-radius:999px;padding:.6rem 1.05rem;font-weight:700;cursor:pointer;
      background:var(--panel,#0f1420);color:var(--cyan,#00e5ff);letter-spacing:.3px;
      box-shadow:0 6px 20px rgba(0,0,0,.5);font-size:.82rem}
    .cip-nube-btn:hover{color:var(--cyan-soft,#5ff0ff);border-color:var(--cyan,#00e5ff)}
    .cip-nube-fondo{position:fixed;inset:0;z-index:9999;background:rgba(3,6,11,.72);
      display:flex;align-items:center;justify-content:center;padding:20px}
    .cip-nube-caja{background:var(--panel,#0f1420);color:var(--text,#d8e3f3);
      border:1px solid var(--line,#1c2536);border-radius:12px;max-width:960px;width:100%;
      max-height:85vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.6);
      font-family:inherit}
    .cip-nube-caja h3{margin:0 0 4px;font-size:1.05rem;color:var(--cyan,#00e5ff);letter-spacing:.5px}
    .cip-nube-caja .sub{color:var(--text-dim,#7d8aa0);font-size:.82rem;margin:0 0 16px}
    .cip-nube-caja table{width:100%;border-collapse:collapse;font-size:.82rem}
    .cip-nube-caja th{text-align:left;color:var(--cyan-dim,#007a8a);padding:.45rem .6rem;
      border-bottom:1px solid var(--line,#1c2536);text-transform:uppercase;font-size:.72rem}
    .cip-nube-caja td{padding:.5rem .6rem;border-bottom:1px solid var(--line,#1c2536)}
    .cip-nube-caja tr:hover td{background:rgba(0,229,255,.05)}
    .cip-nube-caja input{padding:.5rem .6rem;border:1px solid var(--line,#1c2536);border-radius:7px;
      font-size:.85rem;background:var(--bg,#07090d);color:var(--text,#d8e3f3);font-family:inherit}
    .cip-nube-caja input:focus{outline:0;border-color:var(--cyan-dim,#007a8a)}
    .cip-nube-caja .btn{border:1px solid var(--cyan-dim,#007a8a);border-radius:7px;padding:.45rem .85rem;
      font-weight:600;cursor:pointer;background:transparent;color:var(--cyan,#00e5ff);font-size:.8rem;
      font-family:inherit}
    .cip-nube-caja .btn:hover{background:rgba(0,229,255,.1)}
    .cip-nube-caja .btn.gris{border-color:var(--line,#1c2536);color:var(--text-dim,#7d8aa0)}
    .cip-nube-caja .btn.rojo{border-color:#7a2020;color:#ff7b7b}
    .cip-nube-caja .fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
    .cip-nube-aviso{margin-top:12px;padding:.6rem .8rem;border-radius:8px;font-size:.82rem;
      background:rgba(255,80,80,.1);color:#ff9b9b;border:1px solid #5a2020}
    .cip-nube-aviso.ok{background:rgba(0,255,149,.08);color:var(--green-soft,#5fffb8);border-color:var(--green-dim,#007a48)}
  `

  function estilos() {
    if (document.getElementById('cip-nube-css')) return
    const s = document.createElement('style')
    s.id = 'cip-nube-css'
    s.textContent = css
    document.head.appendChild(s)
  }

  function cerrar() {
    document.querySelector('.cip-nube-fondo')?.remove()
  }

  function caja(dentro) {
    cerrar()
    estilos()
    const fondo = document.createElement('div')
    fondo.className = 'cip-nube-fondo'
    fondo.innerHTML = '<div class="cip-nube-caja"></div>'
    fondo.addEventListener('click', (e) => {
      if (e.target === fondo) cerrar()
    })
    fondo.querySelector('.cip-nube-caja').append(...dentro)
    document.body.appendChild(fondo)
    return fondo.querySelector('.cip-nube-caja')
  }

  const el = (html) => {
    const d = document.createElement('div')
    d.innerHTML = html.trim()
    return d.firstElementChild
  }

  function pantallaEntrar() {
    const cont = el(`<div>
      <h3>Entrar</h3>
      <p class="sub">Con tu cuenta de Modumex. Los proyectos quedan guardados para todos.</p>
      <div class="fila">
        <input id="cip-email" type="email" placeholder="correo" style="min-width:230px">
        <input id="cip-pass" type="password" placeholder="contraseña" style="min-width:170px">
        <button class="btn" id="cip-entrar">Entrar</button>
        <button class="btn gris" id="cip-cancelar">Cancelar</button>
      </div>
      <div id="cip-msg"></div>
    </div>`)
    const c = caja([cont])
    const msg = (t, ok) => {
      c.querySelector('#cip-msg').innerHTML = `<div class="cip-nube-aviso ${ok ? 'ok' : ''}">${t}</div>`
    }
    c.querySelector('#cip-cancelar').onclick = cerrar
    c.querySelector('#cip-entrar').onclick = async () => {
      const r = await entrar(c.querySelector('#cip-email').value.trim(), c.querySelector('#cip-pass').value)
      if (r.ok) pantallaProyectos()
      else msg(r.mensaje)
    }
  }

  const fecha = (iso) => {
    const d = new Date(iso)
    return isNaN(d) ? '' : d.toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  async function pantallaProyectos() {
    const cont = el(`<div>
      <h3>Proyectos</h3>
      <p class="sub">Se guardan en la nube: lo que guarde uno lo abre cualquiera.</p>
      <div class="fila">
        <button class="btn" id="cip-guardar">Guardar el de ahora</button>
        <button class="btn gris" id="cip-salir">Cerrar sesión</button>
        <span style="flex:1"></span>
        <button class="btn gris" id="cip-cerrar">Cerrar</button>
      </div>
      <div id="cip-lista">Consultando…</div>
      <div id="cip-msg"></div>
    </div>`)
    const c = caja([cont])
    const msg = (t, ok) => {
      c.querySelector('#cip-msg').innerHTML = `<div class="cip-nube-aviso ${ok ? 'ok' : ''}">${t}</div>`
    }

    c.querySelector('#cip-cerrar').onclick = cerrar
    c.querySelector('#cip-salir').onclick = () => {
      guardarSesion(null)
      abiertoId = null
      pantallaEntrar()
    }
    c.querySelector('#cip-guardar').onclick = async () => {
      try {
        abiertoId = await guardar(abiertoId)
        msg('Guardado.', true)
        pintar()
      } catch (e) {
        msg('No se pudo guardar: ' + e.message)
      }
    }

    async function pintar() {
      const caja2 = c.querySelector('#cip-lista')
      try {
        const filas = await listar()
        if (!filas.length) {
          caja2.innerHTML = '<p class="sub">Todavía no hay proyectos guardados.</p>'
          return
        }
        caja2.innerHTML =
          '<table><thead><tr><th>Expediente</th><th>Obra</th><th>Cliente</th><th>Línea</th>' +
          '<th>Piezas</th><th>Actualizado</th><th></th></tr></thead><tbody>' +
          filas
            .map(
              (f) => `<tr data-id="${f.proyecto_id}">
                <td><b>${f.exp || ''}</b></td><td>${f.obra || ''}</td><td>${f.cliente || ''}</td>
                <td>${f.linea || ''} ${f.modelo || ''}</td><td>${f.piezas ?? ''}</td>
                <td>${fecha(f.actualizado_el)}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn" data-abrir="${f.proyecto_id}">Abrir</button>
                  <button class="btn rojo" data-borrar="${f.proyecto_id}">Borrar</button>
                </td></tr>`,
            )
            .join('') +
          '</tbody></table>'

        caja2.querySelectorAll('[data-abrir]').forEach((b) => {
          b.onclick = async () => {
            try {
              const r = await abrir(b.dataset.abrir)
              const json = r?.[0]?.app_json
              if (!json) return msg('Ese proyecto no tiene datos guardados.')
              // se vacía y se rellena el MISMO objeto: el resto del CIP tiene
              // la referencia capturada y reasignarlo no la cambiaría
              const S = estado()
              Object.keys(S).forEach((k) => delete S[k])
              Object.assign(S, json)
              abiertoId = Number(b.dataset.abrir)
              cerrar()
              // el CIP repinta todo desde STATE
              if (typeof window.renderAll === 'function') window.renderAll()
            } catch (e) {
              msg('No se pudo abrir: ' + e.message)
            }
          }
        })
        caja2.querySelectorAll('[data-borrar]').forEach((b) => {
          b.onclick = async () => {
            if (!confirm('¿Borrar ese proyecto? No se puede deshacer.')) return
            try {
              await borrar(b.dataset.borrar)
              if (abiertoId === Number(b.dataset.borrar)) abiertoId = null
              pintar()
            } catch (e) {
              msg('No se pudo borrar: ' + e.message)
            }
          }
        })
      } catch (e) {
        caja2.innerHTML = ''
        msg('No se pudo consultar: ' + e.message)
      }
    }
    pintar()
  }

  function arrancar() {
    estilos()
    const b = document.createElement('button')
    b.className = 'cip-nube-btn'
    b.textContent = '☁ Proyectos'
    b.onclick = () => (sesion ? pantallaProyectos() : pantallaEntrar())
    document.body.appendChild(b)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar)
  else arrancar()
})()
