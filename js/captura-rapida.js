/**
 * Captura rápida de piezas.
 *
 * El checklist de Excel se llena más rápido que la app, y la razón es simple:
 * allá una pieza es UNA LÍNEA que se escribe de corrido —ancho, tabulador,
 * alto, tabulador, tipo, tabulador, cantidad, enter— sin soltar el teclado.
 * Acá había que buscar la fila del código entre varias docenas, hacer clic en
 * dos casillas y picar el "+" una vez por pieza.
 *
 * Esta barra reproduce esa línea: se escribe seguido y se agrega con Enter,
 * las medidas se quedan puestas para la siguiente y el tipo se escribe corto
 * (ADER) igual que en la columna "Tipo" de la hoja. La familia hace de bloque
 * de columnas: en el Excel PUERTAS, PILASTRA, PANEL y MINGITORIOS son cuatro
 * bloques distintos, y por eso allá "CEN" no se confunde entre panel y
 * pilastra.
 *
 * No toca nada de app.js: arma las piezas con la misma forma que el resto y
 * llama a renderAll().
 */
;(function () {
  const PREFIJO = { PT: 'PUERTAS', PN: 'PANELES', MG: 'MINGITORIOS', PL: 'PILASTRAS' }
  const FAMILIAS = [
    { id: 'PT', rotulo: 'Puertas' },
    { id: 'PN', rotulo: 'Paneles' },
    { id: 'MG', rotulo: 'Mingitorios' },
    { id: 'PL', rotulo: 'Pilastras' },
  ]

  let familia = 'PT'
  const hechas = []

  const codigosDe = (fam) => (CODES[PREFIJO[fam]] || []).map((c) => c.code)
  const todosLosCodigos = () => FAMILIAS.flatMap((f) => codigosDe(f.id))
  const el = (id) => document.getElementById(id)
  const valor = (id) => (el(id) ? el(id).value.trim() : '')

  /** el alto que trae puesto cada familia, el mismo de la hoja de verificación */
  function altoPorFamilia(fam) {
    if (fam === 'MG') return 120
    if (fam === 'PL') {
      if (STATE.modelo === 'REFORZADO' && STATE.sistema === 'ZOCLO') return 210
      if (STATE.modelo === 'REFORZADO' && STATE.sistema === 'PATAS') return 200
      if (STATE.sistema === 'ZOCLO') return 180
      return 170
    }
    return 150
  }

  /**
   * De lo que se escribió al código real. Acepta el código completo (PTADER),
   * el tipo corto de la hoja (ADER), sin guión (PTADERAM) y en minúsculas.
   * El corto se busca primero dentro de la familia elegida, que es lo que
   * evita que "CEN" quede entre PLCEN y PNCEN.
   */
  function resolverCodigo(texto, fam) {
    const t = String(texto || '').toUpperCase().replace(/\s+/g, '')
    if (!t) return null
    const sinGuion = (c) => c.replace(/-/g, '')
    const busca = (lista) =>
      lista.find((c) => c === t) ||
      lista.find((c) => sinGuion(c) === t) ||
      lista.find((c) => c === fam + t) ||
      lista.find((c) => sinGuion(c) === fam + t)
    return busca(codigosDe(fam)) || busca(todosLosCodigos()) || null
  }

  /** lo que se agregaría con lo que hay escrito en este momento */
  function loQueHay() {
    return {
      codigo: resolverCodigo(valor('cr-codigo'), familia),
      ancho: parseInt(valor('cr-ancho')) || 0,
      alto: parseInt(valor('cr-alto')) || 0,
      cant: parseInt(valor('cr-cant')) || 0,
    }
  }

  function previsualizar() {
    const caja = el('cr-vista')
    if (!caja) return
    const d = loQueHay()
    // si se escribió el código completo de otra familia, se mueve el botón
    // marcado: lo resaltado tiene que ser siempre lo que se va a agregar
    if (d.codigo && TIPO_BY_CODE[d.codigo] !== familia) {
      familia = TIPO_BY_CODE[d.codigo]
      pintarFamilias()
    }
    if (!d.codigo) {
      caja.className = 'cr-vista floja'
      caja.textContent = valor('cr-codigo') ? 'Ese tipo no existe' : 'Escribí el tipo y dale Enter'
      return
    }
    caja.className = 'cr-vista'
    caja.textContent =
      (d.cant || 1) + ' × ' + d.codigo + ' · ' +
      (d.ancho || '—') + '×' + (d.alto || '—') + ' · ' +
      (STATE.areaActual || 'Área 1')
  }

  /**
   * Atajo: todo junto en la casilla del ancho, separado por espacios o por la
   * equis. "70 150 ader 10" o "70x150 ader 10". Se reparte en las demás
   * casillas y se ve en la vista previa antes de agregar, así que no hay
   * sorpresas.
   */
  function repartirSiVieneTodoJunto() {
    const crudo = valor('cr-ancho')
    if (!/[\s,x×]/i.test(crudo)) return
    const partes = crudo.split(/[\s,]+|[x×]/i).filter(Boolean)
    const numeros = partes.filter((p) => /^\d+$/.test(p))
    const palabras = partes.filter((p) => !/^\d+$/.test(p))
    if (numeros.length < 2) return
    const poner = (id, v) => { if (el(id)) el(id).value = v }
    poner('cr-ancho', numeros[0])
    poner('cr-alto', numeros[1])
    if (numeros[2]) poner('cr-cant', numeros[2])
    if (palabras[0]) poner('cr-codigo', palabras[0])
  }

  function avisar(texto, mal) {
    const caja = el('cr-aviso')
    if (!caja) return
    caja.textContent = texto || ''
    caja.className = 'cr-aviso' + (mal ? ' mal' : '')
  }

  function agregar() {
    repartirSiVieneTodoJunto()
    const d = loQueHay()
    if (!d.codigo) return avisar('No reconozco ese tipo de pieza.', true)
    if (!d.alto) return avisar('Falta el alto.', true)
    const cantidad = d.cant || 1
    const area = STATE.areaActual || 'Área 1'

    // Si esa misma pieza con esa misma medida ya está en el área, se suma: en
    // el checklist una medida es una sola línea con su cantidad al lado.
    const igual = STATE.pieces.find(
      (p) =>
        (p.codigo || '').toUpperCase() === d.codigo &&
        int(p.ancho) === d.ancho &&
        int(p.alto) === d.alto &&
        (p.area || 'Área 1') === area,
    )
    if (igual) {
      igual.cant = int(igual.cant) + cantidad
      hechas.unshift({ id: igual.id, codigo: d.codigo, ancho: d.ancho, alto: d.alto, cant: cantidad })
    } else {
      const id = uid()
      STATE.pieces.push({
        id,
        tipo: TIPO_BY_CODE[d.codigo],
        codigo: d.codigo,
        ancho: d.ancho,
        alto: d.alto,
        cant: cantidad,
        area,
        detalle: 'manual',
        flag: false,
      })
      hechas.unshift({ id, codigo: d.codigo, ancho: d.ancho, alto: d.alto, cant: cantidad })
    }
    hechas.splice(8)

    renderAll()
    pintarHechas()
    avisar(cantidad + ' × ' + d.codigo + ' ' + (d.ancho || '—') + '×' + d.alto + ' en ' + area)
    senalarFila(d.codigo, d.ancho, d.alto)

    // El tipo y la cantidad se limpian: así se ve que la pieza entró y no
    // queda en pantalla una línea que parece sin agregar. Las medidas sí se
    // quedan, que es lo que de verdad se repite de una pieza a la siguiente.
    if (el('cr-codigo')) el('cr-codigo').value = ''
    if (el('cr-cant')) el('cr-cant').value = '1'
    if (el('cr-ancho')) { el('cr-ancho').focus(); el('cr-ancho').select() }
    previsualizar()
  }

  /** deshace una de las últimas: le quita la cantidad que se había agregado */
  function deshacer(indice) {
    const h = hechas[indice]
    if (!h) return
    const p = STATE.pieces.find((x) => x.id === h.id)
    if (p) {
      p.cant = int(p.cant) - h.cant
      if (p.cant <= 0) STATE.pieces = STATE.pieces.filter((x) => x.id !== h.id)
    }
    hechas.splice(indice, 1)
    renderAll()
    pintarHechas()
    avisar('Deshecho.')
  }

  function pintarHechas() {
    const caja = el('cr-hechas')
    if (!caja) return
    if (!hechas.length) { caja.innerHTML = ''; return }
    caja.innerHTML =
      '<span class="cr-hechas-rot">Últimas:</span>' +
      hechas
        .map(
          (h, i) =>
            '<span class="cr-pildora">' + h.cant + ' × ' + h.codigo + ' ' +
            (h.ancho || '—') + '×' + h.alto +
            '<button data-deshacer="' + i + '" title="Deshacer">×</button></span>',
        )
        .join('')
    caja.querySelectorAll('[data-deshacer]').forEach((b) => {
      b.onclick = () => deshacer(parseInt(b.dataset.deshacer))
    })
  }

  /** se ilumina un momento la fila que acaba de cambiar, para no perderla de vista */
  function senalarFila(codigo, ancho, alto) {
    setTimeout(() => {
      const fila = document.querySelector(
        '.vrow[data-code="' + codigo + '"][data-ancho="' + ancho + '"][data-alto="' + alto + '"]',
      )
      if (!fila) return
      fila.classList.add('cr-recien')
      fila.scrollIntoView({ block: 'nearest' })
      setTimeout(() => fila.classList.remove('cr-recien'), 1400)
    }, 20)
  }

  function pintarFamilias() {
    document.querySelectorAll('#cr-familias [data-fam]').forEach((b) => {
      b.classList.toggle('activa', b.dataset.fam === familia)
    })
    const lista = el('cr-codigos')
    if (lista) {
      const propios = codigosDe(familia)
      const resto = todosLosCodigos().filter((c) => propios.indexOf(c) < 0)
      lista.innerHTML = propios.concat(resto).map((c) => '<option value="' + c + '">').join('')
    }
    if (el('cr-codigo')) {
      el('cr-codigo').placeholder = codigosDe(familia)
        .slice(0, 3)
        .map((c) => c.slice(2))
        .join(', ') + '…'
    }
  }

  function estilos() {
    if (el('cr-css')) return
    const s = document.createElement('style')
    s.id = 'cr-css'
    s.textContent = [
      '.cr-barra{border:1px solid var(--green-dim,#1f7a4d);border-radius:10px;padding:12px 14px;',
      '  margin-bottom:14px;background:rgba(0,255,149,.035)}',
      '.cr-linea{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.cr-rot{font-size:11px;letter-spacing:.5px;text-transform:uppercase;',
      '  color:var(--green,#00ff95);font-weight:700;margin-right:2px}',
      '#cr-familias{display:flex;gap:4px}',
      '#cr-familias button{padding:6px 11px;border:1px solid #3a4252;border-radius:7px;',
      '  background:transparent;color:var(--text-soft,#9aa4b2);cursor:pointer;',
      '  font-size:12px;font-family:inherit}',
      '#cr-familias button.activa{border-color:var(--green,#00ff95);color:var(--green,#00ff95);',
      '  background:rgba(0,255,149,.1);font-weight:700}',
      '.cr-barra input{padding:9px 10px;border:1px solid #3a4252;border-radius:7px;',
      '  background:var(--bg,#07090d);color:var(--text,#d8e3f3);font-size:14px;font-family:inherit}',
      '.cr-barra input:focus{outline:0;border-color:var(--green,#00ff95)}',
      '#cr-ancho,#cr-alto{width:88px}',
      '#cr-cant{width:66px}',
      '#cr-codigo{width:155px;text-transform:uppercase}',
      '.cr-x{color:var(--text-mute,#4d5772)}',
      '#cr-agregar{padding:9px 18px;border:1px solid var(--green-dim,#1f7a4d);border-radius:7px;',
      '  background:rgba(0,255,149,.12);color:var(--green,#00ff95);font-weight:700;',
      '  cursor:pointer;font-size:13px;font-family:inherit}',
      '#cr-agregar:hover{background:rgba(0,255,149,.22)}',
      '.cr-vista{font-size:12px;color:var(--green-soft,#5fffb8);margin-left:4px}',
      '.cr-vista.floja{color:var(--text-mute,#4d5772)}',
      '.cr-pie{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:9px;font-size:11.5px}',
      '.cr-ayuda{color:var(--text-mute,#4d5772)}',
      '.cr-aviso{color:var(--green-soft,#5fffb8)}',
      '.cr-aviso.mal{color:#ff9b9b}',
      '#cr-hechas{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}',
      '.cr-hechas-rot{font-size:11px;color:var(--text-mute,#4d5772);text-transform:uppercase}',
      '.cr-pildora{display:inline-flex;align-items:center;gap:6px;padding:3px 6px 3px 10px;',
      '  border:1px solid #2a3344;border-radius:12px;font-size:11.5px;color:var(--text-soft,#9aa4b2)}',
      '.cr-pildora button{border:0;background:transparent;color:var(--text-mute,#4d5772);',
      '  cursor:pointer;font-size:13px;line-height:1;padding:0 2px;font-family:inherit}',
      '.cr-pildora button:hover{color:#ff9b9b}',
      '.vrow.cr-recien{background:rgba(0,255,149,.14)}',
    ].join('\n')
    document.head.appendChild(s)
  }

  function armar() {
    const lista = el('vlist')
    if (!lista || el('cr-barra')) return
    estilos()

    const barra = document.createElement('div')
    barra.className = 'cr-barra'
    barra.id = 'cr-barra'
    barra.innerHTML = [
      '<div class="cr-linea">',
      '  <span class="cr-rot">Captura rápida</span>',
      '  <span id="cr-familias">',
      FAMILIAS.map((f) => '<button type="button" data-fam="' + f.id + '">' + f.rotulo + '</button>').join(''),
      '  </span>',
      '  <input id="cr-ancho" type="text" inputmode="numeric" placeholder="Ancho" title="Ancho en cm">',
      '  <span class="cr-x">×</span>',
      '  <input id="cr-alto" type="text" inputmode="numeric" placeholder="Alto" title="Alto en cm">',
      '  <input id="cr-codigo" list="cr-codigos" placeholder="Tipo" autocomplete="off"',
      '         title="Tipo corto (ADER) o código completo (PTADER)">',
      '  <datalist id="cr-codigos"></datalist>',
      '  <input id="cr-cant" type="text" inputmode="numeric" value="1" title="Cantidad">',
      '  <button type="button" id="cr-agregar">Agregar ⏎</button>',
      '  <span id="cr-vista" class="cr-vista floja"></span>',
      '</div>',
      '<div class="cr-pie">',
      '  <span class="cr-ayuda">Enter agrega: el tipo se limpia y las medidas se quedan · ',
      '    o escribí todo junto en la primera casilla: <b>70 150 ader 10</b></span>',
      '  <span id="cr-aviso" class="cr-aviso"></span>',
      '</div>',
      '<div id="cr-hechas"></div>',
    ].join('')
    lista.parentNode.insertBefore(barra, lista)

    el('cr-alto').value = altoPorFamilia(familia)

    barra.querySelectorAll('#cr-familias [data-fam]').forEach((b) => {
      b.onclick = () => {
        familia = b.dataset.fam
        el('cr-alto').value = altoPorFamilia(familia)
        pintarFamilias()
        previsualizar()
        el('cr-codigo').focus()
      }
    })
    barra.querySelector('#cr-agregar').onclick = agregar
    barra.querySelectorAll('input').forEach((i) => {
      i.addEventListener('input', previsualizar)
      i.addEventListener('focus', () => i.select())
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); agregar() }
      })
    })

    pintarFamilias()
    previsualizar()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armar)
  else armar()
})()
