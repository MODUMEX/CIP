// ════════════════════════════════════════════════════════════════════
//   Cálculo de Materiales — UNIFICADO
//   Apariencia: cyberpunk dark + tabs horizontales
//   Lógica:   motor de reglas v2.0 (14 casos verificados)
//   PDF:      lector con PDF.js + análisis IA opcional
// ════════════════════════════════════════════════════════════════════

// Catálogo de líneas y modelos — espejo del Constructor de Planos.
const LINEAS_CIP = ['LEEDER', 'Superior', 'Touchless'];
const MODELOS_POR_LINEA = {
  'LEEDER': [
    { codigo: 'ESTANDAR', nombre: 'Estándar' },
    { codigo: 'ESTANDAR170', nombre: 'Estándar 170' },
    { codigo: 'REFORZADO', nombre: 'Reforzado' },
    { codigo: 'REFORZADO170', nombre: 'Reforzado 170' },
    { codigo: 'IMPERIAL', nombre: 'Imperial' },
    { codigo: 'REGADERAS', nombre: 'Regaderas' },
    { codigo: 'SCUDO', nombre: 'Scudo' },
    { codigo: 'KIDS', nombre: 'Kids' },
    { codigo: 'COLGANTE', nombre: 'Colgante' },
  ],
  'Superior': [
    { codigo: 'SUP_ESTANDAR', nombre: 'Estándar' },
    { codigo: 'SUP_ESTANDAR170', nombre: 'Estándar 170' },
    { codigo: 'SUP_REFORZADO', nombre: 'Reforzado' },
    { codigo: 'SUP_REFORZADO170', nombre: 'Reforzado 170' },
    { codigo: 'SUP_COLGANTE', nombre: 'Colgante' },
  ],
  'Touchless': [
    { codigo: 'TL_S3', nombre: 'S3' },
  ],
};
// Familia de cálculo de herraje (base) a partir del código de modelo (display).
// El cálculo del CIP sigue usando estas 4 familias; el modelo "real" es solo para
// el selector, el label y el detalle del CSV.
function modeloBaseDe(codigo) {
  const c = (codigo || '').toUpperCase();
  if (c.startsWith('TL_') || c.includes('TOUCHLESS')) return 'REFORZADO';
  if (c.includes('REFORZADO')) return 'REFORZADO';
  if (c === 'SCUDO') return 'SCUDO';
  if (c.includes('REGADERA')) return 'REGADERA';
  return 'ESTÁNDAR';
}
function nombreModelo(codigo) {
  for (const L of LINEAS_CIP) {
    const m = (MODELOS_POR_LINEA[L] || []).find(x => x.codigo === codigo);
    if (m) return m.nombre;
  }
  return codigo || '';
}
function lineaDeCsv(txt) {
  const t = (txt || '').trim().toUpperCase();
  if (t.includes('SUPERIOR')) return 'Superior';
  if (t.includes('TOUCHLESS')) return 'Touchless';
  return 'LEEDER';
}
// (linea, texto del CSV "Modelo") → código de modelo del catálogo de esa línea.
function modeloCodigoDeCsv(linea, textoModelo) {
  const lst = MODELOS_POR_LINEA[linea] || MODELOS_POR_LINEA['LEEDER'];
  const t = (textoModelo || '').trim().toUpperCase();
  let m = lst.find(x => x.nombre.toUpperCase() === t || x.codigo.toUpperCase() === t);
  if (m) return m.codigo;
  const has = s => t.includes(s);
  if (has('IMPERIAL')) m = lst.find(x => x.codigo.includes('IMPERIAL'));
  else if (has('REFORZ') && has('170')) m = lst.find(x => x.codigo.includes('REFORZADO170'));
  else if (has('REFORZ')) m = lst.find(x => x.codigo.includes('REFORZADO') && !x.codigo.includes('170'));
  else if (has('SCUDO')) m = lst.find(x => x.codigo === 'SCUDO');
  else if (has('REGAD')) m = lst.find(x => x.codigo.includes('REGADERA'));
  else if (has('KID')) m = lst.find(x => x.codigo === 'KIDS');
  else if (has('COLG')) m = lst.find(x => x.codigo.includes('COLGANTE'));
  else if (has('170')) m = lst.find(x => x.codigo.includes('ESTANDAR170'));
  else if (has('EST') || has('STD')) m = lst.find(x => x.codigo.includes('ESTANDAR') && !x.codigo.includes('170'));
  return m ? m.codigo : (lst[0] ? lst[0].codigo : 'ESTANDAR');
}

const STATE = {
  // identificación
  obra: '', cliente: '', exp: '',
  linea: 'LEEDER',
  region: 'CR',          // 'CR' (colores Costa Rica) | 'MX' (colores México)
  acabado: '',          // Superior: "Laminado Compacto" (Sólido) | "Esmaltada…"/"Acero…" (Lámina)
  modelo: 'ESTÁNDAR',    // FAMILIA DE CÁLCULO (base): ESTÁNDAR|REFORZADO|REGADERA|SCUDO
  modeloCod: 'ESTANDAR', // modelo REAL para selector/label/CSV (código del catálogo)
  sistema: 'PATAS',     // PATAS | ZOCLO  (Terminación Inferior)
  kap: 'NO',            // NO | SI
  refuerzo: 'AUTO',     // AUTO | OFF (sólo si modelo REFORZADO)
  refuerzoCortes: [],   // cortes de refuerzo importados de la OC o cargados a mano: {cm, cant, area}
  refuerzoKits: null,   // kits del refuerzo importados de la OC: {KE62, KE65}
  puertasAfuera: 0,     // (manual) nº de puertas que abren afuera → cerradura S1/S2 (Touchless)
  areaActual: 'Área 1', // área a la que se asignan las piezas cargadas a mano (stepper)
  areasManual: ['Área 1'], // áreas creadas a mano (persisten aunque estén vacías)
  herrajesExtraOC: [],  // herrajes extra importados de la OC: {codigo, cant}
  antepechos: [],       // antepechos SCUDO importados de la OC: {ancho, alto, cant, area}
  perfilUCortes: [],    // cortes de perfil U SCUDO (104-610) importados de la OC: {cm, cant, area}
  tubingCortes: [],     // recorridos de tubing IMPERIAL (T00021) importados de la OC: {cm, cant, area}
  tubingKits: null,     // kits del tubing importados de la OC: {KCHL}
  ocAdicional: false,   // true si es OC complemento de otro EXP
  color: '', colorCode: '',
  colorBicolor: '',     // color secundario opcional
  notas: '',
  ocTotal: '',
  aiAdvertencias: [],

  // piezas
  pieces: [],   // {id, tipo, codigo, ancho, alto, cant, detalle, flag}

  // PDF + IA
  pdfPlano:  { name: '', text: '', images: [], numPages: 0 },
  pdfOC:     { name: '', text: '', images: [], numPages: 0 },
  ocSoloHerrajes: false,
  expPadre: '',
  ocRowsEdit: [],         // tabla DIVISIONES de la OC, parseada y editable
  aiAdvertencias: [],

  // Edición manual de la hoja de corte. Cuando el usuario rota una pieza, la
  // mueve a otra hoja, o agrega/quita una hoja vacía, esto pasa a enabled=true
  // y conserva las decisiones individuales hasta que se toca "↺ Auto".
  //   byIid: { [iid]: { sheet: number, rotated: boolean } }
  //   sheets: metadatos por hoja global → { color, W, H } (cada hoja es mono-color)
  cutManual: {
    enabled: false,
    byIid: {},
    sheets: [],
  },
  // Tamaños de hoja disponibles para el corte (claves de SHEET_FORMATS). Multiselección.
  cutSizes: ['5x12'],
  // Tamaños por color (color → [formatos]). Si un color no está, usa su default.
  cutSizesPorColor: {},
  // Grado Premium del 4×10 por color (solo INOX SATÍN). color → bool.
  premiumPorColor: {},
  // Sobrantes de almacén cargados del Excel (verde = usable). Cada uno:
  //   {colorNum, esp(3|12), largoM, anchoM, qty, code, hoja}
  sobrantes: [],
  usarSobrantes: true,
};

// ────────────── Catálogo de códigos ──────────────
const CODES = {
  PUERTAS: [
    { code: 'PTADER',     desc: 'Puerta carga derecha, abre interior hacia panel o abre exterior' },
    { code: 'PTADER-AM',  desc: 'Puerta carga derecha, abre interior hacia muro' },
    { code: 'PTAIZQ',     desc: 'Puerta carga izquierda, abre interior hacia PN o abre exterior' },
    { code: 'PTAIZQ-AM',  desc: 'Puerta carga izquierda, abre interior hacia muro' },
    { code: 'PTBDER',     desc: 'Puerta carga en muro derecha, abre exterior' },
    { code: 'PTBDER-AM',  desc: 'Puerta carga en muro derecha, abre interior hacia muro' },
    { code: 'PTCIZQ',     desc: 'Puerta carga en muro izquierda, abre exterior' },
    { code: 'PTCIZQ-AM',  desc: 'Puerta carga en muro izquierda, abre interior hacia muro' },
    { code: 'PTCDER',     desc: 'Puerta carga derecha, cierra sobre muro, abre interior hacia panel' },
    { code: 'PTCDER-AM',  desc: 'Puerta carga derecha, cierra sobre muro, abre interior hacia muro' },
    { code: 'PTBIZQ',     desc: 'Puerta carga izquierda, cierra sobre muro, abre interior hacia panel' },
    { code: 'PTBIZQ-AM',  desc: 'Puerta carga izquierda, cierra sobre muro, abre interior hacia muro' },
    { code: 'PTFDER',     desc: 'Puerta carga en muro derecha, cierre a muro (sin ranuras)' },
    { code: 'PTFIZQ',     desc: 'Puerta carga en muro izquierda, cierre a muro (sin ranuras)' },
  ],
  PANELES: [
    { code: 'PNCEN', desc: 'Panel central, sobre centro de pilastra' },
    { code: 'PNLAT', desc: 'Panel lateral, en escuadra con pilastra' },
    { code: 'PNUNI', desc: 'Panel unido en línea con otro panel o con otra pilastra' },
  ],
  // CÓDIGOS OFICIALES DE CHECKLIST: MG120 (cualquier ancho con alto 120)
  // y MG150 (cualquier ancho con alto 150). El ancho real se captura en el row
  // de la pieza (ej. MG120 con 45×120 o 60×120).
  // Antes se usaban MG45/MG60120/MG60 pero esos NO existen en los checklists
  // oficiales — esos códigos se reservan para nomenclatura por dimensión, no
  // para el campo "Código Verif." del .xlsm.
  MINGITORIOS: [
    { code: 'MG120', desc: 'Panel Mingitorio altura 1.20 (0.45×1.20 ó 0.60×1.20)', ancho: 45, alto: 120 },
    { code: 'MG150', desc: 'Panel Mingitorio altura 1.50 (0.60×1.50)',             ancho: 60, alto: 150 },
  ],
  PILASTRAS: [
    { code: 'PLCEN',     desc: 'Pilastra central' },
    { code: 'PLLAT',     desc: 'Pilastra lateral, en escuadra con panel' },
    { code: 'PLCOS',     desc: 'Pilastra costilla sobre otra mampara' },
    { code: 'PLLATMUR',  desc: 'Pilastra lateral a muro' },
    { code: 'PLCOSMUR',  desc: 'Pilastra costilla a muro' },
    { code: 'PLCENKEML', desc: 'Pilastra central sobre muro con escuadras de metal' },
    { code: 'PLLATKEML', desc: 'Pilastra lateral sobre muro con escuadras de metal' },
  ],
};

const TIPO_BY_CODE = {};
Object.entries(CODES).forEach(([grp, arr]) => {
  const tipo = grp === 'PUERTAS' ? 'PT' :
               grp === 'PANELES' ? 'PN' :
               grp === 'MINGITORIOS' ? 'MG' : 'PL';
  arr.forEach(it => TIPO_BY_CODE[it.code] = tipo);
});

// Alias ya no necesarios — todos los códigos MG son canónicos.
// Función de canonicalización mantiene solo uppercase y trim.
function canonicalCode(code) {
  return (code || '').toUpperCase().trim();
}

// Catálogo de colores. Cada entrada incluye:
//   code         — código interno (legacy, el que ya estaba en planillas y SAP)
//   codigoNuevo  — código de catálogo nuevo (MT-xxx, SL-xxx, MD-xxx)
//   tianrun      — código del proveedor TianRun
//   nuevo        — nombre comercial nuevo
//   dark         — color oscuro → etiqueta F36 (letras blancas), claro → F35 (letras negras)
//   veta         — laminado con veta direccional (no permite rotar piezas en corte)
//   formato      — '5x12' | '4x10' | '4x8' — tamaño de hoja oficial (deriva de los últimos
//                  caracteres del code: -1/-1ST/-6-1ST → 5×12 · -2/-2PR → 4×10 · -3/-4ST → 4×8)
//                  El laminado se calcula como N°hojas × superficie_hoja:
//                    5×12 (366×152) = 5.56 m² · 4×10 (305×122) = 3.7 m² · 4×8 (244×122) = 2.97 m²
const COLOR_MAP = {
  // ─── Nomenclatura NUEVA (canónica) ───
  'INOX SATIN':       { code: '2048-12-1ST', codigoNuevo: 'MT-240', tianrun: '8111',     nuevo: 'INOX SATÍN',       dark: true,  veta: true,  formato: '5x12' },
  'GRIS':             { code: '2108-12-1',   codigoNuevo: 'SL-210', tianrun: '9088',     nuevo: 'GRIS',             dark: false, veta: false, formato: '5x12' },
  'NEGRO':            { code: '1598-12-1ST', codigoNuevo: 'SL-600', tianrun: '8001',     nuevo: 'NEGRO',            dark: true,  veta: false, formato: '5x12' },
  'BLANCO':           { code: '8801-12-1ST', codigoNuevo: 'SL-110', tianrun: '8801',     nuevo: 'BLANCO',           dark: false, veta: false, formato: '5x12' },
  'AMBAR WOOD':       { code: '2005-12-1',   codigoNuevo: 'MD-310', tianrun: '20046-10', nuevo: 'ÁMBAR WOOD',       dark: true,  veta: true,  formato: '5x12' },
  'NOGAL GRAFITO':    { code: '2004-12-1',   codigoNuevo: 'MD-380', tianrun: '20046-11', nuevo: 'NOGAL GRAFITO',    dark: true,  veta: true,  formato: '5x12' },
  'GRAFITO NOCTURNO': { code: '8002-12-1',   codigoNuevo: 'SL-510', tianrun: '8002',     nuevo: 'GRAFITO NOCTURNO', dark: true,  veta: false, formato: '5x12' },

  // ─── Aliases LEGACY → apuntan al mismo material con nombre nuevo ───
  'GRIS METALIZADO':  { code: '2048-12-1ST', codigoNuevo: 'MT-240', tianrun: '8111',     nuevo: 'INOX SATÍN',       dark: true,  veta: true,  formato: '5x12', alias: 'INOX SATIN' },
  'GRIS METALICO':    { code: '2048-12-1ST', codigoNuevo: 'MT-240', tianrun: '8111',     nuevo: 'INOX SATÍN',       dark: true,  veta: true,  formato: '5x12', alias: 'INOX SATIN' },
  'GRIS METALIC':     { code: '2048-12-1ST', codigoNuevo: 'MT-240', tianrun: '8111',     nuevo: 'INOX SATÍN',       dark: true,  veta: true,  formato: '5x12', alias: 'INOX SATIN' },
  'ALUMINAK':         { code: '2108-12-1',   codigoNuevo: 'SL-210', tianrun: '9088',     nuevo: 'GRIS',             dark: false, veta: false, formato: '5x12', alias: 'GRIS' },
  'NEGRO STD':        { code: '1598-12-1ST', codigoNuevo: 'SL-600', tianrun: '8001',     nuevo: 'NEGRO',            dark: true,  veta: false, formato: '5x12', alias: 'NEGRO' },
  'NEGRO SL-600':     { code: '1598-12-1ST', codigoNuevo: 'SL-600', tianrun: '8001',     nuevo: 'NEGRO',            dark: true,  veta: false, formato: '5x12', alias: 'NEGRO' },
  'WHITEC':           { code: '8801-12-1ST', codigoNuevo: 'SL-110', tianrun: '8801',     nuevo: 'BLANCO',           dark: false, veta: false, formato: '5x12', alias: 'BLANCO' },
  'WHITEC STD':       { code: '8801-12-1ST', codigoNuevo: 'SL-110', tianrun: '8801',     nuevo: 'BLANCO',           dark: false, veta: false, formato: '5x12', alias: 'BLANCO' },
  'WALNUT':           { code: '2005-12-1',   codigoNuevo: 'MD-310', tianrun: '20046-10', nuevo: 'ÁMBAR WOOD',       dark: true,  veta: true,  formato: '5x12', alias: 'AMBAR WOOD' },
  'WALNUT STD':       { code: '2005-12-1',   codigoNuevo: 'MD-310', tianrun: '20046-10', nuevo: 'ÁMBAR WOOD',       dark: true,  veta: true,  formato: '5x12', alias: 'AMBAR WOOD' },
  'WALNUT HEIGHTS':   { code: '2005-12-1',   codigoNuevo: 'MD-310', tianrun: '20046-10', nuevo: 'ÁMBAR WOOD',       dark: true,  veta: true,  formato: '5x12', alias: 'AMBAR WOOD' },
  'SKYLINE':          { code: '2004-12-1',   codigoNuevo: 'MD-380', tianrun: '20046-11', nuevo: 'NOGAL GRAFITO',    dark: true,  veta: true,  formato: '5x12', alias: 'NOGAL GRAFITO' },
  'SKYLINE STD':      { code: '2004-12-1',   codigoNuevo: 'MD-380', tianrun: '20046-11', nuevo: 'NOGAL GRAFITO',    dark: true,  veta: true,  formato: '5x12', alias: 'NOGAL GRAFITO' },
  'SKYLINE WALNUT':   { code: '2004-12-1',   codigoNuevo: 'MD-380', tianrun: '20046-11', nuevo: 'NOGAL GRAFITO',    dark: true,  veta: true,  formato: '5x12', alias: 'NOGAL GRAFITO' },

  // ─── Otros legacy aún en uso (no aparecen en tabla nueva pero se mantienen) ───
  'ALUMINA':       { code: '1598-12-1ST', codigoNuevo: '', tianrun: '', nuevo: '', dark: false, veta: false, formato: '5x12' },
  'ALUMINA 2103':  { code: '2103-12-1ST', codigoNuevo: '', tianrun: '', nuevo: '', dark: false, veta: false, formato: '5x12' },
  'ALUMINA 2108':  { code: '2108-12-1',   codigoNuevo: '', tianrun: '', nuevo: '', dark: false, veta: false, formato: '5x12' },
  'NEUTRAL OAK':   { code: '1266-12-1',   codigoNuevo: '', tianrun: '', nuevo: '', dark: false, veta: false, formato: '5x12' },
  'NEGRO EBANO':   { code: '2110-12-1',   codigoNuevo: '', tianrun: '', nuevo: '', dark: true,  veta: false, formato: '5x12' },
  'EBANO':         { code: '2120-12-1',   codigoNuevo: '', tianrun: '', nuevo: '', dark: true,  veta: false, formato: '5x12' },
};

// Mapa formato → valor del select cut-sheet (W,H en cm) y m² por hoja
const SHEET_FORMATS = {
  '5x12': { value: '366,152', m2: 5.56, label: '5×12 pies (366×152 cm)' },
  '4x10': { value: '305,122', m2: 3.7,  label: '4×10 pies (305×122 cm)' },
  '4x8':  { value: '244,122', m2: 2.97, label: '4×8 pies (244×122 cm)' },
};

// Código interno POR TAMAÑO (cada color+tamaño = un código distinto).
// Clave = nombre nuevo (canónico). fmts: formato→código; pr: variante Premium (INOX 4×10).
const MAT_TAMANO = {
  'INOX SATÍN':    { fmts: { '5x12': '2048-12-1ST', '4x10': '2048-12-2ST', '4x8': '2048-12-4ST' }, pr: { '4x10': '2048-12-2PR' } },
  'GRIS':          { fmts: { '5x12': '2108-12-1' } },
  'NEGRO':         { fmts: { '5x12': '1598-12-1ST' } },
  'BLANCO':        { fmts: { '5x12': '8801-12-1ST' } },
  'ÁMBAR WOOD':    { fmts: { '5x12': '2005-12-1', '4x10': '2005-12-2', '4x8': '2005-12-3' } },
  'NOGAL GRAFITO': { fmts: { '4x10': '2004-12-2' } },
};
// ─── Colores de MÉXICO (desde "colores x codigo.xlsx", 12mm + EX2) ───
const MAT_TAMANO_MX = {
  'ALMENDRA Estándar': { fmts: { '5x12': '0921-12-1ST' } },
  'ALUMINAV V2106 PREMIUM': { fmts: { '5x12': '2106-12-1PR' } },
  'ATENAS EX2': { fmts: { '4x10': '3176-12-2EX2', '4x8': '3176-12-2EX48' } },
  'Alumina': { fmts: { '5x12': '2103-12' } },
  'Aluminak premium': { fmts: { '5x12': '2108-12-1pr' } },
  'Black premium': { fmts: { '5x12': '1598-12-1pr' } },
  'Blanco': { fmts: { '5x12': '1570-12-1' } },
  'CALCUTTA MARBLE': { fmts: { '5x12': '4925-12-1' } },
  'CATALINA': { fmts: { '5x12': '13092-12-1' } },
  'CONCRETE EX2': { fmts: { '4x10': '3127-12-2EX2', '4x8': '3127-12-3EX2' } },
  'Carbon': { fmts: { '5x12': '2192-12' } },
  'Champaña metalizado': { fmts: { '5x12': '0220-12' } },
  'DARK STEEL EX2': { fmts: { '4x10': '2315-12-2EX2', '4x8': '2315-12-3EX2' } },
  'DESIGNER WHITE': { fmts: { '5x12': 'D354-12-1' } },
  'Ebano': { fmts: { '5x12': '2110-12-1' } },
  'Fashion White': { fmts: { '5x12': '2125-12' } },
  'Frosty': { fmts: { '5x12': '1573-12' } },
  'GRAFITO NOCTURNO 8002': { fmts: { '5x12': '8002-12-1' } },
  'Grey Nebula': { fmts: { '5x12': '4622-12' } },
  'Grey Oak': { fmts: { '4x10': '1829-12-2', '5x12': '1829-12-1' } },
  'Gris metalic ESTANDAR': { fmts: { '5x12': '2048-12-1ST' } },
  'Gris metalic Premium': { fmts: { '4x10': '2048-12-2pr', '5x12': '2048-12-1pr' } },
  'ITALIAN WALNUT / CORE CAFE EX2': { fmts: { '4x10': '1513-12-2EX2', '4x8': '1513-12-3EX2' } },
  'Italian Walnut': { fmts: { '4x10': '1513-12-2', '5x12': '1513-12-1' } },
  'MARMOL BLANCO COLOR CORE': { fmts: { '4x10': '7382-12-2' } },
  'Metalized brush': { fmts: { '4x10': '2047-12-3', '5x12': '2047-12-1' } },
  'NEGRO 1599 PREMIUM': { fmts: { '5x12': '1599-12-1PR' } },
  'Natural Almond': { fmts: { '5x12': 'D30-12-1' } },
  'Negro': { fmts: { '5x12': '1595-12' } },
  'Platinum': { fmts: { '5x12': 'D315-12-1' } },
  'ROBLE LINEAL / CORE CAFE EX2': { fmts: { '4x10': '1467-12-2EX2', '4x8': '1467-12-3EX2' } },
  'SKYLINE STD': { fmts: { '4x10': '2004-12-2', '5x12': '2004-12-1' } },
  'Satin': { fmts: { '4x10': '4830-12-2', '5x12': '4830-12-1' } },
  'Skyline Walnut': { fmts: { '4x10': '7964-12-2', '5x12': '7964-12-1' } },
  'TIZIANO EX2': { fmts: { '4x10': '3172-12-2EX2', '4x8': '3172-12-3EX2' } },
  'VANILLA EX2': { fmts: { '4x10': '2109-12-2EX2' } },
  'WALNUT STD': { fmts: { '4x10': '2005-12-2', '5x12': '2005-12-1' } },
  'WHITEC PREMIUM QUALITY': { fmts: { '5x12': '8801-12-1pr' } },
  'Walnut Heights': { fmts: { '4x10': '7965-12-2', '5x12': '7965-12-1' } },
};
const COLOR_MAP_MX = {
  'ALMENDRA ESTANDAR': { code: '0921-12-1ST', nuevo: 'ALMENDRA Estándar', formato: '5x12', dark: false, veta: false },
  'ALUMINAV V2106 PREMIUM': { code: '2106-12-1PR', nuevo: 'ALUMINAV V2106 PREMIUM', formato: '5x12', dark: false, veta: false },
  'ATENAS EX2': { code: '3176-12-2EX2', nuevo: 'ATENAS EX2', formato: '4x10', dark: false, veta: true },
  'ALUMINA': { code: '2103-12', nuevo: 'Alumina', formato: '5x12', dark: false, veta: false },
  'ALUMINAK PREMIUM': { code: '2108-12-1pr', nuevo: 'Aluminak premium', formato: '5x12', dark: false, veta: false },
  'BLACK PREMIUM': { code: '1598-12-1pr', nuevo: 'Black premium', formato: '5x12', dark: true, veta: false },
  'BLANCO': { code: '1570-12-1', nuevo: 'Blanco', formato: '5x12', dark: false, veta: false },
  'CALCUTTA MARBLE': { code: '4925-12-1', nuevo: 'CALCUTTA MARBLE', formato: '5x12', dark: false, veta: true },
  'CATALINA': { code: '13092-12-1', nuevo: 'CATALINA', formato: '5x12', dark: false, veta: true },
  'CONCRETE EX2': { code: '3127-12-2EX2', nuevo: 'CONCRETE EX2', formato: '4x10', dark: false, veta: true },
  'CARBON': { code: '2192-12', nuevo: 'Carbon', formato: '5x12', dark: true, veta: false },
  'CHAMPANA METALIZADO': { code: '0220-12', nuevo: 'Champaña metalizado', formato: '5x12', dark: false, veta: false },
  'DARK STEEL EX2': { code: '2315-12-2EX2', nuevo: 'DARK STEEL EX2', formato: '4x10', dark: true, veta: false },
  'DESIGNER WHITE': { code: 'D354-12-1', nuevo: 'DESIGNER WHITE', formato: '5x12', dark: false, veta: false },
  'EBANO': { code: '2110-12-1', nuevo: 'Ebano', formato: '5x12', dark: true, veta: false },
  'FASHION WHITE': { code: '2125-12', nuevo: 'Fashion White', formato: '5x12', dark: false, veta: false },
  'FROSTY': { code: '1573-12', nuevo: 'Frosty', formato: '5x12', dark: false, veta: false },
  'GRAFITO NOCTURNO 8002': { code: '8002-12-1', nuevo: 'GRAFITO NOCTURNO 8002', formato: '5x12', dark: true, veta: false },
  'GREY NEBULA': { code: '4622-12', nuevo: 'Grey Nebula', formato: '5x12', dark: false, veta: false },
  'GREY OAK': { code: '1829-12-1', nuevo: 'Grey Oak', formato: '5x12', dark: false, veta: true },
  'GRIS METALIC ESTANDAR': { code: '2048-12-1ST', nuevo: 'Gris metalic ESTANDAR', formato: '5x12', dark: false, veta: false },
  'GRIS METALIC PREMIUM': { code: '2048-12-1pr', nuevo: 'Gris metalic Premium', formato: '5x12', dark: false, veta: false },
  'ITALIAN WALNUT / CORE CAFE EX2': { code: '1513-12-2EX2', nuevo: 'ITALIAN WALNUT / CORE CAFE EX2', formato: '4x10', dark: true, veta: true },
  'ITALIAN WALNUT': { code: '1513-12-1', nuevo: 'Italian Walnut', formato: '5x12', dark: false, veta: true },
  'MARMOL BLANCO COLOR CORE': { code: '7382-12-2', nuevo: 'MARMOL BLANCO COLOR CORE', formato: '4x10', dark: false, veta: true },
  'METALIZED BRUSH': { code: '2047-12-1', nuevo: 'Metalized brush', formato: '5x12', dark: false, veta: false },
  'NEGRO 1599 PREMIUM': { code: '1599-12-1PR', nuevo: 'NEGRO 1599 PREMIUM', formato: '5x12', dark: true, veta: false },
  'NATURAL ALMOND': { code: 'D30-12-1', nuevo: 'Natural Almond', formato: '5x12', dark: false, veta: false },
  'NEGRO': { code: '1595-12', nuevo: 'Negro', formato: '5x12', dark: true, veta: false },
  'PLATINUM': { code: 'D315-12-1', nuevo: 'Platinum', formato: '5x12', dark: false, veta: false },
  'ROBLE LINEAL / CORE CAFE EX2': { code: '1467-12-2EX2', nuevo: 'ROBLE LINEAL / CORE CAFE EX2', formato: '4x10', dark: true, veta: true },
  'SKYLINE STD': { code: '2004-12-1', nuevo: 'SKYLINE STD', formato: '5x12', dark: false, veta: true },
  'SATIN': { code: '4830-12-1', nuevo: 'Satin', formato: '5x12', dark: false, veta: false },
  'SKYLINE WALNUT': { code: '7964-12-1', nuevo: 'Skyline Walnut', formato: '5x12', dark: false, veta: true },
  'TIZIANO EX2': { code: '3172-12-2EX2', nuevo: 'TIZIANO EX2', formato: '4x10', dark: false, veta: true },
  'VANILLA EX2': { code: '2109-12-2EX2', nuevo: 'VANILLA EX2', formato: '4x10', dark: false, veta: false },
  'WALNUT STD': { code: '2005-12-1', nuevo: 'WALNUT STD', formato: '5x12', dark: false, veta: true },
  'WHITEC PREMIUM QUALITY': { code: '8801-12-1pr', nuevo: 'WHITEC PREMIUM QUALITY', formato: '5x12', dark: false, veta: false },
  'WALNUT HEIGHTS': { code: '7965-12-1', nuevo: 'Walnut Heights', formato: '5x12', dark: false, veta: true },
};
// ─── Colores que el plano manda JUNTOS ───────────────────────────────────
//
// El Constructor muestra un solo "Alumina" porque al distribuidor le da igual
// de qué lámina salga: para él es un color. Pero acá sí importa, porque cada
// lámina tiene su código y es la que se da de baja del almacén.
//
// Por eso el plano NO manda código cuando el color tiene varias láminas: manda
// el nombre, y el CIP despliega las opciones para que se elija. Las claves y
// las opciones van en MAYÚSCULA y sin tildes, como las deja _stripAccents.
const FAMILIAS_MX = {
  'ALUMINA':       ['ALUMINA', 'ALUMINAK PREMIUM', 'ALUMINAV V2106 PREMIUM'],
  'NEGRO':         ['NEGRO', 'BLACK PREMIUM', 'NEGRO 1599 PREMIUM'],
  'BLANCO':        ['BLANCO', 'BLANCO 1571 PREMIUM'],
  'SKYLINE':       ['SKYLINE WALNUT', 'SKYLINE STD'],
  'WALNUT':        ['WALNUT HEIGHTS', 'WALNUT STD'],
  'GRIS METALICO': ['GRIS METALIC ESTANDAR', 'GRIS METALIC PREMIUM'],
};

// Las láminas que tiene un color, o null si ese nombre no es una familia.
// Solo devuelve las que de verdad existen en el catálogo de México.
function opcionesDeFamiliaMx(name) {
  if (!name) return null;
  const upper = _stripAccents(name).toUpperCase().trim();
  const fam = FAMILIAS_MX[upper];
  if (!fam) return null;
  const hay = fam.filter(k => !!COLOR_MAP_MX[k]);
  return hay.length > 1 ? hay : null;
}

// Región activa del CIP: 'CR' (colores actuales de Costa Rica) | 'MX' (colores de México).
function colorMapActivo()  { return STATE.region === 'MX' ? COLOR_MAP_MX  : COLOR_MAP; }
function matTamanoActivo() { return STATE.region === 'MX' ? MAT_TAMANO_MX : MAT_TAMANO; }
// Detecta la región por el nombre del color (match EXACTO): 'MX' si existe solo en MX,
// 'CR' si solo en CR, null si está en ambos (nombre que choca) o en ninguno.
function detectarRegionColor(name) {
  if (!name) return null;
  const upper = _stripAccents(name).toUpperCase().trim();
  const inMX = !!COLOR_MAP_MX[upper];
  const inCR = !!COLOR_MAP[upper];
  if (inMX && !inCR) return 'MX';
  if (inCR && !inMX) return 'CR';
  return null;
}
const FMT_POR_WH = { '366×152': '5x12', '305×122': '4x10', '244×122': '4x8' };
const FMT_LABEL  = { '5x12': '5×12', '4x10': '4×10', '4x8': '4×8' };
function matTamano(cName) {
  const ci = lookupColor(cName);
  return matTamanoActivo()[(ci && ci.nuevo) || cName] || null;
}
function formatosDeColor(cName) {
  const m = matTamano(cName);
  // 4×8 retirado del corte para TODOS los colores (pedido de Dayanna): nunca se ofrece
  // como hoja. Se filtra acá (un solo lugar); los códigos SAP de 4×8 quedan en MAT_TAMANO
  // por si hay que reactivarlo — basta quitar este .filter.
  return m ? Object.keys(m.fmts).filter(f => f !== '4x8') : [];
}
function tienePremium(cName, fmt) {
  const m = matTamano(cName);
  return !!(m && m.pr && m.pr[fmt]);
}
function codigoInternoTamano(cName, fmt, premium) {
  const m = matTamano(cName);
  if (!m) return '';
  if (premium && m.pr && m.pr[fmt]) return m.pr[fmt];
  return m.fmts[fmt] || '';
}

// Inferir formato desde el sufijo del código interno cuando el color no
// está mapeado explícitamente. Reglas extraídas de la planilla DIBUJO CORTE!J4:
function inferFormatoFromCode(code) {
  if (!code) return '5x12';
  const c = String(code).toUpperCase().trim();
  // 4×8: terminaciones -3 o -4ST
  if (/-3$/.test(c) || /-4ST$/.test(c)) return '4x8';
  // 4×10: terminaciones -2, -2ST, -2PR
  if (/-2$/.test(c) || /-2[A-Z]+$/.test(c)) return '4x10';
  // 5×12 default: -1, -1ST, -6-1ST y casos no listados
  return '5x12';
}

// Quita tildes para matching tolerante (INOX SATÍN ≡ INOX SATIN)
function _stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function lookupColor(name) {
  const empty = { code: '', codigoNuevo: '', tianrun: '', nuevo: '', dark: false, veta: false, formato: '5x12' };
  if (!name) return empty;
  const upper = _stripAccents(name).toUpperCase().trim();
  const CM = colorMapActivo();
  let hit = null;
  if (CM[upper]) hit = CM[upper];
  // Un nombre de FAMILIA se resuelve a su primera lámina y no al buscador por
  // parecido de abajo, que es peligroso: "WALNUT" se parece a "ITALIAN WALNUT",
  // que es otro color, y lo habría tomado por bueno. Cuál se usa de verdad lo
  // elige la persona en Capturar; esto es solo para que nunca quede en nada.
  if (!hit && STATE.region === 'MX') {
    const fam = opcionesDeFamiliaMx(upper);
    if (fam) hit = CM[fam[0]];
  }
  if (!hit) {
    const keys = Object.keys(CM).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (upper.includes(k) || k.includes(upper)) { hit = CM[k]; break; }
    }
  }
  if (!hit) return empty;
  // Garantizar que siempre haya un formato; si no está mapeado explícitamente, derivarlo del code
  if (!hit.formato) {
    hit = { ...hit, formato: inferFormatoFromCode(hit.code) };
  }
  return hit;
}

// ────────────── Helpers ──────────────
const $  = (id)  => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v)  => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const int = (v)  => { const n = parseInt(v);   return isNaN(n) ? 0 : n; };

// Cantidad consolidada por código (suma todas las filas con ese código)
function getQty(code) {
  let q = 0;
  STATE.pieces.forEach(p => {
    if ((p.codigo || '').toUpperCase() === code) q += int(p.cant);
  });
  return q;
}

// Devuelve la "primera" fila para un código (o null) — para editar dims rápidamente
function firstPieceWithCode(code) {
  return STATE.pieces.find(p => (p.codigo || '').toUpperCase() === code) || null;
}

// ════════════════════════════════════════════════════════════════════
//   COUNTERS
// ════════════════════════════════════════════════════════════════════
function countPieces() {
  // Contadores discretos por subtipo, alineados 1:1 con las filas de la
  // hoja VERIFICACIÓN de los checklists oficiales (Excel de fábrica):
  //   row 4=PTADER, 5=PTADER-AM, 6=PTAIZQ, 7=PTAIZQ-AM,
  //   8=PTBDER, 9=PTBDER-AM, 10=PTCIZQ, 11=PTCIZQ-AM,
  //   12=PTCDER, 13=PTCDER-AM, 14=PTBIZQ, 15=PTBIZQ-AM,
  //   16=PTFDER, 17=PTFIZQ,
  //   18=PNCEN, 19=PNLAT, 20=PNUNI,
  //   21=MG120, 22=MG150,
  //   23=PLCEN, 24=PLLAT, 25=PLCOS, 26=PLLATMUR, 27=PLCOSMUR,
  //   28=PLCENKEML, 29=PLLATKEML.
  const c = {
    PT_total: 0,
    PTADER:0, PTADERAM:0, PTAIZQ:0, PTAIZQAM:0,
    PTBDER:0, PTBDERAM:0, PTCIZQ:0, PTCIZQAM:0,
    PTCDER:0, PTCDERAM:0, PTBIZQ:0, PTBIZQAM:0,
    PTFDER:0, PTFIZQ:0,
    PN_total: 0, PNCEN: 0, PNLAT: 0, PNUNI: 0,
    PL_total: 0, PLCEN: 0, PLLAT: 0, PLCOS: 0, PLLATMUR: 0, PLCOSMUR: 0,
    PLCENKEML: 0, PLLATKEML: 0,
    MG_total: 0, MG120: 0, MG150: 0,
    pilastras: [],
  };

  STATE.pieces.forEach(p => {
    const cant = int(p.cant);
    if (cant <= 0) return;
    const code = (p.codigo || '').toUpperCase().trim();

    if (p.tipo === 'PT') {
      c.PT_total += cant;
      // Mapeo: PTADER-AM → PTADERAM (sin guión)
      const key = code.replace('-', '');
      if (Object.prototype.hasOwnProperty.call(c, key) && key.startsWith('PT')) {
        c[key] += cant;
      }
    } else if (p.tipo === 'PN') {
      c.PN_total += cant;
      if (code === 'PNCEN') c.PNCEN += cant;
      else if (code === 'PNLAT') c.PNLAT += cant;
      else if (code === 'PNUNI') c.PNUNI += cant;
    } else if (p.tipo === 'PL') {
      c.PL_total += cant;
      if (Object.prototype.hasOwnProperty.call(c, code) && code.startsWith('PL')) {
        c[code] += cant;
      }
      for (let i = 0; i < cant; i++) c.pilastras.push({ ancho: num(p.ancho), tipo: code });
    } else if (p.tipo === 'MG') {
      c.MG_total += cant;
      // Códigos oficiales: MG120 (alto 120, cualquier ancho) y MG150 (alto 150).
      // El alto se toma del row pero si el code lo declara, prevalece.
      let alto = num(p.alto);
      if (code === 'MG120') alto = 120;
      else if (code === 'MG150') alto = 150;
      // Compatibilidad legacy con archivos guardados antes del rename:
      else if (code === 'MG45' || code === 'MG60120') alto = 120;
      else if (code === 'MG60') alto = 150;
      if (alto >= 100 && alto <= 135) c.MG120 += cant;
      else if (alto >= 140) c.MG150 += cant;
    }
  });

  return c;
}

// ════════════════════════════════════════════════════════════════════
//   HARDWARE ENGINE
// ════════════════════════════════════════════════════════════════════
// ─── Refuerzo: el aluminio viene en barras de 6 m; un tramo más largo se
//     arma con barras completas + un recorte que se une hasta completar. ───
const REFUERZO_BARRA_CM = 600;
function expandirCortesRefuerzo(cortes) {
  const out = [];
  (cortes || []).forEach(r => {
    const L = Math.round(r.cm || 0);
    const cant = r.cant || 1;
    if (L <= 0 || cant <= 0) return;
    if (L <= REFUERZO_BARRA_CM) { out.push({ cm: L, cant: cant, area: r.area, nota: '' }); return; }
    const barras = Math.floor(L / REFUERZO_BARRA_CM);
    const recorte = L - barras * REFUERZO_BARRA_CM;
    const tramoTxt = 'tramo ' + (L / 100).toFixed(2) + ' m';
    out.push({ cm: REFUERZO_BARRA_CM, cant: cant * barras, area: r.area, nota: 'unir · ' + tramoTxt });
    if (recorte > 0) out.push({ cm: recorte, cant: cant, area: r.area, nota: 'recorte · unir · ' + tramoTxt });
  });
  return out;
}

function calculateHardware() {
  const c = countPieces();
  const sys = STATE.sistema;
  const reforzado = STATE.modelo === 'REFORZADO' && STATE.refuerzo === 'AUTO';
  const isScudo = STATE.modelo === 'SCUDO';
  const kapOn = STATE.kap === 'SI';

  const hw = [];
  const flags = [];

  // ─── Aliases por fila VERIFICACIÓN!B{n} (col B = SUMIF de cantidades en CAPTURAR) ───
  const B4  = c.PTADER,     B5  = c.PTADERAM;   // PTADER  / PTADER-AM
  const B6  = c.PTAIZQ,     B7  = c.PTAIZQAM;   // PTAIZQ  / PTAIZQ-AM
  const B8  = c.PTBDER,     B9  = c.PTBDERAM;   // PTBDER  (carga en muro der ext)
  const B10 = c.PTCIZQ,     B11 = c.PTCIZQAM;   // PTCIZQ  (carga en muro izq ext)
  const B12 = c.PTCDER,     B13 = c.PTCDERAM;   // PTCDER  (cierra sobre muro der)
  const B14 = c.PTBIZQ,     B15 = c.PTBIZQAM;   // PTBIZQ  (cierra sobre muro izq)
  const B16 = c.PTFDER,     B17 = c.PTFIZQ;     // PTF (cierre a muro, sin ranuras)
  const B18 = c.PNCEN,      B19 = c.PNLAT,    B20 = c.PNUNI;
  const B21 = c.MG120,      B22 = c.MG150;
  const B23 = c.PLCEN,      B24 = c.PLLAT,    B25 = c.PLCOS;
  const B26 = c.PLLATMUR,   B27 = c.PLCOSMUR;
  const B28 = c.PLCENKEML,  B29 = c.PLLATKEML;

  // ═══════════════ PUERTAS — fórmulas R3 de VERIFICACIÓN ═══════════════
  if (c.PT_total > 0) {
    // F3 — D19: tope ovalado, sólo filas 4..11 (NO incluye PTC*/PTBIZQ*/PTF*)
    const D19 = (B4 + B5 + B6 + B7 + B8 + B9 + B10 + B11) * 3;
    if (D19 > 0) hw.push({ code: 'D19', desc: 'Tope ovalado para PT', qty: D19, logic: '3 × (PTADER+PTAIZQ+PTBDER+PTCIZQ y -AM)' });

    // M3 — KCL: cerrojo, todas las PT
    const KCL = B4+B5+B6+B7+B8+B9+B10+B11+B12+B13+B14+B15+B16+B17;
    if (KCL > 0) hw.push({ code: 'KCL', desc: 'Kit de cerrojo Leeder', qty: KCL, logic: '1 × cada PT' });

    // N3 — KGS: gancho normal (PT que NO abren hacia muro)
    const KGS = B4 + B6 + B8 + B10 + B12 + B14;
    if (KGS > 0) hw.push({ code: 'KGS', desc: 'Kit de gancho Leeder', qty: KGS, logic: 'PTADER+PTAIZQ+PTBDER+PTCIZQ+PTCDER+PTBIZQ' });

    // O3 — KGM: gancho a muro (todas las -AM + PTFDER + PTFIZQ)
    const KGM = B5 + B7 + B9 + B11 + B13 + B15 + B16 + B17;
    if (KGM > 0) hw.push({ code: 'KGM', desc: 'Kit de gancho Leeder a muro', qty: KGM, logic: 'todas las -AM + PTFDER + PTFIZQ' });

    // O3b — KGNM: fusión gancho normal + a muro (MXN) = KGS + KGM
    const KGNM = KGS + KGM;
    if (KGNM > 0) hw.push({ code: 'KGNM', desc: 'Kit de gancho Leeder normal + a muro (fusión MXN)', qty: KGNM, logic: 'KGS + KGM' });

    // ─── Bisagras ───
    // H3 — KBDL: bisagra DER Leeder = PTADER + PTADER-AM + PTCDER + PTCDER-AM
    const KBDL = B4 + B5 + B12 + B13;
    if (KBDL > 0) hw.push({ code: 'KBDL', desc: 'Kit de bisagra derecha Leeder', qty: KBDL, logic: 'PTADER+PTADER-AM+PTCDER+PTCDER-AM' });

    // K3 — KBIL: bisagra IZQ Leeder = PTAIZQ + PTAIZQ-AM + PTBIZQ + PTBIZQ-AM
    const KBIL = B6 + B7 + B14 + B15;
    if (KBIL > 0) hw.push({ code: 'KBIL', desc: 'Kit de bisagra izquierda Leeder', qty: KBIL, logic: 'PTAIZQ+PTAIZQ-AM+PTBIZQ+PTBIZQ-AM' });

    // G3 — KBDLM: bisagra DER A MURO = PTBDER + PTBDER-AM + PTFDER
    const KBDLM = B8 + B9 + B16;
    if (KBDLM > 0) hw.push({ code: 'KBDLM', desc: 'Kit de bisagra derecha Leeder a muro', qty: KBDLM, logic: 'PTBDER+PTBDER-AM+PTFDER' });

    // J3 — KBILM: bisagra IZQ A MURO = PTCIZQ + PTCIZQ-AM + PTFIZQ
    const KBILM = B10 + B11 + B17;
    if (KBILM > 0) hw.push({ code: 'KBILM', desc: 'Kit de bisagra izquierda Leeder a muro', qty: KBILM, logic: 'PTCIZQ+PTCIZQ-AM+PTFIZQ' });

    // I3 (en LISTA, fórmula corregida): H58-1 = KBDLM (1 pieza por kit a muro der)
    if (KBDLM > 0) hw.push({ code: 'H58-1', desc: 'Seguro para bisagra de parche derecha (1 pz)', qty: KBDLM, logic: '= KBDLM' });

    // L3 (en LISTA, fórmula corregida): H58-2 = KBILM (1 pieza por kit a muro izq)
    if (KBILM > 0) hw.push({ code: 'H58-2', desc: 'Seguro para bisagra de parche izquierda (1 pz)', qty: KBILM, logic: '= KBILM' });

    // ─── Topes universales superiores a muro ───
    // P3 — KTU6 (etiquetada "izq sup a muro" en planilla): PTCDER + PTCDER-AM + PTFDER
    const KTU6 = B12 + B13 + B16;
    if (KTU6 > 0) hw.push({ code: 'KTU6', desc: 'Kit tope universal izquierdo superior a muro', qty: KTU6, logic: 'PTCDER+PTCDER-AM+PTFDER' });

    // Q3 — KTU5 (etiquetada "der sup a muro"): PTBIZQ + PTBIZQ-AM + PTFIZQ
    const KTU5 = B14 + B15 + B17;
    if (KTU5 > 0) hw.push({ code: 'KTU5', desc: 'Kit tope universal derecho superior a muro', qty: KTU5, logic: 'PTBIZQ+PTBIZQ-AM+PTFIZQ' });

    // ─── Contra topes ───
    // R3 — KCTL: contra tope Leeder = filas 4..11 (PT que no cierran sobre muro)
    const KCTL = B4 + B5 + B6 + B7 + B8 + B9 + B10 + B11;
    if (KCTL > 0) hw.push({ code: 'KCTL', desc: 'Kit de contra tope Leeder', qty: KCTL, logic: 'PTADER/PTAIZQ/PTBDER/PTCIZQ y -AM' });

    // S3 — KCTUM: contra tope univ a muro = filas 12..17
    const KCTUM = B12 + B13 + B14 + B15 + B16 + B17;
    if (KCTUM > 0) hw.push({ code: 'KCTUM', desc: 'Kit de contra tope universal a muro', qty: KCTUM, logic: 'PTCDER/PTBIZQ y -AM, PTFDER/PTFIZQ' });

    // KAP — abrepuertas de pie (selector global)
    if (kapOn && KCL > 0) hw.push({ code: 'KAP', desc: 'Kit de abrepuertas de pie', qty: KCL, logic: 'KAP=SÍ → 1 × #PT' });
  }

  // ═══════════════ PANELES ═══════════════
  // T3 — KUS12M: kit U a muro = PNCEN + PLCOSMUR
  const KUS12M = B18 + B27;
  if (KUS12M > 0 && !isScudo) hw.push({ code: 'KUS12M', desc: 'Kit de U a muro Leeder (3 pz)', qty: KUS12M, logic: 'PNCEN + PLCOSMUR' });

  // U3 — KFLIM: kit F Leeder a muro = PNLAT + PLLATMUR
  const KFLIM = B19 + B26;
  if (KFLIM > 0 && !isScudo) hw.push({ code: 'KFLIM', desc: 'Kit de F Leeder a muro (3 pz)', qty: KFLIM, logic: 'PNLAT + PLLATMUR' });

  // V3 — KTPL: tableta plana = PNUNI
  if (B20 > 0) hw.push({ code: 'KTPL', desc: 'Kit de tableta plana Leeder (6 pz)', qty: B20, logic: 'PNUNI' });

  // ═══════════════ PILASTRAS — kits ═══════════════
  // Y3 — KTL: kit T para panel = PLCEN
  if (B23 > 0 && !isScudo) hw.push({ code: 'KTL', desc: 'Kit de T Leeder para panel (3 pz)', qty: B23, logic: 'PLCEN' });

  // Z3 — KFLIN: kit F Leeder normal = PLLAT + PLCOS
  const KFLIN = B24 + B25;
  if (KFLIN > 0 && !isScudo) hw.push({ code: 'KFLIN', desc: 'Kit de F Leeder normal (3 pz)', qty: KFLIN, logic: 'PLLAT + PLCOS' });

  // Z3b — KFLINM: fusión F normal + a muro (MXN) = KFLIN + KFLIM
  const KFLINM = KFLIN + KFLIM;
  if (KFLINM > 0 && !isScudo) hw.push({ code: 'KFLINM', desc: 'Kit de F Leeder normal + a muro (fusión MXN)', qty: KFLINM, logic: 'KFLIN + KFLIM' });

  // AA3 — KEML: escuadra a muro = PLLATKEML + 2·PLCENKEML
  const KEML = B29 + (B28 * 2);
  if (KEML > 0) hw.push({ code: 'KEML', desc: 'Kit de escuadra universal a muro Leeder', qty: KEML, logic: 'PLLATKEML + 2·PLCENKEML' });

  // ═══════════════ MINGITORIOS ═══════════════
  // W3 — KTL1: kit T 2pz para mingitorio alto 120
  if (B21 > 0) hw.push({ code: 'KTL1', desc: 'Kit de T Leeder 2 pz para mingitorio (alto 120)', qty: B21, logic: '#MG con alto 120' });

  // X3 — KTL2: kit T 3pz para mingitorio alto 150
  if (B22 > 0) hw.push({ code: 'KTL2', desc: 'Kit de T Leeder 3 pz para mingitorio (alto 150)', qty: B22, logic: '#MG con alto 150' });

  // ═══════════════ SISTEMA: PATAS ═══════════════
  // KPLE: pata Leeder. Threshold por ancho de pilastra (LISTA PATA_STD R34):
  //   ancho ≤15 cm → 1 pata; ancho ≥17 cm → 2 patas
  let KPLE = 0;
  if (sys === 'PATAS' && c.pilastras.length > 0) {
    c.pilastras.forEach(p => { KPLE += (p.ancho > 0 && p.ancho <= 15 ? 1 : 2); });
    if (KPLE > 0) hw.push({ code: 'KPLE', desc: 'Pata Leeder', qty: KPLE, logic: 'pilastra ancho ≤15 → 1 · ≥17 → 2' });
  }

  // ═══════════════ SISTEMA: ZOCLO ═══════════════
  // KTA + KPEDL: taquete metálico + pedal. Threshold (LISTA ZOCLO_STD R34):
  //   ancho ≤17 cm → 1; ancho ≥19 cm → 2
  let KTA = 0;
  if (sys === 'ZOCLO' && c.PL_total > 0) {
    c.pilastras.forEach(p => { KTA += (p.ancho > 0 && p.ancho <= 17 ? 1 : 2); });
    const esColgante = (STATE.modeloCod || '').toUpperCase().includes('COLGANTE');
    if (KTA > 0) {
      if (esColgante) {
        // Colgante (colgado del techo, no toca el piso): NO lleva taquete ni pedal; lleva KE10.
        hw.push({ code: 'KE10', desc: 'Kit de esparrago 10 cm (Colgante)', qty: KTA, logic: 'Colgante: reemplaza taquete + pedal' });
      } else {
        hw.push({ code: 'KTA',   desc: 'Taquete metálico (tornillo Allen 6×12)', qty: KTA, logic: 'pilastra ancho ≤17 → 1 · ≥19 → 2' });
        hw.push({ code: 'KPEDL', desc: 'Kit de pedal Leeder',                    qty: KTA, logic: '= KTA' });
      }
    }

    // ZLA{N}: zoclo aluminio por ancho — SUMIF(CAPTURAR!H, ancho, CAPTURAR!L)
    const zoclos = {};
    STATE.pieces.filter(p => p.tipo === 'PL').forEach(p => {
      const a = int(p.ancho); const cant = int(p.cant);
      if (a > 0 && cant > 0) zoclos[a] = (zoclos[a] || 0) + cant;
    });
    Object.keys(zoclos).sort((a, b) => +a - +b).forEach(a => {
      hw.push({ code: `ZLA${a}`, desc: `Zoclo Leeder aluminio ${a} cm`, qty: zoclos[a], logic: `pilastras de ${a} cm` });
    });
  }

  // ═══════════════ REFORZADO (sólo si refuerzo AUTO) ═══════════════
  if (reforzado) {
    const cortesOC = STATE.refuerzoCortes || [];
    if (cortesOC.length > 0) {
      // Datos EXACTOS importados de la OC del Constructor de Planos
      const kitsOC = STATE.refuerzoKits || {};
      const hasKits = !!STATE.refuerzoKits;
      const ke65v = hasKits ? (kitsOC.KE65 || 0) : B19;
      const ke62v = hasKits ? (kitsOC.KE62 || 0) : (B19 + B26);
      if (ke65v > 0) hw.push({ code: 'KE65', desc: 'Kit escuadra plana para ángulo 90° (1 pz)', qty: ke65v, logic: hasKits ? 'OC Constructor — esquinas 90°' : 'PNLAT (heurística manual)' });
      if (ke62v > 0) hw.push({ code: 'KE62', desc: 'Kit escuadra refuerzo-muro aluminio (1 pz)', qty: ke62v, logic: hasKits ? 'OC Constructor — extremos a muro' : 'PNLAT + PLLATMUR (heurística manual)' });

      const T7oc = (sys === 'PATAS') ? KPLE : KTA;
      if (T7oc > 0) hw.push({ code: 'T7', desc: 'Tornillo Allen cabeza botón acero 6×12 (REFORZADO)', qty: T7oc, logic: sys === 'PATAS' ? '= KPLE' : '= KTA' });

      const totalMlOC = Math.round(cortesOC.reduce((s, r) => s + r.cm * r.cant, 0)) / 100;
      hw.push({ code: '1918-610', desc: 'Refuerzo de aluminio (ml)', qty: totalMlOC.toFixed(2), logic: '∑ cortes OC Constructor' });
    } else {
      // Sin OC del Constructor: heurística por conteo de piezas
      // AB3 — KE65: escuadra plana ángulo 90° = PNLAT
      if (B19 > 0) hw.push({ code: 'KE65', desc: 'Kit escuadra plana para ángulo 90° (1 pz)', qty: B19, logic: 'PNLAT (REFORZADO)' });

      // AC3 — KE62: escuadra refuerzo-muro = PNLAT + PLLATMUR
      const KE62 = B19 + B26;
      if (KE62 > 0) hw.push({ code: 'KE62', desc: 'Kit escuadra refuerzo-muro aluminio (1 pz)', qty: KE62, logic: 'PNLAT + PLLATMUR (REFORZADO)' });

      // T7: tornillo Allen REFORZADO = KPLE (PATAS) o KTA (ZOCLO)
      const T7 = (sys === 'PATAS') ? KPLE : KTA;
      if (T7 > 0) hw.push({ code: 'T7', desc: 'Tornillo Allen cabeza botón acero 6×12 (REFORZADO)', qty: T7, logic: sys === 'PATAS' ? '= KPLE' : '= KTA' });

      // 1918-610: refuerzo aluminio en ml — depende del despiece, manual
      if (B18 > 0 || B19 > 0) {
        hw.push({ code: '1918-610', desc: 'Refuerzo de aluminio (ml)', qty: 'manual', logic: '∑ cortes — calcular según despiece', flag: true });
        flags.push({ kind: 'warn', msg: 'Refuerzo 1918-610: el ml exacto depende del despiece de cortes. Cargar a mano según planilla.' });
      } else {
        flags.push({ kind: 'note', msg: 'Modelo REFORZADO sin PNCEN/PNLAT: 1918-610 puede ser 0 (caso "sólo pilastras"). Verificá con el cliente.' });
      }
    }
  }

  // ─── Herrajes extra importados de la OC (grabados, kits adicionales, etc.) ───
  (STATE.herrajesExtraOC || []).forEach(h => {
    hw.push({ code: h.codigo, desc: 'Herraje extra (OC Constructor)', qty: h.cant, logic: 'importado de la OC' });
  });

  // ─── SCUDO: herraje propio (perfil U + torpines + tabletas) ───
  // Fórmulas validadas contra el checklist de producción "CHEKLIST ESCUDO":
  //   KTPL = ceil(4·antepechos/6) + PNUNI (el PNUNI ya se empujó arriba)
  //   T18 = F59 = 4·(PNCEN+PNLAT+PNUNI+PLLATMUR+PLCOSMUR)
  //   T74 = T68 = 4·(PNCEN+PNLAT+PNUNI+PLCEN+2·PLLAT+PLCOS+PLLATMUR+PLCOSMUR)
  //   T7  = (KTA ó KPLE, según sistema) + 4·(PLCEN+2·PLLAT+PLCOS) + 16·antepechos
  //   104-610 (perfil U): metraje del plano — manual/desde Constructor
  if (isScudo) {
    const nAntep = (STATE.antepechos || []).reduce((s, ap) => s + int(ap.cant), 0);
    const ktplAp = Math.ceil(nAntep * 4 / 6);
    if (ktplAp > 0) {
      const ktplRow = hw.find(h => h.code === 'KTPL');
      if (ktplRow) {
        ktplRow.qty = (parseFloat(ktplRow.qty) || 0) + ktplAp;
        ktplRow.logic += ` + antepechos (4×${nAntep}÷6=${ktplAp})`;
      } else {
        hw.push({ code: 'KTPL', desc: 'Kit de tableta plana Leeder (6 pz) — antepecho', qty: ktplAp, logic: `4 tabletas × ${nAntep} antepecho ÷ 6` });
      }
    }
    const t18 = (c.PNCEN + c.PNLAT + c.PNUNI + c.PLLATMUR + c.PLCOSMUR) * 4;
    if (t18 > 0) {
      hw.push({ code: 'T18', desc: 'Pija PH fijadora 14x2 (perfil U a muro)', qty: t18, logic: '4 × (PNCEN+PNLAT+PNUNI+PLLATMUR+PLCOSMUR)' });
      hw.push({ code: 'F59', desc: 'Taquete plástico 5/16" (perfil U a muro)', qty: t18, logic: '= T18' });
    }
    const t74 = (c.PNCEN + c.PNLAT + c.PNUNI + c.PLCEN + (c.PLLAT * 2) + c.PLCOS + c.PLLATMUR + c.PLCOSMUR) * 4;
    if (t74 > 0) {
      hw.push({ code: 'T74', desc: 'Tornillo torpín hembra (abraza perfil U con PN/PL)', qty: t74, logic: '4 × (PN + PL, PLLAT×2)' });
      hw.push({ code: 'T68', desc: 'Tornillo torpín macho', qty: t74, logic: '= T74' });
    }
    const t7base = (sys === 'PATAS') ? KPLE : KTA;
    const t7 = t7base + (c.PLCEN + (c.PLLAT * 2) + c.PLCOS) * 4 + nAntep * 16;
    if (t7 > 0) hw.push({ code: 'T7', desc: 'Tornillo Allen cabeza botón acero 6×12', qty: t7, logic: `${sys === 'PATAS' ? 'KPLE' : 'KTA'} + 4×(PLCEN+2PLLAT+PLCOS) + 16×antepecho` });
    // 104-610 perfil U: se muestra como CORTES (uno por medida) en su propia sección, no como total lumped en herrajes.
    const cortesPU = STATE.perfilUCortes || [];
    if (cortesPU.length === 0) {
      flags.push({ kind: 'warn', msg: 'SCUDO: el PERFIL U de aluminio (104-610) no vino en la OC. Cargá los cortes a mano (o regenerá el CSV desde el Constructor). El resto del herraje ya está calculado.' });
    }
  }

  // ─── IMPERIAL: tubing ornamental (refuerzo de panel a panel) ───
  // Herraje base = ESTÁNDAR; extra: T00021 (ml, recorrido+10 por área, desde la OC del
  // Constructor), KSCL (1 × PN central), KSL (1 × PN lateral), KCHL (1 × extremo a muro).
  const cortesTb = STATE.tubingCortes || [];
  if (cortesTb.length > 0) {
    const mlTb = Math.round(cortesTb.reduce((s, r) => s + r.cm * r.cant, 0)) / 100;
    hw.push({ code: 'T00021', desc: 'Tubing ornamental (ml) — refuerzo sobre PN', qty: mlTb.toFixed(2), logic: '∑ recorridos (claro+10) OC Constructor' });
    const kitsTb = STATE.tubingKits || {};
    if (kitsTb.KCHL > 0) hw.push({ code: 'KCHL', desc: 'Kit de chapetón para refuerzo (1 pz) — une tubo con muro', qty: kitsTb.KCHL, logic: 'OC Constructor — extremos a muro' });
    if (B18 > 0) hw.push({ code: 'KSCL', desc: 'Kit de soporte central panel para refuerzo (1 pz)', qty: B18, logic: '1 × PNCEN' });
    if (B19 > 0) hw.push({ code: 'KSL', desc: 'Kit de soporte ciego para panel (1 pz)', qty: B19, logic: '1 × PNLAT' });
  }

  if (STATE.modelo === 'REFORZADO' && STATE.refuerzo === 'OFF') {
    flags.push({ kind: 'note', msg: 'Modelo REFORZADO con refuerzo OFF: 1918-610, KE62, KE65, T7 = 0 (cliente no envía refuerzo).' });
  }

  // ─── Flag OC adicional ───
  if (STATE.ocAdicional) {
    flags.push({ kind: 'note', msg: 'OC ADICIONAL/SUPLEMENTARIA: materiales generales se heredan del EXP padre' + (STATE.expPadre ? ' (' + STATE.expPadre + ')' : '') + '.' });
  }

  // ─── Etiquetas F35 (letras negras) / F36 (letras blancas): 1 por área, según el color de la PILASTRA ───
  const etq = STATE.etiquetasArea || {};
  let nF35 = 0, nF36 = 0;
  Object.keys(etq).forEach(area => {
    const nv = lookupColor(etq[area]).nuevo;
    if (nv === 'NEGRO' || nv === 'NOGAL GRAFITO') nF36++; else nF35++;
  });
  if (nF35 > 0) hw.push({ code: 'F35', desc: 'Etiqueta (letras negras)', qty: nF35, logic: '1 por área · pilastra clara' });
  if (nF36 > 0) hw.push({ code: 'F36', desc: 'Etiqueta (letras blancas)', qty: nF36, logic: '1 por área · pilastra NEGRO/Skyline' });

  return { hw, flags };
}

// ════════════════════════════════════════════════════════════════════
//   MATERIALS / PESO / M²
// ════════════════════════════════════════════════════════════════════
function calculateMaterials() {
  const c = countPieces();
  const colorInfo = lookupColor(STATE.color);
  const totalPiezas = c.PT_total + c.PN_total + c.PL_total + c.MG_total;

  let m2 = 0;
  STATE.pieces.forEach(p => {
    const a = num(p.ancho) / 100;
    const h = num(p.alto)  / 100;
    const cant = int(p.cant);
    if (a > 0 && h > 0 && cant > 0) m2 += a * h * cant;
  });
  // Antepechos SCUDO (laminado, no van en STATE.pieces): sumar su m²
  (STATE.antepechos || []).forEach(ap => {
    const a = num(ap.ancho) / 100, h = num(ap.alto) / 100, cant = int(ap.cant);
    if (a > 0 && h > 0 && cant > 0) m2 += a * h * cant;
  });

  // M² LAMINADO = N° de hojas × superficie de cada hoja completa.
  // Esta es la fórmula REAL de la planilla DIBUJO CORTE!J4 (S00033 corregido):
  //   5×12 (366×152) → 5.56 m² · 4×10 (305×122) → 3.7 m² · 4×8 (244×122) → 2.97 m²
  // El laminado se da de baja por HOJA COMPLETA al cortar, no por el área útil.
  //
  // El FORMATO de hoja se toma del DROPDOWN "Hoja de sólido" en la pestaña Dibujo de Corte.
  // Cuando el usuario setea el color, el dropdown se sincroniza al formato oficial del color
  // (5×12 / 4×10 / 4×8 según el sufijo del code) como SUGERENCIA inicial, pero el usuario
  // puede cambiarlo libremente en esa pestaña y el cálculo de m² sigue lo elegido.
  // M² útil por color (piezas + antepechos) — base para el estimado y para ordenar.
  const colorDePz = x => (x && x.color && String(x.color).trim()) || STATE.color || '';
  const m2PorColor = {};
  STATE.pieces.forEach(p => {
    const a = num(p.ancho) / 100, h = num(p.alto) / 100, cant = int(p.cant);
    if (a > 0 && h > 0 && cant > 0) { const k = colorDePz(p); m2PorColor[k] = (m2PorColor[k] || 0) + a * h * cant; }
  });
  (STATE.antepechos || []).forEach(ap => {
    const a = num(ap.ancho) / 100, h = num(ap.alto) / 100, cant = int(ap.cant);
    if (a > 0 && h > 0 && cant > 0) { const k = colorDePz(ap); m2PorColor[k] = (m2PorColor[k] || 0) + a * h * cant; }
  });
  const coloresUsados = Object.keys(m2PorColor).filter(k => k);

  // M² LAMINADO REAL por color = suma de áreas de hoja de ESE color (empaque por color).
  // El laminado se da de baja por HOJA COMPLETA al cortar. Con 1 color = igual que antes.
  const m2LamPorColor = {}; // color -> m² de hojas
  const hojasPorColor = {}; // color -> { "W×H": nHojas }
  try {
    const cutPieces = buildCutPieces();
    if (cutPieces.length > 0) {
      const gap = cutGap();
      const r = STATE.cutManual.enabled ? packSheetsManual(cutPieces, gap) : packAllColors(cutPieces, gap);
      (r.sheets || []).forEach(sh => {
        const k = sh.lamColor || STATE.color || '';
        m2LamPorColor[k] = (m2LamPorColor[k] || 0) + (sh.W * sh.H) / 10000;
        const mixKey = `${Math.round(sh.W)}×${Math.round(sh.H)}`;
        hojasPorColor[k] = hojasPorColor[k] || {};
        hojasPorColor[k][mixKey] = (hojasPorColor[k][mixKey] || 0) + 1;
      });
    }
  } catch (err) { console.warn('Fallback m² laminado:', err); }
  // Fallback: colores sin hojas (packing vacío) → estimar m² útil × 1.10
  coloresUsados.forEach(k => { if (m2LamPorColor[k] == null && m2PorColor[k] > 0) m2LamPorColor[k] = +(m2PorColor[k] * 1.10).toFixed(2); });
  if (!Object.keys(m2LamPorColor).length && m2 > 0) m2LamPorColor[STATE.color || ''] = +(m2 * 1.10).toFixed(2);
  const m2Lam = +Object.values(m2LamPorColor).reduce((s, v) => s + v, 0).toFixed(2);

  // Peso por m²: factores validados contra checklists oficiales de fábrica.
  //   STD + PATAS: 18.5 · REF + ZOCLO: 20.0 · otros: 18.0
  let factorPeso;
  if (STATE.modelo === 'REFORZADO' && STATE.sistema === 'ZOCLO') factorPeso = 20.0;
  else if (STATE.modelo === 'ESTÁNDAR' && STATE.sistema === 'PATAS') factorPeso = 18.5;
  else factorPeso = 18.0;
  const peso = +(m2 * factorPeso).toFixed(1);

  // ─── Una línea de laminado POR CÓDIGO (color × tamaño). Cada tamaño = un código y su m². ───
  const mat = [];
  const manualTxt = STATE.cutManual.enabled ? ' · MANUAL' : '';
  Object.keys(m2LamPorColor)
    .sort((a, b) => (m2PorColor[b] || 0) - (m2PorColor[a] || 0))
    .forEach(cName => {
      if (!cName) return;
      const ci = lookupColor(cName);
      const nuevoTxt = ci.codigoNuevo ? '  ·  ' + ci.codigoNuevo : '';
      const premium = !!(STATE.premiumPorColor && STATE.premiumPorColor[cName]);
      const hojas = hojasPorColor[cName] || {};
      const whKeys = Object.keys(hojas);
      if (whKeys.length) {
        whKeys.sort((x, y) => hojas[y] - hojas[x]).forEach(wh => {
          const nH = hojas[wh];
          const fmt = FMT_POR_WH[wh] || null;
          const m2s = +(fmt && SHEET_FORMATS[fmt] ? nH * SHEET_FORMATS[fmt].m2 : (m2LamPorColor[cName] || 0)).toFixed(2);
          const fmtLbl = fmt ? (FMT_LABEL[fmt] || fmt) : wh;
          const code = fmt ? codigoInternoTamano(cName, fmt, premium) : '';
          const logic = `${nH}× hoja ${wh}cm${manualTxt}`;
          if (code) {
            mat.push({ code: code, desc: `Laminado compacto · ${cName} ${fmtLbl}${nuevoTxt}`, qty: m2s.toFixed(2) + ' m²', logic });
          } else {
            mat.push({ code: '— pendiente —', desc: `${cName} ${fmtLbl} no está en catálogo`, qty: m2s.toFixed(2) + ' m²', logic: 'hoja · ⚠ código', flag: true });
          }
        });
      } else {
        const m2LamC = +(m2LamPorColor[cName] || 0).toFixed(2);
        const fmtDef = formatosDeColor(cName)[0] || '5x12';
        const code = codigoInternoTamano(cName, fmtDef, premium);
        const logic = `${(m2PorColor[cName] || 0).toFixed(2)} m² × 1.10 (estimado)${manualTxt}`;
        if (code) mat.push({ code: code, desc: `Laminado compacto · ${cName} ${FMT_LABEL[fmtDef] || fmtDef}${nuevoTxt}`, qty: m2LamC.toFixed(2) + ' m²', logic });
        else mat.push({ code: '— pendiente —', desc: `Color "${cName}" no está en catálogo`, qty: m2LamC.toFixed(2) + ' m²', logic: 'hojas · ⚠ código', flag: true });
      }
    });

  return { mat, m2: m2.toFixed(2), m2Lam: m2Lam.toFixed(2), peso, multicolor: coloresUsados.length > 1 };
}

// ════════════════════════════════════════════════════════════════════
//   RENDERING
// ════════════════════════════════════════════════════════════════════
function renderAll() {
  renderTopbar();
  renderVerificationList();
  renderKPI();
  renderMaterialsList();
  renderCut();
  renderValidation();
  renderChecklistName();
}

function renderTopbar() {
  $('exp-display').textContent = STATE.exp || '—';
  const term = STATE.sistema === 'PATAS' ? 'PATA' : 'ZOCLO';
  const mod  = STATE.modelo === 'ESTÁNDAR' ? 'STD' :
               STATE.modelo === 'REFORZADO' ? 'REF' : 'REG';
  $('system-display').textContent = `${mod} · ${term}`;
}

function renderChecklistName() {
  const term = STATE.sistema === 'PATAS' ? 'PATA' : 'ZOCLO';
  $('checklist-name').textContent = `CHECKLIST_${term}_CR.xlsm`;
}

// ─── Construye la tabla de verificación (stepper rows) ───
// Muestra UNA FILA POR (código + ancho + alto) único, como el checklist real.
// Si una pieza tiene múltiples medidas (ej: 3 PLLATMUR con anchos 10/12/17),
// aparecen 3 filas separadas. También muestra cada código del catálogo aunque esté en 0
// para permitir agregar piezas manualmente.
function renderVerificationList() {
  const root = $('vlist');
  const grupos = ['PUERTAS', 'PANELES', 'MINGITORIOS', 'PILASTRAS'];

  const areaAct = STATE.areaActual || 'Área 1';
  const areasCount = {};
  STATE.pieces.forEach(p => { if (int(p.cant) > 0) { const a = p.area || 'Área 1'; areasCount[a] = (areasCount[a] || 0) + int(p.cant); } });
  const areasPresentes = Object.keys(areasCount);
  const chipAreas = [];
  (STATE.areasManual || []).forEach(a => { if (!chipAreas.includes(a)) chipAreas.push(a); });
  areasPresentes.forEach(a => { if (!chipAreas.includes(a)) chipAreas.push(a); });
  if (!chipAreas.includes(areaAct)) chipAreas.push(areaAct);
  if (!chipAreas.length) chipAreas.push('Área 1');
  const chipsEl = document.getElementById('area-chips');
  if (chipsEl) chipsEl.innerHTML = chipAreas.map(a => {
    const act = a === areaAct;
    const esc = String(a).replace(/"/g, '&quot;');
    const borde = act ? '#16a34a' : '#3a4252';
    const bg = act ? '#16a34a' : 'transparent';
    const col = act ? '#fff' : 'var(--text-soft,#9aa4b2)';
    return `<span class="area-chip" style="display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 12px;border-radius:14px;border:1px solid ${borde};background:${bg};">`
      + `<span class="area-chip-sel" data-area="${esc}" style="cursor:pointer;color:${col};font-weight:${act ? '700' : '400'};font-size:12px;">${a} (${areasCount[a] || 0})</span>`
      + `<span class="area-chip-del" data-area="${esc}" title="Eliminar área" style="cursor:pointer;color:${col};opacity:.75;font-weight:700;font-size:13px;line-height:1;">×</span>`
      + `</span>`;
  }).join('');
  const faEl = document.getElementById('f-area');
  if (faEl && document.activeElement !== faEl) faEl.value = areaAct;

  // Pre-agrupar STATE.pieces del área actual por (código + ancho + alto) sumando cantidades
  const byKey = new Map();   // 'CODE|ANCHO|ALTO' → { code, ancho, alto, cant, id }
  STATE.pieces.forEach(p => {
    const cod = (p.codigo || '').toUpperCase();
    const ancho = int(p.ancho);
    const alto  = int(p.alto);
    const cant  = int(p.cant);
    if (!cod || !cant) return;
    if ((p.area || 'Área 1') !== areaAct) return;
    const key = `${cod}|${ancho}|${alto}`;
    if (!byKey.has(key)) byKey.set(key, { code: cod, ancho, alto, cant: 0, id: p.id });
    byKey.get(key).cant += cant;
  });

  // Indexar por código → array de filas (medidas distintas)
  const rowsByCode = new Map();
  byKey.forEach(v => {
    if (!rowsByCode.has(v.code)) rowsByCode.set(v.code, []);
    rowsByCode.get(v.code).push(v);
  });

  let html = '';

  grupos.forEach(grp => {
    const cls = grp.toLowerCase();
    html += `<div class="vgroup-head ${cls}">${grp}</div>`;

    CODES[grp].forEach(it => {
      const grpClass = grp === 'MINGITORIOS' ? 'orange-code' :
                       grp === 'PILASTRAS' ? 'green-code' :
                       grp === 'PANELES' ? 'magenta-code' : 'cyan-code';
      const colorVar = grp === 'MINGITORIOS' ? 'var(--orange)' :
                       grp === 'PILASTRAS' ? 'var(--green)' :
                       grp === 'PANELES' ? 'var(--magenta)' : '';

      const filas = rowsByCode.get(it.code);

      // Determinar el alto por defecto según la familia + modelo + sistema
      const altoDefault = (() => {
        if (grp === 'PUERTAS')     return 150;
        if (grp === 'PANELES')     return 150;
        if (grp === 'MINGITORIOS') return 120;
        if (grp === 'PILASTRAS') {
          if (STATE.modelo === 'REFORZADO' && STATE.sistema === 'ZOCLO') return 210;
          if (STATE.modelo === 'REFORZADO' && STATE.sistema === 'PATAS') return 200;
          if (STATE.sistema === 'ZOCLO') return 180;
          return 170;
        }
        return 150;
      })();

      if (!filas || filas.length === 0) {
        // Código sin piezas: una fila vacía con stepper para agregar manualmente
        html += `
          <div class="vrow" data-code="${it.code}" data-ancho="" data-alto="">
            <div class="v-qty">—</div>
            <div class="v-code ${grpClass}" style="color: ${colorVar}">${it.code}</div>
            <div class="v-desc">${it.desc.toUpperCase()}</div>
            <div class="v-dims">
              <input type="number" placeholder="A" data-dim="ancho" data-code="${it.code}" data-row-ancho="" data-row-alto="" value="" title="Ancho cm">
              <span class="v-dims-x">×</span>
              <input type="number" placeholder="H" data-dim="alto" data-code="${it.code}" data-row-ancho="" data-row-alto="" value="" title="Alto cm">
            </div>
            <div class="v-stepper">
              <button class="stepper-btn minus" data-step="-1" data-code="${it.code}" data-row-ancho="" data-row-alto="">−</button>
              <span class="stepper-val">0</span>
              <button class="stepper-btn plus" data-step="1" data-code="${it.code}" data-row-ancho="" data-row-alto="">+</button>
            </div>
            <div class="v-action"></div>
          </div>`;
      } else {
        // Una fila por cada medida única
        filas.forEach(f => {
          html += `
            <div class="vrow has-qty" data-code="${it.code}" data-ancho="${f.ancho}" data-alto="${f.alto}">
              <div class="v-qty">${f.cant}</div>
              <div class="v-code ${grpClass}" style="color: ${colorVar}">${it.code}</div>
              <div class="v-desc">${it.desc.toUpperCase()}</div>
              <div class="v-dims">
                <input type="number" placeholder="A" data-dim="ancho" data-code="${it.code}" data-row-id="${f.id}" data-row-ancho="${f.ancho}" data-row-alto="${f.alto}" value="${f.ancho}" title="Ancho cm">
                <span class="v-dims-x">×</span>
                <input type="number" placeholder="H" data-dim="alto" data-code="${it.code}" data-row-id="${f.id}" data-row-ancho="${f.ancho}" data-row-alto="${f.alto}" value="${f.alto}" title="Alto cm">
              </div>
              <div class="v-stepper">
                <button class="stepper-btn minus" data-step="-1" data-code="${it.code}" data-row-id="${f.id}" data-row-ancho="${f.ancho}" data-row-alto="${f.alto}">−</button>
                <span class="stepper-val">${f.cant}</span>
                <button class="stepper-btn plus" data-step="1" data-code="${it.code}" data-row-id="${f.id}" data-row-ancho="${f.ancho}" data-row-alto="${f.alto}">+</button>
              </div>
              <div class="v-action">
                <button class="vrow-del" data-code="${it.code}" data-row-id="${f.id}" data-row-ancho="${f.ancho}" data-row-alto="${f.alto}" title="Eliminar esta medida">×</button>
              </div>
            </div>`;
        });
      }

      // Botón "+ Otra medida" al final de cada código (siempre, independientemente de si tiene filas o no)
      html += `
        <div class="vrow-add">
          <button class="btn-add-medida" data-code="${it.code}" data-alto-default="${altoDefault}" title="Agregar otra medida para ${it.code}">
            + otra medida ${it.code}
          </button>
        </div>`;
    });
  });

  // ─── ANTEPECHOS (SCUDO): se listan como una pieza más, desde la OC del Constructor ───
  const antepVer = STATE.antepechos || [];
  if (antepVer.length) {
    html += `<div class="vgroup-head antepechos" style="color: var(--amber);">ANTEPECHOS</div>`;
    const apByKey = new Map();
    antepVer.forEach(ap => {
      const ancho = int(ap.ancho), alto = ap.alto, cant = int(ap.cant);
      const key = ancho + '|' + alto;
      if (!apByKey.has(key)) apByKey.set(key, { ancho, alto, cant: 0 });
      apByKey.get(key).cant += cant;
    });
    apByKey.forEach(f => {
      html += `
        <div class="vrow has-qty" data-code="AN${Math.round(f.alto)}" data-ancho="${f.ancho}" data-alto="${f.alto}">
          <div class="v-qty">${f.cant}</div>
          <div class="v-code" style="color: var(--amber);">AN${Math.round(f.alto)}</div>
          <div class="v-desc">ANTEPECHO ${f.ancho} × ${f.alto} CM</div>
          <div class="v-dims">${f.ancho} × ${f.alto}</div>
          <div class="v-stepper"></div>
          <div class="v-action"></div>
        </div>`;
    });
  }

  // Total general
  const c = countPieces();
  const nAntepVer = antepVer.reduce((s, ap) => s + int(ap.cant), 0);
  const total = c.PT_total + c.PN_total + c.PL_total + c.MG_total + nAntepVer;
  html += `<div class="vgroup-head total">TOTAL</div>`;
  html += `
    <div class="vrow has-qty" style="grid-template-columns: 32px 130px 1fr;">
      <div class="v-qty" style="color: var(--green);">${total}</div>
      <div class="v-code" style="color: var(--amber);">TOTAL PIEZAS</div>
      <div class="v-desc">SUMA DE TODAS LAS PIEZAS</div>
    </div>
  `;
  root.innerHTML = html;
}

function renderKPI() {
  const c = countPieces();
  const nAntep = (STATE.antepechos || []).reduce((s, ap) => s + int(ap.cant), 0);
  const total = c.PT_total + c.PN_total + c.PL_total + c.MG_total + nAntep;
  const { m2, peso } = materialsAuto();

  // KPIs en pestaña Verificación
  if ($('kpi-piezas')) $('kpi-piezas').textContent = total;
  if ($('kpi-m2'))     $('kpi-m2').textContent     = m2;
  if ($('kpi-peso'))   $('kpi-peso').textContent   = peso.toFixed ? peso.toFixed(1) : peso;

  // Auto en CAPTURAR — siempre se recalcula desde STATE.pieces
  $('f-m2').value   = m2 + ' m²';
  $('f-peso').value = (peso.toFixed ? peso.toFixed(1) : peso) + ' kg';
}

// ─── Lista de materiales (tab 04) ───
// ════════════════════════════════════════════════════════════════════
//   SUPERIOR 2.0 — motor propio (materia prima desde cero)
//   El acabado es POR PROYECTO: SÓLIDO (laminado compacto / colores) usa la
//   hoja SOLIDOS y zoclo ZDESPECIAL; LÁMINA (Esmaltada + Acero) usa la hoja
//   LAMINAS y zoclo ZDLESPECIAL. Los códigos EST no se cuentan (todo desde cero).
// ════════════════════════════════════════════════════════════════════
function esSuperiorCIP() {
  return String(STATE.linea || '').toUpperCase().includes('SUPERIOR');
}
function esTouchlessCIP() {
  return String(STATE.linea || '').toUpperCase().includes('TOUCHLESS');
}
// 'SOLIDO' = Laminado Compacto (colores) | 'LAMINA' = Esmaltada + Acero
function acabadoSuperiorTipo() {
  const a = String(STATE.acabado || '').toUpperCase();
  if (a.includes('ESMALT') || a.includes('ACERO') || a.includes('ANTIGRAF') || a.includes('INOX')) return 'LAMINA';
  return 'SOLIDO';
}

// ZOCLOS Superior: 1 por PILASTRA (puertas / paneles / mingitorios NO llevan zoclo).
// La MEDIDA = ancho de la pilastra. El código depende de si hay puerta > 180:
//   • Puerta ≤ 180 (normal) → códigos del checklist: ZD<ancho> (sólido) / ZDL<ancho> (lámina).
//   • Puerta > 180 → zoclo plano ESPECIAL: ZDESPECIAL (sólido) / ZDLESPECIAL (lámina), medida aparte.
// Pedal / Taquete / Pija (KPE / KTA / T22) = Σ pilastras × (1 si ancho ≤ 15, 2 si ancho ≥ 17).
function zoclosSuperior() {
  const c = countPieces();
  const esLamina = acabadoSuperiorTipo() === 'LAMINA';
  const maxAltoPT = STATE.pieces.reduce((m, p) => (p.tipo === 'PT' ? Math.max(m, num(p.alto)) : m), 0);
  const especial = maxAltoPT > 180;
  const porAncho = {};
  c.pilastras.forEach(p => { const w = Math.round(num(p.ancho)); if (w > 0) porAncho[w] = (porAncho[w] || 0) + 1; });
  const anchos = Object.keys(porAncho).map(Number).sort((a, b) => a - b);
  const rows = [];
  let pedal = 0;
  anchos.forEach(w => {
    const n = porAncho[w];
    let code, desc;
    if (especial) {
      code = esLamina ? 'ZDLESPECIAL' : 'ZDESPECIAL';
      desc = `ZOCLO MEDIDA ESPECIAL SUPERIOR 2.0 ${esLamina ? 'LÁMINA' : 'HPL'} ${w} CM`;
    } else {
      code = (esLamina ? 'ZDL' : 'ZD') + w;
      desc = `ZOCLO ${w}`;
    }
    rows.push({ code, desc, qty: n, logic: `${n} pilastra(s) × ${w} cm${especial ? ' · puerta >180 (plano)' : ''}` });
    pedal += n * (w <= 15 ? 1 : 2);
  });
  return { rows, pedal, anchos, porAncho, especial };
}

// Bastidor 601 — metros por PILASTRA. Tabla 'S. E. - L. P.' (BOOM-SAP SUPERIOR), extraída del
// caché del MATERIALES. Es la MISMA para Sólido y Lámina (ambos acabados usan esta tabla;
// solo cambian los códigos de perfil/tapón). ancho → [STD (180, Estándar), REF (210, Reforzado)].
const SUP_601_PILASTRA = {
  10:[3.717,4.347], 12:[3.822,4.452], 15:[3.9795,4.6095], 17:[4.0845,4.7145],
  19:[4.1895,4.8195], 24:[4.452,5.082], 30:[4.767,5.397], 35:[5.0295,5.6595],
  40:[5.292,5.922], 45:[5.5545,6.1845], 50:[5.817,6.447], 55:[6.08,6.71],
  60:[6.342,6.972], 85:[7.6545,8.2845], 90:[7.917,8.547], 95:[8.18,8.81],
  100:[8.442,9.072], 120:[9.492,10.122]
};

// Perfil LISO 602/604 — fracción de barra (5.80 m) por PILASTRA (col5 PERFILES, igual STD/REF).
const SUP_602_LISO = {
  10:0.016393, 12:0.019672, 15:0.024590, 17:0.027869, 19:0.031148, 24:0.039344,
  30:0.049180, 35:0.057377, 40:0.065574, 45:0.073770, 50:0.081967, 55:0.090164,
  60:0.098361, 85:0.139344, 90:0.147541, 95:0.155738, 100:0.163934, 120:0.196721
};
// Relleno 600 por pieza (solo acabado SÓLIDO; Lámina usa núcleo EPS-22 en su lugar).
// Pilastra por banda de ancho: ≤35→0, 40–60→1(STD)/3(REF), ≥70→2(STD)/6(REF).
function rellenoPilastra(w, ref) {
  if (w <= 35) return 0;
  if (w <= 60) return ref ? 3 : 1;
  return ref ? 6 : 2;
}
function rellenoPuerta(w) { return w >= 85 ? 4 : 2; }   // 55/60 → 2 ; 85/90/100 → 4
function rellenoPanel(w) { return w >= 135 ? 6 : 4; }   // 100/120 → 4 ; 135/150/180 → 6

// Bastidor 601 (metros por pieza) — PUERTA (2 comp: rieles + verticales), PANEL, MINGITORIO.
// Clave = "anchoxalto". Tabla S. E. - L. P. (BOOM-SAP), igual Sólido/Lámina.
const SUP_601_PUERTA = {
  '55x150':[1.4994,3.6885], '60x150':[1.4994,3.8985], '85x150':[1.4994,4.9485], '90x150':[1.4994,5.1585], '100x150':[1.4994,5.5785],
  '55x180':[1.8144,4.0035], '60x180':[1.8144,4.2135], '85x180':[1.8144,5.2635], '90x180':[1.8144,5.4735], '100x180':[1.8144,5.8935]
};
const SUP_601_PANEL = {
  '100x150':6.0459, '120x150':6.6759, '135x150':7.1484, '150x150':7.6209, '180x150':8.5659,
  '100x180':6.6759, '120x180':7.3059, '135x180':7.7784, '150x180':8.2509, '180x180':9.1959
};
const SUP_601_MINGIT = { '45x120':4.6137, '60x150':6.0312 };

// Perfil LISO — fracción de barra 5.80 m por pieza (col PERFILES). Puerta/mingit por ancho; panel por "anchoxalto".
const SUP_LISO_PUERTA = { 55:0.180328, 60:0.196721, 85:0.278689, 90:0.295082, 100:0.327869 };
const SUP_LISO_PANEL = {
  '100x150':0.819672, '120x150':0.885246, '135x150':0.934426, '150x150':0.983607, '180x150':1.081967,
  '100x180':0.918033, '120x180':0.983607, '135x180':1.032787, '150x180':1.081967, '180x180':1.180328
};
const SUP_LISO_MINGIT = { '45x120':0.540984, '60x150':0.688525 };

// ESTRUCTURA Superior (materia prima desde cero, TODAS las piezas). Validado vs EXP real 24283.
// Códigos por acabado: Sólido → 603/602/D31/D29 ; Lámina → 605/604/D30/D27.
// Consolidación de perfiles en tramos de 5.80 m: c/bloqueo = ⌈(2·puertas+2·pilastras)/3⌉ (3 cortes/barra);
// liso = ⌈Σ fracción_liso·cant⌉. Tapón puerta c/tope = 4·puertas; tapón normal = 2·pil+4·panel+4·mingit.
// PENDIENTE: relleno de puerta/panel/mingit, T113/T115, tuerca, remaches, EPS núcleo, cara 3mm.
function estructuraSuperior() {
  const rows = [];
  const reforzado = STATE.modelo === 'REFORZADO';
  const esLamina = acabadoSuperiorTipo() === 'LAMINA';
  const cBloq = esLamina ? '605' : '603';
  const cLiso = esLamina ? '604' : '602';
  const cTaponP = esLamina ? 'D27' : 'D29';   // puerta (con tope)
  const cTaponN = esLamina ? 'D30' : 'D31';   // normal (pilastra/panel/mingitorio)
  let bastidorM = 0, lisoU = 0, rellenoT = 0, areaM2 = 0;
  let nPuerta = 0, nPilastra = 0, nPanel = 0, nMingit = 0, nTotal = 0;
  STATE.pieces.forEach(p => {
    const w = Math.round(num(p.ancho)), h = Math.round(num(p.alto)), key = w + 'x' + h, n = int(p.cant);
    if (n <= 0) return;
    nTotal += n;
    areaM2 += (num(p.ancho) / 100) * (num(p.alto) / 100) * n;
    if (p.tipo === 'PT') {
      nPuerta += n;
      if (SUP_601_PUERTA[key]) bastidorM += (SUP_601_PUERTA[key][0] + SUP_601_PUERTA[key][1]) * n;
      lisoU += (SUP_LISO_PUERTA[w] || 0) * n;
      rellenoT += rellenoPuerta(w) * n;
    } else if (p.tipo === 'PN') {
      nPanel += n;
      if (SUP_601_PANEL[key]) bastidorM += SUP_601_PANEL[key] * n;
      lisoU += (SUP_LISO_PANEL[key] || 0) * n;
      rellenoT += rellenoPanel(w) * n;
    } else if (p.tipo === 'MG') {
      nMingit += n;
      if (SUP_601_MINGIT[key]) bastidorM += SUP_601_MINGIT[key] * n;
      lisoU += (SUP_LISO_MINGIT[key] || 0) * n;
      rellenoT += 2 * n;
    } else if (p.tipo === 'PL') {
      nPilastra += n;
      const t = SUP_601_PILASTRA[w]; if (t) bastidorM += t[reforzado ? 1 : 0] * n;
      lisoU += (SUP_602_LISO[w] || 0) * n;
      rellenoT += rellenoPilastra(w, reforzado) * n;
    }
  });
  if (nTotal === 0) return rows;
  const push = (code, desc, qty, logic) => { if (qty > 0) rows.push({ code, desc, qty, logic }); };
  const cbloqCortes = 2 * nPuerta + 2 * nPilastra;
  push('601-555', 'Perfil bastidor 601 · barra 5.55 m', Math.ceil(bastidorM / 5.55), `Σ ${bastidorM.toFixed(2)} m ÷ 5.55`);
  if (esLamina) push('EPS-22', 'Placa EXPORIT (núcleo)', Math.ceil(areaM2 / 2.93), `⌈${areaM2.toFixed(2)} m² ÷ 2.93⌉`);
  else push('600-59', 'Perfil relleno 600', rellenoT, `relleno por pieza (todas)`);
  push(`${cBloq}-580`, `Perfil c/bloqueo visual ${cBloq} · barra 5.80 m`, Math.ceil(cbloqCortes / 3), `(2×${nPuerta}pt + 2×${nPilastra}pl) = ${cbloqCortes} cortes ÷ 3`);
  push(`${cLiso}-580`, `Perfil liso/plano ${cLiso} · barra 5.80 m`, Math.ceil(lisoU), `Σ ${lisoU.toFixed(2)} → ⌈⌉`);
  push(cTaponP, `Tapón ${cTaponP} c/tope (puertas)`, 4 * nPuerta, `4 × ${nPuerta} pt`);
  push(cTaponN, `Tapón ${cTaponN}`, 2 * nPilastra + 4 * nPanel + 4 * nMingit, `2×${nPilastra}pl + 4×${nPanel}pn + 4×${nMingit}mg`);
  push('T112', 'Pija acero inox 6x3/4', 4 * nTotal, `4 × ${nTotal} piezas`);
  push('T113', 'Pija galvanizada 6x1½', 8 * nPuerta + 6 * nPanel + 10 * nMingit + 12 * nPilastra,
       `8×${nPuerta}pt + 6×${nPanel}pn + 10×${nMingit}mg + 12×${nPilastra}pl (desde cero)`);
  push('T115', 'Pija acero 6x1/2', 4 * (nPuerta + nPanel + nMingit) + 2 * nPilastra, `4×(${nPuerta}pt+${nPanel}pn+${nMingit}mg) + 2×${nPilastra}pl`);
  const cTuerca = esLamina ? 'T48' : 'T67';
  push(cTuerca, `Tuerca remachable ${cTuerca} (puertas)`, 8 * nPuerta, `8 × ${nPuerta} pt`);
  return rows;
}

// CARA de 3mm — medida de CORTE por pieza (2 caras por pieza, una por lado).
// Offsets del ancho: PT −2.3, PN/MG −0.5, PL −1.8. Alto: PT/PN/MG −0.5, PL −6.5.
function caraCorteSuperior(p) {
  const w = num(p.ancho), h = num(p.alto);
  if (p.tipo === 'PT') return { w: w - 2.3, h: h - 0.5 };
  if (p.tipo === 'PN' || p.tipo === 'MG') return { w: w - 0.5, h: h - 0.5 };
  if (p.tipo === 'PL') return { w: w - 1.8, h: h - 6.5 };
  return null;
}
// Hojas de LÁMINA (esmaltada/acero): 122 de ancho, alto por banda de la pieza.
const SUP_LAMINA_SHEETS = { 151: { W: 122, H: 151 }, 181: { W: 122, H: 181 }, 207: { W: 122, H: 207 } };
function bandaAltoLamina(h) { return h <= 150.5 ? 151 : (h <= 180.5 ? 181 : 207); }

// CARA de laminado: 2 caras por pieza. Hojas = ⌈m² útil de caras ÷ m² de la hoja⌉
// (así lo cuenta producción, con nesting apretado). Sólido → hoja estándar 5X12,
// código <color>-3-1 ; Lámina → hoja 122×151/181/207 por banda de alto (E-151/E-181/E-207).
function caraSuperior() {
  const rows = [];
  const esLamina = acabadoSuperiorTipo() === 'LAMINA';
  const bandArea = {};   // banda → m² útil (lámina)
  let solidoM2 = 0, m2Lam = 0;
  STATE.pieces.forEach(p => {
    const n = int(p.cant); if (n <= 0) return;
    const c = caraCorteSuperior(p); if (!c || c.w <= 0 || c.h <= 0) return;
    const m2 = (c.w / 100) * (c.h / 100) * n * 2;   // 2 caras por pieza
    if (esLamina) { const b = bandaAltoLamina(c.h); bandArea[b] = (bandArea[b] || 0) + m2; }
    else solidoM2 += m2;
  });
  const ci = lookupColor(STATE.color);
  const mNum = String(ci.code || '').match(/^([A-Za-z]?\d{3,5})/);
  if (esLamina) {
    Object.keys(bandArea).map(Number).sort((a, b) => a - b).forEach(b => {
      const sh = SUP_LAMINA_SHEETS[b], sheetM2 = sh.W * sh.H / 10000;
      const nH = Math.ceil(bandArea[b] / sheetM2);
      if (nH > 0) { m2Lam += nH * sheetM2; rows.push({ code: `E-${b}`, desc: `Lámina esmaltada 122×${b} (${STATE.color})`, qty: nH,
        logic: `${bandArea[b].toFixed(2)} m² útil ÷ ${sheetM2.toFixed(2)} → ${nH} hoja(s)` }); }
    });
  } else {
    const cand = cutSizeCandidates()[0] || { W: 366, H: 152 };
    const sheetM2 = cand.W * cand.H / 10000;
    const nH = Math.ceil(solidoM2 / sheetM2);
    if (nH > 0) { m2Lam += nH * sheetM2; rows.push({ code: mNum ? `${mNum[1]}-3-1` : 'CARA-3MM', desc: `Sólido fenólico 3mm (${STATE.color})`, qty: nH,
      logic: `${solidoM2.toFixed(2)} m² útil ÷ ${sheetM2.toFixed(2)} → ${nH} hoja(s)` }); }
  }
  return { rows, m2Lam: +m2Lam.toFixed(2) };
}

// MATERIAL PRINCIPAL Superior = CARA 3mm + ESTRUCTURA + ZOCLOS.
// Devuelve la MISMA forma que calculateMaterials (mat, m2, peso, m2Lam) para el Excel/PDF.
function calculateMaterialsSuperior() {
  const mat = [];
  const cara = caraSuperior();
  cara.rows.forEach(r => mat.push(r));
  estructuraSuperior().forEach(r => mat.push(r));
  zoclosSuperior().rows.forEach(r => mat.push(r));
  let m2 = 0;
  STATE.pieces.forEach(p => {
    const a = num(p.ancho) / 100, h = num(p.alto) / 100, cant = int(p.cant);
    if (a > 0 && h > 0 && cant > 0) m2 += a * h * cant;
  });
  m2 = +m2.toFixed(2);
  return { mat, m2, m2Lam: cara.m2Lam, peso: +(m2 * 15).toFixed(2) };
}

// ════════════════════════════════════════════════════════════════════
//   TOUCHLESS S3 — motor propio (LEEDER Reforzado + electrónicos S3)
//   Touchless SIEMPRE es Reforzado. n = nº de puertas/cubículos (= B44 del
//   checklist). Electrónicos por puerta + reglas propias: KFP por área,
//   cerradura magnética/S1-S2 según dirección de apertura, arnés 1 cada 3,
//   canaleta = mismos ml que el refuerzo. NO BREAK va aparte.
// ════════════════════════════════════════════════════════════════════
// Arnés troncal tipo T: 1 cada 3 cubículos, +1 extra si son más de 3.
// (Regla de Dayanna; el arnés al que aplica quedó ASUMIDO = ARNES TIPO T.)
function arnesTouchless(cub) {
  if (cub <= 0) return 0;
  return Math.ceil(cub / 3) + (cub > 3 ? 1 : 0);
}
function calculateHardwareTouchless() {
  const c = countPieces();
  const sys = STATE.sistema;
  const hw = [];
  const flags = [];

  const n = c.PT_total; // puertas / cubículos

  const B4=c.PTADER,B5=c.PTADERAM,B6=c.PTAIZQ,B7=c.PTAIZQAM,B8=c.PTBDER,B9=c.PTBDERAM,
        B10=c.PTCIZQ,B11=c.PTCIZQAM,B12=c.PTCDER,B13=c.PTCDERAM,B14=c.PTBIZQ,B15=c.PTBIZQAM,
        B16=c.PTFDER,B17=c.PTFIZQ,B18=c.PNCEN,B19=c.PNLAT,B20=c.PNUNI,B26=c.PLLATMUR,B27=c.PLCOSMUR;

  // Puertas que ABREN AFUERA (cerradura -S1/-S2): apertura _EXT del CSV.
  let afuera = 0, hayOri = false;
  STATE.pieces.forEach(p => {
    if (p.tipo !== 'PT') return;
    const ori = String(p.orientacion || '').toUpperCase();
    if (ori) hayOri = true;
    if (/EXT|AFUERA/.test(ori)) afuera += int(p.cant);
  });
  if (!hayOri && +STATE.puertasAfuera > 0) { afuera = Math.min(+STATE.puertasAfuera, n); hayOri = true; }

  // Taquete / pata (también base de T7). ≤17 → 1, ≥19 → 2 (zoclo) · ≤15 → 1 (pata).
  let KTA = 0, KPLE = 0;
  c.pilastras.forEach(p => {
    KTA  += (p.ancho > 0 && p.ancho <= 17 ? 1 : 2);
    KPLE += (p.ancho > 0 && p.ancho <= 15 ? 1 : 2);
  });

  // ═══════════ ELECTRÓNICOS S3 (por puerta) ═══════════
  if (n > 0) {
    hw.push({ code:'D19',        desc:'Tope Leeder ovalado',                  qty:n*3, logic:'3 × cada puerta' });
    hw.push({ code:'KAPL-S3-V2', desc:'Arnés de pilastra S3',                 qty:n,   logic:'1 × puerta' });
    hw.push({ code:'1X1/16-100', desc:'Solera 1 × 1/16 a 100 cm (sensor)',    qty:n,   logic:'1 × puerta' });
    hw.push({ code:'ACRS3',      desc:'Acrílico solera sensor',               qty:n,   logic:'1 × puerta' });
    hw.push({ code:'ACRS3-V2',   desc:'Acrílico solera LED de ocupación',     qty:n,   logic:'1 × puerta' });
    hw.push({ code:'KCT-TCHLS',  desc:'Contra tope Touch-less S1-S2',         qty:n,   logic:'1 × puerta' });
    hw.push({ code:'KAP',        desc:'Kit de abrepuertas de pie',            qty:n,   logic:'1 × puerta' });
    hw.push({ code:'KJL1M2',     desc:'Jaladera Leeder corto M2',             qty:n,   logic:'1 × puerta' });
    hw.push({ code:'KGNM',       desc:'Kit de gancho Leeder normal + a muro', qty:n,   logic:'todas las PT' });
    hw.push({ code:'F03',        desc:'Etiqueta puerta Touch-less S1/S2',     qty:n,   logic:'1 × puerta' });
    hw.push({ code:'F04',        desc:'Etiqueta puerta QR Touch-less S1/S2',  qty:n,   logic:'1 × puerta' });
    hw.push({ code:'F05',        desc:'Etiqueta cerradura Touch-less S1/S2',  qty:n,   logic:'1 × puerta' });
    hw.push({ code:'T3',         desc:'Tornillo Allen 4×10',                  qty:n*6, logic:'6 × puerta' });

    const magnetica = n - afuera;
    if (magnetica > 0) hw.push({ code:'CERRADURA-S3',    desc:'Cerradura magnética',                           qty:magnetica, logic:'puertas − las que abren afuera' });
    if (afuera > 0)    hw.push({ code:'CERRADURA-S1/S2', desc:'Cerradura -S1/S2 (puertas que abren afuera)',   qty:afuera,    logic:'apertura _EXT del CSV' });
    else if (!hayOri)  flags.push({ kind:'warn', msg:'Cerradura -S1/S2: el CSV no trae la dirección de apertura (Orientacion _EXT); se puso todo como magnética. Regenerá la OC con la apertura o ajustá a mano.' });

    hw.push({ code:'ARNEST-S1/S2', desc:'Arnés tipo T 120 cm derivación S2', qty:arnesTouchless(n), logic:'⌈cubículos/3⌉ + (>3 → +1) · ASUMIDO', flag:true });
    hw.push({ code:'ARNES-EXT',    desc:'Arnés de extensión 100 cm',         qty:n,                 logic:'magnética + S1/S2' });
  }

  // KFP-S3: fuente de poder, 1 por ÁREA (+1 si el área tiene >6 módulos)
  const doorsByArea = {};
  STATE.pieces.forEach(p => { if (p.tipo === 'PT') { const a = p.area || '(sin área)'; doorsByArea[a] = (doorsByArea[a] || 0) + int(p.cant); } });
  let kfp = 0;
  Object.values(doorsByArea).forEach(d => { kfp += 1 + (d > 6 ? 1 : 0); });
  if (kfp > 0) {
    hw.push({ code:'KFP-S3',           desc:'Fuente de poder 24V - 150 Wats',          qty:kfp,     logic:'1 por área (+1 si >6 módulos)' });
    hw.push({ code:'ARNES-EXT/FUENTE', desc:'Arnés de extensión para fuente de poder', qty:kfp + n, logic:'KFP + ARNES-EXT' });
  }

  // ═══════════ HERRAJE ESTÁNDAR (compartido con LEEDER Reforzado) ═══════════
  const KBDL=B4+B5+B12+B13, KBIL=B6+B7+B14+B15, KBDLM=B8+B9+B16, KBILM=B10+B11+B17;
  if (KBDL>0)  hw.push({ code:'KBDL',  desc:'Kit de bisagra derecha Leeder',          qty:KBDL,  logic:'PTADER+PTADER-AM+PTCDER+PTCDER-AM' });
  if (KBIL>0)  hw.push({ code:'KBIL',  desc:'Kit de bisagra izquierda Leeder',        qty:KBIL,  logic:'PTAIZQ+PTAIZQ-AM+PTBIZQ+PTBIZQ-AM' });
  if (KBDLM>0) hw.push({ code:'KBDLM', desc:'Kit de bisagra derecha Leeder a muro',   qty:KBDLM, logic:'PTBDER+PTBDER-AM+PTFDER' });
  if (KBILM>0) hw.push({ code:'KBILM', desc:'Kit de bisagra izquierda Leeder a muro', qty:KBILM, logic:'PTCIZQ+PTCIZQ-AM+PTFIZQ' });
  if (KBDLM>0) hw.push({ code:'KSD',   desc:'Seguro para bisagra derecha',            qty:KBDLM, logic:'= KBDLM' });
  if (KBILM>0) hw.push({ code:'KSI',   desc:'Seguro para bisagra izquierda',          qty:KBILM, logic:'= KBILM' });

  if (c.MG120>0) hw.push({ code:'KTL1', desc:'Kit de T Leeder 2 pz para mingitorio (alto 120)', qty:c.MG120, logic:'#MG alto 120' });
  if (c.MG150>0) hw.push({ code:'KTL2', desc:'Kit de T Leeder 3 pz para mingitorio (alto 150)', qty:c.MG150, logic:'#MG alto 150' });

  if (sys === 'ZOCLO' && c.PL_total > 0) {
    if (KTA > 0) {
      hw.push({ code:'KTA',   desc:'Taquete metálico (tornillo Allen 6×12)', qty:KTA, logic:'pilastra ≤17→1 · ≥19→2' });
      hw.push({ code:'KPEDL', desc:'Kit de pedal Leeder',                    qty:KTA, logic:'= KTA' });
    }
    const zoclos = {};
    STATE.pieces.filter(p => p.tipo === 'PL').forEach(p => { const a=int(p.ancho), ct=int(p.cant); if (a>0 && ct>0) zoclos[a]=(zoclos[a]||0)+ct; });
    Object.keys(zoclos).sort((a,b)=>+a-+b).forEach(a => hw.push({ code:`ZLA${a}`, desc:`Zoclo Leeder aluminio ${a} cm`, qty:zoclos[a], logic:`pilastras de ${a} cm` }));
  } else if (sys === 'PATAS' && c.pilastras.length > 0) {
    if (KPLE > 0) hw.push({ code:'KPLE', desc:'Pata Leeder', qty:KPLE, logic:'pilastra ≤15→1 · ≥17→2' });
  }

  // KUS12M / KUS12N (kits "U") — reparto muro/normal PROVISIONAL (validar con pedido real)
  const KUS12M = B18 + B19 + B26 + B27;
  const KUS12N = c.PLCEN + c.PLLAT + c.PLCOS + B20;
  if (KUS12M > 0) hw.push({ code:'KUS12M', desc:'"U" 12 mm (3 U × kit) muro',   qty:KUS12M, logic:'PNCEN+PNLAT+PLLATMUR+PLCOSMUR · PROVISIONAL', flag:true });
  if (KUS12N > 0) hw.push({ code:'KUS12N', desc:'"U" 12 mm (3 U × kit) normal', qty:KUS12N, logic:'PLCEN+PLLAT+PLCOS+PNUNI · PROVISIONAL', flag:true });
  if (KUS12M > 0 || KUS12N > 0) flags.push({ kind:'warn', msg:'KUS12M/KUS12N: el reparto muro/normal es PROVISIONAL — validar con un pedido Touchless real.' });

  // ═══════════ REFUERZO (siempre reforzado) + CANALETA ═══════════
  const cortesOC = STATE.refuerzoCortes || [];
  const kitsOC = STATE.refuerzoKits || {};
  const hasKitsT = !!STATE.refuerzoKits;
  const ke65t = hasKitsT ? (kitsOC.KE65 || 0) : B19;
  const ke62t = hasKitsT ? (kitsOC.KE62 || 0) : (B19 + B26);
  if (ke65t > 0) hw.push({ code:'KE65', desc:'Kit escuadra plana ángulo 90° (1 pz)', qty:ke65t, logic:hasKitsT ? 'OC Constructor — esquinas 90°' : 'PNLAT (heurística manual)' });
  if (ke62t > 0) hw.push({ code:'KE62', desc:'Kit escuadra refuerzo-muro (1 pz)',    qty:ke62t, logic:hasKitsT ? 'OC Constructor — extremos a muro' : 'PNLAT + PLLATMUR (heurística manual)' });
  const T7 = (sys === 'PATAS') ? KPLE : KTA;
  if (T7 > 0) hw.push({ code:'T7', desc:'Tornillo Allen cabeza botón 6×12 (REFORZADO)', qty:T7, logic:sys==='PATAS'?'= KPLE':'= KTA' });
  const mlRef = Math.round(cortesOC.reduce((s,r)=>s + r.cm*r.cant, 0)) / 100;
  if (mlRef > 0) {
    hw.push({ code:'1918-610', desc:'Refuerzo de aluminio (ml)', qty:mlRef.toFixed(2), logic:'∑ cortes OC Constructor' });
    const canaletas = Math.ceil(mlRef / 2);
    hw.push({ code:'CANALETA PVC 20X20', desc:'Canaleta plástica 20×20 c/retenedor 2 mts', qty:canaletas, logic:`⌈${mlRef.toFixed(2)} ml ÷ 2 m⌉ (mismos ml que el refuerzo)` });
  } else if (cortesOC.length === 0) {
    flags.push({ kind:'warn', msg:'Touchless es Reforzado: no vino el refuerzo (1918-610) ni la canaleta. Regenerá la OC del Constructor con los cortes de refuerzo.' });
  }

  flags.push({ kind:'note', msg:'NO BREAK: se agrega/cotiza aparte (no se incluye en esta lista).' });

  return { hw, flags };
}

// Selector automático de herraje/materiales por línea.
function hardwareAuto()  { return esTouchlessCIP() ? calculateHardwareTouchless() : esSuperiorCIP() ? calculateHardwareSuperior() : calculateHardware(); }
function materialsAuto() { return esSuperiorCIP() ? calculateMaterialsSuperior() : calculateMaterials(); }

// HERRAJES Superior 2.0 (hoja SUP 2.0 SOLIDO / LAMINAS). Misma lógica de subtipos que LEEDER,
// con códigos 2.0 por acabado (Sólido: KCE/KU3/KU2/KT ; Lámina: KC2.0/KU/KU1/KT28).
function calculateHardwareSuperior() {
  const c = countPieces();
  const esLamina = acabadoSuperiorTipo() === 'LAMINA';
  const hw = [];
  const push = (code, desc, qty, logic) => { if (qty > 0) hw.push({ code, desc, qty, logic }); };
  // Subtipos de puerta (filas VERIFICACIÓN)
  const B4=c.PTADER,B5=c.PTADERAM,B6=c.PTAIZQ,B7=c.PTAIZQAM,B8=c.PTBDER,B9=c.PTBDERAM,
        B10=c.PTCIZQ,B11=c.PTCIZQAM,B12=c.PTCDER,B13=c.PTCDERAM,B14=c.PTBIZQ,B15=c.PTBIZQAM,
        B16=c.PTFDER,B17=c.PTFIZQ;
  const B18=c.PNCEN,B19=c.PNLAT,B23=c.PLCEN,B24=c.PLLAT,B25=c.PLCOS,
        B26=c.PLLATMUR,B27=c.PLCOSMUR,B28=c.PLCENKEML,B29=c.PLLATKEML;
  // ── Bisagras (der/izq × normal/muro) ──
  const KBD = B4+B5+B12+B13, KBDM = B8+B9+B16, KBI = B6+B7+B14+B15, KBIM = B10+B11+B17;
  push('KBD',  'Kit de bisagra derecha 2.0', KBD, 'PTADER+PTADER-AM+PTCDER+PTCDER-AM');
  push('KBI',  'Kit de bisagra izquierda 2.0', KBI, 'PTAIZQ+PTAIZQ-AM+PTBIZQ+PTBIZQ-AM');
  push('KBDM', 'Kit de bisagra derecha superior muro', KBDM, 'PTBDER+PTBDER-AM+PTFDER');
  push('KBIM', 'Kit de bisagra izquierda superior muro', KBIM, 'PTCIZQ+PTCIZQ-AM+PTFIZQ');
  // ── Cerrojo (= todas las puertas) ──
  const KCE = KBD+KBDM+KBI+KBIM;
  push(esLamina ? 'KC2.0' : 'KCE', `Kit de cerrojo ${esLamina ? 'láminas ' : ''}2.0`, KCE, 'Σ bisagras = # puertas');
  // ── Gancho con tope (normal / a muro) ──
  const KGM = B5+B7+B9+B11+B13+B15+B16+B17;
  push('KG',  'Kit de gancho con tope', KCE - KGM, 'KCE − KGM');
  push('KGM', 'Kit de gancho con tope a muro', KGM, 'todas las -AM + PTF');
  // ── Contratope (normal = puertas que no cierran sobre muro) ──
  const KCTUM = B12+B13+B14+B15+B16+B17;
  push('KCTUA', 'Kit de contratope', KCE - KCTUM, 'KCE − contratopes a muro');
  // ── T mingitorio ──
  push(esLamina ? 'KT28' : 'KT', `Kit de "T" ${esLamina ? '28mm ' : ''}mingitorio 2.0`, c.MG_total, '# mingitorios');
  // ── Escuadra universal a muro ──
  const KEM = B29 + B28 * 2;
  push('KEM', 'Kit de escuadra universal a muro', KEM, 'PLLATKEML + 2·PLCENKEML');
  // ── Kits U (a muro / normal) — panel + pilastra según subtipo (⚠ validar con CSV real) ──
  const KUmuro = B18 + B27 + B19 + B26;   // PNCEN + PLCOSMUR + PNLAT + PLLATMUR
  const KUnorm = B24 + B25 + B23;         // PLLAT + PLCOS + PLCEN
  push(esLamina ? 'KU'  : 'KU3', `Kit de U a muro ${esLamina ? 'láminas' : 'LC'} (2 pz)`, KUmuro, 'PNCEN+PLCOSMUR+PNLAT+PLLATMUR');
  push(esLamina ? 'KU1' : 'KU2', `Kit de U normal ${esLamina ? 'láminas' : 'LC'} (2 pz)`, KUnorm, 'PLLAT+PLCOS+PLCEN');
  // ── Taquete / Pedal / Pija (derivados del zoclo). Colgante: sin taquete/pedal, lleva KE10. ──
  const z = zoclosSuperior();
  const esColgante = (STATE.modeloCod || '').toUpperCase().includes('COLGANTE');
  if (esColgante) {
    push('KE10', 'Kit de esparrago 10 cm (Colgante)', z.pedal, 'Colgante: reemplaza taquete + pedal');
  } else {
    push('KTA', 'Kit de taquete metálico armado', z.pedal, 'Σ zoclos');
    push('KPE', 'Kit de pedal Superior', z.pedal, '= KTA');
  }
  push('T22', 'Pija broca 8x3/4 p/ref', z.pedal, '= zoclos');
  return { hw, flags: [] };
}

// Nº de áreas (para etiquetas): distintas áreas presentes en las piezas / áreas manuales.
function numAreasCIP() {
  const setA = new Set();
  (STATE.pieces || []).forEach(p => { if (int(p.cant) > 0) setA.add(p.area || 'Área 1'); });
  return setA.size || (STATE.areasManual || []).length || 1;
}
// EMPAQUE (solo lo del checklist M1 ZOCLO): tarima, tablas, pija T17, caja. Base = ⌈peso/1000⌉,
// peso = m² × 18 kg. tarima = base × 2; tablas = tarima × 10; pija T17 = tarima × 2; caja = base.
function calcularEmpaque(m2) {
  const peso = (+m2 || 0) * 18;
  const base = Math.ceil(peso / 1000);
  const tarima = base * 2;
  const items = [];
  if (tarima > 0) {
    items.push({ code: 'E9F',  desc: 'Tarima fumigada',            qty: tarima,     logic: '⌈(m²×18)/1000⌉ × 2' });
    items.push({ code: 'E09',  desc: 'Tablas de madera fumigada',  qty: tarima * 10, logic: 'tarima × 10' });
    items.push({ code: 'T17',  desc: 'Pija negra plana 1.5',       qty: tarima * 2, logic: 'tarima × 2' });
    items.push({ code: '9118', desc: 'Caja empaque herraje',       qty: base,       logic: '⌈(m²×18)/1000⌉' });
  }
  return items;
}
// Códigos de etiqueta que se muestran en el grupo EMPAQUE Y ETIQUETAS (no en HERRAJES).
const ETIQUETA_CODES = ['F35', 'F35 ', 'F36', 'F6'];
function renderMaterialsList() {
  const cont = $('ml-content');
  const { hw }  = hardwareAuto();
  const { mat, m2 } = materialsAuto();

  $('ml-exp').textContent  = 'EXP: ' + (STATE.exp || '—');
  const term = STATE.sistema === 'PATAS' ? 'PATA' : 'ZOCLO';
  $('ml-tipo').textContent = `${nombreModelo(STATE.modeloCod)} ${term}`;

  if (hw.length === 0 && mat.length === 0) {
    cont.innerHTML = `<div class="empty-state"><span class="empty-icon">📦</span>Cargá piezas en VERIFICACIÓN para ver la lista de materiales.</div>`;
    return;
  }

  let html = '';
  const mlRow = (o) => `<div class="ml-row ${o.flag ? 'flag' : ''}">
        <div class="ml-qty">${o.qty}</div>
        <div class="ml-code">${o.code}</div>
        <div class="ml-desc">${String(o.desc).toUpperCase()}</div>
        <div class="ml-logic">${o.logic || ''}${o.flag ? ' ⚠' : ''}</div>
      </div>`;
  const etiquetas = hw.filter(h => ETIQUETA_CODES.includes(String(h.code)));
  const hwRest = hw.filter(h => !ETIQUETA_CODES.includes(String(h.code)));
  const empaque = calcularEmpaque(m2);

  html += `<div class="ml-section-head">COSTOS ESTIMADOS (M²)</div>`;
  html += mlRow({ qty: (+m2 || 0).toFixed(2), code: 'M²', desc: 'Costos estimados', logic: 'm² total de piezas' });

  if (mat.length) {
    html += `<div class="ml-section-head">MATERIAL PRINCIPAL</div>`;
    mat.forEach(m => { html += mlRow(m); });
  }

  if (empaque.length || etiquetas.length) {
    html += `<div class="ml-section-head">EMPAQUE Y ETIQUETAS</div>`;
    empaque.forEach(m => { html += mlRow(m); });
    etiquetas.forEach(h => { html += mlRow(h); });
  }

  if (hwRest.length) {
    html += `<div class="ml-section-head">HERRAJES — Calculado automáticamente</div>`;
    hwRest.forEach(h => { html += mlRow(h); });
  }

  // ─── CORTES REFUERZO (importados de la OC del Constructor) ───
  const cortesRf = (STATE.modelo === 'REFORZADO' && STATE.refuerzo === 'AUTO') ? (STATE.refuerzoCortes || []) : [];
  if (cortesRf.length > 0) {
    const totalMlRf = Math.round(cortesRf.reduce((s, r) => s + r.cm * r.cant, 0)) / 100;
    html += `<div class="ml-section-head">CORTES REFUERZO (1918-610) — OC Constructor</div>`;
    expandirCortesRefuerzo(cortesRf).forEach(r => {
      html += `<div class="ml-row">
        <div class="ml-qty">${r.cant}</div>
        <div class="ml-code">RF${r.cm}</div>
        <div class="ml-desc">CORTE REFUERZO ${(r.cm / 100).toFixed(2)} ML (${r.cm} CM)${r.nota ? ' — ' + r.nota.toUpperCase() : ''}</div>
        <div class="ml-logic">${r.area || ''}</div>
      </div>`;
    });
    html += `<div class="ml-row">
      <div class="ml-qty"><b>${totalMlRf.toFixed(2)}</b></div>
      <div class="ml-code">ML</div>
      <div class="ml-desc"><b>TOTAL REFUERZO DE ALUMINIO</b></div>
      <div class="ml-logic">∑ cortes</div>
    </div>`;
  }

  // ─── ANTEPECHOS (SCUDO) — importados de la OC del Constructor ───
  const antep = STATE.antepechos || [];
  if (antep.length > 0) {
    html += `<div class="ml-section-head">ANTEPECHOS (SCUDO) — OC Constructor</div>`;
    antep.forEach(ap => {
      html += `<div class="ml-row">
        <div class="ml-qty">${ap.cant}</div>
        <div class="ml-code">AN${Math.round(ap.alto)}</div>
        <div class="ml-desc">ANTEPECHO ${ap.ancho} × ${ap.alto} CM</div>
        <div class="ml-logic">${ap.area || ''}</div>
      </div>`;
    });
  }

  // ─── CORTES PERFIL U (SCUDO) — desde la OC del Constructor ───
  const cortesPU = (STATE.modelo === 'SCUDO') ? (STATE.perfilUCortes || []) : [];
  if (cortesPU.length > 0) {
    html += `<div class="ml-section-head">CORTES PERFIL "U" (104-610) — OC Constructor</div>`;
    const puPorArea = {};
    cortesPU.forEach(r => { const k = r.area || ''; (puPorArea[k] = puPorArea[k] || []).push(r); });
    let granPU = 0;
    Object.keys(puPorArea).forEach(area => {
      let areaCm = 0;
      puPorArea[area].forEach(r => {
        areaCm += r.cm * r.cant;
        html += `<div class="ml-row">
          <div class="ml-qty">${r.cant}</div>
          <div class="ml-code">PU${r.cm}</div>
          <div class="ml-desc">CORTE PERFIL U ${(r.cm / 100).toFixed(2)} ML (${r.cm} CM)</div>
          <div class="ml-logic">${area}</div>
        </div>`;
      });
      granPU += areaCm;
      html += `<div class="ml-row">
        <div class="ml-qty"><b>${(areaCm / 100).toFixed(2)}</b></div>
        <div class="ml-code">ML</div>
        <div class="ml-desc"><b>TOTAL PERFIL U · ${area}</b></div>
        <div class="ml-logic">∑ ${area}</div>
      </div>`;
    });
    html += `<div class="ml-row">
      <div class="ml-qty"><b>${(granPU / 100).toFixed(2)}</b></div>
      <div class="ml-code">ML</div>
      <div class="ml-desc"><b>TOTAL PERFIL U (104-610)</b></div>
      <div class="ml-logic">∑ todas las áreas</div>
    </div>`;
  }

  // ─── TUBING (IMPERIAL) — desde la OC del Constructor ───
  const cortesTbML = STATE.tubingCortes || [];
  if (cortesTbML.length > 0) {
    const totalTb = Math.round(cortesTbML.reduce((s, r) => s + r.cm * r.cant, 0)) / 100;
    html += `<div class="ml-section-head">TUBING ORNAMENTAL (T00021) — OC Constructor</div>`;
    cortesTbML.forEach(r => {
      html += `<div class="ml-row">
        <div class="ml-qty">${r.cant}</div>
        <div class="ml-code">TB${r.cm}</div>
        <div class="ml-desc">TUBING ${(r.cm / 100).toFixed(2)} ML (${r.cm} CM)</div>
        <div class="ml-logic">${r.area || ''}</div>
      </div>`;
    });
    html += `<div class="ml-row">
      <div class="ml-qty"><b>${totalTb.toFixed(2)}</b></div>
      <div class="ml-code">ML</div>
      <div class="ml-desc"><b>TOTAL TUBING (T00021)</b></div>
      <div class="ml-logic">∑ recorridos</div>
    </div>`;
  }

  cont.innerHTML = html;
}

// ─── Validación ───
function renderValidation() {
  const list = $('val-flags-list');
  if (!list) return;
  const c = countPieces();
  const total = c.PT_total + c.PN_total + c.PL_total + c.MG_total;
  const { flags } = hardwareAuto();
  const oc = int(STATE.ocTotal);

  let html = '';
  if (oc > 0) {
    const matchClass = oc === total ? 'match' : 'miss';
    const icon = oc === total ? '✓' : '✗';
    html += `<div class="val-row ${matchClass}">
      <div>Total piezas — OC vs detectado</div>
      <div class="num">${oc}</div>
      <div class="num strong">${total}</div>
      <div class="icon">${icon}</div>
    </div>`;
  }

  // Advertencias propias del motor de reglas
  flags.forEach(f => {
    const cls = f.kind === 'warn' ? 'warn' : '';
    html += `<div class="val-row ${cls}" style="grid-template-columns: 28px 1fr;">
      <div class="icon">${f.kind === 'warn' ? '⚠' : '·'}</div>
      <div>${f.msg}</div>
    </div>`;
  });

  // Advertencias devueltas por la IA (si las hubo)
  if (Array.isArray(STATE.aiAdvertencias) && STATE.aiAdvertencias.length) {
    STATE.aiAdvertencias.forEach(adv => {
      html += `<div class="val-row warn" style="grid-template-columns: 28px 1fr;">
        <div class="icon">🤖</div>
        <div><b>IA:</b> ${adv}</div>
      </div>`;
    });
  }

  // Heurísticas extra: PMR sin AM, color sin código, etc.
  if (STATE.color && !lookupColor(STATE.color).code) {
    html += `<div class="val-row warn" style="grid-template-columns: 28px 1fr;">
      <div class="icon">⚠</div>
      <div>Color "<b>${STATE.color}</b>" no está en el catálogo. Verificá el código de laminado manualmente.</div>
    </div>`;
  }

  if (oc === 0 && flags.length === 0 && (!STATE.aiAdvertencias || !STATE.aiAdvertencias.length)) {
    html = `<div class="empty-state"><span class="empty-icon">✓</span>Sin flags. Cargá el total de OC en CAPTURAR para validar.</div>`;
  }
  list.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════
//   CUT ENGINE — 2D Bin Packing (MaxRects + BSSF)
// ════════════════════════════════════════════════════════════════════
const CUT_COLORS = {
  PT: ['#E8B547', '#D69E32', '#C28720', '#A26F18', '#7E5510'],
  PL: ['#7AB7D8', '#5F92B2', '#4878A0', '#355E80', '#244861'],
  PN: ['#9ED080', '#82B268', '#688E50', '#506B3D', '#3C5230'],
  MG: ['#E58547', '#C56730', '#A04E20', '#7C3A14', '#5A280A'],
};
let CUT_COLOR_MAP = {};
// Última lista de hojas renderizada (con lamColor por hoja) — usada por el menú de
// pieza para ofrecer mover SOLO a hojas del mismo color.
let CUT_SHEETS = [];

// Colores con veta direccional: la beta de la hoja va de izquierda a derecha,
// y para PT/PL la pieza debe quedar vertical (alto en eje vertical, sin rotar).
// Detección de "veta": derivada del COLOR_MAP. Cualquier color con veta direccional
// (laminados de madera o texturas con dirección) entra acá. Los colores lisos
// (BLANCO, NEGRO, GRIS, GRAFITO NOCTURNO) permiten rotar piezas en corte; los
// con veta (INOX SATÍN, ÁMBAR WOOD/WALNUT, NOGAL GRAFITO/SKYLINE) NO permiten
// rotar PT/PL para mantener la veta en una dirección consistente.
function isColorConVeta() {
  return !!lookupColor(STATE.color || '').veta;
}

// Borde descartable de 3 mm en cada lado de la hoja para corte limpio.
const SHEET_MARGIN_CM = 0.3;

function getCutAdjust() {
  const isPata = STATE.sistema === 'PATAS';
  return {
    dAlto_PL: isPata ? -9.8 : -5.8,
    dAlto_PT: 0.2, dAlto_MG: 0.2, dAlto_PN: 0,
    dAncho_PL: 0.2, dAncho_PT: 0.2, dAncho_MG: 0.2, dAncho_PN: 0,
    term: isPata ? 'pata' : 'zoclo',
  };
}

// Piezas de la OC que todavía no tienen tipo (PTADER, PTAIZQ, PLLATMUR…).
// Para cortar el tipo no hace falta: la hoja se corta por medida y el ajuste
// depende de la familia, no de la variante. Las devuelve el lector de OC.
function piezasOCSinTipo() {
  const f = window.CIP_OC && window.CIP_OC.porAsignar;
  if (typeof f !== 'function') return [];
  try { return f() || []; } catch (e) { return []; }
}

function buildCutPieces() {
  const aj = getCutAdjust();
  const pieces = [];
  CUT_COLOR_MAP = {};
  const usedCodes = { PT: {}, PL: {}, PN: {}, MG: {} };

  STATE.pieces.forEach(p => {
    const cant = int(p.cant);
    const ancho = num(p.ancho);
    const alto = num(p.alto);
    if (cant <= 0 || ancho <= 0 || alto <= 0) return;
    const sec = p.tipo;
    const code = (p.codigo || sec).toUpperCase();
    // Color de laminado REAL de la pieza (columna Color del CSV). Puede haber 2
    // colores en un mismo proyecto → el corte se separa por color.
    const lamColor = (p.color && String(p.color).trim()) || STATE.color || '';
    // Veta POR COLOR (no global): si el color de esta pieza lleva veta, la pieza
    // va SOLO acostada (su alto a lo largo del lado largo de la hoja = veta).
    const vetaH = !!lookupColor(lamColor).veta;

    if (!CUT_COLOR_MAP[code]) {
      const idx = Object.keys(usedCodes[sec] || {}).length;
      const palette = CUT_COLORS[sec] || ['#888'];
      CUT_COLOR_MAP[code] = palette[idx % palette.length];
      if (!usedCodes[sec]) usedCodes[sec] = {};
      usedCodes[sec][code] = true;
    }

    const dA = aj['dAncho_' + sec] || 0;
    const dH = aj['dAlto_' + sec] || 0;
    const aw = +(ancho + dA).toFixed(1);
    const ah = +(alto + dH).toFixed(1);

    // Base ID estable de la pieza padre — STATE.pieces le asignó un id; si por
    // algún motivo no, fabricamos uno determinístico con sus dimensiones.
    const baseId = p.id || `${code}_${ancho}x${alto}`;

    for (let i = 0; i < cant; i++) {
      const iid = `${baseId}__${i}`;
      pieces.push({
        iid, w: aw, h: ah, sec, code,
        color: CUT_COLOR_MAP[code], lamColor, origW: ancho, origH: alto,
        vetaH, noRotate: vetaH,
      });
    }
  });

  // Lo que la OC pide y todavía nadie asignó: entra al corte por su medida,
  // con la familia sola de etiqueta. Al asignarle el tipo, la pieza sale de
  // acá y entra por STATE.pieces — el total de la hoja no cambia.
  piezasOCSinTipo().forEach((p, idx) => {
    const cant = int(p.cant), ancho = num(p.ancho), alto = num(p.alto);
    if (cant <= 0 || ancho <= 0 || alto <= 0) return;
    const sec = p.familia;
    const code = sec + '?';
    if (!CUT_COLOR_MAP[code]) {
      const palette = CUT_COLORS[sec] || ['#888'];
      CUT_COLOR_MAP[code] = palette[palette.length - 1];
    }
    const lamColor = STATE.color || '';
    const vetaH = !!lookupColor(lamColor).veta;
    const dA = aj['dAncho_' + sec] || 0, dH = aj['dAlto_' + sec] || 0;
    const aw = +(ancho + dA).toFixed(1), ah = +(alto + dH).toFixed(1);
    for (let i = 0; i < cant; i++) {
      pieces.push({
        iid: `OC_${sec}_${ancho}x${alto}_${idx}__${i}`, w: aw, h: ah, sec, code,
        color: CUT_COLOR_MAP[code], lamColor, origW: ancho, origH: alto,
        vetaH, noRotate: vetaH, sinTipo: true,
      });
    }
  });

  // Antepechos SCUDO — se cortan del mismo laminado (no van en STATE.pieces)
  (STATE.antepechos || []).forEach((ap, idx) => {
    const cant = int(ap.cant), ancho = num(ap.ancho), alto = num(ap.alto);
    if (cant <= 0 || ancho <= 0 || alto <= 0) return;
    const code = 'AN' + Math.round(alto) + '-' + ancho;
    if (!CUT_COLOR_MAP[code]) CUT_COLOR_MAP[code] = '#B48EAD';
    const dA = aj['dAncho_PN'] || 0, dH = aj['dAlto_PN'] || 0;
    const aw = +(ancho + dA).toFixed(1), ah = +(alto + dH).toFixed(1);
    const lamColor = (ap.color && String(ap.color).trim()) || STATE.color || '';
    const vetaH = !!lookupColor(lamColor).veta;
    for (let i = 0; i < cant; i++) {
      pieces.push({
        iid: `AP_${ancho}x${alto}_${idx}__${i}`, w: aw, h: ah, sec: 'AP', code,
        color: CUT_COLOR_MAP[code], lamColor, origW: ancho, origH: alto,
        vetaH, noRotate: vetaH,
      });
    }
  });

  pieces.sort((a, b) => b.w * b.h - a.w * a.h);
  return pieces;
}

// Empaca piezas en hojas. Devuelve { sheets:[{pieces,W,H}], unplaced:[] }.
// Si hojaVal === 'auto' y color con veta: prueba 366×152 y 305×122, elige mejor por hoja.
// Caso contrario: hoja única fija (W,H pasados como parámetros del select).
// Tamaños de hoja disponibles (elegidos por el usuario en el corte). Cada uno = {W,H}
// con W = lado largo. Default: 5×12 (366×152).
function cutSizeCandidates() {
  const keys = (STATE.cutSizes && STATE.cutSizes.length) ? STATE.cutSizes : ['5x12'];
  const out = keys.map(k => {
    const f = SHEET_FORMATS[k];
    if (!f) return null;
    const parts = f.value.split(',').map(Number);
    return { W: parts[0], H: parts[1], key: k };
  }).filter(Boolean);
  return out.length ? out : [{ W: 366, H: 152, key: '5x12' }];
}

// Empaca UNA lista de piezas (de un mismo color) en hojas, eligiendo por cada hoja
// nueva el tamaño (de los disponibles) que MÁS piezas coloque; a igualdad de piezas,
// la hoja de MENOR área (menos desperdicio). Devuelve hojas con {pieces,W,H}.
function packSheets(pieces, gap, candidatesOverride, sobranteCandidates) {
  const sheets = [];
  let remaining = [...pieces];

  // ── Fase 1: cortar de SOBRANTES de almacén (retazos verdes) antes de usar hoja nueva.
  // Cada sobrante se puede usar hasta su cantidad DISPONIBLE; se elige en cada vuelta el
  // que mejor se aprovecha con las piezas que faltan. Cada hoja lleva su código de sobrante.
  if (sobranteCandidates && sobranteCandidates.length) {
    const stock = [];
    sobranteCandidates.forEach(s => { const n = Math.max(1, s.qtyLeft || 1); for (let q = 0; q < n; q++) stock.push(s); });
    let safetyS = stock.length + 5;
    while (remaining.length > 0 && stock.length > 0 && safetyS-- > 0) {
      let best = null, bestIdx = -1, bestScore = -Infinity;
      for (let si = 0; si < stock.length; si++) {
        const cand = stock[si];
        const r = packOneSheet(remaining, cand.W - 2 * SHEET_MARGIN_CM, cand.H - 2 * SHEET_MARGIN_CM, gap);
        if (r.placed.length === 0) continue;
        const placedArea = r.placed.reduce((s, p) => s + p.pw * p.ph, 0);
        const sc = placedArea / (cand.W * cand.H) + placedArea * 1e-9;
        if (sc > bestScore) { bestScore = sc; best = r; bestIdx = si; }
      }
      if (!best) break;
      const cand = stock[bestIdx];
      const placedShifted = best.placed.map(p => ({ ...p, x: p.x + SHEET_MARGIN_CM, y: p.y + SHEET_MARGIN_CM }));
      sheets.push({ pieces: placedShifted, W: cand.W, H: cand.H, sobrante: cand.code });
      remaining = best.leftover;
      stock.splice(bestIdx, 1);
    }
  }

  let safety = 400;
  const candidates = (candidatesOverride && candidatesOverride.length) ? candidatesOverride : cutSizeCandidates();

  while (remaining.length > 0 && safety-- > 0) {
    let bestResult = null, bestSize = null, bestScore = -Infinity;
    for (const cand of candidates) {
      const usableW = cand.W - 2 * SHEET_MARGIN_CM;
      const usableH = cand.H - 2 * SHEET_MARGIN_CM;
      const r = packOneSheet(remaining, usableW, usableH, gap);
      if (r.placed.length === 0) continue;
      // Prioriza APROVECHAMIENTO de área (área colocada ÷ área de la hoja): así una hoja
      // grande bien llena le gana a una chica con muchas piezas pero mucho desperdicio.
      // Antes se priorizaba la CANTIDAD de piezas, lo que llenaba hojas chicas de piezas
      // angostas (1 columna, ~55%) en vez de usar la hoja grande (2 columnas).
      const placedArea = r.placed.reduce((s, p) => s + p.pw * p.ph, 0);
      const score = placedArea / (cand.W * cand.H) + placedArea * 1e-9;
      if (score > bestScore) { bestScore = score; bestResult = r; bestSize = cand; }
    }
    if (!bestResult || bestResult.placed.length === 0) break;
    const placedShifted = bestResult.placed.map(p => ({ ...p, x: p.x + SHEET_MARGIN_CM, y: p.y + SHEET_MARGIN_CM }));
    sheets.push({ pieces: placedShifted, W: bestSize.W, H: bestSize.H });
    remaining = bestResult.leftover;
  }
  return { sheets, unplaced: remaining };
}

// Empaca TODAS las piezas separando por color de laminado (lamColor). Piezas de
// colores distintos nunca comparten hoja. Cada hoja resultante lleva su lamColor.
function cutSizesDeColor(cName) {
  const sel = STATE.cutSizesPorColor && STATE.cutSizesPorColor[cName];
  if (sel && sel.length) { const s = sel.filter(f => f !== '4x8'); if (s.length) return s; }
  const disp = formatosDeColor(cName);
  if (!disp.length) return (STATE.cutSizes && STATE.cutSizes.length) ? STATE.cutSizes.slice() : ['5x12'];
  return disp.includes('5x12') ? ['5x12'] : [disp[0]];
}
function candidatosDeColor(cName) {
  return cutSizesDeColor(cName).map(f => {
    const sf = SHEET_FORMATS[f];
    if (!sf) return null;
    const p = sf.value.split(',').map(Number);
    return { W: p[0], H: p[1], key: f };
  }).filter(Boolean);
}
// ────────────── Sobrantes de almacén (retazos verdes del Excel) ──────────────
function _sobVerde(cell) {
  if (!cell || !cell.s || cell.s.patternType !== 'solid') return false;
  const fg = cell.s.fgColor;
  if (!fg || !fg.rgb) return false;
  let hex = String(fg.rgb).toUpperCase();
  if (hex.length === 8) hex = hex.slice(2);
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return g >= 120 && g > r + 20 && g > b + 20;
}
function parseSobrantesWb(wb) {
  const out = [];
  const numOf = c => { if (!c || c.v == null) return null; const v = c.v; if (typeof v === 'number') return v; const f = parseFloat(String(v).replace(',', '.')); return isNaN(f) ? null : f; };
  const tablas = [{ esp: 3, cod: 0, largo: 1, ancho: 3, disp: 4 }, { esp: 12, cod: 11, largo: 12, ancho: 14, disp: 15 }];
  (wb.SheetNames || []).forEach(sn => {
    const ws = wb.Sheets[sn];
    if (!ws || !ws['!ref']) return;
    const rng = XLSX.utils.decode_range(ws['!ref']);
    const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    for (let r = 2; r <= rng.e.r; r++) {
      tablas.forEach(t => {
        const cCod = cell(r, t.cod), cDisp = cell(r, t.disp);
        if (!cCod || cCod.v == null) return;
        if (!_sobVerde(cDisp)) return;
        const largo = numOf(cell(r, t.largo)), ancho = numOf(cell(r, t.ancho));
        if (!largo || !ancho) return;
        const qty = numOf(cDisp);
        const cod = String(cCod.v).trim();
        const m = cod.match(/(\d{3,5})/);
        out.push({ colorNum: m ? m[1] : '', esp: t.esp, largoM: largo, anchoM: ancho, qty: (qty && qty > 0) ? Math.round(qty) : 1, code: cod, hoja: sn });
      });
    }
  });
  return out;
}
function renderSobrantesStatus() {
  const el = $('sobrantes-status'); if (!el) return;
  const btnClr = $('btn-limpiar-sobrantes');
  const s = STATE.sobrantes || [];
  if (!s.length) { el.textContent = 'Sin sobrantes cargados.'; if (btnClr) btnClr.style.display = 'none'; return; }
  const nColores = new Set(s.map(x => x.colorNum)).size;
  el.innerHTML = `✅ <b>${s.length}</b> sobrantes verdes · <b>${nColores}</b> colores · 3mm: ${s.filter(x => x.esp === 3).length} · 12mm: ${s.filter(x => x.esp === 12).length}`;
  if (btnClr) btnClr.style.display = '';
}
function cargarSobrantesDesdeArchivo(file) {
  const rd = new FileReader();
  rd.onload = ev => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellStyles: true });
      STATE.sobrantes = parseSobrantesWb(wb);
      renderSobrantesStatus();
    } catch (err) {
      const el = $('sobrantes-status'); if (el) el.textContent = 'Error leyendo el Excel: ' + err.message;
    }
  };
  rd.readAsArrayBuffer(file);
}

// Espesor del proyecto para elegir la tabla de sobrantes: SUPERIOR 2.0 = 3mm, resto = 12mm.
function espesorProyectoSobrante() {
  return (STATE.linea && String(STATE.linea).toUpperCase().includes('SUPERIOR')) ? 3 : 12;
}
// Número de color (2047, 2048…) de un color de laminado, para cruzar con los sobrantes.
function numeroColorLam(cName) {
  const info = lookupColor(cName);
  const code = (info && info.code) || cName || '';
  const m = String(code).match(/(\d{3,5})/);
  return m ? m[1] : null;
}
// Sobrantes verdes que aplican a un color (por número) y al espesor del proyecto.
function sobrantesParaColor(cName) {
  if (!STATE.usarSobrantes || !STATE.sobrantes || !STATE.sobrantes.length) return [];
  const colorNum = numeroColorLam(cName);
  if (!colorNum) return [];
  const esp = espesorProyectoSobrante();
  return STATE.sobrantes
    .filter(s => s.colorNum === colorNum && s.esp === esp && s.largoM > 0 && s.anchoM > 0)
    .map(s => ({ W: Math.round(s.largoM * 100), H: Math.round(s.anchoM * 100), code: s.code, qtyLeft: Math.max(1, s.qty || 1) }));
}

function packAllColors(cutPieces, gap) {
  const order = [];
  const byColor = {};
  cutPieces.forEach(p => {
    const k = p.lamColor || '';
    if (!byColor[k]) { byColor[k] = []; order.push(k); }
    byColor[k].push(p);
  });
  const sheets = [];
  const unplaced = [];
  order.forEach(k => {
    const cands = candidatosDeColor(k);
    const sobs = sobrantesParaColor(k);
    const r = packSheets(byColor[k], gap, cands.length ? cands : undefined, sobs);
    r.sheets.forEach(sh => sheets.push(Object.assign({}, sh, { lamColor: k })));
    unplaced.push(...r.unplaced);
  });
  return { sheets, unplaced };
}

// Orientaciones permitidas para una pieza:
//   vetaH        → SOLO acostada (alto a lo largo del lado largo/W de la hoja = rotada)
//   forceRotated → orientación fijada a mano por el usuario (true=rotada, false=normal)
//   libre        → ambas
function pieceOrientations(p) {
  if (p.vetaH) return { normal: false, rotated: true };
  if (p.forceRotated === true)  return { normal: false, rotated: true };
  if (p.forceRotated === false) return { normal: true,  rotated: false };
  return { normal: true, rotated: true };
}

function packOneSheet(pieces, W, H, gap) {
  let freeRects = [{ x: 0, y: 0, w: W, h: H }];
  const placed = [];
  const remaining = [];
  const sorted = [...pieces].sort((a, b) => b.w * b.h - a.w * a.h);

  for (const p of sorted) {
    let best = null, bestScore = Infinity, bestRot = false;
    const _o = pieceOrientations(p);
    const tryNormal  = _o.normal;
    const tryRotated = _o.rotated;
    for (const rect of freeRects) {
      // Orientación original
      if (tryNormal && p.w + gap <= rect.w + 0.01 && p.h + gap <= rect.h + 0.01) {
        const score = Math.min(rect.w - p.w, rect.h - p.h);
        if (score < bestScore) { bestScore = score; best = rect; bestRot = false; }
      }
      // Rotada
      if (tryRotated && p.h + gap <= rect.w + 0.01 && p.w + gap <= rect.h + 0.01) {
        const score = Math.min(rect.w - p.h, rect.h - p.w);
        if (score < bestScore) { bestScore = score; best = rect; bestRot = true; }
      }
    }
    if (best) {
      const pw = bestRot ? p.h : p.w;
      const ph = bestRot ? p.w : p.h;
      placed.push({ ...p, x: best.x, y: best.y, pw, ph, rotated: bestRot });
      freeRects = splitFreeRects(freeRects, { x: best.x, y: best.y, w: pw + gap, h: ph + gap });
      freeRects = pruneFreeRects(freeRects);
    } else remaining.push(p);
  }
  return { placed, leftover: remaining };
}

function splitFreeRects(freeRects, used) {
  const result = [];
  for (const rect of freeRects) {
    if (used.x >= rect.x + rect.w || used.x + used.w <= rect.x ||
        used.y >= rect.y + rect.h || used.y + used.h <= rect.y) {
      result.push(rect); continue;
    }
    if (used.x > rect.x)
      result.push({ x: rect.x, y: rect.y, w: used.x - rect.x, h: rect.h });
    if (used.x + used.w < rect.x + rect.w)
      result.push({ x: used.x + used.w, y: rect.y, w: rect.x + rect.w - (used.x + used.w), h: rect.h });
    if (used.y > rect.y)
      result.push({ x: rect.x, y: rect.y, w: rect.w, h: used.y - rect.y });
    if (used.y + used.h < rect.y + rect.h)
      result.push({ x: rect.x, y: used.y + used.h, w: rect.w, h: rect.y + rect.h - (used.y + used.h) });
  }
  return result;
}

function pruneFreeRects(rects) {
  return rects.filter((r, i) => {
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue;
      const o = rects[j];
      if (o.x <= r.x && o.y <= r.y && o.x + o.w >= r.x + r.w && o.y + o.h >= r.y + r.h) return false;
    }
    return r.w > 1 && r.h > 1;
  });
}

// ─── EDICIÓN MANUAL DEL CUT ───────────────────────────────────────────
// Si el modo manual está activo, distribuye las piezas según el mapeo que tiene
// el usuario (byIid). Cada hoja se packea individualmente con sus piezas asignadas.
function packSheetsManual(pieces, gap) {
  const m = STATE.cutManual;
  if (!m.sheets || !m.sheets.length) m.sheets = [];
  const groups = m.sheets.map(() => []);
  const unassigned = {}; // por color

  pieces.forEach(p => {
    const dec = m.byIid[p.iid];
    const piece = { ...p };
    const col = p.lamColor || '';
    // La asignación vale solo si la hoja destino existe Y es del mismo color.
    const okSheet = dec && typeof dec.sheet === 'number' && dec.sheet < m.sheets.length
      && (m.sheets[dec.sheet].color || '') === col;
    if (okSheet) {
      if (dec.rotated && !piece.noRotate) piece.forceRotated = true;
      else if (dec.rotated === false)     piece.forceRotated = false;
      groups[dec.sheet].push(piece);
    } else {
      (unassigned[col] = unassigned[col] || []).push(piece);
    }
  });

  const finalSheets = m.sheets.map((meta, si) => {
    const usableW = meta.W - 2 * SHEET_MARGIN_CM;
    const usableH = meta.H - 2 * SHEET_MARGIN_CM;
    if (!groups[si].length) return { pieces: [], W: meta.W, H: meta.H, lamColor: meta.color || '', sobrante: meta.sobrante || '' };
    const r = packOneSheet(groups[si], usableW, usableH, gap);
    const placedShifted = r.placed.map(p => ({ ...p, x: p.x + SHEET_MARGIN_CM, y: p.y + SHEET_MARGIN_CM }));
    if (r.leftover.length) (unassigned[meta.color || ''] = unassigned[meta.color || ''] || []).push(...r.leftover);
    return { pieces: placedShifted, W: meta.W, H: meta.H, lamColor: meta.color || '', sobrante: meta.sobrante || '' };
  });

  // Auto-colocar las piezas sin asignar SOLO en hojas de su mismo color; si no
  // caben, crear hojas nuevas de ese color.
  Object.keys(unassigned).forEach(col => {
    const todo = unassigned[col].slice().sort((a, b) => b.w * b.h - a.w * a.h);
    const stillTodo = [];
    for (const p of todo) {
      let placed = false;
      for (let si = 0; si < finalSheets.length; si++) {
        const sh = finalSheets[si];
        if ((sh.lamColor || '') !== col) continue;
        const usableW = sh.W - 2 * SHEET_MARGIN_CM, usableH = sh.H - 2 * SHEET_MARGIN_CM;
        let freeRects = [{ x: SHEET_MARGIN_CM, y: SHEET_MARGIN_CM, w: usableW, h: usableH }];
        sh.pieces.forEach(pp => { freeRects = splitFreeRects(freeRects, { x: pp.x, y: pp.y, w: pp.pw + gap, h: pp.ph + gap }); });
        freeRects = pruneFreeRects(freeRects);
        const o = pieceOrientations(p);
        let chosen = null, chosenRot = false;
        for (const rect of freeRects) {
          if (o.normal && p.w + gap <= rect.w + 0.01 && p.h + gap <= rect.h + 0.01) { chosen = rect; chosenRot = false; break; }
          if (o.rotated && p.h + gap <= rect.w + 0.01 && p.w + gap <= rect.h + 0.01) { chosen = rect; chosenRot = true; break; }
        }
        if (chosen) {
          const pw = chosenRot ? p.h : p.w, ph = chosenRot ? p.w : p.h;
          sh.pieces.push({ ...p, x: chosen.x, y: chosen.y, pw, ph, rotated: chosenRot });
          m.byIid[p.iid] = { sheet: si, rotated: chosenRot };
          placed = true; break;
        }
      }
      if (!placed) stillTodo.push(p);
    }
    if (stillTodo.length) {
      const auto = packSheets(stillTodo, gap, undefined, sobrantesParaColor(col));
      auto.sheets.forEach(sh => {
        const newIdx = finalSheets.length;
        finalSheets.push(Object.assign({}, sh, { lamColor: col }));
        m.sheets.push({ color: col, W: sh.W, H: sh.H, sobrante: sh.sobrante || '' });
        sh.pieces.forEach(pp => { m.byIid[pp.iid] = { sheet: newIdx, rotated: !!pp.rotated }; });
      });
    }
  });

  return { sheets: finalSheets, unplaced: [] };
}

function cutGap() { return (parseFloat(($('cut-gap') && $('cut-gap').value) || 4)) / 10; }

// "Congelar" el resultado del autopack (por color) al estado manual, para que las
// acciones siguientes (rotar, mover) partan de una base estable. Cada hoja guarda su
// color y su tamaño.
function cutFreezeFrom(sheets) {
  STATE.cutManual.enabled = true;
  STATE.cutManual.byIid = {};
  STATE.cutManual.sheets = sheets.map(sh => ({ color: sh.lamColor || '', W: sh.W, H: sh.H, sobrante: sh.sobrante || '' }));
  sheets.forEach((sh, si) => sh.pieces.forEach(p => { STATE.cutManual.byIid[p.iid] = { sheet: si, rotated: !!p.rotated }; }));
}

function ensureFrozen() {
  if (STATE.cutManual.enabled) return;
  const pieces = buildCutPieces();
  const { sheets } = packAllColors(pieces, cutGap());
  cutFreezeFrom(sheets);
}

// Acciones del usuario sobre piezas individuales
function cutActionRotate(iid) {
  ensureFrozen();
  const piece = buildCutPieces().find(p => p.iid === iid);
  if (piece && piece.noRotate) {
    alert('Esta pieza no se puede rotar (color con veta): va siempre acostada.');
    return;
  }
  const dec = STATE.cutManual.byIid[iid] || { sheet: 0, rotated: false };
  dec.rotated = !dec.rotated;
  STATE.cutManual.byIid[iid] = dec;
  renderCut(); renderKPI(); renderMaterialsList();
}

function cutActionMoveToSheet(iid, targetSheet) {
  ensureFrozen();
  const m = STATE.cutManual;
  const piece = buildCutPieces().find(p => p.iid === iid);
  const col = piece ? (piece.lamColor || '') : '';
  // targetSheet >= sheets.length → crear una hoja NUEVA del color de la pieza.
  if (targetSheet >= m.sheets.length) {
    const cand = cutSizeCandidates()[0];
    m.sheets.push({ color: col, W: cand.W, H: cand.H });
    targetSheet = m.sheets.length - 1;
  }
  const dec = m.byIid[iid] || { sheet: 0, rotated: false };
  dec.sheet = targetSheet;
  m.byIid[iid] = dec;
  renderCut(); renderKPI(); renderMaterialsList();
}

function cutActionAddSheet(color) {
  ensureFrozen();
  const cand = cutSizeCandidates()[0];
  STATE.cutManual.sheets.push({ color: color || '', W: cand.W, H: cand.H });
  renderCut(); renderKPI(); renderMaterialsList();
}

function cutActionRemoveSheet(sheetIdx) {
  if (!STATE.cutManual.enabled) return;
  const hasPieces = Object.values(STATE.cutManual.byIid).some(d => d.sheet === sheetIdx);
  if (hasPieces) { alert('Solo se puede quitar una hoja vacía. Mové las piezas a otra hoja primero.'); return; }
  STATE.cutManual.sheets.splice(sheetIdx, 1);
  Object.values(STATE.cutManual.byIid).forEach(d => { if (d.sheet > sheetIdx) d.sheet--; });
  renderCut(); renderKPI(); renderMaterialsList();
}

function cutActionResetAuto() {
  STATE.cutManual = { enabled: false, byIid: {}, sheets: [] };
  renderCut(); renderKPI(); renderMaterialsList();
}

// Menú flotante que aparece al clickear una pieza en la hoja de corte.
// Permite rotar y mover entre hojas (existentes o crear nueva).
function showCutPieceMenu(pieceEl) {
  // Cerrar cualquier menú abierto
  const existing = document.getElementById('cut-piece-menu');
  if (existing) existing.remove();

  const iid       = pieceEl.dataset.iid;
  const curSheet  = parseInt(pieceEl.dataset.curSheet, 10);
  const noRotate  = pieceEl.dataset.noRotate === '1';
  // Color de la pieza = color de su hoja actual. Solo se puede mover a hojas del mismo color.
  const curColor  = (CUT_SHEETS[curSheet] && CUT_SHEETS[curSheet].lamColor) || '';

  const rect = pieceEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'cut-piece-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${Math.min(rect.right + 8, window.innerWidth - 250)}px;
    top:  ${Math.max(8, Math.min(rect.top, window.innerHeight - 320))}px;
    z-index: 9999;
    background: #11161f;
    border: 1px solid var(--cyan);
    border-radius: 10px;
    padding: 12px 14px;
    min-width: 230px;
    box-shadow: 0 12px 36px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4);
    font-size: 13px;
  `;

  let inner = `
    <div style="font-weight:700; color: var(--cyan); margin-bottom:8px; font-size: 12px; letter-spacing: 0.5px;">EDITAR PIEZA</div>
    <div style="color: var(--text-mute); font-size: 11px; margin-bottom: 10px;">Hoja actual: <b style="color: var(--text);">${curSheet + 1}</b></div>
  `;

  // Rotar
  if (noRotate) {
    inner += `<div style="color: var(--text-mute); font-size: 11px; margin-bottom: 8px; font-style: italic;">⚠ No rotable (color con veta)</div>`;
  } else {
    inner += `<button class="cm-btn" data-action="rotate" style="display:block;width:100%;text-align:left;padding:8px 10px;background:var(--bg-2);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;margin-bottom:6px;font-size:12px;">↻ Rotar 90°</button>`;
  }

  // Mover a hoja existente (SOLO del mismo color)
  inner += `<div style="color: var(--text-mute); font-size: 11px; margin: 10px 0 4px;">Mover a hoja (mismo color):</div>`;
  for (let i = 0; i < CUT_SHEETS.length; i++) {
    if (i === curSheet) continue;
    if (((CUT_SHEETS[i] && CUT_SHEETS[i].lamColor) || '') !== curColor) continue;
    inner += `<button class="cm-btn" data-action="move" data-target="${i}" style="display:block;width:100%;text-align:left;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;margin-bottom:4px;font-size:12px;">→ Hoja ${i + 1}</button>`;
  }
  inner += `<button class="cm-btn" data-action="move" data-target="${CUT_SHEETS.length}" style="display:block;width:100%;text-align:left;padding:6px 10px;background:var(--bg-2);border:1px solid var(--cyan);color:var(--cyan);border-radius:6px;cursor:pointer;margin-bottom:4px;font-size:12px;">+ Nueva hoja (mismo color)</button>`;

  inner += `<button class="cm-btn" data-action="cancel" style="display:block;width:100%;text-align:center;padding:6px;background:transparent;border:none;color:var(--text-mute);cursor:pointer;margin-top:8px;font-size:11px;">cancelar</button>`;
  menu.innerHTML = inner;
  document.body.appendChild(menu);

  // Wire acciones
  menu.querySelectorAll('.cm-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      menu.remove();
      if (action === 'rotate') {
        cutActionRotate(iid);
      } else if (action === 'move') {
        cutActionMoveToSheet(iid, parseInt(btn.dataset.target, 10));
      }
    };
  });

  // Cerrar al hacer click afuera
  setTimeout(() => {
    const closer = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closer);
      }
    };
    document.addEventListener('click', closer);
  }, 50);
}

function renderCutSizesPorColor(colores) {
  const cont = $('cut-sizes');
  if (!cont) return;
  const cols = (colores && colores.length) ? colores : [STATE.color || ''];
  cont.innerHTML = cols.map(c => {
    const ci = lookupColor(c || '');
    const nombre = ci.nuevo || c || '— sin color —';
    const fmts = formatosDeColor(c);
    const disp = fmts.length ? fmts : ['5x12', '4x10'];
    const sel = cutSizesDeColor(c);
    const chks = disp.map(f =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer;"><input type="checkbox" class="cps-size" data-color="${c}" data-fmt="${f}"${sel.includes(f) ? ' checked' : ''}> ${FMT_LABEL[f] || f}</label>`
    ).join('');
    let prem = '';
    if (tienePremium(c, '4x10')) {
      const pon = (STATE.premiumPorColor && STATE.premiumPorColor[c]) ? ' checked' : '';
      prem = `<label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer;color:var(--orange);"><input type="checkbox" class="cps-prem" data-color="${c}"${pon}> 4×10 Premium</label>`;
    }
    return `<div style="border:1px solid var(--border);border-radius:6px;padding:5px 8px;margin-bottom:4px;">
      <div style="font-size:11px;font-weight:600;margin-bottom:3px;">${nombre}</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;">${chks}${prem}</div>
    </div>`;
  }).join('');
  cont.querySelectorAll('.cps-size').forEach(chk => {
    chk.onchange = () => {
      const c = chk.dataset.color;
      const chosen = Array.from(cont.querySelectorAll('.cps-size')).filter(x => x.dataset.color === c && x.checked).map(x => x.dataset.fmt);
      if (!chosen.length) { chk.checked = true; return; }
      STATE.cutSizesPorColor[c] = chosen;
      STATE.cutManual.enabled = false;
      renderCut();
      renderMaterialsList();
    };
  });
  cont.querySelectorAll('.cps-prem').forEach(chk => {
    chk.onchange = () => {
      STATE.premiumPorColor[chk.dataset.color] = chk.checked;
      renderCut();
      renderMaterialsList();
    };
  });
}

function renderCut() {
  const noteEl = $('cut-note');
  const outEl = $('cut-out');
  const legendEl = $('cut-legend');
  const summaryEl = $('cut-summary');
  const termEl = $('cut-term');
  if (!termEl) return;

  const gap = cutGap();
  const gapMm = parseFloat($('cut-gap').value || 4);

  const aj = getCutAdjust();
  const isPata = aj.term === 'pata';
  termEl.value = isPata ? 'Pata (-10cm +2mm)' : 'Zoclo (-6cm +2mm)';

  const pieces = buildCutPieces();

  // Nota de ajustes + veta (por color)
  const vetaColors = [...new Set(pieces.filter(p => p.vetaH).map(p => p.lamColor || ''))].filter(Boolean);
  noteEl.style.display = 'block';
  const vetaNote = vetaColors.length
    ? ` <b style="color: var(--orange);">VETA</b> (${vetaColors.join(', ')}): esas piezas van SIEMPRE acostadas (horizontal), no rotan.`
    : '';
  noteEl.innerHTML =
    `<b>Ajuste ${isPata ? 'Pata' : 'Zoclo'}:</b> ` +
    `<b style="color: var(--orange);">PL</b> alto −${isPata ? '10' : '6'}cm +2mm = ${isPata ? '−9.8' : '−5.8'}cm, ancho +2mm. ` +
    `<b style="color: var(--orange);">PT y MG</b> alto +2mm, ancho +2mm. ` +
    `<b style="color: var(--text-dim);">PN</b> sin ajuste. Sangría: ${gapMm} mm. Borde descartable: 3mm/lado.${vetaNote}`;

  if (pieces.length === 0) {
    outEl.innerHTML = `<div class="empty-state"><span class="empty-icon">✂</span>Llena <b>CAPTURAR</b> primero.</div>`;
    legendEl.innerHTML = '';
    summaryEl.innerHTML = '';
    const cb0 = $('cut-color-banner'); if (cb0) cb0.style.display = 'none';
    return;
  }

  // Colores presentes (orden de aparición)
  const coloresPresentes = [...new Set(pieces.map(p => p.lamColor || ''))];
  renderCutSizesPorColor(coloresPresentes);

  // ─── Banner de color(es)/laminado (visible también al imprimir) ───
  const colorBanner = $('cut-color-banner');
  if (colorBanner) {
    colorBanner.innerHTML = coloresPresentes.map(c => {
      const ci = lookupColor(c || '');
      const chips = [];
      if (ci.codigoNuevo) chips.push(`<span class="ccb-chip"><span class="ccb-chip-label">CÓD.</span>${ci.codigoNuevo}</span>`);
      if (!chips.length && !ci.code) chips.push(`<span class="ccb-chip" style="border-color: var(--amber); color: var(--amber);">⚠ sin código</span>`);
      return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">` +
        `<span class="ccb-name">${(ci.nuevo || c) || '— sin color —'}</span>` +
        `<span class="ccb-codes">${chips.join('')}</span></div>`;
    }).join('');
    colorBanner.style.display = 'flex';
    colorBanner.style.flexDirection = 'column';
    colorBanner.style.alignItems = 'flex-start';
    colorBanner.style.gap = '4px';
  }

  // Empaque: automático por color, o manual (color-aware).
  const manual = STATE.cutManual.enabled;
  const r = manual ? packSheetsManual(pieces, gap) : packAllColors(pieces, gap);
  const sheets = r.sheets, unplaced = r.unplaced;
  CUT_SHEETS = sheets; // para el menú de pieza (filtrar hojas del mismo color)

  legendEl.innerHTML = Object.entries(CUT_COLOR_MAP).map(([code, col]) =>
    `<div class="leg-item"><div class="leg-col" style="background: ${col};"></div>${code}</div>`
  ).join('');

  // Escala según la hoja MÁS ancha (reservando ~230px para el panel de info izquierdo)
  const maxSheetW = sheets.reduce((m, s) => Math.max(m, s.W), 366);
  const maxW = Math.min(window.innerWidth - 320, 1200);
  const scale = Math.max(0.1, (maxW - 240) / maxSheetW);
  const margin = SHEET_MARGIN_CM;

  let totalArea = 0, usedArea = 0, html = '';

  // Toolbar (badge modo manual + volver a auto)
  const manualBadge = manual
    ? `<span style="background: var(--amber); color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 12px;">MODO MANUAL</span>`
    : `<span style="color: var(--text-mute); font-size: 12px; margin-right: 12px;">Tocá una pieza para editar</span>`;
  html += `<div id="cut-toolbar" style="display:flex; gap:8px; align-items:center; margin-bottom: 14px; flex-wrap: wrap;">
    ${manualBadge}
    <button id="cut-reset-auto" type="button" class="btn-mini" style="padding: 6px 12px; background: var(--bg-2); border:1px solid var(--border); color: ${manual ? 'var(--amber)' : 'var(--text-mute)'}; border-radius: 6px; cursor: ${manual ? 'pointer' : 'default'}; font-size: 12px;" ${manual ? '' : 'disabled'}>↺ Volver a Auto</button>
  </div>`;

  // Agrupar hojas por color (preservando el índice global si de cada hoja)
  const groupsOrder = [];
  const groupMap = {};
  sheets.forEach((s, si) => {
    const k = s.lamColor || '';
    if (!(k in groupMap)) { groupMap[k] = []; groupsOrder.push(k); }
    groupMap[k].push(si);
  });

  // Firma del CORTE de una hoja = geometría (medidas + posiciones de cada pieza),
  // ignorando la etiqueta: dos hojas con los mismos rectángulos en las mismas posiciones
  // son "el mismo dibujo de corte" aunque las piezas se llamen distinto (PNLAT/PNCEN).
  const sheetSig = (sh) => `${sh.sobrante || 'NUEVA'}@${Math.round(sh.W)}x${Math.round(sh.H)}#` +
    sh.pieces.map(p => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.pw)},${Math.round(p.ph)}`).sort().join(';');
  const renderSheet = (sheet, si, count, members, dispNum) => {
    count = count || 1; members = members || [si]; dispNum = dispNum || (si + 1);
    const sheetW = sheet.W, sheetH = sheet.H;
    totalArea += sheetW * sheetH * count;
    const sheetUsed = sheet.pieces.reduce((s, p) => s + p.pw * p.ph, 0);
    usedArea += sheetUsed * count;
    const pct = sheetW > 0 ? ((sheetUsed / (sheetW * sheetH)) * 100).toFixed(1) : '0.0';
    const canvasW = sheetW * scale, canvasH = sheetH * scale;
    const isEmpty = sheet.pieces.length === 0;
    const removeBtn = (manual && isEmpty)
      ? `<button class="cut-sheet-remove" data-sheet-idx="${si}" title="Quitar hoja vacía" style="padding: 2px 8px; background: var(--bg-2); border:1px solid var(--red); color: var(--red); border-radius: 4px; cursor: pointer; font-size: 11px;">× quitar</button>`
      : '';
    // Panel de info por hoja (incluye COLOR + código → cada hoja se identifica sola)
    const ci = lookupColor(sheet.lamColor || '');
    const sheetArea = sheetW * sheetH;
    const wpct = (100 - parseFloat(pct)).toFixed(1);
    const colorLabel = (ci.nuevo || sheet.lamColor) || '— sin color —';
    const colorCode = ci.code || '⚠ sin código';
    let pieceRows;
    if (count > 1) {
      // Hojas agrupadas: por MEDIDA, con las etiquetas que aparecen en el grupo (variantes)
      // y la cantidad POR HOJA (todas tienen la misma geometría, así que coincide).
      const sizeMap = {};
      members.forEach((mi, mIdx) => {
        const per = {};
        sheets[mi].pieces.forEach(p => {
          const sk = `${p.h}×${p.w}`;
          (sizeMap[sk] = sizeMap[sk] || { h: p.h, w: p.w, codes: {}, n: 0 });
          sizeMap[sk].codes[p.code] = 1;
          per[sk] = (per[sk] || 0) + 1;
        });
        if (mIdx === 0) Object.keys(per).forEach(sk => { if (sizeMap[sk]) sizeMap[sk].n = per[sk]; });
      });
      pieceRows = Object.values(sizeMap).map(g => `<tr><td>${g.h} × ${g.w}</td><td>${Object.keys(g.codes).join(' / ')}</td><td>${g.n}</td></tr>`).join('')
        || `<tr><td colspan="3" style="color:var(--text-mute);">— hoja vacía —</td></tr>`;
    } else {
      const grp = {};
      sheet.pieces.forEach(p => { const key = `${p.h}×${p.w}|${p.code}`; (grp[key] = grp[key] || { h: p.h, w: p.w, code: p.code, n: 0 }).n++; });
      pieceRows = Object.values(grp).map(g => `<tr><td>${g.h} × ${g.w}</td><td>${g.code}</td><td>${g.n}</td></tr>`).join('')
        || `<tr><td colspan="3" style="color:var(--text-mute);">— hoja vacía —</td></tr>`;
    }
    const titleTxt = sheet.sobrante ? `Hoja ${dispNum} · SOBRANTE` : `Hoja ${dispNum}`;
    const multiBadge = count > 1
      ? `<div class="si-multi" style="margin-top:8px;padding:5px 10px;border:2px solid #000;border-radius:6px;background:var(--amber,#f5c542);color:#000;font-weight:800;font-size:17px;text-align:center;letter-spacing:0.5px;">× ${count}</div>
         <div style="text-align:center;font-size:10px;color:var(--text-mute);margin-top:2px;">hojas con el mismo corte</div>`
      : '';
    let s = `<div class="sheet-block" data-sheet-idx="${si}">
      <div class="sheet-info">
        <div class="si-title">${titleTxt} ${removeBtn}</div>
        <table class="si-kv">
          <tr><td>Color</td><td><b>${colorLabel}</b></td></tr>
          <tr><td>Código</td><td>${colorCode}</td></tr>
          ${sheet.sobrante ? `<tr><td>Origen</td><td><b style="color:#16a34a;">SOBRANTE ${sheet.sobrante}</b></td></tr>` : '<tr><td>Origen</td><td>Hoja nueva</td></tr>'}
          <tr><td>Hoja</td><td>${Math.round(sheetW)}×${Math.round(sheetH)} cm</td></tr>
          <tr><td>Cant.</td><td>${count}</td></tr>
          <tr><td>Área utilizada</td><td>${sheetUsed.toFixed(0)} cm² · ${pct}%</td></tr>
          <tr><td>Desperdicio</td><td>${(sheetArea - sheetUsed).toFixed(0)} cm² · ${wpct}%</td></tr>
          <tr><td>Cortes (pzas)</td><td>${sheet.pieces.length}</td></tr>
        </table>
        <table class="si-pieces"><thead><tr><th>Pieza (cm)</th><th>Etiqueta</th><th>Cant</th></tr></thead><tbody>${pieceRows}</tbody></table>
        ${multiBadge}
      </div>
      <div class="sheet-canvas" style="width: ${canvasW}px; height: ${canvasH}px;">`;
    const mPx = margin * scale;
    s += `<div style="position:absolute;left:${mPx}px;top:${mPx}px;width:${(sheetW - 2 * margin) * scale}px;height:${(sheetH - 2 * margin) * scale}px;border:1px dashed rgba(255,140,0,0.55);pointer-events:none;"></div>`;
    for (let x = 50; x < sheetW; x += 50) {
      s += `<div class="cut-grid-line" style="left: ${x * scale}px; top: 0; width: 1px; height: 100%;"></div>`;
      s += `<div class="cut-grid-tick" style="left: ${x * scale + 2}px; top: 2px;">${x}</div>`;
    }
    for (let y = 50; y < sheetH; y += 50) {
      s += `<div class="cut-grid-line" style="left: 0; top: ${y * scale}px; width: 100%; height: 1px;"></div>`;
      s += `<div class="cut-grid-tick" style="left: 2px; top: ${y * scale + 2}px;">${y}</div>`;
    }
    sheet.pieces.forEach(p => {
      const px = p.x * scale, py = p.y * scale, pw = p.pw * scale, ph = p.ph * scale;
      const fontSize = Math.max(7, Math.min(12, pw / 9));
      const dimSize = Math.max(6, fontSize - 2);
      s += `<div class="cut-piece cut-piece-clickable" data-iid="${p.iid}" data-cur-sheet="${si}" data-no-rotate="${p.noRotate ? '1' : '0'}" title="${p.code} · ${p.pw} × ${p.ph} cm${p.rotated ? ' (rot.)' : ''} — clic para editar"
        style="left: ${px}px; top: ${py}px; width: ${pw}px; height: ${ph}px; background: ${p.color}; cursor: pointer;">
        <div class="cut-piece-code" style="font-size: ${fontSize}px;">${p.code}</div>
        <div class="cut-piece-dim" style="font-size: ${dimSize}px;">${p.pw}×${p.ph}</div>
        ${p.rotated ? '<div class="cut-piece-rot">↺ rot.</div>' : ''}
      </div>`;
    });
    if (isEmpty) {
      s += `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:var(--text-mute);font-size:14px;">Hoja vacía · mové piezas acá desde el menú de cada pieza</div>`;
    }
    s += '</div></div>';
    return s;
  };

  let blockNo = 0;
  groupsOrder.forEach(k => {
    const ci = lookupColor(k || '');
    const sap = ci.code ? ` · SAP ${ci.code}` : '';
    const nHojas = groupMap[k].length;
    html += `<div class="cut-color-section" style="margin: 18px 0 6px; padding: 8px 12px; background: var(--bg-2); border-left: 4px solid var(--cyan); border-radius: 6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span style="font-weight:700; color: var(--cyan); letter-spacing:0.3px;">COLOR: ${(ci.nuevo || k) || '— sin color —'}${sap} <span style="color: var(--text-mute); font-weight:500;">· ${nHojas} hoja(s)</span></span>
      <button class="cut-add-sheet-color" data-color="${(k || '').replace(/"/g, '&quot;')}" type="button" style="padding: 5px 10px; background: var(--bg); border:1px solid var(--border); color: var(--cyan); border-radius: 6px; cursor: pointer; font-size: 11px;">+ Hoja vacía (${(ci.nuevo || k) || 'sin color'})</button>
    </div>`;
    // Agrupar TODAS las hojas del color con el MISMO corte (misma geometría: medidas +
    // posiciones, sin importar la etiqueta) → un solo bloque con "× N". No importa si están
    // salteadas. Respeta las reglas: el empaque (color, veta, ajustes, mínimo desperdicio) ya
    // se hizo; esto solo colapsa hojas idénticas para MOSTRAR. En Manual no se colapsa.
    const idxs = groupMap[k];
    if (manual) {
      idxs.forEach(si => { html += renderSheet(sheets[si], si, 1, [si], ++blockNo); });
    } else {
      const bySig = {}, sigOrder = [];
      idxs.forEach(si => {
        const sig = sheetSig(sheets[si]);
        if (!(sig in bySig)) { bySig[sig] = []; sigOrder.push(sig); }
        bySig[sig].push(si);
      });
      sigOrder.forEach(sig => {
        const members = bySig[sig];
        html += renderSheet(sheets[members[0]], members[0], members.length, members, ++blockNo);
      });
    }
  });
  outEl.innerHTML = html;

  // ─── Wire handlers ───
  const resetBtn = document.getElementById('cut-reset-auto');
  if (resetBtn && manual) resetBtn.onclick = () => cutActionResetAuto();
  document.querySelectorAll('.cut-add-sheet-color').forEach(btn => {
    btn.onclick = () => cutActionAddSheet(btn.dataset.color || '');
  });
  document.querySelectorAll('.cut-sheet-remove').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); cutActionRemoveSheet(parseInt(btn.dataset.sheetIdx, 10)); };
  });
  document.querySelectorAll('.cut-piece-clickable').forEach(el => {
    el.onclick = (ev) => { ev.stopPropagation(); showCutPieceMenu(el); };
  });

  const waste = totalArea - usedArea;
  const pctUse = totalArea > 0 ? ((usedArea / totalArea) * 100).toFixed(1) : '0.0';
  const nSinTipo = pieces.filter(p => p.sinTipo).length;
  let avisoSinTipo = '';
  if (nSinTipo > 0) {
    avisoSinTipo = `<div class="banner" style="margin-bottom: 14px; border-color: var(--amber); color: var(--amber);">` +
      `<b>${nSinTipo} pieza(s) de la OC todavía sin tipo</b> — van al corte por su medida y salen marcadas ` +
      `<b>PT? PN? PL?</b>. El corte no cambia cuando les pongás el tipo; lo que falta asignar es para la lista de materiales.</div>`;
  }
  let warnUnplaced = '';
  if (unplaced.length > 0) {
    warnUnplaced = `<div class="banner bad" style="margin-bottom: 14px;"><b>⚠ ${unplaced.length} pieza(s) no caben:</b> ${unplaced.map(p => p.code + ' ' + p.w + '×' + p.h).join(', ')}. Activá una hoja más grande.</div>`;
  }
  const sheetCounts = {};
  sheets.forEach(s => { const k = `${Math.round(s.W)}×${Math.round(s.H)}`; sheetCounts[k] = (sheetCounts[k] || 0) + 1; });
  const sheetMix = Object.entries(sheetCounts).map(([k, n]) => `${n}× ${k}cm`).join(' + ');

  summaryEl.innerHTML = avisoSinTipo + warnUnplaced + `
    <div class="kpi-strip">
      <div class="kpi-cell"><div class="kpi-label">Hojas necesarias</div><div class="kpi-val" style="color: var(--cyan);">${sheets.length}</div></div>
      <div class="kpi-cell"><div class="kpi-label">Mezcla</div><div class="kpi-val" style="font-size:14px;">${sheetMix || '—'}</div></div>
      <div class="kpi-cell"><div class="kpi-label">Aprovechamiento</div><div class="kpi-val">${pctUse}%</div></div>
      <div class="kpi-cell"><div class="kpi-label">Desperdicio</div><div class="kpi-val" style="color: var(--red);">${(waste / 10000).toFixed(2)} m²</div></div>
    </div>`;

  const coloresTxt = coloresPresentes.map(c => {
    const ci = lookupColor(c || '');
    return (c || '—') + (ci.code ? ` (${ci.code})` : '');
  }).join(' + ');
  const sizesTxt = cutSizeCandidates().map(s => `${s.W}×${s.H}`).join(' / ');
  $('cut-print-meta').textContent =
    `EXP: ${STATE.exp || '—'} · ${STATE.obra || '—'} · COLOR: ${coloresTxt} · Hojas: ${sizesTxt} · ${termEl.value} · Sangría: ${gapMm} mm · Borde 3mm · ${sheets.length} hoja(s) · ${pctUse}%`;
}

function printCut() {
  renderCut();
  // Ajustar el ancho para que cada hoja de corte entre a lo ancho de A4 vertical
  // (~180 mm ≈ 680 px @96dpi) → entran ~2-3 hojas por página. Se usa zoom (Chrome/Edge).
  const out = $('cut-out');
  if (out) {
    // ancho del bloque = panel de info + lienzo. Medimos el bloque más ancho.
    const anchos = Array.from(out.querySelectorAll('.sheet-block')).map(b => b.offsetWidth || 0);
    const cw = anchos.length ? Math.max.apply(null, anchos) : 0;
    const targetPx = 700;
    out.style.zoom = (cw > targetPx) ? (targetPx / cw).toFixed(3) : '1';
  }
  setTimeout(() => {
    window.print();
    setTimeout(() => { if (out) out.style.zoom = ''; }, 500);
  }, 200);
}

// ════════════════════════════════════════════════════════════════════
//   PIECE STATE MUTATION (stepper en VERIFICACIÓN)
// ════════════════════════════════════════════════════════════════════
function bumpPiece(code, delta) {
  // Wrapper legacy: si hay varias piezas con el mismo código, opera sobre la primera
  return bumpPieceRow(code, '', '', delta);
}

// Cambia la cantidad de una pieza identificada por (código, ancho, alto).
// Si rowAncho y rowAlto vienen vacíos, se aplica a la primera pieza con ese código.
function bumpPieceRow(code, rowAncho, rowAlto, delta) {
  const tipo = TIPO_BY_CODE[code];
  if (!tipo) return;
  const areaAct = STATE.areaActual || 'Área 1';
  const inArea = p => (p.area || 'Área 1') === areaAct;
  const ra = rowAncho ? parseInt(rowAncho) : null;
  const rh = rowAlto  ? parseInt(rowAlto)  : null;
  let target;
  if (ra != null && rh != null) {
    target = STATE.pieces.find(p =>
      (p.codigo || '').toUpperCase() === code &&
      int(p.ancho) === ra && int(p.alto) === rh && inArea(p));
  } else {
    target = STATE.pieces.find(p => (p.codigo || '').toUpperCase() === code && inArea(p));
  }
  if (!target) {
    if (delta < 0) return;
    target = {
      id: uid(), tipo, codigo: code,
      ancho: ra || '', alto: rh || '',
      cant: 0, detalle: '', flag: false, area: areaAct,
    };
    STATE.pieces.push(target);
  }
  target.cant = Math.max(0, int(target.cant) + delta);
  if (target.cant === 0) {
    STATE.pieces = STATE.pieces.filter(p => p !== target);
  }
  renderAll();
}

// Sube/baja la cantidad de una pieza por su id estable (stepper de una fila existente).
function bumpPieceById(id, delta) {
  const p = STATE.pieces.find(x => String(x.id) === String(id));
  if (!p) return;
  p.cant = Math.max(0, int(p.cant) + delta);
  if (p.cant === 0) STATE.pieces = STATE.pieces.filter(x => x !== p);
  renderAll();
}

// Elimina una pieza por su id estable.
function delPieceById(id) {
  STATE.pieces = STATE.pieces.filter(x => String(x.id) !== String(id));
  renderAll();
}

function setPieceDim(code, dim, value) {
  return setPieceDimRow(code, '', '', dim, value);
}

// Cambia ancho/alto de una pieza por su id estable. NO re-renderiza la hoja para preservar el
// foco mientras se escribe. Es la vía correcta al editar una medida existente (evita que al
// escribir el 2º dígito la pieza ya no se encuentre por sus medidas viejas).
function setPieceDimById(id, dim, value) {
  const p = STATE.pieces.find(x => String(x.id) === String(id));
  if (!p) return;
  p[dim] = value;
  renderKPI();
  renderMaterialsList();
  renderCut();
  renderValidation();
}

// Vía de respaldo: cambia medida por (código, ancho, alto) del área actual. La usa la fila
// vacía (sin pieza aún); las filas con pieza usan setPieceDimById.
function setPieceDimRow(code, rowAncho, rowAlto, dim, value) {
  const tipo = TIPO_BY_CODE[code];
  if (!tipo) return;
  const areaAct = STATE.areaActual || 'Área 1';
  const inArea = p => (p.area || 'Área 1') === areaAct;
  const ra = rowAncho ? parseInt(rowAncho) : null;
  const rh = rowAlto  ? parseInt(rowAlto)  : null;
  let target;
  if (ra != null && rh != null) {
    target = STATE.pieces.find(p =>
      (p.codigo || '').toUpperCase() === code &&
      int(p.ancho) === ra && int(p.alto) === rh && inArea(p));
  } else {
    target = STATE.pieces.find(p => (p.codigo || '').toUpperCase() === code && inArea(p));
  }
  if (!target) {
    target = { id: uid(), tipo, codigo: code, ancho: '', alto: '', cant: 0, detalle: '', flag: false, area: areaAct };
    STATE.pieces.push(target);
  }
  target[dim] = value;
  renderKPI();
  renderMaterialsList();
  renderCut();
  renderValidation();
}

// ────────────── UI de tabla OC parseada (editable) ──────────────
function renderOCParsedTable() {
  const block = $('oc-parsed-block');
  const cont = $('oc-parsed-table');
  const summary = $('oc-parsed-summary');
  if (!block || !cont) return;
  const rows = STATE.ocRowsEdit || [];
  if (rows.length === 0) {
    block.style.display = 'none';
    return;
  }
  block.style.display = '';
  const total = rows.reduce((s, r) => s + r.cant, 0);
  const byFam = { PT: 0, PN: 0, PL: 0, MG: 0 };
  rows.forEach(r => { byFam[r.familia] = (byFam[r.familia] || 0) + r.cant; });
  summary.innerHTML = `<b style="color: var(--green)">${rows.length}</b> renglones · <b style="color: var(--green)">${total}</b> piezas · PT=${byFam.PT} PN=${byFam.PN} PL=${byFam.PL} MG=${byFam.MG}`;

  let html = `<div style="display: grid; grid-template-columns: 30px 90px 60px 60px 60px 60px 28px; gap: 6px; padding: 6px 4px; font-size: 9px; letter-spacing: 0.18em; color: var(--text-mute); text-transform: uppercase; font-weight: 700; border-bottom: 1px solid var(--line);">
    <div>#</div><div>Código OC</div><div>Cant</div><div>Ancho</div><div>Alto</div><div>Familia</div><div></div>
  </div>`;
  rows.forEach((r, i) => {
    html += `<div style="display: grid; grid-template-columns: 30px 90px 60px 60px 60px 60px 28px; gap: 6px; padding: 4px; align-items: center; border-bottom: 1px solid var(--line);">
      <div class="muted small">${String(i+1).padStart(2,'0')}</div>
      <input class="input" data-oc-idx="${i}" data-oc-key="codigo" value="${r.codigo}" style="padding: 4px 6px; font-size: 11px;">
      <input class="input" data-oc-idx="${i}" data-oc-key="cant" type="number" value="${r.cant}" style="padding: 4px 6px; font-size: 11px;">
      <input class="input" data-oc-idx="${i}" data-oc-key="ancho" type="number" value="${r.ancho}" style="padding: 4px 6px; font-size: 11px;">
      <input class="input" data-oc-idx="${i}" data-oc-key="alto" type="number" value="${r.alto}" style="padding: 4px 6px; font-size: 11px;">
      <select class="select" data-oc-idx="${i}" data-oc-key="familia" style="padding: 4px 6px; font-size: 11px;">
        <option ${r.familia==='PT'?'selected':''}>PT</option>
        <option ${r.familia==='PN'?'selected':''}>PN</option>
        <option ${r.familia==='PL'?'selected':''}>PL</option>
        <option ${r.familia==='MG'?'selected':''}>MG</option>
      </select>
      <button class="stepper-btn minus" data-oc-del="${i}" title="Eliminar">×</button>
    </div>`;
  });
  cont.innerHTML = html;
}

// ────────────── Parser de la tabla DIVISIONES de la OC ──────────────
// Detecta renglones tipo "PT62 3 PUERTA 0.62 X 1.50" — robusto a:
//  • todo en una sola línea (PDF.js a veces colapsa todo)
//  • espacios variables y NBSP
//  • descripción opcional entre cantidad y medidas
//  • precio con $ pegado o separado, decimal con coma o punto
// ────────────── Parser del HEADER de la OC ──────────────
// Detecta sistema, modelo, color, kap y obra del encabezado.
// Funciona aún si la IA falla, asegurando que los defaults no rompan el sanitizer.
function parseOCHeader(rawText) {
  const out = { sistema: null, modelo: null, kap: null, color: null, obra: null };
  if (!rawText) return out;
  const t = rawText.replace(/\u00A0/g, ' ');

  // SISTEMA: ZOCLO o PATAS
  // Formato típico: "ZOCLO: SI" / "PATAS: NO" o viceversa
  const zocloSi = /\bZOCLO\s*:?\s*SI\b/i.test(t) || /\bZOCLO\b[\s\S]{0,30}\bSI\b/i.test(t);
  const patasSi = /\bPATAS\s*:?\s*SI\b/i.test(t) || /\bPATAS\b[\s\S]{0,30}\bSI\b/i.test(t);
  const zocloNo = /\bZOCLO\s*:?\s*NO\b/i.test(t);
  const patasNo = /\bPATAS\s*:?\s*NO\b/i.test(t);
  if (zocloSi && !patasSi)      out.sistema = 'ZOCLO';
  else if (patasSi && !zocloSi) out.sistema = 'PATAS';
  else if (zocloSi && patasNo)  out.sistema = 'ZOCLO';
  else if (patasSi && zocloNo)  out.sistema = 'PATAS';

  // MODELO: ESTÁNDAR / REFORZADO / REGADERA
  // Formato típico: "MODELO: REFORZADO" o "MODELO: ESTÁNDAR" / "ESTANDAR"
  // MODELO: ESTÁNDAR / REFORZADO / REGADERA
  // Formato 1: "MODELO: REFORZADO" (todo junto)
  // Formato 2: "MODELO:" en una línea, valor en otra separada (PDFs con columnas)
  //   En ese caso buscamos las palabras clave directamente en el texto
  const modeloMatch = t.match(/\bMODELO\s*:?\s*([A-ZÁÉÍÓÚÑ]+)/i);
  if (modeloMatch) {
    const m = modeloMatch[1].toUpperCase().replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U');
    if (m === 'REFORZADO')      out.modelo = 'REFORZADO';
    else if (m === 'ESTANDAR' || m === 'ESTÁNDAR') out.modelo = 'ESTÁNDAR';
    else if (m === 'REGADERA')  out.modelo = 'REGADERA';
  }
  // Fallback: si no se detectó modelo, buscar las palabras sueltas después de "MODELO"
  if (!out.modelo) {
    const idxModelo = t.toUpperCase().indexOf('MODELO');
    if (idxModelo >= 0) {
      const ventana = t.substring(idxModelo, Math.min(idxModelo + 600, t.length)).toUpperCase();
      // Quitar acentos para matchear
      const ventanaNorm = ventana.replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U');
      if (/\bREFORZADO\b/.test(ventanaNorm))      out.modelo = 'REFORZADO';
      else if (/\bESTANDAR\b/.test(ventanaNorm))  out.modelo = 'ESTÁNDAR';
      else if (/\bREGADERA\b/.test(ventanaNorm))  out.modelo = 'REGADERA';
    }
  }

  // KAP (abre puerta de pie): SI o NO
  // Patrón 1: "ABRE PUERTA DE PIE: SI" en la misma línea
  // Patrón 2: "ABRE PUERTA DE PIE:" y SI/NO en líneas siguientes (algunos PDFs ponen el valor 1-3 líneas después)
  let kapMatch = t.match(/ABRE\s+PUERTA\s+DE\s+PIE\s*:?\s*(SI|NO|SELECCIONA)\b/i);
  if (kapMatch) {
    const k = kapMatch[1].toUpperCase();
    if (k === 'SI') out.kap = 'SI';
    else if (k === 'NO') out.kap = 'NO';
  } else {
    // Fallback multilinea: ventana de 200 chars después del label
    const labelIdx = t.search(/ABRE\s+PUERTA\s+DE\s+PIE\b/i);
    if (labelIdx >= 0) {
      const ventana = t.substring(labelIdx, Math.min(labelIdx + 200, t.length));
      // Buscar el primer SI o NO "aislado" (no parte de otra palabra)
      const m = ventana.match(/\b(SI|NO)\b/i);
      if (m) {
        const k = m[1].toUpperCase();
        if (k === 'SI') out.kap = 'SI';
        else if (k === 'NO') out.kap = 'NO';
      }
    }
  }

  // COLOR: línea típica "COLOR:    GRIS METALIZADO MT 240" o "COLOR: ALUMINA 2103"
  // Formato 1: "COLOR:" seguido del valor en la misma línea
  // Formato 2: "COLOR:" en una línea, valor en otra (PDFs con columnas)
  const colorMatch = t.match(/\bCOLOR\s*:?\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 \-]+?)(?=\s{2,}|\s*\n|\s*EMBALAJE|\s*REFUERZO|\s*NOMBRE|\s*ABRE|\s*MINGITORIO|$)/i);
  if (colorMatch) {
    const c = colorMatch[1].trim();
    if (c.length > 3 && c.length < 50 && !/^(SELECCIONA|PRINCIPAL|N\/A|SI|NO)$/i.test(c)) {
      out.color = c;
    }
  }
  // Fallback: buscar nombres conocidos de colores Modumex en el texto
  if (!out.color) {
    const coloresConocidos = [
      /\bGRIS\s+METALIZADO\s+(?:MT\s+)?(\d{3,4})\b/i,
      /\bGRIS\s+METALIZADO\s+\d+\b/i,
      /\bALUMINA\s+\d{3,4}\b/i,
      /\bSKYLINE\s+WALNUT\b/i,
      /\bNEUTRAL\s+OAK\b/i,
      /\bNEGRO\s+EBANO\b/i,
      /\bEBANO\b/i,
      /\bINOX\s+SATIN\b/i,
      /\bGRIS\s+ALUMINA\b/i,
    ];
    for (const re of coloresConocidos) {
      const m = t.match(re);
      if (m) {
        out.color = m[0].trim().replace(/\s+/g, ' ');
        break;
      }
    }
  }

  // OBRA: línea típica "NOMBRE DE LA OBRA: PROYECTO XXX"
  const obraMatch = t.match(/NOMBRE\s+DE\s+LA\s+OBRA\s*:?\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 \-]+?)(?=\s{2,}|\s*\n|\s*GIRO|\s*Otro|$)/i);
  if (obraMatch) {
    const o = obraMatch[1].trim();
    if (o.length > 2 && o.length < 80) out.obra = o;
  }

  // FALLBACK por SUFIJOS: si no detectamos sistema/modelo del header,
  // mirar los códigos de la tabla de divisiones para inferir.
  //   Sufijo "B" en PT/PN → sistema PATAS (alto 170)
  //   Sufijo "R" en PI    → modelo REFORZADO
  //   "PILASTRA REFORZADA" en una línea de la tabla → modelo REFORZADO
  //   Sufijos "A" e "I"   → la OC INCLUYE duchas (no afecta sistema/modelo principal)
  if (!out.sistema) {
    if (/\b(PT|PN)\s?\d+B\b/i.test(t))         out.sistema = 'PATAS';
  }
  if (!out.modelo) {
    if (/\bPI\s?\d+R\b/i.test(t))              out.modelo = 'REFORZADO';
    else if (/\bPILASTRA\s+REFORZADA\b/i.test(t)) out.modelo = 'REFORZADO';
    else if (/\b(PT|PN|PI)\s?\d+(?!R|B|I)/.test(t)) out.modelo = 'ESTÁNDAR';
  }

  return out;
}


function parseOCDivisions(rawText) {
  if (!rawText) return [];
  const t0 = rawText.replace(/\u00A0/g, ' ');

  // Recolectar TODAS las coincidencias en bruto
  const allMatches = [];

  // Patrón A: CÓDIGO + CANT + (desc opc) + ANCHO×ALTO   (formato EPFLEX, EPSILON, MXM)
  //   ej: "PT62 3 0.62 X 1.50 272.61"  o  "PI19 7 PILASTRA 0.19 X 1.80"
  //   IMPORTANTE: el código permite espacio opcional entre prefijo y número (ej "PN 165")
  //   porque PDF.js a veces extrae el sufijo numérico separado cuando viene en otra fuente/color.
  const reCodFirst = /\b(PT\s?\d+[AB]?|PN\s?\d+[AB]?|PI\s?\d+[ARI]?|MG\s?\d+)\b\s+(\d{1,3})\s+(?:[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?\s+)?(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)/gi;

  // Patrón B: CANT + DESCRIPCIÓN + CÓDIGO + ANCHO×ALTO  (formato PALI Curridabat, alguna OC vieja)
  //   ej: "4 Puerta CODIGO PT62 0.62 X 1.50 272.61"
  //       "1 Pilastra COD: PI10R 0.10 X 1.80 71.57"
  //       "1 Panel Lateral COD; PN110 1.10 X 1.50"
  const reCantFirst = /\b(\d{1,3})\s+(?:[A-Za-zÁÉÍÓÚÑáéíóúñ\s:;,]+?\s+)?(PT\s?\d+[AB]?|PN\s?\d+[AB]?|PI\s?\d+[ARI]?|MG\s?\d+)\b\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)/g;

  // ESTRATEGIA A1: línea por línea con patrón A (código primero)
  const lines = t0.split(/[\r\n]+/);
  const reLineaA = /^\s*(PT\s?\d+[AB]?|PN\s?\d+[AB]?|PI\s?\d+[ARI]?|MG\s?\d+)\s+(\d{1,3})\s+(?:[A-ZÁÉÍÓÚÑ\s]{3,30}?\s+)?(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)/i;
  // ESTRATEGIA A2: línea por línea con patrón B (cant primero)
  const reLineaB = /^\s*(\d{1,3})\s+[A-Za-zÁÉÍÓÚÑáéíóúñ\s:;,]+?\s+(PT\s?\d+[AB]?|PN\s?\d+[AB]?|PI\s?\d+[ARI]?|MG\s?\d+)\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)/i;
  for (const line of lines) {
    const cleaned = line.replace(/[ \t]+/g, ' ').trim();
    if (!cleaned) continue;
    let mA = cleaned.match(reLineaA);
    if (mA) {
      const r = buildRowFromMatch([null, mA[1], mA[2], mA[3], mA[4]]);
      if (r) allMatches.push(r);
      continue;
    }
    let mB = cleaned.match(reLineaB);
    if (mB) {
      // Reordenar: [_, cant, codigo, ancho, alto] → buildRowFromMatch espera [_, codigo, cant, ancho, alto]
      const r = buildRowFromMatch([null, mB[2], mB[1], mB[3], mB[4]]);
      if (r) allMatches.push(r);
    }
  }
  const sumLineas = allMatches.reduce((s, r) => s + r.cant, 0);

  // ESTRATEGIA B: barrido global SIEMPRE (no solo cuando línea por línea es débil)
  // Esto sirve como red de seguridad: si PDF.js extrajo el texto raro y la estrategia
  // por línea perdió alguna fila, el barrido global la captura. Después deduplicamos
  // contando apariciones por key (codigo|cant|ancho|alto).
  const bMatches = [];
  {
    const flat = t0.replace(/[ \t]+/g, ' ').replace(/[\r\n]+/g, ' ');
    let m;
    // Reset índices de regex globales
    reCodFirst.lastIndex = 0;
    while ((m = reCodFirst.exec(flat)) !== null) {
      const r = buildRowFromMatch([null, m[1], m[2], m[3], m[4]]);
      if (r) bMatches.push(r);
    }
    reCantFirst.lastIndex = 0;
    while ((m = reCantFirst.exec(flat)) !== null) {
      const r = buildRowFromMatch([null, m[2], m[1], m[3], m[4]]);
      if (r) bMatches.push(r);
    }
  }

  // MERGE INTELIGENTE:
  //   Si B encuentra MÁS apariciones de una pieza específica que A, agregar la diferencia.
  //   Ej: A tiene 0 veces "PN165|2|160|150", B tiene 1 vez → agregar 1
  //       A tiene 1 vez "PT62|3|62|150", B también tiene 1 → no agregar
  //       A tiene 1 vez "PT62|5|62|150", B tiene 1 → no agregar (era OK)
  const keyOf = (r) => r.codigo + '|' + r.cant + '|' + r.ancho + '|' + r.alto;
  const aCount = new Map();
  allMatches.forEach(r => {
    const k = keyOf(r);
    aCount.set(k, (aCount.get(k) || 0) + 1);
  });
  const bCount = new Map();
  bMatches.forEach(r => {
    const k = keyOf(r);
    bCount.set(k, (bCount.get(k) || 0) + 1);
  });
  for (const [k, bN] of bCount) {
    const aN = aCount.get(k) || 0;
    const diff = bN - aN;
    if (diff > 0) {
      // Buscar el primer match en bMatches con esa key y agregarlo "diff" veces
      const piece = bMatches.find(r => keyOf(r) === k);
      if (piece) {
        for (let i = 0; i < diff; i++) {
          allMatches.push({ ...piece });   // copia, para evitar referencias compartidas
        }
      }
    }
  }

  // Dedupe: si una pieza idéntica (codigo+cant+ancho+alto) aparece N veces y no estaba duplicada en la fuente,
  // probablemente es porque se detectó por varias estrategias. Pero NO podemos eliminar siempre,
  // porque la OC PUEDE tener líneas legítimamente repetidas. Heurística: agrupar consecutivos exactos.
  // Por ahora dejamos las repeticiones — el usuario puede borrar las que sobren en la tabla editable.

  // ════════════════════════════════════════════════════════════════════
  // COMBINADOR DE ESTRATEGIAS — A/B (códigos) + C (sin códigos) + D (celda) + E (tupla)
  // ════════════════════════════════════════════════════════════════════
  // Probamos TODAS las estrategias y elegimos:
  //   1) la que matchea exactamente el subtotal declarado en la OC ("X.00 Sub-total Piezas:"), o
  //   2) la que devuelve el TOTAL más alto si no hay subtotal o ninguna matchea.
  // Esto cubre 3 formatos comunes que el parser legacy fallaba:
  //   D — UNICO COSTA VERDE / MMC: "10.00\nPUERTA\n0.60\nX\n1.50\n188.69\n$"
  //       (cantidad N.00 + descripción de familia + medida en líneas separadas)
  //   E — PALI / MAYCA: "1\n0,70\nX\n1,50\n258,98\n$"
  //       (entero suelto + medida + precio, sin descripción)
  //   C — MODUSAL Escuela Alemana: como antes (cantidades y medidas dispersas, validadas por subtotal)
  let subtotalDeclarado = null;
  const subM = t0.match(/(\d{1,3})(?:[.,]00)?\s+sub[\s-]*total\s+piezas/i);
  if (subM) subtotalDeclarado = parseInt(subM[1]);

  const totalAB = allMatches.reduce((s, r) => s + r.cant, 0);

  // Estrategia G (corchetes [PI17] — formato S00011/S00024). Prioridad MÁXIMA
  // si el texto tiene corchetes: ese formato es muy distinto y los demás parsers
  // pueden generar falsos positivos sobre él (ej. v1 captura "PI17" sin corchetes
  // y matchea cantidades equivocadas del resto del documento).
  const gMatches = parseOCCorchetes(t0);
  const totalG = gMatches.reduce((s, r) => s + r.cant, 0);
  if (totalG > 0 && /\[(PT|PN|PI|MG)\s?\d+/.test(t0)) {
    return postPaseRegaderas(gMatches);
  }

  // Estrategia D (descripciones en celda)
  const dMatches = parseOCCeldaPorLinea(t0);
  const totalD = dMatches.reduce((s, r) => s + r.cant, 0);

  // Estrategia E (tupla en líneas)
  const eMatches = parseOCTuplaPorLinea(t0);
  const totalE = eMatches.reduce((s, r) => s + r.cant, 0);

  // Estrategia C (legacy sin códigos, el que ya tenía)
  const cMatches = parseOCSinCodigos(t0);
  const totalC = cMatches.reduce((s, r) => s + r.cant, 0);

  // Post-pase universal aplicado al resultado final: corregir alto=180 ancho≤90
  // si el mismo ancho aparece como PT alto=150 en otro renglón (regaderas).
  // Esto cubre los 3 parsers — antes sólo lo tenía el tupla-por-línea.
  function postPaseRegaderas(rows) {
    if (!rows || rows.length === 0) return rows;
    const ptAnchos150 = new Set();
    rows.forEach(r => {
      if (r.familia === 'PT' && r.alto === 150) ptAnchos150.add(r.ancho);
    });
    rows.forEach(r => {
      // Sólo reclasificar anchos típicos de regadera (60-90).
      // 100 cm queda EXCLUIDO porque PT100 son puertas PMR y las pilastras 100x180
      // son frecuentes como extremo de cubículo PMR (caso S00087).
      if (r.familia === 'PL' && r.alto === 180 && ptAnchos150.has(r.ancho) && r.ancho >= 60 && r.ancho <= 90) {
        r.familia = 'PT';
        r.codigo = 'PT' + r.ancho;
      }
    });
    return rows;
  }

  // Si hay subtotal declarado, preferir el primer parser que lo iguala exactamente.
  // Orden: A/B (códigos pegados — más específico) → D (descripciones) → E (tupla) → C (legacy)
  if (subtotalDeclarado != null && subtotalDeclarado > 0) {
    if (totalAB === subtotalDeclarado && allMatches.length > 0) return postPaseRegaderas(allMatches);
    if (totalD  === subtotalDeclarado && dMatches.length  > 0) return postPaseRegaderas(dMatches);
    if (totalE  === subtotalDeclarado && eMatches.length  > 0) return postPaseRegaderas(eMatches);
    if (totalC  === subtotalDeclarado && cMatches.length  > 0) return postPaseRegaderas(cMatches);
  }

  // Sin subtotal, o ninguno coincide: el de mayor total (si hay empate, el primero en el orden)
  const candidates = [
    { rows: allMatches, total: totalAB, kind: 'A/B' },
    { rows: dMatches,   total: totalD,  kind: 'D'   },
    { rows: eMatches,   total: totalE,  kind: 'E'   },
    { rows: cMatches,   total: totalC,  kind: 'C'   },
  ];
  candidates.sort((a, b) => b.total - a.total);
  return postPaseRegaderas(candidates[0].rows);
}

// ────────────── ESTRATEGIA G — OC con códigos entre corchetes ──────────────
// Formato (S00011/S00024/Orden - SAP-like):
//   [PI17] Pilastra 0.17 x 1.80
//   1.00 PIEZA
// El código entre corchetes es la piedra angular. La cantidad viene en la línea
// siguiente como "N.00 PIEZA". Capturamos código + medida + cantidad.
function parseOCCorchetes(rawText) {
  if (!rawText) return [];
  const t = rawText.replace(/ /g, ' ');
  const lines = t.split('\n');

  const reBracket = /\[(PT\s?\d+[AB]?|PN\s?\d+[AB]?|PI\s?\d+[ARI]?|MG\s?\d+)\]\s*(?:[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+\s+)?(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)/i;
  const reCantPieza = /(\d{1,3})(?:[.,]\d{1,3})?\s*PIEZA/i;

  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(reBracket);
    if (!m) continue;
    let cod = m[1].toUpperCase().replace(/\s+/g, '');
    const ancho_f = parseFloat(m[2].replace(',', '.'));
    const alto_f = parseFloat(m[3].replace(',', '.'));
    if (!(ancho_f > 0.05 && ancho_f < 3 && alto_f > 0.05 && alto_f < 3)) continue;
    // Cantidad: en alguna de las siguientes 1-3 líneas
    let cant = null;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const cm = lines[j].match(reCantPieza);
      if (cm) { cant = parseInt(cm[1]); break; }
    }
    if (cant == null || cant <= 0 || cant > 99) continue;
    let ancho = Math.round(ancho_f * 100);
    let alto = Math.round(alto_f * 100);
    let isRef = false;
    if (/^PI\d+R$/.test(cod)) { isRef = true; alto = 210; cod = cod.replace(/R$/, ''); }
    let fam = '';
    if (cod.startsWith('PT')) fam = 'PT';
    else if (cod.startsWith('PN')) fam = 'PN';
    else if (cod.startsWith('PI')) fam = 'PL';
    else if (cod.startsWith('MG')) fam = 'MG';
    rows.push({ codigo: cod, cant, ancho, alto, familia: fam, reforzado: isRef });
  }
  return rows;
}

// ────────────── ESTRATEGIA D — celda por línea con descripciones ──────────────
// Formato típico:
//   "10.00\nPUERTA\n0.60\nX\n1.50\n188.69\n$"
// Cada celda viene en su propia línea. La cantidad es decimal "N.00" o "N,00".
// La descripción identifica la familia (PUERTA→PT, PILASTRA→PL, PANEL LATERAL→PN, etc.).
function parseOCCeldaPorLinea(rawText) {
  if (!rawText) return [];
  const t = rawText.replace(/ /g, ' ');

  let subtotal = null;
  const subM = t.match(/(\d{1,3})(?:[.,]00)?\s+sub[\s-]*total\s+piezas/i);
  if (subM) subtotal = parseInt(subM[1]);

  // Mapeo familia por descripción (orden importa: "PILASTRA REFORZADA" antes que "PILASTRA")
  const FAM = [
    ['PILASTRA REFORZADA', 'PL', true],
    ['PUERTA',             'PT', false],
    ['PILASTRA',           'PL', false],
    ['PANEL LATERAL',      'PN', false],
    ['PANEL URINAL',       'MG', false],
    ['PANEL MINGITORIO',   'MG', false],
    ['MINGITORIO',         'MG', false],
    ['REGADERA',           'PT', false],
  ];
  function detectFamilia(window) {
    const u = window.toUpperCase();
    for (const [kw, fam, reforz] of FAM) {
      if (u.indexOf(kw) >= 0) return { fam, reforz };
    }
    return null;
  }

  // Buscar todas las cantidades candidatas: "N.00" o "N,00" al inicio de línea.
  // FILTRO: rechazar matches que vengan precedidos por "X\n" (es el ALTO de una
  // medida, no una cantidad de pieza). Validado en s00053: "0.60\nX\n1.70" puede
  // matchear "1.70" como cantidad si no se filtra.
  const reCantDec = /(?:^|\n)\s*(\d{1,3})[.,]00(?:\s|$|\n)/g;
  const reMed = /(\d{1,2}[.,]\d{1,3})\s*[\n\r]?\s*[xX×]\s*[\n\r]?\s*(\d{1,2}[.,]\d{1,3})/;
  const candidatos = [];
  let m;
  while ((m = reCantDec.exec(t)) !== null) {
    const idx = m.index + m[0].search(/\d/);   // posición del primer dígito
    // Filtrar: si los 8 chars anteriores incluyen "X" (sin más números entre medio),
    // este "N.00" es la altura de una medida.
    const before = t.substring(Math.max(0, idx - 8), idx);
    if (/[xX×]\s*$/.test(before)) continue;
    candidatos.push({ idx, cant: parseInt(m[1]) });
  }
  if (candidatos.length === 0) return [];

  const rows = [];
  const usedMed = new Set();
  for (let i = 0; i < candidatos.length; i++) {
    const c = candidatos[i];
    const next = (i + 1 < candidatos.length) ? candidatos[i + 1].idx : t.length;
    const end = Math.min(c.idx + 600, next);
    const window = t.substring(c.idx, end);

    const f = detectFamilia(window);
    if (!f) continue;

    const mm = window.match(reMed);
    if (!mm) continue;
    const ancho_f = parseFloat(mm[1].replace(',', '.'));
    const alto_f  = parseFloat(mm[2].replace(',', '.'));
    if (!(ancho_f > 0.05 && ancho_f < 3 && alto_f > 0.05 && alto_f < 3)) continue;

    const medGlobalIdx = c.idx + window.indexOf(mm[0]);
    if (usedMed.has(medGlobalIdx)) continue;
    usedMed.add(medGlobalIdx);

    let ancho = Math.round(ancho_f * 100);
    let alto  = Math.round(alto_f  * 100);
    // REGADERA → forzar alto≥180 si vino menor
    if (window.toUpperCase().substring(0, 120).indexOf('REGADERA') >= 0 && alto < 160) {
      alto = 180;
    }
    // Si viene "PILASTRA REFORZADA" + medida explícita → respetar la medida tal cual.
    // (s00068 tiene "2.145" en la OC y el checklist real preserva 214.)
    // Solo forzar alto=210 si NO vino una medida (caso muy raro).
    // El alto ya viene de la medida → lo dejamos como está.

    // Construir código: MG usa MG120/MG150 (oficial), las demás familias usan fam+ancho
    let codigo;
    if (f.fam === 'MG') codigo = (alto <= 135) ? 'MG120' : 'MG150';
    else codigo = f.fam + ancho;
    rows.push({
      codigo,
      cant: c.cant,
      ancho, alto,
      familia: f.fam,
      reforzado: f.reforz,
    });
  }

  if (subtotal != null) {
    const sum = rows.reduce((s, r) => s + r.cant, 0);
    if (sum !== subtotal) return [];
  }
  return rows;
}

// ────────────── ESTRATEGIA E — tupla por línea sin descripciones ──────────────
// Formato típico (PALI / MAYCA):
//   "1\n0,70\nX\n1,50\n258,98\n$"
// Cada renglón es una tupla en líneas consecutivas: cantidad entera + medida + precio.
// Sin descripciones de familia → la familia se deduce por dimensión.
function parseOCTuplaPorLinea(rawText) {
  if (!rawText) return [];
  const t = rawText.replace(/ /g, ' ');
  const lines = t.split(/[\r\n]/).map(l => l.trim());

  // Pistas globales del proyecto (afectan la regla por dimensión cuando no hay
  // descripción local). Bug típico: alto=180 ancho≤90 puede ser regadera (PT)
  // o pilastra (PL). Si la OC menciona explícitamente REGADERA/DUCHA → la zona
  // ambigua se interpreta como PT. Si menciona PILASTRA pero NO menciona
  // REGADERA/DUCHA → la zona ambigua se interpreta como PL.
  const hayRegadera = /\b(REGADERA|DUCHA|SHOWER)\b/i.test(t);
  const hayPilastra = /\bPILASTRA\b/i.test(t);

  let subtotal = null;
  const subM = t.match(/(\d{1,3})(?:[.,]00)?\s+sub[\s-]*total\s+piezas/i);
  if (subM) subtotal = parseInt(subM[1]);

  const reInt = /^(\d{1,3})$/;
  const reDec = /^(\d{1,3})[.,](\d{1,3})$/;
  const reX   = /^[xX×]$/;
  const rePrice = /^\d{1,4}[.,]\d{1,2}$/;
  const reMoney = /^\$$/;

  const rows = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(reInt);
    if (!m) { i++; continue; }
    const cant = parseInt(m[1]);
    if (cant <= 0 || cant > 99) { i++; continue; }

    let j = i + 1;
    while (j < lines.length && lines[j] === '') j++;
    let dm = (j < lines.length) ? lines[j].match(reDec) : null;
    if (!dm) { i++; continue; }
    const ancho_f = parseFloat(dm[1] + '.' + dm[2]);
    j++;

    while (j < lines.length && lines[j] === '') j++;
    if (!(j < lines.length && reX.test(lines[j]))) { i++; continue; }
    j++;

    while (j < lines.length && lines[j] === '') j++;
    dm = (j < lines.length) ? lines[j].match(reDec) : null;
    if (!dm) { i++; continue; }
    const alto_f = parseFloat(dm[1] + '.' + dm[2]);
    j++;

    if (!(ancho_f > 0.05 && ancho_f < 3 && alto_f > 0.05 && alto_f < 3)) { i++; continue; }

    // Confirmar que viene un precio o $ cerca (reduce falsos positivos)
    let confirm = false;
    for (let k = j; k < Math.min(lines.length, j + 6); k++) {
      if (rePrice.test(lines[k]) || reMoney.test(lines[k])) { confirm = true; break; }
    }
    if (!confirm) { i++; continue; }

    const a = Math.round(ancho_f * 100);
    const h = Math.round(alto_f * 100);

    // Antes de decidir por dimensión, mirar si hay descripción cerca.
    // Calculamos el offset real de la línea de la cantidad sumando largos previos
    // (con saltos de línea) — robusto frente a líneas duplicadas (ej. "1\n0,70\nX...").
    let cantOffset = 0;
    for (let k = 0; k < i; k++) cantOffset += (lines[k] || '').length + 1;
    const winStart = Math.max(0, cantOffset - 200);
    const winEnd = Math.min(t.length, cantOffset + 50);
    let windowBefore = t.substring(winStart, winEnd).toUpperCase();
    // Filtrar labels del formulario que contienen palabras-clave (ej.
    // "ABRE PUERTA DE PIE" — la palabra "PUERTA" ahí NO es descripción de pieza).
    windowBefore = windowBefore.replace(/\bABRE\s+PUERTA[^.\n]*?\bPIE\b/g, '');
    let famByDesc = null;
    let isReforzada = false;
    if (/\bPILASTRA\s+REFORZADA\b/.test(windowBefore)) { famByDesc = 'PL'; isReforzada = true; }
    else if (/\bPILASTRA\b/.test(windowBefore))        famByDesc = 'PL';
    else if (/\bMINGITORIO\b/.test(windowBefore))      famByDesc = 'MG';
    else if (/\bPANEL\s+URINAL\b/.test(windowBefore))  famByDesc = 'MG';
    else if (/\bPANEL\s+LATERAL\b/.test(windowBefore)) famByDesc = 'PN';
    else if (/\bPUERTA\b/.test(windowBefore))          famByDesc = 'PT';
    else if (/\bREGADERA\b/.test(windowBefore))        famByDesc = 'PT';

    let fam;
    if (famByDesc) {
      fam = famByDesc;
    } else {
      // Heurística por dimensión + pistas globales del proyecto
      // ATENCIÓN: alto=180 con ancho chico es ambiguo:
      //   • PILASTRA estándar (alto 180 PL) — más común en proyectos sin regaderas
      //   • REGADERA (alto 180 PT con sufijo A) — sólo si OC menciona regadera/ducha
      // Resolvemos con las pistas globales: si el texto OC dice REGADERA/DUCHA
      // → la zona ambigua se interpreta como PT (regadera). Si dice PILASTRA y
      // NO dice REGADERA → PL. Si no dice ninguna → asumimos PL (más común).
      if (h >= 200)                              fam = 'PL';   // pilastras reforzadas
      else if (h >= 170 && h < 200) {
        // Zona PL/regadera ambigua
        if (a > 90)                              fam = 'PL';   // ancho > 90 jamás es PT
        else if (hayRegadera)                    fam = 'PT';   // regadera explícita
        else                                     fam = 'PL';   // default conservador
      }
      else if (h === 120 && a <= 90)             fam = 'MG';
      else if (a >= 100 && h === 150)            fam = 'PN';
      else if (a <= 100 && h === 150)            fam = 'PT';
      else                                       fam = 'PT';
    }

    // Construir código: MG usa MG120/MG150 oficial
    let codigoStr;
    if (fam === 'MG') codigoStr = (h <= 135) ? 'MG120' : 'MG150';
    else codigoStr = fam + a;
    rows.push({
      codigo: codigoStr,
      cant, ancho: a, alto: h, familia: fam, reforzado: famByDesc === 'PL' && /\bREFORZADA\b/.test(windowBefore),
    });
    if (rows[rows.length-1].reforzado) rows[rows.length-1].alto = 210;
    i = j;
  }

  // POST-PASE — patrón "mismo ancho con dos alturas":
  // Si un ancho A aparece como PT alto=150 (puerta normal) Y también como PL
  // alto=180 (clasificada por defecto como pilastra), reclasificar el alto=180
  // como PT (regadera). Las regaderas suelen acompañar hileras de baños del
  // mismo ancho de cubículo; pilastras ≥60cm con alto exacto 180 son raras
  // cuando coexiste un PT de mismo ancho con alto 150.
  // Validado en s00010 (PT70 cant=10 + 2 piezas 70x180 = regaderas)
  // y s00071 (PT85 cant=2 + 2 piezas 85x180 = regaderas).
  const ptAnchos150 = new Set();
  rows.forEach(r => {
    if (r.familia === 'PT' && r.alto === 150) ptAnchos150.add(r.ancho);
  });
  rows.forEach(r => {
    if (r.familia === 'PL' && r.alto === 180 && ptAnchos150.has(r.ancho) && r.ancho >= 60 && r.ancho <= 100) {
      r.familia = 'PT';
      r.codigo = 'PT' + r.ancho;
    }
  });

  if (subtotal != null) {
    const sum = rows.reduce((s, r) => s + r.cant, 0);
    if (sum !== subtotal) return [];
  }
  return rows;
}

// ────────────── Parser para OC sin códigos pegados ──────────────
// Esta función busca patrones "CANT + MEDIDA" donde la cantidad y la medida
// están EN LA MISMA LÍNEA o muy cerca. Es más robusta que la correlación por orden
// porque NO depende del orden en que PDF.js extrajo el texto.
//
// Patrones soportados:
//   "6 397.60$ ... 1.50 X 1.50"     → cant=6, ancho=150, alto=150 (otro renglón)
//   "6  1.50 X 1.50  $ 397.60"      → cant=6, ancho=150, alto=150 (mismo renglón)
//   "1.50 X 1.50 ... 6"             → no detectable confiablemente
//
// Usamos validación con el SUBTOTAL: si encontramos "21.00 Sub-total Piezas:"
// la suma de cantidades detectadas debe coincidir con 21.
function parseOCSinCodigos(rawText) {
  if (!rawText) return [];
  const t = rawText.replace(/\u00A0/g, ' ');

  // Detectar el subtotal de piezas declarado (validación cruzada)
  let subtotalDeclarado = null;
  const subtotalMatch = t.match(/(\d{1,3})(?:[.,]00)?\s+sub[\s-]*total\s+piezas/i);
  if (subtotalMatch) subtotalDeclarado = parseInt(subtotalMatch[1]);

  // Estrategia 1: extraer LÍNEAS (separadas por \n) y buscar en cada una el patrón
  //   CANT (entero 1-50) seguido de MEDIDA (decimal x decimal) en cualquier lado de la línea
  // Esto funciona para OCs donde cada renglón está en su propia línea aunque las columnas estén intercaladas.
  const lines = t.split(/[\r\n]+/);
  const reMedidaLinea = /(\d{1,2}[.,]\d{1,3})\s*[xX×]\s*(\d{1,2}[.,]\d{1,3})/;
  const reCantLinea = /^\s*(\d{1,3})\s+/;

  // Recolectar TODAS las medidas y TODAS las cantidades en orden de aparición global
  // pero esta vez con su POSICIÓN EXACTA (índice)
  const reMedidaG = /(\d{1,2}[.,]\d{1,3})\s*[xX×]\s*(\d{1,2}[.,]\d{1,3})/g;
  const medidas = [];
  let mm;
  while ((mm = reMedidaG.exec(t)) !== null) {
    const ancho = parseFloat(mm[1].replace(',', '.'));
    const alto  = parseFloat(mm[2].replace(',', '.'));
    if (ancho < 10 && alto < 10 && ancho > 0 && alto > 0) {
      medidas.push({
        idx: mm.index,
        ancho: Math.round(ancho * 100),
        alto: Math.round(alto * 100),
        raw: mm[0],
      });
    }
  }
  if (medidas.length === 0) return [];

  // Recolectar CANTIDADES candidatas (números enteros 1-50 que no son parte de medidas/precios/totales)
  const reCantG = /\b(\d{1,3})\b/g;
  const medidaPositions = new Set();
  medidas.forEach(med => {
    for (let i = med.idx; i < med.idx + med.raw.length; i++) medidaPositions.add(i);
  });
  const cantidades = [];
  while ((mm = reCantG.exec(t)) !== null) {
    const idx = mm.index;
    if (medidaPositions.has(idx)) continue;
    const num = parseInt(mm[1]);
    if (!num || num <= 0 || num > 50) continue;
    // Filtrar números que sean parte de un número decimal mayor (precio)
    if (idx > 0 && /[.,]/.test(t[idx - 1])) continue;
    if (idx + mm[0].length < t.length && /[.,]\d/.test(t.substring(idx + mm[0].length, idx + mm[0].length + 2))) continue;
    // Filtrar contextos NO-cantidad (teléfonos, CP, fechas, etc.)
    // NOTA: NO filtrar por "$" porque las OC tienen precios con $ entre cada cantidad,
    // lo que filtraría todas las cantidades válidas posteriores a la primera.
    const ctxBefore = t.substring(Math.max(0, idx - 30), idx).toLowerCase();
    if (/teléfono|tel\.|tel:|cp:|c\.p\.|colonia|fax/i.test(ctxBefore)) continue;
    // Filtrar el subtotal "21.00 Sub-total"
    const ctxAfter = t.substring(idx, Math.min(idx + 50, t.length)).toLowerCase();
    if (/^\d{1,3}[.,]?(00|\s)?\s*sub[\s-]*total/i.test(ctxAfter)) continue;
    if (/^\d{1,3}\s+sub[\s-]*total/i.test(ctxAfter)) continue;
    cantidades.push({ idx, cant: num });
  }

  // ESTRATEGIA principal: emparejar por LÍNEA si funciona, sino por orden
  // Calcular líneas y a qué línea pertenece cada índice
  const lineStarts = [0];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\n' || t[i] === '\r') lineStarts.push(i + 1);
  }
  function lineaDeIdx(idx) {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  medidas.forEach(m => { m.linea = lineaDeIdx(m.idx); });
  cantidades.forEach(c => { c.linea = lineaDeIdx(c.idx); });

  // Intento 1: emparejar cada medida con la cantidad MÁS CERCANA EN LA MISMA LÍNEA
  const usadas = new Set();
  let pairs = [];
  for (const med of medidas) {
    let best = null, bestDist = Infinity;
    for (let i = 0; i < cantidades.length; i++) {
      if (usadas.has(i)) continue;
      const c = cantidades[i];
      if (c.linea !== med.linea) continue;
      const d = Math.abs(c.idx - med.idx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (best !== null) {
      pairs.push({ med, cant: cantidades[best].cant });
      usadas.add(best);
    } else {
      pairs.push({ med, cant: null });
    }
  }

  // Validar suma con subtotal
  let sumaPairs = pairs.reduce((s, p) => s + (p.cant || 0), 0);
  let usarLineas = true;
  if (subtotalDeclarado != null) {
    if (sumaPairs !== subtotalDeclarado) {
      // No matchea por líneas → intentar por ORDEN de aparición
      usarLineas = false;
    }
  } else {
    // Sin subtotal declarado, si hay medidas sin cantidad emparejada → fallar a estrategia por orden
    if (pairs.some(p => p.cant === null)) usarLineas = false;
  }

  if (!usarLineas) {
    // Intento 2: emparejar por ORDEN de aparición (cant[i] ↔ medida[i])
    pairs = [];
    const N = medidas.length;
    // Tomar las primeras N cantidades en orden de aparición
    const cantsByIdx = cantidades.slice().sort((a, b) => a.idx - b.idx);
    for (let i = 0; i < N; i++) {
      pairs.push({
        med: medidas[i],
        cant: cantsByIdx[i] ? cantsByIdx[i].cant : null,
      });
    }
    sumaPairs = pairs.reduce((s, p) => s + (p.cant || 0), 0);

    // Validar de nuevo con subtotal
    if (subtotalDeclarado != null && sumaPairs !== subtotalDeclarado) {
      // Intento 3: probar permutaciones simples (rotar el orden de cantidades)
      // Si tenemos más cantidades que medidas, probar deslizar el inicio
      const candidates = [];
      const allCants = cantsByIdx.map(c => c.cant);
      for (let start = 0; start <= Math.max(0, allCants.length - N); start++) {
        const slice = allCants.slice(start, start + N);
        const suma = slice.reduce((s, x) => s + x, 0);
        if (suma === subtotalDeclarado) {
          candidates.push({ start, slice, suma });
        }
      }
      if (candidates.length > 0) {
        // Tomar el primer candidato cuya suma coincide con el subtotal
        const winner = candidates[0];
        pairs = [];
        for (let i = 0; i < N; i++) {
          pairs.push({ med: medidas[i], cant: winner.slice[i] });
        }
        sumaPairs = winner.suma;
      }
    }
  }

  // Si la suma sigue sin coincidir con el subtotal Y el subtotal está declarado, NO devolvemos resultados
  // (es preferible 0 piezas a piezas mal correlacionadas)
  if (subtotalDeclarado != null && sumaPairs !== subtotalDeclarado) {
    return [];
  }

  // Construir filas finales
  // Buscar palabras de familia para inferencia textual (apoyo a la inferencia por dimensiones)
  const reFam = /\b(PUERTA[S]?|PANEL(?:\s+LATERAL)?|PILASTRA[S]?|MINGITORIO[S]?|REGADERA[S]?)\b/gi;
  const familias = [];
  while ((mm = reFam.exec(t)) !== null) {
    const word = mm[1].toUpperCase();
    let fam;
    if (word.startsWith('PUERTA'))     fam = 'PT';
    else if (word.startsWith('PILASTRA')) fam = 'PL';
    else if (word.startsWith('PANEL'))    fam = 'PN';
    else if (word.startsWith('MINGITORIO')) fam = 'MG';
    else if (word.startsWith('REGADERA'))   fam = 'PT';
    if (fam) familias.push({ idx: mm.index, fam });
  }

  const rows = [];
  for (const p of pairs) {
    if (!p.cant) continue;
    const med = p.med;
    // Inferencia por DIMENSIONES (más robusta que la textual)
    // Esta es la fuente de verdad principal porque las dimensiones físicas son
    // determinísticas: una pieza de 35×180 NUNCA puede ser una puerta (mide 35cm de ancho).
    let fam;
    let famByDim;   // recordamos la inferencia por dimensión para no contradecirla
    if (med.alto >= 170) {
      famByDim = 'PL';                            // toda altura ≥170 cm es pilastra
    } else if (med.alto === 120 && med.ancho <= 90) {
      famByDim = 'MG';
    } else if (med.ancho >= 100 && med.alto === 150) {
      famByDim = 'PN';
    } else if (med.ancho <= 100 && med.alto === 150) {
      famByDim = 'PT';
    } else if (med.alto === 180) {
      famByDim = (med.ancho <= 90) ? 'PT' : 'PN'; // alto=180 con ancho chico = regadera
    } else {
      famByDim = 'PT';
    }
    fam = famByDim;

    // Override textual (con guardarrieles): la palabra "PUERTAS" o "PILASTRAS" cerca puede
    // ayudar SOLO cuando la dimensión es ambigua (alto=150 con ancho 90-110).
    // NO permitimos override si la dimensión ya es claramente PL (alto≥170) o claramente PT/PN/MG.
    let bestFam = null, bestDist = Infinity;
    for (const f of familias) {
      const d = Math.abs(f.idx - med.idx);
      if (d < bestDist) { bestDist = d; bestFam = f.fam; }
    }
    if (bestFam && bestDist < 80) {
      // Reglas de guardarriel — la dimensión MANDA en estos casos:
      const altoEsPL = med.alto >= 170;       // SOLO PL puede tener alto≥170
      const altoEsMG = med.alto === 120;      // SOLO MG tiene alto=120 típicamente
      const altoEsBaja = med.alto === 150;    // PT/PN/MG tienen alto=150
      // No permitir override que contradiga la dimensión
      if (altoEsPL && bestFam !== 'PL') {
        // mantener famByDim=PL — la dimensión gana
      } else if (altoEsMG && bestFam !== 'MG') {
        // mantener famByDim=MG
      } else if (!altoEsPL && bestFam === 'PL') {
        // descartar PL textual si la dimensión no lo permite
      } else {
        // override permitido (dimensión y texto compatibles)
        fam = bestFam;
      }
    }

    // MG usa MG120/MG150 oficial; las demás familias usan {familia}{ancho}
    const codigoSintetico = (fam === 'MG')
      ? (med.alto <= 135 ? 'MG120' : 'MG150')
      : `${fam}${med.ancho}`;
    rows.push({
      codigo: codigoSintetico,
      familia: fam,
      cant: p.cant,
      ancho: med.ancho,
      alto: med.alto,
      detalle: '',
      reforzado: false,
    });
  }

  return rows;
}

function buildRowFromMatch(m) {
  // Normalizar código: quitar espacios y mayúsculas (PN 165 → PN165, "pn 165 " → "PN165")
  let cod = m[1].toUpperCase().replace(/\s+/g, '');
  const cant = parseInt(m[2]);
  let ancho = parseFloat(m[3].replace(',', '.'));
  let alto  = parseFloat(m[4].replace(',', '.'));
  if (ancho < 10) ancho = Math.round(ancho * 100);
  if (alto  < 10) alto  = Math.round(alto  * 100);
  if (!cant || cant <= 0 || cant > 999) return null;
  if (!ancho || !alto) return null;

  // Sufijo "R" en pilastras (PI10R, PI12R, PI55R) = REFORZADO → altura real 210
  // La OC a menudo dice "1.80" pero la altura real de pilastras reforzadas es 2.10 m
  let isReforzado = false;
  if (/^PI\d+R$/.test(cod)) {
    isReforzado = true;
    alto = 210;
    // Normalizar: PI10R → PI10 para que el catálogo lo reconozca igual
    cod = cod.replace(/R$/, '');
  }

  let familia = '';
  if (cod.startsWith('PT')) familia = 'PT';
  else if (cod.startsWith('PN')) familia = 'PN';
  else if (cod.startsWith('PI')) familia = 'PL';
  else if (cod.startsWith('MG')) familia = 'MG';
  return {
    codigo: cod, cant,
    ancho: Math.round(ancho), alto: Math.round(alto),
    familia, reforzado: isReforzado,
  };
}

// Convierte código OC (PT62, PI19, PN150, MG60) a tipo + ancho deducido
function ocCodeInfo(cod) {
  const m = cod.match(/^([A-Z]+?)(\d+)([A-Z]?)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2]), suffix: m[3] };
}

// ════════════════════════════════════════════════════════════════════
//   EXPORT
// ════════════════════════════════════════════════════════════════════
function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

function buildTextExport() {
  const c = countPieces();
  const total = c.PT_total + c.PN_total + c.PL_total + c.MG_total;
  const { hw } = hardwareAuto();
  const { mat, m2, m2Lam, peso } = materialsAuto();
  const colorInfo = lookupColor(STATE.color);
  const term = STATE.sistema === 'PATAS' ? 'PATA' : 'ZOCLO';

  let out = '';
  out += '═══════════════════════════════════════════════════════════════\n';
  out += '  CHECKLIST  ·  Cálculo de Materiales  ·  ' + (STATE.exp || 'EXP s/n') + '\n';
  out += '═══════════════════════════════════════════════════════════════\n\n';
  out += 'OBRA       : ' + STATE.obra + '\n';
  out += 'CLIENTE    : ' + STATE.cliente + '\n';
  out += 'EXP        : ' + STATE.exp + '\n';
  out += 'LÍNEA      : ' + STATE.linea + '\n';
  out += 'MODELO     : ' + nombreModelo(STATE.modeloCod) + '\n';
  out += 'TERM. INF. : ' + term + '\n';
  out += 'COLOR      : ' + STATE.color + (colorInfo.code ? ' (' + colorInfo.code + ')' : '') + '\n';
  if (colorInfo.codigoNuevo || colorInfo.tianrun) {
    let extra = '';
    if (colorInfo.codigoNuevo) extra += 'cod. nuevo ' + colorInfo.codigoNuevo;
    if (colorInfo.codigoNuevo && colorInfo.tianrun) extra += ' · ';
    if (colorInfo.tianrun) extra += 'Tianrun ' + colorInfo.tianrun;
    out += '             ' + extra + '\n';
  }
  out += 'KAP        : ' + STATE.kap + '\n';
  out += 'REFUERZO   : ' + (STATE.modelo === 'REFORZADO' ? STATE.refuerzo : 'N/A') + '\n';
  if (STATE.notas) out += 'NOTAS      : ' + STATE.notas + '\n';

  out += '\n──── PIEZAS ────────────────────────────────────────────────────\n';
  out += pad('CANT', 6) + pad('CÓDIGO', 16) + pad('TIPO', 6) + pad('ANCHO', 8) + pad('ALTO', 8) + 'DETALLE\n';
  STATE.pieces.forEach(p => {
    if (int(p.cant) > 0) {
      out += pad(p.cant, 6) + pad(p.codigo || '—', 16) + pad(p.tipo, 6) + pad(p.ancho || '—', 8) + pad(p.alto || '—', 8) + (p.detalle || '') + '\n';
    }
  });
  out += '\nTOTAL PIEZAS: ' + total + '\n';
  out += 'M² PIEZAS  : ' + m2 + '\n';
  out += 'M² LAMINADO: ' + m2Lam + '\n';
  out += 'PESO KG    : ' + peso.toFixed(1) + '\n';

  out += '\n──── HERRAJES ──────────────────────────────────────────────────\n';
  out += pad('CANT', 8) + pad('CÓDIGO', 14) + 'DESCRIPCIÓN\n';
  hw.forEach(h => { out += pad(h.qty, 8) + pad(h.code, 14) + h.desc + (h.flag ? '  ⚠' : '') + '\n'; });

  out += '\n──── MATERIALES ────────────────────────────────────────────────\n';
  mat.forEach(m => { out += pad(m.qty, 12) + pad(m.code, 16) + m.desc + (m.flag ? '  ⚠' : '') + '\n'; });

  out += '\n═══════════════════════════════════════════════════════════════\n';
  out += '  Generado por Cálculo de Materiales · ' + new Date().toLocaleString() + '\n';
  out += '═══════════════════════════════════════════════════════════════\n';
  return out;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════
//   EVENTS
// ════════════════════════════════════════════════════════════════════

// Tabs
$$('.tab').forEach(t => {
  t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('tab-' + t.dataset.tab).classList.add('active');
    if (t.dataset.tab === 'corte') setTimeout(renderCut, 50);
  });
});

// Captura — bindings
$('f-exp').addEventListener('input', e => { STATE.exp = e.target.value; renderTopbar(); renderMaterialsList(); });
$('f-obra').addEventListener('input', e => { STATE.obra = e.target.value; });
$('f-cliente').addEventListener('input', e => { STATE.cliente = e.target.value; });
$('f-terminacion').addEventListener('change', e => { STATE.sistema = e.target.value; renderAll(); });
function fillModelosCIP(linea) {
  const sel = document.getElementById('f-modelo');
  if (!sel) return;
  const lst = MODELOS_POR_LINEA[linea] || MODELOS_POR_LINEA['LEEDER'];
  sel.innerHTML = lst.map(m => `<option value="${m.codigo}">${m.nombre}</option>`).join('');
  if (!lst.find(m => m.codigo === STATE.modeloCod)) {
    STATE.modeloCod = lst.length ? lst[0].codigo : 'ESTANDAR';
    STATE.modelo = modeloBaseDe(STATE.modeloCod);
  }
  sel.value = STATE.modeloCod;
  const avi = document.getElementById('f-linea-aviso');
  if (avi) {
    if (linea === 'Touchless') {
      avi.style.display = '';
      avi.textContent = 'Touchless S3: la cerradura S1/S2 sale de la apertura del CSV (o del campo manual); arnés y KUS a validar con pedido real.';
    } else { avi.style.display = 'none'; avi.textContent = ''; }
  }
  actualizarCamposLinea();
}
function actualizarCamposLinea() {
  // El EXP padre solo tiene sentido si la OC es complemento de otro
  // expediente; si no, estorba y además invita a llenarlo por error.
  const epw = document.getElementById('f-exp-padre-wrap');
  if (epw) epw.style.display = STATE.ocAdicional ? '' : 'none';
  const ep = document.getElementById('f-exp-padre');
  if (ep && document.activeElement !== ep) ep.value = STATE.expPadre || '';
  const rw = document.getElementById('f-refuerzo-wrap');
  if (rw) rw.style.display = (STATE.modelo === 'REFORZADO') ? '' : 'none';
  const crw = document.getElementById('f-cortes-ref-wrap');
  if (crw) crw.style.display = (STATE.modelo === 'REFORZADO' && !esSuperiorCIP()) ? '' : 'none';
  const afw = document.getElementById('f-afuera-wrap');
  if (afw) afw.style.display = esTouchlessCIP() ? '' : 'none';
  const cr = document.getElementById('f-cortes-ref');
  if (cr && document.activeElement !== cr) cr.value = (STATE.refuerzoCortes || []).map(r => (r.cant > 1 ? r.cm + 'x' + r.cant : '' + r.cm)).join(', ');
  const af = document.getElementById('f-afuera');
  if (af && document.activeElement !== af) af.value = +STATE.puertasAfuera || 0;
}
$('f-linea').addEventListener('change', e => {
  STATE.linea = e.target.value;
  fillModelosCIP(STATE.linea);
  renderAll();
});
const COLORES_CR_DATALIST = ['INOX SATÍN', 'GRIS', 'NEGRO', 'BLANCO', 'ÁMBAR WOOD', 'NOGAL GRAFITO', 'GRAFITO NOCTURNO', 'ALUMINAK', 'WHITEC', 'WALNUT HEIGHTS', 'SKYLINE WALNUT', 'ALUMINA', 'EBANO', 'NEUTRAL OAK'];
function poblarColoresCIP() {
  const dl = document.getElementById('color-list');
  if (!dl) return;
  const nombres = STATE.region === 'MX' ? Object.keys(MAT_TAMANO_MX).sort() : COLORES_CR_DATALIST;
  dl.innerHTML = nombres.map(n => `<option value="${String(n).replace(/"/g, '&quot;')}">`).join('');
}
$('f-region') && $('f-region').addEventListener('change', e => {
  STATE.region = e.target.value === 'MX' ? 'MX' : 'CR';
  poblarColoresCIP();
  renderAll();
});
$('f-modelo').addEventListener('change', e => {
  STATE.modeloCod = e.target.value;
  STATE.modelo = modeloBaseDe(STATE.modeloCod);
  actualizarCamposLinea();
  renderAll();
});
$('f-refuerzo').addEventListener('change', e => { STATE.refuerzo = e.target.value; renderAll(); });
function parseCortesManual(txt) {
  const out = [];
  String(txt || '').split(/[,;]+/).forEach(part => {
    const s = part.trim();
    if (!s) return;
    const m = s.match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+)$/i) || s.match(/^(\d+(?:[.,]\d+)?)$/);
    if (!m) return;
    const cm = Math.round(parseFloat(m[1].replace(',', '.')));
    const cant = m[2] ? parseInt(m[2]) : 1;
    if (cm > 0 && cant > 0) out.push({ cm, cant });
  });
  return out;
}
$('f-cortes-ref').addEventListener('input', e => {
  STATE.refuerzoCortes = parseCortesManual(e.target.value);
  const info = document.getElementById('f-cortes-ref-info');
  if (info) {
    const n = STATE.refuerzoCortes.reduce((s, r) => s + r.cant, 0);
    const ml = Math.round(STATE.refuerzoCortes.reduce((s, r) => s + r.cm * r.cant, 0)) / 100;
    info.textContent = n ? (n + ' cortes · ' + ml.toFixed(2) + ' ml') : '';
  }
  renderAll();
});
$('f-afuera').addEventListener('input', e => { STATE.puertasAfuera = Math.max(0, parseInt(e.target.value) || 0); renderAll(); });
function nombreAreaUnico() {
  const usados = new Set(STATE.pieces.map(p => p.area || 'Área 1'));
  (STATE.areasManual || []).forEach(a => usados.add(a));
  usados.add(STATE.areaActual);
  let n = 1;
  while (usados.has('Área ' + n)) n++;
  return 'Área ' + n;
}
$('f-area') && $('f-area').addEventListener('change', e => {
  const nuevo = (e.target.value || '').trim() || 'Área 1';
  const viejo = STATE.areaActual || 'Área 1';
  if (nuevo !== viejo) {
    STATE.pieces.forEach(p => { if ((p.area || 'Área 1') === viejo) p.area = nuevo; });
    if (!STATE.areasManual) STATE.areasManual = [];
    STATE.areasManual = STATE.areasManual.map(a => a === viejo ? nuevo : a);
    if (!STATE.areasManual.includes(nuevo)) STATE.areasManual.push(nuevo);
  }
  STATE.areaActual = nuevo;
  renderAll();
});
$('btn-nueva-area') && $('btn-nueva-area').addEventListener('click', () => {
  const nombre = nombreAreaUnico();
  if (!STATE.areasManual) STATE.areasManual = [];
  if (!STATE.areasManual.includes(nombre)) STATE.areasManual.push(nombre);
  STATE.areaActual = nombre;
  renderAll();
  const fa = document.getElementById('f-area');
  if (fa) { fa.focus(); fa.select(); }
});
$('area-chips') && $('area-chips').addEventListener('click', e => {
  const del = e.target.closest('.area-chip-del');
  if (del) {
    const area = del.dataset.area || 'Área 1';
    const n = STATE.pieces.filter(p => (p.area || 'Área 1') === area).reduce((s, p) => s + int(p.cant), 0);
    if (n > 0 && !confirm(`¿Eliminar el área "${area}" y sus ${n} piezas?`)) return;
    STATE.areasManual = (STATE.areasManual || []).filter(a => a !== area);
    STATE.pieces = STATE.pieces.filter(p => (p.area || 'Área 1') !== area);
    if (STATE.areaActual === area) {
      STATE.areaActual = STATE.areasManual[0] || (STATE.pieces[0] && STATE.pieces[0].area) || 'Área 1';
    }
    if (!STATE.areasManual.length && !STATE.pieces.length) { STATE.areasManual = ['Área 1']; STATE.areaActual = 'Área 1'; }
    renderAll();
    return;
  }
  const sel = e.target.closest('.area-chip-sel');
  if (sel) { STATE.areaActual = sel.dataset.area || 'Área 1'; renderAll(); }
});
$('f-oc-adicional').addEventListener('change', e => {
  STATE.ocAdicional = (e.target.value === 'true');
  // si deja de ser adicional, no hay padre que valga
  if (!STATE.ocAdicional) STATE.expPadre = '';
  actualizarCamposLinea();
  renderAll();
});
$('f-exp-padre').addEventListener('input', e => { STATE.expPadre = e.target.value; });
$('f-kap').addEventListener('change', e => { STATE.kap = e.target.value; renderAll(); });
$('f-color').addEventListener('input', e => {
  STATE.color = e.target.value;
  const info = lookupColor(e.target.value);
  STATE.colorCode = info.code;
  renderAll();
});
$('f-notas').addEventListener('input', e => { STATE.notas = e.target.value; });
$('f-oc-total').addEventListener('input', e => { STATE.ocTotal = e.target.value; renderValidation(); });

// Verificación — delegation (cada fila tiene data-row-ancho y data-row-alto para identificar
// la pieza específica cuando hay múltiples medidas con el mismo código)
$('vlist').addEventListener('click', e => {
  // Botón "+ Otra medida": agrega una pieza nueva con cant=1 y ancho/alto vacíos editables
  if (e.target.classList.contains('btn-add-medida')) {
    const code = e.target.dataset.code;
    const altoDefault = parseInt(e.target.dataset.altoDefault) || 150;
    const tipo = TIPO_BY_CODE[code];
    if (!tipo) return;
    // Generar un alto único agregando un offset si ya existe ese alto exacto sin ancho
    // Estrategia: agregar fila con alto por defecto y ancho 0; el usuario rellena después
    let nuevoAncho = 0;
    let nuevoAlto = altoDefault;
    // Evitar colisión con una fila existente del mismo código y mismas medidas
    let intento = 0;
    while (STATE.pieces.find(p =>
      (p.codigo || '').toUpperCase() === code &&
      int(p.ancho) === nuevoAncho && int(p.alto) === nuevoAlto) && intento < 50) {
      nuevoAncho += 1;
      intento++;
    }
    STATE.pieces.push({
      id: uid(), tipo, codigo: code,
      ancho: nuevoAncho, alto: nuevoAlto,
      cant: 1, detalle: 'manual', flag: false,
      // sin esto la fila nueva cae en 'Área 1' y desaparece de la vista
      // cuando se está capturando en otra área
      area: STATE.areaActual || 'Área 1',
    });
    renderAll();
    // Foco en el input ancho de la nueva fila para que el usuario escriba
    setTimeout(() => {
      const sel = `[data-code="${code}"][data-row-ancho="${nuevoAncho}"][data-row-alto="${nuevoAlto}"][data-dim="ancho"]`;
      const inp = document.querySelector(sel);
      if (inp) { inp.focus(); inp.select(); }
    }, 30);
    return;
  }
  // Botón × eliminar fila completa
  if (e.target.classList.contains('vrow-del')) {
    const rowId = e.target.dataset.rowId;
    if (rowId) { delPieceById(rowId); return; }
    const code = e.target.dataset.code;
    const ra = parseInt(e.target.dataset.rowAncho);
    const rh = parseInt(e.target.dataset.rowAlto);
    STATE.pieces = STATE.pieces.filter(p =>
      !((p.codigo || '').toUpperCase() === code &&
        int(p.ancho) === ra && int(p.alto) === rh));
    renderAll();
    return;
  }
  // Stepper +/-
  const code = e.target.dataset.code;
  const step = e.target.dataset.step;
  if (code && step) {
    const rowId = e.target.dataset.rowId;
    if (rowId) { bumpPieceById(rowId, parseInt(step)); return; }
    const rowAncho = e.target.dataset.rowAncho;
    const rowAlto  = e.target.dataset.rowAlto;
    bumpPieceRow(code, rowAncho, rowAlto, parseInt(step));
  }
});
$('vlist').addEventListener('input', e => {
  const dim = e.target.dataset.dim;
  if (!dim) return;
  const rowId = e.target.dataset.rowId;
  if (rowId) { setPieceDimById(rowId, dim, e.target.value); return; }
  const code = e.target.dataset.code;
  if (code) setPieceDimRow(code, e.target.dataset.rowAncho, e.target.dataset.rowAlto, dim, e.target.value);
});

// La verificación se llena importando el CSV del Constructor de Planos
// (ver "Importar OC" en la pestaña Capturar) o cargando las piezas a mano.

// Handlers tabla OC parseada
$('btn-oc-add-row') && $('btn-oc-add-row').addEventListener('click', () => {
  if (!STATE.ocRowsEdit) STATE.ocRowsEdit = [];
  STATE.ocRowsEdit.push({ codigo: 'PT60', cant: 1, ancho: 60, alto: 150, familia: 'PT' });
  renderOCParsedTable();
});
$('btn-oc-reparse') && $('btn-oc-reparse').addEventListener('click', () => {
  STATE.ocRowsEdit = parseOCDivisions(STATE.pdfOC.text || '');
  renderOCParsedTable();
});
$('btn-oc-show-text') && $('btn-oc-show-text').addEventListener('click', () => {
  const txt = STATE.pdfOC.text || '(no se ha cargado ningún PDF de OC)';
  // Mostrar las líneas relevantes (con códigos PT/PN/PI/MG)
  const lines = txt.split('\n');
  const rel = lines
    .map((l, i) => ({ l, i }))
    .filter(({l}) => /\b(PT\d+[AB]?|PN\d+[AB]?|PI\d+[ARI]?|MG\d+)\b/i.test(l) && /[\d][.,]\d/.test(l));
  let report = `═══ TEXTO CRUDO EXTRAÍDO POR PDF.JS (${lines.length} líneas totales) ═══\n\n`;
  report += `▸ Líneas con códigos detectables: ${rel.length}\n\n`;
  rel.forEach(({l, i}) => {
    report += `L${String(i+1).padStart(3,'0')}: "${l.trim()}"\n`;
  });
  report += `\n═══ TEXTO COMPLETO (primeros 5000 chars) ═══\n\n${txt.slice(0, 5000)}`;
  // Crear modal con scroll
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `<div style="background:#0a1015;border:1px solid var(--cyan);border-radius:6px;max-width:900px;max-height:90vh;width:100%;display:flex;flex-direction:column">
    <div style="padding:14px 18px;border-bottom:1px solid #1a2530;display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin:0;color:var(--cyan);font-family:Orbitron,sans-serif">🔍 Texto crudo de PDF.js</h3>
      <button id="dbg-close" style="background:transparent;border:1px solid #2a3a48;color:#aaa;padding:4px 12px;cursor:pointer;border-radius:3px">× Cerrar</button>
    </div>
    <pre style="flex:1;overflow:auto;margin:0;padding:14px 18px;font-family:JetBrains Mono,monospace;font-size:12px;color:#cde;line-height:1.5;white-space:pre-wrap">${report.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c])}</pre>
    <div style="padding:10px 18px;border-top:1px solid #1a2530;display:flex;gap:10px;justify-content:flex-end">
      <button id="dbg-copy" style="background:var(--cyan);border:0;color:#000;padding:6px 16px;cursor:pointer;border-radius:3px;font-weight:600">📋 Copiar todo</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#dbg-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector('#dbg-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(txt);
      modal.querySelector('#dbg-copy').textContent = '✓ Copiado';
    } catch { alert('No se pudo copiar'); }
  };
});
// Handlers de la tabla OC parseada — guardados: el bloque OC PDF fue removido,
// estos elementos ya no existen en el DOM (la verificación se llena vía CSV).
const _ocParsedTable = $('oc-parsed-table');
if (_ocParsedTable) {
  _ocParsedTable.addEventListener('input', e => {
    const idx = e.target.dataset.ocIdx;
    const key = e.target.dataset.ocKey;
    if (idx == null || !key || !STATE.ocRowsEdit) return;
    const i = parseInt(idx);
    if (key === 'cant' || key === 'ancho' || key === 'alto') {
      STATE.ocRowsEdit[i][key] = parseInt(e.target.value) || 0;
    } else {
      STATE.ocRowsEdit[i][key] = e.target.value;
    }
    const total = STATE.ocRowsEdit.reduce((s, r) => s + r.cant, 0);
    const byFam = { PT: 0, PN: 0, PL: 0, MG: 0 };
    STATE.ocRowsEdit.forEach(r => { byFam[r.familia] = (byFam[r.familia] || 0) + r.cant; });
    $('oc-parsed-summary').innerHTML = `<b style="color: var(--green)">${STATE.ocRowsEdit.length}</b> renglones · <b style="color: var(--green)">${total}</b> piezas · PT=${byFam.PT} PN=${byFam.PN} PL=${byFam.PL} MG=${byFam.MG}`;
  });
  _ocParsedTable.addEventListener('change', e => {
    if (e.target.dataset.ocKey === 'familia') {
      const i = parseInt(e.target.dataset.ocIdx);
      STATE.ocRowsEdit[i].familia = e.target.value;
    }
  });
  _ocParsedTable.addEventListener('click', e => {
    const delIdx = e.target.dataset.ocDel;
    if (delIdx != null && STATE.ocRowsEdit) {
      STATE.ocRowsEdit.splice(parseInt(delIdx), 1);
      renderOCParsedTable();
    }
  });
}

// Ir a la Hoja de Verificación (está dentro de CAPTURAR — importar CSV o llenar a mano)
function irAVerificacion() {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.tab-content').forEach(x => x.classList.remove('active'));
  document.querySelector('[data-tab="capturar"]').classList.add('active');
  $('tab-capturar').classList.add('active');
  const v = $('vlist');
  if (v) v.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
{ const b = $('btn-fill-manual');     if (b) b.addEventListener('click', irAVerificacion); }
{ const b = $('btn-ir-verificacion'); if (b) b.addEventListener('click', irAVerificacion); }

// Generic close modals
$$('[data-close]').forEach(b => {
  b.addEventListener('click', () => $(b.dataset.close).classList.remove('on'));
});

// Cut — tamaños de hoja (multiselección)
document.querySelectorAll('.cut-size-chk').forEach(chk => {
  chk.addEventListener('change', () => {
    let keys = Array.from(document.querySelectorAll('.cut-size-chk')).filter(c => c.checked).map(c => c.dataset.key);
    if (!keys.length) { // no permitir vacío → re-marcar 5x12
      const def = document.querySelector('.cut-size-chk[data-key="5x12"]');
      if (def) def.checked = true;
      keys = ['5x12'];
    }
    if (STATE.cutManual.enabled) {
      if (!confirm('Tenés ediciones manuales en el corte. Al cambiar los tamaños de hoja se perderán y volverá a Auto. ¿Continuar?')) {
        // revertir el checkbox a lo que hay en STATE.cutSizes
        document.querySelectorAll('.cut-size-chk').forEach(c => { c.checked = STATE.cutSizes.includes(c.dataset.key); });
        return;
      }
      STATE.cutManual = { enabled: false, byIid: {}, sheets: [] };
    }
    STATE.cutSizes = keys;
    renderCut(); renderKPI(); renderMaterialsList();
  });
});
$('cut-gap').addEventListener('input', () => { renderCut(); renderKPI(); renderMaterialsList(); });
$('btn-cut-recalc').addEventListener('click', renderCut);
$('btn-cut-print').addEventListener('click', printCut);
$('btn-cut-dl').addEventListener('click', () => { descargarCortePDF(); });
$('btn-cargar-sobrantes').addEventListener('click', () => $('file-sobrantes').click());
$('file-sobrantes').addEventListener('change', e => { const f = e.target.files[0]; if (f) cargarSobrantesDesdeArchivo(f); e.target.value = ''; });
$('chk-usar-sobrantes').addEventListener('change', e => { STATE.usarSobrantes = e.target.checked; renderCut(); });
$('btn-limpiar-sobrantes').addEventListener('click', () => { STATE.sobrantes = []; renderSobrantesStatus(); renderCut(); });
window.addEventListener('resize', () => { if (STATE.pieces.length > 0) renderCut(); });

// ════════════════════════════════════════════════════════════════════
//   LISTA DE MATERIALES — PDF / Excel
// ════════════════════════════════════════════════════════════════════

// Abre una ventana popup con HTML listo para imprimir o guardar como PDF.
// El usuario decide en el cuadro nativo si imprime o guarda PDF.
// ─── Resumen de hojas: cuántas, aprovechamiento y desperdicio ───
// Lo usan la Lista de Materiales impresa Y la descargada en PDF. Vive en un
// solo lugar a propósito: son el mismo documento en dos formatos y no pueden
// decir cosas distintas.
function resumenDeCorte(matData) {
  const salida = {
    sheetsInfo: '— ',
    aprovecho: '—',
    desperdicio: '—',
    m2HojaTotal: parseFloat(matData.m2Lam),
  };
  try {
    const cutPieces = buildCutPieces();
    if (cutPieces.length === 0) return salida;
    const gap = cutGap();
    const r = STATE.cutManual.enabled
      ? packSheetsManual(cutPieces, gap)
      : packAllColors(cutPieces, gap);
    const sheetMix = {};
    r.sheets.forEach(s => {
      const k = `${Math.round(s.W)}×${Math.round(s.H)}`;
      sheetMix[k] = (sheetMix[k] || 0) + 1;
    });
    salida.sheetsInfo = Object.entries(sheetMix).map(([k, n]) => `${n} × ${k} cm`).join(' + ');
    const totalSheetsArea = r.sheets.reduce((s, sh) => s + (sh.W * sh.H) / 10000, 0);
    const usedArea = r.sheets.reduce((s, sh) =>
      s + sh.pieces.reduce((sp, p) => sp + p.pw * p.ph, 0) / 10000, 0);
    salida.aprovecho   = totalSheetsArea > 0 ? ((usedArea / totalSheetsArea) * 100).toFixed(1) + '%' : '—';
    salida.desperdicio = (totalSheetsArea - usedArea).toFixed(2) + ' m²';
    salida.m2HojaTotal = +totalSheetsArea.toFixed(2);
  } catch (err) { console.warn(err); }
  return salida;
}

// ════════════════════════════════════════════════════════════════════
// PDF DESCARGABLE
//
// El botón de imprimir abre el diálogo del navegador y depende de que no
// bloqueen las ventanas emergentes. Acá se arma el PDF con jsPDF y se baja
// como archivo, sin diálogo y sin pop-ups.
//
// Se dibuja pieza por pieza en vez de fotografiar el HTML: así el texto queda
// seleccionable y buscable, el archivo pesa poco y sale igual en cualquier PC.
// ════════════════════════════════════════════════════════════════════

/** el constructor de jsPDF, esté donde esté según cómo se cargó la librería */
function jsPDFClase() {
  return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
}

const PDF_TINTA = [30, 35, 45];
const PDF_GRIS = [120, 128, 140];
const PDF_AZUL = [27, 58, 107];
const PDF_LINEA = [205, 210, 218];
const PDF_FONDO = [244, 246, 249];

/**
 * Hoja con márgenes y salto de página automático. `y` es el lápiz: cada cosa
 * que se dibuja lo baja, y `sitio(alto)` avisa cuándo hay que pasar de hoja.
 */
function hojaPDF(doc, opciones) {
  const o = opciones || {};
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const m = o.margen || 12;
  const h = {
    ancho, alto, m,
    util: ancho - m * 2,
    y: m,
    pagina: 1,
    pie: o.pie || '',
    nueva() {
      pieDePagina(doc, this);
      doc.addPage();
      this.pagina++;
      this.y = m;
    },
    sitio(necesario) {
      if (this.y + necesario > alto - m - 8) this.nueva();
    },
  };
  return h;
}

function pieDePagina(doc, h) {
  doc.setFontSize(7);
  doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
  doc.text(h.pie, h.m, h.alto - h.m + 2);
  doc.text(`Pág. ${h.pagina}`, h.ancho - h.m, h.alto - h.m + 2, { align: 'right' });
}

/** título de sección: la rayita gris con el rótulo en mayúsculas */
function seccionPDF(doc, h, titulo) {
  h.sitio(12);
  h.y += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
  doc.text(String(titulo).toUpperCase(), h.m, h.y);
  h.y += 2;
  doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
  doc.setLineWidth(0.2);
  doc.line(h.m, h.y, h.m + h.util, h.y);
  h.y += 3.5;
}

/**
 * Tabla con encabezado que se repite al pasar de hoja. `cols` es
 * [{ t: rótulo, w: ancho mm, a: 'l'|'c'|'r' }] y `filas` un arreglo de arreglos.
 */
function tablaPDF(doc, h, cols, filas, opciones) {
  const o = opciones || {};
  const altoFila = o.altoFila || 5;
  const dibujarCabecera = () => {
    doc.setFillColor(PDF_FONDO[0], PDF_FONDO[1], PDF_FONDO[2]);
    doc.rect(h.m, h.y, h.util, altoFila, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_TINTA[0], PDF_TINTA[1], PDF_TINTA[2]);
    let x = h.m;
    cols.forEach(c => {
      const tx = c.a === 'c' ? x + c.w / 2 : c.a === 'r' ? x + c.w - 1.5 : x + 1.5;
      doc.text(String(c.t), tx, h.y + altoFila - 1.6, { align: c.a === 'c' ? 'center' : c.a === 'r' ? 'right' : 'left' });
      x += c.w;
    });
    h.y += altoFila;
  };

  h.sitio(altoFila * 2);
  dibujarCabecera();

  doc.setFont('helvetica', 'normal');
  if (filas.length === 0) {
    doc.setFontSize(7);
    doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
    doc.text('— sin renglones —', h.m + h.util / 2, h.y + altoFila - 1.6, { align: 'center' });
    h.y += altoFila;
    return;
  }

  filas.forEach((fila, i) => {
    if (h.y + altoFila > h.alto - h.m - 10) {
      h.nueva();
      dibujarCabecera();
      doc.setFont('helvetica', 'normal');
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(h.m, h.y, h.util, altoFila, 'F');
    }
    doc.setFontSize(7);
    doc.setTextColor(PDF_TINTA[0], PDF_TINTA[1], PDF_TINTA[2]);
    let x = h.m;
    cols.forEach((c, k) => {
      let txt = fila[k] == null ? '' : String(fila[k]);
      // lo que no entra en la columna se recorta, para no pisar la de al lado
      const maxAncho = c.w - 3;
      while (txt && doc.getTextWidth(txt) > maxAncho) txt = txt.slice(0, -1);
      if (txt !== String(fila[k] == null ? '' : fila[k])) txt = txt.slice(0, -1) + '…';
      const tx = c.a === 'c' ? x + c.w / 2 : c.a === 'r' ? x + c.w - 1.5 : x + 1.5;
      doc.text(txt, tx, h.y + altoFila - 1.6, { align: c.a === 'c' ? 'center' : c.a === 'r' ? 'right' : 'left' });
      x += c.w;
    });
    h.y += altoFila;
  });
  doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
  doc.setLineWidth(0.2);
  doc.line(h.m, h.y, h.m + h.util, h.y);
}

/** Lista de Materiales como PDF descargable. Devuelve false si no hay piezas. */
function descargarListaPDF() {
  if (STATE.pieces.length === 0) {
    alert('No hay piezas cargadas. Cargá piezas antes de bajar la lista de materiales.');
    return false;
  }
  const J = jsPDFClase();
  if (!J) {
    alert('No se pudo cargar el generador de PDF. Usá el botón Imprimir.');
    return false;
  }

  const matData = materialsAuto();
  const { hw } = hardwareAuto();
  const colorInfo = lookupColor(STATE.color || '');
  const { sheetsInfo, aprovecho, desperdicio, m2HojaTotal } = resumenDeCorte(matData);
  const hoy = new Date();
  const fechaStr = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const cipVer = ((document.getElementById('cip-version') || {}).textContent || '').trim();
  const totalPiezas = STATE.pieces.reduce((s, p) => s + (int(p.cant) || 0), 0);

  const doc = new J({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const h = hojaPDF(doc, { margen: 12, pie: `Cálculo de Materiales ${cipVer} · ${fechaStr}` });

  // ---------- encabezado ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(PDF_AZUL[0], PDF_AZUL[1], PDF_AZUL[2]);
  doc.text('LISTA DE MATERIALES', h.m, h.y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
  doc.text(`Modumex CR · ${STATE.linea} · ${nombreModelo(STATE.modeloCod)} ${STATE.sistema}`, h.m, h.y + 11);

  const datos = [
    ['EXP:', STATE.exp || '—'],
    ['Obra:', STATE.obra || '—'],
    ['Cliente:', STATE.cliente || '—'],
    ['Fecha:', fechaStr],
    ['Versión CIP:', cipVer || '—'],
  ];
  doc.setFontSize(7.5);
  datos.forEach((d, i) => {
    const y = h.y + 2 + i * 3.6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_TINTA[0], PDF_TINTA[1], PDF_TINTA[2]);
    doc.text(d[0], h.m + h.util - 42, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(String(d[1]), h.m + h.util - 40, y);
  });
  h.y += 16;

  // ---------- color ----------
  doc.setFillColor(PDF_FONDO[0], PDF_FONDO[1], PDF_FONDO[2]);
  doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
  doc.rect(h.m, h.y, h.util, 9, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
  doc.text('COLOR', h.m + 3, h.y + 5.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_TINTA[0], PDF_TINTA[1], PDF_TINTA[2]);
  doc.text(STATE.color || '— sin definir —', h.m + 17, h.y + 5.9);
  const codigos = [colorInfo.code, colorInfo.codigoNuevo].filter(Boolean).join(' · ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
  doc.text(codigos || 'sin códigos', h.m + h.util - 3, h.y + 5.8, { align: 'right' });
  h.y += 13;

  // ---------- los cuatro recuadros ----------
  const celdas = [
    ['M² PIEZAS', matData.m2, 'área útil'],
    ['M² LAMINADO', String(m2HojaTotal), 'hojas completas'],
    ['APROVECHAMIENTO', aprovecho, `desp.: ${desperdicio}`],
    ['PESO TOTAL', `${matData.peso} kg`, `${totalPiezas} piezas`],
  ];
  const wC = (h.util - 6) / 4;
  celdas.forEach((c, i) => {
    const x = h.m + i * (wC + 2);
    doc.setFillColor(PDF_FONDO[0], PDF_FONDO[1], PDF_FONDO[2]);
    doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
    doc.rect(x, h.y, wC, 15, 'FD');
    doc.setFontSize(6);
    doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
    doc.text(c[0], x + 2.5, h.y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(PDF_AZUL[0], PDF_AZUL[1], PDF_AZUL[2]);
    doc.text(String(c[1]), x + 2.5, h.y + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
    doc.text(String(c[2]), x + 2.5, h.y + 13.5);
  });
  h.y += 19;

  // ---------- tablas ----------
  const etiq = hw.filter(x => ETIQUETA_CODES.includes(String(x.code)));
  const herrajes = hw.filter(x => !ETIQUETA_CODES.includes(String(x.code)));
  const empaque = calcularEmpaque(matData.m2).concat(etiq);
  const cols3 = [
    { t: 'Cant.', w: 16, a: 'c' },
    { t: 'Código', w: 30, a: 'l' },
    { t: 'Descripción', w: h.util - 46, a: 'l' },
  ];
  const cols4 = [
    { t: 'Cant.', w: 16, a: 'c' },
    { t: 'Código', w: 30, a: 'l' },
    { t: 'Descripción', w: h.util - 46 - 48, a: 'l' },
    { t: 'Detalle', w: 48, a: 'l' },
  ];

  // nota gris al pie de una tabla (las hojas usadas, los totales en ml…)
  const nota = (txt) => {
    h.sitio(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
    h.y += 3.5;
    doc.text(txt, h.m, h.y);
    h.y += 2;
  };

  seccionPDF(doc, h, 'Costos estimados (m²)');
  tablaPDF(doc, h, cols3, [[(+matData.m2 || 0).toFixed(2), 'M²', 'COSTOS ESTIMADOS · m² total de piezas']]);

  seccionPDF(doc, h, 'Material principal · laminado');
  tablaPDF(doc, h, cols4, matData.mat.map(m => [m.qty, m.code, m.desc, m.logic || '']));
  nota(`Hojas usadas: ${sheetsInfo}  ·  Total m² hoja: ${m2HojaTotal} m²  ·  Desperdicio: ${desperdicio}`);

  if (empaque.length > 0) {
    seccionPDF(doc, h, 'Empaque y etiquetas');
    tablaPDF(doc, h, cols3, empaque.map(m => [m.qty, m.code, m.desc]));
  }

  seccionPDF(doc, h, 'Herrajes · calculado automáticamente');
  tablaPDF(doc, h, cols3, herrajes.map(x => [x.qty, x.code, x.desc]));

  // ---------- lo que llega de la OC del Constructor ----------
  const colsCorte = [
    { t: 'Cant.', w: 16, a: 'c' },
    { t: 'Código', w: 26, a: 'l' },
    { t: 'Medida', w: h.util - 92, a: 'l' },
    { t: 'Área', w: 50, a: 'l' },
  ];

  if (STATE.modelo === 'REFORZADO' && STATE.refuerzo === 'AUTO' && (STATE.refuerzoCortes || []).length > 0) {
    seccionPDF(doc, h, 'Cortes refuerzo (1918-610) · OC Constructor');
    tablaPDF(doc, h, colsCorte, expandirCortesRefuerzo(STATE.refuerzoCortes).map(r => [
      r.cant, `RF${r.cm}`,
      `${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)${r.nota ? ' · ' + r.nota : ''}`,
      r.area || '',
    ]));
    nota(`Total refuerzo: ${(Math.round(STATE.refuerzoCortes.reduce((s, r) => s + r.cm * r.cant, 0)) / 100).toFixed(2)} ml`);
  }

  if ((STATE.antepechos || []).length > 0) {
    seccionPDF(doc, h, 'Antepechos (SCUDO) · OC Constructor');
    tablaPDF(doc, h, colsCorte, STATE.antepechos.map(ap => [
      ap.cant, `AN${Math.round(ap.alto)}`, `${ap.ancho} × ${ap.alto} cm`, ap.area || '',
    ]));
  }

  if (STATE.modelo === 'SCUDO' && (STATE.perfilUCortes || []).length > 0) {
    seccionPDF(doc, h, 'Cortes perfil "U" (104-610) · OC Constructor');
    const porArea = {};
    STATE.perfilUCortes.forEach(r => { const k = r.area || ''; (porArea[k] = porArea[k] || []).push(r); });
    let granCm = 0;
    Object.keys(porArea).forEach(area => {
      let areaCm = 0;
      const filas = porArea[area].map(r => {
        areaCm += r.cm * r.cant;
        return [r.cant, `PU${r.cm}`, `${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)`, area];
      });
      tablaPDF(doc, h, colsCorte, filas);
      granCm += areaCm;
      nota(`Total perfil U · ${area}: ${(areaCm / 100).toFixed(2)} ml`);
    });
    nota(`TOTAL PERFIL U (104-610): ${(granCm / 100).toFixed(2)} ml`);
  }

  if ((STATE.tubingCortes || []).length > 0) {
    seccionPDF(doc, h, 'Tubing ornamental (T00021) · OC Constructor');
    tablaPDF(doc, h, colsCorte, STATE.tubingCortes.map(r => [
      r.cant, `TB${r.cm}`, `${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)`, r.area || '',
    ]));
    nota(`Total tubing: ${(Math.round(STATE.tubingCortes.reduce((s, r) => s + r.cm * r.cant, 0)) / 100).toFixed(2)} ml`);
  }

  pieDePagina(doc, h);
  const nombre = `Lista de Materiales ${STATE.exp || ''}`.trim() + '.pdf';
  // arraybuffer y no 'blob': downloadBlob ya arma el Blob, y meter uno dentro
  // de otro funciona pero es dar una vuelta de más
  downloadBlob(doc.output('arraybuffer'), nombre, 'application/pdf');
  return true;
}

/**
 * Dibujo de Corte como PDF descargable. Se vuelve a calcular el empaque (no se
 * lee lo que haya en pantalla) para que salga bien aunque nunca se haya abierto
 * la pestaña 02. Una hoja de corte por página, con su panel de datos al lado.
 */
function descargarCortePDF() {
  // las de la OC sin tipo también se cortan, así que no hace falta STATE.pieces
  if (STATE.pieces.length === 0 && piezasOCSinTipo().length === 0) {
    alert('No hay piezas cargadas. Cargá piezas antes de bajar el dibujo de corte.');
    return false;
  }
  const J = jsPDFClase();
  if (!J) {
    alert('No se pudo cargar el generador de PDF. Usá el botón Imprimir.');
    return false;
  }
  const cutPieces = buildCutPieces();
  if (cutPieces.length === 0) {
    alert('No hay piezas de laminado para cortar.');
    return false;
  }

  const gap = cutGap();
  const manual = STATE.cutManual.enabled;
  const r = manual ? packSheetsManual(cutPieces, gap) : packAllColors(cutPieces, gap);
  const sheets = r.sheets;
  const unplaced = r.unplaced || [];

  // Los mismos bloques que muestra la pantalla: agrupados por color y, en
  // automático, colapsando en un solo dibujo las hojas con el corte idéntico.
  const firma = (sh) => `${sh.sobrante || 'NUEVA'}@${Math.round(sh.W)}x${Math.round(sh.H)}#` +
    sh.pieces.map(p => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.pw)},${Math.round(p.ph)}`).sort().join(';');
  const ordenColor = [], porColor = {};
  sheets.forEach((s, si) => {
    const k = s.lamColor || '';
    if (!(k in porColor)) { porColor[k] = []; ordenColor.push(k); }
    porColor[k].push(si);
  });
  const bloques = [];
  ordenColor.forEach(k => {
    if (manual) {
      porColor[k].forEach(si => bloques.push({ color: k, sheet: sheets[si], cant: 1 }));
      return;
    }
    const porFirma = {}, firmas = [];
    porColor[k].forEach(si => {
      const f = firma(sheets[si]);
      if (!(f in porFirma)) { porFirma[f] = []; firmas.push(f); }
      porFirma[f].push(si);
    });
    firmas.forEach(f => bloques.push({ color: k, sheet: sheets[porFirma[f][0]], cant: porFirma[f].length }));
  });

  const hoy = new Date();
  const fechaStr = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const cipVer = ((document.getElementById('cip-version') || {}).textContent || '').trim();
  const doc = new J({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const h = hojaPDF(doc, { margen: 10, pie: `Dibujo de Corte ${cipVer} · EXP ${STATE.exp || '—'} · ${fechaStr}` });

  const tinta = () => doc.setTextColor(PDF_TINTA[0], PDF_TINTA[1], PDF_TINTA[2]);
  const gris = () => doc.setTextColor(PDF_GRIS[0], PDF_GRIS[1], PDF_GRIS[2]);
  // '#abc' o '#aabbcc' del mapa de colores de la pantalla → [r, g, b]
  const rgb = (css) => {
    let s = String(css || '#888888').replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s.slice(0, 6), 16);
    return isNaN(n) ? [136, 136, 136] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  // ════════ página 1: resumen ════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(PDF_AZUL[0], PDF_AZUL[1], PDF_AZUL[2]);
  doc.text('DIBUJO DE CORTE', h.m, h.y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  gris();
  doc.text(`Modumex CR · ${STATE.linea} · ${nombreModelo(STATE.modeloCod)} ${STATE.sistema}`, h.m, h.y + 11);
  [
    ['EXP:', STATE.exp || '—'],
    ['Obra:', STATE.obra || '—'],
    ['Cliente:', STATE.cliente || '—'],
    ['Fecha:', fechaStr],
    ['Versión CIP:', cipVer || '—'],
  ].forEach((d, i) => {
    const y = h.y + 2 + i * 3.6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    tinta();
    doc.text(d[0], h.m + h.util - 42, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(String(d[1]), h.m + h.util - 40, y);
  });
  h.y += 18;

  const areaTotal = sheets.reduce((s, sh) => s + sh.W * sh.H, 0);
  const areaUsada = sheets.reduce((s, sh) => s + sh.pieces.reduce((t, p) => t + p.pw * p.ph, 0), 0);
  const mezcla = {};
  sheets.forEach(s => { const k = `${Math.round(s.W)}×${Math.round(s.H)}`; mezcla[k] = (mezcla[k] || 0) + 1; });
  const celdas = [
    ['HOJAS NECESARIAS', String(sheets.length), manual ? 'modo manual' : 'automático'],
    ['MEZCLA', Object.entries(mezcla).map(([k, n]) => `${n}× ${k}`).join(' + ') || '—', 'cm'],
    ['APROVECHAMIENTO', areaTotal > 0 ? ((areaUsada / areaTotal) * 100).toFixed(1) + '%' : '—', `sangría ${(gap * 10).toFixed(0)} mm`],
    ['DESPERDICIO', ((areaTotal - areaUsada) / 10000).toFixed(2) + ' m²', 'borde 3 mm por lado'],
  ];
  const wC = (h.util - 6) / 4;
  celdas.forEach((c, i) => {
    const x = h.m + i * (wC + 2);
    doc.setFillColor(PDF_FONDO[0], PDF_FONDO[1], PDF_FONDO[2]);
    doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
    doc.setLineWidth(0.2);
    doc.rect(x, h.y, wC, 15, 'FD');
    doc.setFontSize(6);
    gris();
    doc.text(c[0], x + 2.5, h.y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(c[1].length > 16 ? 8 : 12);
    doc.setTextColor(PDF_AZUL[0], PDF_AZUL[1], PDF_AZUL[2]);
    doc.text(String(c[1]), x + 2.5, h.y + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    gris();
    doc.text(String(c[2]), x + 2.5, h.y + 13.5);
  });
  h.y += 19;

  if (unplaced.length > 0) {
    doc.setFillColor(253, 235, 235);
    doc.setDrawColor(200, 60, 60);
    doc.rect(h.m, h.y, h.util, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(170, 30, 30);
    doc.text(`${unplaced.length} pieza(s) NO caben: ` +
      unplaced.map(p => `${p.code} ${p.w}×${p.h}`).join(', '), h.m + 3, h.y + 5.3);
    h.y += 11;
  }

  seccionPDF(doc, h, 'Hojas de corte');
  const colsIdx = [
    { t: 'Hoja', w: 16, a: 'c' },
    { t: 'Color', w: 62, a: 'l' },
    { t: 'Código', w: 26, a: 'l' },
    { t: 'Origen', w: 34, a: 'l' },
    { t: 'Medida (cm)', w: 30, a: 'l' },
    { t: 'Cant.', w: 16, a: 'c' },
    { t: 'Piezas', w: 18, a: 'c' },
    { t: 'Aprov.', w: 20, a: 'c' },
    { t: 'Desperdicio', w: h.util - 222, a: 'l' },
  ];
  tablaPDF(doc, h, colsIdx, bloques.map((b, i) => {
    const sh = b.sheet;
    const ci = lookupColor(b.color || '');
    const usado = sh.pieces.reduce((s, p) => s + p.pw * p.ph, 0);
    const area = sh.W * sh.H;
    return [
      i + 1,
      (ci.nuevo || b.color) || '— sin color —',
      ci.code || 'sin código',
      sh.sobrante ? `SOBRANTE ${sh.sobrante}` : 'Hoja nueva',
      `${Math.round(sh.W)} × ${Math.round(sh.H)}`,
      b.cant,
      sh.pieces.length,
      area > 0 ? ((usado / area) * 100).toFixed(1) + '%' : '—',
      `${((area - usado) * b.cant / 10000).toFixed(2)} m²`,
    ];
  }));

  // ════════ una página por hoja de corte ════════
  bloques.forEach((b, bi) => {
    h.nueva();
    const sh = b.sheet;
    const ci = lookupColor(b.color || '');
    const usado = sh.pieces.reduce((s, p) => s + p.pw * p.ph, 0);
    const areaHoja = sh.W * sh.H;
    const pct = areaHoja > 0 ? ((usado / areaHoja) * 100).toFixed(1) : '0.0';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(PDF_AZUL[0], PDF_AZUL[1], PDF_AZUL[2]);
    doc.text(`HOJA ${bi + 1} DE ${bloques.length}${sh.sobrante ? ' · SOBRANTE ' + sh.sobrante : ''}`, h.m, h.y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    gris();
    doc.text(`EXP ${STATE.exp || '—'} · ${STATE.obra || '—'} · sangría ${(gap * 10).toFixed(0)} mm · borde 3 mm`, h.m, h.y + 9.5);
    doc.text(fechaStr, h.m + h.util, h.y + 5, { align: 'right' });
    h.y += 12;
    doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
    doc.setLineWidth(0.2);
    doc.line(h.m, h.y, h.m + h.util, h.y);
    h.y += 4;

    // ── panel de datos, a la izquierda
    const wPanel = 56;
    let py = h.y + 3;
    const dato = (k, v, fuerte) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      gris();
      doc.text(k, h.m, py);
      doc.setFont('helvetica', fuerte ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      tinta();
      let txt = String(v);
      while (txt && doc.getTextWidth(txt) > wPanel - 22) txt = txt.slice(0, -1);
      doc.text(txt, h.m + wPanel, py, { align: 'right' });
      py += 4.6;
    };
    dato('Color', (ci.nuevo || b.color) || '— sin color —', true);
    dato('Código', ci.code || 'sin código');
    dato('Origen', sh.sobrante ? `SOBRANTE ${sh.sobrante}` : 'Hoja nueva');
    dato('Hoja', `${Math.round(sh.W)} × ${Math.round(sh.H)} cm`);
    dato('Cantidad', `${b.cant} hoja(s)`, true);
    dato('Área utilizada', `${usado.toFixed(0)} cm² · ${pct}%`);
    dato('Desperdicio', `${(areaHoja - usado).toFixed(0)} cm² · ${(100 - parseFloat(pct)).toFixed(1)}%`);
    dato('Cortes', `${sh.pieces.length} pzas`);
    py += 2.5;

    const grp = {}, ordenG = [];
    sh.pieces.forEach(p => {
      const k = `${p.h}×${p.w}|${p.code}`;
      if (!(k in grp)) { grp[k] = { h: p.h, w: p.w, code: p.code, n: 0 }; ordenG.push(k); }
      grp[k].n++;
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    gris();
    doc.text('PIEZA (cm)', h.m, py);
    doc.text('ETIQ.', h.m + 26, py);
    doc.text('CANT', h.m + wPanel, py, { align: 'right' });
    py += 1.4;
    doc.setDrawColor(PDF_LINEA[0], PDF_LINEA[1], PDF_LINEA[2]);
    doc.line(h.m, py, h.m + wPanel, py);
    py += 3.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    tinta();
    ordenG.forEach(k => {
      const g = grp[k];
      if (py > h.alto - h.m - 6) return;
      doc.text(`${g.h} × ${g.w}`, h.m, py);
      doc.text(String(g.code), h.m + 26, py);
      doc.text(String(g.n), h.m + wPanel, py, { align: 'right' });
      py += 3.8;
    });
    if (sh.pieces.length === 0) doc.text('— hoja vacía —', h.m, py);

    // ── el dibujo, a escala, a la derecha
    const x0 = h.m + wPanel + 8;
    const anchoDisp = h.m + h.util - x0;
    const altoDisp = h.alto - h.m - 12 - h.y;
    const esc = Math.min(anchoDisp / sh.W, altoDisp / sh.H);
    const dw = sh.W * esc, dh = sh.H * esc, dy = h.y;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(PDF_TINTA[0], PDF_TINTA[1], PDF_TINTA[2]);
    doc.setLineWidth(0.4);
    doc.rect(x0, dy, dw, dh, 'FD');

    // borde descartable de 3 mm por lado
    doc.setDrawColor(230, 150, 60);
    doc.setLineWidth(0.15);
    const mg = SHEET_MARGIN_CM * esc;
    doc.rect(x0 + mg, dy + mg, dw - 2 * mg, dh - 2 * mg);

    // retícula cada 50 cm, como en pantalla
    doc.setDrawColor(226, 230, 236);
    doc.setLineWidth(0.1);
    doc.setFontSize(4.5);
    gris();
    for (let x = 50; x < sh.W; x += 50) {
      doc.line(x0 + x * esc, dy, x0 + x * esc, dy + dh);
      doc.text(String(x), x0 + x * esc + 0.5, dy + 3);
    }
    for (let y = 50; y < sh.H; y += 50) {
      doc.line(x0, dy + y * esc, x0 + dw, dy + y * esc);
      doc.text(String(y), x0 + 0.8, dy + y * esc - 0.8);
    }

    sh.pieces.forEach(p => {
      const px = x0 + p.x * esc, pz = dy + p.y * esc;
      const pw = p.pw * esc, ph = p.ph * esc;
      const c = rgb(p.color);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.setDrawColor(35, 40, 48);
      doc.setLineWidth(0.2);
      doc.rect(px, pz, pw, ph, 'FD');
      const cx = px + pw / 2, cy = pz + ph / 2;
      const fCode = Math.max(3.5, Math.min(8, pw / 5.5));
      doc.setTextColor(255, 255, 255);
      if (pw > 7 && ph > 4) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fCode);
        doc.text(String(p.code), cx, cy, { align: 'center' });
      }
      if (pw > 11 && ph > 9) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(3.2, fCode - 2));
        doc.text(`${p.pw}×${p.ph}${p.rotated ? ' (rot)' : ''}`, cx, cy + fCode * 0.5 + 0.6, { align: 'center' });
      }
    });

    if (b.cant > 1) {
      const bw = 24, bh = 7.5;
      doc.setFillColor(245, 197, 66);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(x0 + dw - bw, dy + dh + 1.5, bw, bh, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`× ${b.cant}`, x0 + dw - bw / 2, dy + dh + 6.9, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      gris();
      doc.text('hojas con el mismo corte', x0 + dw - bw - 2, dy + dh + 6.5, { align: 'right' });
    }
  });

  pieDePagina(doc, h);
  const nombre = `Dibujo de Corte ${STATE.exp || ''}`.trim() + '.pdf';
  downloadBlob(doc.output('arraybuffer'), nombre, 'application/pdf');
  return true;
}

function openPrintWindow(htmlContent, title) {
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) {
    alert('Tu navegador bloqueó la ventana emergente. Habilitá pop-ups para este sitio.');
    return;
  }
  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${htmlContent}</html>`);
  w.document.close();
  // Esperar a que cargue antes de imprimir
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
}

// ─── HTML de la Lista de Materiales (PDF detallado) ───
function generateMaterialsListHTML() {
  if (STATE.pieces.length === 0) {
    alert('No hay piezas cargadas. Cargá piezas antes de imprimir la lista de materiales.');
    return null;
  }
  const matData = materialsAuto();
  const { hw } = hardwareAuto();
  const colorInfo = lookupColor(STATE.color || '');
  const today = new Date();
  const fechaStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const cipVer = ((document.getElementById('cip-version') || {}).textContent || '').trim();

  // Total piezas (cantidad de unidades sumadas)
  const totalPiezas = STATE.pieces.reduce((s, p) => s + (int(p.cant) || 0), 0);

  // Calcular detalle del laminado: hojas usadas + aprovechamiento + desperdicio
  const { sheetsInfo, aprovecho, desperdicio, m2HojaTotal } = resumenDeCorte(matData);

  // Tabla herrajes
  const etiqPdf = hw.filter(h => ETIQUETA_CODES.includes(String(h.code)));
  const hwRestPdf = hw.filter(h => !ETIQUETA_CODES.includes(String(h.code)));
  const herrajesRows = hwRestPdf.map(h => `
    <tr>
      <td class="c"><b>${h.qty}</b></td>
      <td><b>${h.code}</b></td>
      <td>${h.desc}</td>
    </tr>`).join('');
  const empaqueRows = calcularEmpaque(matData.m2).concat(etiqPdf).map(m => `
    <tr>
      <td class="c"><b>${m.qty}</b></td>
      <td><b>${m.code}</b></td>
      <td>${m.desc}</td>
    </tr>`).join('');

  // Tabla material principal (laminado)
  const matRows = matData.mat.map(m => `
    <tr>
      <td class="c"><b>${m.qty}</b></td>
      <td><b>${m.code}</b></td>
      <td>${m.desc}</td>
      <td class="logic">${m.logic || ''}</td>
    </tr>`).join('');

  // Color info
  const codeChips = [];
  if (colorInfo.code)        codeChips.push(`<span class="chip"><i>SAP</i>${colorInfo.code}</span>`);
  if (colorInfo.codigoNuevo) codeChips.push(`<span class="chip"><i>CÓD.</i>${colorInfo.codigoNuevo}</span>`);
  if (colorInfo.tianrun)     codeChips.push(`<span class="chip"><i>TIANRUN</i>${colorInfo.tianrun}</span>`);

  return `
<style>
  @page { size: letter portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 0; font-size: 9.5pt; }
  .ml-head { border-bottom: 3px solid #1B3A6B; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .ml-head .ml-title { font-size: 16pt; font-weight: 800; color: #1B3A6B; }
  .ml-head .ml-sub { font-size: 9pt; color: #555; margin-top: 4px; }
  .ml-meta { font-size: 9pt; color: #333; text-align: right; }
  .ml-meta b { color: #000; }
  .color-banner { background: #f5f7fa; border: 2px solid #1B3A6B; border-left-width: 6px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .color-banner .lbl { font-size: 8pt; color: #888; letter-spacing: 1.5px; text-transform: uppercase; margin-right: 6px; }
  .color-banner .name { font-size: 14pt; font-weight: 800; color: #1B3A6B; }
  .color-banner .codes { display: flex; gap: 6px; flex-wrap: wrap; }
  .color-banner .chip { background: #fff; border: 1px solid #888; border-radius: 3px; padding: 3px 8px; font-size: 9pt; font-family: ui-monospace, monospace; }
  .color-banner .chip i { font-style: normal; color: #888; margin-right: 4px; font-size: 8pt; }
  .ml-section { margin-bottom: 14px; }
  .ml-section-head { background: #2F4863; color: #fff; padding: 5px 12px; font-weight: 700; font-size: 10pt; letter-spacing: 0.5px; }
  .ml-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .ml-table th { background: #f0f0f0; padding: 5px 8px; text-align: left; font-weight: 700; border: 1px solid #b8b8b8; font-size: 8.5pt; }
  .ml-table td { padding: 4px 8px; border: 1px solid #d8d8d8; vertical-align: top; }
  .ml-table td.c { text-align: center; width: 8%; }
  .ml-table td:nth-child(2) { width: 14%; }
  .ml-table td:nth-child(3) { width: 48%; }
  .ml-table td.logic { color: #777; font-size: 8pt; font-family: ui-monospace, monospace; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .stat-cell { background: #f5f7fa; border: 1px solid #d8d8d8; padding: 8px 10px; }
  .stat-cell .lbl { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .stat-cell .val { font-size: 14pt; font-weight: 800; color: #1B3A6B; margin-top: 2px; }
  .stat-cell .sub { font-size: 8pt; color: #555; margin-top: 1px; }
  .ml-foot { margin-top: 16px; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
</style>
<body>
  <div class="ml-head">
    <div>
      <div class="ml-title">LISTA DE MATERIALES</div>
      <div class="ml-sub">Modumex CR · ${STATE.linea} · ${nombreModelo(STATE.modeloCod)} ${STATE.sistema}</div>
    </div>
    <div class="ml-meta">
      <div><b>EXP:</b> ${STATE.exp || '—'}</div>
      <div><b>Obra:</b> ${STATE.obra || '—'}</div>
      <div><b>Cliente:</b> ${STATE.cliente || '—'}</div>
      <div><b>Fecha:</b> ${fechaStr}</div>
      <div><b>Versión CIP:</b> ${cipVer || '—'}</div>
    </div>
  </div>

  <div class="color-banner">
    <div><span class="lbl">Color</span><span class="name">${colorInfo.nuevo || STATE.color || '— sin definir —'}</span></div>
    <div class="codes">${codeChips.join('') || '<span class="chip">sin códigos</span>'}</div>
  </div>

  <div class="stats-grid">
    <div class="stat-cell"><div class="lbl">M² piezas</div><div class="val">${matData.m2}</div><div class="sub">área útil</div></div>
    <div class="stat-cell"><div class="lbl">M² laminado</div><div class="val">${matData.m2Lam}</div><div class="sub">hojas completas</div></div>
    <div class="stat-cell"><div class="lbl">Aprovechamiento</div><div class="val">${aprovecho}</div><div class="sub">desp.: ${desperdicio}</div></div>
    <div class="stat-cell"><div class="lbl">Peso total</div><div class="val">${matData.peso} kg</div><div class="sub">${totalPiezas} piezas</div></div>
  </div>

  <div class="ml-section">
    <div class="ml-section-head">COSTOS ESTIMADOS (M²)</div>
    <table class="ml-table">
      <tbody><tr><td class="c"><b>${(+matData.m2 || 0).toFixed(2)}</b></td><td><b>M²</b></td><td>COSTOS ESTIMADOS · m² total de piezas</td></tr></tbody>
    </table>
  </div>

  <div class="ml-section">
    <div class="ml-section-head">MATERIAL PRINCIPAL · LAMINADO</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Descripción</th><th>Detalle</th></tr></thead>
      <tbody>
        ${matRows || '<tr><td colspan="4" style="text-align:center;color:#888;padding:10px;">— sin laminado definido —</td></tr>'}
        <tr><td colspan="4" style="background:#fafafa;font-size:8.5pt;color:#555;padding:6px 10px;">
          <b>Hojas usadas:</b> ${sheetsInfo} &nbsp;·&nbsp; <b>Total m² hoja:</b> ${m2HojaTotal} m² &nbsp;·&nbsp; <b>Desperdicio:</b> ${desperdicio}
        </td></tr>
      </tbody>
    </table>
  </div>

  ${empaqueRows ? `<div class="ml-section">
    <div class="ml-section-head">EMPAQUE Y ETIQUETAS</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Descripción</th></tr></thead>
      <tbody>${empaqueRows}</tbody>
    </table>
  </div>` : ''}

  <div class="ml-section">
    <div class="ml-section-head">HERRAJES · CALCULADO AUTOMÁTICAMENTE</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Descripción</th></tr></thead>
      <tbody>${herrajesRows || '<tr><td colspan="3" style="text-align:center;color:#888;padding:10px;">— sin herrajes —</td></tr>'}</tbody>
    </table>
  </div>

  ${(STATE.modelo === 'REFORZADO' && STATE.refuerzo === 'AUTO' && (STATE.refuerzoCortes || []).length > 0) ? `
  <div class="ml-section">
    <div class="ml-section-head">CORTES REFUERZO (1918-610) · OC CONSTRUCTOR</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Medida (ml)</th><th>Área</th></tr></thead>
      <tbody>
        ${expandirCortesRefuerzo(STATE.refuerzoCortes).map(r => `
        <tr>
          <td class="c"><b>${r.cant}</b></td>
          <td><b>RF${r.cm}</b></td>
          <td>${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)${r.nota ? `<br><span style="color:#a00;font-size:8pt;">${r.nota}</span>` : ''}</td>
          <td class="logic">${r.area || ''}</td>
        </tr>`).join('')}
        <tr><td colspan="4" style="background:#fafafa;font-size:8.5pt;color:#555;padding:6px 10px;">
          <b>Total refuerzo:</b> ${(Math.round(STATE.refuerzoCortes.reduce((s, r) => s + r.cm * r.cant, 0)) / 100).toFixed(2)} ml
        </td></tr>
      </tbody>
    </table>
  </div>` : ''}

  ${(STATE.antepechos || []).length > 0 ? `
  <div class="ml-section">
    <div class="ml-section-head">ANTEPECHOS (SCUDO) · OC CONSTRUCTOR</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Medida (cm)</th><th>Área</th></tr></thead>
      <tbody>
        ${STATE.antepechos.map(ap => `
        <tr>
          <td class="c"><b>${ap.cant}</b></td>
          <td><b>AN${Math.round(ap.alto)}</b></td>
          <td>${ap.ancho} × ${ap.alto} cm</td>
          <td class="logic">${ap.area || ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${(STATE.modelo === 'SCUDO' && (STATE.perfilUCortes || []).length > 0) ? `
  <div class="ml-section">
    <div class="ml-section-head">CORTES PERFIL "U" (104-610) · OC CONSTRUCTOR</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Medida (ml)</th><th>Área</th></tr></thead>
      <tbody>
        ${(() => {
          const byArea = {};
          STATE.perfilUCortes.forEach(r => { const k = r.area || ''; (byArea[k] = byArea[k] || []).push(r); });
          let gran = 0;
          const bloques = Object.keys(byArea).map(area => {
            let areaCm = 0;
            const filas = byArea[area].map(r => {
              areaCm += r.cm * r.cant;
              return `<tr><td class="c"><b>${r.cant}</b></td><td><b>PU${r.cm}</b></td><td>${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)</td><td class="logic">${area}</td></tr>`;
            }).join('');
            gran += areaCm;
            return filas + `<tr><td colspan="4" style="background:#fafafa;font-size:8.5pt;color:#555;padding:5px 10px;"><b>Total perfil U · ${area}:</b> ${(areaCm / 100).toFixed(2)} ml</td></tr>`;
          }).join('');
          return bloques + `<tr><td colspan="4" style="background:#eef;font-size:9pt;padding:6px 10px;"><b>TOTAL PERFIL U (104-610):</b> ${(gran / 100).toFixed(2)} ml</td></tr>`;
        })()}
      </tbody>
    </table>
  </div>` : ''}

  ${((STATE.tubingCortes || []).length > 0) ? `
  <div class="ml-section">
    <div class="ml-section-head">TUBING ORNAMENTAL (T00021) · OC CONSTRUCTOR</div>
    <table class="ml-table">
      <thead><tr><th>Cant.</th><th>Código</th><th>Medida (ml)</th><th>Área</th></tr></thead>
      <tbody>
        ${STATE.tubingCortes.map(r => `
        <tr>
          <td class="c"><b>${r.cant}</b></td>
          <td><b>TB${r.cm}</b></td>
          <td>${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)</td>
          <td class="logic">${r.area || ''}</td>
        </tr>`).join('')}
        <tr><td colspan="4" style="background:#fafafa;font-size:8.5pt;color:#555;padding:6px 10px;">
          <b>Total tubing:</b> ${(Math.round(STATE.tubingCortes.reduce((s, r) => s + r.cm * r.cant, 0)) / 100).toFixed(2)} ml
        </td></tr>
      </tbody>
    </table>
  </div>` : ''}

  <div class="ml-foot">
    Generado por Cálculo de Materiales ${cipVer} · ${fechaStr} ${today.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}
  </div>
</body>`;
}

// Lista de Materiales — descargar el PDF (sin diálogo ni ventana emergente)
$('btn-materials-dl').addEventListener('click', () => { descargarListaPDF(); });

// Lista de Materiales — imprimir en papel (abre el diálogo del navegador)
$('btn-materials-pdf').addEventListener('click', () => {
  const html = generateMaterialsListHTML();
  if (html) openPrintWindow(html, `Lista de Materiales ${STATE.exp || ''}`);
});

// Lista de Materiales — botón Excel (planilla estilo checklist: CANT | CODIGO | DESCRIPCIÓN + CORTES REFUERZO)
$('btn-materials-xlsx').addEventListener('click', () => {
  if (STATE.pieces.length === 0) {
    alert('No hay piezas cargadas. Cargá piezas antes de exportar la lista de materiales.');
    return;
  }
  const { hw }  = hardwareAuto();
  const { mat, m2, m2Lam, peso } = materialsAuto();
  const term = STATE.sistema === 'PATAS' ? 'PATA' : 'ZOCLO';
  const hoy = new Date();
  const cipVer = ((document.getElementById('cip-version') || {}).textContent || '').trim();
  const numQty = v => {
    const n = parseFloat(v);
    return isNaN(n) ? String(v == null ? '' : v) : n;
  };

  const aoa = [];
  aoa.push(['LISTA DE MATERIALES']);
  aoa.push(['EXP:', STATE.exp || '']);
  aoa.push(['OBRA:', STATE.obra || '']);
  aoa.push(['CLIENTE:', STATE.cliente || '']);
  aoa.push(['COLOR:', STATE.color || '']);
  aoa.push(['KAP:', STATE.kap]);
  aoa.push(['M² PIEZAS:', numQty(m2)]);
  aoa.push(['M² LAMINADO:', numQty(m2Lam)]);
  aoa.push(['PESO (KG):', +peso.toFixed(1)]);
  aoa.push(['FECHA:', `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`]);
  aoa.push(['VERSIÓN CIP:', cipVer || '—']);
  aoa.push(['CANT.', 'CODIGO', 'DESCRIPCIÓN']);
  const rowItem = (qty, code, desc) => aoa.push([qty, code, (desc || '').toUpperCase()]);
  const etiqXls = hw.filter(h => ETIQUETA_CODES.includes(String(h.code)));
  const hwRestXls = hw.filter(h => !ETIQUETA_CODES.includes(String(h.code)));
  rowItem(numQty((+m2 || 0).toFixed(2)), 'M²', 'Costos estimados · m² total');
  mat.forEach(m => rowItem(numQty(m.qty), m.code, m.desc));
  calcularEmpaque(m2).forEach(e => rowItem(numQty(e.qty), e.code, e.desc));
  etiqXls.forEach(h => rowItem(numQty(h.qty), h.code, h.desc));
  hwRestXls.forEach(h => rowItem(numQty(h.qty), h.code, h.desc));
  expandirCortesRefuerzo(STATE.modelo === 'REFORZADO' && STATE.refuerzo === 'AUTO' ? (STATE.refuerzoCortes || []) : []).forEach(r =>
    rowItem(r.cant, 'RF' + r.cm, `Corte refuerzo ${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)${r.nota ? ' · ' + r.nota : ''}${r.area ? ' · ' + r.area : ''}`));
  (STATE.antepechos || []).forEach(ap =>
    rowItem(ap.cant, 'AN' + Math.round(ap.alto), `Antepecho ${ap.ancho} x ${ap.alto} cm${ap.area ? ' · ' + ap.area : ''}`));
  const puX = (STATE.modelo === 'SCUDO') ? (STATE.perfilUCortes || []) : [];
  if (puX.length) {
    const byA = {};
    puX.forEach(r => { const k = r.area || ''; (byA[k] = byA[k] || []).push(r); });
    let gran = 0;
    Object.keys(byA).forEach(area => {
      let cm = 0;
      byA[area].forEach(r => { cm += r.cm * r.cant; rowItem(r.cant, 'PU' + r.cm, `Corte perfil U ${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)${area ? ' · ' + area : ''}`); });
      gran += cm;
      rowItem('', '', `Total perfil U${area ? ' · ' + area : ''}: ${(cm / 100).toFixed(2)} ml`);
    });
    rowItem('', '', `TOTAL PERFIL U (104-610): ${(gran / 100).toFixed(2)} ml`);
  }
  (STATE.tubingCortes || []).forEach(r =>
    rowItem(r.cant, 'TB' + r.cm, `Tubing ${(r.cm / 100).toFixed(2)} ml (${r.cm} cm)${r.area ? ' · ' + r.area : ''}`));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 62 }];
  const NAVY = '1A2A4A';
  const bdr = { style: 'thin', color: { rgb: 'C8C8C8' } };
  const allB = { top: bdr, bottom: bdr, left: bdr, right: bdr };
  const styTitle = { font: { bold: true, sz: 16, color: { rgb: NAVY } } };
  const styLabel = { font: { bold: true, sz: 11, color: { rgb: NAVY } } };
  const styHead = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: NAVY } }, alignment: { horizontal: 'left', vertical: 'center' }, border: allB };
  const styData = { alignment: { vertical: 'center' }, border: allB };
  const styNum = { alignment: { horizontal: 'center', vertical: 'center' }, border: allB };
  const setS = (ref, s) => { if (ws[ref]) ws[ref].s = s; };
  setS('A1', styTitle);
  for (let r = 2; r <= 11; r++) setS('A' + r, styLabel);
  ['A12', 'B12', 'C12'].forEach(ref => setS(ref, styHead));
  for (let r = 13; r <= aoa.length; r++) { setS('A' + r, styNum); setS('B' + r, styData); setS('C' + r, styData); }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LISTA DE MATERIALES');
  XLSX.writeFile(wb, `Lista de Materiales ${STATE.exp || 'EXP'}.xlsx`);
});

// Limpiar todo: borra el estado en memoria sin recargar la página,
// para empezar una nueva OC importada del Constructor de Planos.
$('btn-clear').addEventListener('click', () => {
  if (!confirm('¿Limpiar todo? Se borrarán la OC importada, piezas y notas.')) return;

  // Reset de identificación y proyecto
  STATE.obra = '';
  STATE.cliente = '';
  STATE.exp = '';
  STATE.linea = 'LEEDER';
  STATE.modelo = 'ESTÁNDAR';
  STATE.modeloCod = 'ESTANDAR';
  STATE.sistema = 'PATAS';
  STATE.kap = 'NO';
  STATE.refuerzo = 'AUTO';
  STATE.refuerzoCortes = [];
  STATE.refuerzoKits = null;
  STATE.puertasAfuera = 0;
  STATE.areaActual = 'Área 1';
  STATE.areasManual = ['Área 1'];
  STATE.herrajesExtraOC = [];
  STATE.antepechos = [];
  STATE.perfilUCortes = [];
  STATE.tubingCortes = [];
  STATE.tubingKits = null;
  STATE.ocAdicional = false;
  STATE.ocSoloHerrajes = false;
  STATE.color = '';
  STATE.colorCode = '';
  STATE.observador = '';
  STATE.fecha = '';
  STATE.notas = '';
  STATE.ocTotal = '';
  STATE.aiAdvertencias = [];

  // Reset modo manual de cut
  STATE.cutManual = { enabled: false, byIid: {}, sheets: [] };

  // Reset de piezas
  STATE.pieces = [];

  // Reset de PDFs y tabla parseada
  STATE.pdfPlano = { name: '', text: '', images: [], numPages: 0 };
  STATE.pdfOC    = { name: '', text: '', images: [], numPages: 0 };
  STATE.ocRowsEdit = [];

  // Reset visual de TODOS los inputs en la UI
  // Identificación
  ['f-obra','f-cliente','f-exp','f-color','f-observador','f-fecha','f-notas','f-oc-total'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
  // Selectores
  if ($('f-linea'))       $('f-linea').value = 'LEEDER';
  fillModelosCIP('LEEDER');
  if ($('f-terminacion')) $('f-terminacion').value = 'PATAS';
  if ($('f-kap'))         $('f-kap').value = 'NO';
  if ($('f-refuerzo'))    $('f-refuerzo').value = 'AUTO';

  // Ocultar la tabla OC parseada
  const ocBlock = $('oc-parsed-block');
  if (ocBlock) ocBlock.style.display = 'none';

  // Refrescar todas las vistas
  renderAll();
  // Volver a la primera pestaña
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const firstTab = document.querySelector('.tab[data-tab="capturar"]');
  const firstContent = $('tab-capturar');
  if (firstTab) firstTab.classList.add('active');
  if (firstContent) firstContent.classList.add('active');

  // Aviso visual breve
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--cyan);color:#000;padding:12px 20px;border-radius:4px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:JetBrains Mono,monospace;font-size:13px';
  banner.textContent = '✓ Limpiado · Listo para nuevo proyecto';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2200);
});

// ════════════════════════════════════════════════════════════════════
//   DEMO
// ════════════════════════════════════════════════════════════════════
function loadDemo() {
  // Caso MXM GUAPILES (S00010) — 100% verificado contra checklist real
  STATE.obra = 'PROYECTO MXM GUAPILES';
  STATE.cliente = 'DICOMA COSTA RICA';
  STATE.exp = 'S00010';
  STATE.linea = 'LEEDER';
  STATE.modelo = 'REFORZADO';
  STATE.modeloCod = 'REFORZADO';
  STATE.sistema = 'ZOCLO';
  STATE.kap = 'NO';
  STATE.refuerzo = 'AUTO';
  STATE.refuerzoCortes = [];
  STATE.refuerzoKits = null;
  STATE.puertasAfuera = 0;
  STATE.areaActual = 'Área 1';
  STATE.areasManual = ['Área 1'];
  STATE.herrajesExtraOC = [];
  STATE.antepechos = [];
  STATE.perfilUCortes = [];
  STATE.tubingCortes = [];
  STATE.tubingKits = null;
  STATE.ocAdicional = false;
  STATE.color = 'ALUMINA 2103';
  STATE.colorCode = '2103-12-1ST';
  STATE.notas = 'Caso verificado · 36 piezas · referencia 100% match contra checklist real';
  STATE.ocTotal = '36';
  STATE.aiAdvertencias = [];

  STATE.pieces = [
    // 12 puertas (10 a 1.50 + 2 a 1.80 para regaderas)
    { id: uid(), tipo: 'PT', codigo: 'PTADER',   ancho: 70,  alto: 150, cant: 5, detalle: '', flag: false },
    { id: uid(), tipo: 'PT', codigo: 'PTAIZQ',   ancho: 70,  alto: 150, cant: 5, detalle: '', flag: false },
    { id: uid(), tipo: 'PT', codigo: 'PTADER',   ancho: 70,  alto: 180, cant: 1, detalle: 'Regadera', flag: false },
    { id: uid(), tipo: 'PT', codigo: 'PTAIZQ',   ancho: 70,  alto: 180, cant: 1, detalle: 'Regadera', flag: false },
    // 6 paneles centrales
    { id: uid(), tipo: 'PN', codigo: 'PNCEN',    ancho: 120, alto: 150, cant: 4, detalle: '', flag: false },
    { id: uid(), tipo: 'PN', codigo: 'PNCEN',    ancho: 130, alto: 150, cant: 2, detalle: '', flag: false },
    // 6 pilastras centrales
    { id: uid(), tipo: 'PL', codigo: 'PLCEN',    ancho: 24,  alto: 210, cant: 2, detalle: '', flag: false },
    { id: uid(), tipo: 'PL', codigo: 'PLCEN',    ancho: 30,  alto: 210, cant: 4, detalle: '', flag: false },
    // 12 pilastras laterales a muro
    { id: uid(), tipo: 'PL', codigo: 'PLLATMUR', ancho: 10,  alto: 210, cant: 2, detalle: '', flag: false },
    { id: uid(), tipo: 'PL', codigo: 'PLLATMUR', ancho: 12,  alto: 210, cant: 5, detalle: '', flag: false },
    { id: uid(), tipo: 'PL', codigo: 'PLLATMUR', ancho: 15,  alto: 210, cant: 3, detalle: '', flag: false },
    { id: uid(), tipo: 'PL', codigo: 'PLLATMUR', ancho: 17,  alto: 210, cant: 2, detalle: '', flag: false },
  ];

  // Sincronizar UI
  $('f-obra').value = STATE.obra;
  $('f-cliente').value = STATE.cliente;
  $('f-exp').value = STATE.exp;
  if ($('f-linea')) $('f-linea').value = STATE.linea;
  fillModelosCIP(STATE.linea);
  $('f-terminacion').value = STATE.sistema;
  $('f-kap').value = STATE.kap;
  $('f-color').value = STATE.color;
  $('f-notas').value = STATE.notas;
  $('f-oc-total').value = STATE.ocTotal;
  if ($('f-refuerzo')) $('f-refuerzo').value = STATE.refuerzo;
  if ($('f-oc-adicional')) $('f-oc-adicional').value = String(STATE.ocAdicional);
  actualizarCamposLinea();
  if ($('f-refuerzo-wrap')) $('f-refuerzo-wrap').style.display = (STATE.modelo === 'REFORZADO') ? '' : 'none';

  renderAll();
  // saltar a la hoja de verificación (dentro de Capturar)
  irAVerificacion();
}

// ════════════════════════════════════════════════════════════════════
//   COMPARADOR vs CHECKLIST .xlsm (ground truth para validar la IA)
// ════════════════════════════════════════════════════════════════════
//
// Lee el .xlsm/.xlsx oficial del checklist y construye un diff lado a lado
// contra STATE.pieces (lo que la IA + reconcile producen).
//
// Estructura del .xlsm soportada (validada contra todos los samples):
//   • Hoja "VERIFICACIÓN":  col A = código, col B = cant total agregada
//                            (1 fila por código de checklist, ej. PTADER, PLLATMUR…)
//   • Hoja "CAPTURAR":      desglose por dimensión, 4 bloques (PT/PL/PN/MG)
//                            Bloque PT cols A-E:   Ancho | Alto | Tipo | CódigoVerf | Cant
//                            Bloque PL cols H-L:   ídem
//                            Bloque PN cols O-S:   ídem
//                            Bloque MG cols V-Y:   Ancho | Alto | CódigoVerf | Cant (sin Tipo)
//
// Comparamos por código agregado primero (más robusto), y por (codigo,ancho,alto)
// como vista detallada cuando se carga la hoja CAPTURAR.

STATE.checklistGT = null;   // { byCodigo: {PTADER:5,...}, byDim: [{codigo,ancho,alto,cant}], total }

function findSheetCI(wb, regex) {
  for (const name of wb.SheetNames) {
    if (regex.test(name)) return wb.Sheets[name];
  }
  return null;
}

// Lee la hoja VERIFICACIÓN: A=código, B=cant. Empieza fila 4.
function readChecklistVerificacion(ws) {
  const out = {};
  if (!ws) return out;
  // Convertir a matriz para lectura simple
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  for (let r = 3; r < Math.min(aoa.length, 32); r++) {
    const row = aoa[r] || [];
    const cod = (row[0] || '').toString().trim().toUpperCase();
    const cant = parseInt(row[1]);
    if (cod && Number.isFinite(cant)) out[cod] = cant;
  }
  return out;
}

// Lee la hoja CAPTURAR: 4 bloques tabulares (PT/PL/PN/MG). Devuelve [{codigo, ancho, alto, cant}].
function readChecklistCapturar(ws) {
  const rows = [];
  if (!ws) return rows;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (aoa.length < 5) return rows;

  // Detectar bloques mirando fila 4 (índice 3): cada "Ancho" arranca un bloque
  // El label PT/PL/PN/MG está en fila 3 (índice 2), pegado a la izquierda.
  const r3 = aoa[2] || [];
  const r4 = aoa[3] || [];
  const blocks = [];
  for (let c = 0; c < r4.length; c++) {
    const v = r4[c];
    if (typeof v !== 'string' || v.trim().toLowerCase() !== 'ancho') continue;
    let label = '';
    for (let cb = c; cb >= Math.max(0, c - 5); cb--) {
      const lv = r3[cb];
      if (typeof lv === 'string' && /^(PT|PL|PN|MG)$/i.test(lv.trim())) {
        label = lv.trim().toUpperCase();
        break;
      }
    }
    if (!label) continue;
    if (label === 'MG') {
      // MG: ancho=c, alto=c+1, codigoVerf=c+2, cant=c+3 (sin Tipo)
      blocks.push({ ca: c, cal: c + 1, ccod: c + 2, ccant: c + 3, label });
    } else {
      // PT/PL/PN: ancho=c, alto=c+1, tipo=c+2, codigoVerf=c+3, cant=c+4
      blocks.push({ ca: c, cal: c + 1, ccod: c + 3, ccant: c + 4, label });
    }
  }

  for (const b of blocks) {
    for (let r = 4; r < aoa.length; r++) {
      const row = aoa[r] || [];
      const ancho = row[b.ca];
      const alto  = row[b.cal];
      const cod   = row[b.ccod];
      const cant  = row[b.ccant];
      if (!cod || !ancho || !alto) continue;
      const cantI = parseInt(cant);
      if (!Number.isFinite(cantI) || cantI <= 0) continue;
      const anchoI = parseInt(ancho);
      const altoI  = parseInt(alto);
      if (!Number.isFinite(anchoI) || !Number.isFinite(altoI)) continue;
      rows.push({
        codigo: cod.toString().trim().toUpperCase(),
        ancho: anchoI, alto: altoI, cant: cantI, familia: b.label,
      });
    }
  }
  return rows;
}

async function loadChecklistFile(file) {
  if (!file) return;
  const drop = $('drop-checklist');
  const status = drop.querySelector('.drop-status');
  status.textContent = '⏳ Leyendo...';
  status.style.color = 'var(--cyan)';
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const wsVer = findSheetCI(wb, /verificaci/i);
    const wsCap = findSheetCI(wb, /capturar/i);
    if (!wsVer && !wsCap) throw new Error('No encontré hojas VERIFICACIÓN ni CAPTURAR en el archivo');

    const byCodigo = wsVer ? readChecklistVerificacion(wsVer) : {};
    const byDim    = wsCap ? readChecklistCapturar(wsCap) : [];
    // Si no hay VERIFICACIÓN pero sí CAPTURAR, agregamos por código
    if (Object.keys(byCodigo).length === 0 && byDim.length > 0) {
      byDim.forEach(r => {
        byCodigo[r.codigo] = (byCodigo[r.codigo] || 0) + r.cant;
      });
    }
    const total = Object.values(byCodigo).reduce((s, v) => s + v, 0);
    STATE.checklistGT = { fileName: file.name, byCodigo, byDim, total };

    drop.classList.remove('empty');
    drop.classList.add('loaded');
    status.textContent = '✓ ' + file.name;
    status.style.color = 'var(--green)';
    renderChecklistDiff();
  } catch (e) {
    console.error(e);
    status.textContent = '✗ Error: ' + (e.message || 'no pude leer');
    status.style.color = 'var(--red)';
  }
}

function renderChecklistDiff() {
  const block = $('checklist-diff-block');
  const totalsEl = $('checklist-diff-totals');
  const tableEl = $('checklist-diff-table');
  const summaryEl = $('checklist-summary');
  const gt = STATE.checklistGT;
  if (!gt) {
    block.style.display = 'none';
    summaryEl.textContent = '';
    return;
  }
  block.style.display = '';

  // Agregar STATE.pieces por código
  const actualByCodigo = {};
  const actualByDim = new Map();   // 'PTADER|62|150' → cant
  (STATE.pieces || []).forEach(p => {
    const cod = (p.codigo || '').toUpperCase();
    if (!cod) return;
    const c = parseInt(p.cant) || 0;
    if (c <= 0) return;
    actualByCodigo[cod] = (actualByCodigo[cod] || 0) + c;
    const k = `${cod}|${p.ancho}|${p.alto}`;
    actualByDim.set(k, (actualByDim.get(k) || 0) + c);
  });
  const actualTotal = Object.values(actualByCodigo).reduce((s, v) => s + v, 0);
  const gtTotal = gt.total;

  // Resumen totales
  const totalDelta = actualTotal - gtTotal;
  const totalClass = (totalDelta === 0) ? 'ok' : (Math.abs(totalDelta) <= 2 ? 'warn' : 'bad');
  totalsEl.className = 'banner ' + totalClass;
  totalsEl.innerHTML = `
    <b>Total checklist:</b> ${gtTotal} pz · <b>Total IA:</b> ${actualTotal} pz · <b>Δ:</b> ${totalDelta >= 0 ? '+' : ''}${totalDelta}
    ${totalDelta === 0 ? ' ✓ coincide' : ' ⚠ revisá diferencias abajo'}
  `;
  summaryEl.innerHTML = `<b style="color:var(--green)">${Object.keys(gt.byCodigo).length}</b> códigos · <b style="color:var(--green)">${gtTotal}</b> piezas`;

  // Comparación por código (agregada)
  const allCodigos = new Set([...Object.keys(gt.byCodigo), ...Object.keys(actualByCodigo)]);
  const sortedCods = Array.from(allCodigos).sort();
  let okCount = 0, mismatchCount = 0;
  let html = `<div style="display: grid; grid-template-columns: 1fr 80px 80px 60px 1fr; gap: 6px; padding: 6px 4px; font-size: 9px; letter-spacing: 0.18em; color: var(--text-mute); text-transform: uppercase; font-weight: 700; border-bottom: 1px solid var(--line);">
    <div>Código</div><div style="text-align:right;">Esperado</div><div style="text-align:right;">Actual (IA)</div><div style="text-align:right;">Δ</div><div>Detalle por dimensión (sólo si hay diff)</div>
  </div>`;
  for (const cod of sortedCods) {
    const exp = gt.byCodigo[cod] || 0;
    const act = actualByCodigo[cod] || 0;
    const d = act - exp;
    let bg, color;
    if (d === 0)        { bg = 'rgba(0,255,149,0.06)'; color = 'var(--green)'; okCount++; }
    else if (Math.abs(d) <= 1) { bg = 'rgba(255,181,71,0.08)'; color = 'var(--amber)'; mismatchCount++; }
    else                { bg = 'rgba(255,77,109,0.08)'; color = 'var(--red)'; mismatchCount++; }

    // Detalle por dimensión: mostrar dimensiones donde hay diferencia para ESTE código
    let dimDetail = '';
    if (d !== 0 && gt.byDim.length > 0) {
      // GT por dimensión para este código
      const gtDim = new Map();
      gt.byDim.filter(r => r.codigo === cod).forEach(r => {
        gtDim.set(`${r.ancho}|${r.alto}`, (gtDim.get(`${r.ancho}|${r.alto}`) || 0) + r.cant);
      });
      // Actual por dimensión para este código
      const actDim = new Map();
      [...actualByDim.entries()].forEach(([k, v]) => {
        const [c, a, h] = k.split('|');
        if (c === cod) actDim.set(`${a}|${h}`, v);
      });
      const allDims = new Set([...gtDim.keys(), ...actDim.keys()]);
      const parts = [];
      [...allDims].sort().forEach(dk => {
        const [a, h] = dk.split('|');
        const ge = gtDim.get(dk) || 0;
        const aa = actDim.get(dk) || 0;
        if (ge !== aa) parts.push(`<span title="${a}×${h}">${a}×${h}: ${ge}→<b style="color:${color}">${aa}</b></span>`);
      });
      dimDetail = parts.join(' · ');
    }

    html += `<div style="display: grid; grid-template-columns: 1fr 80px 80px 60px 1fr; gap: 6px; padding: 5px 4px; align-items: center; border-bottom: 1px solid var(--line); background: ${bg};">
      <div style="font-weight: 600; color: ${color};">${cod}</div>
      <div style="text-align:right; color: var(--text);">${exp}</div>
      <div style="text-align:right; color: ${color}; font-weight: 600;">${act}</div>
      <div style="text-align:right; color: ${color}; font-weight: 700;">${d === 0 ? '·' : (d > 0 ? '+' : '')+d}</div>
      <div class="small" style="color: var(--text-dim);">${dimDetail}</div>
    </div>`;
  }
  tableEl.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════
//   IMPORTAR OC del Constructor de Planos (CSV)
//   Formato CSV: SKU,Cantidad,SubTipo,Orientacion,Area,Modelo,Sistema,Color,KAP
//   El SKU largo (LM1LCRF<FAM><ancho><alto><color><sistema>) codifica las
//   medidas; el SubTipo (PTAIZQ/PNCEN/PLCEN/MG120...) es el "código de verif".
// ════════════════════════════════════════════════════════════════════
// Parser de una línea CSV que respeta comillas dobles (por si un Area trae coma)
function parseCsvLineMx(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Decodifica el SKU largo → { familia, ancho, alto }. El alto SIEMPRE son los
// últimos 3 dígitos del bloque numérico (alturas 120–220); el resto es el ancho.
function decodeSkuModumex(sku) {
  const m = (sku || '').toUpperCase().match(/LM1LCRF(PT|PN|PL|MG|CN)(\d+)/);
  if (!m) return null;
  const familia = m[1];
  const num = m[2];
  if (num.length < 4) return { familia, ancho: 0, alto: int(num) };  // fallback raro
  const alto  = int(num.slice(-3));
  const ancho = int(num.slice(0, -3));
  return { familia, ancho, alto };
}

function importarOCConstructorPlanos(csvText, fileName) {
  const status = $('drop-oc-csv-status');
  const summary = $('oc-csv-summary');
  const lines = (csvText || '').split(/\r?\n/).map(l => l.replace(/﻿/g, '').trim()).filter(Boolean);
  if (lines.length < 2) {
    if (status) { status.textContent = '✕ El archivo está vacío o no es un CSV válido'; status.style.color = 'var(--red)'; }
    return;
  }
  const header = parseCsvLineMx(lines[0]).map(h => h.toLowerCase());
  const col = name => header.indexOf(name);
  const iSku = col('sku'), iCant = col('cantidad'), iSub = col('subtipo'),
        iArea = col('area'), iMod = col('modelo'), iSis = col('sistema'),
        iCol = col('color'), iKap = col('kap'),
        iObra = col('obra'), iCod = col('codigo'), iDist = col('distribuidor'),
        iLinea = col('linea'), iAcab = col('acabado'), iOri = col('orientacion'), iRegion = col('region');
  if (iSku < 0 || iCant < 0 || iSub < 0) {
    if (status) { status.textContent = '✕ Encabezado no reconocido. Se esperaba SKU, Cantidad, SubTipo…'; status.style.color = 'var(--red)'; }
    return;
  }

  const pieces = [];
  let modeloCsv = '', sistemaCsv = '', colorCsv = '', kapCsv = '', obraCsv = '', codigoCsv = '', distCsv = '', lineaCsv = '', acabadoCsv = '', regionCsv = '';
  const areas = new Set();
  const noDecodificados = [];
  const refuerzoCortes = [];
  const refuerzoKits = {};
  const herrajesExtraOC = [];
  const antepechos = [];
  const perfilUCortes = [];
  const tubingCortes = [];
  const tubingKits = {};
  const etiquetasArea = {}; // área → color de pilastra (para etiqueta F35 negra / F36 blanca)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLineMx(lines[i]);
    const sku     = (cols[iSku]  || '').trim();
    const cant    = int(cols[iCant]);
    const subTipo = (cols[iSub]  || '').trim().toUpperCase();
    if (!sku || !cant || !subTipo) continue;
    if (iMod  >= 0 && cols[iMod])  modeloCsv  = cols[iMod];
    if (iLinea >= 0 && cols[iLinea]) lineaCsv = cols[iLinea];
    if (iAcab  >= 0 && cols[iAcab])  acabadoCsv = cols[iAcab];
    if (iRegion >= 0 && cols[iRegion]) regionCsv = cols[iRegion];
    if (iSis  >= 0 && cols[iSis])  sistemaCsv = cols[iSis];
    if (iCol  >= 0 && cols[iCol])  colorCsv   = cols[iCol];
    if (iKap  >= 0 && cols[iKap])  kapCsv     = cols[iKap];
    if (iObra >= 0 && cols[iObra]) obraCsv    = cols[iObra];
    if (iCod  >= 0 && cols[iCod])  codigoCsv  = cols[iCod];
    if (iDist >= 0 && cols[iDist]) distCsv    = cols[iDist];
    const areaTxt = (iArea >= 0 ? (cols[iArea] || '').trim() : '');
    // Filas especiales del Constructor: refuerzo (REFORZADO) y herrajes extra.
    // NO entran como piezas — se guardan aparte.
    if (subTipo === 'REFUERZO') {
      const mRf = sku.match(/^RF(\d+(?:[.,]\d+)?)$/i);
      const cm = mRf ? parseFloat(mRf[1].replace(',', '.')) : 0;
      if (cm > 0) refuerzoCortes.push({ cm, cant, area: areaTxt });
      if (areaTxt) areas.add(areaTxt);
      continue;
    }
    if (subTipo === 'REFUERZO-KIT') {
      const kKit = sku.toUpperCase();
      refuerzoKits[kKit] = (refuerzoKits[kKit] || 0) + cant;
      continue;
    }
    if (subTipo === 'ANTEPECHO') {
      const mAp = sku.match(/^A[NP](\d+(?:[.,]\d+)?)X(\d+(?:[.,]\d+)?)$/i);
      const apA = mAp ? parseFloat(mAp[1].replace(',', '.')) : 0;
      const apH = mAp ? parseFloat(mAp[2].replace(',', '.')) : 0;
      const colAp = (iCol >= 0 ? (cols[iCol] || '').trim() : '');
      if (apA > 0 && apH > 0) antepechos.push({ ancho: apA, alto: apH, cant, area: areaTxt, color: colAp });
      if (areaTxt) areas.add(areaTxt);
      continue;
    }
    if (subTipo === 'PERFILU') {
      const mPu = sku.match(/^PU(\d+(?:[.,]\d+)?)$/i);
      const puCm = mPu ? parseFloat(mPu[1].replace(',', '.')) : 0;
      if (puCm > 0) perfilUCortes.push({ cm: puCm, cant, area: areaTxt });
      if (areaTxt) areas.add(areaTxt);
      continue;
    }
    if (subTipo === 'TUBING') {
      const mTb = sku.match(/^TB(\d+(?:[.,]\d+)?)$/i);
      const tbCm = mTb ? parseFloat(mTb[1].replace(',', '.')) : 0;
      if (tbCm > 0) tubingCortes.push({ cm: tbCm, cant, area: areaTxt });
      if (areaTxt) areas.add(areaTxt);
      continue;
    }
    if (subTipo === 'TUBING-KIT') {
      const kTb = sku.toUpperCase();
      tubingKits[kTb] = (tubingKits[kTb] || 0) + cant;
      continue;
    }
    if (subTipo.startsWith('HERRAJE')) {
      herrajesExtraOC.push({ codigo: sku, cant });
      continue;
    }
    const dec = decodeSkuModumex(sku);
    if (!dec) noDecodificados.push(sku);
    const ancho = dec ? dec.ancho : 0;
    const alto  = dec ? dec.alto  : 0;
    // codigo = SubTipo (es lo que la hoja de verificación usa como "código").
    // tipo = familia (PT/PN/PL/MG) derivada del SubTipo conocido o del SKU.
    const tipo = TIPO_BY_CODE[subTipo]
      || (subTipo.startsWith('PT') ? 'PT'
        : subTipo.startsWith('PN') ? 'PN'
        : subTipo.startsWith('MG') ? 'MG'
        : subTipo === 'CN'         ? 'CN' : 'PL');
    if (areaTxt) areas.add(areaTxt);
    const colPz = (iCol >= 0 ? (cols[iCol] || '').trim() : '');
    if (tipo === 'PL' && areaTxt) {
      const nvPz = lookupColor(colPz).nuevo;
      if (!etiquetasArea[areaTxt] || nvPz === 'NEGRO' || nvPz === 'NOGAL GRAFITO') etiquetasArea[areaTxt] = colPz;
    }
    pieces.push({
      id: uid(), tipo, codigo: subTipo, ancho, alto, cant,
      color: colPz,
      area: areaTxt || '',
      orientacion: (iOri >= 0 ? (cols[iOri] || '').trim().toUpperCase() : ''),
      detalle: 'OC Constructor' + (areaTxt ? ' · ' + areaTxt : ''),
      flag: false
    });
  }

  if (pieces.length === 0) {
    if (status) { status.textContent = '✕ No se encontraron piezas válidas en el CSV'; status.style.color = 'var(--red)'; }
    return;
  }

  // ─── Volcar a STATE ───
  STATE.pieces = pieces;
  STATE.refuerzoCortes = refuerzoCortes;
  STATE.refuerzoKits = Object.keys(refuerzoKits).length ? refuerzoKits : null;
  STATE.puertasAfuera = 0;
  STATE.areaActual = (STATE.pieces.find(p => p.area) || {}).area || 'Área 1';
  STATE.areasManual = [...new Set(STATE.pieces.map(p => p.area || 'Área 1'))];
  STATE.herrajesExtraOC = herrajesExtraOC;
  STATE.antepechos = antepechos;
  STATE.perfilUCortes = perfilUCortes;
  STATE.tubingCortes = tubingCortes;
  STATE.tubingKits = Object.keys(tubingKits).length ? tubingKits : null;
  STATE.etiquetasArea = etiquetasArea;
  // Línea + Modelo desde el CSV. STATE.modeloCod = modelo REAL del catálogo (display);
  // STATE.modelo = FAMILIA DE CÁLCULO base (ESTÁNDAR/REFORZADO/REGADERA/SCUDO) que usa
  // todo el cálculo de herraje. Si la columna Linea no viene (CSV viejo) → LEEDER.
  STATE.linea = lineaDeCsv(lineaCsv);
  STATE.acabado = (acabadoCsv || '').trim();
  STATE.modeloCod = modeloCodigoDeCsv(STATE.linea, modeloCsv);
  STATE.modelo = modeloBaseDe(STATE.modeloCod);
  // Sistema / terminación
  const sisU = (sistemaCsv || '').toUpperCase();
  if      (sisU.includes('ZOCLO') || sisU.includes('ZÓCALO') || sisU.includes('ZOCALO')) STATE.sistema = 'ZOCLO';
  else if (sisU.includes('PATA')) STATE.sistema = 'PATAS';
  // Color, KAP — color principal = el más frecuente entre las piezas (por cantidad),
  // para que el topbar/veta/hoja de sólido usen el color dominante. El desglose de
  // laminado por color (2 colores) se hace en calculateMaterials leyendo p.color.
  {
    const colorCount = {};
    pieces.forEach(p => { if (p.color) colorCount[p.color] = (colorCount[p.color] || 0) + (int(p.cant) || 1); });
    let primaryColor = colorCsv ? colorCsv.trim() : '', best = -1;
    Object.keys(colorCount).forEach(k => { if (colorCount[k] > best) { best = colorCount[k]; primaryColor = k; } });
    if (primaryColor) STATE.color = primaryColor;
  }
  // Región de colores: MANDA la columna Region del CSV (región del distribuidor). Si el CSV es
  // viejo y no la trae, se auto-detecta por el color cuando es exclusivo de un país.
  if (regionCsv) {
    STATE.region = _stripAccents(regionCsv).toUpperCase().includes('MEX') ? 'MX' : 'CR';
  } else {
    const regDetCsv = detectarRegionColor(STATE.color);
    if (regDetCsv) STATE.region = regDetCsv;
  }
  STATE.kap = /S[IÍ]/.test((kapCsv || '').toUpperCase()) ? 'SI' : 'NO';
  // Nombre de la Obra (columna Obra del CSV)
  if (obraCsv) STATE.obra = obraCsv.trim();
  // Distribuidor (columna Distribuidor del CSV) → campo Cliente / Distribuidor
  if (distCsv) STATE.cliente = distCsv.trim();
  // EXP / Expediente: preferir la columna Codigo del CSV; si no, derivar del
  // nombre del archivo (OC_S00099.csv → S00099).
  if (codigoCsv) {
    STATE.exp = codigoCsv.trim();
  } else {
    const expM = (fileName || '').match(/OC[_-]?([A-Za-z0-9]+)\.csv$/i);
    if (expM) STATE.exp = expM[1];
  }
  // Total de OC declarado
  const totalPz = pieces.reduce((s, p) => s + p.cant, 0);
  STATE.ocTotal = String(totalPz);

  // ─── Sincronizar campos del formulario (pestaña Capturar) ───
  if ($('f-linea'))       $('f-linea').value       = STATE.linea;
  fillModelosCIP(STATE.linea);
  if ($('f-region'))      $('f-region').value       = STATE.region;
  poblarColoresCIP();
  if ($('f-terminacion')) $('f-terminacion').value = STATE.sistema;
  if ($('f-kap'))         $('f-kap').value          = STATE.kap;
  if ($('f-color'))       $('f-color').value        = STATE.color;
  if ($('f-obra') && STATE.obra) $('f-obra').value  = STATE.obra;
  if ($('f-cliente') && STATE.cliente) $('f-cliente').value = STATE.cliente;
  if ($('f-exp') && STATE.exp) $('f-exp').value     = STATE.exp;
  if ($('f-oc-total'))    $('f-oc-total').value      = totalPz;
  // refrescar visibilidad del refuerzo si el modelo es REFORZADO
  const refWrap = $('f-refuerzo-wrap');
  if (refWrap) refWrap.style.display = STATE.modelo === 'REFORZADO' ? '' : 'none';

  renderAll();

  // ─── Estado / resumen ───
  if (status) {
    status.textContent = `✓ Importado: ${pieces.length} renglón(es) · ${totalPz} pieza(s)`;
    status.style.color = 'var(--green)';
  }
  $('drop-oc-csv').classList.remove('empty');
  $('drop-oc-csv').classList.add('loaded');
  const areasTxt = areas.size ? ' · Áreas: ' + Array.from(areas).join(', ') : '';
  const warnTxt  = noDecodificados.length ? ` · ⚠ ${noDecodificados.length} SKU sin medidas decodificadas` : '';
  if (summary) {
    const obraTxt = STATE.obra ? ` — ${STATE.obra}` : '';
    summary.innerHTML = `<b>${STATE.exp || 'OC'}</b>${obraTxt} · ${STATE.modelo} · ${STATE.sistema} · ${STATE.color || 'sin color'}${areasTxt}${warnTxt}`;
  }
  // El plano pidió un COLOR que tiene varias láminas: acá se elige con cuál se
  // fabrica, que es la que se da de baja del almacén.
  pedirLaminaDelColor(colorCsv);
  // Tras importar, saltar a la pestaña Verificación para que se vea la hoja llena.
  if (typeof irAVerificacion === 'function') irAVerificacion();
}

/**
 * Pregunta con qué LÁMINA se fabrica, cuando el plano pidió un color que tiene
 * varias.
 *
 * El Constructor manda "Alumina" y la columna del código vacía a propósito: no
 * le toca a él elegir entre las tres láminas de Alumina. Elegirla acá, con el
 * código a la vista, es lo que evita cortar la equivocada.
 *
 * Con una sola lámina no pregunta nada y limpia el aviso.
 */
function pedirLaminaDelColor(nombrePlano) {
  const caja = $('oc-lamina');
  if (!caja) return;
  const opciones = STATE.region === 'MX' ? opcionesDeFamiliaMx(nombrePlano || STATE.color) : null;
  if (!opciones) { caja.style.display = 'none'; caja.innerHTML = ''; return; }

  const pedido = (nombrePlano || STATE.color || '').trim();
  const botones = opciones.map(k => {
    const ci = COLOR_MAP_MX[k] || {};
    const nombre = ci.nuevo || k;
    const codigo = ci.code || '';
    const elegida = _stripAccents(STATE.color || '').toUpperCase().trim() === k;
    return `<button type="button" class="btn btn-sm${elegida ? ' btn-primary' : ''}" data-lamina="${nombre.replace(/"/g, '&quot;')}">${nombre}${codigo ? ' · ' + codigo : ''}</button>`;
  }).join(' ');

  caja.style.display = '';
  caja.innerHTML =
    `<div style="font-size:12px; margin-bottom:6px;">El plano pide <b>${pedido}</b>, y hay ${opciones.length} láminas de ese color.` +
    ` Elegí con cuál se fabrica: es la que se da de baja.</div><div style="display:flex; gap:6px; flex-wrap:wrap;">${botones}</div>`;

  caja.querySelectorAll('[data-lamina]').forEach(b => {
    b.addEventListener('click', () => {
      STATE.color = b.dataset.lamina;
      if ($('f-color')) $('f-color').value = STATE.color;
      pedirLaminaDelColor(nombrePlano);
      renderAll();
    });
  });
}

// ── Bindings del importador CSV ──
{
  const fileEl = $('file-oc-csv');
  const dropEl = $('drop-oc-csv');
  const leer = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => importarOCConstructorPlanos(ev.target.result, f.name);
    reader.readAsText(f, 'utf-8');
  };
  if (fileEl && dropEl) {
    // NOTA: drop-oc-csv es un <label> que envuelve al <input file>, así que el
    // clic ya abre el diálogo de forma NATIVA. No agregamos dropEl.click()→fileEl.click()
    // porque eso lo dispararía 2 veces (se abría el explorador de archivos duplicado).
    dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('hover'); });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('hover'));
    dropEl.addEventListener('drop', e => {
      e.preventDefault(); dropEl.classList.remove('hover');
      leer(e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    fileEl.addEventListener('change', e => leer(e.target.files && e.target.files[0]));
  }
  const btnClear = $('btn-oc-csv-clear');
  if (btnClear) btnClear.addEventListener('click', () => {
    STATE.pieces = [];
    renderAll();
    const st = $('drop-oc-csv-status');
    if (st) { st.textContent = 'Subí el CSV (OC_Sxxxxx.csv) que descargás del Constructor de Planos'; st.style.color = 'var(--cyan)'; }
    $('drop-oc-csv').classList.add('empty');
    $('drop-oc-csv').classList.remove('loaded');
    if (fileEl) fileEl.value = '';
    const sm = $('oc-csv-summary'); if (sm) sm.textContent = 'Esperando archivo…';
  });
}

// ── Comparador vs checklist .xlsm: REMOVIDO ──
// La verificación se llena directamente desde el CSV del Constructor de Planos,
// que ES la fuente correcta — ya no hace falta comparar contra un .xlsm externo.
// Las funciones loadChecklistFile / renderChecklistDiff quedan definidas pero
// sin UI que las invoque (código muerto inofensivo).

// ════════════════════════════════════════════════════════════════════
//   INIT
// ════════════════════════════════════════════════════════════════════
if ($('f-linea')) $('f-linea').value = STATE.linea;
if ($('f-region')) $('f-region').value = STATE.region;
fillModelosCIP(STATE.linea);
poblarColoresCIP();
renderAll();

