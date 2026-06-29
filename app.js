const THEME_KEY = "autos-crm-theme";

let state = null;
let authUser = null;
let currentModule = "dashboard";
let query = "";

const modules = [
  { id: "dashboard", label: "Dashboard", icon: "D", subtitle: "Resumen operativo de la agencia" },
  { id: "calendario", label: "Calendario", icon: "CL", subtitle: "Agenda, entregas, test drives y vencimientos" },
  { id: "alertas", label: "Alertas", icon: "AL", subtitle: "Avisos operativos y tareas urgentes" },
  { id: "stock", label: "Stock", icon: "ST", subtitle: "Vehiculos, precios, estados y ubicaciones" },
  { id: "clientes", label: "Clientes", icon: "C", subtitle: "Leads, compradores y seguimiento comercial" },
  { id: "ventas", label: "Ventas", icon: "V", subtitle: "Pipeline comercial por etapa" },
  { id: "cotizaciones", label: "Cotizaciones", icon: "CO", subtitle: "Presupuestos y ofertas enviadas" },
  { id: "gestoria", label: "Gestoria", icon: "G", subtitle: "Documentacion y vencimientos" },
  { id: "expedientes", label: "Expedientes", icon: "EX", subtitle: "Carpetas documentales por operacion" },
  { id: "reclamos", label: "Reclamos", icon: "R", subtitle: "Casos abiertos y seguimiento" },
  { id: "tesoreria", label: "Tesoreria", icon: "T", subtitle: "Caja, bancos y saldos" },
  { id: "consignaciones", label: "Consignaciones", icon: "CS", subtitle: "Unidades tomadas en consignacion" },
  { id: "pedidos", label: "Pedidos", icon: "P", subtitle: "Busquedas activas de clientes" },
  { id: "liquidaciones", label: "Liquidaciones", icon: "L", subtitle: "Liquidaciones a vendedores y terceros" },
  { id: "infracciones", label: "Infracciones", icon: "I", subtitle: "Multas, patentes y pendientes" },
  { id: "finanzas", label: "Finanzas", icon: "$", subtitle: "Ingresos, egresos y caja" },
  { id: "reportes", label: "Reportes", icon: "RP", subtitle: "Indicadores y analisis del negocio" },
  { id: "mensajes", label: "Mensajes", icon: "M", subtitle: "Plantillas y mensajes operativos" },
  { id: "conversaciones", label: "Conversaciones", icon: "CV", subtitle: "Historial de contacto con clientes" },
  { id: "correos", label: "Correos", icon: "@", subtitle: "Emails enviados y pendientes" },
  { id: "configuracion", label: "Configuracion", icon: "*", subtitle: "Preferencias de agencia y cuenta" },
  { id: "misventas", label: "Mis ventas", icon: "MV", subtitle: "Operaciones asignadas al usuario" },
  { id: "postventa", label: "Postventa", icon: "PV", subtitle: "Seguimiento despues de la entrega" },
  { id: "miscomisiones", label: "Mis comisiones", icon: "%", subtitle: "Comisiones liquidadas y pendientes" },
  { id: "cobros", label: "Cobros", icon: "CB", subtitle: "Cuotas, senas y pagos por cobrar" },
  { id: "sugerencias", label: "Sugerencias", icon: "S", subtitle: "Mejoras internas y pedidos del equipo" },
  { id: "autorizaciones", label: "Autorizaciones", icon: "AU", subtitle: "Aprobaciones pendientes" },
  { id: "dormidos", label: "Dormidos", icon: "Z", subtitle: "Leads sin movimiento" },
  { id: "miespacio", label: "Mi espacio", icon: "ME", subtitle: "Tareas y datos personales" },
  { id: "wishlist", label: "Wishlist", icon: "W", subtitle: "Vehiculos buscados por clientes" },
  { id: "nps", label: "NPS", icon: "N", subtitle: "Encuestas de satisfaccion" },
  { id: "papelera", label: "Papelera", icon: "X", subtitle: "Registros eliminados" },
  { id: "telefonos", label: "Telefonos", icon: "TE", subtitle: "Directorio y contactos utiles" },
  { id: "oportunidades", label: "Oportunidades", icon: "OP", subtitle: "Negocios potenciales" },
  { id: "taller", label: "Taller", icon: "TA", subtitle: "Preparacion y trabajos mecanicos" }
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || "Error de servidor");
  return data;
}

async function boot() {
  setTheme();
  try {
    const me = await api("/api/auth/me");
    authUser = me.user;
    if (authUser) await loadState();
  } catch {
    authUser = null;
  }
  render();
}

async function loadState() {
  const data = await api("/api/state");
  state = data.state;
  authUser = data.user;
  normalizeState();
}
const sectionData = {
  calendario: { key: "calendarItems", title: "Calendario", item: "evento", fields: [["fecha", "Fecha", "date"], ["hora", "Hora"], ["tipo", "Tipo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"]], columns: [["fecha", "Fecha"], ["hora", "Hora"], ["tipo", "Tipo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"]] },
  alertas: { key: "alerts", title: "Alertas", item: "alerta", fields: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["vence", "Vence"], ["estado", "Estado"]] },
  cotizaciones: { key: "quotes", title: "Cotizaciones", item: "cotizacion", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["estado", "Estado"], ["fecha", "Fecha", "date"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto"], ["moneda", "Moneda"], ["estado", "Estado"], ["fecha", "Fecha"]] },
  expedientes: { key: "files", title: "Expedientes", item: "expediente", fields: [["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["estado", "Estado"], ["responsable", "Responsable"]], columns: [["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["estado", "Estado"], ["responsable", "Responsable"]] },
  reclamos: { key: "claims", title: "Reclamos", item: "reclamo", fields: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["estado", "Estado"], ["proximo", "Proximo paso"]], columns: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["estado", "Estado"], ["proximo", "Proximo paso"]] },
  tesoreria: { key: "treasury", title: "Tesoreria", item: "movimiento de caja", fields: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["monto", "Monto"], ["moneda", "Moneda"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  consignaciones: { key: "consignments", title: "Consignaciones", item: "consignacion", fields: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido", "number"], ["comision", "Comision", "number"], ["estado", "Estado"], ["vence", "Vence", "date"]], columns: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido"], ["comision", "Comision"], ["estado", "Estado"], ["vence", "Vence"]] },
  pedidos: { key: "orders", title: "Pedidos", item: "pedido", fields: [["cliente", "Cliente"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto", "number"], ["urgencia", "Urgencia"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto"], ["urgencia", "Urgencia"], ["estado", "Estado"]] },
  liquidaciones: { key: "settlements", title: "Liquidaciones", item: "liquidacion", fields: [["beneficiario", "Beneficiario"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["beneficiario", "Beneficiario"], ["concepto", "Concepto"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  infracciones: { key: "tickets", title: "Infracciones", item: "infraccion", fields: [["dominio", "Dominio"], ["detalle", "Detalle"], ["monto", "Monto", "number"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["dominio", "Dominio"], ["detalle", "Detalle"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  reportes: { key: "reports", title: "Reportes", item: "reporte", fields: [["nombre", "Nombre"], ["periodo", "Periodo"], ["indicador", "Indicador"], ["valor", "Valor"], ["estado", "Estado"]], columns: [["nombre", "Nombre"], ["periodo", "Periodo"], ["indicador", "Indicador"], ["valor", "Valor"], ["estado", "Estado"]] },
  mensajes: { key: "messages", title: "Mensajes", item: "mensaje", fields: [["cliente", "Cliente"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["hora", "Hora"]], columns: [["cliente", "Cliente"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["hora", "Hora"]] },
  conversaciones: { key: "conversations", title: "Conversaciones", item: "conversacion", fields: [["cliente", "Cliente"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  correos: { key: "emails", title: "Correos", item: "correo", fields: [["para", "Para"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["fecha", "Fecha", "date"]], columns: [["para", "Para"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["fecha", "Fecha"]] },
  misventas: { key: "mySales", title: "Mis ventas", item: "venta propia", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["proximo", "Proximo paso"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["proximo", "Proximo paso"]] },
  postventa: { key: "afterSales", title: "Postventa", item: "seguimiento", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["entrega", "Entrega", "date"], ["control", "Control"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["entrega", "Entrega"], ["control", "Control"], ["estado", "Estado"]] },
  miscomisiones: { key: "commissions", title: "Mis comisiones", item: "comision", fields: [["operacion", "Operacion"], ["cliente", "Cliente"], ["monto", "Monto", "number"], ["estado", "Estado"], ["fecha", "Fecha", "date"]], columns: [["operacion", "Operacion"], ["cliente", "Cliente"], ["monto", "Monto"], ["estado", "Estado"], ["fecha", "Fecha"]] },
  cobros: { key: "collections", title: "Cobros", item: "cobro", fields: [["cliente", "Cliente"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["concepto", "Concepto"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  sugerencias: { key: "suggestions", title: "Sugerencias", item: "sugerencia", fields: [["titulo", "Titulo"], ["area", "Area"], ["detalle", "Detalle"], ["autor", "Autor"], ["estado", "Estado"]], columns: [["titulo", "Titulo"], ["area", "Area"], ["detalle", "Detalle"], ["autor", "Autor"], ["estado", "Estado"]] },
  autorizaciones: { key: "authorizations", title: "Autorizaciones", item: "autorizacion", fields: [["solicitud", "Solicitud"], ["solicitante", "Solicitante"], ["monto", "Monto", "number"], ["prioridad", "Prioridad"], ["estado", "Estado"]], columns: [["solicitud", "Solicitud"], ["solicitante", "Solicitante"], ["monto", "Monto"], ["prioridad", "Prioridad"], ["estado", "Estado"]] },
  dormidos: { key: "sleepingLeads", title: "Dormidos", item: "lead dormido", fields: [["cliente", "Cliente"], ["interes", "Interes"], ["ultimoContacto", "Ultimo contacto", "date"], ["dias", "Dias", "number"], ["accion", "Accion"]], columns: [["cliente", "Cliente"], ["interes", "Interes"], ["ultimoContacto", "Ultimo contacto"], ["dias", "Dias"], ["accion", "Accion"]] },
  miespacio: { key: "workspace", title: "Mi espacio", item: "tarea", fields: [["tarea", "Tarea"], ["prioridad", "Prioridad"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["tarea", "Tarea"], ["prioridad", "Prioridad"], ["vence", "Vence"], ["estado", "Estado"]] },
  wishlist: { key: "wishlist", title: "Wishlist", item: "busqueda", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo buscado"], ["presupuesto", "Presupuesto", "number"], ["match", "Match"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo buscado"], ["presupuesto", "Presupuesto"], ["match", "Match"], ["estado", "Estado"]] },
  nps: { key: "nps", title: "NPS", item: "encuesta", fields: [["cliente", "Cliente"], ["puntaje", "Puntaje", "number"], ["comentario", "Comentario"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["puntaje", "Puntaje"], ["comentario", "Comentario"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  papelera: { key: "trash", title: "Papelera", item: "registro eliminado", fields: [["origen", "Origen"], ["detalle", "Detalle"], ["eliminadoPor", "Eliminado por"], ["fecha", "Fecha", "date"]], columns: [["origen", "Origen"], ["detalle", "Detalle"], ["eliminadoPor", "Eliminado por"], ["fecha", "Fecha"]] },
  telefonos: { key: "phones", title: "Telefonos", item: "telefono", fields: [["nombre", "Nombre"], ["area", "Area"], ["telefono", "Telefono"], ["email", "Email", "email"], ["notas", "Notas"]], columns: [["nombre", "Nombre"], ["area", "Area"], ["telefono", "Telefono"], ["email", "Email"], ["notas", "Notas"]] },
  oportunidades: { key: "opportunities", title: "Oportunidades", item: "oportunidad", fields: [["cliente", "Cliente"], ["interes", "Interes"], ["probabilidad", "Probabilidad"], ["monto", "Monto", "number"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["interes", "Interes"], ["probabilidad", "Probabilidad"], ["monto", "Monto"], ["estado", "Estado"]] },
  taller: { key: "workshop", title: "Taller", item: "trabajo", fields: [["vehiculo", "Vehiculo"], ["trabajo", "Trabajo"], ["responsable", "Responsable"], ["costo", "Costo", "number"], ["estado", "Estado"]], columns: [["vehiculo", "Vehiculo"], ["trabajo", "Trabajo"], ["responsable", "Responsable"], ["costo", "Costo"], ["estado", "Estado"]] }
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

function normalizeState() {
  if (!state) state = {};
  Object.entries(sectionDefaults).forEach(([key, rows]) => {
    if (!Array.isArray(state[key])) state[key] = rows;
  });
  if (!Array.isArray(state.messages)) state.messages = [];
  if (!state.settings) state.settings = { businessName: "Sote Auto", currency: "ARS" };
}


async function saveState(message = "Datos guardados") {
  await api("/api/state", { method: "PUT", body: JSON.stringify({ state }) });
  toast(message);
}

function setTheme() {
  const light = localStorage.getItem(THEME_KEY) === "light";
  document.documentElement.classList.toggle("light", light);
  document.documentElement.classList.toggle("dark", !light);
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function render() {
  setTheme();
  document.getElementById("app").innerHTML = authUser ? shell() : login();
  bind();
}

function login() {
  return `
    <main class="login-page">
      <section class="login-card">
        <div class="login-head">
          <div class="logo-tile">SOTE</div>
          <div class="eyebrow">Sote CRM</div>
          <h1>Iniciar sesion</h1>
          <p class="muted">Usa tus credenciales del CRM para entrar.</p>
        </div>
        <form class="form-stack" data-action="login">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <div class="field-row">
              <label for="password">Contrasena</label>
              <a class="link-small" href="#forgot">Olvidaste tu contrasena?</a>
            </div>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <button class="btn primary" type="submit">Ingresar</button>
        </form>
        <p class="hint">Admin inicial: admin@autos.app / admin1234</p>
      </section>
    </main>
  `;
}

function shell() {
  const active = modules.find(m => m.id === currentModule) || modules[0];
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo-tile">SOTE</div>
          <div><strong>${escapeHtml(state.settings?.businessName || "Sote CRM")}</strong><span>Agencia automotor</span></div>
        </div>
        <nav class="nav">
          ${modules.map(m => `<button class="${m.id === currentModule ? "active" : ""}" data-module="${m.id}" title="${m.label}"><span class="ico">${m.icon}</span><span class="label">${m.label}</span></button>`).join("")}
        </nav>
        <div class="side-bottom">
          <a class="btn ghost" href="/api/backup" download>Backup JSON</a>
          <button class="btn ghost" data-action="theme">Cambiar tema</button>
          <button class="btn ghost" data-action="logout">Cerrar sesion</button>
        </div>
      </aside>
      <section class="content">
        <header class="topbar">
          <div>
            <h1>${active.label}</h1>
            <p>${active.subtitle}</p>
          </div>
          <div class="top-actions">
            <input class="search" data-action="search" value="${escapeHtml(query)}" placeholder="Buscar en este modulo">
            <button class="btn ghost" data-action="theme" title="Tema">Tema</button>
            <button class="btn" data-action="quick-add">Nuevo</button>
          </div>
        </header>
        <div class="page">${page()}</div>
      </section>
    </div>
  `;
}

function page() {
  if (currentModule === "dashboard") return dashboard();
  if (currentModule === "stock") return tablePage("vehicles", "Vehiculo", vehicleColumns());
  if (currentModule === "clientes") return tablePage("clients", "Cliente", clientColumns());
  if (currentModule === "ventas") return salesPage();
  if (currentModule === "gestoria") return tablePage("paperwork", "Tramite", paperworkColumns());
  if (currentModule === "finanzas") return tablePage("finance", "Movimiento", financeColumns());
  if (currentModule === "whatsapp") return whatsappPage();
  if (currentModule === "config" || currentModule === "configuracion") return configPage();
  return genericSectionPage(currentModule);
}

function dashboard() {
  const ingresos = state.finance.filter(x => x.tipo === "Ingreso").reduce((a, x) => a + Number(x.monto), 0);
  const egresos = state.finance.filter(x => x.tipo === "Egreso").reduce((a, x) => a + Number(x.monto), 0);
  return `
    <div class="grid stats">
      ${stat("Unidades en stock", state.vehicles.length, "Inventario activo")}
      ${stat("Leads activos", state.clients.length, "Consultas y compradores")}
      ${stat("Pipeline", money(state.sales.reduce((a, x) => a + Number(x.monto), 0)), "Oportunidades abiertas")}
      ${stat("Caja neta", money(ingresos - egresos), "Ingresos menos egresos")}
    </div>
    <div class="grid two-col" style="margin-top:16px">
      <section class="card">
        <div class="card-head"><h2>Ventas por etapa</h2><button class="btn" data-module="ventas">Abrir ventas</button></div>
        <div class="card-body">${kanban()}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Actividad reciente</h2><span class="pill info">SQLite</span></div>
        <div class="card-body timeline">
          ${(state.audit || []).slice(0, 6).map((x, i) => `<div class="event"><time>${i + 9}:0${i}</time><div>${escapeHtml(x)}</div></div>`).join("")}
        </div>
      </section>
    </div>
    <div style="margin-top:16px">${tablePage("vehicles", "Stock destacado", vehicleColumns(), true)}</div>
  `;
}

function stat(label, value, note) {
  return `<section class="card stat"><span>${label}</span><strong>${value}</strong><small>${note}</small></section>`;
}

function tablePage(key, title, columns, embedded = false) {
  const rows = filtered(state[key] || []);
  return `
    <section class="card">
      <div class="card-head">
        <h2>${title}</h2>
        ${embedded ? "" : `<button class="btn" data-add="${key}">Nuevo</button>`}
      </div>
      ${embedded ? "" : `<div class="card-body toolbar"><input class="grow" data-action="search" value="${escapeHtml(query)}" placeholder="Filtrar ${title.toLowerCase()}"><button class="btn ghost" data-action="export">Exportar CSV</button></div>`}
      <div style="overflow:auto">
        <table>
          <thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}<th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row[c.key], row) : escapeHtml(row[c.key])}</td>`).join("")}<td class="record-actions"><button class="icon-btn" data-edit="${key}:${row.id}" title="Editar">E</button><button class="icon-btn" data-delete="${key}:${row.id}" title="Eliminar">X</button></td></tr>`).join("") : `<tr><td colspan="${columns.length + 1}" class="empty">No hay registros para mostrar.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function filtered(items) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(q)));
}
function genericColumns(moduleId) {
  const def = sectionData[moduleId];
  return (def?.columns || []).map(([key, label]) => ({
    key,
    label,
    render: value => /monto|precio|comision|costo|presupuesto/i.test(key) ? money(value) : (/estado|prioridad|tipo/i.test(key) ? pill(value) : escapeHtml(value))
  }));
}

function genericSectionPage(moduleId) {
  const def = sectionData[moduleId];
  if (!def) {
    return '<section class="card"><div class="card-head"><h2>Modulo en preparacion</h2></div><div class="card-body"><p class="muted">Esta seccion esta lista para conectarse.</p></div></section>';
  }
  return tablePage(def.key, def.title, genericColumns(moduleId));
}


function vehicleColumns() {
  return [
    { key: "dominio", label: "Dominio" },
    { key: "modelo", label: "Modelo", render: (_, r) => `<strong>${escapeHtml(r.marca)} ${escapeHtml(r.modelo)}</strong><br><span class="muted">${r.anio} - ${Number(r.km).toLocaleString("es-AR")} km</span>` },
    { key: "precio", label: "Precio", render: v => money(v) },
    { key: "estado", label: "Estado", render: v => pill(v) },
    { key: "ubicacion", label: "Ubicacion" },
    { key: "margen", label: "Margen", render: v => money(v) }
  ];
}

function clientColumns() {
  return [
    { key: "nombre", label: "Cliente", render: (_, r) => `<strong>${escapeHtml(r.nombre)}</strong><br><span class="muted">${escapeHtml(r.email)}</span>` },
    { key: "telefono", label: "Telefono" },
    { key: "interes", label: "Interes" },
    { key: "origen", label: "Origen" },
    { key: "estado", label: "Estado", render: v => pill(v) }
  ];
}

function paperworkColumns() {
  return [
    { key: "tramite", label: "Tramite" },
    { key: "cliente", label: "Cliente" },
    { key: "vehiculo", label: "Vehiculo" },
    { key: "estado", label: "Estado", render: v => pill(v) },
    { key: "vence", label: "Vence" }
  ];
}

function financeColumns() {
  return [
    { key: "concepto", label: "Concepto" },
    { key: "tipo", label: "Tipo", render: v => pill(v) },
    { key: "monto", label: "Monto", render: v => money(v) },
    { key: "fecha", label: "Fecha" },
    { key: "estado", label: "Estado", render: v => pill(v) }
  ];
}

function salesPage() {
  return `
    <div class="toolbar">
      <button class="btn" data-add="sales">Nueva oportunidad</button>
      <button class="btn ghost" data-action="advance">Avanzar primera venta</button>
    </div>
    ${kanban()}
  `;
}

function kanban() {
  const stages = ["Contacto", "Tasacion", "Reserva", "Cierre"];
  return `<div class="kanban">${stages.map(stage => `
    <section class="lane">
      <h3>${stage}</h3>
      ${(state.sales || []).filter(s => s.etapa === stage).map(s => `
        <article class="deal">
          <strong>${escapeHtml(s.cliente)}</strong>
          <p>${escapeHtml(s.vehiculo)}</p>
          <p>${money(s.monto)}</p>
          <p>${escapeHtml(s.vendedor)} - ${escapeHtml(s.proximo)}</p>
          <div class="record-actions" style="margin-top:10px"><button class="icon-btn" data-edit="sales:${s.id}" title="Editar">E</button><button class="icon-btn" data-delete="sales:${s.id}" title="Eliminar">X</button></div>
        </article>
      `).join("")}
    </section>
  `).join("")}</div>`;
}

function whatsappPage() {
  return `
    <div class="grid two-col">
      ${tablePage("messages", "Mensajes", [
        { key: "cliente", label: "Cliente" },
        { key: "plantilla", label: "Plantilla" },
        { key: "estado", label: "Estado", render: v => pill(v) },
        { key: "hora", label: "Hora" }
      ], true)}
      <section class="card">
        <div class="card-head"><h2>Plantilla rapida</h2></div>
        <div class="card-body form-stack">
          <div class="field"><label>Cliente</label><input id="wa-client" value="Martina Quiroga"></div>
          <div class="field"><label>Mensaje</label><textarea id="wa-text">Hola Martina, te escribimos por el Corolla XEI. Queres coordinar una prueba de manejo?</textarea></div>
          <button class="btn primary" data-action="simulate-wa">Generar enlace WhatsApp</button>
        </div>
      </section>
    </div>
  `;
}

function configPage() {
  const s = state.settings || {};
  return `
    <section class="card">
      <div class="card-head"><h2>Configuracion</h2><a class="btn ghost" href="/api/backup" download>Descargar backup</a></div>
      <div class="card-body">
        <form class="form-stack" data-action="settings">
          <div class="form-grid">
            ${input("businessName", "Nombre de agencia", s.businessName || "Sote Auto")}
            ${input("ownerName", "Responsable", s.ownerName || "")}
            ${input("phone", "Telefono", s.phone || "")}
            ${input("email", "Email", s.email || "", "email")}
            ${input("address", "Direccion", s.address || "")}
            ${input("currency", "Moneda", s.currency || "ARS")}
          </div>
          <div class="toolbar">
            <button class="btn" type="submit">Guardar configuracion</button>
            <button class="btn ghost" type="button" data-action="theme">Cambiar tema</button>
            <button class="btn danger" type="button" data-action="logout">Cerrar sesion</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function input(name, label, value, type = "text") {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}"></div>`;
}

function formFor(key, row = {}) {
  const dynamicDef = Object.values(sectionData).find(def => def.key === key);
  const forms = {
    vehicles: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precio", "Precio", "number"], ["estado", "Estado"], ["ubicacion", "Ubicacion"], ["margen", "Margen", "number"]],
    clients: [["nombre", "Nombre"], ["telefono", "Telefono"], ["email", "Email", "email"], ["interes", "Interes"], ["origen", "Origen"], ["estado", "Estado"]],
    sales: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["vendedor", "Vendedor"], ["proximo", "Proximo contacto"]],
    paperwork: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"], ["vence", "Vence", "date"]],
    finance: [["concepto", "Concepto"], ["tipo", "Tipo"], ["monto", "Monto", "number"], ["fecha", "Fecha", "date"], ["estado", "Estado"]],
    messages: [["cliente", "Cliente"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["hora", "Hora"]]
  };
  const fields = dynamicDef?.fields || forms[key] || forms.clients;
  return '<div class="form-grid">' + fields.map(([name, label, type = "text"]) => input(name, label, row[name] ?? "", type)).join("") + '</div>';
}

function openModal(key, row = {}) {
  const title = `${row.id ? "Editar" : "Nuevo"} ${labelForKey(key)}`;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal">
        <div class="card-head"><h2>${title}</h2><button class="icon-btn" data-close>X</button></div>
        <form data-save="${key}" data-id="${row.id || ""}">
          ${formFor(key, row)}
          <div class="modal-actions">
            <button class="btn ghost" type="button" data-close>Cancelar</button>
            <button class="btn" type="submit">Guardar</button>
          </div>
        </form>
      </section>
    </div>
  `);
  bindModal();
}

function labelForKey(key) {
  const dynamicDef = Object.values(sectionData).find(def => def.key === key);
  return dynamicDef?.item || ({ vehicles: "vehiculo", clients: "cliente", sales: "oportunidad", paperwork: "tramite", finance: "movimiento", messages: "mensaje" }[key] || "registro");
}

function pill(value) {
  const s = String(value);
  const cls = /Disponible|Listo|Confirmado|Ingreso|Enviado|Pagado/.test(s) ? "ok" : /Pendiente|Reservado|Programado|Tasacion/.test(s) ? "warn" : /Caliente|Egreso|Preparacion/.test(s) ? "hot" : "info";
  return `<span class="pill ${cls}">${escapeHtml(s)}</span>`;
}

function bind() {
  document.querySelector("[data-action='login']")?.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(e.target).entries());
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
      authUser = data.user;
      await loadState();
      state.audit = state.audit || [];
      state.audit.unshift(`Ingreso ${authUser.email}`);
      await saveState("Bienvenido a Sote CRM");
      render();
    } catch (error) {
      toast(error.message);
    }
  });

  document.querySelectorAll("[data-module]").forEach(btn => btn.addEventListener("click", () => {
    currentModule = btn.dataset.module;
    query = "";
    render();
  }));

  document.querySelectorAll("[data-action='search']").forEach(inputEl => inputEl.addEventListener("input", e => {
    query = e.target.value;
    render();
  }));

  document.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.add)));
  document.querySelector("[data-action='quick-add']")?.addEventListener("click", () => {
    const map = { stock: "vehicles", clientes: "clients", ventas: "sales", gestoria: "paperwork", finanzas: "finance", whatsapp: "messages" };
    const dynamicDef = sectionData[currentModule];
    openModal(dynamicDef?.key || map[currentModule] || "clients");
  });

  document.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
    const [key, id] = btn.dataset.edit.split(":");
    openModal(key, state[key].find(x => x.id === id));
  }));

  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
    const [key, id] = btn.dataset.delete.split(":");
    state[key] = state[key].filter(x => x.id !== id);
    addAudit(`Registro eliminado en ${labelForKey(key)}`);
    await saveState("Registro eliminado");
    render();
  }));

  document.querySelectorAll("[data-action='theme']").forEach(btn => btn.addEventListener("click", () => {
    localStorage.setItem(THEME_KEY, localStorage.getItem(THEME_KEY) === "light" ? "dark" : "light");
    render();
  }));

  document.querySelectorAll("[data-action='logout']").forEach(btn => btn.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    authUser = null;
    state = null;
    render();
  }));

  document.querySelector("[data-action='export']")?.addEventListener("click", exportCurrent);
  document.querySelector("[data-action='advance']")?.addEventListener("click", advanceSale);
  document.querySelector("[data-action='simulate-wa']")?.addEventListener("click", () => {
    const text = encodeURIComponent(document.getElementById("wa-text").value);
    navigator.clipboard?.writeText(`https://wa.me/?text=${text}`);
    toast("Enlace de WhatsApp copiado");
  });
  document.querySelector("[data-action='settings']")?.addEventListener("submit", async e => {
    e.preventDefault();
    state.settings = { ...(state.settings || {}), ...Object.fromEntries(new FormData(e.target).entries()) };
    addAudit("Configuracion actualizada");
    await saveState("Configuracion guardada");
    render();
  });

  bindModal();
}

function bindModal() {
  document.querySelectorAll("[data-close]").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => btn.closest("[data-modal]")?.remove());
  });
  document.querySelectorAll("[data-save]").forEach(form => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const key = e.target.dataset.save;
      const id = e.target.dataset.id;
      const item = Object.fromEntries(new FormData(e.target).entries());
      Object.keys(item).forEach(k => {
        if (/^(anio|km|precio|margen|monto|precioPretendido|comision|costo|presupuesto|puntaje|dias)$/.test(k)) item[k] = Number(item[k]);
      });
      if (id) {
        state[key] = state[key].map(x => x.id === id ? { ...x, ...item, id } : x);
      } else {
        state[key].unshift({ ...item, id: `${key}-${Date.now()}` });
      }
      addAudit(`${id ? "Actualizado" : "Creado"} ${labelForKey(key)}`);
      await saveState("Datos guardados");
      document.querySelector("[data-modal]")?.remove();
      render();
    });
  });
}

async function advanceSale() {
  const order = ["Contacto", "Tasacion", "Reserva", "Cierre"];
  const sale = state.sales.find(s => s.etapa !== "Cierre");
  if (!sale) return toast("Todas las ventas estan en cierre.");
  sale.etapa = order[order.indexOf(sale.etapa) + 1];
  addAudit(`Venta de ${sale.cliente} avanzo a ${sale.etapa}`);
  await saveState("Venta avanzada");
  render();
}

function addAudit(text) {
  state.audit = state.audit || [];
  state.audit.unshift(text);
}

function exportCurrent() {
  const map = { stock: "vehicles", clientes: "clients", gestoria: "paperwork", finanzas: "finance", mensajes: "messages" };
  const key = sectionData[currentModule]?.key || map[currentModule];
  if (!key) return toast("Este modulo no tiene exportacion tabular.");
  const rows = filtered(state[key] || []);
  const headers = Object.keys(rows[0] || {});
  if (!headers.length) return toast("No hay datos para exportar.");
  const csv = [headers.join(","), ...rows.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = 'sote-' + (key || currentModule) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[ch]));
}

boot();
