const service = require('../services/pagos.service');

const listar = async (req, res, next) => {
  try { res.status(200).json(await service.listar()); }
  catch (e) { next(e); }
};

const obtenerPorId = async (req, res, next) => {
  try { res.status(200).json(await service.obtenerPorId(req.params.id)); }
  catch (e) { next(e); }
};

const crear = async (req, res, next) => {
  try { res.status(201).json(await service.crear(req.body)); }
  catch (e) { next(e); }
};

const actualizar = async (req, res, next) => {
  try { res.status(200).json(await service.actualizar(req.params.id, req.body)); }
  catch (e) { next(e); }
};

const actualizarParcial = async (req, res, next) => {
  try { res.status(200).json(await service.actualizarParcial(req.params.id, req.body)); }
  catch (e) { next(e); }
};

const eliminar = async (req, res, next) => {
  try { await service.eliminar(req.params.id); res.status(204).send(); }
  catch (e) { next(e); }
};

const reportePorCiudad = async (req, res, next) => {
  try { res.status(200).json(await service.reportePorCiudad()); }
  catch (e) { next(e); }
};

const reportePorProveedor = async (req, res, next) => {
  try { res.status(200).json(await service.reportePorProveedor()); }
  catch (e) { next(e); }
};

const reporteConsolidadoTour = async (req, res, next) => {
  try { res.status(200).json(await service.reporteConsolidadoTour()); }
  catch (e) { next(e); }
};

module.exports = {
  listar, obtenerPorId, crear, actualizar, actualizarParcial, eliminar,
  reportePorCiudad, reportePorProveedor, reporteConsolidadoTour,
};