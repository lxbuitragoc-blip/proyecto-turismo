const { Router } = require('express');
const controller = require('../controllers/pagos.controller');

const router = Router();

// Reportes primero (evita conflicto con /:id)
router.get('/reportes/por-ciudad',       controller.reportePorCiudad);
router.get('/reportes/por-proveedor',    controller.reportePorProveedor);
router.get('/reportes/consolidado-tour', controller.reporteConsolidadoTour);

// CRUD
router.get('/',       controller.listar);
router.get('/:id',    controller.obtenerPorId);
router.post('/',      controller.crear);
router.put('/:id',    controller.actualizar);
router.patch('/:id',  controller.actualizarParcial);
router.delete('/:id', controller.eliminar);

module.exports = router;