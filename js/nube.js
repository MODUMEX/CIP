/**
 * Entrada y proyectos del CIP en Supabase.
 *
 * Dos cosas:
 *
 *   1. ENTRAR. Publicado en la web, cualquiera con el link llegaría a la
 *      aplicación, así que la pantalla de entrar TAPA todo hasta que se inicia
 *      sesión. Sin sesión tampoco hay token, y la base rechaza cualquier
 *      consulta por RLS; la tapa es para que ni siquiera se vea.
 *
 *   2. PROYECTOS. El CIP arma todo el trabajo en un objeto en memoria —`STATE`—
 *      y hasta ahora no lo guardaba en ningún lado: al cerrar la pestaña se
 *      perdía. Se manda ese objeto tal cual a una columna jsonb y se vuelve a
 *      poner al abrir. Vive en su propia pestaña, la 04, al lado de las otras.
 *
 * Hay UN SOLO rol: el que tiene cuenta entra y ve todos los proyectos. El CIP
 * es una herramienta interna de planta y varios trabajan los mismos
 * expedientes.
 *
 * Va sin librería y sin el SDK de Supabase: su API REST es un fetch con dos
 * cabeceras, y el CIP es un solo HTML que también se usa suelto.
 *
 * SIN LLAVE CONFIGURADA NO SE ACTIVA NADA (ver js/config.js): la copia que
 * todavía se reparte por OneDrive se abre igual que siempre, sin pedir nada.
 */
;(function () {
  const CFG = window.CIP_SUPABASE || {}

  /** se quita la portada de arranque y queda la aplicación a la vista */
  function destapar() {
    const quitar = () => document.getElementById('cip-arranque')?.remove()
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quitar)
    else quitar()
  }

  // la copia suelta, sin llave, no tiene login que esperar
  if (!CFG.URL || !CFG.LLAVE) {
    destapar()
    return
  }

  /**
   * El CIP declara `const STATE = {…}` en el tope de su script. Un `const` de
   * nivel superior NO queda como propiedad de `window` —solo un `var` o una
   * función lo hacen—, así que `window.STATE` es undefined y hay que leerlo
   * como identificador global. Los dos scripts son clásicos y comparten ese
   * ámbito, así que esto sí lo encuentra.
   */
  const estado = () => (typeof STATE !== 'undefined' ? STATE : window.STATE)

  /**
   * A los cuántos minutos sin tocar nada se cierra sola.
   *
   * Va además de que la sesión no sobreviva a la pestaña: una pestaña abierta
   * y olvidada toda la tarde queda igual de expuesta. El reloj se reinicia con
   * cualquier clic o tecla, así que a nadie le corta el trabajo mientras está
   * trabajando.
   */
  const MINUTOS_INACTIVO = 60

  /**
   * La sesión se guarda en `sessionStorage`, NO en `localStorage`: muere al
   * cerrar la pestaña, así que la próxima vez que se abre el CIP hay que
   * entrar de nuevo. Decisión de Dayanna (13-oct-2026): que se cierre siempre.
   * Aguanta un F5 —si no, recargar sacaría a cualquiera a mitad del trabajo—
   * pero no la vuelta del día siguiente.
   */
  const CLAVE_SESION = 'cip-sesion'
  let sesion = null
  try {
    sesion = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null')
    // una sesión vieja guardada por la versión anterior no se hereda
    localStorage.removeItem(CLAVE_SESION)
  } catch {
    sesion = null
  }

  const guardarSesion = (s) => {
    sesion = s
    try {
      if (s) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s))
      else sessionStorage.removeItem(CLAVE_SESION)
    } catch {
      /* en una ventana privada no se puede: la sesión dura lo que la página */
    }
  }

  const cabeceras = () => ({
    apikey: CFG.LLAVE,
    Authorization: 'Bearer ' + (sesion?.access_token || CFG.LLAVE),
    'Content-Type': 'application/json',
  })

  // ───────────────────────────────────────────────── API

  async function entrar(email, password) {
    const r = await fetch(CFG.URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: CFG.LLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      const m = d.error_description || d.msg || ''
      return {
        ok: false,
        mensaje: /invalid/i.test(m) ? 'Correo o contraseña incorrectos.' : m || 'No se pudo entrar.',
      }
    }
    guardarSesion({ access_token: d.access_token, refresh_token: d.refresh_token, email })
    return { ok: true }
  }

  /**
   * El token de Supabase dura una hora. Cuando vence, en vez de dejar a la
   * persona con un 401 sin explicación, se renueva con el refresh y se
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
    const r = await fetch(CFG.URL + '/rest/v1/' + ruta, {
      ...opciones,
      headers: { ...cabeceras(), ...(opciones.headers || {}) },
    })
    if (r.status === 401) {
      if (reintento && (await renovar())) return pedir(ruta, opciones, false)
      guardarSesion(null)
      tapar()
      throw new Error('Se venció la sesión: volvé a entrar.')
    }
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      throw new Error(t.slice(0, 200) || 'Supabase respondió ' + r.status)
    }
    // Un insert sin `Prefer: return=representation` contesta 201 con el cuerpo
    // VACÍO, y un delete contesta 204. Leer eso como JSON reventaba con
    // "Unexpected end of JSON input" aunque la fila se hubiera guardado bien.
    const texto = await r.text()
    if (!texto) return null
    try {
      return JSON.parse(texto)
    } catch {
      return null
    }
  }

  /**
   * Mi ficha en la tabla `usuario`: el nombre con el que se firman los
   * despieces y el rol. El rol NO se guarda en el navegador: se vuelve a
   * preguntar en cada arranque, así que quitarle el admin a alguien tiene
   * efecto apenas recarga, y de todas formas quien decide es la función.
   */
  let yo = null

  async function cargarmeYo() {
    try {
      const r = await pedir('usuario?select=id,nombre,rol,activo&id=eq.' + (await miId()))
      yo = Array.isArray(r) && r[0] ? r[0] : null
    } catch {
      yo = null
    }
    return yo
  }

  /**
   * Por qué esta cuenta no puede usar el CIP, o cadena vacía si puede.
   *
   * Tener contraseña buena no alcanza: la cuenta tiene que estar dada de alta
   * en la tabla `usuario` y activa. Esto es solo el aviso bonito — al que de
   * verdad le cierra la puerta es la base, que no le deja ni leer ni guardar
   * proyectos a una cuenta desactivada.
   */
  function porQueNoPuede() {
    if (!yo) return 'Tu cuenta no está dada de alta en el CIP. Pedile al administrador que te agregue.'
    if (yo.activo === false) return 'Tu cuenta está desactivada. Hablá con el administrador.'
    return ''
  }

  /** el id del usuario sale del propio token, no de una consulta */
  async function miId() {
    if (!sesion?.access_token) return ''
    try {
      const carga = JSON.parse(atob(sesion.access_token.split('.')[1]))
      return carga.sub || ''
    } catch {
      return ''
    }
  }

  const COLUMNAS = 'proyecto_id,nombre,exp,obra,cliente,linea,modelo,piezas,actualizado_el,guardado_por'
  const listar = () => pedir('proyecto?select=' + COLUMNAS + '&order=actualizado_el.desc&limit=300')
  const leer = (id) => pedir('proyecto?select=app_json&proyecto_id=eq.' + id)
  const borrar = (id) => pedir('proyecto?proyecto_id=eq.' + id, { method: 'DELETE' })

  /** lo que se ve en la lista; el resto viaja adentro del json */
  function resumen(nombre) {
    const S = estado() || {}
    return {
      nombre: (nombre || '').trim().slice(0, 120),
      exp: String(S.exp || '').trim(),
      obra: S.obra || '',
      cliente: S.cliente || '',
      linea: S.linea || '',
      modelo: S.modeloCod || S.modelo || '',
      region: S.region || 'CR',
      color: S.color || '',
      piezas: Array.isArray(S.pieces) ? S.pieces.length : 0,
    }
  }

  async function guardar(nombre, id) {
    const fila = { ...resumen(nombre), app_json: estado() }
    if (id) {
      await pedir('proyecto?proyecto_id=eq.' + id, { method: 'PATCH', body: JSON.stringify(fila) })
      return id
    }
    // sin esto PostgREST no devuelve nada y no habría ID que mostrar
    const creado = await pedir('proyecto', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([fila]),
    })
    return Array.isArray(creado) && creado[0] ? creado[0].proyecto_id : null
  }

  // ───────────────────────────────────────────────── estilos

  // Los colores son los del CIP (variables del index): si saliera blanco sobre
  // la pantalla oscura parecería de otra aplicación.
  const css = `
    .cip-tapa{position:fixed;inset:0;z-index:99999;background:var(--bg,#07090d);
      display:flex;align-items:center;justify-content:center;padding:20px}
    .cip-entrar{width:100%;max-width:480px;background:var(--panel,#0f1420);
      border:1px solid var(--line,#1c2536);border-radius:16px;padding:44px 42px;
      box-shadow:0 20px 60px rgba(0,0,0,.6)}
    /* en px y no en rem: la aplicación pone el tamaño base en 13px y acá las
       medidas relativas se quedan cortas */
    .cip-entrar h2{margin:0 0 8px;font-size:25px;color:var(--cyan,#00e5ff);letter-spacing:.5px}
    .cip-entrar p{margin:0 0 28px;color:var(--text-dim,#7d8aa0);font-size:14px;line-height:1.55}
    .cip-entrar .cip-logo{display:block;width:220px;margin:0 auto 32px;opacity:.95}
    .cip-entrar input{width:100%;box-sizing:border-box;margin-bottom:14px;padding:14px 16px;
      border:1px solid var(--line,#1c2536);border-radius:9px;background:var(--bg,#07090d);
      color:var(--text,#d8e3f3);font-size:15px;font-family:inherit}
    /* solo el botón de entrar crece; el .cip-btn de las tablas se queda igual */
    .cip-entrar .cip-btn.ancho{margin-top:8px;padding:14px;font-size:15px;border-radius:9px}
    .cip-entrar .cip-aviso{font-size:14px;padding:12px 14px}
    .cip-entrar input:focus{outline:0;border-color:var(--cyan-dim,#007a8a)}
    .cip-btn{border:1px solid var(--cyan-dim,#007a8a);border-radius:7px;padding:.5rem .9rem;
      font-weight:600;cursor:pointer;background:transparent;color:var(--cyan,#00e5ff);
      font-size:.82rem;font-family:inherit}
    .cip-btn:hover{background:rgba(0,229,255,.1)}
    .cip-btn.ancho{width:100%;padding:.6rem}
    .cip-btn.gris{border-color:var(--line,#1c2536);color:var(--text-dim,#7d8aa0)}
    .cip-btn.rojo{border-color:#7a2020;color:#ff7b7b}
    .cip-aviso{margin-top:12px;padding:.6rem .8rem;border-radius:8px;font-size:.82rem;
      background:rgba(255,80,80,.1);color:#ff9b9b;border:1px solid #5a2020}
    .cip-aviso.ok{background:rgba(0,255,149,.08);color:var(--green-soft,#5fffb8);
      border-color:var(--green-dim,#007a48)}
    .cip-proy-fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
    .cip-proy-fila input{padding:.55rem .7rem;border:1px solid var(--line,#1c2536);border-radius:7px;
      background:var(--bg,#07090d);color:var(--text,#d8e3f3);font-size:.85rem;
      font-family:inherit;min-width:260px}
    .cip-proy-fila input:focus{outline:0;border-color:var(--cyan-dim,#007a8a)}
    /* la tabla de cuentas se ve igual que la de proyectos */
    #tab-proyectos table,#tab-usuarios table{width:100%;border-collapse:collapse;font-size:.82rem}
    #tab-proyectos th,#tab-usuarios th{text-align:left;color:var(--cyan-dim,#007a8a);padding:.5rem .6rem;
      border-bottom:1px solid var(--line,#1c2536);text-transform:uppercase;font-size:.7rem;
      letter-spacing:.5px}
    #tab-proyectos td,#tab-usuarios td{padding:.55rem .6rem;border-bottom:1px solid var(--line,#1c2536)}
    #tab-proyectos tr:hover td,#tab-usuarios tr:hover td{background:rgba(0,229,255,.05)}
    /* en pantalla angosta la fila de botones se va de lado, no se corta */
    #u-lista{overflow-x:auto}
    #tab-proyectos .id{color:var(--text-mute,#4d5772);font-variant-numeric:tabular-nums}
    #tab-proyectos tr.abierto td{background:rgba(0,255,149,.06)}
  `

  function estilos() {
    if (document.getElementById('cip-nube-css')) return
    const s = document.createElement('style')
    s.id = 'cip-nube-css'
    s.textContent = css
    document.head.appendChild(s)
  }

  const el = (html) => {
    const d = document.createElement('div')
    d.innerHTML = html.trim()
    return d.firstElementChild
  }

  const limpio = (s) =>
    String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])

  // ───────────────────────────────────────────────── entrar

  function tapar() {
    if (document.querySelector('.cip-tapa')) return
    estilos()
    const tapa = el(`<div class="cip-tapa">
      <form class="cip-entrar">
        <img class="cip-logo" src="img/logo.png" alt="Grupo Modumex">
        <h2>Cálculo de Materiales</h2>
        <p>Entrá con tu cuenta de Modumex para usar la aplicación.</p>
        <input id="cip-email" type="email" placeholder="correo" autocomplete="username" required>
        <input id="cip-pass" type="password" placeholder="contraseña" autocomplete="current-password" required>
        <button class="cip-btn ancho" type="submit" id="cip-entrar">Entrar</button>
        <div id="cip-login-msg"></div>
      </form>
    </div>`)
    document.body.appendChild(tapa)
    const boton = tapa.querySelector('#cip-entrar')
    tapa.querySelector('.cip-entrar').addEventListener('submit', async (e) => {
      e.preventDefault()
      boton.disabled = true
      boton.textContent = 'Entrando…'
      const r = await entrar(
        tapa.querySelector('#cip-email').value.trim(),
        tapa.querySelector('#cip-pass').value,
      )
      boton.disabled = false
      boton.textContent = 'Entrar'
      if (r.ok) {
        await cargarmeYo()
        const no = porQueNoPuede()
        if (no) {
          guardarSesion(null)
          tapa.querySelector('#cip-login-msg').innerHTML = `<div class="cip-aviso">${no}</div>`
          return
        }
        tapa.remove()
        prepararPestana()
        ponerSalirArriba()
        vigilarInactividad()
        window.dispatchEvent(new CustomEvent('cip-entro'))
      } else {
        tapa.querySelector('#cip-login-msg').innerHTML = `<div class="cip-aviso">${r.mensaje}</div>`
      }
    })
    setTimeout(() => tapa.querySelector('#cip-email')?.focus(), 50)
  }

  /**
   * Volver a poner en los campos lo que dice STATE.
   *
   * Las ataduras del CIP van en UN SOLO sentido: el campo escribe en STATE,
   * pero nada escribe en el campo. Al arrancar no hace falta porque STATE está
   * vacío, pero al ABRIR un proyecto los datos volvían bien y la pantalla
   * seguía en blanco. `renderAll()` repinta las tablas y los totales, no los
   * formularios.
   *
   * Los selects se tocan con un `change` de verdad —no solo poniéndoles el
   * valor— porque de ellos cuelgan los modelos y los colores, que el CIP
   * rellena en respuesta a ese evento.
   */
  function volcarAPantalla() {
    const S = estado() || {}
    const texto = {
      'f-exp': S.exp, 'f-obra': S.obra, 'f-cliente': S.cliente, 'f-notas': S.notas,
      'f-oc-total': S.ocTotal, 'f-exp-padre': S.expPadre, 'f-afuera': S.puertasAfuera,
      'f-color': S.color,
    }
    for (const [id, valor] of Object.entries(texto)) {
      const c = document.getElementById(id)
      if (c) c.value = valor ?? ''
    }
    const selects = {
      'f-linea': S.linea, 'f-region': S.region, 'f-terminacion': S.sistema,
      'f-kap': S.kap, 'f-refuerzo': S.refuerzo, 'f-modelo': S.modeloCod,
      'f-oc-adicional': String(!!S.ocAdicional),
    }
    for (const [id, valor] of Object.entries(selects)) {
      const c = document.getElementById(id)
      if (!c || valor === undefined || valor === null) continue
      c.value = valor
      c.dispatchEvent(new Event('change', { bubbles: true }))
    }
    // el modelo depende de la línea: se vuelve a poner después de que el
    // cambio de línea repobló su lista
    const m = document.getElementById('f-modelo')
    if (m && S.modeloCod) m.value = S.modeloCod
    const col = document.getElementById('f-color')
    if (col && S.color) col.value = S.color
  }

  // ───────────────────────────────────────────────── salir

  /**
   * Salir tiene que estar SIEMPRE a la vista. Estaba solo adentro de la
   * pestaña 04 y desde las otras tres no había forma de cerrar la sesión.
   */
  function ponerSalirArriba() {
    if (document.getElementById('cip-salir-top')) return
    const acciones = document.querySelector('.topbar-actions')
    if (!acciones) return
    const caja = el(
      '<span id="cip-salir-top" style="display:flex;gap:8px;align-items:center">' +
        '<span id="cip-quien-top" style="color:var(--text-dim,#7d8aa0);font-size:.72rem"></span>' +
        '<button class="cip-btn gris" id="cip-salir-btn" title="Cerrar sesión">Salir</button>' +
      '</span>',
    )
    acciones.appendChild(caja)
    caja.querySelector('#cip-quien-top').textContent = sesion?.email || ''
    caja.querySelector('#cip-salir-btn').onclick = salir
  }

  /**
   * Cerrar sesión deja la pantalla como recién abierta: se van la barra de
   * arriba y la pestaña de proyectos con todo lo que tenían dentro. Si no,
   * el que entra después se encuentra el correo, la lista y el nombre del
   * proyecto del anterior, que en planta es exactamente lo que no se quiere.
   */
  function salir() {
    guardarSesion(null)
    abiertoId = null
    yo = null
    document.getElementById('cip-salir-top')?.remove()
    document.querySelector('[data-tab="proyectos"]')?.remove()
    document.getElementById('tab-proyectos')?.remove()
    window.dispatchEvent(new CustomEvent('cip-sali'))
    if (!document.querySelector('.tab.active')) document.querySelector('.tab')?.click()
    tapar()
  }

  /** se cierra sola si nadie toca nada; cualquier clic o tecla reinicia el reloj */
  let reloj = null
  function vigilarInactividad() {
    const reiniciar = () => {
      clearTimeout(reloj)
      if (!sesion) return
      reloj = setTimeout(() => {
        if (!sesion) return
        salir()
        const m = document.querySelector('.cip-entrar #cip-login-msg')
        if (m) m.innerHTML = '<div class="cip-aviso">La sesión se cerró sola por inactividad.</div>'
      }, MINUTOS_INACTIVO * 60 * 1000)
    }
    for (const ev of ['click', 'keydown', 'pointerdown', 'wheel']) {
      document.addEventListener(ev, reiniciar, { passive: true })
    }
    reiniciar()
  }

  // ───────────────────────────────────────────────── pestaña 04

  let abiertoId = null

  /**
   * El CIP engancha el clic de sus pestañas una sola vez, al cargar, así que
   * esta se tiene que enganchar sola: la suya no la conoce.
   */
  function prepararPestana() {
    if (document.querySelector('[data-tab="proyectos"]')) return
    estilos()
    const barra = document.querySelector('.tabs')
    const main = document.querySelector('main.main')
    if (!barra || !main) return

    const boton = el('<button class="tab" data-tab="proyectos"><span class="tab-num">04</span>Proyectos</button>')
    barra.appendChild(boton)

    const panel = el(`<div class="tab-content" id="tab-proyectos">
      <div class="cip-proy-fila">
        <input id="cip-nombre" placeholder="Nombre del proyecto" maxlength="120">
        <button class="cip-btn" id="cip-guardar">Guardar</button>
        <button class="cip-btn gris" id="cip-guardar-nuevo">Guardar como nuevo</button>
        <span style="flex:1"></span>
        <span id="cip-quien" style="color:var(--text-dim,#7d8aa0);font-size:.78rem"></span>
      </div>
      <div id="cip-lista">Consultando…</div>
      <div id="cip-msg"></div>
    </div>`)
    main.appendChild(panel)

    boton.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach((x) => x.classList.remove('active'))
      boton.classList.add('active')
      panel.classList.add('active')
      pintar()
    })
    // al irse a otra pestaña, esta se apaga sola
    document.querySelectorAll('.tab:not([data-tab="proyectos"])').forEach((t) => {
      t.addEventListener('click', () => {
        boton.classList.remove('active')
        panel.classList.remove('active')
      })
    })

    panel.querySelector('#cip-quien').textContent = sesion?.email || ''
    panel.querySelector('#cip-guardar').onclick = () => void guardarDesdePantalla(abiertoId)
    panel.querySelector('#cip-guardar-nuevo').onclick = () => void guardarDesdePantalla(null)
  }

  const msg = (t, ok) => {
    const c = document.getElementById('cip-msg')
    if (c) c.innerHTML = `<div class="cip-aviso ${ok ? 'ok' : ''}">${t}</div>`
  }

  async function guardarDesdePantalla(id) {
    const campo = document.getElementById('cip-nombre')
    const S = estado() || {}
    // sin nombre escrito se usa el expediente, que es como lo llaman en planta
    const nombre = (campo?.value || '').trim() || String(S.exp || '').trim()
    if (!nombre) return msg('Ponele un nombre al proyecto, o llená el expediente.')
    try {
      abiertoId = await guardar(nombre, id)
      if (campo) campo.value = nombre
      msg(`Guardado como <b>${limpio(nombre)}</b> · ID ${abiertoId}.`, true)
      pintar()
    } catch (e) {
      msg('No se pudo guardar: ' + limpio(e.message))
    }
  }

  const fecha = (iso) => {
    const d = new Date(iso)
    return isNaN(d)
      ? ''
      : d.toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  /** id de usuario → nombre, para firmar los proyectos */
  async function nombresDeUsuarios() {
    try {
      const r = await pedir('usuario?select=id,nombre')
      return new Map((r || []).map((u) => [u.id, u.nombre]))
    } catch {
      return new Map()
    }
  }

  async function pintar() {
    const caja = document.getElementById('cip-lista')
    if (!caja) return
    try {
      const [filas, quienes] = await Promise.all([listar(), nombresDeUsuarios()])
      if (!filas.length) {
        caja.innerHTML =
          '<p style="color:var(--text-dim,#7d8aa0);font-size:.85rem">Todavía no hay proyectos guardados.</p>'
        return
      }
      caja.innerHTML =
        '<table><thead><tr><th>ID</th><th>Nombre</th><th>Expediente</th><th>Obra</th>' +
        '<th>Línea</th><th>Piezas</th><th>Guardado por</th><th>Actualizado</th><th></th></tr></thead><tbody>' +
        filas
          .map(
            (f) => `<tr class="${f.proyecto_id === abiertoId ? 'abierto' : ''}">
              <td class="id">${f.proyecto_id}</td>
              <td><b>${limpio(f.nombre) || '—'}</b></td>
              <td>${limpio(f.exp)}</td>
              <td>${limpio(f.obra)}</td>
              <td>${limpio(f.linea)} ${limpio(f.modelo)}</td>
              <td>${f.piezas ?? ''}</td>
              <td>${limpio(quienes.get(f.guardado_por) || '')}</td>
              <td>${fecha(f.actualizado_el)}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="cip-btn" data-abrir="${f.proyecto_id}" data-nombre="${limpio(f.nombre)}">Abrir</button>
                <button class="cip-btn rojo" data-borrar="${f.proyecto_id}">Borrar</button>
              </td></tr>`,
          )
          .join('') +
        '</tbody></table>'

      caja.querySelectorAll('[data-abrir]').forEach((b) => {
        b.onclick = async () => {
          try {
            const r = await leer(b.dataset.abrir)
            const json = r?.[0]?.app_json
            if (!json) return msg('Ese proyecto no tiene datos guardados.')
            // se vacía y se rellena el MISMO objeto: el resto del CIP tiene la
            // referencia capturada y reasignarlo no la cambiaría
            const S = estado()
            Object.keys(S).forEach((k) => delete S[k])
            Object.assign(S, json)
            abiertoId = Number(b.dataset.abrir)
            const campo = document.getElementById('cip-nombre')
            if (campo) campo.value = b.dataset.nombre || ''
            volcarAPantalla()
            if (typeof window.renderAll === 'function') window.renderAll()
            document.querySelector('.tab[data-tab="capturar"]')?.click()
          } catch (e) {
            msg('No se pudo abrir: ' + limpio(e.message))
          }
        }
      })
      caja.querySelectorAll('[data-borrar]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('¿Borrar ese proyecto? No se puede deshacer.')) return
          try {
            await borrar(b.dataset.borrar)
            if (abiertoId === Number(b.dataset.borrar)) abiertoId = null
            pintar()
          } catch (e) {
            msg('No se pudo borrar: ' + limpio(e.message))
          }
        }
      })
    } catch (e) {
      caja.innerHTML = ''
      msg('No se pudo consultar: ' + limpio(e.message))
    }
  }

  // ───────────────────────────────────────────────── arranque

  function arrancar() {
    estilos()
    if (sesion) {
      prepararPestana()
      ponerSalirArriba()
      vigilarInactividad()
      // la portada se queda hasta saber el rol: si la cuenta está
      // desactivada, que no alcance a verse la aplicación por detrás
      void cargarmeYo().then(() => {
        const no = porQueNoPuede()
        if (no) {
          salir()
          const m = document.getElementById('cip-login-msg')
          if (m) m.innerHTML = `<div class="cip-aviso">${no}</div>`
          destapar()
          return
        }
        destapar()
        window.dispatchEvent(new CustomEvent('cip-entro'))
      })
    } else {
      tapar()
      destapar()
    }
  }

  /**
   * Lo mínimo que la pantalla de Usuarios necesita de este módulo: quién soy,
   * cómo llamar a la función de Supabase y los ayudantes de dibujo. Se publica
   * así para no repetir la sesión ni los estilos en dos archivos.
   */
  window.CIP_NUBE = {
    yo: () => yo,
    el,
    limpio,
    estilos,
    fecha,
    async llamarFuncion(cuerpo) {
      const r = await fetch(CFG.URL + '/functions/v1/usuarios', {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify(cuerpo),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 404) {
          return { ok: false, mensaje: 'Falta desplegar la Edge Function "usuarios" en Supabase.' }
        }
        return { ok: false, mensaje: d.error || 'Supabase respondió ' + r.status }
      }
      return { ok: true, ...d }
    },
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar)
  else arrancar()
})()
