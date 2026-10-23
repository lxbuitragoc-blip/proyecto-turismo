# Proyecto Turismo — Control contable de pagos a proveedores
Avance Sesion 6  Ingeniería de Software III
## 1. Descripción del proyecto
API REST para registrar y consolidar los pagos que una operadora de turismo realiza a sus proveedores (hoteles, transporte, guías, intermediarios) por ciudad y por tour. Calcula automáticamente la comisión del vendedor según la calificación (estrellas) del tour, y expone reportes contables de costo, venta, ganancia y utilidad.
## 2. Entidad principal: pagos
Cada fila representa un lineamiento de pago dentro de un tour en una ciudad.
| Campo | Tipo | Regla |
|---|---|---|
| `id` | INTEGER | PK autoincremental |
| `codigo_tour` | TEXT | Obligatorio, 3–40 caracteres |
| `nombre_tour` | TEXT | Obligatorio, 3–120 caracteres |
| `ciudad` | TEXT | Obligatorio, 3–80 caracteres |
| `proveedor` | TEXT | Obligatorio, 3–80 caracteres (hotel, transporte, guía, intermediario) |
| `concepto` | TEXT | Catálogo: alojamiento, traslado, alimentacion, guia, intermediario, otro |
| `fecha_servicio` | TEXT | `YYYY-MM-DD`, obligatoria; |
| `fecha_pago` | TEXT | Opcional; ≥ `fecha_servicio`, no futura |
| `costo` | REAL | > 0 (pago al proveedor) |
| `venta` | REAL | > 0 y ≥ `costo` |
| `estrellas` | INTEGER | Opcional, 1–5 |
| `comision_vendedor` | REAL | Calculada automáticamente |
| `estado` | TEXT | `pendiente` / `pagado` / `anulado` |
| `creado_en` | TEXT | Fecha de creación automática |

## 3. Stack y arquitectura
Node.js · Express · SQLite3 · dotenv · cors · nodemon.
Estructura por capas (separación estricta de responsabilidades):
```
src/
├── app.js                    # Configuración Express + middlewares + manejo de errores
├── db/database.js            # Conexión SQLite + inicialización de tablas + helpers
├── routes/pagos.routes.js    # Endpoints
├── controllers/pagos.controller.js  # Orquestación HTTP (req, res, códigos)
├── services/pagos.service.js        # Reglas de negocio + cálculo de comisión
└── repositories/pagos.repository.js # SQL parametrizado + reportes
```
## 4. Reglas de negocio (capa de servicios)
- **`codigo_tour`, `nombre_tour`, `ciudad`, `proveedor`**: obligatorios, con longitud mínima y máxima.
- **`concepto`**: catálogo cerrado.
- **`fecha_servicio`**: obligatoria, `YYYY-MM-DD`, puede ser futura (control de alertas previas al tour).
- **`fecha_pago`**: opcional; si se envía, ≥ `fecha_servicio` y no futura.
- **`costo` y `venta`**: > 0 y **`venta ≥ costo`**.
- **`estrellas`**: opcional, entero 1–5.
- Comisión del vendedor (calculada en el servicio):
  - 5 estrellas -> 4 % de la ganancia (`venta − costo`)
  - 4 estrellas -> 2 % de la ganancia
  - 1–3 estrellas -> 1 % de la ganancia
  - sin estrellas → 0 %
- `estado`: transiciones controladas.
  - `pendiente → pagado` solo si hay `fecha_pago`.
  - `pendiente → anulado` libre.
  - `pagado → anulado` permitido.
  - `anulado` no se puede modificar.
- **Unicidad**: no se repite `codigo_tour + ciudad + proveedor + concepto + fecha_servicio`.
- **Eliminación**: solo se permite `DELETE` de pagos en estado `pendiente`; para conservar histórico contable se usa `anulado`.

## 5. Endpoints

| Operación | Método | Endpoint | Código esperado |
|---|---|---|---|
| Listar | GET | `/api/pagos` | 200 |
| Consultar por ID | GET | `/api/pagos/:id` | 200 / 404 |
| Crear | POST | `/api/pagos` | 201 / 400 |
| Actualizar (completo) | PUT | `/api/pagos/:id` | 200 / 404 |
| Actualizar (parcial) | PATCH | `/api/pagos/:id` | 200 / 404 |
| Eliminar | DELETE | `/api/pagos/:id` | 204 / 404 |
| Reporte por ciudad | GET | `/api/pagos/reportes/por-ciudad` | 200 |
| Reporte por proveedor | GET | `/api/pagos/reportes/por-proveedor` | 200 |
| Consolidado por tour | GET | `/api/pagos/reportes/consolidado-tour` | 200 |
| Health check | GET | `/api/health` | 200 |

## 6. Instalación y ejecución

Requisitos: Node.js 20+, npm.

```bash
npm install
npm run dev
```

Salida esperada:
```
[DB] Conectado a SQLite en .../data/app.db
[DB] Tabla "pagos" lista.
[SERVER] API escuchando en http://localhost:3000
```

Variables de entorno (.env):
```
PORT=3000
DB_FILE=./data/app.db
```

La base de datos data/app.db y la tabla pagos se crean automáticamente al arrancar.

## 7. Evidencias de pruebas

### 7.1 Camino feliz — 201 Created

**Petición:**
```
http
POST /api/pagos
Content-Type: application/json

{
  "codigo_tour": "TOUR-CARTAGENA-2026-01",
  "nombre_tour": "Ruta del Sol 5 dias",
  "ciudad": "Cartagena",
  "proveedor": "Hotel Dann",
  "concepto": "alojamiento",
  "fecha_servicio": "2026-06-15",
  "fecha_pago": "2026-06-20",
  "costo": 800,
  "venta": 1200,
  "estrellas": 5,
  "estado": "pagado"
}

curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
En línea: 1 Carácter: 1
+ curl.exe -i -X POST http://localhost:3000/api/pagos -H "Content-Type: ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed

  0      0   0      0   0      0      0      0                              0
100    617 100    324 100    293   6770   6122                              0
100    617 100    324 100    293   6735   6090                              0
100    617 100    324 100    293   6700   6059                              0
HTTP/1.1 201 Created
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 324
ETag: W/"144-h7HQaVj1ImSZCGEWySC2gjUHIjU"
Date: Fri, 23 Oct 2026 01:33:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"codigo_tour":"TOUR-CARTAGENA-2026-01","nombre_tour":"Ruta del Sol 5 dias","ciudad":"Cartagena","proveedor":"Hotel Dann","concepto":"alojamiento","fecha_servicio":"2026-06-15","fecha_pago":"2026-06-20","costo":800,"venta":1200,"estrellas":5,"comision_vendedor":16,"estado":"pagado","creado_en":"2026-10-23 01:33:05"}

```
### 7.2 Error de validación — 400 Bad Request

**Petición:**
```
http
POST /api/pagos
Content-Type: application/json

{
  "codigo_tour": "A",
  "ciudad": "X",
  "concepto": "inventado",
  "costo": 500,
  "venta": 300,
  "estrellas": 9
}

curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
En línea: 1 Carácter: 1
+ curl.exe -i -X POST http://localhost:3000/api/pagos -H "Content-Type: ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed

  0      0   0      0   0      0      0      0                              0
100    562 100    451 100    111 101.2k  25523                              0
100    562 100    451 100    111  99492  24487                              0
100    562 100    451 100    111  95998  23627                              0
HTTP/1.1 400 Bad Request
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 451
ETag: W/"1c3-YX5azzNvenETJTSwOV3HB2neJYM"
Date: Fri, 23 Oct 2026 01:33:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"El \"codigo_tour\" debe tener entre 3 y 40 caracteres. El campo \"nombre_tour\" es obligatorio. La \"ciudad\" debe tener entre 3 y 80 caracteres. El campo \"proveedor\" es obligatorio. El \"concepto\" debe ser uno de: alojamiento, traslado, alimentacion, guia, intermediario, otro. El campo \"fecha_servicio\" es obligatorio. La \"venta\" no puede ser menor que el \"costo\". Las \"estrellas\" deben ser un entero entre 1 y 5.","status":400}
```

### 7.3 Recurso no encontrado — 404 Not Found

**Petición:**
```
http
GET /api/pagos/9999
curl.exe :   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
En línea: 1 Carácter: 1
+ curl.exe -i http://localhost:3000/api/pagos/9999 2>&1 | Tee-Object -F ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ... Time   Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload  Total   Spent   Left   Speed

  0      0   0      0   0      0      0      0                              0
100     55 100     55   0      0   8916      0                              0
100     55 100     55   0      0   8681      0                              0
100     55 100     55   0      0   8417      0                              0
HTTP/1.1 404 Not Found
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 55
ETag: W/"37-HrJDtng8GMP/srboJqMZ+066w/s"
Date: Fri, 23 Oct 2026 01:33:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"No existe un pago con id 9999.","status":404}

```
### 7.4 Reportes contables (valor agregado)

**`GET /api/pagos/reportes/por-ciudad`**
```
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 121
ETag: W/"79-G2MbHhFqod8aMzzzsJwnipmPgv4"
Date: Fri, 23 Oct 2026 01:44:48 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[{"ciudad":"Cartagena","cantidad_pagos":1,"total_costo":800,"total_venta":1200,"total_ganancia":400,"total_comision":16}]

```

**`GET /api/pagos/reportes/por-proveedor`**
```
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 87
ETag: W/"57-IA1o6PH0yePoOUuTAVIGmb7dsiE"
Date: Fri, 23 Oct 2026 01:45:16 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[{"ciudad":"Cartagena","proveedor":"Hotel Dann","cantidad_pagos":1,"total_pagado":800}]

```

**`GET /api/pagos/reportes/consolidado-tour`**
```
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 187
ETag: W/"bb-gkytkXynOJC7XW8Oise9IO8frJc"
Date: Fri, 23 Oct 2026 01:45:44 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[{"codigo_tour":"TOUR-CARTAGENA-2026-01","nombre_tour":"Ruta del Sol 5 dias","lineas":1,"costo_total":800,"venta_total":1200,"ganancia_total":400,"comision_total":16,"utilidad_neta":384}]

```

## 8. Autor

- **Nombre:** Laura Ximena Buitrago Cortes
- **Curso:** Ingeniería de Software III
- **Sesión:** 6 — Backend Aplicado y Avance del Proyecto