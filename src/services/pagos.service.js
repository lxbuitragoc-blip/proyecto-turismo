const repo = require('../repositories/pagos.repository');

const CONCEPTOS_VALIDOS = ['alojamiento', 'traslado', 'alimentacion', 'guia', 'intermediario', 'otro'];
const ESTADOS_VALIDOS = ['pendiente', 'pagado', 'anulado'];

// Crea un Error con código HTTP asociado (lo interpreta el middleware)
const crearError = (mensaje, status = 400) => {
  const error = new Error(mensaje);
  error.status = status;
  return error;
};

const esVacio = (v) => v === undefined || v === null || v === '';
const esFechaISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Comisión del vendedor según estrellas del tour.
 *   Base = ganancia = venta - costo
 *   5 estrellas -> 4%
 *   4 estrellas -> 2%
 *   1, 2, 3     -> 1%
 *   sin estrellas -> 0%
 */
const calcularComision = (venta, costo, estrellas) => {
  const ganancia = venta - costo;
  let pct = 0;
  if (estrellas === 5) pct = 0.04;
  else if (estrellas === 4) pct = 0.02;
  else if (estrellas >= 1 && estrellas <= 3) pct = 0.01;
  return Math.round(ganancia * pct * 100) / 100;
};

/**
 * Valida y normaliza los datos del pago.
 * parcial = true  -> solo valida los campos enviados (PATCH)
 * parcial = false -> exige todos los campos obligatorios (POST / PUT)
 */
const validarCampos = (datos, { parcial = false, actual = null } = {}) => {
  const errores = [];
  const limpio = {};
  const base = actual || {};

  // codigo_tour
  if (esVacio(datos.codigo_tour)) {
    if (!parcial) errores.push('El campo "codigo_tour" es obligatorio.');
  } else {
    const v = String(datos.codigo_tour).trim();
    if (v.length < 3 || v.length > 40) errores.push('El "codigo_tour" debe tener entre 3 y 40 caracteres.');
    else limpio.codigo_tour = v;
  }

  // nombre_tour
  if (esVacio(datos.nombre_tour)) {
    if (!parcial) errores.push('El campo "nombre_tour" es obligatorio.');
  } else {
    const v = String(datos.nombre_tour).trim();
    if (v.length < 3 || v.length > 120) errores.push('El "nombre_tour" debe tener entre 3 y 120 caracteres.');
    else limpio.nombre_tour = v;
  }

  // ciudad
  if (esVacio(datos.ciudad)) {
    if (!parcial) errores.push('El campo "ciudad" es obligatorio.');
  } else {
    const v = String(datos.ciudad).trim();
    if (v.length < 3 || v.length > 80) errores.push('La "ciudad" debe tener entre 3 y 80 caracteres.');
    else limpio.ciudad = v;
  }

  // proveedor
  if (esVacio(datos.proveedor)) {
    if (!parcial) errores.push('El campo "proveedor" es obligatorio.');
  } else {
    const v = String(datos.proveedor).trim();
    if (v.length < 3 || v.length > 80) errores.push('El "proveedor" debe tener entre 3 y 80 caracteres.');
    else limpio.proveedor = v;
  }

  // concepto (catálogo cerrado)
  if (esVacio(datos.concepto)) {
    if (!parcial) errores.push('El campo "concepto" es obligatorio.');
  } else {
    const v = String(datos.concepto).trim().toLowerCase();
    if (!CONCEPTOS_VALIDOS.includes(v)) errores.push(`El "concepto" debe ser uno de: ${CONCEPTOS_VALIDOS.join(', ')}.`);
    else limpio.concepto = v;
  }

  // fecha_servicio (obligatoria, puede ser futura)
  if (esVacio(datos.fecha_servicio)) {
    if (!parcial) errores.push('El campo "fecha_servicio" es obligatorio.');
  } else {
    const v = String(datos.fecha_servicio).trim();
    if (!esFechaISO(v)) errores.push('La "fecha_servicio" debe tener formato YYYY-MM-DD.');
    else limpio.fecha_servicio = v;
  }

  // fecha_pago (opcional; si viene: >= fecha_servicio y no futura)
  const fechaServicioFinal = limpio.fecha_servicio ?? base.fecha_servicio;
  if ('fecha_pago' in datos) {
    if (esVacio(datos.fecha_pago)) {
      limpio.fecha_pago = null;
    } else {
      const v = String(datos.fecha_pago).trim();
      if (!esFechaISO(v)) errores.push('La "fecha_pago" debe tener formato YYYY-MM-DD.');
      else if (fechaServicioFinal && v < fechaServicioFinal) errores.push('La "fecha_pago" no puede ser anterior a la "fecha_servicio".');
      else if (v > hoyISO()) errores.push('La "fecha_pago" no puede ser futura.');
      else limpio.fecha_pago = v;
    }
  }

  // costo
  if (esVacio(datos.costo)) {
    if (!parcial) errores.push('El campo "costo" es obligatorio.');
  } else {
    const n = Number(datos.costo);
    if (!Number.isFinite(n) || n <= 0) errores.push('El "costo" debe ser un número mayor que 0.');
    else limpio.costo = Math.round(n * 100) / 100;
  }

  // venta
  if (esVacio(datos.venta)) {
    if (!parcial) errores.push('El campo "venta" es obligatorio.');
  } else {
    const n = Number(datos.venta);
    if (!Number.isFinite(n) || n <= 0) errores.push('La "venta" debe ser un número mayor que 0.');
    else limpio.venta = Math.round(n * 100) / 100;
  }

  // venta >= costo (cross-field, con merge)
  const costoFinal = limpio.costo ?? base.costo;
  const ventaFinal = limpio.venta ?? base.venta;
  if (costoFinal !== undefined && ventaFinal !== undefined && ventaFinal < costoFinal) {
    errores.push('La "venta" no puede ser menor que el "costo".');
  }

  // estrellas (opcional, 1-5)
  if ('estrellas' in datos) {
    if (esVacio(datos.estrellas)) {
      limpio.estrellas = null;
    } else {
      const n = Number(datos.estrellas);
      if (!Number.isInteger(n) || n < 1 || n > 5) errores.push('Las "estrellas" deben ser un entero entre 1 y 5.');
      else limpio.estrellas = n;
    }
  }

  // estado (opcional; catálogo cerrado)
  if (!esVacio(datos.estado)) {
    const v = String(datos.estado).trim().toLowerCase();
    if (!ESTADOS_VALIDOS.includes(v)) errores.push(`El "estado" debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`);
    else limpio.estado = v;
  }

  if (errores.length > 0) throw crearError(errores.join(' '), 400);
  return limpio;
};

// Reglas de transición de estado
const validarTransicion = (estadoActual, estadoNuevo, fechaPago) => {
  if (!estadoNuevo || estadoNuevo === estadoActual) return;
  if (estadoActual === 'anulado') {
    throw crearError('Un pago anulado no puede modificarse.', 400);
  }
  if (estadoNuevo === 'pagado' && !fechaPago) {
    throw crearError('No se puede marcar como "pagado" sin "fecha_pago".', 400);
  }
  if (estadoActual === 'pagado' && estadoNuevo === 'pendiente') {
    throw crearError('Un pago "pagado" solo puede pasar a "anulado".', 400);
  }
};

// ---------- Casos de uso ----------

const listar = () => repo.findAll();

const obtenerPorId = async (id) => {
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) throw crearError('El "id" debe ser un entero positivo.', 400);
  const pago = await repo.findById(idNum);
  if (!pago) throw crearError(`No existe un pago con id ${idNum}.`, 404);
  return pago;
};

const crear = async (datos) => {
  const limpio = validarCampos(datos, { parcial: false });
  limpio.estado = limpio.estado || 'pendiente';

  const dup = await repo.findDuplicado(limpio);
  if (dup) throw crearError('Ya existe un pago con el mismo código de tour, ciudad, proveedor, concepto y fecha de servicio.', 409);

  // Comisión calculada automáticamente en el servicio
  limpio.comision_vendedor = calcularComision(limpio.venta, limpio.costo, limpio.estrellas ?? null);

  return repo.create(limpio);
};

const actualizar = async (id, datos) => {
  const actual = await obtenerPorId(id);
  if (actual.estado === 'anulado') throw crearError('Un pago anulado no puede modificarse.', 400);

  const limpio = validarCampos(datos, { parcial: false, actual });

  // Completar campos opcionales con los del registro actual
  limpio.fecha_pago = limpio.fecha_pago !== undefined ? limpio.fecha_pago : actual.fecha_pago;
  limpio.estrellas = limpio.estrellas !== undefined ? limpio.estrellas : actual.estrellas;
  limpio.estado = limpio.estado ?? actual.estado;

  validarTransicion(actual.estado, limpio.estado, limpio.fecha_pago);

  limpio.comision_vendedor = calcularComision(limpio.venta, limpio.costo, limpio.estrellas);

  const dup = await repo.findDuplicado({ ...limpio, excludeId: Number(id) });
  if (dup) throw crearError('Ya existe otro pago con los mismos datos.', 409);

  return repo.update(Number(id), limpio);
};

const actualizarParcial = async (id, datos) => {
  const actual = await obtenerPorId(id);
  if (actual.estado === 'anulado') throw crearError('Un pago anulado no puede modificarse.', 400);

  const limpio = validarCampos(datos, { parcial: true, actual });
  if (Object.keys(limpio).length === 0) throw crearError('Debe enviar al menos un campo para actualizar.', 400);

  const fusionado = {
    codigo_tour:      limpio.codigo_tour      ?? actual.codigo_tour,
    nombre_tour:      limpio.nombre_tour      ?? actual.nombre_tour,
    ciudad:           limpio.ciudad           ?? actual.ciudad,
    proveedor:        limpio.proveedor        ?? actual.proveedor,
    concepto:         limpio.concepto         ?? actual.concepto,
    fecha_servicio:   limpio.fecha_servicio   ?? actual.fecha_servicio,
    fecha_pago:       limpio.fecha_pago       !== undefined ? limpio.fecha_pago : actual.fecha_pago,
    costo:            limpio.costo            ?? actual.costo,
    venta:            limpio.venta            ?? actual.venta,
    estrellas:        limpio.estrellas        !== undefined ? limpio.estrellas : actual.estrellas,
    estado:           limpio.estado           ?? actual.estado,
  };

  validarTransicion(actual.estado, fusionado.estado, fusionado.fecha_pago);

  fusionado.comision_vendedor = calcularComision(fusionado.venta, fusionado.costo, fusionado.estrellas);

  const dup = await repo.findDuplicado({ ...fusionado, excludeId: Number(id) });
  if (dup) throw crearError('Ya existe otro pago con los mismos datos.', 409);

  return repo.update(Number(id), fusionado);
};

const eliminar = async (id) => {
  const actual = await obtenerPorId(id);
  if (actual.estado !== 'pendiente') {
    throw crearError('Solo se pueden eliminar pagos en estado "pendiente". Use PATCH con estado "anulado" para conservar el histórico contable.', 400);
  }
  await repo.remove(Number(id));
};

const reportePorCiudad        = () => repo.reportePorCiudad();
const reportePorProveedor     = () => repo.reportePorProveedor();
const reporteConsolidadoTour  = () => repo.reporteConsolidadoTour();

module.exports = {
  listar, obtenerPorId, crear, actualizar, actualizarParcial, eliminar,
  reportePorCiudad, reportePorProveedor, reporteConsolidadoTour,
};
