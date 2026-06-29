const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname);
const dataDirectory = process.env.DATA_DIR || root;
fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "autos-crm.db");
const database = new DatabaseSync(databasePath);
const port = Number(process.env.PORT || 4174);
const sessionDays = 14;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const seedState = {
  vehicles: [
    { id: "v1", dominio: "AE482QL", marca: "Toyota", modelo: "Corolla XEI", anio: 2022, km: 38000, precio: 24400000, estado: "Disponible", ubicacion: "Showroom", margen: 2100000 },
    { id: "v2", dominio: "AF113YD", marca: "Volkswagen", modelo: "Amarok Highline", anio: 2021, km: 61500, precio: 32600000, estado: "Reservado", ubicacion: "Gestoria", margen: 2800000 },
    { id: "v3", dominio: "AD909LP", marca: "Fiat", modelo: "Cronos Precision", anio: 2023, km: 19000, precio: 18100000, estado: "Publicado", ubicacion: "Playa", margen: 1700000 },
    { id: "v4", dominio: "AC640MN", marca: "Ford", modelo: "Ranger XLS", anio: 2020, km: 82000, precio: 29800000, estado: "Preparacion", ubicacion: "Taller", margen: 1900000 }
  ],
  clients: [
    { id: "c1", nombre: "Martina Quiroga", telefono: "+54 9 11 6042-9120", email: "martinaq@mail.com", interes: "Corolla XEI", origen: "WhatsApp", estado: "Caliente" },
    { id: "c2", nombre: "Sergio Calvo", telefono: "+54 9 351 244-0098", email: "sergio.calvo@mail.com", interes: "Amarok", origen: "MercadoLibre", estado: "Seguimiento" },
    { id: "c3", nombre: "Ana Rivas", telefono: "+54 9 341 702-1181", email: "ana.rivas@mail.com", interes: "Cronos", origen: "Instagram", estado: "Nuevo" }
  ],
  sales: [
    { id: "s1", cliente: "Martina Quiroga", vehiculo: "Toyota Corolla XEI", etapa: "Contacto", monto: 24400000, vendedor: "Gaston", proximo: "Hoy 17:00" },
    { id: "s2", cliente: "Sergio Calvo", vehiculo: "Volkswagen Amarok", etapa: "Tasacion", monto: 32600000, vendedor: "Mica", proximo: "Manana 10:30" },
    { id: "s3", cliente: "Ana Rivas", vehiculo: "Fiat Cronos", etapa: "Reserva", monto: 18100000, vendedor: "Gaston", proximo: "Jue 12:00" },
    { id: "s4", cliente: "Nicolas Paz", vehiculo: "Ford Ranger", etapa: "Cierre", monto: 29800000, vendedor: "Leo", proximo: "Vie 16:00" }
  ],
  paperwork: [
    { id: "g1", tramite: "08 + denuncia venta", cliente: "Ana Rivas", vehiculo: "Fiat Cronos", estado: "Pendiente", vence: "2026-07-02" },
    { id: "g2", tramite: "Transferencia", cliente: "Sergio Calvo", vehiculo: "Amarok Highline", estado: "En curso", vence: "2026-07-05" },
    { id: "g3", tramite: "Prenda", cliente: "Martina Quiroga", vehiculo: "Toyota Corolla", estado: "Listo", vence: "2026-06-30" }
  ],
  finance: [
    { id: "f1", concepto: "Reserva Corolla", tipo: "Ingreso", monto: 500000, fecha: "2026-06-29", estado: "Confirmado" },
    { id: "f2", concepto: "Service Ranger", tipo: "Egreso", monto: 280000, fecha: "2026-06-28", estado: "Pagado" },
    { id: "f3", concepto: "Publicidad junio", tipo: "Egreso", monto: 145000, fecha: "2026-06-26", estado: "Pendiente" },
    { id: "f4", concepto: "Sena Amarok", tipo: "Ingreso", monto: 850000, fecha: "2026-06-25", estado: "Confirmado" }
  ],
  messages: [
    { id: "w1", cliente: "Martina Quiroga", plantilla: "Seguimiento test drive", estado: "Listo para enviar", hora: "15:20" },
    { id: "w2", cliente: "Sergio Calvo", plantilla: "Documentacion reserva", estado: "Programado", hora: "18:00" },
    { id: "w3", cliente: "Ana Rivas", plantilla: "Gracias por tu consulta", estado: "Enviado", hora: "11:08" }
  ],
  calendar: [
    { id: "cal1", fecha: "2026-06-29", hora: "17:00", tipo: "Test drive", titulo: "Prueba Corolla XEI", cliente: "Martina Quiroga", vehiculo: "Toyota Corolla XEI", vendedor: "Gaston", estado: "Confirmado", notas: "Trae registro y DNI. Salida desde showroom." },
    { id: "cal2", fecha: "2026-06-30", hora: "10:30", tipo: "Tasacion", titulo: "Tasacion usado en parte de pago", cliente: "Sergio Calvo", vehiculo: "Volkswagen Amarok", vendedor: "Mica", estado: "Pendiente", notas: "Revisar cubiertas, service y papeles." },
    { id: "cal3", fecha: "2026-07-02", hora: "12:00", tipo: "Gestoria", titulo: "Vence 08 + denuncia venta", cliente: "Ana Rivas", vehiculo: "Fiat Cronos Precision", vendedor: "Leo", estado: "Pendiente", notas: "Enviar recordatorio a cliente." },
    { id: "cal4", fecha: "2026-07-03", hora: "16:00", tipo: "Entrega", titulo: "Entrega Ranger XLS", cliente: "Nicolas Paz", vehiculo: "Ford Ranger XLS", vendedor: "Gaston", estado: "Programado", notas: "Confirmar transferencia antes de entregar." }
  ],
  audit: [
    "Sesion iniciada en Sote CRM",
    "Reserva cargada para Toyota Corolla",
    "Nuevo cliente desde WhatsApp",
    "Tramite de transferencia actualizado"
  ],
  settings: {
    businessName: "Sote Auto",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    currency: "ARS",
    logoDataUrl: ""
  }
};

const sectionDefaults = {
  calendarItems: [{ id: "cal-1", fecha: "2026-06-30", hora: "10:30", tipo: "Test drive", cliente: "Martina Quiroga", vehiculo: "Toyota Corolla XEI", estado: "Programado" }],
  alerts: [{ id: "al-1", titulo: "Transferencia por vencer", prioridad: "Alta", area: "Gestoria", vence: "2026-07-02", estado: "Pendiente" }],
  quotes: [{ id: "co-1", cliente: "Ana Rivas", vehiculo: "Fiat Cronos Precision", monto: 18100000, moneda: "ARS", estado: "Enviada", fecha: "2026-06-29" }],
  files: [{ id: "ex-1", numero: "EXP-1001", cliente: "Sergio Calvo", vehiculo: "Amarok Highline", tramite: "Transferencia", estado: "En curso", responsable: "Gestoria" }],
  claims: [{ id: "re-1", cliente: "Nicolas Paz", motivo: "Detalle postventa", canal: "WhatsApp", prioridad: "Media", estado: "Abierto", proximo: "Llamar hoy" }],
  treasury: [{ id: "te-1", cuenta: "Caja principal", tipo: "Ingreso", monto: 850000, moneda: "ARS", fecha: "2026-06-29", estado: "Confirmado" }],
  consignments: [{ id: "cs-1", titular: "Laura Gomez", vehiculo: "Peugeot 208", precioPretendido: 17500000, comision: 900000, estado: "Activa", vence: "2026-07-20" }],
  orders: [{ id: "pe-1", cliente: "Marcos Diaz", marca: "Toyota", modelo: "Hilux", presupuesto: 38000000, urgencia: "Alta", estado: "Buscando" }],
  settlements: [{ id: "li-1", beneficiario: "Gaston", concepto: "Comision Corolla", monto: 320000, fecha: "2026-06-29", estado: "Pendiente" }],
  tickets: [{ id: "in-1", dominio: "AE482QL", detalle: "Patente municipal", monto: 42000, vence: "2026-07-10", estado: "Revisar" }],
  reports: [{ id: "rp-1", nombre: "Ventas junio", periodo: "2026-06", indicador: "Operaciones", valor: "4", estado: "Disponible" }],
  conversations: [{ id: "cv-1", cliente: "Martina Quiroga", canal: "WhatsApp", ultimoMensaje: "Coordinar test drive", responsable: "Gaston", estado: "Abierta" }],
  emails: [{ id: "em-1", para: "sergio.calvo@mail.com", asunto: "Documentacion de reserva", plantilla: "Reserva", estado: "Pendiente", fecha: "2026-06-29" }],
  mySales: [{ id: "mv-1", cliente: "Martina Quiroga", vehiculo: "Toyota Corolla XEI", etapa: "Contacto", monto: 24400000, proximo: "Hoy 17:00" }],
  afterSales: [{ id: "pv-1", cliente: "Nicolas Paz", vehiculo: "Ford Ranger", entrega: "2026-06-20", control: "7 dias", estado: "Llamar" }],
  commissions: [{ id: "mc-1", operacion: "Corolla XEI", cliente: "Martina Quiroga", monto: 320000, estado: "Pendiente", fecha: "2026-06-29" }],
  collections: [{ id: "cb-1", cliente: "Sergio Calvo", concepto: "Sena Amarok", monto: 850000, vence: "2026-06-30", estado: "Confirmado" }],
  suggestions: [{ id: "su-1", titulo: "Automatizar recordatorios", area: "Ventas", detalle: "Avisos por WhatsApp", autor: "Equipo", estado: "Nueva" }],
  authorizations: [{ id: "au-1", solicitud: "Descuento especial", solicitante: "Mica", monto: 250000, prioridad: "Alta", estado: "Pendiente" }],
  sleepingLeads: [{ id: "do-1", cliente: "Ana Rivas", interes: "Cronos", ultimoContacto: "2026-06-20", dias: 9, accion: "Reactivar" }],
  workspace: [{ id: "me-1", tarea: "Revisar documentacion Amarok", prioridad: "Alta", vence: "2026-06-30", estado: "Pendiente" }],
  wishlist: [{ id: "wi-1", cliente: "Marcos Diaz", vehiculo: "Hilux 4x4", presupuesto: 38000000, match: "Sin match", estado: "Activo" }],
  nps: [{ id: "np-1", cliente: "Nicolas Paz", puntaje: 9, comentario: "Muy buena atencion", fecha: "2026-06-28", estado: "Recibida" }],
  trash: [{ id: "pa-1", origen: "Clientes", detalle: "Lead duplicado", eliminadoPor: "Administrador", fecha: "2026-06-28" }],
  phones: [{ id: "tf-1", nombre: "Gestoria", area: "Tramites", telefono: "+54 9 11 5555-1000", email: "gestoria@sote.auto", notas: "Horario comercial" }],
  opportunities: [{ id: "op-1", cliente: "Laura Gomez", interes: "Consignar Peugeot 208", probabilidad: "Media", monto: 17500000, estado: "Abierta" }],
  workshop: [{ id: "ta-1", vehiculo: "Ford Ranger XLS", trabajo: "Service y lavado", responsable: "Taller", costo: 280000, estado: "En proceso" }]
};

function normalizeState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = { ...seedState, ...source };
  for (const key of ["vehicles", "clients", "sales", "paperwork", "finance", "messages", "calendar", "audit"]) {
    normalized[key] = Array.isArray(source[key]) ? source[key] : seedState[key];
  }
  normalized.settings = { ...seedState.settings, ...(source.settings && typeof source.settings === "object" ? source.settings : {}) };
  for (const [key, rows] of Object.entries(sectionDefaults)) {
    if (!Array.isArray(source[key]) || (!normalized.settings.sectionsSeeded && source[key].length === 0)) {
      normalized[key] = rows;
    }
  }
  if (!normalized.settings.sectionsSeeded) normalized.settings.sectionsSeeded = true;
  if (!normalized.settings.calendarSeeded && (!Array.isArray(source.calendar) || source.calendar.length === 0)) {
    normalized.calendar = seedState.calendar;
    normalized.settings.calendarSeeded = true;
  }
  return normalized;
}

database.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'jefe',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

if (!database.prepare("SELECT id FROM app_state WHERE id = 1").get()) {
  database.prepare("INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?)").run(JSON.stringify(seedState), new Date().toISOString());
}

if (!database.prepare("SELECT id FROM users LIMIT 1").get()) {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@autos.app").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin1234";
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "Administrador";
  database.prepare("INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, 'jefe', 1, ?)").run(
    name,
    email,
    hashPassword(password),
    new Date().toISOString()
  );
  console.log(`[AUTOS CRM] Admin inicial: ${email} / ${password}`);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(part => {
    const index = part.indexOf("=");
    if (index === -1) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter(Boolean));
}

function sessionCookie(token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `autos_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

function clearSessionCookie() {
  return "autos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function currentUser(req) {
  const token = parseCookies(req).autos_session;
  if (!token) return null;
  return database.prepare(`
    SELECT users.id, users.name, users.email, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1
  `).get(tokenHash(token), new Date().toISOString()) || null;
}

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "No autorizado" });
    return null;
  }
  return user;
}

function readState() {
  const row = database.prepare("SELECT data FROM app_state WHERE id = 1").get();
  try {
    return normalizeState(JSON.parse(row?.data || "{}"));
  } catch {
    return normalizeState(seedState);
  }
}

function writeState(state) {
  database.prepare("UPDATE app_state SET data = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(normalizeState(state)), new Date().toISOString());
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error("Payload demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "venta-autos-crm", database: databasePath });
  }

  if (pathname === "/api/auth/me") {
    return sendJson(res, 200, { user: publicUser(currentUser(req)) });
  }

  if (pathname === "/api/public-config") {
    const settings = readState().settings || {};
    return sendJson(res, 200, {
      businessName: settings.businessName || "",
      logoDataUrl: settings.logoDataUrl || ""
    });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = database.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE AND active = 1").get(email);
    if (!user || !verifyPassword(password, user.password_hash)) return sendJson(res, 401, { error: "Credenciales invalidas" });
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
    database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(tokenHash(token), user.id, expiresAt, new Date().toISOString());
    return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token, expiresAt) });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const token = parseCookies(req).autos_session;
    if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  }

  if (pathname === "/api/state" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    return sendJson(res, 200, { state: readState(), user: publicUser(user) });
  }

  if (pathname === "/api/state" && req.method === "PUT") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readJson(req);
    if (!body || typeof body.state !== "object" || Array.isArray(body.state)) return sendJson(res, 400, { error: "Estado invalido" });
    writeState(body.state);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/backup" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="autos-crm-respaldo-${new Date().toISOString().slice(0, 10)}.json"`
    });
    return res.end(JSON.stringify(readState(), null, 2));
  }

  return sendJson(res, 404, { error: "API no encontrada" });
}

function serveStatic(req, res, pathname) {
  const filePath = path.resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, "index.html"), (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentTypes[".html"] });
        res.end(indexData);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${port}`);
  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch(error => sendJson(res, 500, { error: error.message || "Error interno" }));
    return;
  }
  serveStatic(req, res, pathname);
}).listen(port, "0.0.0.0", () => {
  console.log(`Autos CRM running at http://localhost:${port}`);
  console.log(`Data dir: ${dataDirectory}`);
});
