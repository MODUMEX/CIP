/**
 * Lector de la Orden de Compra en PDF.
 *
 * La OC es un PDF de texto y trae todo lo que hay que transcribir a mano:
 * cabecera, medidas y cantidades. Lo que NO trae es el tipo de cada pieza
 * —PTADER o PTAIZQ, PLCEN o PLLATMUR— porque eso vive en el plano. Así que
 * este lector llena lo que sabe y deja lo demás en una lista "por asignar"
 * para que la persona lo resuelva mirando el plano, que es lo que hace hoy.
 *
 * Nunca adivina un tipo. Un checklist que se ve terminado pero tiene una
 * puerta del lado equivocado es peor que uno a medio llenar.
 *
 * Dos formatos:
 *   SAP (México)  "ORDEN DE FABRICACIÓN", renglones  cant  PT-90X150
 *   Odoo (LATAM)  "Número de orden",      renglones  [PI30A] PILASTRA 0.30 X 2.145 … 1.00 PIEZA
 *
 * Se lee con pdf.js tomando las COORDENADAS de cada texto, no el texto plano.
 * Importa: en la OC de SAP las etiquetas y sus valores están en columnas
 * distintas, y al aplanar quedan corridos un renglón — así aparece el disparate
 * de "BISAGRA: ZOCLO" cuando en realidad es BISAGRA LEEDER y SOPORTE ZOCLO.
 * Con las coordenadas cada etiqueta se empareja con el valor que tiene al lado.
 */
;(function () {
  const FAMILIAS = { PT: 'PUERTAS', PN: 'PANELES', PL: 'PILASTRAS', MG: 'MINGITORIOS' }

  // ───────────────────────────────── leer el PDF

  /**
   * Devuelve { renglones, items }: los textos agrupados por altura (para leer
   * los renglones de la tabla) y la lista plana con sus coordenadas (para
   * emparejar cada etiqueta con su valor).
   */
  async function renglonesDelPdf(archivo) {
    if (!window.pdfjsLib) throw new Error('pdf.js no cargó; revisá la conexión.')
    const datos = new Uint8Array(await archivo.arrayBuffer())
    const pdf = await pdfjsLib.getDocument({ data: datos }).promise
    const todos = []
    const planos = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const pagina = await pdf.getPage(p)
      const contenido = await pagina.getTextContent()
      const porY = new Map()
      for (const it of contenido.items) {
        const s = (it.str || '').trim()
        if (!s) continue
        const x = it.transform[4]
        const y = Math.round(it.transform[5] / 2) * 2 // tolerancia de 2pt
        const t = { x, y, s, pagina: p }
        planos.push(t)
        if (!porY.has(y)) porY.set(y, [])
        porY.get(y).push(t)
      }
      const ren = [...porY.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([y, items]) => ({ y, pagina: p, items: items.sort((a, b) => a.x - b.x) }))
      todos.push(...ren)
    }
    return { renglones: todos, items: planos }
  }

  const textoDe = (r) => r.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()

  /**
   * Valor de una etiqueta: lo que está a su derecha, a la misma altura.
   *
   * "A la misma altura" con holgura: en la OC de SAP la etiqueta y su valor
   * no caen exactamente en la misma coordenada —"OBRA:" está a 706 y "PLANET
   * FITNESS" a 702— así que buscar renglón exacto no sirve. Se buscan los
   * textos dentro de ±6pt que estén a la derecha, y se corta al llegar a la
   * siguiente etiqueta, que es donde empieza otra columna.
   */
  function valorDe(items, etiqueta, cual) {
    const et = etiqueta.toUpperCase()
    const marcas = items.filter((it) => it.s.toUpperCase().replace(/\s+/g, ' ').startsWith(et))
    const marca = marcas[(cual || 1) - 1]
    if (!marca) return ''
    const propio = marca.s.slice(etiqueta.length).replace(/^[:\s]+/, '').trim()
    if (propio) return propio
    const cerca = items
      .filter((it) => it !== marca && it.pagina === marca.pagina &&
                      Math.abs(it.y - marca.y) <= 6 && it.x > marca.x)
      .sort((a, b) => a.x - b.x)
    const hasta = cerca.findIndex((it) => /:$/.test(it.s))
    const trozo = (hasta >= 0 ? cerca.slice(0, hasta) : cerca).map((it) => it.s).join(' ').trim()
    return trozo.replace(/^[:\s]+/, '')
  }

  // ───────────────────────────────── los dos formatos

  const RE_SAP = /^(PT|PL|PN|PM|MG|AN)-(?:[A-Z0-9]+-)?(\d+)\s*[Xx]\s*(\d+)$/

  function leerSap(renglones, items) {
    const piezas = []
    for (const r of renglones) {
      const t = textoDe(r)
      // el renglón de la obra ("1.00 EXP 9880-M …") no es una pieza
      if (/\bEXP\s+\d+/.test(t)) continue
      const m = t.match(/^(\d+(?:\.\d+)?)\s+((?:PT|PL|PN|PM|MG|AN)-[A-Z0-9-]*\s*\d+\s*[Xx]\s*\d+)/)
      if (!m) continue
      const cod = m[2].replace(/\s+/g, ' ').trim()
      const d = cod.match(RE_SAP)
      if (!d) continue
      const fam = d[1] === 'PM' ? 'MG' : d[1]
      if (!FAMILIAS[fam]) continue
      piezas.push({ familia: fam, ancho: +d[2], alto: +d[3], cant: Math.round(+m[1]) })
    }
    const crudoTotal = valorDe(items, 'TOTAL DE PIEZAS')
    const total = /\d/.test(crudoTotal) ? parseInt(crudoTotal.replace(/[^\d]/g, '')) : null
    let exp = ''
    for (const r of renglones.slice(0, 12)) {
      const t = textoDe(r)
      if (/^\d{5}$/.test(t)) { exp = t; break }
    }
    return {
      formato: 'SAP',
      cabecera: {
        exp,
        obra: valorDe(items, 'OBRA:'),
        cliente: valorDe(items, 'DISTRIBUIDOR:'),
        color: valorDe(items, 'COLOR:'),
        linea: valorDe(items, 'LINEA:'),
        acabado: valorDe(items, 'ACABADO:'),
        soporte: valorDe(items, 'SOPORTE:'),
        modelo: valorDe(items, 'MODELO:'),
      },
      piezas,
      total,
    }
  }

  function leerOdoo(renglones, items) {
    const piezas = []
    const redondeadas = new Set()
    for (const r of renglones) {
      const t = textoDe(r)
      if (!/\bPIEZA\b/i.test(t)) continue
      const cant = t.match(/(\d+(?:[.,]\d+)?)\s*PIEZA/i)
      const med = t.match(/(\d+(?:[.,]\d+)?)\s*[Xx]\s*(\d+(?:[.,]\d+)?)/)
      if (!cant || !med) continue
      const num = (v) => parseFloat(String(v).replace(',', '.'))
      // Odoo escribe en metros. Se redondea al centímetro porque el checklist
      // trabaja con enteros; si venía con milímetros se avisa, porque 2.145
      // pasa a 215 y esos 5 mm son material.
      const aCm = (v) => {
        const cm = num(v) * 100
        if (Math.abs(cm - Math.round(cm)) > 0.01) redondeadas.add(num(v) + ' m')
        return Math.round(cm)
      }
      const desc = t.toUpperCase()
      let fam = null
      if (/MINGITORIO|URINAL/.test(desc)) fam = 'MG'
      else if (/PILASTRA/.test(desc)) fam = 'PL'
      else if (/PANEL/.test(desc)) fam = 'PN'
      else if (/PUERTA/.test(desc)) fam = 'PT'
      if (!fam) continue
      piezas.push({ familia: fam, ancho: aCm(med[1]), alto: aCm(med[2]), cant: Math.round(num(cant[1])) })
    }
    const crudoTotal = valorDe(items, 'Total de')
    const total = /\d/.test(crudoTotal) ? parseInt(crudoTotal.replace(/[^\d]/g, '')) : null
    return {
      formato: 'Odoo',
      cabecera: {
        exp: (valorDe(items, 'Número de orden') || '').trim(),
        // en Odoo hay dos "Nombre:": el primero es el distribuidor, el segundo la obra
        obra: valorDe(items, 'Nombre:', 2) || valorDe(items, 'Nombre:'),
        cliente: valorDe(items, 'Nombre:'),
        color: valorDe(items, 'Color:'),
        linea: '',
        acabado: '',
        soporte: valorDe(items, 'Remate'),
        modelo: valorDe(items, 'Modelo:'),
      },
      piezas,
      total,
      redondeadas: [...redondeadas],
    }
  }

  function leer({ renglones, items }) {
    const todo = renglones.map(textoDe).join('\n')
    const esSap = /ORDEN DE FABRICACI|C.digo de articulos|TOTAL DE PIEZAS/i.test(todo)
    return esSap ? leerSap(renglones, items) : leerOdoo(renglones, items)
  }

  // ───────────────────────────────── aplicar lo leído

  /** el mingitorio sí se resuelve solo: lo define el alto */
  const codigoMingitorio = (alto) => (alto >= 140 ? 'MG150' : 'MG120')

  function aplicar(res) {
    const c = res.cabecera
    const poner = (id, v) => {
      const e = document.getElementById(id)
      if (e && v) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })) }
    }
    if (c.exp) poner('f-exp', c.exp)
    if (c.obra) poner('f-obra', c.obra)
    if (c.cliente) poner('f-cliente', c.cliente)
    if (c.color) poner('f-color', c.color)

    // la terminación inferior viene como texto libre ("Zoclo", "Pata de acero…")
    const sop = (c.soporte || '').toUpperCase()
    const sel = document.getElementById('f-terminacion')
    if (sel && /ZOCLO/.test(sop)) { sel.value = 'ZOCLO'; sel.dispatchEvent(new Event('change', { bubbles: true })) }
    else if (sel && /PATA/.test(sop)) { sel.value = 'PATAS'; sel.dispatchEvent(new Event('change', { bubbles: true })) }

    const lin = (c.linea || '').toUpperCase()
    const selL = document.getElementById('f-linea')
    if (selL && /LEEDER/.test(lin)) { selL.value = 'LEEDER'; selL.dispatchEvent(new Event('change', { bubbles: true })) }

    if (res.total) poner('f-oc-total', String(res.total))

    // los mingitorios entran como piezas; el resto queda por asignar
    const area = STATE.areaActual || 'Área 1'
    const pendientes = []
    for (const p of res.piezas) {
      if (p.familia === 'MG') {
        const codigo = codigoMingitorio(p.alto)
        const igual = STATE.pieces.find(
          (q) => (q.codigo || '').toUpperCase() === codigo && int(q.ancho) === p.ancho &&
                 int(q.alto) === p.alto && (q.area || 'Área 1') === area,
        )
        if (igual) igual.cant = int(igual.cant) + p.cant
        else STATE.pieces.push({
          id: uid(), tipo: 'MG', codigo, ancho: p.ancho, alto: p.alto,
          cant: p.cant, area, detalle: 'OC', flag: false,
        })
      } else {
        pendientes.push({ ...p })
      }
    }
    STATE.ocPendientes = pendientes
    STATE.ocLeida = { formato: res.formato, total: res.total, cabecera: c }
    renderAll()
    pintarPendientes()
  }

  // ───────────────────────────────── la lista por asignar

  /** cuántas de esa medida ya tienen tipo puesto, en cualquier área */
  function yaAsignadas(p) {
    return STATE.pieces
      .filter((q) => {
        const cod = (q.codigo || '').toUpperCase()
        return cod.startsWith(p.familia) && int(q.ancho) === p.ancho && int(q.alto) === p.alto
      })
      .reduce((s, q) => s + int(q.cant), 0)
  }

  function asignar(indice, codigo, cuantas) {
    const p = (STATE.ocPendientes || [])[indice]
    if (!p || !codigo || cuantas < 1) return
    const area = STATE.areaActual || 'Área 1'
    const igual = STATE.pieces.find(
      (q) => (q.codigo || '').toUpperCase() === codigo && int(q.ancho) === p.ancho &&
             int(q.alto) === p.alto && (q.area || 'Área 1') === area,
    )
    if (igual) igual.cant = int(igual.cant) + cuantas
    else STATE.pieces.push({
      id: uid(), tipo: TIPO_BY_CODE[codigo], codigo, ancho: p.ancho, alto: p.alto,
      cant: cuantas, area, detalle: 'OC', flag: false,
    })
    renderAll()
    pintarPendientes()
  }

  function pintarPendientes() {
    const caja = document.getElementById('oc-pendientes')
    if (!caja) return
    const lista = STATE.ocPendientes || []
    if (!lista.length) { caja.innerHTML = ''; return }

    const filas = lista.map((p, i) => {
      const ya = yaAsignadas(p)
      const faltan = p.cant - ya
      const codigos = (CODES[FAMILIAS[p.familia]] || []).map((c) => c.code)
      const listo = faltan <= 0
      return `
        <tr class="${listo ? 'oc-listo' : ''}">
          <td><b>${p.familia}</b> ${p.ancho}×${p.alto}</td>
          <td>${p.cant}</td>
          <td>${ya}</td>
          <td class="${listo ? 'oc-ok' : 'oc-falta'}">${listo ? (faltan < 0 ? 'sobran ' + -faltan : '✓') : faltan}</td>
          <td>
            <select data-cod="${i}" ${listo && faltan === 0 ? 'disabled' : ''}>
              ${codigos.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <input type="number" min="1" data-cant="${i}" value="${Math.max(faltan, 1)}" ${listo && faltan === 0 ? 'disabled' : ''}>
            <button class="cip-btn" data-asignar="${i}" ${listo && faltan === 0 ? 'disabled' : ''}>Asignar</button>
          </td>
        </tr>`
    })

    const totalOC = lista.reduce((s, p) => s + p.cant, 0)
    const totalYa = lista.reduce((s, p) => s + Math.min(yaAsignadas(p), p.cant), 0)
    const faltan = totalOC - totalYa

    caja.innerHTML = `
      <div class="oc-cab">
        Piezas de la OC que necesitan tipo: <b>${totalOC}</b> ·
        con tipo puesto: <b>${totalYa}</b> ·
        <span class="${faltan ? 'oc-falta' : 'oc-ok'}">por asignar: <b>${faltan}</b></span>
      </div>
      <table class="oc-tabla">
        <thead><tr><th>Pieza</th><th>En la OC</th><th>Ya puestas</th><th>Faltan</th><th>Asignar tipo</th></tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table>`

    caja.querySelectorAll('[data-asignar]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.asignar
        const cod = caja.querySelector(`[data-cod="${i}"]`).value
        const cant = parseInt(caja.querySelector(`[data-cant="${i}"]`).value) || 0
        asignar(i, cod, cant)
      }
    })
  }

  // ───────────────────────────────── pantalla

  function estilos() {
    if (document.getElementById('oc-css')) return
    const s = document.createElement('style')
    s.id = 'oc-css'
    s.textContent = [
      '#oc-pendientes{margin-top:14px}',
      '.oc-cab{font-size:12.5px;margin-bottom:8px;color:var(--text-soft,#9aa4b2)}',
      '.oc-tabla{width:100%;border-collapse:collapse;font-size:12.5px}',
      '.oc-tabla th{text-align:left;padding:.45rem .6rem;color:var(--cyan-dim,#007a8a);',
      '  text-transform:uppercase;font-size:10.5px;letter-spacing:.5px;',
      '  border-bottom:1px solid var(--line,#1c2536)}',
      '.oc-tabla td{padding:.45rem .6rem;border-bottom:1px solid var(--line,#1c2536)}',
      '.oc-tabla tr.oc-listo td{opacity:.55}',
      '.oc-ok{color:var(--green,#00ff95)}',
      '.oc-falta{color:#ffb86b;font-weight:700}',
      '.oc-tabla select,.oc-tabla input{padding:5px 7px;border:1px solid #3a4252;border-radius:6px;',
      '  background:var(--bg,#07090d);color:var(--text,#d8e3f3);font-size:12px;font-family:inherit}',
      '.oc-tabla input{width:62px}',
      '.oc-aviso{margin-top:10px;font-size:12px}',
      '.oc-aviso.mal{color:#ff9b9b}',
      '.oc-aviso.ok{color:var(--green-soft,#5fffb8)}',
    ].join('\n')
    document.head.appendChild(s)
  }

  function avisar(texto, clase) {
    const e = document.getElementById('oc-pdf-aviso')
    if (e) { e.textContent = texto; e.className = 'oc-aviso ' + (clase || '') }
  }

  async function recibir(archivo) {
    if (!archivo) return
    avisar('Leyendo ' + archivo.name + '…')
    try {
      const renglones = await renglonesDelPdf(archivo)
      const res = leer(renglones)
      if (!res.piezas.length) {
        avisar('No encontré renglones de piezas en ese PDF. ¿Es la OC o es el plano?', 'mal')
        return
      }
      // Importar dos veces sumaba las piezas en silencio. Si ya hay una OC
      // cargada se pregunta, y lo que vino de ella se quita antes de empezar;
      // lo que la persona cargó a mano no se toca.
      const previas = STATE.pieces.filter((p) => p.detalle === 'OC')
      if (previas.length || (STATE.ocPendientes || []).length) {
        const ok = confirm(
          'Este proyecto ya tiene una OC importada.\n\n' +
          '¿La reemplazo por esta? Se quitan las piezas que vinieron de la OC anterior; ' +
          'las que cargaste a mano se quedan.',
        )
        if (!ok) { avisar('No se importó nada.'); return }
        STATE.pieces = STATE.pieces.filter((p) => p.detalle !== 'OC')
        STATE.ocPendientes = []
      }
      aplicar(res)
      const suma = res.piezas.reduce((s, p) => s + p.cant, 0)
      if (res.total != null && suma !== res.total) {
        avisar(
          `Ojo: leí ${suma} piezas pero la OC declara ${res.total}. Revisá el PDF antes de seguir.`,
          'mal',
        )
      } else {
        const redondeo = (res.redondeadas || []).length
          ? ' Ojo: ' + res.redondeadas.join(', ') + ' venía en milímetros y se redondeó al centímetro.'
          : ''
        avisar(
          `OC ${res.formato} leída: ${suma} piezas` +
          (res.total != null ? ' (cuadra con el total declarado)' : '') + '.' + redondeo,
          redondeo ? '' : 'ok',
        )
      }
    } catch (e) {
      avisar('No pude leer el PDF: ' + (e && e.message ? e.message : e), 'mal')
    }
  }

  function armar() {
    const refer = document.getElementById('drop-oc-csv')
    if (!refer || document.getElementById('oc-pdf-panel')) return
    estilos()
    const panelCsv = refer.closest('.panel')
    if (!panelCsv) return

    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.id = 'oc-pdf-panel'
    panel.innerHTML = [
      '<div class="panel-title cyan"><span class="ico">📄</span>Importar OC (PDF)</div>',
      '<div class="banner info" style="margin-top:8px;font-size:12px;">',
      '  Para los proyectos que <b>no</b> pasaron por el Constructor. Lee la OC en PDF',
      '  (SAP de México u Odoo de LATAM) y llena cabecera, medidas y cantidades.',
      '  <b>El tipo de cada puerta, panel y pilastra no viene en la OC</b> —eso está en el',
      '  plano—, así que queda abajo en una lista para que lo asignes vos.',
      '  Los mingitorios sí se resuelven solos: los define el alto.',
      '</div>',
      '<div class="grid grid-2" style="margin-top:12px;">',
      '  <label class="drop empty" id="drop-oc-pdf" style="cursor:pointer;">',
      '    <input type="file" id="file-oc-pdf" accept="application/pdf,.pdf" style="display:none;">',
      '    <div class="drop-ico">📄</div>',
      '    <div class="drop-title">Orden de Compra (PDF)</div>',
      '    <div class="drop-status" style="font-size:12px;color:var(--cyan);">Arrastrá o hacé clic para subir la OC</div>',
      '  </label>',
      '  <div style="display:flex;flex-direction:column;gap:8px;justify-content:center;">',
      '    <button class="btn btn-sm" id="btn-oc-pdf-clear">✕ Quitar la lista por asignar</button>',
      '    <div id="oc-pdf-aviso" class="oc-aviso">Esperando archivo…</div>',
      '  </div>',
      '</div>',
      '<div id="oc-pendientes"></div>',
    ].join('')
    panelCsv.parentNode.insertBefore(panel, panelCsv.nextSibling)

    const entrada = panel.querySelector('#file-oc-pdf')
    const zona = panel.querySelector('#drop-oc-pdf')
    zona.addEventListener('click', () => entrada.click())
    entrada.addEventListener('change', (e) => recibir(e.target.files[0]))
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('over') })
    zona.addEventListener('dragleave', () => zona.classList.remove('over'))
    zona.addEventListener('drop', (e) => {
      e.preventDefault()
      zona.classList.remove('over')
      recibir(e.dataTransfer.files[0])
    })
    panel.querySelector('#btn-oc-pdf-clear').onclick = () => {
      STATE.ocPendientes = []
      pintarPendientes()
      avisar('Lista quitada. Las piezas que ya asignaste se quedan.')
    }

    pintarPendientes()
  }

  // la lista se repinta sola cuando la app redibuja (por ejemplo al abrir un proyecto)
  const original = window.renderAll
  if (typeof original === 'function') {
    window.renderAll = function () {
      const r = original.apply(this, arguments)
      try { pintarPendientes() } catch (e) {}
      return r
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armar)
  else armar()
})()
