# Contexto - Sote CRM Autos

Proyecto separado para venta de autos.

## Objetivo

Replicar la forma vendible del sistema tipo El Globito, pero para agencias automotoras: backend propio, base persistente, login, backups y deploy, con interfaz inspirada en la web Sote CRM provista.

## Stack

- Node.js sin framework pesado.
- SQLite con `node:sqlite`.
- Frontend HTML/CSS/JS.
- Railway listo con `railway.toml`.

## Datos

La base queda en:

- `autos-crm.db` dentro de la carpeta, o
- `DATA_DIR/autos-crm.db` si se configura `DATA_DIR`.

## Admin inicial

- Email: `admin@autos.app`
- Password: `admin1234`

Cambiar en produccion con:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`

## Endpoints

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/state`
- `PUT /api/state`
- `GET /api/backup`
