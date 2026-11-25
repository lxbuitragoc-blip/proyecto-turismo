const API_BASE = 'http://localhost:3000/api';  

/**
 * Realiza una petición HTTP y devuelve un objeto normalizado.
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function request(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  };
  if (options.body !== undefined) config.body = JSON.stringify(options.body);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, config);
  } catch (networkError) {
    // Error de red: servidor caído, CORS mal configurado, puerto incorrecto
    return {
      ok: false,
      status: 0,
      data: { error: `No se pudo conectar con la API en ${API_BASE}. ¿El servidor está corriendo y CORS habilitado?` },
    };
  }

  let data = null;
  if (response.status !== 204) {
    try { data = await response.json(); }
    catch { data = null; }
  }

  return { ok: response.ok, status: response.status, data };
}

const api = {
  // CRUD pagos
  listar:            ()         => request('/pagos'),
  obtener:           (id)       => request(`/pagos/${id}`),
  crear:             (body)     => request('/pagos',     { method: 'POST', body }),
  actualizar:        (id, body) => request(`/pagos/${id}`, { method: 'PUT', body }),
  eliminar:          (id)       => request(`/pagos/${id}`, { method: 'DELETE' }),

  // Reportes
  reportePorCiudad:      () => request('/pagos/reportes/por-ciudad'),
  reportePorProveedor:   () => request('/pagos/reportes/por-proveedor'),
  reporteConsolidadoTour:() => request('/pagos/reportes/consolidado-tour'),

  // Health
  health: () => request('/health'),
};