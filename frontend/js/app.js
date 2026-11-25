/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let pagos = [];
let editandoId = null;   // null = modo crear | número = modo editar

/* ============================================================
   SELECTORES DOM
   ============================================================ */
const $ = (id) => document.getElementById(id);

const dom = {
  alertas:        $('alertas'),
  form:           $('form-pago'),
  formTitulo:     $('form-titulo'),
  formModo:       $('form-modo'),
  btnGuardar:     $('btn-guardar'),
  btnCancelar:    $('btn-cancelar'),
  btnLimpiar:     $('btn-limpiar'),
  btnRefrescar:   $('btn-refrescar'),
  btnRefrescarRep:$('btn-refrescar-reportes'),
  tbody:          $('tbody-pagos'),
  headerStatus:   $('header-status'),
  comisionPrev:   $('comision_preview'),
  repCiudad:      $('rep-ciudad'),
  repProveedor:   $('rep-proveedor'),
  repConsolidado: $('rep-consolidado'),
  resumen: {
    total:    $('r-total'),
    costo:    $('r-costo'),
    venta:    $('r-venta'),
    ganancia: $('r-ganancia'),
    comision: $('r-comision'),
  },
};

/* Campos del formulario que deben serializarse */
const CAMPOS = [
  'codigo_tour', 'nombre_tour', 'ciudad', 'proveedor', 'concepto',
  'fecha_servicio', 'fecha_pago', 'costo', 'venta', 'estrellas', 'estado',
];

/* ============================================================
   UTILIDADES
   ============================================================ */
const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoyISO = () => new Date().toISOString().slice(0, 10);

function mostrarAlerta(tipo, mensaje) {
  const div = document.createElement('div');
  div.className = `alerta alerta-${tipo}`;
  div.textContent = mensaje;
  dom.alertas.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 5500);
}

function actualizarHeaderStatus(ok, texto) {
  dom.headerStatus.textContent = texto;
  dom.headerStatus.className = 'header-status ' + (ok ? 'ok' : 'error');
}

/* Mapea código HTTP → alerta visual */
function alertaPorStatus(status, data, accion) {
  const msg = (data && data.error) || 'Error desconocido del servidor.';
  if (status === 201) { mostrarAlerta('exito', `✔ Pago creado correctamente (201 Created).`); return; }
  if (status === 200) { mostrarAlerta('exito', `✔ ${accion} correctamente (200 OK).`); return; }
  if (status === 204) { mostrarAlerta('exito', `✔ Pago eliminado correctamente (204 No Content).`); return; }
  if (status === 400) { mostrarAlerta('error', `✖ Error de validación (400 Bad Request): ${msg}`); return; }
  if (status === 404) { mostrarAlerta('error', `✖ Recurso no encontrado (404 Not Found): ${msg}`); return; }
  if (status === 409) { mostrarAlerta('advertencia', `⚠ Conflicto (409): ${msg}`); return; }
  if (status === 0)   { mostrarAlerta('error', msg); return; }
  mostrarAlerta('error', `✖ Error del servidor (${status}): ${msg}`);
}

/* ============================================================
   SERIALIZAR / DESERIALIZAR FORMULARIO
   ============================================================ */
function leerFormulario() {
  const data = {};
  for (const campo of CAMPOS) {
    const el = $(campo);
    if (!el) continue;
    let v = el.value.trim();
    if (v === '') { data[campo] = null; continue; }
    if (campo === 'costo' || campo === 'venta') v = Number(v);
    if (campo === 'estrellas') v = Number(v);
    data[campo] = v;
  }
  return data;
}

function escribirFormulario(pago) {
  for (const campo of CAMPOS) {
    const el = $(campo);
    if (!el) continue;
    el.value = pago[campo] ?? '';
  }
  actualizarPreviewComision();
}

function limpiarFormulario() {
  dom.form.reset();
  $('comision_preview').value = '$0.00';
  document.querySelectorAll('.form-group input.invalid').forEach(el => el.classList.remove('invalid'));
}

/* ============================================================
   VALIDACIÓN CLIENTE (espejo del servidor)
   ============================================================ */
function validarFormulario(data) {
  const errs = [];
  const inp = (campo) => $(campo).classList.add('invalid');

  document.querySelectorAll('.form-group input.invalid').forEach(el => el.classList.remove('invalid'));

  if (!data.codigo_tour || data.codigo_tour.length < 3 || data.codigo_tour.length > 40) {
    errs.push('El código del tour debe tener entre 3 y 40 caracteres.'); inp('codigo_tour');
  }
  if (!data.nombre_tour || data.nombre_tour.length < 3 || data.nombre_tour.length > 120) {
    errs.push('El nombre del tour debe tener entre 3 y 120 caracteres.'); inp('nombre_tour');
  }
  if (!data.ciudad || data.ciudad.length < 3 || data.ciudad.length > 80) {
    errs.push('La ciudad debe tener entre 3 y 80 caracteres.'); inp('ciudad');
  }
  if (!data.proveedor || data.proveedor.length < 3 || data.proveedor.length > 80) {
    errs.push('El proveedor debe tener entre 3 y 80 caracteres.'); inp('proveedor');
  }
  if (!data.concepto) { errs.push('Debes seleccionar un concepto.'); inp('concepto'); }
  if (!data.fecha_servicio) { errs.push('La fecha de servicio es obligatoria.'); inp('fecha_servicio'); }
  if (!data.costo || data.costo <= 0) { errs.push('El costo debe ser mayor que 0.'); inp('costo'); }
  if (!data.venta || data.venta <= 0) { errs.push('La venta debe ser mayor que 0.'); inp('venta'); }
  if (data.costo > 0 && data.venta > 0 && data.venta < data.costo) {
    errs.push('La venta no puede ser menor que el costo.'); inp('venta'); inp('costo');
  }
    if (data.fecha_pago) {
    if (data.fecha_servicio && data.fecha_pago > data.fecha_servicio) {
      errs.push('La fecha de pago no puede ser posterior a la fecha de servicio (al proveedor se le paga antes del tour).');
      inp('fecha_pago');
    }
    if (data.estado === 'pagado' && data.fecha_pago > hoyISO()) {
      errs.push('Si el estado es "pagado", la fecha de pago no puede ser futura.');
      inp('fecha_pago');
    }
  }
  if (data.estado === 'pagado' && !data.fecha_pago) {
    errs.push('Si el estado es "pagado" debes registrar la fecha de pago.'); inp('fecha_pago');
  }

  return errs;
}

/* ============================================================
   PREVIEW DE COMISIÓN (espejo del cálculo del servidor)
   ============================================================ */
function calcularComision(venta, costo, estrellas) {
  if (!venta || !costo) return 0;
  const ganancia = venta - costo;
  let pct = 0;
  if (estrellas === 5) pct = 0.04;
  else if (estrellas === 4) pct = 0.02;
  else if (estrellas >= 1 && estrellas <= 3) pct = 0.01;
  return Math.round(ganancia * pct * 100) / 100;
}

function actualizarPreviewComision() {
  const venta = Number($('venta').value) || 0;
  const costo = Number($('costo').value) || 0;
  const estrellasRaw = $('estrellas').value;
  const estrellas = estrellasRaw ? Number(estrellasRaw) : null;
  dom.comisionPrev.value = fmtMoney(calcularComision(venta, costo, estrellas));
}

/* ============================================================
   RENDER — TABLA Y RESUMEN
   ============================================================ */
function renderResumen(lista) {
  const activos = lista.filter(p => p.estado !== 'anulado');
  const total = lista.length;
  const costo = activos.reduce((a, p) => a + Number(p.costo || 0), 0);
  const venta = activos.reduce((a, p) => a + Number(p.venta || 0), 0);
  const comision = activos.reduce((a, p) => a + Number(p.comision_vendedor || 0), 0);
  dom.resumen.total.textContent = total;
  dom.resumen.costo.textContent = fmtMoney(costo);
  dom.resumen.venta.textContent = fmtMoney(venta);
  dom.resumen.ganancia.textContent = fmtMoney(venta - costo);
  dom.resumen.comision.textContent = fmtMoney(comision);
}

function renderTabla(lista) {
  if (!lista.length) {
    dom.tbody.innerHTML = `<tr><td colspan="15" class="empty">No hay pagos registrados. Usa el formulario para crear el primero.</td></tr>`;
    return;
  }
  dom.tbody.innerHTML = lista.map(p => {
    const ganancia = Number(p.venta) - Number(p.costo);
    const estrellas = p.estrellas
      ? `<span class="estrellas">${'★'.repeat(p.estrellas)}</span>`
      : `<span class="estrellas"><span class="sin">—</span></span>`;
    return `
      <tr>
        <td>${p.id}</td>
        <td><code>${p.codigo_tour}</code></td>
        <td>${p.nombre_tour}</td>
        <td>${p.ciudad}</td>
        <td>${p.proveedor}</td>
        <td>${p.concepto}</td>
        <td>${p.fecha_servicio}</td>
        <td>${p.fecha_pago || '—'}</td>
        <td class="num">${fmtMoney(p.costo)}</td>
        <td class="num">${fmtMoney(p.venta)}</td>
        <td class="num">${fmtMoney(ganancia)}</td>
        <td class="num">${estrellas}</td>
        <td class="num">${fmtMoney(p.comision_vendedor)}</td>
        <td><span class="badge badge-${p.estado}">${p.estado}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-secondary" data-accion="editar" data-id="${p.id}">Editar</button>
            <button class="btn btn-danger" data-accion="eliminar" data-id="${p.id}">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ============================================================
   CARGA DE DATOS
   ============================================================ */
async function cargarPagos() {
  dom.tbody.innerHTML = `<tr><td colspan="15" class="empty">Cargando pagos...</td></tr>`;
  const { ok, status, data } = await api.listar();
  if (!ok) {
    alertaPorStatus(status, data, 'listar');
    dom.tbody.innerHTML = `<tr><td colspan="15" class="empty">Error al cargar. Revisa la consola del servidor.</td></tr>`;
    actualizarHeaderStatus(false, 'Sin conexión al backend');
    return;
  }
  pagos = Array.isArray(data) ? data : [];
  renderTabla(pagos);
  renderResumen(pagos);
  actualizarHeaderStatus(true, `Conectado · ${pagos.length} pagos`);
}

/* ============================================================
   CREAR / ACTUALIZAR
   ============================================================ */
async function onSubmitForm(e) {
  e.preventDefault();

  const data = leerFormulario();
  const errores = validarFormulario(data);
  if (errores.length) {
    mostrarAlerta('error', '✖ Validación cliente: ' + errores.join(' '));
    return;
  }

  dom.btnGuardar.disabled = true;
  dom.btnGuardar.textContent = editandoId ? 'Guardando cambios...' : 'Guardando...';

  const resp = editandoId
    ? await api.actualizar(editandoId, data)
    : await api.crear(data);

  dom.btnGuardar.disabled = false;
  dom.btnGuardar.textContent = 'Guardar pago';

  if (resp.ok) {
    alertaPorStatus(resp.status, resp.data, editandoId ? 'Pago actualizado' : 'Pago creado');
    salirModoEdicion();
    limpiarFormulario();
    await cargarPagos();
    await cargarReportes();
  } else {
    alertaPorStatus(resp.status, resp.data);
  }
}

/* ============================================================
   EDITAR
   ============================================================ */
function entrarModoEdicion(pago) {
  editandoId = pago.id;
  escribirFormulario(pago);
  dom.formTitulo.textContent = `Editar pago #${pago.id}`;
  dom.formModo.textContent = 'Editar';
  dom.formModo.className = 'badge badge-pagado';
  dom.btnGuardar.textContent = 'Guardar cambios';
  dom.btnCancelar.hidden = false;
  dom.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function salirModoEdicion() {
  editandoId = null;
  dom.formTitulo.textContent = 'Registrar nuevo pago';
  dom.formModo.textContent = 'Crear';
  dom.formModo.className = 'badge badge-info';
  dom.btnGuardar.textContent = 'Guardar pago';
  dom.btnCancelar.hidden = true;
}

async function onEditar(id) {
  const resp = await api.obtener(id);
  if (!resp.ok) { alertaPorStatus(resp.status, resp.data); return; }
  if (resp.data.estado === 'anulado') {
    mostrarAlerta('advertencia', 'Un pago anulado no puede editarse.');
    return;
  }
  entrarModoEdicion(resp.data);
}

/* ============================================================
   ELIMINAR (con confirmación)
   ============================================================ */
async function onEliminar(id) {
  const pago = pagos.find(p => p.id === id);
  const desc = pago
    ? `${pago.codigo_tour} · ${pago.proveedor} (${fmtMoney(pago.costo)})`
    : `ID ${id}`;

  const confirmado = confirm(
    `¿Seguro que quieres eliminar este pago?\n\n${desc}\n\nEsta acción no se puede deshacer.`
  );
  if (!confirmado) { mostrarAlerta('info', 'Eliminación cancelada.'); return; }

  const resp = await api.eliminar(id);
  if (resp.ok || resp.status === 204) {
    mostrarAlerta('exito', '✔ Pago eliminado (204 No Content).');
    if (editandoId === id) { salirModoEdicion(); limpiarFormulario(); }
    await cargarPagos();
    await cargarReportes();
  } else {
    alertaPorStatus(resp.status, resp.data);
  }
}

/* ============================================================
   REPORTES
   ============================================================ */
function renderTablaReporte(container, rows, columnas, formato = {}) {
  if (!rows || !rows.length) {
    container.innerHTML = '<p class="empty">Sin datos.</p>';
    return;
  }
  const th = columnas.map(c => `<th>${c.label}</th>`).join('');
  const tr = rows.map(r => {
    const tds = columnas.map(c => {
      const v = r[c.key];
      const display = formato[c.key] ? formato[c.key](v) : (v ?? '—');
      return `<td>${display}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  container.innerHTML = `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

async function cargarReportes() {
  const [ciudad, proveedor, consolidado] = await Promise.all([
    api.reportePorCiudad(),
    api.reportePorProveedor(),
    api.reporteConsolidadoTour(),
  ]);

  if (ciudad.ok) {
    renderTablaReporte(dom.repCiudad, ciudad.data, [
      { key: 'ciudad', label: 'Ciudad' },
      { key: 'cantidad_pagos', label: 'Pagos' },
      { key: 'total_costo', label: 'Costo' },
      { key: 'total_venta', label: 'Venta' },
      { key: 'total_ganancia', label: 'Ganancia' },
      { key: 'total_comision', label: 'Comisión' },
    ], {
      total_costo: fmtMoney, total_venta: fmtMoney,
      total_ganancia: fmtMoney, total_comision: fmtMoney,
    });
  } else {
    dom.repCiudad.innerHTML = `<p class="empty">Error: ${ciudad.data?.error || 'desconocido'}</p>`;
  }

  if (proveedor.ok) {
    renderTablaReporte(dom.repProveedor, proveedor.data, [
      { key: 'ciudad', label: 'Ciudad' },
      { key: 'proveedor', label: 'Proveedor' },
      { key: 'cantidad_pagos', label: 'Pagos' },
      { key: 'total_pagado', label: 'Pagado' },
    ], { total_pagado: fmtMoney });
  } else {
    dom.repProveedor.innerHTML = `<p class="empty">Error: ${proveedor.data?.error || 'desconocido'}</p>`;
  }

  if (consolidado.ok) {
    renderTablaReporte(dom.repConsolidado, consolidado.data, [
      { key: 'codigo_tour', label: 'Código' },
      { key: 'lineas', label: 'Líneas' },
      { key: 'costo_total', label: 'Costo' },
      { key: 'venta_total', label: 'Venta' },
      { key: 'comision_total', label: 'Comisión' },
      { key: 'utilidad_neta', label: 'Utilidad' },
    ], {
      costo_total: fmtMoney, venta_total: fmtMoney,
      comision_total: fmtMoney, utilidad_neta: fmtMoney,
    });
  } else {
    dom.repConsolidado.innerHTML = `<p class="empty">Error: ${consolidado.data?.error || 'desconocido'}</p>`;
  }
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
function delegarAccionesTabla() {
  dom.tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.accion === 'editar')   onEditar(id);
    if (btn.dataset.accion === 'eliminar') onEliminar(id);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Health check inicial
  const health = await api.health();
  if (health.ok) {
    actualizarHeaderStatus(true, `Backend OK · ${API_BASE}`);
  } else {
    actualizarHeaderStatus(false, 'Backend no responde');
    mostrarAlerta('error', `No se pudo conectar con ${API_BASE}. Verifica que "npm run dev" esté corriendo y que CORS esté habilitado.`);
  }

  // Listeners
  dom.form.addEventListener('submit', onSubmitForm);

  dom.btnCancelar.addEventListener('click', () => {
    salirModoEdicion();
    limpiarFormulario();
    mostrarAlerta('info', 'Edición cancelada.');
  });

  dom.btnLimpiar.addEventListener('click', () => {
    if (editandoId) salirModoEdicion();
    limpiarFormulario();
  });

  dom.btnRefrescar.addEventListener('click', () => { cargarPagos(); cargarReportes(); });
  dom.btnRefrescarRep.addEventListener('click', cargarReportes);

  // Preview de comisión en vivo
  ['venta', 'costo', 'estrellas'].forEach(id => $(id).addEventListener('input', actualizarPreviewComision));

  delegarAccionesTabla();

  // Carga inicial
  await cargarPagos();
  await cargarReportes();
});