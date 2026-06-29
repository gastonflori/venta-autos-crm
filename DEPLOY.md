# Publicar Sote CRM Autos en GitHub + Railway

## 1. Subir a GitHub

Desde PowerShell:

```powershell
cd C:\Users\Gaston\Documents\Codex\venta-autos-crm
git init
git add .
git commit -m "Initial autos CRM"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/venta-autos-crm.git
git push -u origin main
```

Antes de hacer `git remote add`, crear el repo vacio en GitHub con el nombre `venta-autos-crm`.

No subir:

- `autos-crm.db`
- `.env`
- `node_modules`
- logs

Ya estan ignorados en `.gitignore`.

## 2. Crear proyecto en Railway

1. Railway -> New Project.
2. Deploy from GitHub repo.
3. Elegir `venta-autos-crm`.
4. Railway detecta Node y ejecuta:

```text
npm start
```

El archivo `railway.toml` ya esta preparado.

## 3. Variables en Railway

Configurar en Variables:

```text
DATA_DIR=/data
BOOTSTRAP_ADMIN_EMAIL=tu-email@dominio.com
BOOTSTRAP_ADMIN_PASSWORD=una-clave-segura
BOOTSTRAP_ADMIN_NAME=Administrador
NODE_ENV=production
```

## 4. Volumen persistente

Crear un volumen persistente y montarlo en:

```text
/data
```

Esto es lo que hace que la base SQLite no se borre cuando Railway reinicia o redeploya.

## 5. Dominio publico

En Railway:

1. Settings.
2. Networking.
3. Generate Domain.

Despues abrir:

```text
https://tu-dominio.up.railway.app/api/health
```

Debe responder algo como:

```json
{ "ok": true, "app": "venta-autos-crm" }
```

## 6. Entrar al panel

Abrir el dominio principal:

```text
https://tu-dominio.up.railway.app/
```

Entrar con el usuario configurado en:

```text
BOOTSTRAP_ADMIN_EMAIL
BOOTSTRAP_ADMIN_PASSWORD
```

## Notas

- Si no configuras `BOOTSTRAP_ADMIN_*`, se crea `admin@autos.app / admin1234`.
- En produccion siempre usar una clave segura.
- La data productiva vive en `/data/autos-crm.db`.
- Para backup, entrar logueado y abrir `/api/backup`.
