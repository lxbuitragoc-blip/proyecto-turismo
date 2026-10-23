const { run, get, all } = require('../db/database');

const COLS = `
  id, codigo_tour, nombre_tour, ciudad, proveedor, concepto,
  fecha_servicio, fecha_pago, costo, venta, estrellas,
  comision_vendedor, estado, creado_en
`;

const findAll = () =>
  all(`SELECT ${COLS} FROM pagos ORDER BY fecha_servicio DESC, id DESC`);

const findById = (id) =>
  get(`SELECT ${COLS} FROM pagos WHERE id = ?`, [id]);

// Busca duplicado por la clave natural (excluyendo un id si es edición)
const findDuplicado = ({
  codigo_tour, ciudad, proveedor, concepto, fecha_servicio, excludeId = null,
}) => {
  if (excludeId) {
    return get(
      `SELECT id FROM pagos
       WHERE codigo_tour = ? AND ciudad = ? AND proveedor = ?
         AND concepto = ? AND fecha_servicio = ? AND id <> ?`,
      [codigo_tour, ciudad, proveedor, concepto, fecha_servicio, excludeId]
    );
  }
  return get(
    `SELECT id FROM pagos
     WHERE codigo_tour = ? AND ciudad = ? AND proveedor = ?
       AND concepto = ? AND fecha_servicio = ?`,
    [codigo_tour, ciudad, proveedor, concepto, fecha_servicio]
  );
};

const create = async (p) => {
  const { lastID } = await run(
    `INSERT INTO pagos
       (codigo_tour, nombre_tour, ciudad, proveedor, concepto,
        fecha_servicio, fecha_pago, costo, venta, estrellas,
        comision_vendedor, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.codigo_tour, p.nombre_tour, p.ciudad, p.proveedor, p.concepto,
      p.fecha_servicio, p.fecha_pago ?? null, p.costo, p.venta,
      p.estrellas ?? null, p.comision_vendedor ?? 0,
      p.estado ?? 'pendiente',
    ]
  );
  return findById(lastID);
};

const update = async (id, p) => {
  const { changes } = await run(
    `UPDATE pagos SET
        codigo_tour = ?, nombre_tour = ?, ciudad = ?, proveedor = ?,
        concepto = ?, fecha_servicio = ?, fecha_pago = ?, costo = ?,
        venta = ?, estrellas = ?, comision_vendedor = ?, estado = ?
      WHERE id = ?`,
    [
      p.codigo_tour, p.nombre_tour, p.ciudad, p.proveedor,
      p.concepto, p.fecha_servicio, p.fecha_pago ?? null, p.costo,
      p.venta, p.estrellas ?? null, p.comision_vendedor ?? 0,
      p.estado, id,
    ]
  );
  if (changes === 0) return null;
  return findById(id);
};

const remove = async (id) => {
  const { changes } = await run('DELETE FROM pagos WHERE id = ?', [id]);
  return changes > 0;
};

// ---------- Reportes contables ----------

// Pagos y totales por ciudad
const reportePorCiudad = () =>
  all(`
    SELECT
      ciudad,
      COUNT(*)                         AS cantidad_pagos,
      ROUND(SUM(costo), 2)             AS total_costo,
      ROUND(SUM(venta), 2)             AS total_venta,
      ROUND(SUM(venta - costo), 2)     AS total_ganancia,
      ROUND(SUM(comision_vendedor), 2) AS total_comision
    FROM pagos
    WHERE estado <> 'anulado'
    GROUP BY ciudad
    ORDER BY ciudad
  `);

// Proveedores (hoteles y otros) por ciudad
const reportePorProveedor = () =>
  all(`
    SELECT
      ciudad,
      proveedor,
      COUNT(*)             AS cantidad_pagos,
      ROUND(SUM(costo), 2) AS total_pagado
    FROM pagos
    WHERE estado <> 'anulado'
    GROUP BY ciudad, proveedor
    ORDER BY ciudad, total_pagado DESC
  `);

// Consolidado por tour: costo, venta, comisión y utilidad neta
const reporteConsolidadoTour = () =>
  all(`
    SELECT
      codigo_tour,
      nombre_tour,
      COUNT(*)                         AS lineas,
      ROUND(SUM(costo), 2)             AS costo_total,
      ROUND(SUM(venta), 2)             AS venta_total,
      ROUND(SUM(venta - costo), 2)     AS ganancia_total,
      ROUND(SUM(comision_vendedor), 2) AS comision_total,
      ROUND(SUM(venta - costo - comision_vendedor), 2) AS utilidad_neta
    FROM pagos
    WHERE estado <> 'anulado'
    GROUP BY codigo_tour, nombre_tour
    ORDER BY codigo_tour
  `);

module.exports = {
  findAll, findById, findDuplicado, create, update, remove,
  reportePorCiudad, reportePorProveedor, reporteConsolidadoTour,
};
