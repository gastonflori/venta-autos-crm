const THEME_KEY = "autos-crm-theme";

let defaultLogoDataUrl = "";
let defaultLogoPdfDataUrl = "";

function _buildPdfLogo(src) {
  if (!src) { defaultLogoPdfDataUrl = ""; return; }
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 120, maxH = 40;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        defaultLogoPdfDataUrl = c.toDataURL("image/jpeg", 0.88);
      } catch (_) { defaultLogoPdfDataUrl = ""; }
    };
    img.onerror = () => { defaultLogoPdfDataUrl = ""; };
    img.src = src;
  } catch (_) { defaultLogoPdfDataUrl = ""; }
}

let state = null;
let authUser = null;
let currentModule = "dashboard";
let query = "";
let publicConfig = {};
let calendarView = "month";
let calendarCursor = new Date().toISOString().slice(0, 10);
let _vehiclePhotosBuf = [];
let _expPhotosBuf = [];
let clientProfileId = null;
let clientProfileTab = "resumen";
let catalogoVehiculos = {};

const modules = [
  { id: "dashboard", label: "Dashboard", icon: "D", subtitle: "Resumen operativo de la agencia" },
  { id: "calendario", label: "Calendario", icon: "CL", subtitle: "Agenda, entregas, test drives y vencimientos" },
  { id: "alertas", label: "Alertas", icon: "AL", subtitle: "Avisos operativos y tareas urgentes" },
  { id: "stock", label: "Stock", icon: "ST", subtitle: "Vehiculos, precios, estados y ubicaciones" },
  { id: "clientes", label: "Clientes", icon: "C", subtitle: "Leads, compradores y seguimiento comercial" },
  { id: "ventas", label: "Ventas", icon: "V", subtitle: "Pipeline comercial por etapa" },
  { id: "cotizaciones", label: "Cotizaciones", icon: "CO", subtitle: "Presupuestos y ofertas enviadas" },
  { id: "consignaciones", label: "Consignaciones", icon: "CS", subtitle: "Unidades tomadas en consignacion" },
  { id: "tesoreria", label: "Tesoreria", icon: "T", subtitle: "Caja, bancos y saldos" },
  { id: "finanzas", label: "Finanzas", icon: "$", subtitle: "Ingresos, egresos y caja" },
  { id: "configuracion", label: "Configuracion", icon: "*", subtitle: "Preferencias de agencia y cuenta" },
  { id: "expedientetecnico", label: "Expediente tecnico", icon: "ET", subtitle: "VTV, seguro y estado tecnico por vehiculo" },
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
  fetch("/data/vehiculos-ar.json").then(r => r.json()).then(data => { catalogoVehiculos = data; }).catch(() => {});
  fetch("/logo.png").then(r => r.blob()).then(blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); })).then(d => { defaultLogoDataUrl = d; _buildPdfLogo(d); }).catch(() => {});
  try {
    publicConfig = await api("/api/public-config");
  } catch {
    publicConfig = {};
  }
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
  const normalized = normalizeState(data.state);
  const changed = JSON.stringify(data.state || {}) !== JSON.stringify(normalized);
  state = normalized;
  authUser = data.user;
  if (changed) {
    await api("/api/state", { method: "PUT", body: JSON.stringify({ state }) }).catch(() => {});
  }
  _buildPdfLogo(state?.settings?.logoDataUrl || defaultLogoDataUrl);
}
const sectionData = {
  calendario: { key: "calendarItems", title: "Calendario", item: "evento", fields: [["fecha", "Fecha", "date"], ["hora", "Hora"], ["tipo", "Tipo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"]], columns: [["fecha", "Fecha"], ["hora", "Hora"], ["tipo", "Tipo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"]] },
  alertas: { key: "alerts", title: "Alertas", item: "alerta", fields: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["vence", "Vence"], ["estado", "Estado"]] },
  cotizaciones: { key: "quotes", title: "Cotizaciones", item: "cotizacion", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["tipoOperacion", "Tipo"], ["estado", "Estado"], ["fecha", "Fecha", "date"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tipoOperacion", "Tipo"], ["monto", "Monto"], ["moneda", "Moneda"], ["estado", "Estado"], ["fecha", "Fecha"]] },
  cobros: { key: "collections", title: "Cobros", item: "cobro", fields: [["cliente", "Cliente"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["concepto", "Concepto"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  expedientes: { key: "files", title: "Expedientes", item: "expediente", fields: [["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["estado", "Estado"], ["responsable", "Responsable"]], columns: [["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["estado", "Estado"], ["responsable", "Responsable"]] },
  reclamos: { key: "claims", title: "Reclamos", item: "reclamo", fields: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["estado", "Estado"], ["proximo", "Proximo paso"]], columns: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["estado", "Estado"], ["proximo", "Proximo paso"]] },
  tesoreria: { key: "treasury", title: "Tesoreria", item: "movimiento de caja", fields: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["monto", "Monto"], ["moneda", "Moneda"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  consignaciones: { key: "consignments", title: "Consignaciones", item: "consignacion", fields: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido", "number"], ["comision", "Comision", "number"], ["estado", "Estado"], ["vence", "Vence", "date"]], columns: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido"], ["comision", "Comision"], ["estado", "Estado"], ["vence", "Vence"]] },
  pedidos: { key: "orders", title: "Pedidos", item: "pedido", fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["anioDesde", "Anio desde", "number"], ["anioHasta", "Anio hasta", "number"], ["presupuesto", "Presupuesto maximo", "number"], ["moneda", "Moneda"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  liquidaciones: { key: "settlements", title: "Liquidaciones", item: "liquidacion", fields: [["beneficiario", "Beneficiario"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["beneficiario", "Beneficiario"], ["concepto", "Concepto"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  infracciones: { key: "tickets", title: "Infracciones", item: "infraccion", fields: [["dominio", "Dominio"], ["detalle", "Detalle"], ["monto", "Monto", "number"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["dominio", "Dominio"], ["detalle", "Detalle"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  reportes: { key: "reports", title: "Reportes", item: "reporte", fields: [["nombre", "Nombre"], ["periodo", "Periodo"], ["indicador", "Indicador"], ["valor", "Valor"], ["estado", "Estado"]], columns: [["nombre", "Nombre"], ["periodo", "Periodo"], ["indicador", "Indicador"], ["valor", "Valor"], ["estado", "Estado"]] },
  mensajes: { key: "messages", title: "Mensajes", item: "mensaje", fields: [["cliente", "Cliente"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["hora", "Hora"]], columns: [["cliente", "Cliente"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["hora", "Hora"]] },
  conversaciones: { key: "conversations", title: "Conversaciones", item: "conversacion", fields: [["cliente", "Cliente"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  correos: { key: "emails", title: "Correos", item: "correo", fields: [["para", "Para"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["fecha", "Fecha", "date"]], columns: [["para", "Para"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["fecha", "Fecha"]] },
  misventas: { key: "mySales", title: "Mis ventas", item: "venta propia", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["proximo", "Proximo paso"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["proximo", "Proximo paso"]] }
};

const moduleEnhancements = {
  alertas: { fields: [["titulo", "Titulo"], ["tipo", "Tipo"], ["prioridad", "Prioridad"], ["area", "Area"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["vence", "Vence", "date"], ["responsable", "Responsable"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["cliente", "Cliente"], ["vence", "Vence"], ["estado", "Estado"]] },
  stock: { fields: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["version", "Version"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precio", "Precio", "number"], ["moneda", "Moneda"], ["estado", "Estado"], ["ubicacion", "Ubicacion"], ["origen", "Origen"], ["margen", "Margen", "number"], ["notas", "Notas", "textarea"]], columns: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["anio", "Anio"], ["precio", "Precio"], ["estado", "Estado"]] },
  clientes: { fields: [["nombre", "Nombre"], ["telefono", "Telefono"], ["email", "Email", "email"], ["dni", "DNI/CUIT"], ["interes", "Interes"], ["origen", "Origen"], ["vendedor", "Vendedor"], ["proximo", "Proximo contacto"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["nombre", "Nombre"], ["telefono", "Telefono"], ["interes", "Interes"], ["origen", "Origen"], ["estado", "Estado"]] },
  ventas: { fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["sena", "Sena", "number"], ["vendedor", "Vendedor"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["vendedor", "Vendedor"], ["estado", "Estado"]] },
  cotizaciones: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["tipoOperacion", "Tipo", "select"], ["precioLista", "Precio lista", "number"], ["bonificacion", "Bonificacion", "number"], ["monto", "Monto final", "number"], ["moneda", "Moneda"], ["validez", "Validez hasta", "date"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Condiciones", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tipoOperacion", "Tipo"], ["monto", "Monto"], ["moneda", "Moneda"], ["validez", "Validez"], ["estado", "Estado"]] },
  cobros: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["concepto", "Concepto"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["medio", "Medio"], ["vence", "Vence", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["concepto", "Concepto"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  gestoria: { fields: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["gestor", "Gestor"], ["vence", "Vence", "date"], ["costo", "Costo", "number"], ["estado", "Estado"], ["notas", "Observaciones", "textarea"]], columns: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"], ["vence", "Vence"]] },
  finanzas: { fields: [["concepto", "Concepto"], ["tipo", "Tipo"], ["categoria", "Categoria"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["medio", "Medio de pago"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["concepto", "Concepto"], ["tipo", "Tipo"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  expedientes: { fields: [["numero", "Numero"], ["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["tramite", "Tramite"], ["responsable", "Responsable"], ["fechaAlta", "Fecha alta", "date"], ["vence", "Vence", "date"], ["estado", "Estado"], ["detalle", "Documentacion", "textarea"]], columns: [["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  reclamos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  tesoreria: { fields: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["concepto", "Concepto"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["medio", "Medio de pago"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["concepto", "Concepto"], ["monto", "Monto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  consignaciones: { fields: [["titular", "Titular"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precioPretendido", "Precio pretendido", "number"], ["comision", "Comision", "number"], ["vence", "Vence", "date"], ["estado", "Estado"], ["notas", "Condiciones", "textarea"]], columns: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido"], ["comision", "Comision"], ["vence", "Vence"], ["estado", "Estado"]] },
  pedidos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["anioDesde", "Anio desde", "number"], ["anioHasta", "Anio hasta", "number"], ["presupuesto", "Presupuesto maximo", "number"], ["moneda", "Moneda"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  liquidaciones: { fields: [["beneficiario", "Beneficiario"], ["operacion", "Operacion"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Detalle", "textarea"]], columns: [["beneficiario", "Beneficiario"], ["operacion", "Operacion"], ["concepto", "Concepto"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  infracciones: { fields: [["dominio", "Dominio"], ["vehiculo", "Vehiculo"], ["detalle", "Detalle"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["vence", "Vence", "date"], ["responsable", "Responsable"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["dominio", "Dominio"], ["vehiculo", "Vehiculo"], ["detalle", "Detalle"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  reportes: { fields: [["nombre", "Nombre"], ["periodo", "Periodo"], ["area", "Area"], ["indicador", "Indicador"], ["valor", "Valor"], ["responsable", "Responsable"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["nombre", "Nombre"], ["periodo", "Periodo"], ["area", "Area"], ["indicador", "Indicador"], ["valor", "Valor"], ["estado", "Estado"]] },
  mensajes: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["canal", "Canal"], ["plantilla", "Plantilla"], ["mensaje", "Mensaje", "textarea"], ["hora", "Hora"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["canal", "Canal"], ["plantilla", "Plantilla"], ["hora", "Hora"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  conversaciones: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  correos: { fields: [["para", "Para"], ["cliente", "Cliente"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["mensaje", "Mensaje", "textarea"], ["fecha", "Fecha", "date"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["para", "Para"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["fecha", "Fecha"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  misventas: { fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["sena", "Sena", "number"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["proximo", "Proximo paso"], ["estado", "Estado"]] }
};

const coreModuleData = {
  stock: { key: "vehicles", title: "Stock", item: "vehiculo" },
  clientes: { key: "clients", title: "Clientes", item: "cliente" },
  ventas: { key: "sales", title: "Ventas", item: "venta" },
  gestoria: { key: "paperwork", title: "Gestoria", item: "tramite" },
  finanzas: { key: "finance", title: "Finanzas", item: "movimiento" }
};

Object.entries(moduleEnhancements).forEach(([id, patch]) => {
  if (!sectionData[id] && coreModuleData[id]) sectionData[id] = coreModuleData[id];
  if (sectionData[id]) sectionData[id] = { ...sectionData[id], ...patch };
});

const sectionDefaults = {
  calendarItems: [{ id: "cal-1", fecha: "2026-06-30", hora: "10:30", tipo: "Test drive", cliente: "Martina Quiroga", vehiculo: "Toyota Corolla XEI", estado: "Programado" }],
  alerts: [{ id: "al-1", titulo: "Transferencia por vencer", prioridad: "Alta", area: "Gestoria", vence: "2026-07-02", estado: "Pendiente" }],
  quotes: [{ id: "co-1", cliente: "Ana Rivas", vehiculo: "Fiat Cronos Precision", monto: 18100000, moneda: "ARS", estado: "Enviada", fecha: "2026-06-29" }],
  files: [{ id: "ex-1", numero: "EXP-1001", cliente: "Sergio Calvo", vehiculo: "Amarok Highline", tramite: "Transferencia", estado: "En curso", responsable: "Gestoria" }],
  claims: [{ id: "re-1", cliente: "Nicolas Paz", motivo: "Detalle postventa", canal: "WhatsApp", prioridad: "Media", estado: "Abierto", proximo: "Llamar hoy" }],
  treasury: [{ id: "te-1", cuenta: "Caja principal", tipo: "Ingreso", monto: 850000, moneda: "ARS", fecha: "2026-06-29", estado: "Confirmado" }],
  consignments: [{ id: "cs-1", titular: "Laura Gomez", vehiculo: "Peugeot 208", precioPretendido: 17500000, comision: 900000, estado: "Activa", vence: "2026-07-20" }],
  orders: [{ id: "pe-1", cliente: "Marcos Diaz", telefono: "+54 11 5555 5555", marca: "Toyota", modelo: "Hilux", anioDesde: 2020, anioHasta: 2024, presupuesto: 38000000, moneda: "ARS", vendedor: "Gastoonfloori", estado: "Activo", notas: "Busca Hilux 4x4, buen estado, preferentemente blanca o gris." }],
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

const coreSeedDefaults = {
  vehicles: [
    { id: "vh-1", dominio: "AB123CD", marca: "Toyota", modelo: "Corolla", version: "XEI CVT", anio: 2022, km: 35000, precio: 24400000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Usados", margen: 800000, notas: "" },
    { id: "vh-2", dominio: "FG456HI", marca: "Ford", modelo: "Ranger", version: "XLS 4x4", anio: 2021, km: 58000, precio: 38000000, moneda: "ARS", estado: "Reservado", ubicacion: "Deposito", origen: "Permuta", margen: 1200000, notas: "" },
    { id: "vh-3", dominio: "JK789LM", marca: "Volkswagen", modelo: "Amarok", version: "Highline V6", anio: 2023, km: 18000, precio: 52000000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Concesionaria", margen: 1500000, notas: "" }
  ],
  clients: [
    { id: "cl-1", nombre: "Martina Quiroga", telefono: "+54 11 5555 1234", email: "martina@mail.com", dni: "30123456", interes: "Toyota Corolla", origen: "WhatsApp", vendedor: "Gastoonfloori", proximo: "", estado: "Caliente", notas: "Busca auto familiar, hasta 25M" },
    { id: "cl-2", nombre: "Sergio Calvo", telefono: "+54 11 5555 5678", email: "sergio@mail.com", dni: "28765432", interes: "Amarok V6", origen: "Salon", vendedor: "Gastoonfloori", proximo: "", estado: "Seguimiento", notas: "Quiere cambiar camioneta" },
    { id: "cl-3", nombre: "Nicolas Paz", telefono: "+54 11 5555 9012", email: "nico@mail.com", dni: "32100987", interes: "Ranger XLS", origen: "Instagram", vendedor: "Gastoonfloori", proximo: "", estado: "Cerrado", notas: "Compro la Ranger" }
  ],
  sales: [
    { id: "sa-1", cliente: "Martina Quiroga", clienteId: "cl-1", vehiculo: "Toyota Corolla XEI CVT", vehiculoId: "vh-1", etapa: "Tasacion", monto: 24400000, moneda: "ARS", sena: 0, vendedor: "Gastoonfloori", proximo: "Confirmar tasacion", estado: "Tasacion", notas: "" },
    { id: "sa-2", cliente: "Sergio Calvo", clienteId: "cl-2", vehiculo: "Volkswagen Amarok Highline V6", vehiculoId: "vh-3", etapa: "Reserva", monto: 52000000, moneda: "ARS", sena: 1000000, vendedor: "Gastoonfloori", proximo: "Coordinar entrega", estado: "Reserva", notas: "" }
  ],
  paperwork: [
    { id: "pw-1", tramite: "Transferencia", cliente: "Sergio Calvo", clienteId: "cl-2", vehiculo: "Amarok Highline V6", vehiculoId: "vh-3", dominio: "JK789LM", gestor: "Gestoria Central", vence: "2026-08-01", costo: 180000, estado: "En curso", notas: "" }
  ],
  finance: [
    { id: "fn-1", concepto: "Sena Amarok V6", tipo: "Ingreso", categoria: "Sena", cliente: "Sergio Calvo", vehiculo: "Amarok Highline V6", monto: 1000000, moneda: "ARS", fecha: "2026-07-15", medio: "Transferencia", estado: "Confirmado", notas: "" }
  ]
};

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

function normalizeState(next = {}) {
  const defaults = {
    vehicles: [],
    clients: [],
    sales: [],
    paperwork: [],
    finance: [],
    messages: [],
    calendar: [],
    audit: [],
    clientDocs: [],
    settings: {}
  };
  const merged = { ...defaults, ...next, settings: { ...defaults.settings, ...(next.settings || {}) } };
  Object.entries(sectionDefaults).forEach(([key, rows]) => {
    if (!Array.isArray(merged[key]) || (!merged.settings.sectionsSeeded && merged[key].length === 0)) {
      merged[key] = rows.map(row => ({ ...row }));
    }
  });
  Object.values(sectionData).forEach(def => {
    if (!Array.isArray(merged[def.key])) merged[def.key] = [];
    merged[def.key] = merged[def.key].map(row => enrichRow(def.key, def.fields, row));
  });
  merged.orders = (merged.orders || []).map(order => ({
    telefono: "",
    anioDesde: "",
    anioHasta: "",
    moneda: "ARS",
    vendedor: authUser?.name || "Gastoonfloori",
    notas: "",
    ...order
  }));
  if (!merged.settings.sectionsSeeded) merged.settings.sectionsSeeded = true;
  if (!merged.settings.coreSeedV2) {
    Object.entries(coreSeedDefaults).forEach(([key, rows]) => {
      if (!Array.isArray(merged[key]) || merged[key].length === 0) {
        merged[key] = rows.map(row => ({ ...row }));
      }
    });
    merged.settings.coreSeedV2 = true;
  }
  if (!merged.settings.coreSeedV3) {
    const seedVehicles = [
      { id: "sv3-1", dominio: "AC120BD", marca: "Toyota", modelo: "Hilux", version: "SRV 4x4 AT", anio: 2022, km: 42000, precio: 58000000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Usados", margen: 2200000, notas: "Impecable, unico dueno" },
      { id: "sv3-2", dominio: "AD987GH", marca: "Volkswagen", modelo: "Golf", version: "Highline 1.4T", anio: 2023, km: 18000, precio: 34500000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Concesionaria", margen: 1400000, notas: "Como nuevo, full equipo" },
      { id: "sv3-3", dominio: "AB556KL", marca: "Renault", modelo: "Kangoo", version: "Furgon 1.6 SC", anio: 2021, km: 67000, precio: 19800000, moneda: "ARS", estado: "Disponible", ubicacion: "Deposito", origen: "Permuta", margen: 900000, notas: "Optimo para trabajo" },
      { id: "sv3-4", dominio: "AE301MN", marca: "Jeep", modelo: "Renegade", version: "Sport Plus AT", anio: 2022, km: 29000, precio: 42000000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Usados", margen: 1800000, notas: "Con garantia de fabrica" },
      { id: "sv3-5", dominio: "AF778PQ", marca: "Chevrolet", modelo: "Onix", version: "Plus Premier AT", anio: 2024, km: 5000, precio: 28500000, moneda: "ARS", estado: "Publicado", ubicacion: "Salon", origen: "Concesionaria", margen: 1100000, notas: "Cero km casi, no usar" },
      { id: "sv3-6", dominio: "AG445RS", marca: "Ford", modelo: "Territory", version: "Titanium AT AWD", anio: 2023, km: 22000, precio: 51000000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Usados", margen: 2000000, notas: "Full, techo panoramico" }
    ];
    const seedClients = [
      { id: "sc3-1", nombre: "Lucas Fernandez", telefono: "+54 9 11 5501-2233", email: "lucas.fern@mail.com", dni: "33445566", interes: "Hilux", origen: "Instagram", vendedor: authUser?.name || "", proximo: "", estado: "Caliente", notas: "Busca camioneta 4x4 para el campo" },
      { id: "sc3-2", nombre: "Valentina Rios", telefono: "+54 9 351 601-7788", email: "valen.rios@mail.com", dni: "37112233", interes: "Golf", origen: "WhatsApp", vendedor: authUser?.name || "", proximo: "", estado: "Caliente", notas: "Quiere auto compacto, presupuesto hasta 36M" },
      { id: "sc3-3", nombre: "Roberto Aguirre", telefono: "+54 9 261 402-5544", email: "roberto.ag@mail.com", dni: "28776655", interes: "Kangoo", origen: "Salon", vendedor: authUser?.name || "", proximo: "", estado: "Seguimiento", notas: "Necesita furgon para negocio de delivery" },
      { id: "sc3-4", nombre: "Carolina Mendez", telefono: "+54 9 11 6602-9900", email: "caro.mendez@mail.com", dni: "35221144", interes: "Renegade", origen: "MercadoLibre", vendedor: authUser?.name || "", proximo: "", estado: "Nuevo", notas: "Primera camioneta, quiere SUV familiar" },
      { id: "sc3-5", nombre: "Diego Herrera", telefono: "+54 9 341 703-6611", email: "diego.herr@mail.com", dni: "30998877", interes: "Onix", origen: "Referido", vendedor: authUser?.name || "", proximo: "", estado: "Caliente", notas: "Lo mando su hermano que compro en noviembre" },
      { id: "sc3-6", nombre: "Florencia Castillo", telefono: "+54 9 11 5803-4422", email: "flor.castillo@mail.com", dni: "38334455", interes: "Territory", origen: "Web", vendedor: authUser?.name || "", proximo: "", estado: "Seguimiento", notas: "Consulto por territorio, espera financiacion" }
    ];
    const existingVIds = new Set((merged.vehicles || []).map(v => v.id));
    const existingCIds = new Set((merged.clients || []).map(c => c.id));
    seedVehicles.filter(v => !existingVIds.has(v.id)).forEach(v => (merged.vehicles = merged.vehicles || []).push(v));
    seedClients.filter(c => !existingCIds.has(c.id)).forEach(c => (merged.clients = merged.clients || []).push(c));
    merged.settings.coreSeedV3 = true;
  }
  if (!merged.settings.coreSeedV4) {
    const now = "2026-07-23";
    const adds = {
      vehicles: [
        { id: "sv4-1", condicion: "0km", dominio: "AF112KR", marca: "Toyota", modelo: "Yaris", version: "XLS CVT", anio: 2026, km: 0, precio: 21500000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Concesionaria", margen: 900000, notas: "0km, color blanco perla, sin uso" },
        { id: "sv4-2", condicion: "Usado", dominio: "AG885TL", marca: "Renault", modelo: "Duster", version: "Intens 1.6 4x2", anio: 2022, km: 44000, precio: 31000000, moneda: "ARS", estado: "Disponible", ubicacion: "Salon", origen: "Usados", margen: 1500000, notas: "Muy buen estado general",
          numeroMotor: "K4M-8854331", numeroChasis: "VF1HSRC0B56544872", numeroVin: "VF1HSRC0B56544872",
          coincideDocumentacion: "Si", improntasTomadas: "Si",
          estadoChapa: "Bueno", detalleChapa: "Tope de puerta leve en puerta trasera izquierda",
          danosEstructurales: "No", detalleDanosEstructurales: "", modificacionesNoAutorizadas: "No",
          nivelCombustible: "1/2", cubiertaDelIzq: "Buena", cubiertaDelDer: "Buena", cubiertaTraIzq: "Regular", cubiertaTraDer: "Regular",
          auxilio: "Si", cantidadLlaves: 2, estadoMecanico: "Motor y caja sin novedades. Frenos OK. Suspension original.",
          reporteRobo: "Sin registro", embargoPrenda: "Sin registro", siniestrosAnteriores: "Sin registro", limitacionesPropiedad: "Sin registro",
          documentacion: "Completa", vtvVigente: "Si", seguroVigente: "Si", matafuego: "Si", balizas: "Si", llaveRuedaGato: "Si",
          notas: "Un solo dueno desde 0km. Documentacion al dia." }
      ],
      clients: [
        { id: "sc4-1", nombre: "Maria Alvarez", telefono: "+54 9 11 5901-2200", email: "malvarez@mail.com", dni: "27334455", interes: "Yaris 0km", origen: "Instagram", vendedor: authUser?.name||"Gastoonfloori", proximo: "2026-07-25", estado: "Caliente", notas: "Presupuesto hasta 22M. Quiere color claro." },
        { id: "sc4-2", nombre: "Pablo Gimenez", telefono: "+54 9 341 803-7711", email: "pablo.gim@mail.com", dni: "31556677", interes: "Duster 4x4", origen: "MercadoLibre", vendedor: authUser?.name||"Gastoonfloori", proximo: "2026-07-28", estado: "Nuevo", notas: "Consulta por Duster. Vive en zona rural." },
        { id: "sc4-3", nombre: "Silvana Morales", telefono: "+54 9 11 6103-5588", email: "smorales@mail.com", dni: "34778899", interes: "SUV familiar", origen: "Referido", vendedor: authUser?.name||"Gastoonfloori", proximo: "2026-07-30", estado: "Seguimiento", notas: "La refirió Lucas Fernandez. Familia con 2 hijos." }
      ],
      consignments: [
        { id: "cs4-1", titular: "Juan Benitez", telefono: "+54 11 5555 3344", marca: "Honda", modelo: "Civic", version: "EXL CVT", dominio: "AC771XY", anio: 2021, km: 38000, precioPretendido: 29000000, comision: 1200000, estado: "Activa", vence: "2026-08-31",
          numeroMotor: "R18A-7734521", numeroChasis: "2HGFC1F37MH543210", numeroVin: "2HGFC1F37MH543210", coincideDocumentacion: "Si", improntasTomadas: "Si",
          estadoChapa: "Bueno", detalleChapa: "Leve rayado en aleta trasera derecha", danosEstructurales: "No", detalleDanosEstructurales: "", modificacionesNoAutorizadas: "No",
          nivelCombustible: "1/2", cubiertaDelIzq: "Buena", cubiertaDelDer: "Buena", cubiertaTraIzq: "Regular", cubiertaTraDer: "Regular",
          auxilio: "Si", cantidadLlaves: 2, estadoMecanico: "Motor y caja excelente. Frenos al 80%. Suspension sin novedades.",
          reporteRobo: "Sin registro", embargoPrenda: "Sin registro", siniestrosAnteriores: "Sin registro", limitacionesPropiedad: "Sin registro",
          documentacion: "Completa", vtvVigente: "Si", seguroVigente: "Si", matafuego: "Si", balizas: "Si", llaveRuedaGato: "Si",
          notas: "Unico dueno desde 0km. Excelente conservacion." }
      ],
      sales: [
        { id: "sa4-1", cliente: "Maria Alvarez", clienteId: "sc4-1", vehiculo: "Toyota Yaris XLS CVT", vehiculoId: "sv4-1", etapa: "Contacto", monto: 21500000, moneda: "ARS", sena: 0, formaPago: "Contado", vendedor: authUser?.name||"Gastoonfloori", proximo: "Enviar cotizacion", estado: "Contacto", notas: "" }
      ],
      calendar: [
        { id: "cal4-1", fecha: "2026-07-25", hora: "10:00", tipo: "Test drive", titulo: "Test drive Yaris con Maria", cliente: "Maria Alvarez", vehiculo: "Toyota Yaris XLS CVT", vendedor: authUser?.name||"Gastoonfloori", estado: "Programado", notas: "" },
        { id: "cal4-2", fecha: "2026-07-28", hora: "15:30", tipo: "Entrega", titulo: "Entrega Duster Pablo Gimenez", cliente: "Pablo Gimenez", vehiculo: "Renault Duster Intens", vendedor: authUser?.name||"Gastoonfloori", estado: "Confirmado", notas: "Llevar documentacion completa" },
        { id: "cal4-3", fecha: "2026-07-30", hora: "09:00", tipo: "Llamado", titulo: "Seguimiento Silvana Morales", cliente: "Silvana Morales", vehiculo: "", vendedor: authUser?.name||"Gastoonfloori", estado: "Programado", notas: "Consultar si decidio con financiacion" }
      ],
      treasury: [
        { id: "tv4-1", cuenta: "Caja principal", tipo: "Ingreso", concepto: "Sena Toyota Yaris — Maria Alvarez", cliente: "Maria Alvarez", clienteId: "sc4-1", vehiculo: "Toyota Yaris XLS CVT", monto: 500000, moneda: "ARS", fecha: now, medio: "Transferencia", estado: "Confirmado", notas: "" },
        { id: "tv4-2", cuenta: "Caja principal", tipo: "Egreso", concepto: "Gastos de preparacion Duster", cliente: "", vehiculo: "Renault Duster Intens", monto: 85000, moneda: "ARS", fecha: now, medio: "Efectivo", estado: "Confirmado", notas: "" },
        { id: "tv4-3", cuenta: "Caja principal", tipo: "Ingreso", concepto: "Comision consignacion Civic", cliente: "Juan Benitez", vehiculo: "Honda Civic EXL CVT", monto: 1200000, moneda: "ARS", fecha: now, medio: "Transferencia", estado: "Pendiente", notas: "" }
      ],
      finance: [
        { id: "fn4-1", concepto: "Venta Toyota Yaris — precio total", tipo: "Ingreso", categoria: "Venta", cliente: "Maria Alvarez", clienteId: "sc4-1", vehiculo: "Toyota Yaris XLS CVT", monto: 21500000, moneda: "ARS", fecha: now, medio: "Transferencia", estado: "Pendiente", notas: "" },
        { id: "fn4-2", concepto: "Costo adquisicion Renault Duster", tipo: "Egreso", categoria: "Compra", cliente: "", vehiculo: "Renault Duster Intens", monto: 29500000, moneda: "ARS", fecha: now, medio: "Transferencia", estado: "Confirmado", notas: "" }
      ],
      paperwork: [
        { id: "pw4-1", tramite: "Transferencia", cliente: "Maria Alvarez", clienteId: "sc4-1", vehiculo: "Toyota Yaris XLS CVT", vehiculoId: "sv4-1", dominio: "AF112KR", gestor: "Gestoria Central", vence: "2026-08-20", costo: 150000, estado: "Pendiente", notas: "Esperar firma del comprador" }
      ],
      alerts: [
        { id: "al4-1", titulo: "VTV vence esta semana — Duster", tipo: "Vencimiento", prioridad: "Alta", area: "Stock", cliente: "", vehiculo: "Renault Duster Intens", vence: "2026-07-26", responsable: authUser?.name||"Gastoonfloori", estado: "Pendiente", detalle: "Renovar VTV antes de la entrega" },
        { id: "al4-2", titulo: "Sena pendiente — Maria Alvarez", tipo: "Cobro", prioridad: "Alta", area: "Finanzas", cliente: "Maria Alvarez", vehiculo: "Toyota Yaris", vence: "2026-07-25", responsable: authUser?.name||"Gastoonfloori", estado: "Pendiente", detalle: "Confirmar recepcion de sena" }
      ],
      quotes: [
        { id: "co4-1", cliente: "Maria Alvarez", clienteId: "sc4-1", vehiculo: "Toyota Yaris XLS CVT", vehiculoId: "sv4-1", monto: 21500000, moneda: "ARS", estado: "Activo", fecha: now, validez: "2026-07-31", notas: "Con financiacion disponible" },
        { id: "co4-2", cliente: "Pablo Gimenez", vehiculo: "Renault Duster Intens 1.6", monto: 31000000, moneda: "ARS", estado: "Activo", fecha: now, validez: "2026-07-30", notas: "Precio lista, sin descuento" }
      ]
    };
    Object.entries(adds).forEach(([key, rows]) => {
      merged[key] = merged[key] || [];
      const existingIds = new Set(merged[key].map(r => r.id));
      rows.filter(r => !existingIds.has(r.id)).forEach(r => merged[key].push(r));
    });
    merged.settings.coreSeedV4 = true;
  }
  if (!merged.settings.brandingV1) {
    if (!merged.settings.businessName || /^Sote Auto$/i.test(merged.settings.businessName)) {
      merged.settings.businessName = "Lake Motors";
    }
    merged.settings.brandingV1 = true;
  }
  return merged;
}

function enrichRow(key, fields = [], row = {}) {
  const enriched = { ...row };
  fields.forEach(([name, , type = "text"]) => {
    if (enriched[name] === undefined) enriched[name] = defaultFieldValue(name, type, key);
  });
  return enriched;
}

function defaultFieldValue(name, type, key) {
  if (type === "number") return 0;
  if (type === "date") return "";
  if (name === "moneda") return "ARS";
  if (name === "estado") return statusOptions(key)[0] || "Pendiente";
  if (/vendedor|responsable|gestor|autor|solicitante/i.test(name)) return authUser?.name || "";
  return "";
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
  const logo = logoMarkup("login-logo");
  return `
    <main class="login-page">
      <section class="login-card">
        <div class="login-head">
          ${logo}
          <div class="eyebrow">CRM Autos</div>
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
  const logo = logoMarkup("brand-logo");
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          ${logo}
          <div><strong>${escapeHtml(state.settings?.businessName || "Lake Motors")}</strong><span>Agencia automotor</span></div>
        </div>
        <nav class="nav">
          ${modules.map(m => `<button class="${m.id === currentModule ? "active" : ""}" data-module="${m.id}" title="${m.label}"><span class="ico">${m.icon}</span><span class="label">${m.label}</span></button>`).join("")}
        </nav>
      </aside>
      <section class="content">
        <header class="topbar">
          <div>
            <h1>${active.label}</h1>
            <p>${active.subtitle}</p>
          </div>
          <div class="top-actions">
            <input class="search" data-action="search" value="${escapeHtml(query)}" placeholder="Buscar en este modulo">
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
  if (currentModule === "calendario") return calendarPage();
  if (currentModule === "ventas") return salesPage();
  if (currentModule === "whatsapp") return whatsappPage();
  if (currentModule === "config" || currentModule === "configuracion") return configPage();
  if (currentModule === "clientes" && clientProfileId) return clientProfilePage(clientProfileId);
  if (currentModule === "finanzas") return finanzasPage();
  if (currentModule === "expedientetecnico") return expedienteTecnicoPage();
  return genericSectionPage(currentModule);
}

function finanzasPage() {
  const pipelineEtapas = ["Contacto", "Tasacion", "Reserva"];
  const pipelineSales = (state.sales || []).filter(s => pipelineEtapas.includes(s.etapa));
  const proyectado = pipelineSales.reduce((sum, s) => sum + Number(s.monto || 0), 0);
  const byEtapa = pipelineEtapas.map(etapa => ({
    etapa,
    ventas: pipelineSales.filter(s => s.etapa === etapa),
    monto: pipelineSales.filter(s => s.etapa === etapa).reduce((a, s) => a + Number(s.monto || 0), 0)
  }));
  const pipelineSection = `
    <section class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>Pipeline de ventas en curso</h2>
        <span class="pill info">${pipelineSales.length} operaciones · Proyectado: ${money(proyectado)}</span>
      </div>
      <div class="card-body">
        <p class="muted" style="margin-bottom:12px;font-size:12px">Ingresos proyectados de ventas en etapa Contacto, Tasacion y Reserva. No incluye Cierre (ya confirmados).</p>
        <div class="grid stats" style="margin-bottom:16px">
          ${byEtapa.map(({ etapa, ventas, monto }) => stat(etapa, money(monto), `${ventas.length} venta${ventas.length !== 1 ? "s" : ""}`)).join("")}
        </div>
        ${pipelineSales.length ? `<div style="overflow:auto"><table>
          <thead><tr><th>Cliente</th><th>Vehiculo</th><th>Etapa</th><th>Monto</th><th>Vendedor</th></tr></thead>
          <tbody>${pipelineSales.map(s => `<tr>
            <td>${escapeHtml(s.cliente)}</td>
            <td>${escapeHtml(s.vehiculo)}</td>
            <td>${pill(s.etapa)}</td>
            <td>${money(s.monto)}</td>
            <td>${escapeHtml(s.vendedor || "")}</td>
          </tr>`).join("")}</tbody>
        </table></div>` : `<p class="muted">No hay ventas en curso en el pipeline.</p>`}
      </div>
    </section>`;
  return genericSectionPage("finanzas") + pipelineSection;
}

function vtvPill(vtvVence) {
  if (!vtvVence) return `<span class="pill ok">Sin fecha</span>`;
  const today = new Date(todayKey() + "T00:00:00");
  const vence = new Date(vtvVence + "T00:00:00");
  const diff = Math.floor((vence - today) / 86400000);
  if (diff < 0) return `<span class="pill crit">Vencida</span>`;
  if (diff <= 30) return `<span class="pill warn">Vence en ${diff}d</span>`;
  return `<span class="pill ok">Vigente</span>`;
}

function expedienteTecnicoPage() {
  const expVehiculos = (state.files || []).filter(f => f.tipo === "Vehiculo");
  const vehiculosConExp = new Set(expVehiculos.map(f => f.vehiculoId).filter(Boolean));
  const vehiculosSinExp = (state.vehicles || []).filter(v => !vehiculosConExp.has(v.id));

  const rows = expVehiculos.map(f => {
    const veh = (state.vehicles || []).find(v => v.id === f.vehiculoId) || {};
    const ultimaEntrada = (f.historial || []).slice(-1)[0];
    return { f, veh, ultimaEntrada };
  });

  const newExpSelector = vehiculosSinExp.length
    ? `<select id="et-new-vehiculo" style="min-width:200px">
        <option value="">— Elegí un vehículo —</option>
        ${vehiculosSinExp.map(v => {
          const nombre = `${v.marca || ""} ${v.modelo || ""}${v.version ? " " + v.version : ""}`.trim();
          return `<option value="${escapeHtml(v.id)}" data-ref="${escapeHtml(nombre)}">${escapeHtml(nombre)}${v.dominio ? " (" + v.dominio + ")" : ""}</option>`;
        }).join("")}
      </select>
      <button class="btn" id="et-new-btn">+ Nuevo expediente</button>`
    : `<span class="muted" style="font-size:13px">Todos los vehiculos tienen expediente.</span>`;

  return `
    <div class="grid stats module-stats">
      ${stat("Expedientes", expVehiculos.length, "Vehiculos con ficha tecnica")}
      ${stat("Sin expediente", vehiculosSinExp.length, "Vehiculos sin ficha")}
      ${stat("VTV por vencer", expVehiculos.filter(f => { if (!f.vtvVence) return false; const d = Math.floor((new Date(f.vtvVence + "T00:00:00") - new Date(todayKey() + "T00:00:00")) / 86400000); return d >= 0 && d <= 30; }).length, "Vencen en ≤ 30 dias")}
      ${stat("Seguro vigente", expVehiculos.filter(f => f.seguroVigente === "Vigente").length, "Con seguro activo")}
    </div>
    <section class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>Expedientes tecnicos</h2>
        <div style="display:flex;gap:8px;align-items:center">${newExpSelector}</div>
      </div>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>Vehiculo</th><th>Seguro</th><th>VTV vence</th><th>Ultima entrada</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(({ f, veh, ultimaEntrada }) => {
              const nombre = veh.id
                ? `${veh.marca || ""} ${veh.modelo || ""}${veh.version ? " " + veh.version : ""}`.trim()
                : escapeHtml(f.vehiculoRef || "—");
              const dominio = veh.dominio ? ` (${veh.dominio})` : "";
              return `<tr>
                <td><strong>${escapeHtml(nombre)}</strong>${escapeHtml(dominio)}</td>
                <td>${pill(f.seguroVigente || "Sin seguro")}</td>
                <td>${vtvPill(f.vtvVence)}${f.vtvVence ? ` <small class="muted">${escapeHtml(f.vtvVence)}</small>` : ""}</td>
                <td>${ultimaEntrada ? `<small class="muted">${escapeHtml(ultimaEntrada.fecha || "")}</small> ${escapeHtml((ultimaEntrada.notas || "").slice(0, 40)).replace(/\n/g, " ")}${(ultimaEntrada.notas || "").length > 40 ? "..." : ""}` : `<span class="muted">Sin entradas</span>`}</td>
                <td><button class="btn ghost" data-et-open="${escapeHtml(f.id)}">Ver / Editar</button></td>
              </tr>`;
            }).join("") : `<tr><td colspan="5" class="empty">No hay expedientes tecnicos cargados.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function dashboard() {
  const ingresos = state.finance.filter(x => x.tipo === "Ingreso").reduce((a, x) => a + Number(x.monto), 0);
  const egresos = state.finance.filter(x => x.tipo === "Egreso").reduce((a, x) => a + Number(x.monto), 0);
  return `
    <div class="grid stats">
      ${stat("Unidades en stock", state.vehicles.length, "Inventario activo")}
      ${stat("Leads activos", state.clients.length, "Consultas y compradores")}
      ${stat("Agenda hoy", calendarForDay(todayKey()).length, "Test drives y tareas")}
      ${stat("Pipeline", money(state.sales.filter(x => x.etapa !== "Cierre" && x.etapa !== "Perdida").reduce((a, x) => a + Number(x.monto), 0)), "Oportunidades abiertas")}
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
      <section class="card">
        <div class="card-head"><h2>Proxima agenda</h2><button class="btn" data-module="calendario">Abrir calendario</button></div>
        <div class="card-body timeline">
          ${upcomingCalendar(5).map(event => `<div class="event"><time>${escapeHtml(event.fecha)} ${escapeHtml(event.hora)}</time><div><strong>${escapeHtml(event.titulo)}</strong><br><span class="muted">${escapeHtml(event.cliente)} - ${escapeHtml(event.vehiculo)}</span></div></div>`).join("") || `<div class="empty">Sin eventos proximos.</div>`}
        </div>
      </section>
    </div>
    <div style="margin-top:16px">${tablePage("vehicles", "Stock destacado", vehicleColumns(), true)}</div>
  `;
}

function stat(label, value, note) {
  return `<section class="card stat"><span>${label}</span><strong>${value}</strong><small>${note}</small></section>`;
}

function tablePage(key, title, columns, embedded = false, moduleId = "", rowsOverride = null) {
  const rows = filtered(rowsOverride !== null ? rowsOverride : (state[key] || []));
  const flows = flowsForModule(moduleId);
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
            ${rows.length ? rows.map(row => `<tr${key === "clients" ? ` data-client-row="${escapeHtml(row.id)}" class="clickable-row"` : key === "vehicles" ? ` data-vehicle-row="${escapeHtml(row.id)}" class="clickable-row"` : key === "quotes" ? ` data-quote-row="${escapeHtml(row.id)}" class="clickable-row"` : key === "consignments" ? ` data-consign-row="${escapeHtml(row.id)}" class="clickable-row"` : row._montoEditado ? ` style="border-left:3px solid var(--crit)"` : ""}>${columns.map(c => `<td>${c.render ? c.render(row[c.key], row) : escapeHtml(row[c.key] ?? "")}</td>`).join("")}<td class="record-actions">${flows.map(([flow, label]) => `<button class="icon-btn" data-module-flow="${flow}:${key}:${row.id}" title="${escapeHtml(label)}">${escapeHtml(label.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase())}</button>`).join("")}${moduleId === "cotizaciones" ? `<button class="icon-btn" data-quote-pdf="${escapeHtml(row.id)}" title="Descargar PDF" style="font-weight:700;color:var(--accent)">PDF</button>` : ""}${moduleId === "stock" && (row.numeroMotor || row.estadoChapa || row.reporteRobo || row.numeroVin) ? `<button class="icon-btn" data-vehicle-peritaje="${escapeHtml(row.id)}" title="Informe peritaje" style="font-weight:700;color:var(--accent)">PDF</button>` : ""}${moduleId === "consignaciones" ? `<button class="icon-btn" data-peritaje-pdf="${escapeHtml(row.id)}" title="Descargar informe peritaje" style="font-weight:700;color:var(--accent)">PDF</button><button class="icon-btn" data-consign-exp="${escapeHtml(row.id)}" title="Expediente tecnico">ET</button>` : ""}${key === "files" && row.tipo === "Vehiculo" ? `<button class="icon-btn" data-file-exp="${escapeHtml(row.id)}" title="Ver expediente">ET</button>` : ""}<button class="icon-btn" data-edit="${key}:${row.id}" title="Editar">E</button><button class="icon-btn" data-delete="${key}:${row.id}" title="Eliminar">X</button></td></tr>`).join("") : `<tr><td colspan="${columns.length + 1}" class="empty">No hay registros para mostrar.</td></tr>`}
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
  const cols = def?.columns
    || (def?.fields || []).filter(([,, t]) => t !== "textarea").slice(0, 6).map(([k, l]) => [k, l]);
  return cols.map(([key, label]) => ({
    key,
    label,
    render: value => /monto|precio|comision|costo|presupuesto/i.test(key) ? money(value) : (/estado|prioridad|tipo/i.test(key) ? pill(value) : escapeHtml(value))
  }));
}

function consignacionColumns() {
  return [
    { key: "fotos", label: "", render: (fotos) => fotos?.length ? `<img class="row-thumb" src="${escapeHtml(fotos[0])}" alt="foto">` : `<div class="row-thumb-placeholder"></div>` },
    { key: "_vehiculo", label: "Vehiculo", render: (_, r) => {
      const marca = r.marca || "";
      const modelo = r.modelo || "";
      const version = r.version || "";
      const nombre = [marca, modelo, version].filter(Boolean).join(" ") || r.vehiculo || "—";
      return `<strong>${escapeHtml(nombre)}</strong>${r.dominio ? `<br><span class="muted">${escapeHtml(r.dominio)}</span>` : ""}`;
    }},
    { key: "titular", label: "Titular", render: v => escapeHtml(v || "—") },
    { key: "precioPretendido", label: "Precio pretendido", render: v => money(v) },
    { key: "comision", label: "Comision", render: v => money(v) },
    { key: "vence", label: "Vence", render: v => escapeHtml(v || "—") },
    { key: "estado", label: "Estado", render: v => pill(v) },
  ];
}

function clientListColumns() {
  return [
    ...genericColumns("clientes"),
    {
      key: "cuentaCorriente",
      label: "Cta. Corriente",
      render: (_, r) => {
        const { saldoPendiente, rows } = getClientAccountMovements(r);
        if (!rows.length) return `<span class="pill">Sin deudas</span>`;
        return saldoPendiente > 0
          ? `<span class="pill crit">Debe</span>`
          : `<span class="pill ok">Al dia</span>`;
      }
    }
  ];
}

function genericSectionPage(moduleId) {
  const def = sectionData[moduleId];
  if (!def) {
    return '<section class="card"><div class="card-head"><h2>Modulo en preparacion</h2></div><div class="card-body"><p class="muted">Esta seccion esta lista para conectarse.</p></div></section>';
  }
  const allRows = state[def.key] || [];
  const activeRows = moduleId === "stock"
    ? allRows.filter(v => !/^Vendido$/i.test(v.estado || ""))
    : allRows;
  const rows = filtered(activeRows);
  const moneyTotal = totalForRows(activeRows);
  const cols = moduleId === "stock" ? vehicleColumns() : moduleId === "consignaciones" ? consignacionColumns() : moduleId === "clientes" ? clientListColumns() : genericColumns(moduleId);
  return `
    <div class="grid stats module-stats">
      ${stat("Registros", activeRows.length, "Vehiculos en stock")}
      ${stat("Visibles", rows.length, query ? "Resultado filtrado" : "Sin filtro activo")}
      ${stat("Pendientes", pendingRows(activeRows), "Requieren seguimiento")}
      ${stat("Monto", moneyTotal ? money(moneyTotal) : "-", "Valores asociados")}
    </div>
    <div style="margin-top:16px">
      ${tablePage(def.key, def.title, cols, false, moduleId, moduleId === "stock" ? activeRows : null)}
    </div>
    ${moduleId === "stock" ? stockHistorial() : ""}
  `;
}

function stockHistorial() {
  const soldVehicles = (state.vehicles || []).filter(v => /^Vendido$/i.test(v.estado || ""));
  if (!soldVehicles.length) return "";
  const rows = soldVehicles.map(v => {
    const nombre = `${v.marca || ""} ${v.modelo || ""}${v.version ? " " + v.version : ""}`.trim();
    const sale = (state.sales || []).find(s =>
      (s.vehiculoId && s.vehiculoId === v.id) ||
      (!s.vehiculoId && s.vehiculo && s.vehiculo.toLowerCase().trim() === nombre.toLowerCase())
    );
    const thumb = v.fotos?.length
      ? `<img class="row-thumb" src="${escapeHtml(v.fotos[0])}" alt="foto">`
      : `<div class="row-thumb-placeholder"></div>`;
    const precio = sale ? money(sale.monto || v.precio) : money(v.precio);
    const cliente = sale ? escapeHtml(sale.cliente || "—") : "—";
    let fecha = "—";
    if (sale?.fecha) {
      try { fecha = new Date(sale.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch (_) {}
    }
    const formaPago = sale?.formaPago ? `<span class="pill info">${escapeHtml(sale.formaPago)}</span>` : `<span class="muted">—</span>`;
    const vendedor = sale ? escapeHtml(sale.vendedor || "—") : "—";
    return `<tr data-vehicle-row="${escapeHtml(v.id)}" style="cursor:pointer">
      <td style="width:60px">${thumb}</td>
      <td><strong>${escapeHtml(nombre)}</strong>${v.dominio ? `<br><span class="muted">${escapeHtml(v.dominio)}</span>` : ""}</td>
      <td><span class="muted">${escapeHtml(String(v.anio || "—"))} · ${Number(v.km || 0).toLocaleString("es-AR")} km</span></td>
      <td>${precio}</td>
      <td>${cliente}</td>
      <td>${fecha}</td>
      <td>${formaPago}</td>
      <td>${vendedor}</td>
      <td><span class="pill crit">Vendido</span></td>
    </tr>`;
  }).join("");
  return `
    <section class="card" style="margin-top:24px">
      <div class="card-head">
        <h2>Historial de vehiculos</h2>
        <span class="badge muted">${soldVehicles.length} vendido${soldVehicles.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
          <table>
            <thead><tr>
              <th></th><th>Vehiculo</th><th>Año / KM</th><th>Precio</th>
              <th>Cliente</th><th>Fecha</th><th>Forma de pago</th><th>Vendedor</th><th>Estado</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

// ── Matching helpers ──────────────────────────────────────────────────────────
function clientMatchesRecord(r, client) {
  if (client.id && r.clienteId) return r.clienteId === client.id;
  const rName = (r.cliente || r.beneficiario || r.titular || "").toLowerCase().trim();
  const cName = (client.nombre || "").toLowerCase().trim();
  return cName.length > 0 && rName === cName;
}

function clientMatchesItem(item, client) {
  if (client.id && item.clienteId) return item.clienteId === client.id;
  const iName = (item.cliente || "").toLowerCase().trim();
  const cName = (client.nombre || "").toLowerCase().trim();
  return cName.length > 0 && iName === cName;
}

function clientRelated(key, client) {
  return (state[key] || []).filter(r => clientMatchesRecord(r, client));
}

// ── Client Profile ────────────────────────────────────────────────────────────
function profileMiniTable(rows, cols, emptyMsg = "Sin registros.") {
  if (!rows.length) return `<p class="muted">${escapeHtml(emptyMsg)}</p>`;
  return `<div style="overflow:auto"><table><thead><tr>${cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${cols.map(c => `<td>${c.render ? c.render(row[c.key], row) : escapeHtml(row[c.key] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function clientProfilePage(clientId) {
  const client = (state.clients || []).find(c => c.id === clientId);
  if (!client) { clientProfileId = null; return genericSectionPage("clientes"); }
  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "cuenta", label: "Cuenta corriente" },
    { id: "cuotas", label: "Cuotas pendientes" },
    { id: "compras", label: "Compras" },
    { id: "documentos", label: "Documentos" },
    { id: "agenda", label: "Agenda" }
  ];
  return `
    <div class="profile-back">
      <button class="btn ghost" data-back-profile>← Volver a Clientes</button>
    </div>
    <section class="card profile-header">
      <div class="profile-identity">
        <div class="profile-avatar">${escapeHtml((client.nombre || "?").slice(0, 2).toUpperCase())}</div>
        <div class="profile-info">
          <h1>${escapeHtml(client.nombre)}</h1>
          <div class="profile-meta">
            ${client.telefono ? `<span>${escapeHtml(client.telefono)}</span>` : ""}
            ${client.email ? `<span>${escapeHtml(client.email)}</span>` : ""}
            ${client.origen ? `<span>Origen: ${escapeHtml(client.origen)}</span>` : ""}
            ${client.vendedor ? `<span>Vendedor: ${escapeHtml(client.vendedor)}</span>` : ""}
          </div>
          <div class="profile-pills">
            ${pill(client.estado || "Nuevo")}
            ${client.interes ? `<span class="pill info">Interes: ${escapeHtml(client.interes)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="profile-actions">
        <button class="btn" data-quick-action="edit-client:${escapeHtml(client.id)}">Editar cliente</button>
        <button class="btn ghost" data-quick-action="new-sale:${escapeHtml(client.id)}">Nueva venta</button>
        <button class="btn ghost" data-quick-action="new-quote:${escapeHtml(client.id)}">Nueva cotizacion</button>
        <button class="btn ghost" data-quick-action="new-calendar:${escapeHtml(client.id)}">Agendar</button>
        <button class="btn ghost" data-quick-action="new-message:${escapeHtml(client.id)}">Mensaje</button>
      </div>
    </section>
    <div class="profile-tabs">
      <div class="segmented profile-tab-nav">
        ${tabs.map(t => `<button class="${clientProfileTab === t.id ? "active" : ""}" data-profile-tab="${t.id}">${t.label}</button>`).join("")}
      </div>
      <div class="profile-tab-content">
        ${clientProfileTab === "resumen"    ? clientProfileResumen(client)           : ""}
        ${clientProfileTab === "cuenta"     ? clientProfileCuenta(client)            : ""}
        ${clientProfileTab === "cuotas"     ? clientProfileCuotasPendientes(client)  : ""}
        ${clientProfileTab === "compras"    ? clientProfileCompras(client)           : ""}
        ${clientProfileTab === "documentos" ? clientProfileDocumentos(client)        : ""}
        ${clientProfileTab === "agenda"     ? clientProfileAgenda(client)            : ""}
      </div>
    </div>
  `;
}

function clientProfileResumen(client) {
  const sales = clientRelated("sales", client);
  const quotes = clientRelated("quotes", client);
  const agendaItems = aggregatedAgendaItems().filter(e => clientMatchesItem(e, client));
  const upcoming = agendaItems.filter(e => e.fecha >= todayKey() && !/Cancelado/i.test(e.estado)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const totalVentas = sales.reduce((s, r) => s + Number(r.monto || 0), 0);
  const lastSale = sales[0];
  return `
    <div class="grid stats" style="margin:0 0 16px">
      ${stat("Ventas", sales.length, "Operaciones registradas")}
      ${stat("Pipeline", money(totalVentas), "Monto acumulado")}
      ${stat("Cotizaciones", quotes.length, "Presupuestos enviados")}
      ${stat("Agenda", upcoming.length, "Compromisos pendientes")}
    </div>
    <div class="grid two-col">
      <section class="card profile-section">
        <div class="card-head"><h2>Ultima operacion</h2></div>
        <div class="card-body">
          ${lastSale ? detailList(lastSale, [["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["vendedor", "Vendedor"], ["proximo", "Proximo paso"]]) : `<p class="muted">Sin ventas registradas todavia.</p>`}
        </div>
      </section>
      <section class="card profile-section">
        <div class="card-head"><h2>Proximos compromisos</h2></div>
        <div class="card-body timeline">
          ${upcoming.slice(0, 5).map(e => `<div class="event"><time>${escapeHtml(e.fecha)}${e.hora ? " " + escapeHtml(e.hora) : ""}</time><div><strong>${escapeHtml(e.titulo)}</strong><span class="pill info">${escapeHtml(e.tipo)}</span></div></div>`).join("") || `<p class="muted">Sin eventos proximos.</p>`}
        </div>
      </section>
    </div>
    ${client.notas ? `<section class="card profile-section" style="margin-top:16px"><div class="card-head"><h2>Notas</h2></div><div class="card-body"><p>${escapeHtml(client.notas)}</p></div></section>` : ""}
  `;
}

function matchesClienteRecord(record, client) {
  const cId = client.id || "";
  if (!cId) return false;
  if (record.clienteId) return record.clienteId === cId;
  const cName = (client.nombre || "").toLowerCase().trim();
  const rName = (record.cliente || "").toLowerCase().trim();
  return cName.length > 0 && rName === cName;
}

function getClientAccountMovements(client) {
  const financeRows = (state.finance || []).filter(r => matchesClienteRecord(r, client)).map(r => ({ fecha: r.fecha || "", concepto: r.concepto || "", tipo: r.tipo || "Ingreso", monto: Number(r.monto || 0), origen: "Finanzas", estado: r.estado || "", _source: "finance", _sourceId: r.id, _montoEditado: false }));
  const treasuryRows = (state.treasury || []).filter(r => matchesClienteRecord(r, client)).map(r => ({ fecha: r.fecha || "", concepto: r.concepto || "", tipo: r.tipo || "Ingreso", monto: Number(r.monto || 0), origen: "Tesoreria", estado: r.estado || "", _source: "treasury", _sourceId: r.id, _montoEditado: r._montoEditado || false, _montoOriginal: r._montoOriginal, _montoEditadoPor: r._montoEditadoPor }));
  const collectionRows = (state.collections || []).filter(r => matchesClienteRecord(r, client)).map(r => ({ fecha: r.vence || "", concepto: r.concepto || "Cobro", tipo: "Cobro pendiente", monto: Number(r.monto || 0), origen: "Cobros", estado: r.estado || "", _source: "collections", _sourceId: r.id, _montoEditado: false }));
  const rows = [...financeRows, ...treasuryRows, ...collectionRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const totalAdeudado = rows.filter(r => /Cargo/i.test(r.tipo)).reduce((s, r) => s + r.monto, 0);
  const totalPagado = rows.filter(r => /Ingreso/i.test(r.tipo)).reduce((s, r) => s + r.monto, 0);
  const saldoPendiente = totalAdeudado - totalPagado;
  return { rows, totalAdeudado, totalPagado, saldoPendiente };
}

function clientProfileCuenta(client) {
  const cId = client.id || "";
  const today = todayKey();
  const { rows: all, totalAdeudado, totalPagado, saldoPendiente } = getClientAccountMovements(client);
  const emptyState = `<div class="card-body"><p class="muted">Sin movimientos registrados para este cliente.</p></div>`;
  let balance = 0;
  const rows = all.map(r => {
    balance += /Ingreso/i.test(r.tipo) ? r.monto : /Egreso|Cargo/i.test(r.tipo) ? -r.monto : 0;
    return { ...r, balance };
  });
  const headerMetrics = totalAdeudado > 0 ? `
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Total adeudado</div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">${money(totalAdeudado)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Total pagado</div>
        <div style="font-size:15px;font-weight:700;color:var(--ok)">${money(totalPagado)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Saldo pendiente</div>
        <div style="font-size:15px;font-weight:700;color:${saldoPendiente > 0 ? "var(--crit)" : "var(--ok)"}">${saldoPendiente > 0 ? "-" : "+"}${money(Math.abs(saldoPendiente))}</div>
      </div>
    </div>` : "";
  return `
    <section class="card profile-section">
      <div class="card-head" style="flex-wrap:wrap;gap:12px">
        <h2>Cuenta corriente</h2>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          ${headerMetrics}
          <button class="btn ghost" data-client-statement="${escapeHtml(cId)}" title="Descargar PDF del estado de cuenta">PDF cuenta</button>
          <button class="btn" data-quick-action="client-payment:${escapeHtml(cId)}">+ Registrar pago</button>
        </div>
      </div>
      ${!all.length ? emptyState : `<div style="overflow:auto">
        <table>
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Origen</th><th>Saldo acum.</th><th></th></tr></thead>
          <tbody>
            ${rows.map((r, idx) => {
              const isVencida = r.tipo === "Cobro pendiente" && r.fecha && r.fecha < today && !/Confirmado|Pagado/i.test(r.estado);
              const tipoPill = isVencida ? `<span class="pill crit">Vencida</span>` : pill(r.tipo);
              const montoClass = /Ingreso/i.test(r.tipo) ? "cuenta-ingreso" : /Cargo|Egreso/i.test(r.tipo) ? "cuenta-egreso" : "";
              const reciboBtn = /Ingreso|Egreso/i.test(r.tipo) ? `<button class="icon-btn" data-payment-receipt="${escapeHtml(cId)}:${idx}" title="Descargar recibo">PDF</button>` : "";
              const editBtn = r._source === "treasury" && r._sourceId ? `<button class="icon-btn" data-edit="treasury:${escapeHtml(r._sourceId)}" title="Editar pago">E</button>` : "";
              const montoEditadoStyle = r._montoEditado ? ' style="color:var(--crit);font-weight:700"' : ` class="${montoClass}"`;
              const montoEditadoFlag = r._montoEditado ? ` <span class="pill crit" title="Monto editado desde ${money(r._montoOriginal)} por ${escapeHtml(r._montoEditadoPor||"—")}">!</span>` : "";
              return `<tr${r._montoEditado ? ' style="border-left:3px solid var(--crit)"' : ''}>
              <td>${escapeHtml(r.fecha)}</td>
              <td>${escapeHtml(r.concepto)}</td>
              <td>${tipoPill}</td>
              <td${montoEditadoStyle}>${money(r.monto)}${montoEditadoFlag}</td>
              <td><span class="pill info">${escapeHtml(r.origen)}</span></td>
              <td style="font-weight:700;color:${r.balance >= 0 ? "var(--ok)" : "var(--crit)"}">${r.balance >= 0 ? "+" : "-"}${money(Math.abs(r.balance))}</td>
              <td style="white-space:nowrap">${editBtn}${reciboBtn}</td>
            </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`}
    </section>
  `;
}

function generateVehiclePeritajePDF(vehicleId) {
  const vehicle = (state.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) return toast("Vehiculo no encontrado.");
  const cs = vehicle;
  const vNombre = `${cs.marca||""} ${cs.modelo||""}${cs.version?" "+cs.version:""}`.trim()||"—";
  const mockCs = { ...cs, titular: `${vNombre} — ${cs.dominio||""}`, precioPretendido: cs.precio };
  generatePeritajePDF(vehicleId, mockCs);
}

function generatePeritajePDF(consignmentId, _override = null) {
  try {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return toast("No se pudo generar el PDF. Verificá tu conexion a internet.");
  const cs = _override || (state.consignments || []).find(c => c.id === consignmentId);
  if (!cs) return toast("Consignacion no encontrada.");
  const cfg = state.settings || {};
  const agencia = cfg.businessName || publicConfig.businessName || "Lake Motors";
  const clean = (s) => (s || "").replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const safe = (v) => String(v || "—");
  const fmt = (v) => `$ ${Math.round(Number(v||0)).toLocaleString("es-AR")}`;

  const DARK=[11,17,32], BLUE=[204,17,17], LIGHT=[248,250,253], GRAY=[98,108,126], LGRAY=[210,216,226], WHITE=[255,255,255];
  const GREEN=[22,163,74], RED=[220,60,60], ORANGE=[234,88,12];

  const doc = new JsPDF({ unit:"mm", format:"a4" });
  const W=210, H=297, M=14;
  let y=0;

  // ─── HEADER ───────────────────────────────────────────────────────────────
  const hdrH=36;
  doc.setFillColor(...DARK).rect(0,0,W,hdrH,"F");
  doc.setFillColor(...BLUE).rect(0,0,W,2.5,"F");
  let logoLoaded=false;
  if (defaultLogoPdfDataUrl) { try { doc.addImage(defaultLogoPdfDataUrl,"JPEG",M,6,24,24,undefined,"FAST"); logoLoaded=true; } catch(_e){} }
  if (!logoLoaded) { doc.setFont("helvetica","bold").setFontSize(17).setTextColor(...WHITE); doc.text(agencia,M,20); }
  [cfg.phone,cfg.email,cfg.address].filter(Boolean).forEach((l,i) => {
    doc.setFont("helvetica","normal").setFontSize(7.5).setTextColor(180,195,220);
    doc.text(l,W-M,12+i*4.8,{align:"right"});
  });
  doc.setFont("helvetica","bold").setFontSize(8).setTextColor(...BLUE);
  doc.text("PERITAJE VEHICULAR", W-M, hdrH-7, {align:"right"});
  y=hdrH+10;

  // ─── TITULO ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica","bold").setFontSize(22).setTextColor(...DARK);
  doc.text("INFORME DE PERITAJE VEHICULAR", M, y); y+=3;
  doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRAY);
  doc.text(`Emitido el ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}`, M, y+5);
  y+=12;
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M,y,M+50,y);
  doc.setDrawColor(...LGRAY).setLineWidth(0.3).line(M+50,y,W-M,y);
  y+=8;

  // ─── CARD: TITULAR + VEHICULO ─────────────────────────────────────────────
  const colW=(W-2*M-6)/2;
  const tLines=[cs.titular||"—", cs.telefono&&`Tel: ${cs.telefono}`].filter(Boolean);
  const vNombre=`${cs.marca||""} ${cs.modelo||""}${cs.version?" "+cs.version:""}`.trim()||"—";
  const vLines=[vNombre, cs.dominio&&`Dominio: ${cs.dominio}`, cs.anio&&`Año: ${cs.anio}`, cs.km&&`KM: ${Number(cs.km||0).toLocaleString("es-AR")}`, cs.precioPretendido&&`Precio pretendido: ${fmt(cs.precioPretendido)}`].filter(Boolean);
  const maxLines=Math.max(tLines.length, vLines.length);
  const cH=8+maxLines*5.5+2;
  [[M, tLines,"TITULAR",...BLUE],[M+colW+6, vLines,"VEHICULO",...BLUE]].forEach(([bx,lines,ttl,...col]) => {
    doc.setFillColor(...LIGHT).roundedRect(bx,y,colW,cH,2,2,"F");
    doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(bx,y,colW,cH,2,2,"S");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]).rect(bx,y,2.5,cH,"F");
    doc.setFont("helvetica","bold").setFontSize(7).setTextColor(BLUE[0],BLUE[1],BLUE[2]); doc.text(ttl,bx+5,y+5);
    let iy=y+10.5;
    lines.forEach((l,i) => {
      doc.setFont("helvetica",i===0?"bold":"normal").setFontSize(i===0?9:8.5).setTextColor(...(i===0?DARK:GRAY));
      doc.text(l,bx+5,iy); iy+=5.5;
    });
  });
  y+=cH+8;

  // ─── helper: sección con filas clave/valor ────────────────────────────────
  const section = (title, num, pairs) => {
    if (y+12+pairs.length*6.5>268) { doc.addPage(); y=18; }
    doc.setFillColor(...DARK).roundedRect(M,y,W-2*M,8,1,1,"F");
    doc.setFont("helvetica","bold").setFontSize(8).setTextColor(...BLUE); doc.text(`${num}.`,M+4,y+5.5);
    doc.setFont("helvetica","bold").setFontSize(8).setTextColor(...WHITE); doc.text(title,M+12,y+5.5);
    y+=8;
    pairs.forEach(([lbl,val,col],i) => {
      if (y+6.5>268) { doc.addPage(); y=18; }
      if (i%2===0) doc.setFillColor(...LIGHT).rect(M,y,W-2*M,6.5,"F");
      doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRAY); doc.text(lbl,M+4,y+4.5);
      const c=col||DARK;
      doc.setFont("helvetica","bold").setFontSize(8.5).setTextColor(...c); doc.text(safe(val),W-M-4,y+4.5,{align:"right"});
      y+=6.5;
    });
    y+=6;
  };

  const stateColor = (val, ok="Si", warn="Sin registro", crit="No") => {
    if (!val || val==="Sin verificar") return GRAY;
    if (val===ok||val==="Sin registro"||val==="Completa"||val==="Excelente"||val==="Bueno"||val==="Si"||val==="Activa") return GREEN;
    if (val==="Con alerta"||val==="Con gravamen"||val==="Con antecedentes"||val==="Con limitacion"||val==="Con detalles"||val==="Vencido") return RED;
    if (val==="No"||val==="Incompleta"||val==="Regular"||val==="Cambiar") return ORANGE;
    return DARK;
  };

  // ─── 1. IDENTIFICACION ────────────────────────────────────────────────────
  section("IDENTIFICACION DEL VEHICULO", "1", [
    ["N° Motor", cs.numeroMotor],
    ["N° Chasis", cs.numeroChasis],
    ["N° VIN", cs.numeroVin],
    ["Coincide con documentacion", cs.coincideDocumentacion, stateColor(cs.coincideDocumentacion,"Si","Sin verificar","No")]
  ]);

  // ─── 2. IMPRONTAS ─────────────────────────────────────────────────────────
  section("TOMA DE IMPRONTAS", "2", [
    ["Improntas tomadas (motor/chasis/VIN)", cs.improntasTomadas, stateColor(cs.improntasTomadas,"Si")]
  ]);

  // ─── 3. REVISION FISICA ───────────────────────────────────────────────────
  section("REVISION FISICA Y ESTRUCTURAL", "3", [
    ["Estado de chapa y pintura", cs.estadoChapa, stateColor(cs.estadoChapa,"Excelente")],
    ["Detalle de chapa", cs.detalleChapa||"Sin observaciones"],
    ["Danos estructurales", cs.danosEstructurales, stateColor(cs.danosEstructurales,"No","Si","Si")],
    ["Detalle danos", cs.detalleDanosEstructurales||"Sin observaciones"],
    ["Modificaciones no autorizadas", cs.modificacionesNoAutorizadas, stateColor(cs.modificacionesNoAutorizadas,"No","Si","Si")],
    ["Nivel de combustible", cs.nivelCombustible||"—"],
    ["Cubierta Del. Izq.", cs.cubiertaDelIzq, stateColor(cs.cubiertaDelIzq,"Buena","Regular","Cambiar")],
    ["Cubierta Del. Der.", cs.cubiertaDelDer, stateColor(cs.cubiertaDelDer,"Buena","Regular","Cambiar")],
    ["Cubierta Tras. Izq.", cs.cubiertaTraIzq, stateColor(cs.cubiertaTraIzq,"Buena","Regular","Cambiar")],
    ["Cubierta Tras. Der.", cs.cubiertaTraDer, stateColor(cs.cubiertaTraDer,"Buena","Regular","Cambiar")],
    ["Rueda de auxilio", cs.auxilio, stateColor(cs.auxilio,"Si","Usada","No")],
    ["Cantidad de llaves", cs.cantidadLlaves||"—"],
    ["Estado mecanico", cs.estadoMecanico||"Sin observaciones"]
  ]);

  // ─── 4. BASES DE DATOS ────────────────────────────────────────────────────
  section("COMPARACION CON BASES DE DATOS", "4", [
    ["Reporte de robo", cs.reporteRobo, stateColor(cs.reporteRobo,"Sin registro","Sin verificar","Con alerta")],
    ["Embargo / Prenda", cs.embargoPrenda, stateColor(cs.embargoPrenda,"Sin registro","Sin verificar","Con gravamen")],
    ["Siniestros anteriores", cs.siniestrosAnteriores, stateColor(cs.siniestrosAnteriores,"Sin registro","Sin verificar","Con antecedentes")],
    ["Detalle siniestros", cs.detalleSiniestros||"Sin observaciones"],
    ["Limitaciones a la propiedad", cs.limitacionesPropiedad, stateColor(cs.limitacionesPropiedad,"Sin registro","Sin verificar","Con limitacion")]
  ]);

  // ─── 5. DOCUMENTACION ─────────────────────────────────────────────────────
  section("DOCUMENTACION Y ACCESORIOS", "5", [
    ["Documentacion (titulo/cedula)", cs.documentacion, stateColor(cs.documentacion,"Completa","Sin verificar","Incompleta")],
    ["VTV vigente", cs.vtvVigente, stateColor(cs.vtvVigente,"Si","No aplica","No")],
    ["Seguro vigente", cs.seguroVigente, stateColor(cs.seguroVigente,"Si")],
    ["Matafuego", cs.matafuego, stateColor(cs.matafuego,"Si","Vencido","No")],
    ["Balizas / triangulos", cs.balizas, stateColor(cs.balizas,"Si")],
    ["Llave de ruedas y gato", cs.llaveRuedaGato, stateColor(cs.llaveRuedaGato,"Si")]
  ]);

  // ─── NOTAS ────────────────────────────────────────────────────────────────
  if (cs.notas) {
    if (y+20>268) { doc.addPage(); y=18; }
    doc.setFont("helvetica","bold").setFontSize(7.5).setTextColor(...GRAY); doc.text("OBSERVACIONES GENERALES",M,y); y+=5;
    doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...DARK);
    const lines=doc.splitTextToSize(cs.notas, W-2*M);
    if (y+lines.length*4.5>268) { doc.addPage(); y=18; }
    doc.text(lines,M,y); y+=lines.length*4.5+8;
  }

  // ─── FOTOS ────────────────────────────────────────────────────────────────
  const fotos = (cs.fotos || []).slice(0,2);
  if (fotos.length) {
    if (y+65>268) { doc.addPage(); y=18; }
    doc.setFont("helvetica","bold").setFontSize(7.5).setTextColor(...GRAY); doc.text("FOTOS DEL VEHICULO",M,y); y+=5;
    const imgW=(W-2*M-(fotos.length-1)*5)/fotos.length;
    fotos.forEach((src,i) => {
      try { doc.addImage(src,undefined,M+i*(imgW+5),y,imgW,imgW*0.67,undefined,"FAST"); } catch(_) {}
    });
    y+=imgW*0.67+8;
  }

  // ─── PIE ──────────────────────────────────────────────────────────────────
  const footerY=H-14;
  doc.setFillColor(...DARK).rect(0,footerY-8,W,22,"F");
  doc.setFillColor(...BLUE).rect(0,footerY-8,W,1.5,"F");
  doc.setFont("helvetica","bold").setFontSize(7.5).setTextColor(...WHITE); doc.text(`${agencia}  ·  Informe de Peritaje Vehicular`,M,footerY+3);
  doc.setFont("helvetica","normal").setFontSize(7.5).setTextColor(160,185,220);
  doc.text(new Date().toLocaleDateString("es-AR"), W-M, footerY+3, {align:"right"});

  doc.save(`Peritaje-${clean(vNombre)}-${clean(cs.dominio||"")}.pdf`);
  } catch(e) { toast("No se pudo generar el PDF: "+(e.message||"error desconocido")); }
}

function generateClientStatementPDF(clientId) {
  try {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return toast("No se pudo generar el PDF.");
  const client = (state.clients || []).find(c => c.id === clientId);
  if (!client) return;
  const { rows, totalAdeudado, totalPagado, saldoPendiente } = getClientAccountMovements(client);
  const cfg = state.settings || {};
  const agencia = cfg.businessName || publicConfig.businessName || "Lake Motors";
  const clean = (s) => (s || "").replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

  const DARK = [11,17,32], BLUE = [204,17,17], LIGHT = [248,250,253], GRAY = [98,108,126], LGRAY = [210,216,226], WHITE = [255,255,255];
  const fmt = (v) => `$ ${Math.round(Number(v||0)).toLocaleString("es-AR")}`;
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14;
  let y = 0;

  // Header
  const hdrH = 36;
  doc.setFillColor(...DARK).rect(0,0,W,hdrH,"F");
  doc.setFillColor(...BLUE).rect(0,0,W,2.5,"F");
  let logoLoaded = false;
  if (defaultLogoPdfDataUrl) { try { doc.addImage(defaultLogoPdfDataUrl,"JPEG",M,6,24,24,undefined,"FAST"); logoLoaded=true; } catch(_e){} }
  if (!logoLoaded) { doc.setFont("helvetica","bold").setFontSize(17).setTextColor(...WHITE); doc.text(agencia,M,20); }
  [cfg.phone,cfg.email,cfg.address].filter(Boolean).forEach((l,i) => { doc.setFont("helvetica","normal").setFontSize(7.5).setTextColor(180,195,220); doc.text(l,W-M,12+i*4.8,{align:"right"}); });
  doc.setFont("helvetica","bold").setFontSize(8).setTextColor(...BLUE);
  doc.text("ESTADO DE CUENTA", W-M, hdrH-7, {align:"right"});
  y = hdrH + 10;

  // Titulo
  doc.setFont("helvetica","bold").setFontSize(22).setTextColor(...DARK);
  doc.text("ESTADO DE CUENTA", M, y); y += 3;
  doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRAY);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}`, M, y+5);
  y += 12;
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M,y,M+40,y);
  doc.setDrawColor(...LGRAY).setLineWidth(0.3).line(M+40,y,W-M,y);
  y += 8;

  // Cliente card
  const cardLines = [client.nombre, client.telefono && `Tel: ${client.telefono}`, client.email && `Email: ${client.email}`, client.dni && `DNI/CUIT: ${client.dni}`].filter(Boolean);
  const cardH = 8 + cardLines.length * 5.5;
  doc.setFillColor(...LIGHT).roundedRect(M,y,W-2*M,cardH,2,2,"F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M,y,W-2*M,cardH,2,2,"S");
  doc.setFillColor(...BLUE).rect(M,y,2.5,cardH,"F");
  doc.setFont("helvetica","bold").setFontSize(7).setTextColor(...BLUE); doc.text("CLIENTE", M+5, y+5);
  doc.setFont("helvetica","bold").setFontSize(11).setTextColor(...DARK); doc.text(client.nombre, M+5, y+10.5);
  let cy = y+10.5;
  [client.telefono && `Tel: ${client.telefono}`, client.email && `Email: ${client.email}`, client.dni && `DNI/CUIT: ${client.dni}`].filter(Boolean).forEach(l => { cy+=5.5; doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRAY); doc.text(l,M+5,cy); });
  y += cardH + 8;

  // Resumen saldo
  const summaryH = 18;
  doc.setFillColor(...DARK).roundedRect(M,y,W-2*M,summaryH,2,2,"F");
  doc.setFillColor(...BLUE).rect(M,y,4,summaryH,"F");
  const thirds = (W-2*M)/3;
  [[`Total adeudado`, totalAdeudado, [160,185,220]], [`Total pagado`, totalPagado, [100,210,130]], [`Saldo pendiente`, saldoPendiente, saldoPendiente>0?[220,90,90]:[100,210,130]]].forEach(([lbl,val,col],i) => {
    const bx = M + i*thirds;
    doc.setFont("helvetica","normal").setFontSize(7).setTextColor(160,185,220); doc.text(lbl.toUpperCase(), bx+6, y+6);
    const sign = i===2 ? (val>0?"-":"+") : "";
    doc.setFont("helvetica","bold").setFontSize(12).setTextColor(...col); doc.text(`${sign}${fmt(Math.abs(val))}`, bx+6, y+14);
  });
  y += summaryH + 10;

  // Tabla de movimientos
  if (rows.length) {
    doc.setFont("helvetica","bold").setFontSize(7.5).setTextColor(...GRAY); doc.text("MOVIMIENTOS", M, y); y += 6;
    const colWs = [22,80,28,30,26], hdrs = ["Fecha","Concepto","Tipo","Monto","Origen"], rowH = 7;
    doc.setFillColor(...DARK).roundedRect(M,y,W-2*M,rowH,1,1,"F");
    let cx = M+3;
    hdrs.forEach((h,i) => { doc.setFont("helvetica","bold").setFontSize(7.5).setTextColor(...WHITE); doc.text(h,cx,y+5); cx+=colWs[i]; });
    y += rowH;
    rows.forEach((r,idx) => {
      if (y+rowH>268) { doc.addPage(); y=18; }
      if (idx%2===0) doc.setFillColor(...LIGHT).rect(M,y,W-2*M,rowH,"F");
      doc.setDrawColor(...LGRAY).setLineWidth(0.1).rect(M,y,W-2*M,rowH,"S");
      cx = M+3;
      const concepto = doc.splitTextToSize(r.concepto||"",colWs[1]-3)[0]||"";
      [r.fecha||"—",concepto,r.tipo||"",fmt(r.monto),r.origen||""].forEach((val,i) => {
        const col = i===2 ? (/Ingreso/i.test(r.tipo)?[22,163,74]:/Cargo|Egreso/i.test(r.tipo)?[220,60,60]:GRAY) : DARK;
        doc.setFont("helvetica","normal").setFontSize(8).setTextColor(...col); doc.text(val,cx,y+5); cx+=colWs[i];
      });
      y += rowH;
    });
  }

  // Pie
  const footerY = H-14;
  doc.setFillColor(...DARK).rect(0,footerY-8,W,22,"F");
  doc.setFillColor(...BLUE).rect(0,footerY-8,W,1.5,"F");
  doc.setFont("helvetica","normal").setFontSize(7.5).setTextColor(160,185,220);
  doc.text(`${agencia}  ·  Estado de cuenta corriente`, W-M, footerY+3, {align:"right"});

  doc.save(`EstadoCuenta-${clean(client.nombre)}.pdf`);
  } catch(e) { toast("No se pudo generar el PDF: "+(e.message||"error")); }
}

function generatePaymentReceiptPDF(clientId, rowIdx) {
  try {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return toast("No se pudo generar el PDF.");
  const client = (state.clients || []).find(c => c.id === clientId);
  if (!client) return;
  const { rows, saldoPendiente } = getClientAccountMovements(client);
  const r = rows[rowIdx];
  if (!r) return toast("Movimiento no encontrado.");
  const cfg = state.settings || {};
  const agencia = cfg.businessName || publicConfig.businessName || "Lake Motors";
  const clean = (s) => (s||"").replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"");

  const DARK=[11,17,32], BLUE=[204,17,17], LIGHT=[248,250,253], GRAY=[98,108,126], LGRAY=[210,216,226], WHITE=[255,255,255];
  const fmt = (v) => `$ ${Math.round(Number(v||0)).toLocaleString("es-AR")}`;
  const doc = new JsPDF({ unit:"mm", format:"a4" });
  const W=210, H=297, M=14;
  let y=0;

  // Header
  const hdrH=36;
  doc.setFillColor(...DARK).rect(0,0,W,hdrH,"F");
  doc.setFillColor(...BLUE).rect(0,0,W,2.5,"F");
  let ll=false;
  if (defaultLogoPdfDataUrl) { try { doc.addImage(defaultLogoPdfDataUrl,"JPEG",M,6,24,24,undefined,"FAST"); ll=true; } catch(_e){} }
  if (!ll) { doc.setFont("helvetica","bold").setFontSize(17).setTextColor(...WHITE); doc.text(agencia,M,20); }
  [cfg.phone,cfg.email].filter(Boolean).forEach((l,i) => { doc.setFont("helvetica","normal").setFontSize(7.5).setTextColor(180,195,220); doc.text(l,W-M,12+i*4.8,{align:"right"}); });
  const recNum = String(Date.now()).slice(-6);
  doc.setFont("helvetica","bold").setFontSize(8).setTextColor(...BLUE);
  doc.text(`RECIBO  #${recNum}`, W-M, hdrH-7, {align:"right"});
  y = hdrH+10;

  // Titulo
  doc.setFont("helvetica","bold").setFontSize(26).setTextColor(...DARK); doc.text("RECIBO DE PAGO", M, y); y+=3;
  const fechaDoc = r.fecha ? new Date(r.fecha+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"}) : new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});
  doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRAY); doc.text(`Fecha: ${fechaDoc}`, M, y+5);
  y+=12;
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M,y,M+40,y);
  doc.setDrawColor(...LGRAY).setLineWidth(0.3).line(M+40,y,W-M,y);
  y+=8;

  // Cliente card
  const cardLines=[client.nombre, client.telefono&&`Tel: ${client.telefono}`, client.email&&`Email: ${client.email}`, client.dni&&`DNI/CUIT: ${client.dni}`].filter(Boolean);
  const cardH=8+cardLines.length*5.5;
  doc.setFillColor(...LIGHT).roundedRect(M,y,W-2*M,cardH,2,2,"F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M,y,W-2*M,cardH,2,2,"S");
  doc.setFillColor(...BLUE).rect(M,y,2.5,cardH,"F");
  doc.setFont("helvetica","bold").setFontSize(7).setTextColor(...BLUE); doc.text("CLIENTE",M+5,y+5);
  doc.setFont("helvetica","bold").setFontSize(11).setTextColor(...DARK); doc.text(client.nombre,M+5,y+10.5);
  let ry=y+10.5;
  [client.telefono&&`Tel: ${client.telefono}`, client.email&&`Email: ${client.email}`, client.dni&&`DNI/CUIT: ${client.dni}`].filter(Boolean).forEach(l=>{ry+=5.5;doc.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRAY);doc.text(l,M+5,ry);});
  y+=cardH+8;

  // Detalle del pago
  const detH = 10 + 4*7 + 14;
  doc.setFillColor(...LIGHT).roundedRect(M,y,W-2*M,detH,2,2,"F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M,y,W-2*M,detH,2,2,"S");
  let dy=y+7;
  doc.setFont("helvetica","bold").setFontSize(7.5).setTextColor(...GRAY); doc.text("DETALLE DEL PAGO",M+5,dy); dy+=7;
  [["Concepto",r.concepto||"—"],["Tipo",r.tipo||"—"],["Origen",r.origen||"—"]].forEach(([lbl,val])=>{
    doc.setFont("helvetica","normal").setFontSize(9.5).setTextColor(...GRAY); doc.text(lbl+":",M+5,dy);
    doc.setFont("helvetica","bold").setFontSize(9.5).setTextColor(...DARK); doc.text(val,W-M-5,dy,{align:"right"}); dy+=6.5;
  });
  const finalBoxY=y+detH-14;
  doc.setFillColor(...DARK).roundedRect(M+2,finalBoxY,W-2*M-4,13,1.5,1.5,"F");
  doc.setFillColor(...BLUE).roundedRect(M+2,finalBoxY,4,13,1.5,1.5,"F");
  doc.setFont("helvetica","bold").setFontSize(9).setTextColor(160,185,220); doc.text("MONTO",M+9,finalBoxY+8.5);
  doc.setFont("helvetica","bold").setFontSize(16).setTextColor(...WHITE); doc.text(fmt(r.monto),W-M-6,finalBoxY+8.5,{align:"right"});
  y+=detH+10;

  // Saldo tras este movimiento
  doc.setFont("helvetica","normal").setFontSize(9).setTextColor(...GRAY);
  doc.text(`Saldo pendiente de la cuenta tras este movimiento:`, M, y);
  doc.setFont("helvetica","bold").setFontSize(11).setTextColor(...(saldoPendiente>0?[220,60,60]:[22,163,74]));
  doc.text(`${saldoPendiente>0?"-":"+"}${fmt(Math.abs(saldoPendiente))}`, W-M, y, {align:"right"});

  // Pie
  const footerY=H-14;
  doc.setFillColor(...DARK).rect(0,footerY-8,W,22,"F");
  doc.setFillColor(...BLUE).rect(0,footerY-8,W,1.5,"F");
  doc.setFont("helvetica","normal").setFontSize(7.5).setTextColor(160,185,220);
  doc.text(`${agencia}  ·  Recibo de pago`, W-M, footerY+3, {align:"right"});

  doc.save(`Recibo-${clean(client.nombre)}-${r.fecha||"sinFecha"}.pdf`);
  } catch(e) { toast("No se pudo generar el PDF: "+(e.message||"error")); }
}

function clientProfileCuotasPendientes(client) {
  const today = todayKey();
  const cuotas = (state.collections || [])
    .filter(r => matchesClienteRecord(r, client) && r.numeroCuota && !/Confirmado/i.test(r.estado || ""))
    .sort((a, b) => (a.vence || "").localeCompare(b.vence || ""));
  const total = cuotas.reduce((s, r) => s + Number(r.monto || 0), 0);
  return `
    <section class="card profile-section">
      <div class="card-head">
        <h2>Cuotas pendientes</h2>
        <span class="pill ${cuotas.length ? "warn" : "ok"}">${cuotas.length}</span>
      </div>
      ${!cuotas.length
        ? `<div class="card-body"><p class="muted">No hay cuotas pendientes para este cliente.</p></div>`
        : `<div style="overflow:auto"><table>
            <thead><tr><th>Vence</th><th>Concepto</th><th>Cuota #</th><th>Monto</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${cuotas.map(r => {
                const isVencida = r.vence && r.vence < today;
                return `<tr>
                  <td style="white-space:nowrap">${escapeHtml(r.vence || "—")}</td>
                  <td>${escapeHtml(r.concepto || "")}</td>
                  <td style="text-align:center">${r.numeroCuota || "—"}</td>
                  <td>${money(r.monto)}</td>
                  <td>${isVencida ? `<span class="pill crit">Vencida</span>` : `<span class="pill warn">Pendiente</span>`}</td>
                  <td><button class="btn ghost" style="font-size:12px;padding:3px 10px" data-pay-cuota="${escapeHtml(r.id)}">Registrar pago</button></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
          <div style="padding:12px 16px;text-align:right;font-weight:700;font-size:13px;border-top:1px solid var(--border)">
            Total pendiente: <span style="color:var(--crit)">${money(total)}</span>
          </div>
        </div>`}
    </section>
  `;
}

function clientProfileCompras(client) {
  const sales = clientRelated("sales", client);
  const quotes = clientRelated("quotes", client);
  return `
    <section class="card profile-section">
      <div class="card-head"><h2>Historial de compras</h2><span class="pill info">${sales.length}</span></div>
      <div class="card-body">
        ${sales.length ? `<div style="overflow:auto"><table><thead><tr><th></th><th>Vehiculo</th><th>Monto</th><th>Forma de pago</th><th>Cuotas</th><th>Etapa</th><th>Vendedor</th></tr></thead><tbody>
          ${sales.map(s => {
            const v = s.vehiculoId ? (state.vehicles || []).find(x => x.id === s.vehiculoId) : null;
            const thumb = v?.fotos?.[0] ? `<img class="row-thumb" src="${escapeHtml(v.fotos[0])}" alt="foto">` : `<div class="row-thumb-placeholder"></div>`;
            let cuotasPill = "";
            if (s.formaPago === "Cuotas") {
              const cuotas = getSaleCuotas(s.id);
              const total = Number(s.cantCuotas || 0);
              const pagadas = cuotas.filter(c => /Confirmado/i.test(c.estado || "")).length;
              cuotasPill = `<span class="pill ${pagadas === total ? "ok" : "warn"}">${pagadas}/${total}</span>`;
            } else {
              cuotasPill = `<span class="muted">—</span>`;
            }
            return `<tr><td style="width:60px">${thumb}</td><td><strong>${escapeHtml(s.vehiculo)}</strong></td><td>${money(s.monto)}</td><td><span class="pill info">${escapeHtml(s.formaPago || "—")}</span></td><td>${cuotasPill}</td><td>${pill(s.etapa)}</td><td>${escapeHtml(s.vendedor)}</td></tr>`;
          }).join("")}
        </tbody></table></div>` : `<p class="muted">Sin compras registradas todavia.</p>`}
      </div>
    </section>
    <section class="card profile-section" style="margin-top:16px">
      <div class="card-head"><h2>Cotizaciones enviadas</h2><span class="pill info">${quotes.length}</span></div>
      <div class="card-body">
        ${profileMiniTable(quotes, [
          { key: "vehiculo", label: "Vehiculo" },
          { key: "monto", label: "Monto", render: v => money(v) },
          { key: "fecha", label: "Fecha" },
          { key: "estado", label: "Estado", render: v => pill(v) }
        ], "Sin cotizaciones registradas.")}
      </div>
    </section>
  `;
}

function clientProfileDocumentos(client) {
  const paperwork = clientRelated("paperwork", client);
  const files = clientRelated("files", client);
  const docs = (state.clientDocs || []).filter(d => d.clienteId === client.id);
  return `
    <section class="card profile-section">
      <div class="card-head">
        <h2>Documentos del cliente</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="pill info">${docs.length}</span>
          <button class="btn" data-quick-action="new-client-doc:${escapeHtml(client.id)}">+ Nuevo documento</button>
        </div>
      </div>
      <div class="card-body">
        ${docs.length ? `<div style="overflow:auto"><table>
          <thead><tr><th>Tipo</th><th>Nombre</th><th>Fecha</th><th>Estado</th><th>Archivo</th><th></th></tr></thead>
          <tbody>${docs.map(doc => `<tr>
            <td>${pill(doc.tipo || "Otro")}</td>
            <td><strong>${escapeHtml(doc.nombre || "")}</strong>${doc.notas ? `<br><small class="muted">${escapeHtml(doc.notas)}</small>` : ""}</td>
            <td>${escapeHtml(doc.fecha || "")}</td>
            <td>${pill(doc.estado || "Recibido")}</td>
            <td>${doc.archivo ? `<a class="btn ghost" style="font-size:12px;min-height:28px;padding:4px 10px" href="${escapeHtml(doc.archivo)}" download="${escapeHtml(doc.archivoNombre || 'documento')}">Descargar</a>` : `<span class="muted">—</span>`}</td>
            <td class="record-actions">
              <button class="icon-btn" data-edit="clientDocs:${escapeHtml(doc.id)}" title="Editar">E</button>
              <button class="icon-btn" data-delete="clientDocs:${escapeHtml(doc.id)}" title="Eliminar">X</button>
            </td>
          </tr>`).join("")}</tbody>
        </table></div>` : `<p class="muted">Sin documentos cargados para este cliente. Usá "+ Nuevo documento" para agregar uno.</p>`}
      </div>
    </section>
    <section class="card profile-section" style="margin-top:16px">
      <div class="card-head"><h2>Gestoria</h2><span class="pill info">${paperwork.length}</span></div>
      <div class="card-body">
        ${profileMiniTable(paperwork, [
          { key: "tramite", label: "Tramite" },
          { key: "vehiculo", label: "Vehiculo" },
          { key: "vence", label: "Vence" },
          { key: "estado", label: "Estado", render: v => pill(v) }
        ], "Sin tramites de gestoria registrados.")}
      </div>
    </section>
    <section class="card profile-section" style="margin-top:16px">
      <div class="card-head"><h2>Expedientes</h2><span class="pill info">${files.length}</span></div>
      <div class="card-body">
        ${profileMiniTable(files, [
          { key: "numero", label: "Numero" },
          { key: "tramite", label: "Tramite" },
          { key: "responsable", label: "Responsable" },
          { key: "estado", label: "Estado", render: v => pill(v) }
        ], "Sin expedientes registrados.")}
      </div>
    </section>
  `;
}

function clientProfileAgenda(client) {
  const agendaItems = aggregatedAgendaItems().filter(e => clientMatchesItem(e, client));
  const today = todayKey();
  const upcoming = agendaItems.filter(e => e.fecha >= today).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const past = agendaItems.filter(e => e.fecha < today).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const claims = clientRelated("claims", client);
  const afterSales = clientRelated("afterSales", client);
  const agendaRow = e => `<div class="event"><time>${escapeHtml(e.fecha)}${e.hora ? " " + escapeHtml(e.hora) : ""}</time><div><strong>${escapeHtml(e.titulo)}</strong><span class="pill info">${escapeHtml(e.tipo)}</span>${pill(e.estado)}</div></div>`;
  return `
    <section class="card profile-section">
      <div class="card-head"><h2>Proximos eventos</h2><span class="pill info">${upcoming.length}</span></div>
      <div class="card-body timeline">
        ${upcoming.slice(0, 10).map(agendaRow).join("") || `<p class="muted">Sin eventos proximos.</p>`}
      </div>
    </section>
    <section class="card profile-section" style="margin-top:16px">
      <div class="card-head"><h2>Historial de agenda</h2></div>
      <div class="card-body timeline">
        ${past.map(agendaRow).join("") || `<p class="muted">Sin historial de agenda.</p>`}
      </div>
    </section>
    <section class="card profile-section" style="margin-top:16px">
      <div class="card-head"><h2>Reclamos y postventa</h2></div>
      <div class="card-body">
        ${(claims.length || afterSales.length) ? `
          ${claims.length ? profileMiniTable(claims, [
            { key: "motivo", label: "Motivo" },
            { key: "canal", label: "Canal" },
            { key: "prioridad", label: "Prioridad" },
            { key: "estado", label: "Estado", render: v => pill(v) }
          ]) : ""}
          ${afterSales.length ? `<div style="margin-top:12px">${profileMiniTable(afterSales, [
            { key: "vehiculo", label: "Vehiculo" },
            { key: "entrega", label: "Entrega" },
            { key: "control", label: "Control" },
            { key: "estado", label: "Estado", render: v => pill(v) }
          ])}</div>` : ""}
        ` : `<p class="muted">Sin reclamos ni postventa registrados.</p>`}
      </div>
    </section>
  `;
}

function handleQuickAction(action) {
  const [type, clientId] = action.split(":");
  const client = (state.clients || []).find(c => c.id === clientId);
  if (!client) return;
  const prefill = { clienteId: client.id, cliente: client.nombre, telefono: client.telefono || "" };
  if (type === "edit-client")   return openModal("clients", client);
  if (type === "new-sale")      return openModal("sales",    { ...prefill, etapa: "Contacto", vehiculo: client.interes || "" });
  if (type === "new-quote")     return openModal("quotes",   { ...prefill, vehiculo: client.interes || "" });
  if (type === "new-calendar")  return openModal("calendar", { ...prefill, titulo: `Contacto con ${client.nombre}`, tipo: "Llamado", hora: "10:00", fecha: todayKey() });
  if (type === "new-message")   return openModal("messages", { ...prefill, canal: "WhatsApp", plantilla: "Seguimiento" });
  if (type === "new-client-doc") return openModal("clientDocs", { clienteId: client.id, cliente: client.nombre });
  if (type === "client-payment") return openPagoClienteModal(clientId);
}

function openPagoClienteModal(clientId) {
  const client = (state.clients || []).find(c => c.id === clientId);
  if (!client) return;
  const today = todayKey();
  const { totalAdeudado, totalPagado, saldoPendiente, rows: mvRows } = getClientAccountMovements(client);
  const balanceBanner = mvRows.length ? `
    <div style="display:flex;gap:24px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px 16px;margin:0 0 4px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;flex-shrink:0">Estado de cuenta</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">
        <div><div style="font-size:10px;color:var(--muted)">Adeudado</div><div style="font-weight:700;font-size:14px">${money(totalAdeudado)}</div></div>
        <div><div style="font-size:10px;color:var(--muted)">Pagado</div><div style="font-weight:700;font-size:14px;color:var(--ok)">${money(totalPagado)}</div></div>
        <div><div style="font-size:10px;color:var(--muted)">Saldo pendiente</div><div style="font-weight:700;font-size:15px;color:${saldoPendiente > 0 ? "var(--crit)" : "var(--ok)"}">${saldoPendiente > 0 ? "-" : "+"}${money(Math.abs(saldoPendiente))}</div></div>
      </div>
    </div>` : "";
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal">
        <div class="modal-head">
          <div><h2>Registrar pago</h2><p>Movimiento en cuenta corriente de ${escapeHtml(client.nombre)}</p></div>
          <button class="icon-btn" data-close>X</button>
        </div>
        ${balanceBanner}
        <form data-save="treasury" data-id="">
          <input type="hidden" name="clienteId" value="${escapeHtml(clientId)}">
          <input type="hidden" name="cliente" value="${escapeHtml(client.nombre)}">
          <input type="hidden" name="cuenta" value="Caja">
          <input type="hidden" name="estado" value="Confirmado">
          <fieldset class="form-section">
            <legend>Detalle del movimiento</legend>
            <div class="form-grid">
              <label class="field-wrap">
                <span>Tipo</span>
                <select name="tipo">
                  <option value="Ingreso">Ingreso (pago recibido)</option>
                  <option value="Egreso">Egreso (devolucion / descuento)</option>
                </select>
              </label>
              <label class="field-wrap">
                <span>Concepto</span>
                <input name="concepto" value="Pago — ${escapeHtml(client.nombre)}" required>
              </label>
              <label class="field-wrap">
                <span>Monto</span>
                <input name="monto" type="number" min="0" step="0.01" placeholder="0" required>
              </label>
              <label class="field-wrap">
                <span>Moneda</span>
                <select name="moneda">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label class="field-wrap">
                <span>Medio de pago</span>
                <select name="medio">
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
              <label class="field-wrap">
                <span>Fecha</span>
                <input name="fecha" type="date" value="${escapeHtml(today)}">
              </label>
              <label class="field-wrap" style="grid-column:1/-1">
                <span>Notas</span>
                <textarea name="notas" rows="2"></textarea>
              </label>
            </div>
          </fieldset>
          <div class="modal-actions">
            <button class="btn ghost" type="button" data-close>Cancelar</button>
            <button class="btn primary-action" type="submit">Registrar pago</button>
          </div>
        </form>
      </section>
    </div>
  `);
  bindModal();
}

function flowsForModule(moduleId) {
  return {
    cotizaciones: [["quote-message", "Preparar mensaje"], ["quote-sale", "Crear venta"]],
    clientes: [["client-calendar", "Agendar contacto"]],
    stock: [["stock-quote", "Crear cotizacion"]],
    ventas: [["sale-file", "Generar expediente"]]
  }[moduleId] || [];
}

function moduleFlowButtons(moduleId, key) {
  return flowsForModule(moduleId).map(([flow, label]) => `<button class="btn ghost" data-module-flow="${flow}:${key}">${label}</button>`).join("");
}

function pendingRows(rows) {
  return rows.filter(row => /Pendiente|Abierto|Revisar|Buscando|Activo|Nueva|En proceso|Llamar|Alta|Media/i.test(Object.values(row).join(" "))).length;
}

function totalForRows(rows) {
  return rows.reduce((total, row) => total + Object.entries(row).reduce((sum, [key, value]) => /monto|precio|comision|costo|presupuesto/i.test(key) ? sum + Number(value || 0) : sum, 0), 0);
}

function nextDatedRow(rows) {
  const dateKeys = ["vence", "fecha", "entrega", "ultimoContacto"];
  const today = todayKey();
  return rows
    .map(row => ({ row, date: dateKeys.map(key => row[key]).find(value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) }))
    .filter(item => item.date && item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]?.row || null;
}

function detailList(row, columns) {
  return `<dl class="detail-list">${(columns || []).map(([key, label]) => `<div><dt>${escapeHtml(label)}</dt><dd>${renderDetailValue(key, row[key])}</dd></div>`).join("")}</dl>`;
}

function renderDetailValue(key, value) {
  if (key === "fotos") {
    const imgs = Array.isArray(value) ? value : [];
    return imgs.length ? `<div class="vehicle-gallery">${imgs.map(src => `<img src="${escapeHtml(src)}" alt="foto">`).join("")}</div>` : `<span class="muted">Sin fotos</span>`;
  }
  if (/monto|precio|comision|costo|presupuesto/i.test(key)) return money(value);
  if (/estado|prioridad|tipo/i.test(key)) return pill(value);
  return escapeHtml(value);
}


function vehicleColumns() {
  return [
    { key: "fotos", label: "", render: (fotos) => fotos?.length ? `<img class="row-thumb" src="${escapeHtml(fotos[0])}" alt="foto">` : `<div style="width:52px;height:38px;border-radius:4px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;">🚗</div>` },
    { key: "dominio", label: "Dominio" },
    { key: "modelo", label: "Modelo", render: (_, r) => `<strong>${escapeHtml(r.marca)} ${escapeHtml(r.modelo)}</strong><br><span class="muted">${r.anio} - ${Number(r.km).toLocaleString("es-AR")} km</span>` },
    { key: "precio", label: "Precio", render: v => money(v) },
    { key: "estado", label: "Estado", render: v => pill(v) },
    { key: "ubicacion", label: "Ubicacion" }
  ];
}

function resizeImage(file, maxW = 900, maxH = 675, quality = 0.75) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function vehiclePhotoSection(row = {}) {
  return `
    <fieldset class="form-section">
      <legend><span>F</span>FOTOS DEL VEHICULO</legend>
      <div class="vehicle-photos-preview" id="vph-preview"></div>
      <div class="toolbar" style="margin:0;gap:8px">
        <label class="btn ghost file-btn">
          Agregar fotos
          <input type="file" accept="image/png,image/jpeg,image/webp" data-action="vehicle-photo-upload" multiple>
        </label>
        <small class="muted">Max 6 fotos · JPG/PNG/WEBP · se comprimen automaticamente</small>
      </div>
    </fieldset>
  `;
}

function updatePhotoPreview() {
  const preview = document.getElementById("vph-preview");
  if (!preview) return;
  preview.innerHTML = _vehiclePhotosBuf.length
    ? _vehiclePhotosBuf.map((src, i) => `<div class="photo-thumb"><img src="${escapeHtml(src)}" alt="Foto ${i+1}"><button type="button" class="icon-btn remove-photo" data-photo-index="${i}" title="Quitar">X</button></div>`).join("")
    : `<p class="muted" style="font-size:12px">Sin fotos cargadas.</p>`;
  preview.querySelectorAll("[data-photo-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      _vehiclePhotosBuf.splice(Number(btn.dataset.photoIndex), 1);
      updatePhotoPreview();
    });
  });
}

function expPhotoSection() {
  return `
    <div class="vehicle-photos-preview" id="exp-photo-preview" style="margin-bottom:8px"></div>
    <label class="btn ghost file-btn" style="margin-bottom:4px">
      Agregar fotos de detalle
      <input type="file" accept="image/png,image/jpeg,image/webp" data-action="exp-photo-upload" multiple>
    </label>
    <small class="muted" style="display:block;margin-top:4px">Max 6 fotos · se comprimen automaticamente</small>
  `;
}

function updateExpPhotoPreview() {
  const preview = document.getElementById("exp-photo-preview");
  if (!preview) return;
  preview.innerHTML = _expPhotosBuf.length
    ? _expPhotosBuf.map((src, i) => `<div class="photo-thumb"><img src="${escapeHtml(src)}" alt="Foto ${i+1}"><button type="button" class="icon-btn remove-photo" data-exp-photo-index="${i}" title="Quitar">X</button></div>`).join("")
    : `<p class="muted" style="font-size:12px">Sin fotos.</p>`;
  preview.querySelectorAll("[data-exp-photo-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      _expPhotosBuf.splice(Number(btn.dataset.expPhotoIndex), 1);
      updateExpPhotoPreview();
    });
  });
}

function openExpedienteTecnicoModal(vehiculoId = "", vehiculoRef = "", consignacionId = "") {
  _expPhotosBuf = [];
  const existing = (state.files || []).find(f =>
    f.tipo === "Vehiculo" &&
    ((vehiculoId && f.vehiculoId === vehiculoId) || (consignacionId && f.consignacionId === consignacionId))
  );
  const label = vehiculoRef || existing?.vehiculoRef || "Vehiculo";
  const historial = existing?.historial || [];
  const histHtml = historial.length
    ? [...historial].reverse().map(h => `
        <div class="exp-historial-entry">
          <div class="exp-entry-meta"><strong>${escapeHtml(h.autor || "—")}</strong><span class="muted">${escapeHtml(h.fecha || "")}</span></div>
          <p class="exp-entry-notas">${escapeHtml(h.notas || "").replace(/\n/g, "<br>")}</p>
          ${(h.fotos || []).length ? `<div class="vehicle-gallery">${h.fotos.map(src => `<img src="${escapeHtml(src)}" alt="foto">`).join("")}</div>` : ""}
        </div>`).join("")
    : `<p class="muted" style="padding:12px 0">Sin entradas previas.</p>`;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal">
        <div class="modal-head">
          <div><h2>Expediente tecnico</h2><p>${escapeHtml(label)}</p></div>
          <button class="icon-btn" data-close>X</button>
        </div>
        <div style="max-height:30vh;overflow-y:auto;padding:0 2px 12px;border-bottom:1px solid var(--border);margin-bottom:16px">
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);margin-bottom:10px">HISTORIAL (${historial.length} ${historial.length === 1 ? "entrada" : "entradas"})</h3>
          ${histHtml}
        </div>
        <div style="border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:16px">
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);margin-bottom:10px">ESTADO TECNICO</h3>
          <div class="form-grid">
            <div class="field">
              <label>Seguro</label>
              <select id="exp-seguro">
                ${["Vigente", "Vencido", "Sin seguro"].map(o => `<option ${(existing?.seguroVigente || "Sin seguro") === o ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>VTV vence</label>
              <input type="date" id="exp-vtv-vence" value="${escapeHtml(existing?.vtvVence || "")}">
            </div>
          </div>
        </div>
        <div>
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);margin-bottom:10px">NUEVA ENTRADA</h3>
          <div class="field full" style="margin-bottom:12px">
            <label>Notas de estado (mecanico, chapa, interior, documentacion)</label>
            <textarea id="exp-notas" rows="3" placeholder="Ej: Golpe en paragolpes trasero. Motor sin observaciones. Cedula verde presente."></textarea>
          </div>
          ${expPhotoSection()}
        </div>
        <div class="modal-actions">
          <button class="btn ghost" data-close>Cerrar</button>
          <button class="btn primary-action" id="exp-save-btn">Guardar entrada</button>
        </div>
      </section>
    </div>
  `);
  bindModal();
  updateExpPhotoPreview();
  document.querySelector("[data-action='exp-photo-upload']")?.addEventListener("change", async function() {
    const files = Array.from(this.files || []);
    for (const file of files) {
      if (!file.type.startsWith("image/")) { toast("Solo imagenes JPG, PNG o WEBP."); continue; }
      if (_expPhotosBuf.length >= 6) { toast("Maximo 6 fotos por entrada."); break; }
      const dataUrl = await resizeImage(file);
      if (dataUrl) _expPhotosBuf.push(dataUrl);
    }
    this.value = "";
    updateExpPhotoPreview();
  });
  document.getElementById("exp-save-btn")?.addEventListener("click", async () => {
    const notas = document.getElementById("exp-notas")?.value?.trim() || "";
    const seguroVigente = document.getElementById("exp-seguro")?.value || "Sin seguro";
    const vtvVence = document.getElementById("exp-vtv-vence")?.value || "";
    if (!notas && _expPhotosBuf.length === 0) return toast("Escribi una nota o agrega al menos una foto.");
    const entrada = {
      id: `h-${Date.now()}`,
      fecha: todayKey(),
      autor: authUser?.name || authUser?.email || "Sistema",
      notas,
      fotos: _expPhotosBuf.slice()
    };
    state.files = state.files || [];
    let expediente;
    if (existing) {
      existing.historial = existing.historial || [];
      existing.historial.push(entrada);
      existing.seguroVigente = seguroVigente;
      existing.vtvVence = vtvVence;
      expediente = existing;
    } else {
      const newExp = {
        id: `ex-V-${Date.now()}`,
        tipo: "Vehiculo",
        vehiculoId: vehiculoId || "",
        vehiculoRef: label,
        consignacionId: consignacionId || "",
        estado: "Activo",
        seguroVigente,
        vtvVence,
        historial: [entrada]
      };
      state.files.unshift(newExp);
      expediente = newExp;
    }
    // Sync vtvVence to calendar — upsert by expedienteRef
    if (vtvVence) {
      state.calendar = state.calendar || [];
      const existingCal = state.calendar.find(e => e.expedienteRef === expediente.id);
      if (existingCal) {
        existingCal.fecha = vtvVence;
        existingCal.titulo = `Vence VTV — ${label}`;
      } else {
        state.calendar.unshift({
          id: `vtv-${Date.now()}`,
          tipo: "Vencimiento VTV",
          titulo: `Vence VTV — ${label}`,
          fecha: vtvVence,
          hora: "",
          vehiculo: label,
          vehiculoId: vehiculoId || "",
          estado: "Programado",
          expedienteRef: expediente.id,
          cliente: "",
          notas: ""
        });
      }
    } else if (existing) {
      state.calendar = (state.calendar || []).filter(e => e.expedienteRef !== expediente.id);
    }
    addAudit(`Expediente tecnico actualizado: ${label}`);
    await saveState("Expediente tecnico guardado");
    document.querySelector("[data-modal]")?.remove();
    render();
  });
}

function openQuotePreview(id) {
  const q = (state.quotes || []).find(x => x.id === id);
  if (!q) return;
  const client = q.clienteId ? (state.clients || []).find(c => c.id === q.clienteId) : null;
  const vehicle = q.vehiculoId ? (state.vehicles || []).find(v => v.id === q.vehiculoId) : null;
  const photos = vehicle?.fotos || [];
  const galleryHtml = photos.length
    ? `<div class="vp-gallery">${photos.map((src, i) => `<img src="${escapeHtml(src)}" alt="Foto ${i+1}">`).join("")}</div>`
    : "";
  const row = (label, val) => val ? `<div class="vp-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(val))}</strong></div>` : "";
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal vp-modal">
        <div class="modal-head">
          <div>
            <h2>${escapeHtml(q.vehiculo || "Cotizacion")}</h2>
            <p>${escapeHtml(q.cliente || "—")} &middot; ${escapeHtml(q.tipoOperacion || q.tipo || "Tramite")} &middot; ${escapeHtml(q.moneda || "ARS")}</p>
          </div>
          <button class="icon-btn" data-close>X</button>
        </div>
        ${galleryHtml}
        <div class="vp-body">
          <div class="vp-specs">
            <div class="vp-spec price-spec"><span>Monto</span><strong>${money(q.monto)}</strong></div>
            <div class="vp-spec"><span>Estado</span><strong>${pill(q.estado || "—")}</strong></div>
            ${row("Precio lista", q.precioLista ? money(q.precioLista) : "")}
            ${row("Bonificacion", q.bonificacion ? money(q.bonificacion) : "")}
            ${row("Validez", q.validez)}
            ${row("Vendedor", q.vendedor)}
            ${row("Telefono cliente", q.telefono || client?.telefono)}
            ${q.notas ? `<div class="vp-spec vp-spec-full"><span>Condiciones</span><strong>${escapeHtml(q.notas)}</strong></div>` : ""}
          </div>
          <div class="modal-actions">
            <button class="btn ghost" data-close>Cerrar</button>
            <button class="btn ghost" data-edit="quotes:${escapeHtml(id)}">Editar</button>
            <button class="btn primary-action" data-quote-pdf="${escapeHtml(id)}">Descargar PDF</button>
          </div>
        </div>
      </section>
    </div>
  `);
  bindModal();
}

function openConsignPreview(id) {
  const cs = (state.consignments || []).find(x => x.id === id);
  if (!cs) return;
  const photos = cs.fotos || [];
  const galleryHtml = photos.length
    ? `<div class="vp-gallery">${photos.map((src, i) => `<img src="${escapeHtml(src)}" alt="Foto ${i+1}">`).join("")}</div>`
    : "";
  const row = (label, val) => val ? `<div class="vp-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(val))}</strong></div>` : "";
  const vehiculo = `${cs.marca||""} ${cs.modelo||""}${cs.version?" "+cs.version:""}`.trim() || cs.vehiculo || "—";
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal vp-modal">
        <div class="modal-head">
          <div>
            <h2>${escapeHtml(vehiculo)}</h2>
            <p>${escapeHtml(cs.titular || "—")} &middot; ${escapeHtml(cs.dominio || "")} &middot; ${cs.anio || ""}</p>
          </div>
          <button class="icon-btn" data-close>X</button>
        </div>
        ${galleryHtml}
        <div class="vp-body">
          <div class="vp-specs">
            <div class="vp-spec price-spec"><span>Precio pretendido</span><strong>${money(cs.precioPretendido)}</strong></div>
            <div class="vp-spec"><span>Estado</span><strong>${pill(cs.estado || "—")}</strong></div>
            ${row("Titular", cs.titular)}
            ${row("Telefono", cs.telefono)}
            ${row("Dominio", cs.dominio)}
            ${row("Km", cs.km ? Number(cs.km).toLocaleString("es-AR") + " km" : "")}
            ${row("Comision", cs.comision ? money(cs.comision) : "")}
            ${row("Vence", cs.vence)}
            ${cs.notas ? `<div class="vp-spec vp-spec-full"><span>Notas</span><strong>${escapeHtml(cs.notas)}</strong></div>` : ""}
          </div>
          <div class="modal-actions">
            <button class="btn ghost" data-close>Cerrar</button>
            <button class="btn ghost" data-edit="consignments:${escapeHtml(id)}">Editar</button>
            <button class="btn primary-action" data-peritaje-pdf="${escapeHtml(id)}">PDF Peritaje</button>
          </div>
        </div>
      </section>
    </div>
  `);
  bindModal();
}

function openVehiclePreview(id) {
  const v = (state.vehicles || []).find(x => x.id === id);
  if (!v) return;
  const photos = v.fotos || [];
  const galleryHtml = photos.length
    ? `<div class="vp-gallery">${photos.map((src, i) => `<img src="${escapeHtml(src)}" alt="Foto ${i+1}">`).join("")}</div>`
    : `<div class="vp-no-photo"><span>Sin fotos</span></div>`;
  const spec = (label, val) => val ? `<div class="vp-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(val))}</strong></div>` : "";
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal vp-modal">
        <div class="modal-head">
          <div>
            <h2>${escapeHtml(v.marca || "")} ${escapeHtml(v.modelo || "")}</h2>
            <p>${v.anio || ""} &middot; ${Number(v.km || 0).toLocaleString("es-AR")} km &middot; ${escapeHtml(v.dominio || "")}</p>
          </div>
          <button class="icon-btn" data-close>X</button>
        </div>
        ${galleryHtml}
        <div class="vp-body">
          <div class="vp-specs">
            <div class="vp-spec price-spec"><span>Precio</span><strong>${money(v.precio)}</strong></div>
            <div class="vp-spec"><span>Estado</span><strong>${pill(v.estado || "—")}</strong></div>
            ${spec("Dominio", v.dominio)}
            ${spec("Kilometros", v.km ? Number(v.km).toLocaleString("es-AR") + " km" : "")}
            ${spec("Ubicacion", v.ubicacion)}
            ${spec("Margen", v.margen ? money(v.margen) : "")}
            ${v.notas ? `<div class="vp-spec vp-spec-full"><span>Notas</span><strong>${escapeHtml(v.notas)}</strong></div>` : ""}
          </div>
          <div class="modal-actions">
            <button class="btn ghost" data-close>Cerrar</button>
            <button class="btn ghost" data-vp-edit="${escapeHtml(id)}">Editar</button>
            <button class="btn ghost" data-vp-exp="${escapeHtml(id)}">Expediente tecnico</button>
            <button class="btn primary-action" data-vp-send="${escapeHtml(id)}">Enviar a cliente</button>
          </div>
        </div>
      </section>
    </div>
  `);
  bindModal();
  document.querySelector(`[data-vp-edit="${id}"]`)?.addEventListener("click", () => {
    document.querySelector("[data-modal]")?.remove();
    openModal("vehicles", v);
  });
  document.querySelector(`[data-vp-exp="${id}"]`)?.addEventListener("click", () => {
    document.querySelector("[data-modal]")?.remove();
    openExpedienteTecnicoModal(id, `${v.marca || ""} ${v.modelo || ""}`.trim());
  });
  document.querySelector(`[data-vp-send="${id}"]`)?.addEventListener("click", () => sendVehicleToClient(v));
}

function sendVehicleToClient(v) {
  const photos = v.fotos || [];
  const photosHtml = photos.map(src => `<img src="${src}" style="width:100%;border-radius:14px;margin-bottom:14px;display:block;box-shadow:0 4px 20px rgba(0,0,0,.15)">`).join("");
  const rows = [
    ["Dominio", v.dominio], ["Año", v.anio], ["Kilometros", v.km ? Number(v.km).toLocaleString("es-AR") + " km" : ""],
    ["Estado", v.estado], ["Ubicacion", v.ubicacion]
  ].filter(([, val]) => val);
  const specsHtml = rows.map(([label, val]) => `
    <tr>
      <td style="padding:11px 14px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid #f0f2f8;">${label}</td>
      <td style="padding:11px 14px;font-weight:600;font-size:14px;border-bottom:1px solid #f0f2f8;">${val}</td>
    </tr>`).join("");
  const agencyName = publicConfig.businessName || state?.settings?.businessName || "Lake Motors";
  const agencyLogo = publicConfig.logoDataUrl || state?.settings?.logoDataUrl || "";
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${v.marca || ""} ${v.modelo || ""} - ${v.dominio || ""}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f3fa;color:#111;padding:24px 16px}
  .wrap{max-width:560px;margin:0 auto}
  .header{background:linear-gradient(135deg,#0f1523 0%,#1a2540 100%);color:#fff;padding:28px 28px 24px;border-radius:18px;margin-bottom:20px}
  .logo-wrap{margin-bottom:16px}
  .logo-wrap img{max-height:44px;max-width:160px;object-fit:contain;opacity:.9}
  .agency{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:14px}
  h1{font-size:28px;font-weight:900;letter-spacing:-.02em;margin-bottom:6px}
  .subtitle{color:rgba(255,255,255,.6);font-size:14px;margin-bottom:18px}
  .price{font-size:34px;font-weight:900;color:#4ade80;letter-spacing:-.02em}
  .photos{margin-bottom:20px}
  .card{background:#fff;border-radius:16px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 16px rgba(0,0,0,.07)}
  table{width:100%;border-collapse:collapse}
  .footer{text-align:center;color:#aaa;font-size:11px;padding:16px 0 8px}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    ${agencyLogo ? `<div class="logo-wrap"><img src="${agencyLogo}" alt="${agencyName}"></div>` : `<div class="agency">${agencyName}</div>`}
    <h1>${v.marca || ""} ${v.modelo || ""}</h1>
    <div class="subtitle">${v.anio || ""} &middot; ${v.km ? Number(v.km).toLocaleString("es-AR") + " km" : ""} &middot; ${v.dominio || ""}</div>
    <div class="price">${money(v.precio)}</div>
  </div>
  ${photosHtml ? `<div class="photos">${photosHtml}</div>` : ""}
  <div class="card"><table>${specsHtml}</table></div>
  ${v.notas ? `<div class="card" style="padding:18px 20px"><p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:8px">Notas</p><p style="font-size:14px;line-height:1.6;color:#374151">${escapeHtml(v.notas)}</p></div>` : ""}
  <div class="footer">Informacion enviada por ${escapeHtml(agencyName)}</div>
</div>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(v.marca || "vehiculo").replace(/\s+/g, "-")}-${(v.modelo || "").replace(/\s+/g, "-")}-${v.dominio || "info"}.html`.toLowerCase();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Ficha descargada — podés enviarla por WhatsApp o email.");
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

function calendarPage() {
  const items = filteredCalendar();
  const today = todayKey();
  const allAgenda = aggregatedAgendaItems();
  const pending = allAgenda.filter(x => /Pendiente|Programado/i.test(x.estado || "")).length;
  const confirmed = allAgenda.filter(x => /Confirmado|Listo/i.test(x.estado || "")).length;
  const overdue = allAgenda.filter(x => x.fecha < today && !/Hecho|Cancelado|Listo/i.test(x.estado || "")).length;
  return `
    <div class="grid stats calendar-stats">
      ${stat("Eventos cargados", allAgenda.length, "Agenda total")}
      ${stat("Hoy", allAgenda.filter(x => x.fecha === today).length, "Compromisos del dia")}
      ${stat("Pendientes", pending, "A coordinar o resolver")}
      ${stat("Confirmados", confirmed, "Listos para atender")}
      ${stat("Vencidos", overdue, "Requieren accion")}
    </div>
    <section class="card calendar-card">
      <div class="card-head calendar-head">
        <div>
          <h2>${calendarTitle()}</h2>
          <p class="muted">${items.length} eventos visibles</p>
        </div>
        <div class="toolbar compact">
          <button class="btn ghost" data-action="calendar-prev">Anterior</button>
          <button class="btn ghost" data-action="calendar-today">Hoy</button>
          <button class="btn ghost" data-action="calendar-next">Siguiente</button>
          <div class="segmented">
            ${["month", "week", "list"].map(view => `<button class="${calendarView === view ? "active" : ""}" data-calendar-view="${view}">${viewLabel(view)}</button>`).join("")}
          </div>
          <button class="btn" data-add="calendar">Nuevo evento</button>
        </div>
      </div>
      <div class="card-body toolbar">
        <input class="grow" data-action="search" value="${escapeHtml(query)}" placeholder="Buscar cliente, auto, vendedor o estado">
        <button class="btn ghost" data-action="export">Exportar CSV</button>
      </div>
      <div class="card-body calendar-wrap">
        ${calendarView === "month" ? monthCalendar(items) : calendarView === "week" ? weekCalendar(items) : listCalendar(items)}
      </div>
    </section>
  `;
}

function calendarTitle() {
  const date = localDate(calendarCursor);
  if (calendarView === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return `${formatDate(start)} al ${formatDate(end)}`;
  }
  if (calendarView === "list") return "Listado de agenda";
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function monthCalendar(items) {
  const cursor = localDate(calendarCursor);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return `
    <div class="calendar-grid calendar-weekdays">${["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map(day => `<div>${day}</div>`).join("")}</div>
    <div class="calendar-grid">
      ${days.map(day => {
        const key = dateKey(day);
        const dayItems = items.filter(event => event.fecha === key);
        const outside = day.getMonth() !== cursor.getMonth() ? "outside" : "";
        const today = key === todayKey() ? "today" : "";
        return `<article class="calendar-day ${outside} ${today}">
          <div class="day-number">${day.getDate()}</div>
          <div class="day-events">${dayItems.slice(0, 3).map(calendarChip).join("")}${dayItems.length > 3 ? `<span class="more">+${dayItems.length - 3} mas</span>` : ""}</div>
        </article>`;
      }).join("")}
    </div>
  `;
}

function weekCalendar(items) {
  const start = startOfWeek(localDate(calendarCursor));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return `<div class="week-list">
    ${days.map(day => {
      const key = dateKey(day);
      const dayItems = items.filter(event => event.fecha === key);
      return `<section class="week-day">
        <div class="week-date"><strong>${day.toLocaleDateString("es-AR", { weekday: "long" })}</strong><span>${formatDate(day)}</span></div>
        <div class="week-events">${dayItems.map(calendarEventCard).join("") || `<div class="empty small">Sin agenda.</div>`}</div>
      </section>`;
    }).join("")}
  </div>`;
}

function listCalendar(items) {
  const rows = [...items].sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  return `<div class="calendar-list">${rows.map(calendarEventCard).join("") || `<div class="empty">No hay eventos para mostrar.</div>`}</div>`;
}

function calendarChip(event) {
  return `<button class="calendar-chip" data-edit="calendar:${event.id}" title="${escapeHtml(event.titulo)}"><span>${escapeHtml(event.hora)}</span>${escapeHtml(event.titulo)}</button>`;
}

function calendarEventCard(event) {
  return `<article class="calendar-event">
    <div class="event-main">
      <span class="event-time">${escapeHtml(event.fecha)} ${escapeHtml(event.hora)}</span>
      <strong>${escapeHtml(event.titulo)}</strong>
      <p>${escapeHtml(event.tipo)} - ${escapeHtml(event.cliente)} - ${escapeHtml(event.vehiculo)}</p>
      ${event.notas ? `<small>${escapeHtml(event.notas)}</small>` : ""}
    </div>
    <div class="event-side">
      ${pill(event.estado)}
      <span class="muted">${escapeHtml(event.vendedor)}</span>
      <div class="record-actions"><button class="icon-btn" data-edit="calendar:${event.id}" title="Editar">E</button><button class="icon-btn" data-delete="calendar:${event.id}" title="Eliminar">X</button></div>
    </div>
  </article>`;
}

function filteredCalendar() {
  const rows = filtered(aggregatedAgendaItems());
  if (calendarView === "list") return rows;
  const cursor = localDate(calendarCursor);
  if (calendarView === "week") {
    const start = dateKey(startOfWeek(cursor));
    const end = dateKey(addDays(startOfWeek(cursor), 6));
    return rows.filter(event => event.fecha >= start && event.fecha <= end);
  }
  const month = calendarCursor.slice(0, 7);
  return rows.filter(event => event.fecha?.slice(0, 7) === month);
}

function calendarForDay(key) {
  return (state.calendar || []).filter(event => event.fecha === key);
}

function upcomingCalendar(limit = 5) {
  const today = todayKey();
  return (state.calendar || [])
    .filter(event => event.fecha >= today && !/Cancelado/i.test(event.estado || ""))
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    .slice(0, limit);
}

function aggregatedAgendaItems() {
  const sources = [
    { moduleId: "alertas",       key: "alerts",        dateField: "vence",          label: "Alerta",       titleFn: r => r.titulo || "Alerta" },
    { moduleId: "cotizaciones",  key: "quotes",        dateField: "fecha",          label: "Cotizacion",   titleFn: r => [r.cliente, r.vehiculo].filter(Boolean).join(" - ") || "Cotizacion" },
    { moduleId: "expedientes",   key: "files",         dateField: "vence",          label: "Expediente",   titleFn: r => [r.tramite, r.cliente].filter(Boolean).join(" - ") || "Expediente" },
    { moduleId: "gestoria",      key: "paperwork",     dateField: "vence",          label: "Gestoria",     titleFn: r => [r.tramite, r.cliente].filter(Boolean).join(" - ") || "Tramite" },
    { moduleId: "consignaciones",key: "consignments",  dateField: "vence",          label: "Consignacion", titleFn: r => [r.titular, r.vehiculo].filter(Boolean).join(" - ") || "Consignacion" },
    { moduleId: "cobros",        key: "collections",   dateField: "vence",          label: "Cobro",        titleFn: r => [r.cliente, r.concepto].filter(Boolean).join(" - ") || "Cobro" },
    { moduleId: "infracciones",  key: "tickets",       dateField: "vence",          label: "Infraccion",   titleFn: r => [r.dominio, r.detalle].filter(Boolean).join(" - ") || "Infraccion" },
  ];
  const virtualItems = sources.flatMap(({ moduleId, key, dateField, label, titleFn }) =>
    (state[key] || [])
      .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(String(r[dateField] || "")))
      .map(r => ({
        id: `virtual-${moduleId}-${r.id}`,
        fecha: r[dateField],
        hora: "",
        titulo: titleFn(r),
        tipo: label,
        cliente: r.cliente || r.titular || r.beneficiario || "",
        clienteId: r.clienteId || "",
        vehiculo: r.vehiculo || "",
        vehiculoId: r.vehiculoId || "",
        estado: r.estado || "",
        vendedor: r.responsable || r.gestor || r.vendedor || "",
        notas: "",
        virtual: true,
        origen: moduleId,
        originKey: key,
        originId: r.id
      }))
  );
  return [...(state.calendar || []), ...virtualItems];
}

function shiftCalendar(step) {
  const cursor = localDate(calendarCursor);
  if (calendarView === "week") calendarCursor = dateKey(addDays(cursor, step * 7));
  else if (calendarView === "month") calendarCursor = dateKey(new Date(cursor.getFullYear(), cursor.getMonth() + step, 1));
  else calendarCursor = dateKey(addDays(cursor, step * 14));
}

function viewLabel(view) {
  return ({ month: "Mes", week: "Semana", list: "Lista" }[view] || view);
}

function localDate(key) {
  const [year, month, day] = String(key || todayKey()).split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return dateKey(new Date());
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function formatDate(date) {
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function salesPage() {
  return `
    <div class="toolbar">
      <button class="btn primary-action" data-add="sales">+ Nueva venta</button>
      <button class="btn ghost" data-action="export">Exportar CSV</button>
    </div>
    ${salesPipelineStrip()}
    <section class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>Historial de ventas</h2>
        <span class="pill info">${state.sales.length} operaciones</span>
      </div>
      <div class="card-body" style="padding:0">${salesHistoryTable()}</div>
    </section>
  `;
}

function salesPipelineStrip() {
  const stages = ["Contacto", "Tasacion", "Reserva", "Cierre", "Perdida"];
  const counts = Object.fromEntries(stages.map(s => [s, 0]));
  (state.sales || []).forEach(s => { if (counts[s.etapa] !== undefined) counts[s.etapa]++; });
  const active = ["Contacto", "Tasacion", "Reserva", "Cierre"];
  return `<div class="pipeline-strip">
    ${active.map((s, i) => {
      const cls = s === "Cierre" ? "ok" : "info";
      return `${i > 0 ? '<span class="pipeline-arrow">→</span>' : ""}<div class="pipeline-stage-pill"><span class="pill ${cls}">${s}</span><strong>${counts[s]}</strong></div>`;
    }).join("")}
    ${counts["Perdida"] > 0 ? `<span class="pipeline-arrow"> · </span><div class="pipeline-stage-pill"><span class="pill hot">Perdida</span><strong>${counts["Perdida"]}</strong></div>` : ""}
  </div>`;
}

function getSaleCuotas(saleId) {
  return (state.collections || [])
    .filter(c => c.saleId === saleId)
    .sort((a, b) => (a.numeroCuota || 0) - (b.numeroCuota || 0));
}

function salesHistoryTable() {
  const sales = [...(state.sales || [])].reverse();
  if (!sales.length) return `<p class="muted" style="padding:24px">No hay ventas registradas. Creá la primera con el botón "+ Nueva venta".</p>`;
  return `<div style="overflow:auto"><table>
    <thead><tr>
      <th>Cliente</th><th>Vehículo</th><th>Monto</th><th>Forma de pago</th>
      <th>Estado pago</th><th>Etapa</th><th>Vendedor</th><th>Fecha</th><th></th>
    </tr></thead>
    <tbody>${sales.map(s => {
      const cuotas = getSaleCuotas(s.id);
      const totalCuotas = Number(s.cantCuotas || 0);
      const pagadas = cuotas.filter(c => /Confirmado/i.test(c.estado || "")).length;
      const anticipo = Number(s.anticipo || s.sena || 0);

      let estadoPagoHtml;
      if (s.formaPago === "Cuotas" && totalCuotas > 0) {
        estadoPagoHtml = `<span class="pill ${pagadas === totalCuotas ? "ok" : "warn"}">${pagadas}/${totalCuotas} cuotas</span>`;
      } else if (anticipo > 0) {
        estadoPagoHtml = `<span class="pill ok">Anticipo cobrado</span>`;
      } else {
        estadoPagoHtml = `<span class="pill info">Sin cobros</span>`;
      }

      const nextPending = cuotas.find(c => !/Confirmado/i.test(c.estado || ""));
      const markBtn = (s.formaPago === "Cuotas" && nextPending)
        ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px;white-space:nowrap" data-mark-cuota="${escapeHtml(s.id)}" title="Marcar cuota ${nextPending.numeroCuota} como pagada">✓ Cuota ${nextPending.numeroCuota}</button>`
        : "";

      const fechaDisplay = s.fecha || "—";

      return `<tr>
        <td>${escapeHtml(s.cliente || "—")}</td>
        <td>${escapeHtml(s.vehiculo || "—")}</td>
        <td>${money(s.monto)}</td>
        <td><span class="pill info">${escapeHtml(s.formaPago || "—")}</span></td>
        <td>${estadoPagoHtml}</td>
        <td>${pill(s.etapa || s.estado || "—")}</td>
        <td>${escapeHtml(s.vendedor || "—")}</td>
        <td style="white-space:nowrap">${escapeHtml(fechaDisplay)}</td>
        <td class="record-actions" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <button class="icon-btn" data-sale-report="${escapeHtml(s.id)}" title="Ver informe">I</button>
          <button class="icon-btn" data-edit="sales:${escapeHtml(s.id)}" title="Editar">E</button>
          <button class="icon-btn" data-delete="sales:${escapeHtml(s.id)}" title="Eliminar">X</button>
          ${markBtn}
        </td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function kanban() {
  const stageOrder = ["Contacto", "Tasacion", "Reserva", "Cierre"];
  return `<div class="kanban">${stageOrder.map(stage => {
    const stageSales = (state.sales || []).filter(s => s.etapa === stage);
    const isLast = stage === "Cierre";
    return `<section class="lane">
      <h3>${escapeHtml(stage)} <span class="lane-count">${stageSales.length}</span></h3>
      ${stageSales.map(s => {
        const v = s.vehiculoId ? (state.vehicles || []).find(x => x.id === s.vehiculoId) : null;
        const thumb = v?.fotos?.[0] ? `<img class="deal-thumb" src="${escapeHtml(v.fotos[0])}" alt="">` : "";
        const senaPill = Number(s.sena) > 0 ? `<span class="pill ok deal-sena">Seña cobrada</span>` : "";
        const advBtn = isLast ? "" : `<button class="btn ghost deal-advance" data-advance-sale="${escapeHtml(s.id)}">Avanzar etapa →</button>`;
        return `<article class="deal">
          ${thumb}
          <strong>${escapeHtml(s.cliente)}</strong>
          <p>${escapeHtml(s.vehiculo)}</p>
          <p>${money(s.monto)}</p>
          ${senaPill}
          ${s.vendedor ? `<p class="muted">${escapeHtml(s.vendedor)}</p>` : ""}
          <div class="record-actions deal-actions"><button class="icon-btn" data-edit="sales:${escapeHtml(s.id)}" title="Editar">E</button><button class="icon-btn" data-delete="sales:${escapeHtml(s.id)}" title="Eliminar">X</button></div>
          ${advBtn}
        </article>`;
      }).join("")}
    </section>`;
  }).join("")}</div>`;
}

async function advanceSaleById(id) {
  const stageOrder = ["Contacto", "Tasacion", "Reserva", "Cierre"];
  const sale = (state.sales || []).find(s => s.id === id);
  if (!sale) return toast("Venta no encontrada.");
  const idx = stageOrder.indexOf(sale.etapa);
  if (idx === -1 || idx === stageOrder.length - 1) return toast("La venta ya está en la etapa final.");
  const prevEtapa = sale.etapa;
  sale.etapa = stageOrder[idx + 1];
  applyStageEffects(sale, sale.etapa, prevEtapa);
  addAudit(`Venta de ${sale.cliente} avanzó a ${sale.etapa}`);
  await saveState("Etapa avanzada");
  render();
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
  const logo = logoMarkup("settings-logo");
  return `
    <section class="card">
      <div class="card-head"><h2>Configuracion</h2><a class="btn ghost" href="/api/backup" download>Descargar backup</a></div>
      <div class="card-body">
        <form class="form-stack" data-action="settings">
          <div class="logo-config">
            <div>
              <label>Logo de la agencia</label>
              <p class="muted">Si no cargas un logo, la app queda sin logo.</p>
            </div>
            <div class="logo-config-preview">${logo || `<span class="muted">Sin logo</span>`}</div>
            <div class="toolbar" style="margin:0">
              <label class="btn ghost file-btn">
                Cargar logo
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-action="logo-upload">
              </label>
              ${s.logoDataUrl ? `<button class="btn ghost" type="button" data-action="logo-remove">Quitar logo</button>` : ""}
            </div>
          </div>
          <div class="form-grid">
            ${input("businessName", "Nombre de agencia", s.businessName || "Lake Motors")}
            ${input("ownerName", "Responsable", s.ownerName || "")}
            ${input("phone", "Telefono", s.phone || "")}
            ${input("email", "Email", s.email || "", "email")}
            ${input("address", "Direccion", s.address || "")}
            ${input("currency", "Moneda", s.currency || "ARS")}
          </div>
          <div class="toolbar">
            <button class="btn" type="submit">Guardar configuracion</button>
            <a class="btn ghost" href="/api/backup" download>Backup JSON</a>
            <button class="btn ghost" type="button" data-action="theme">Cambiar tema</button>
            <button class="btn danger" type="button" data-action="logout">Cerrar sesion</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function input(name, label, value, type = "text") {
  return fieldControl({ name, label, type, value });
}

function logoMarkup(className) {
  const src = state?.settings?.logoDataUrl || publicConfig.logoDataUrl || defaultLogoDataUrl || "/logo.png";
  return `<img class="${className}" src="${escapeHtml(src)}" alt="Lake Motors">`;
}

function formFor(key, row = {}) {
  const dynamicDef = Object.values(sectionData).find(def => def.key === key);
  const forms = {
    vehicles: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precio", "Precio", "number"], ["estado", "Estado"], ["ubicacion", "Ubicacion"], ["margen", "Margen", "number"], ["notas", "Notas", "textarea"]],
    clients: [["nombre", "Nombre"], ["telefono", "Telefono"], ["email", "Email", "email"], ["interes", "Interes"], ["origen", "Origen"], ["estado", "Estado"], ["notas", "Notas", "textarea"]],
    sales: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["vendedor", "Vendedor"], ["proximo", "Proximo contacto"], ["notas", "Notas", "textarea"]],
    paperwork: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"], ["vence", "Vence", "date"], ["notas", "Notas", "textarea"]],
    finance: [["concepto", "Concepto"], ["tipo", "Tipo"], ["monto", "Monto", "number"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]],
    messages: [["cliente", "Cliente"], ["plantilla", "Plantilla"], ["estado", "Estado"], ["hora", "Hora"], ["mensaje", "Mensaje", "textarea"]],
    calendar: [["fecha", "Fecha", "date"], ["hora", "Hora", "time"], ["tipo", "Tipo"], ["titulo", "Titulo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Notas", "textarea"]]
  };
  const fields = dynamicDef?.fields || forms[key] || forms.clients;
  if (key === "orders") return orderForm(row);
  if (key === "vehicles") {
    _vehiclePhotosBuf = (row.fotos || []).slice();
    return vehicleForm(row);
  }
  if (key === "consignments") {
    _vehiclePhotosBuf = (row.fotos || []).slice();
    return consignmentForm(row);
  }
  if (key === "quotes") {
    _vehiclePhotosBuf = (row.fotos || []).slice();
    if (!row.tipoOperacion) row = { tipoOperacion: "Venta", ...row };
    return groupedFormWithLinks(key, fields, row) + vehiclePhotoSection(row);
  }
  if (key === "sales") return salesForm(row);
  if (key === "clientDocs") return clientDocForm(row);
  const linkedKeys = ["paperwork", "calendar", "quotes", "files", "consignments"];
  if (linkedKeys.includes(key)) return groupedFormWithLinks(key, fields, row);
  return groupedForm(key, fields, row);
}

function openModal(key, row = {}) {
  const meta = modalMeta(key, row);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal">
        <div class="modal-head"><div><h2>${meta.title}</h2><p>${meta.subtitle}</p></div><button class="icon-btn" data-close>X</button></div>
        <form data-save="${key}" data-id="${row.id || ""}">
          ${formFor(key, row)}
          <div class="modal-actions">
            <button class="btn ghost" type="button" data-close>Cancelar</button>
            ${key === "quotes" && row.id ? `<button class="btn ghost" type="button" data-quote-pdf="${escapeHtml(row.id)}" title="Descargar PDF de esta cotizacion">Descargar PDF</button>` : ""}
            <button class="btn primary-action" type="submit">${meta.submit}</button>
          </div>
        </form>
      </section>
    </div>
  `);
  bindModal();
}

function modalMeta(key, row = {}) {
  const editing = Boolean(row.id);
  const label = labelForKey(key);
  const dynamicDef = Object.values(sectionData).find(def => def.key === key);
  const subtitles = {
    orders: "Cliente que vino preguntando por algo que todavia no tenemos en stock.",
    vehicles: "Unidad disponible, reservada, publicada o en preparacion.",
    clients: "Datos comerciales y seguimiento del cliente.",
    sales: "Datos completos de la venta: cliente, vehículo, forma de pago y cobros.",
    calendar: "Agenda de test drives, entregas, llamados y vencimientos.",
    paperwork: "Tramite administrativo vinculado a cliente y vehiculo.",
    finance: "Movimiento de caja, banco, ingreso o egreso.",
    messages: "Plantilla o mensaje operativo para enviar.",
    clientDocs: "Documento vinculado a la carpeta del cliente."
  };
  return {
    title: `${editing ? "Editar" : "Nuevo"} ${key === "orders" ? "pedido del cliente" : label}`,
    subtitle: subtitles[key] || `Carga y administracion de ${dynamicDef?.title || label}.`,
    submit: editing ? "Guardar cambios" : (key === "orders" ? "Cargar pedido" : `Cargar ${label}`)
  };
}

function groupedForm(key, fields, row = {}) {
  const sections = splitFields(key, fields, row);
  return sections.map(section => `
    <fieldset class="form-section">
      <legend>${section.icon ? `<span>${section.icon}</span>` : ""}${escapeHtml(section.title)}</legend>
      ${section.note ? `<p>${escapeHtml(section.note)}</p>` : ""}
      <div class="form-grid">${section.fields.map(field => fieldControl(field)).join("")}</div>
    </fieldset>
  `).join("");
}

function linkedClientSelectHtml(row = {}) {
  const clientOptions = [`<option value="">— Sin vincular cliente —</option>`]
    .concat((state.clients || []).map(c =>
      `<option value="${escapeHtml(c.id)}" ${c.id === (row.clienteId || "") ? "selected" : ""} data-name="${escapeHtml(c.nombre)}" data-phone="${escapeHtml(c.telefono || "")}">${escapeHtml(c.nombre)} · ${escapeHtml(c.telefono || "")}</option>`
    ))
    .join("");
  return `<div class="field full"><label>Cliente del sistema (opcional)</label><select name="clienteId" data-client-link>${clientOptions}</select><small>Al elegir un cliente se autocompletan nombre y telefono en los campos de abajo</small></div>`;
}

function linkedVehicleSelectHtml(row = {}, moduleKey = "") {
  const vehicleOptions = [`<option value="">— Vehiculo fuera de stock / cotizacion externa —</option>`]
    .concat((state.vehicles || []).map(v => {
      const nombre = `${v.marca || ""} ${v.modelo || ""}`.trim();
      const label = `${nombre}${v.dominio ? ` (${v.dominio})` : ""} — ${money(v.precio)}`;
      return `<option value="${escapeHtml(v.id)}" ${v.id === (row.vehiculoId || "") ? "selected" : ""} data-nombre="${escapeHtml(nombre)}" data-dominio="${escapeHtml(v.dominio || "")}" data-precio="${v.precio || 0}">${escapeHtml(label)}</option>`;
    }))
    .join("");
  return `<div class="field full"><label>Vehiculo del stock (opcional)</label><select name="vehiculoId" data-vehicle-link>${vehicleOptions}</select><small>Elige un auto del stock para autocompletar nombre y precio. Si el auto no es tuyo todavia, deja esta opcion y completa los campos a mano.</small></div>`;
}

function groupedFormWithLinks(key, fields, row = {}) {
  const normalized = fields.map(field => normalizeField(field, row, key));
  const mainFields = normalized.filter(f => !/notas|detalle|comentario|mensaje/i.test(f.name));
  const noteFields = normalized.filter(f => /notas|detalle|comentario|mensaje/i.test(f.name));
  const clientSel = linkedClientSelectHtml(row);
  const vehicleSel = linkedVehicleSelectHtml(row, key);
  const mainHtml = mainFields.map(f => {
    let prefix = "";
    if (f.name === "cliente" || f.name === "titular") prefix = clientSel;
    if (f.name === "vehiculo") prefix = vehicleSel;
    return prefix + fieldControl(f);
  }).join("");
  const noteHtml = noteFields.map(f => fieldControl(f)).join("");
  return `
    <fieldset class="form-section">
      <legend><span>${escapeHtml(iconForKey(key))}</span>${escapeHtml(sectionTitleForKey(key))}</legend>
      <div class="form-grid">${mainHtml}</div>
    </fieldset>
    ${noteHtml ? `<fieldset class="form-section"><legend><span>-</span>OBSERVACIONES</legend><div class="form-grid">${noteHtml}</div></fieldset>` : ""}
  `;
}

function salesForm(row = {}) {
  const clients = state.clients || [];
  const availableVehicles = (state.vehicles || []).filter(v =>
    /^(Disponible|Publicado|Reservado)$/i.test(v.estado || "") || v.id === (row.vehiculoId || "")
  );
  const staffListId = "list-vendedor-sales";
  const staffOpts = staffNames().map(n => `<option value="${escapeHtml(n)}"></option>`).join("");
  const existingClient = clients.find(c => c.id === (row.clienteId || ""));

  const clientSection = clients.length === 0
    ? `<div class="field full"><div class="sales-hint">Primero cargá el cliente en el módulo <strong>Clientes</strong> antes de crear una venta.</div></div>`
    : `<div class="field full">
        <label>Cliente *</label>
        <select name="clienteId" required data-sales-client>
          <option value="">— Seleccioná un cliente —</option>
          ${clients.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === (row.clienteId || "") ? "selected" : ""}
            data-nombre="${escapeHtml(c.nombre)}"
            data-phone="${escapeHtml(c.telefono || "")}"
            data-email="${escapeHtml(c.email || "")}"
            >${escapeHtml(c.nombre)}${c.telefono ? ` · ${escapeHtml(c.telefono)}` : ""}</option>`).join("")}
        </select>
        <input type="hidden" name="cliente" value="${escapeHtml(row.cliente || existingClient?.nombre || "")}">
        <div id="sf-client-info" style="font-size:12px;color:var(--muted);margin-top:4px">
          ${existingClient ? `Tel: ${escapeHtml(existingClient.telefono || "—")} · Email: ${escapeHtml(existingClient.email || "—")}` : ""}
        </div>
      </div>`;

  const vehicleSection = availableVehicles.length === 0
    ? `<div class="field full"><div class="sales-hint">No hay vehículos disponibles en Stock. Cargá uno en el módulo <strong>Stock</strong> primero.</div></div>`
    : `<div class="field full">
        <label>Vehículo *</label>
        <select name="vehiculoId" required data-sales-vehicle>
          <option value="">— Seleccioná un vehículo —</option>
          ${availableVehicles.map(v => {
            const nombre = `${v.marca || ""} ${v.modelo || ""}${v.version ? " " + v.version : ""}`.trim();
            const label = `${nombre}${v.dominio ? ` (${v.dominio})` : ""} — ${money(v.precio)}`;
            return `<option value="${escapeHtml(v.id)}" ${v.id === (row.vehiculoId || "") ? "selected" : ""}
              data-nombre="${escapeHtml(nombre)}"
              data-precio="${v.precio || 0}"
              >${escapeHtml(label)}</option>`;
          }).join("")}
        </select>
        <input type="hidden" name="vehiculo" value="${escapeHtml(row.vehiculo || "")}">
        <small>Solo vehículos Disponible / Publicado / Reservado. El precio se autocompleta del stock.</small>
      </div>`;

  const stages = ["Contacto", "Tasacion", "Reserva", "Cierre", "Perdida"];
  const formaPago = row.formaPago || "Contado";
  const showCuotas = formaPago === "Cuotas";
  const showPermuta = formaPago === "Permuta";
  const anticipo = Number(row.anticipo || row.sena || 0);
  const showAnticipo = anticipo > 0;
  const availablePermutaQuotes = (state.quotes || []).filter(q =>
    q.tipoOperacion === "Recibir vehiculo" && q.estado !== "Vendido" && q.estado !== "Cancelada"
  );
  const selectedPermuta = availablePermutaQuotes.find(q => q.id === (row.cotizacionPermutaId || ""));
  const permutaMonto = Number(selectedPermuta?.monto || 0);
  const saldoTrasPermuta = Math.max(0, Number(row.monto || 0) - permutaMonto);

  return `
    <fieldset class="form-section">
      <legend><span>+</span>CLIENTE</legend>
      <div class="form-grid">${clientSection}</div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>A</span>VEHÍCULO</legend>
      <div class="form-grid">${vehicleSection}</div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>$</span>OPERACIÓN</legend>
      <div class="form-grid">
        <div class="field">
          <label>Monto total *</label>
          <input name="monto" id="sf-monto" type="number" required value="${row.monto || ""}" placeholder="0" min="0">
        </div>
        <div class="field">
          <label>Moneda</label>
          <select name="moneda">
            <option ${(row.moneda || "ARS") === "ARS" ? "selected" : ""}>ARS</option>
            <option ${(row.moneda || "") === "USD" ? "selected" : ""}>USD</option>
          </select>
        </div>
        <div class="field">
          <label>Forma de pago</label>
          <select name="formaPago" id="sf-forma-pago">
            ${["Contado", "Financiado", "Cuotas", "Permuta"].map(o => `<option ${formaPago === o ? "selected" : ""}>${o}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Etapa</label>
          <select name="etapa">${stages.map(s => `<option ${(row.etapa || "Contacto") === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Vendedor</label>
          <input name="vendedor" list="${staffListId}" value="${escapeHtml(row.vendedor || authUser?.name || "")}">
          <datalist id="${staffListId}">${staffOpts}</datalist>
        </div>
        <div class="field">
          <label>Fecha de operación</label>
          <input name="fecha" type="date" value="${escapeHtml(row.fecha || todayKey())}">
        </div>
      </div>
      <div id="sf-cuotas-section" style="display:${showCuotas ? "" : "none"}">
        <div class="form-grid" style="margin-top:12px">
          <div class="field">
            <label>Cantidad de cuotas</label>
            <input name="cantCuotas" id="sf-cant-cuotas" type="number" min="1" value="${escapeHtml(String(row.cantCuotas || ""))}">
          </div>
          <div class="field">
            <label>Monto por cuota</label>
            <input name="montoCuota" id="sf-monto-cuota" type="number" min="0" value="${escapeHtml(String(row.montoCuota || ""))}">
            <small>Auto: (monto − anticipo) ÷ cuotas</small>
          </div>
        </div>
      </div>
      <div id="sf-permuta-section" style="display:${showPermuta ? "" : "none"}">
        <div class="form-grid" style="margin-top:12px">
          <div class="field full">
            <label>Cotizacion de permuta</label>
            <select name="cotizacionPermutaId" id="sf-cotizacion-permuta">
              <option value="">— Seleccioná una cotizacion de recepcion —</option>
              ${availablePermutaQuotes.map(q => `<option value="${escapeHtml(q.id)}" data-monto="${q.monto || 0}" ${(row.cotizacionPermutaId || "") === q.id ? "selected" : ""}>${escapeHtml(q.vehiculo || q.cliente || q.id)} — ${money(q.monto)}</option>`).join("")}
            </select>
            <small>Solo cotizaciones de tipo "Recibir vehiculo" activas.</small>
          </div>
          <div class="field">
            <label>Valor de la permuta</label>
            <input type="text" id="sf-permuta-valor" value="${permutaMonto ? money(permutaMonto) : "—"}" readonly style="background:var(--surface2);color:var(--muted)">
          </div>
          <div class="field">
            <label>Saldo a cobrar (monto − permuta)</label>
            <input type="text" id="sf-permuta-saldo" value="${showPermuta && permutaMonto ? money(saldoTrasPermuta) : "—"}" readonly style="background:var(--surface2);color:var(--accent);font-weight:700">
          </div>
        </div>
        <input type="hidden" name="cotizacionPermutaRef" value="${escapeHtml(selectedPermuta?.vehiculo || selectedPermuta?.cliente || "")}">
      </div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>A</span>ANTICIPO / ENTREGA</legend>
      <div class="form-grid">
        <div class="field full">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal">
            <input type="checkbox" id="sf-tiene-anticipo" name="tieneAnticipo" value="1" ${showAnticipo ? "checked" : ""} style="width:auto;margin:0">
            El cliente entrega dinero ahora (seña / anticipo)
          </label>
        </div>
      </div>
      <div id="sf-anticipo-section" style="display:${showAnticipo ? "" : "none"}">
        <div class="form-grid" style="margin-top:12px">
          <div class="field">
            <label>Monto del anticipo</label>
            <input name="anticipo" id="sf-anticipo" type="number" min="0" value="${escapeHtml(String(anticipo || ""))}">
          </div>
          <div class="field">
            <label>Medio de pago</label>
            <select name="medioAnticipo">
              ${["Efectivo", "Transferencia", "Tarjeta", "Cheque"].map(o => `<option ${(row.medioAnticipo || "Efectivo") === o ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>-</span>NOTAS</legend>
      <div class="form-grid">
        <div class="field full"><textarea name="notas" placeholder="Condiciones especiales, observaciones...">${escapeHtml(row.notas || "")}</textarea></div>
      </div>
    </fieldset>
    <input type="hidden" name="quoteRef" value="${escapeHtml(row.quoteRef || "")}">
  `;
}

function clientDocForm(row = {}) {
  const tiposDoc = ["DNI", "Cédula verde", "Cédula azul", "Contrato", "Factura", "Recibo", "Poder notarial", "CUIL/CUIT", "Domicilio", "Otro"];
  const estados = ["Recibido", "Pendiente", "Vencido", "Archivado"];
  const hasFile = row.archivoNombre && row.archivo;
  return `
    <fieldset class="form-section">
      <legend><span>D</span>DOCUMENTO</legend>
      <div class="form-grid">
        <input type="hidden" name="clienteId" value="${escapeHtml(row.clienteId || '')}">
        <input type="hidden" name="cliente" value="${escapeHtml(row.cliente || '')}">
        <div class="field">
          <label>Tipo de documento</label>
          <select name="tipo">${tiposDoc.map(t => `<option ${(row.tipo || "DNI") === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Nombre / descripcion</label>
          <input name="nombre" value="${escapeHtml(row.nombre || '')}" placeholder="Ej: DNI frente, Contrato de compraventa" required>
        </div>
        <div class="field">
          <label>Fecha</label>
          <input name="fecha" type="date" value="${escapeHtml(row.fecha || todayKey())}">
        </div>
        <div class="field">
          <label>Estado</label>
          <select name="estado">${estados.map(e => `<option ${(row.estado || "Recibido") === e ? "selected" : ""}>${escapeHtml(e)}</option>`).join("")}</select>
        </div>
        <div class="field full">
          <label>Notas</label>
          <textarea name="notas">${escapeHtml(row.notas || '')}</textarea>
        </div>
      </div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>+</span>ARCHIVO ADJUNTO</legend>
      <div class="form-grid">
        <div class="field full">
          ${hasFile ? `<div class="doc-file-current"><span class="pill ok">Archivo actual: ${escapeHtml(row.archivoNombre)}</span></div>` : ""}
          <label class="btn ghost file-btn" style="width:fit-content;margin-top:6px">
            ${hasFile ? "Reemplazar archivo" : "Seleccionar archivo"}
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" data-action="doc-file-upload">
          </label>
          <small id="doc-file-label" style="margin-top:8px;display:block">${hasFile ? `Archivo cargado: ${escapeHtml(row.archivoNombre)}` : "Sin archivo — PDF, imagen o Word, máx 5 MB"}</small>
          <input type="hidden" name="archivo" value="${escapeHtml(row.archivo || '')}">
          <input type="hidden" name="archivoNombre" value="${escapeHtml(row.archivoNombre || '')}">
          <input type="hidden" name="archivoTipo" value="${escapeHtml(row.archivoTipo || '')}">
        </div>
      </div>
    </fieldset>
  `;
}

function consignmentForm(row = {}) {
  const clientOptions = [`<option value="">— Titular no vinculado —</option>`]
    .concat((state.clients || []).map(c =>
      `<option value="${escapeHtml(c.id)}" ${c.id === (row.clienteId || "") ? "selected" : ""} data-name="${escapeHtml(c.nombre)}" data-phone="${escapeHtml(c.telefono || "")}">${escapeHtml(c.nombre)} · ${escapeHtml(c.telefono || "")}</option>`
    )).join("");

  const sel = (name, label, opts, val) =>
    fieldControl({ name, label, type: "select", options: opts, value: val !== undefined && val !== null && val !== "" ? val : (row[name] ?? opts[0]) });
  const inp = (name, label, extra = {}) =>
    fieldControl({ name, label, value: row[name] ?? "", ...extra });
  const mon = (name, label) =>
    fieldControl({ name, label, type: "money", value: row[name] ?? "" });
  const area = (name, label, val, placeholder = "") =>
    fieldControl({ name, label, type: "textarea", value: val ?? "", placeholder, wide: true });

  const marcaListId = `list-marca-cs-${Math.random().toString(36).slice(2)}`;
  const modeloListId = `list-modelo-cs-${Math.random().toString(36).slice(2)}`;
  const marcaOpts = Object.keys(catalogoVehiculos).sort().map(m => `<option value="${escapeHtml(m)}"></option>`).join("");
  const modeloOpts = (catalogoVehiculos[row.marca || ""] || []).map(m => `<option value="${escapeHtml(m)}"></option>`).join("");

  const cubiertaLabels = [["cubiertaDelIzq","Del. Izq."],["cubiertaDelDer","Del. Der."],["cubiertaTraIzq","Tras. Izq."],["cubiertaTraDer","Tras. Der."]];
  const cubiertasHtml = cubiertaLabels.map(([name, lbl]) => {
    const val = row[name] || "Buena";
    return `<div class="field"><label>Cubierta ${escapeHtml(lbl)}</label><select name="${name}">${["Buena","Regular","Cambiar"].map(o => `<option${val===o?" selected":""}>${o}</option>`).join("")}</select></div>`;
  }).join("");

  return `
    <fieldset class="form-section">
      <legend><span>C</span>TITULAR Y VEHICULO</legend>
      <div class="field full">
        <label>Cliente vinculado (opcional)</label>
        <select name="clienteId" data-client-link>${clientOptions}</select>
        <small>Autocompleta nombre y telefono</small>
      </div>
      <div class="form-grid">
        ${inp("titular", "Nombre del titular *", { type: "datalist", options: clientNames(), placeholder: "Nombre y apellido", required: true })}
        ${inp("telefono", "Telefono", { type: "datalist", options: (state?.clients || []).map(c => c.telefono).filter(Boolean), placeholder: "+54 11 5555 5555" })}
        <div class="field"><label>Marca *</label><input name="marca" list="${marcaListId}" value="${escapeHtml(row.marca || "")}" data-marca-input placeholder="Ej. Toyota" required><datalist id="${marcaListId}">${marcaOpts}</datalist></div>
        <div class="field"><label>Modelo</label><input name="modelo" list="${modeloListId}" value="${escapeHtml(row.modelo || "")}" data-modelo-input placeholder="Ej. Corolla XEI"><datalist id="${modeloListId}">${modeloOpts}</datalist></div>
        ${inp("version", "Version / Trim", { placeholder: "Ej. 1.8 XEI AT" })}
        ${inp("dominio", "Dominio", { placeholder: "AE000AA" })}
        ${inp("anio", "Año", { type: "number", placeholder: String(new Date().getFullYear()) })}
        ${inp("km", "Kilometros", { type: "number", placeholder: "50000" })}
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend><span>$</span>DATOS ECONOMICOS</legend>
      <div class="form-grid">
        ${mon("precioPretendido", "Precio que pretende el titular")}
        ${mon("comision", "Comision de agencia")}
        ${inp("vence", "Fecha limite consignacion", { type: "date" })}
        ${sel("estado", "Estado", ["Activa", "Vendida", "Devuelta", "Vencida"], row.estado)}
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend><span>1</span>PERITAJE — 1. Identificacion del vehiculo</legend>
      <div class="form-grid">
        ${inp("numeroMotor", "N° Motor", { placeholder: "Ej. F18A1-1234567" })}
        ${inp("numeroChasis", "N° Chasis", { placeholder: "Ej. 9BWZZZ377VT004251" })}
        ${inp("numeroVin", "N° VIN", { placeholder: "17 caracteres" })}
        ${sel("coincideDocumentacion", "Coincide con titulo / cedula", ["Sin verificar", "Si", "No"], row.coincideDocumentacion)}
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend><span>2</span>PERITAJE — 2. Toma de improntas</legend>
      <div class="form-grid">
        ${sel("improntasTomadas", "Improntas tomadas (motor/chasis/VIN)", ["No", "Si"], row.improntasTomadas)}
      </div>
      <p class="muted" style="margin:8px 16px 12px;font-size:12px">La evidencia fotografica de las improntas se puede cargar en la seccion de fotos mas abajo.</p>
    </fieldset>

    <fieldset class="form-section">
      <legend><span>3</span>PERITAJE — 3. Revision fisica y estructural</legend>
      <div class="form-grid">
        ${sel("estadoChapa", "Estado de chapa y pintura", ["Excelente", "Bueno", "Regular", "Con detalles"], row.estadoChapa)}
        ${area("detalleChapa", "Detalle de chapa (golpes, rayones, zonas)", row.detalleChapa, "Ej. Rayones puerta trasera izq., golpe paragolpes delantero")}
        ${sel("danosEstructurales", "Danos estructurales evidentes", ["No", "Si"], row.danosEstructurales)}
        ${area("detalleDanosEstructurales", "Detalle de danos estructurales", row.detalleDanosEstructurales, "Descripcion de danos y zonas afectadas")}
        ${sel("modificacionesNoAutorizadas", "Modificaciones no autorizadas", ["No", "Si"], row.modificacionesNoAutorizadas)}
        ${sel("nivelCombustible", "Nivel de combustible", ["Vacio", "Reserva", "1/4", "1/2", "3/4", "Lleno"], row.nivelCombustible)}
      </div>
      <div class="form-grid" style="margin-top:4px">
        ${cubiertasHtml}
        ${sel("auxilio", "Rueda de auxilio", ["Si", "No", "Usada"], row.auxilio)}
        ${inp("cantidadLlaves", "Cantidad de llaves", { type: "number", placeholder: "2" })}
      </div>
      ${area("estadoMecanico", "Estado mecanico (motor, caja, frenos, suspension)", row.estadoMecanico, "Estado general del motor, caja de cambios, frenos, suspension")}
    </fieldset>

    <fieldset class="form-section">
      <legend><span>4</span>PERITAJE — 4. Comparacion con bases de datos</legend>
      <div class="form-grid">
        ${sel("reporteRobo", "Reporte de robo", ["Sin verificar", "Sin registro", "Con alerta"], row.reporteRobo)}
        ${sel("embargoPrenda", "Embargo / Prenda", ["Sin verificar", "Sin registro", "Con gravamen"], row.embargoPrenda)}
        ${sel("siniestrosAnteriores", "Siniestros anteriores", ["Sin verificar", "Sin registro", "Con antecedentes"], row.siniestrosAnteriores)}
        ${area("detalleSiniestros", "Detalle de siniestros", row.detalleSiniestros, "Descripcion de antecedentes de siniestros")}
        ${sel("limitacionesPropiedad", "Limitaciones a la propiedad", ["Sin verificar", "Sin registro", "Con limitacion"], row.limitacionesPropiedad)}
      </div>
      <p class="muted" style="margin:8px 16px 12px;font-size:12px">Datos de consulta al Registro de la Propiedad Automotor u otra fuente externa — la app no lo hace automatico.</p>
    </fieldset>

    <fieldset class="form-section">
      <legend><span>5</span>PERITAJE — 5. Documentacion y accesorios</legend>
      <div class="form-grid">
        ${sel("documentacion", "Documentacion (titulo / cedula)", ["Sin verificar", "Completa", "Incompleta"], row.documentacion)}
        ${sel("vtvVigente", "VTV vigente", ["Sin verificar", "Si", "No", "No aplica"], row.vtvVigente)}
        ${sel("seguroVigente", "Seguro vigente", ["Si", "No"], row.seguroVigente)}
        ${sel("matafuego", "Matafuego", ["Si", "No", "Vencido"], row.matafuego)}
        ${sel("balizas", "Balizas / triangulos", ["Si", "No"], row.balizas)}
        ${sel("llaveRuedaGato", "Llave de ruedas y gato", ["Si", "No"], row.llaveRuedaGato)}
      </div>
    </fieldset>

    ${vehiclePhotoSection(row)}

    <fieldset class="form-section">
      <legend><span>-</span>OBSERVACIONES GENERALES</legend>
      <div class="form-grid">
        ${area("notas", "Notas generales", row.notas, "Condiciones particulares, acuerdos, estado general o cualquier informacion adicional")}
      </div>
    </fieldset>
  `;
}

function peritajeFieldsets(row = {}) {
  const sel = (name, label, opts, val) =>
    fieldControl({ name, label, type: "select", options: opts, value: (val !== undefined && val !== null && val !== "") ? val : (row[name] ?? opts[0]) });
  const inp = (name, label, extra = {}) =>
    fieldControl({ name, label, value: row[name] ?? "", ...extra });
  const area = (name, label, val, ph = "") =>
    fieldControl({ name, label, type: "textarea", value: val ?? "", placeholder: ph, wide: true });
  const cubiertaLabels = [["cubiertaDelIzq","Del. Izq."],["cubiertaDelDer","Del. Der."],["cubiertaTraIzq","Tras. Izq."],["cubiertaTraDer","Tras. Der."]];
  const cubiertasHtml = cubiertaLabels.map(([name, lbl]) => {
    const val = row[name] || "Buena";
    return `<div class="field"><label>Cubierta ${escapeHtml(lbl)}</label><select name="${name}">${["Buena","Regular","Cambiar"].map(o => `<option${val===o?" selected":""}>${o}</option>`).join("")}</select></div>`;
  }).join("");
  return `
    <fieldset class="form-section">
      <legend><span>1</span>IDENTIFICACION DEL VEHICULO</legend>
      <div class="form-grid">
        ${inp("numeroMotor","N° Motor",{placeholder:"Ej. F18A1-1234567"})}
        ${inp("numeroChasis","N° Chasis",{placeholder:"Ej. 9BWZZZ377VT004251"})}
        ${inp("numeroVin","N° VIN",{placeholder:"17 caracteres"})}
        ${sel("coincideDocumentacion","Coincide con titulo / cedula",["Sin verificar","Si","No"],row.coincideDocumentacion)}
      </div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>2</span>TOMA DE IMPRONTAS</legend>
      <div class="form-grid">
        ${sel("improntasTomadas","Improntas tomadas (motor/chasis/VIN)",["No","Si"],row.improntasTomadas)}
      </div>
      <p class="muted" style="margin:8px 16px 12px;font-size:12px">La evidencia fotografica de las improntas se puede cargar en la seccion de fotos mas arriba.</p>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>3</span>REVISION FISICA Y ESTRUCTURAL</legend>
      <div class="form-grid">
        ${sel("estadoChapa","Estado de chapa y pintura",["Excelente","Bueno","Regular","Con detalles"],row.estadoChapa)}
        ${area("detalleChapa","Detalle de chapa (golpes, rayones, zonas)",row.detalleChapa,"Ej. Rayones puerta trasera izq., golpe paragolpes delantero")}
        ${sel("danosEstructurales","Danos estructurales evidentes",["No","Si"],row.danosEstructurales)}
        ${area("detalleDanosEstructurales","Detalle de danos estructurales",row.detalleDanosEstructurales,"Descripcion de danos y zonas afectadas")}
        ${sel("modificacionesNoAutorizadas","Modificaciones no autorizadas",["No","Si"],row.modificacionesNoAutorizadas)}
        ${sel("nivelCombustible","Nivel de combustible",["Vacio","Reserva","1/4","1/2","3/4","Lleno"],row.nivelCombustible)}
      </div>
      <div class="form-grid" style="margin-top:4px">
        ${cubiertasHtml}
        ${sel("auxilio","Rueda de auxilio",["Si","No","Usada"],row.auxilio)}
        ${inp("cantidadLlaves","Cantidad de llaves",{type:"number",placeholder:"2"})}
      </div>
      ${area("estadoMecanico","Estado mecanico (motor, caja, frenos, suspension)",row.estadoMecanico,"Estado general del motor, caja de cambios, frenos, suspension")}
    </fieldset>
    <fieldset class="form-section">
      <legend><span>4</span>COMPARACION CON BASES DE DATOS</legend>
      <div class="form-grid">
        ${sel("reporteRobo","Reporte de robo",["Sin verificar","Sin registro","Con alerta"],row.reporteRobo)}
        ${sel("embargoPrenda","Embargo / Prenda",["Sin verificar","Sin registro","Con gravamen"],row.embargoPrenda)}
        ${sel("siniestrosAnteriores","Siniestros anteriores",["Sin verificar","Sin registro","Con antecedentes"],row.siniestrosAnteriores)}
        ${area("detalleSiniestros","Detalle de siniestros",row.detalleSiniestros,"Descripcion de antecedentes de siniestros")}
        ${sel("limitacionesPropiedad","Limitaciones a la propiedad",["Sin verificar","Sin registro","Con limitacion"],row.limitacionesPropiedad)}
      </div>
      <p class="muted" style="margin:8px 16px 12px;font-size:12px">Datos de consulta al Registro de la Propiedad Automotor u otra fuente externa.</p>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>5</span>DOCUMENTACION Y ACCESORIOS</legend>
      <div class="form-grid">
        ${sel("documentacion","Documentacion (titulo / cedula)",["Sin verificar","Completa","Incompleta"],row.documentacion)}
        ${sel("vtvVigente","VTV vigente",["Sin verificar","Si","No","No aplica"],row.vtvVigente)}
        ${sel("seguroVigente","Seguro vigente",["Si","No"],row.seguroVigente)}
        ${sel("matafuego","Matafuego",["Si","No","Vencido"],row.matafuego)}
        ${sel("balizas","Balizas / triangulos",["Si","No"],row.balizas)}
        ${sel("llaveRuedaGato","Llave de ruedas y gato",["Si","No"],row.llaveRuedaGato)}
      </div>
    </fieldset>
  `;
}

function vehicleForm(row = {}) {
  const condicion = row.condicion || (row.id && Number(row.km) > 0 ? "Usado" : (!row.id ? "0km" : "Usado"));
  const is0km = condicion === "0km";

  const inp = (name, label, extra = {}) =>
    fieldControl({ name, label, value: row[name] ?? "", ...extra });
  const mon = (name, label) =>
    fieldControl({ name, label, type: "money", value: row[name] ?? "" });
  const area = (name, label, val, placeholder = "") =>
    fieldControl({ name, label, type: "textarea", value: val ?? "", placeholder, wide: true });

  const marcaListId = `list-marca-veh-${Math.random().toString(36).slice(2)}`;
  const modeloListId = `list-modelo-veh-${Math.random().toString(36).slice(2)}`;
  const marcaOpts = Object.keys(catalogoVehiculos).sort().map(m => `<option value="${escapeHtml(m)}"></option>`).join("");
  const modeloOpts = (catalogoVehiculos[row.marca || ""] || []).map(m => `<option value="${escapeHtml(m)}"></option>`).join("");

  const hasPeritaje = !!(row.numeroMotor || row.estadoChapa || row.reporteRobo || row.numeroVin);

  return `
    <fieldset class="form-section">
      <legend><span>A</span>VEHICULO</legend>
      <div class="field full" style="display:flex;gap:20px;align-items:center;padding:4px 0 8px">
        <span style="font-weight:600;font-size:13px">Condicion:</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
          <input type="radio" name="condicion" value="0km" ${is0km?"checked":""} data-condicion-radio> 0km (nuevo)
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
          <input type="radio" name="condicion" value="Usado" ${!is0km?"checked":""} data-condicion-radio> Usado
        </label>
      </div>
      <div class="form-grid">
        ${inp("dominio","Dominio",{placeholder:"AE000AA"})}
        <div class="field"><label>Marca *</label><input name="marca" list="${marcaListId}" value="${escapeHtml(row.marca||"")}" data-marca-input placeholder="Ej. Toyota" required><datalist id="${marcaListId}">${marcaOpts}</datalist></div>
        <div class="field"><label>Modelo</label><input name="modelo" list="${modeloListId}" value="${escapeHtml(row.modelo||"")}" data-modelo-input placeholder="Ej. Corolla XEI"><datalist id="${modeloListId}">${modeloOpts}</datalist></div>
        ${inp("version","Version / Trim",{placeholder:"Ej. 1.8 XEI AT"})}
        ${inp("anio","Año",{type:"number",placeholder:String(new Date().getFullYear())})}
        <div class="field" id="km-field-wrap" ${is0km?'style="display:none"':""}>
          <label>Kilometros</label>
          <input name="km" id="km-input" type="number" placeholder="50000" value="${escapeHtml(String(row.km ?? (is0km?"0":"")))}">
        </div>
        ${mon("precio","Precio")}
        ${fieldControl({name:"moneda",label:"Moneda",type:"select",options:["ARS","USD"],value:row.moneda||"ARS"})}
        ${fieldControl({name:"estado",label:"Estado",type:"select",options:["Disponible","Publicado","Reservado","Preparacion"],value:row.estado||"Disponible"})}
        ${inp("ubicacion","Ubicacion",{placeholder:"Salon, deposito, taller..."})}
        ${fieldControl({name:"origen",label:"Origen",type:"select",options:["WhatsApp","Instagram","MercadoLibre","Salon","Referido","Web","Concesionaria","Particular"],value:row.origen||"Salon"})}
        ${mon("margen","Margen")}
      </div>
      ${area("notas","Notas",row.notas,"Notas internas, condiciones, urgencia o proximo paso.")}
    </fieldset>

    ${vehiclePhotoSection(row)}

    <fieldset class="form-section" style="border:2px dashed var(--border)">
      <legend style="cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;width:100%" data-toggle-peritaje>
        <span style="display:flex;align-items:center;gap:8px"><span style="background:var(--accent);color:#fff;border-radius:4px;padding:0 6px;font-size:11px">P</span>PERITAJE VEHICULAR</span>
        <span style="font-size:11px;color:var(--muted);font-weight:400" id="peritaje-toggle-label">${hasPeritaje?"▲ Ocultar peritaje":"▼ Completar peritaje"}</span>
      </legend>
      <div id="peritaje-body" ${hasPeritaje?"":'style="display:none"'}>
        ${peritajeFieldsets(row)}
      </div>
    </fieldset>
  `;
}

function orderForm(row = {}) {
  const clientValue = row.clienteId || "";
  const clientOptions = [`<option value="">— Cliente nuevo / no vinculado —</option>`]
    .concat((state.clients || []).map(client => `<option value="${escapeHtml(client.id)}" ${client.id === clientValue ? "selected" : ""} data-name="${escapeHtml(client.nombre)}" data-phone="${escapeHtml(client.telefono)}">${escapeHtml(client.nombre)} · ${escapeHtml(client.telefono)}</option>`))
    .join("");
  return `
    <fieldset class="form-section">
      <legend><span>+</span>CLIENTE</legend>
      <div class="field full"><label>Cliente vinculado (opcional)</label><select name="clienteId" data-client-link>${clientOptions}</select><small>Autocompleta nombre + telefono</small></div>
      <div class="form-grid">
        ${fieldControl({ name: "cliente", label: "Nombre cliente", required: true, placeholder: "Nombre y apellido", value: row.cliente || "" })}
        ${fieldControl({ name: "telefono", label: "Telefono", placeholder: "+54 11 5555 5555", value: row.telefono || "" })}
      </div>
    </fieldset>
    <fieldset class="form-section">
      <legend><span>*</span>AUTO BUSCADO</legend>
      <div class="form-grid">
        ${fieldControl({ name: "marca", label: "Marca", required: true, value: row.marca || "", ...fieldConfig("marca") })}
        ${fieldControl({ name: "modelo", label: "Modelo", value: row.modelo || "", ...fieldConfig("modelo") })}
        ${fieldControl({ name: "anioDesde", label: "Anio desde", type: "number", placeholder: "2020", value: row.anioDesde || "" })}
        ${fieldControl({ name: "anioHasta", label: "Anio hasta", type: "number", placeholder: "2024", value: row.anioHasta || "" })}
        ${fieldControl({ name: "presupuesto", label: "Presupuesto maximo", type: "number", placeholder: "50000", value: row.presupuesto || "" })}
        ${fieldControl({ name: "moneda", label: "Moneda", type: "select", options: ["USD", "ARS"], value: row.moneda || "USD" })}
        ${fieldControl({ name: "vendedor", label: "Vendedor que tomo el pedido", placeholder: "Gastoonfloori", value: row.vendedor || authUser?.name || "Gastoonfloori" })}
        ${fieldControl({ name: "estado", label: "Estado", type: "select", options: ["Activo", "Buscando", "Pausado", "Con match", "Cerrado"], value: row.estado || "Activo" })}
        ${fieldControl({ name: "notas", label: "Notas", type: "textarea", placeholder: "Color preferido, equipamiento, urgencia, etc.", value: row.notas || "", wide: true })}
      </div>
    </fieldset>
  `;
}

function splitFields(key, fields, row = {}) {
  const normalized = fields.map(field => normalizeField(field, row, key));
  if (["vehicles", "clients", "sales", "calendar", "paperwork", "finance", "messages"].includes(key)) {
    return [{ title: sectionTitleForKey(key), icon: iconForKey(key), fields: normalized }];
  }
  const main = normalized.filter(field => !/notas|detalle|comentario|mensaje/i.test(field.name));
  const notes = normalized.filter(field => /notas|detalle|comentario|mensaje/i.test(field.name));
  return [
    { title: sectionTitleForKey(key), icon: iconForKey(key), fields: main },
    ...(notes.length ? [{ title: "OBSERVACIONES", icon: "-", fields: notes }] : [])
  ];
}

function sectionTitleForKey(key) {
  return ({
    vehicles: "VEHICULO",
    clients: "CLIENTE",
    sales: "OPERACION",
    calendar: "AGENDA",
    paperwork: "GESTORIA",
    finance: "MOVIMIENTO",
    messages: "MENSAJE"
  }[key] || "DATOS");
}

function iconForKey(key) {
  return ({ vehicles: "A", clients: "+", sales: "$", calendar: "CL", paperwork: "G", finance: "$", messages: "M" }[key] || "*");
}

function normalizeField(field, row = {}, moduleKey = "") {
  const [name, label, type = "text"] = field;
  const config = fieldConfig(name, moduleKey);
  return { name, label, type, value: row[name] ?? config.value ?? "", ...config };
}

function fieldConfig(name, moduleKey = "") {
  const common = {
    estado: { type: "select", options: statusOptions(moduleKey) },
    prioridad: { type: "select", options: ["Alta", "Media", "Baja", "Urgente"] },
    tipo: { type: "select", options: ["Ingreso", "Egreso", "Test drive", "Entrega", "Llamado", "Gestoria", "Tasacion"] },
    moneda: { type: "select", options: ["ARS", "USD"] },
    etapa: { type: "select", options: ["Contacto", "Tasacion", "Reserva", "Cierre"] },
    canal: { type: "select", options: ["WhatsApp", "Telefono", "Email", "Salon", "Instagram", "MercadoLibre"] },
    origen: { type: "select", options: ["WhatsApp", "Instagram", "MercadoLibre", "Salon", "Referido", "Web"] },
    urgencia: { type: "select", options: ["Alta", "Media", "Baja"] },
    match: { type: "select", options: ["Sin match", "Posible", "Exacto", "Enviado"] },
    probabilidad: { type: "select", options: ["Alta", "Media", "Baja"] },
    tipoOperacion: { type: "select", options: ["Venta", "Recibir vehiculo"] },
    precio: { type: "money" },
    monto: { type: "money" },
    sena: { type: "money" },
    anticipo: { type: "money" },
    montoCuota: { type: "money" },
    precioPretendido: { type: "money" },
    comision: { type: "money" },
    costo: { type: "money" },
    presupuesto: { type: "money" },
    margen: { type: "money" },
    precioLista: { type: "money" },
    bonificacion: { type: "money" },
    coincideDocumentacion: { type: "select", options: ["Sin verificar", "Si", "No"] },
    improntasTomadas: { type: "select", options: ["No", "Si"] },
    estadoChapa: { type: "select", options: ["Excelente", "Bueno", "Regular", "Con detalles"] },
    danosEstructurales: { type: "select", options: ["No", "Si"] },
    modificacionesNoAutorizadas: { type: "select", options: ["No", "Si"] },
    nivelCombustible: { type: "select", options: ["Vacio", "Reserva", "1/4", "1/2", "3/4", "Lleno"] },
    auxilio: { type: "select", options: ["Si", "No", "Usada"] },
    reporteRobo: { type: "select", options: ["Sin verificar", "Sin registro", "Con alerta"] },
    embargoPrenda: { type: "select", options: ["Sin verificar", "Sin registro", "Con gravamen"] },
    siniestrosAnteriores: { type: "select", options: ["Sin verificar", "Sin registro", "Con antecedentes"] },
    limitacionesPropiedad: { type: "select", options: ["Sin verificar", "Sin registro", "Con limitacion"] },
    documentacion: { type: "select", options: ["Sin verificar", "Completa", "Incompleta"] },
    vtvVigente: { type: "select", options: ["Sin verificar", "Si", "No", "No aplica"] },
    seguroVigente: { type: "select", options: ["Si", "No"] },
    matafuego: { type: "select", options: ["Si", "No", "Vencido"] },
    balizas: { type: "select", options: ["Si", "No"] },
    llaveRuedaGato: { type: "select", options: ["Si", "No"] }
  };
  const relationFields = {
    cliente: { type: "datalist", options: clientNames() },
    beneficiario: { type: "datalist", options: clientNames() },
    titular: { type: "datalist", options: clientNames() },
    solicitante: { type: "datalist", options: staffNames() },
    autor: { type: "datalist", options: staffNames() },
    vendedor: { type: "datalist", options: staffNames() },
    responsable: { type: "datalist", options: staffNames() },
    gestor: { type: "datalist", options: staffNames() },
    vehiculo: { type: "datalist", options: vehicleNames() },
    dominio: { type: "datalist", options: vehicleDomains() },
    marca: { type: "datalist", options: Object.keys(catalogoVehiculos).sort(), extraAttrs: "data-marca-input" },
    modelo: { type: "datalist", options: [], extraAttrs: "data-modelo-input" },
    telefono: { type: "datalist", options: (state?.clients || []).map(client => client.telefono).filter(Boolean) },
    email: { type: "datalist", options: (state?.clients || []).map(client => client.email).filter(Boolean) },
    para: { type: "datalist", options: (state?.clients || []).map(client => client.email).filter(Boolean) }
  };
  const placeholders = {
    cliente: "Nombre y apellido",
    telefono: "+54 11 5555 5555",
    email: "cliente@email.com",
    vehiculo: "Marca, modelo y version",
    dominio: "AE000AA",
    marca: "Ej. Toyota",
    modelo: "Ej. Corolla XEI",
    monto: "0",
    presupuesto: "0",
    notas: "Notas internas, condiciones, urgencia o proximo paso.",
    detalle: "Detalle completo.",
    comentario: "Comentario o respuesta del cliente.",
    mensaje: "Texto del mensaje."
  };
  return { ...(relationFields[name] || {}), ...(common[name] || {}), placeholder: placeholders[name] || "" };
}

function clientNames() {
  return (state?.clients || []).map(client => client.nombre).filter(Boolean);
}

function vehicleNames() {
  return (state?.vehicles || []).map(vehicle => `${vehicle.marca || ""} ${vehicle.modelo || ""}`.trim()).filter(Boolean);
}

function vehicleDomains() {
  return (state?.vehicles || []).map(vehicle => vehicle.dominio).filter(Boolean);
}

function staffNames() {
  return [...new Set([authUser?.name, "Gastoonfloori", "Gaston", "Mica", "Leo", ...(state?.sales || []).map(sale => sale.vendedor)].filter(Boolean))];
}

function statusOptions(moduleKey) {
  const map = {
    vehicles: ["Disponible", "Publicado", "Reservado", "Preparacion", "Vendido"],
    clients: ["Nuevo", "Seguimiento", "Caliente", "Dormido", "Cerrado"],
    sales: ["Contacto", "Tasacion", "Reserva", "Cierre", "Perdida"],
    calendar: ["Programado", "Confirmado", "Pendiente", "Hecho", "Cancelado"],
    finance: ["Pendiente", "Confirmado", "Pagado", "Rechazado"],
    paperwork: ["Pendiente", "En curso", "Listo", "Observado"],
    messages: ["Borrador", "Listo para enviar", "Programado", "Enviado"],
    orders: ["Activo", "Buscando", "Pausado", "Con match", "Cerrado"],
    quotes: ["Activo", "Vendido", "Vencida", "Cancelada"],
    consignments: ["Activa", "Vendida", "Devuelta", "Vencida"]
  };
  return map[moduleKey] || ["Pendiente", "Activo", "En curso", "Hecho", "Cancelado"];
}

function fieldControl(field) {
  const required = field.required ? " required" : "";
  const wide = field.wide || field.type === "textarea" ? " full" : "";
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
  const value = field.value ?? "";
  if (field.type === "select") {
    return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><select name="${escapeHtml(field.name)}"${required}>${(field.options || []).map(option => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`;
  }
  if (field.type === "datalist") {
    const listId = `list-${field.name}-${Math.random().toString(36).slice(2)}`;
    const extra = field.extraAttrs ? ` ${field.extraAttrs}` : "";
    return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><input name="${escapeHtml(field.name)}" list="${listId}" value="${escapeHtml(value)}"${placeholder}${required}${extra}><datalist id="${listId}">${(field.options || []).map(option => `<option value="${escapeHtml(option)}"></option>`).join("")}</datalist></div>`;
  }
  if (field.type === "textarea") {
    return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><textarea name="${escapeHtml(field.name)}"${placeholder}${required}>${escapeHtml(value)}</textarea></div>`;
  }
  if (field.type === "money") {
    const raw = String(value || "").replace(/[^\d]/g, "");
    const display = raw ? Number(raw).toLocaleString("es-AR") : "";
    return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><input type="text" inputmode="numeric" class="money-field" data-money-input value="${escapeHtml(display)}" placeholder="0"${required}><input type="hidden" name="${escapeHtml(field.name)}" value="${escapeHtml(raw)}"></div>`;
  }
  return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${escapeHtml(value)}"${placeholder}${required}></div>`;
}

function labelForKey(key) {
  const dynamicDef = Object.values(sectionData).find(def => def.key === key);
  return dynamicDef?.item || ({ vehicles: "vehiculo", clients: "cliente", sales: "venta", paperwork: "tramite", finance: "movimiento", messages: "mensaje", calendar: "evento", clientDocs: "documento" }[key] || "registro");
}

function pill(value) {
  const s = String(value);
  const STATE_CLASS = {
    // ok — verde
    "Disponible": "ok", "Listo": "ok", "Confirmado": "ok", "Ingreso": "ok",
    "Enviado": "ok", "Pagado": "ok", "Hecho": "ok", "Activo": "ok",
    "Cerrado": "ok", "Transferido": "ok", "Vigente": "ok", "Aprobado": "ok",
    "Firmado": "ok",
    // warn — amarillo
    "Pendiente": "warn", "Reservado": "warn", "Programado": "warn",
    "Tasacion": "warn", "En proceso": "warn", "Parcial": "warn",
    "En revision": "warn", "En Revision": "warn", "En preparacion": "warn",
    // hot — naranja (alerta)
    "Caliente": "hot", "Egreso": "hot", "Preparacion": "hot",
    "Alerta": "hot", "Demorado": "hot", "Cargo": "hot",
    // crit — rojo
    "Cancelado": "crit", "Cancelada": "crit", "Vencido": "crit", "Vencida": "crit", "Critico": "crit",
    "Baja": "crit", "Rechazado": "crit", "Suspendido": "crit",
    // estados de cotizacion y expediente tecnico
    "Vendido": "crit", "Sin seguro": "warn", "Por vencer": "warn",
    // tipos de expediente
    "Tramite": "info", "Vehiculo": "ok",
    // info — azul (default)
  };
  if (!s || s === "undefined" || s === "null") return `<span class="pill info">Tramite</span>`;
  const cls = STATE_CLASS[s] || "info";
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
      await saveState("Bienvenido a Lake Motors");
      render();
    } catch (error) {
      toast(error.message);
    }
  });

  document.querySelectorAll("[data-module]").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.module !== currentModule) { clientProfileId = null; clientProfileTab = "resumen"; }
    currentModule = btn.dataset.module;
    query = "";
    render();
  }));

  document.querySelector("[data-back-profile]")?.addEventListener("click", () => {
    clientProfileId = null;
    clientProfileTab = "resumen";
    render();
  });

  document.querySelectorAll("[data-profile-tab]").forEach(btn => btn.addEventListener("click", () => {
    clientProfileTab = btn.dataset.profileTab;
    render();
  }));

  document.querySelectorAll("[data-client-row]").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.closest("button, a")) return;
      clientProfileId = tr.dataset.clientRow;
      clientProfileTab = "resumen";
      render();
    });
  });

  document.querySelectorAll("[data-vehicle-row]").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.closest("button, a")) return;
      openVehiclePreview(tr.dataset.vehicleRow);
    });
  });

  document.querySelectorAll("[data-quote-row]").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.closest("button, a")) return;
      openQuotePreview(tr.dataset.quoteRow);
    });
  });

  document.querySelectorAll("[data-consign-row]").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.closest("button, a")) return;
      openConsignPreview(tr.dataset.consignRow);
    });
  });

  document.querySelectorAll("[data-quick-action]").forEach(btn => btn.addEventListener("click", () => handleQuickAction(btn.dataset.quickAction)));

  document.querySelectorAll("[data-action='search']").forEach(inputEl => inputEl.addEventListener("input", e => {
    query = e.target.value;
    render();
  }));

  document.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.add)));
  document.querySelectorAll("[data-section-action]").forEach(btn => btn.addEventListener("click", () => handleSectionAction(btn.dataset.sectionAction)));
  document.querySelectorAll("[data-module-flow]").forEach(btn => btn.addEventListener("click", () => handleModuleFlow(btn.dataset.moduleFlow)));
  document.querySelector("[data-action='quick-add']")?.addEventListener("click", () => {
    const map = moduleKeyMap();
    const dynamicDef = sectionData[currentModule];
    openModal(map[currentModule] || dynamicDef?.key || "clients");
  });

  document.querySelectorAll("[data-consign-exp]").forEach(btn => btn.addEventListener("click", () => {
    const cs = (state.consignments || []).find(x => x.id === btn.dataset.consignExp);
    if (!cs) return;
    const ref = [cs.vehiculo, cs.titular].filter(Boolean).join(" — ");
    openExpedienteTecnicoModal(cs.vehiculoId || "", ref, cs.id);
  }));
  document.querySelectorAll("[data-file-exp]").forEach(btn => btn.addEventListener("click", () => {
    const f = (state.files || []).find(x => x.id === btn.dataset.fileExp);
    if (!f) return;
    openExpedienteTecnicoModal(f.vehiculoId || "", f.vehiculoRef || "", f.consignacionId || "");
  }));

  // Expediente tecnico page: open existing
  document.querySelectorAll("[data-et-open]").forEach(btn => btn.addEventListener("click", () => {
    const f = (state.files || []).find(x => x.id === btn.dataset.etOpen);
    if (!f) return;
    openExpedienteTecnicoModal(f.vehiculoId || "", f.vehiculoRef || "", f.consignacionId || "");
  }));

  // Expediente tecnico page: create new
  const etNewBtn = document.getElementById("et-new-btn");
  if (etNewBtn && !etNewBtn.dataset.bound) {
    etNewBtn.dataset.bound = "true";
    etNewBtn.addEventListener("click", () => {
      const sel = document.getElementById("et-new-vehiculo");
      const vId = sel?.value;
      if (!vId) return toast("Seleccioná un vehículo primero.");
      const opt = sel.selectedOptions[0];
      const vRef = opt?.dataset.ref || opt?.text || "";
      openExpedienteTecnicoModal(vId, vRef, "");
    });
  }
  document.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
    const [key, id] = btn.dataset.edit.split(":");
    const row = state[key]?.find(x => x.id === id);
    if (key === "files" && row?.tipo === "Vehiculo") {
      return openExpedienteTecnicoModal(row.vehiculoId || "", row.vehiculoRef || "", row.consignacionId || "");
    }
    openModal(key, row);
  }));

  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
    const [key, id] = btn.dataset.delete.split(":");
    if (key === "sales") {
      const sale = (state.sales || []).find(x => x.id === id);
      if (sale && sale.etapa !== "Cierre") revertVehicleFromSale(sale);
    }
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
  document.querySelectorAll("[data-advance-sale]").forEach(btn => btn.addEventListener("click", () => advanceSaleById(btn.dataset.advanceSale)));
  document.querySelectorAll("[data-sale-report]").forEach(btn => btn.addEventListener("click", () => openSaleReport(btn.dataset.saleReport)));
  document.querySelectorAll("[data-mark-cuota]").forEach(btn => btn.addEventListener("click", () => markNextCuota(btn.dataset.markCuota)));
  document.querySelectorAll("[data-pay-cuota]").forEach(btn => btn.addEventListener("click", () => payCuota(btn.dataset.payCuota)));
  document.querySelectorAll("[data-quote-pdf]").forEach(btn => btn.addEventListener("click", () => generateQuotePDF(btn.dataset.quotePdf)));
  document.querySelectorAll("[data-vehicle-peritaje]").forEach(btn => btn.addEventListener("click", () => generateVehiclePeritajePDF(btn.dataset.vehiclePeritaje)));
  document.querySelectorAll("[data-peritaje-pdf]").forEach(btn => btn.addEventListener("click", () => generatePeritajePDF(btn.dataset.peritajePdf)));
  document.querySelectorAll("[data-client-statement]").forEach(btn => btn.addEventListener("click", () => generateClientStatementPDF(btn.dataset.clientStatement)));
  document.querySelectorAll("[data-payment-receipt]").forEach(btn => btn.addEventListener("click", () => {
    const [clientId, idx] = btn.dataset.paymentReceipt.split(":");
    generatePaymentReceiptPDF(clientId, Number(idx));
  }));
  document.querySelectorAll("[data-marca-input]").forEach(marcaInput => {
    function syncModelos() {
      const marca = marcaInput.value.trim();
      const container = marcaInput.closest("form") || document;
      const modeloInput = container.querySelector("[data-modelo-input]");
      if (!modeloInput) return;
      const dl = document.getElementById(modeloInput.getAttribute("list"));
      if (!dl) return;
      dl.innerHTML = (catalogoVehiculos[marca] || []).map(m => `<option value="${escapeHtml(m)}"></option>`).join("");
    }
    marcaInput.addEventListener("input", syncModelos);
    marcaInput.addEventListener("change", syncModelos);
    if (marcaInput.value) syncModelos();
  });
  document.querySelectorAll("[data-calendar-view]").forEach(btn => btn.addEventListener("click", () => {
    calendarView = btn.dataset.calendarView;
    render();
  }));
  document.querySelector("[data-action='calendar-prev']")?.addEventListener("click", () => {
    shiftCalendar(-1);
    render();
  });
  document.querySelector("[data-action='calendar-next']")?.addEventListener("click", () => {
    shiftCalendar(1);
    render();
  });
  document.querySelector("[data-action='calendar-today']")?.addEventListener("click", () => {
    calendarCursor = todayKey();
    render();
  });
  document.querySelector("[data-action='simulate-wa']")?.addEventListener("click", () => {
    const text = encodeURIComponent(document.getElementById("wa-text").value);
    navigator.clipboard?.writeText(`https://wa.me/?text=${text}`);
    toast("Enlace de WhatsApp copiado");
  });
  document.querySelector("[data-action='logo-upload']")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Selecciona una imagen valida.");
    if (file.size > 750 * 1024) return toast("El logo debe pesar menos de 750 KB.");
    const reader = new FileReader();
    reader.onload = async () => {
      state.settings = { ...(state.settings || {}), logoDataUrl: String(reader.result || "") };
      publicConfig = { ...publicConfig, logoDataUrl: state.settings.logoDataUrl, businessName: state.settings.businessName || publicConfig.businessName || "" };
      _buildPdfLogo(state.settings.logoDataUrl);
      addAudit("Logo actualizado");
      await saveState("Logo guardado");
      render();
    };
    reader.onerror = () => toast("No se pudo leer el logo.");
    reader.readAsDataURL(file);
  });
  document.querySelector("[data-action='logo-remove']")?.addEventListener("click", async () => {
    state.settings = { ...(state.settings || {}), logoDataUrl: "" };
    publicConfig = { ...publicConfig, logoDataUrl: "" };
    _buildPdfLogo(defaultLogoDataUrl);
    addAudit("Logo eliminado");
    await saveState("Logo eliminado");
    render();
  });
  document.querySelector("[data-action='settings']")?.addEventListener("submit", async e => {
    e.preventDefault();
    state.settings = { ...(state.settings || {}), ...Object.fromEntries(new FormData(e.target).entries()) };
    publicConfig = {
      ...publicConfig,
      businessName: state.settings.businessName || "",
      logoDataUrl: state.settings.logoDataUrl || ""
    };
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
  document.querySelectorAll("[data-money-input]").forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = "true";
    const hidden = input.nextElementSibling;
    input.addEventListener("input", () => {
      const digits = input.value.replace(/[^\d]/g, "");
      if (hidden) hidden.value = digits;
      input.value = digits ? Number(digits).toLocaleString("es-AR") : "";
    });
  });
  document.querySelectorAll("[data-save]").forEach(form => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = e.target.querySelector("[type='submit']");
      const btnLabel = btn?.textContent || "Guardar";
      if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
      try {
        const key = e.target.dataset.save;
        const id = e.target.dataset.id;
        const item = Object.fromEntries(new FormData(e.target).entries());
        Object.keys(item).forEach(k => {
          if (/^(anio|anioDesde|anioHasta|km|precio|margen|monto|sena|anticipo|cantCuotas|montoCuota|precioPretendido|comision|costo|presupuesto|puntaje|dias|precioLista|bonificacion|cantidadLlaves)$/.test(k)) item[k] = Number(item[k]);
        });
        const prevSale = (id && key === "sales") ? (state[key].find(x => x.id === id)) : null;
        const prevEtapa = prevSale?.etapa || null;
        const prevClienteId = prevSale?.clienteId || null;
        if (key === "vehicles" || key === "consignments" || key === "quotes") item.fotos = _vehiclePhotosBuf.slice();
        if (key === "sales") {
          const cSel = e.target.querySelector("[data-sales-client]");
          const vSel = e.target.querySelector("[data-sales-vehicle]");
          if (cSel?.value) item.cliente = cSel.selectedOptions[0]?.dataset.nombre || item.cliente || "";
          if (vSel?.value) item.vehiculo = vSel.selectedOptions[0]?.dataset.nombre || item.vehiculo || "";
        }
        if (key === "treasury" && id) {
          const prevTrx = (state.treasury || []).find(x => x.id === id);
          if (prevTrx && Number(prevTrx.monto) !== Number(item.monto)) {
            item._montoEditado = true;
            item._montoOriginal = Number(prevTrx.monto);
            item._montoEditadoPor = authUser?.name || "desconocido";
            item._montoEditadoEn = todayKey();
            addAudit(`⚠ Monto editado en Tesoreria — "${item.concepto || prevTrx.concepto}": ${money(Number(prevTrx.monto))} → ${money(Number(item.monto))} (por ${authUser?.name || "desconocido"})`);
          }
        }
        if (!Array.isArray(state[key])) state[key] = [];
        if (id) {
          state[key] = state[key].map(x => x.id === id ? { ...x, ...item, id } : x);
        } else {
          state[key].unshift({ ...item, id: `${key}-${Date.now()}` });
        }
        if (key === "sales") {
          const savedId = id || state[key][0]?.id;
          const saved = state[key].find(x => x.id === savedId);
          if (saved) applyStageEffects(saved, item.etapa, prevEtapa);
          if (id && saved) syncSaleRelatedRecords(saved);
          if (!id && saved) {
            if (item.tieneAnticipo === "1" && Number(item.anticipo || 0) > 0) {
              saved.sena = Number(item.anticipo);
            }
            onNewSaleCreated(item, saved);
            if (item.quoteRef) {
              const srcQuote = (state.quotes || []).find(q => q.id === item.quoteRef);
              if (srcQuote) { srcQuote.estado = "Vendido"; srcQuote.saleId = saved.id; }
            }
          }
        }
        addAudit(`${id ? "Actualizado" : "Creado"} ${labelForKey(key)}`);
        await saveState("Datos guardados");
        document.querySelector("[data-modal]")?.remove();
        render();
      } catch (err) {
        toast(err.message || "Error al guardar. Intenta de nuevo.");
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
      }
    });
  });
  document.querySelectorAll("[data-client-link]").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const option = select.selectedOptions[0];
      const form = select.closest("form");
      if (!form) return;
      const name = option?.dataset.name || "";
      const phone = option?.dataset.phone || "";
      if (name) {
        if (form.elements.cliente) form.elements.cliente.value = name;
        else if (form.elements.titular) form.elements.titular.value = name;
      }
      if (phone && form.elements.telefono) form.elements.telefono.value = phone;
    });
  });
  document.querySelectorAll("[data-action='vehicle-photo-upload']").forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = "true";
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      for (const file of files) {
        if (!file.type.startsWith("image/")) { toast("Solo imagenes JPG, PNG o WEBP."); continue; }
        if (_vehiclePhotosBuf.length >= 6) { toast("Maximo 6 fotos por vehiculo."); break; }
        const dataUrl = await resizeImage(file);
        if (dataUrl) _vehiclePhotosBuf.push(dataUrl);
      }
      input.value = "";
      updatePhotoPreview();
    });
  });
  // Render existing photos after modal opens
  updatePhotoPreview();

  // Cotizaciones: recalculo automatico monto final y deteccion de moneda
  const quotesForm = document.querySelector("[data-save='quotes']");
  if (quotesForm && !quotesForm.dataset.cotizBound) {
    quotesForm.dataset.cotizBound = "true";
    function recalcCotizacion() {
      const lista = Number(quotesForm.elements.precioLista?.value || 0);
      const boni  = Number(quotesForm.elements.bonificacion?.value || 0);
      if (lista <= 0) return;
      const final = Math.max(0, lista - boni);
      if (quotesForm.elements.monto) quotesForm.elements.monto.value = final;
      if (quotesForm.elements.moneda) quotesForm.elements.moneda.value = lista < 1000000 ? "USD" : "ARS";
    }
    quotesForm.elements.precioLista?.addEventListener("input", recalcCotizacion);
    quotesForm.elements.bonificacion?.addEventListener("input", recalcCotizacion);
    recalcCotizacion(); // ejecutar al abrir por si ya habia valores
  }
  document.querySelectorAll("[data-quote-pdf]").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => generateQuotePDF(btn.dataset.quotePdf));
  });
  document.querySelectorAll("[data-vehicle-link]").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const option = select.selectedOptions[0];
      const form = select.closest("form");
      if (!form || !option?.value) return; // "fuera de stock" selected: don't overwrite manual input
      const nombre = option.dataset.nombre || "";
      const dominio = option.dataset.dominio || "";
      const precio = option.dataset.precio;
      if (nombre && form.elements.vehiculo) form.elements.vehiculo.value = nombre;
      if (dominio && form.elements.dominio) form.elements.dominio.value = dominio;
      // Autocomplete price based on module
      if (precio !== undefined) {
        const priceFieldMap = { quotes: "precioLista", consignments: "precioPretendido" };
        const priceField = priceFieldMap[form.dataset.save || ""];
        if (priceField && form.elements[priceField]) form.elements[priceField].value = precio;
      }
    });
  });
  document.querySelectorAll("[data-sales-client]").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const opt = select.selectedOptions[0];
      const form = select.closest("form");
      if (opt?.dataset.nombre && form?.elements.cliente) form.elements.cliente.value = opt.dataset.nombre;
      const infoDiv = document.getElementById("sf-client-info");
      if (infoDiv) {
        const phone = opt?.dataset.phone || "";
        const email = opt?.dataset.email || "";
        infoDiv.textContent = opt?.value ? `Tel: ${phone || "—"} · Email: ${email || "—"}` : "";
      }
    });
  });
  document.querySelectorAll("[data-sales-vehicle]").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const opt = select.selectedOptions[0];
      const form = select.closest("form");
      if (opt?.dataset.nombre && form?.elements.vehiculo) form.elements.vehiculo.value = opt.dataset.nombre;
      if (opt?.dataset.precio && form?.elements.monto) {
        form.elements.monto.value = opt.dataset.precio;
        sfRecalcMontoCuota();
      }
    });
  });

  // Sales form: show/hide cuotas/permuta sections on forma de pago change
  const sfFormaPago = document.querySelector("#sf-forma-pago");
  if (sfFormaPago && !sfFormaPago.dataset.bound) {
    sfFormaPago.dataset.bound = "true";
    sfFormaPago.addEventListener("change", () => {
      const sec = document.getElementById("sf-cuotas-section");
      if (sec) sec.style.display = sfFormaPago.value === "Cuotas" ? "" : "none";
      const secP = document.getElementById("sf-permuta-section");
      if (secP) secP.style.display = sfFormaPago.value === "Permuta" ? "" : "none";
      sfRecalcMontoCuota();
      sfRecalcPermutaSaldo();
    });
  }

  // Permuta: update saldo display when cotizacion or monto changes
  function sfRecalcPermutaSaldo() {
    const sfMonto = document.querySelector("#sf-monto");
    const sfPSel = document.querySelector("#sf-cotizacion-permuta");
    const sfPValor = document.querySelector("#sf-permuta-valor");
    const sfPSaldo = document.querySelector("#sf-permuta-saldo");
    if (!sfPSel || !sfPValor || !sfPSaldo) return;
    const opt = sfPSel.selectedOptions[0];
    const permutaM = opt?.value ? Number(opt.dataset.monto || 0) : 0;
    const totalM = Number(sfMonto?.value || 0);
    const saldo = Math.max(0, totalM - permutaM);
    sfPValor.value = permutaM ? money(permutaM) : "—";
    sfPSaldo.value = (opt?.value && totalM) ? money(saldo) : "—";
  }
  const sfPermutaSel = document.querySelector("#sf-cotizacion-permuta");
  if (sfPermutaSel && !sfPermutaSel.dataset.bound) {
    sfPermutaSel.dataset.bound = "true";
    sfPermutaSel.addEventListener("change", sfRecalcPermutaSaldo);
  }
  if (sfPermutaSel) sfRecalcPermutaSaldo();

  // Sales form: show/hide anticipo section on checkbox change
  const sfTieneAnticipo = document.querySelector("#sf-tiene-anticipo");
  if (sfTieneAnticipo && !sfTieneAnticipo.dataset.bound) {
    sfTieneAnticipo.dataset.bound = "true";
    sfTieneAnticipo.addEventListener("change", () => {
      const sec = document.getElementById("sf-anticipo-section");
      if (sec) sec.style.display = sfTieneAnticipo.checked ? "" : "none";
      sfRecalcMontoCuota();
    });
  }

  // Auto-recalculate monto per cuota
  function sfRecalcMontoCuota() {
    const sfMonto = document.querySelector("#sf-monto");
    const sfCantCuotas = document.querySelector("#sf-cant-cuotas");
    const sfMontoCuota = document.querySelector("#sf-monto-cuota");
    const sfAnticipo = document.querySelector("#sf-anticipo");
    const sfCheck = document.querySelector("#sf-tiene-anticipo");
    const sfFP = document.querySelector("#sf-forma-pago");
    if (!sfCantCuotas || !sfMontoCuota || sfFP?.value !== "Cuotas") return;
    const monto = Number(sfMonto?.value || 0);
    const ant = sfCheck?.checked ? Number(sfAnticipo?.value || 0) : 0;
    const cant = Number(sfCantCuotas.value || 0);
    if (cant > 0) sfMontoCuota.value = Math.round((monto - ant) / cant);
  }

  const sfMonto2 = document.querySelector("#sf-monto");
  if (sfMonto2 && !sfMonto2.dataset.sfBound) {
    sfMonto2.dataset.sfBound = "true";
    sfMonto2.addEventListener("input", () => { sfRecalcMontoCuota(); sfRecalcPermutaSaldo(); });
  }
  const sfCantCuotas2 = document.querySelector("#sf-cant-cuotas");
  if (sfCantCuotas2 && !sfCantCuotas2.dataset.sfBound) {
    sfCantCuotas2.dataset.sfBound = "true";
    sfCantCuotas2.addEventListener("input", sfRecalcMontoCuota);
  }
  const sfAnticipo2 = document.querySelector("#sf-anticipo");
  if (sfAnticipo2 && !sfAnticipo2.dataset.sfBound) {
    sfAnticipo2.dataset.sfBound = "true";
    sfAnticipo2.addEventListener("input", sfRecalcMontoCuota);
  }
  document.querySelectorAll("[data-condicion-radio]").forEach(radio => {
    if (radio.dataset.bound) return;
    radio.dataset.bound = "true";
    radio.addEventListener("change", () => {
      const wrap = document.getElementById("km-field-wrap");
      const kmInput = document.getElementById("km-input");
      if (!wrap || !kmInput) return;
      const is0km = document.querySelector("[data-condicion-radio][value='0km']")?.checked;
      wrap.style.display = is0km ? "none" : "";
      if (is0km) kmInput.value = "0";
    });
  });

  document.querySelectorAll("[data-toggle-peritaje]").forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = "true";
    el.addEventListener("click", () => {
      const body = document.getElementById("peritaje-body");
      const label = document.getElementById("peritaje-toggle-label");
      if (!body) return;
      const willShow = body.style.display === "none";
      body.style.display = willShow ? "" : "none";
      if (label) label.textContent = willShow ? "▲ Ocultar peritaje" : "▼ Completar peritaje";
    });
  });

  document.querySelectorAll("[data-marca-input]").forEach(marcaInput => {
    if (marcaInput.dataset.bound) return;
    marcaInput.dataset.bound = "true";
    function syncModelos() {
      const marca = marcaInput.value.trim();
      const container = marcaInput.closest("form") || marcaInput.closest("[data-modal]") || document;
      const modeloInput = container.querySelector("[data-modelo-input]");
      if (!modeloInput) return;
      const listId = modeloInput.getAttribute("list");
      if (!listId) return;
      const dl = document.getElementById(listId);
      if (!dl) return;
      const modelos = catalogoVehiculos[marca] || [];
      dl.innerHTML = modelos.map(m => `<option value="${escapeHtml(m)}"></option>`).join("");
    }
    marcaInput.addEventListener("input", syncModelos);
    marcaInput.addEventListener("change", syncModelos);
    if (marcaInput.value) syncModelos();
  });

  document.querySelectorAll("[data-action='doc-file-upload']").forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = "true";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast("El archivo debe pesar menos de 5 MB.");
      const reader = new FileReader();
      reader.onload = () => {
        const form = input.closest("form");
        if (form?.elements.archivo)      form.elements.archivo.value      = String(reader.result || "");
        if (form?.elements.archivoNombre) form.elements.archivoNombre.value = file.name;
        if (form?.elements.archivoTipo)   form.elements.archivoTipo.value   = file.type;
        const label = document.getElementById("doc-file-label");
        if (label) label.textContent = `Archivo listo: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
      };
      reader.onerror = () => toast("No se pudo leer el archivo.");
      reader.readAsDataURL(file);
    });
  });
}

async function handleSectionAction(action) {
  const [type, key] = String(action || "").split(":");
  if (!key) return;
  if (type === "new") return openModal(key);
  state[key] = state[key] || [];
  if (type === "duplicate") {
    const source = filtered(state[key])[0] || state[key][0];
    if (!source) return toast("No hay registros para duplicar.");
    const copy = { ...source, id: `${key}-${Date.now()}` };
    state[key].unshift(copy);
    addAudit(`Duplicado ${labelForKey(key)}`);
    await saveState("Registro duplicado");
    render();
    return;
  }
  if (type === "complete") {
    const record = state[key].find(row => !/Hecho|Listo|Confirmado|Pagado|Cerrado|Aprobado|Enviado|Disponible|Recibida|Cancelado/i.test(String(row.estado || "")));
    if (!record) return toast("No hay pendientes para resolver.");
    record.estado = "Hecho";
    addAudit(`Resuelto ${labelForKey(key)}`);
    await saveState("Pendiente resuelto");
    render();
  }
}

async function handleModuleFlow(action) {
  const parts = String(action || "").split(":");
  const flow = parts[0];
  const key = parts[1];
  const rowId = parts[2];
  let source = rowId ? (state[key] || []).find(x => x.id === rowId) : null;
  if (!source) source = filtered(state[key] || [])[0] || (state[key] || [])[0];
  if (!source) return toast("No hay registros para usar.");
  const nowId = Date.now();

  // Specific flows (checked before generic regex matches)
  if (flow === "client-opportunity") {
    state.opportunities = state.opportunities || [];
    state.opportunities.unshift({ id: `op-${nowId}`, cliente: source.nombre || source.cliente || "", clienteId: source.id || source.clienteId || "", telefono: source.telefono || "", interes: source.interes || "", vehiculo: "", probabilidad: "Media", monto: 0, moneda: "ARS", responsable: authUser?.name || "", proximo: "Contactar hoy", estado: "Abierta", notas: source.notas || "" });
    return persistFlow("Oportunidad creada");
  }
  if (flow === "client-calendar") {
    state.calendar = state.calendar || [];
    state.calendar.unshift({ id: `cal-${nowId}`, fecha: todayKey(), hora: "10:00", tipo: "Llamado", titulo: `Contacto con ${source.nombre || source.cliente || "cliente"}`, cliente: source.nombre || source.cliente || "", clienteId: source.id || source.clienteId || "", vehiculo: "", vendedor: authUser?.name || "", estado: "Programado", notas: source.notas || "" });
    return persistFlow("Evento creado");
  }
  if (flow === "stock-quote") {
    state.quotes = state.quotes || [];
    state.quotes.unshift({ id: `co-${nowId}`, cliente: "", telefono: "", vehiculo: `${source.marca || ""} ${source.modelo || ""}`.trim() || source.vehiculo || "", vehiculoId: source.id, precioLista: source.precio || 0, bonificacion: 0, monto: source.precio || 0, moneda: source.moneda || "ARS", validez: "", vendedor: authUser?.name || "", estado: "Borrador", notas: `Dom: ${source.dominio || ""}`.trim() });
    return persistFlow("Cotizacion creada");
  }
  if (flow === "sale-file") {
    state.files = state.files || [];
    state.files.unshift({ id: `ex-${nowId}`, numero: `EXP-${nowId}`, cliente: source.cliente || "", clienteId: source.clienteId || "", telefono: source.telefono || "", vehiculo: source.vehiculo || "", vehiculoId: source.vehiculoId || "", dominio: "", tramite: "Transferencia", responsable: "Gestoria", fechaAlta: todayKey(), vence: "", estado: "Pendiente", detalle: "" });
    return persistFlow("Expediente generado");
  }
  if (flow === "quote-sale") {
    return openModal("sales", {
      clienteId: source.clienteId || "",
      cliente: source.cliente || "",
      vehiculoId: source.vehiculoId || "",
      vehiculo: source.vehiculo || "",
      monto: Number(source.monto || 0),
      moneda: source.moneda || "ARS",
      vendedor: source.vendedor || authUser?.name || "",
      etapa: "Contacto",
      quoteRef: source.id
    });
  }
  if (flow === "consignment-stock") {
    state.vehicles = state.vehicles || [];
    const newVehicleId = `vehicles-${nowId}`;
    const parts2 = (source.vehiculo || "").split(" ");
    state.vehicles.unshift({ id: newVehicleId, dominio: source.dominio || "", marca: parts2[0] || "", modelo: parts2.slice(1).join(" ") || source.vehiculo || "", anio: source.anio || 0, km: source.km || 0, precio: source.precioPretendido || 0, moneda: "ARS", estado: "Disponible", ubicacion: "", origen: "Consignacion", margen: 0, fotos: source.fotos || [], notas: `Consignado de ${source.titular || ""}` });
    const expTec = (state.files || []).find(f => f.tipo === "Vehiculo" && f.consignacionId === source.id);
    if (expTec) expTec.vehiculoId = newVehicleId;
    source.estado = "Ingresado a Stock";
    return persistFlow("Vehiculo ingresado al stock");
  }

  // Generic pattern flows
  if (/opportunity/.test(flow)) {
    state.opportunities = state.opportunities || [];
    state.opportunities.unshift({ id: `op-${nowId}`, cliente: source.cliente || source.titular || "", telefono: source.telefono || "", interes: source.interes || source.vehiculo || `${source.marca || ""} ${source.modelo || ""}`.trim(), vehiculo: source.vehiculo || `${source.marca || ""} ${source.modelo || ""}`.trim(), probabilidad: "Media", monto: source.presupuesto || source.monto || 0, moneda: source.moneda || "ARS", responsable: source.vendedor || authUser?.name || "", proximo: "Contactar hoy", estado: "Abierta", notas: source.notas || source.detalle || "" });
    return persistFlow("Oportunidad creada");
  }
  if (/sale/.test(flow)) {
    state.sales = state.sales || [];
    state.sales.unshift({ id: `sales-${nowId}`, cliente: source.cliente || "", vehiculo: source.vehiculo || source.interes || "", etapa: "Contacto", monto: Number(source.monto || source.presupuesto || 0), moneda: source.moneda || "ARS", sena: 0, vendedor: source.vendedor || source.responsable || authUser?.name || "", proximo: "Contactar hoy", estado: "Contacto", notas: source.notas || "" });
    return persistFlow("Venta creada");
  }
  if (/calendar/.test(flow)) {
    state.calendar = state.calendar || [];
    state.calendar.unshift({ id: `cal-${nowId}`, fecha: todayKey(), hora: "10:00", tipo: "Llamado", titulo: source.titulo || source.solicitud || source.trabajo || "Seguimiento", cliente: source.cliente || source.titular || "", vehiculo: source.vehiculo || source.interes || "", vendedor: source.vendedor || source.responsable || authUser?.name || "", estado: "Programado", notas: source.notas || source.detalle || "" });
    return persistFlow("Evento creado");
  }
  if (/message/.test(flow)) {
    state.messages = state.messages || [];
    state.messages.unshift({ id: `msg-${nowId}`, cliente: source.cliente || "", telefono: source.telefono || "", canal: "WhatsApp", plantilla: "Seguimiento", mensaje: source.mensaje || source.notas || source.detalle || "Hola, te contactamos por tu consulta.", hora: "Ahora", responsable: source.responsable || source.vendedor || authUser?.name || "", estado: "Listo para enviar" });
    return persistFlow("Mensaje preparado");
  }
  if (/alert/.test(flow)) {
    state.alerts = state.alerts || [];
    state.alerts.unshift({ id: `al-${nowId}`, titulo: source.titulo || source.concepto || source.trabajo || "Alerta operativa", tipo: "Operativa", prioridad: source.prioridad || "Alta", area: source.area || currentModule, cliente: source.cliente || "", vehiculo: source.vehiculo || "", vence: source.vence || todayKey(), responsable: source.responsable || authUser?.name || "", estado: "Pendiente", detalle: source.detalle || source.notas || "" });
    return persistFlow("Alerta creada");
  }
}

async function persistFlow(message) {
  addAudit(message);
  await saveState(message);
  render();
}

async function advanceSale() {
  const order = ["Contacto", "Tasacion", "Reserva", "Cierre"];
  const sale = state.sales.find(s => s.etapa !== "Cierre");
  if (!sale) return toast("Todas las ventas estan en cierre.");
  sale.etapa = order[order.indexOf(sale.etapa) + 1];
  if (sale.etapa === "Cierre") closeSaleEffects(sale);
  addAudit(`Venta de ${sale.cliente} avanzo a ${sale.etapa}`);
  await saveState("Venta avanzada");
  render();
}

function closeSaleEffects(sale) {
  const nowId = Date.now();
  const vLabel = sale.vehiculo || "";
  const total = Number(sale.monto || 0);
  const sena = Number(sale.sena || 0);
  const saldo = Math.max(0, total - sena);

  if (sale.vehiculoId) {
    const v = (state.vehicles || []).find(x => x.id === sale.vehiculoId);
    if (v) v.estado = "Vendido";
  } else if (sale.vehiculo) {
    const vByName = (state.vehicles || []).find(x =>
      x.estado !== "Vendido" &&
      `${x.marca || ""} ${x.modelo || ""}${x.version ? " " + x.version : ""}`.trim().toLowerCase() === sale.vehiculo.toLowerCase()
    );
    if (vByName) { vByName.estado = "Vendido"; sale.vehiculoId = vByName.id; }
  }

  const saldoYaEnTesoreria = (state.treasury || []).some(t => (t.saleRef === sale.id || t.saleId === sale.id) && /saldo/i.test(t.concepto || ""));
  if (sale.formaPago !== "Cuotas" && saldo > 0 && !saldoYaEnTesoreria) {
    state.treasury = state.treasury || [];
    state.treasury.unshift({
      id: `trx-${nowId + 1}`,
      saleId: sale.id,
      saleRef: sale.id,
      cuenta: "Caja",
      tipo: "Ingreso",
      concepto: `Saldo — ${vLabel}`,
      cliente: sale.cliente || "",
      clienteId: sale.clienteId || "",
      monto: saldo,
      moneda: sale.moneda || "ARS",
      fecha: todayKey(),
      estado: "Confirmado",
      notas: `Saldo de venta. Seña previa: ${money(sena)}`
    });
  }

  if (sale.formaPago !== "Cuotas" && saldo > 0) {
    state.collections = state.collections || [];
    const yaEnCobros = state.collections.some(c => c.saleRef === sale.id || c.saleId === sale.id);
    if (!yaEnCobros) {
      state.collections.unshift({
        id: `cb-${nowId + 2}`,
        saleId: sale.id,
        saleRef: sale.id,
        cliente: sale.cliente || "",
        clienteId: sale.clienteId || "",
        telefono: (state.clients || []).find(c => c.id === sale.clienteId)?.telefono || "",
        concepto: `Saldo venta ${vLabel}`,
        vehiculo: vLabel,
        monto: saldo,
        moneda: sale.moneda || "ARS",
        medio: "",
        vence: todayKey(),
        estado: "Pendiente",
        notas: `Saldo final. Seña ya cobrada: ${money(sena)}`
      });
    }
  }

  if (sale.clienteId) {
    const c = (state.clients || []).find(x => x.id === sale.clienteId);
    if (c) c.estado = "Cerrado";
  }

  // Auto-create gestoria expediente
  if (!(state.files || []).some(f => (f.saleRef === sale.id || f.saleId === sale.id) && f.tipo !== "Vehiculo")) {
    state.files = state.files || [];
    const vDom = (state.vehicles || []).find(x => x.id === sale.vehiculoId)?.dominio || "";
    state.files.unshift({
      id: `ex-${nowId + 10}`,
      saleId: sale.id,
      saleRef: sale.id,
      numero: `EXP-${new Date().getFullYear()}-${String((state.files.length + 1)).padStart(4, "0")}`,
      cliente: sale.cliente || "",
      clienteId: sale.clienteId || "",
      telefono: (state.clients || []).find(c => c.id === sale.clienteId)?.telefono || "",
      vehiculo: vLabel,
      vehiculoId: sale.vehiculoId || "",
      dominio: vDom,
      tramite: "Transferencia",
      responsable: "Gestoria",
      fechaAlta: todayKey(),
      vence: "",
      estado: "Pendiente",
      detalle: `Expediente generado al cerrar venta. Total: ${money(total)}.`
    });
  }

  // Auto-create liquidacion de comision para el vendedor
  if (sale.vendedor && !(state.settlements || []).some(s => s.saleRef === sale.id || s.saleId === sale.id)) {
    const comision = Math.round(Number(sale.monto || 0) * 0.02);
    state.settlements = state.settlements || [];
    state.settlements.unshift({
      id: `li-${nowId + 11}`,
      saleId: sale.id,
      saleRef: sale.id,
      beneficiario: sale.vendedor || "",
      operacion: vLabel,
      cliente: sale.cliente || "",
      clienteId: sale.clienteId || "",
      vehiculo: vLabel,
      vehiculoId: sale.vehiculoId || "",
      concepto: `Comision venta — ${vLabel}`,
      monto: comision,
      moneda: sale.moneda || "ARS",
      fecha: todayKey(),
      estado: "Pendiente",
      notas: `2% sobre ${money(Number(sale.monto || 0))}`
    });
  }

  addAudit(`Cierre: ${sale.cliente || "cliente"} — ${vLabel} — Total ${money(total)}`);
}

function syncSaleRelatedRecords(sale) {
  const id = sale.id;
  const matches = r => r.saleRef === id || r.saleId === id;
  const patch = r => {
    r.saleId = id;
    r.saleRef = id;
    r.clienteId = sale.clienteId || "";
    r.cliente = sale.cliente || "";
    if ("vehiculo" in r) r.vehiculo = sale.vehiculo || "";
    if ("vehiculoId" in r) r.vehiculoId = sale.vehiculoId || "";
  };
  (state.finance || []).filter(matches).forEach(patch);
  (state.treasury || []).filter(matches).forEach(patch);
  (state.collections || []).filter(matches).forEach(patch);
  (state.settlements || []).filter(matches).forEach(patch);
  (state.files || []).filter(r => r.tipo !== "Vehiculo" && matches(r)).forEach(patch);
}

function revertVehicleFromSale(sale) {
  if (!sale.vehiculoId) return;
  const v = (state.vehicles || []).find(x => x.id === sale.vehiculoId);
  if (v && v.estado !== "Vendido") v.estado = "Disponible";
}

function applyStageEffects(sale, newEtapa, prevEtapa) {
  if (newEtapa === prevEtapa) return;
  const nowId = Date.now();

  if (newEtapa === "Tasacion") {
    const v = sale.vehiculoId ? (state.vehicles || []).find(x => x.id === sale.vehiculoId) : null;
    if (v && !Number(v.precio)) toast("Atención: el vehículo no tiene precio de referencia cargado en Stock.");
  }

  if (newEtapa === "Reserva") {
    if (sale.vehiculoId) {
      const v = (state.vehicles || []).find(x => x.id === sale.vehiculoId);
      if (v && v.estado !== "Vendido") v.estado = "Reservado";
    }
    const sena = Number(sale.sena || 0);
    const yaRegistrada = (state.treasury || []).some(t => (t.saleRef === sale.id || t.saleId === sale.id) && /seña/i.test(t.concepto || ""));
    if (sena > 0 && !yaRegistrada) {
      state.treasury = state.treasury || [];
      state.treasury.unshift({
        id: `trx-${nowId}`,
        saleId: sale.id,
        saleRef: sale.id,
        cuenta: "Caja",
        tipo: "Ingreso",
        concepto: `Seña — ${sale.vehiculo || "vehículo"}`,
        cliente: sale.cliente || "",
        clienteId: sale.clienteId || "",
        monto: sena,
        moneda: sale.moneda || "ARS",
        fecha: todayKey(),
        estado: "Confirmado",
        notas: `Seña de venta ID ${sale.id}`
      });
    }
  }

  if (newEtapa === "Cierre" && prevEtapa !== "Cierre") {
    closeSaleEffects(sale);
  }

  if (newEtapa === "Perdida" && prevEtapa !== "Perdida") {
    revertVehicleFromSale(sale);
  }
}

function onNewSaleCreated(item, sale) {
  const nowTs = Date.now();
  const anticipo = Number(item.anticipo || 0);
  // Register total sale price as a debt charge from day one
  state.finance = state.finance || [];
  state.finance.unshift({
    id: `fin-${nowTs - 1}`,
    saleId: sale.id,
    saleRef: sale.id,
    concepto: `Venta ${sale.vehiculo || "vehículo"} — Precio total`,
    tipo: "Cargo",
    categoria: "Venta",
    cliente: sale.cliente || "",
    clienteId: sale.clienteId || "",
    vehiculo: sale.vehiculo || "",
    vehiculoId: sale.vehiculoId || "",
    monto: Number(sale.monto || 0),
    moneda: sale.moneda || "ARS",
    fecha: item.fecha || todayKey(),
    medio: "",
    estado: "Pendiente",
    notas: ""
  });
  if (item.tieneAnticipo === "1" && anticipo > 0) {
    state.treasury = state.treasury || [];
    state.treasury.unshift({
      id: `trx-${nowTs}`,
      saleId: sale.id,
      saleRef: sale.id,
      cuenta: "Caja",
      tipo: "Ingreso",
      concepto: `Seña — ${sale.vehiculo || "vehículo"}`,
      cliente: sale.cliente || "",
      clienteId: sale.clienteId || "",
      monto: anticipo,
      moneda: sale.moneda || "ARS",
      fecha: item.fecha || todayKey(),
      medio: item.medioAnticipo || "Efectivo",
      estado: "Confirmado",
      notas: `Anticipo de venta — forma de pago: ${item.formaPago || "—"}`
    });
  }
  if (item.formaPago === "Permuta" && item.cotizacionPermutaId) {
    const srcQuote = (state.quotes || []).find(q => q.id === item.cotizacionPermutaId);
    if (srcQuote) {
      const nowTs2 = Date.now();
      state.finance.unshift({
        id: `fin-perm-${nowTs2}`,
        saleId: sale.id,
        saleRef: sale.id,
        concepto: `Permuta — ${srcQuote.vehiculo || srcQuote.cliente || "vehiculo"}`,
        tipo: "Ingreso",
        categoria: "Permuta",
        cliente: sale.cliente || "",
        clienteId: sale.clienteId || "",
        vehiculo: srcQuote.vehiculo || "",
        vehiculoId: srcQuote.vehiculoId || "",
        monto: Number(srcQuote.monto || 0),
        moneda: sale.moneda || "ARS",
        fecha: item.fecha || todayKey(),
        medio: "Permuta",
        estado: "Confirmado",
        notas: `Permuta de vehiculo — cotizacion ${srcQuote.id}`
      });
      srcQuote.estado = "Vendido";
      srcQuote.saleId = sale.id;
    }
  }
  if (item.formaPago === "Cuotas") {
    const cantCuotas = Number(item.cantCuotas || 0);
    const montoCuota = Number(item.montoCuota || 0) || (cantCuotas > 0 ? Math.round((Number(sale.monto || 0) - anticipo) / cantCuotas) : 0);
    if (cantCuotas > 0) {
      state.collections = state.collections || [];
      const fechaBase = item.fecha ? new Date(item.fecha + "T12:00:00") : new Date();
      const telefono = (state.clients || []).find(c => c.id === sale.clienteId)?.telefono || "";
      for (let i = cantCuotas - 1; i >= 0; i--) {
        const vence = new Date(fechaBase);
        vence.setMonth(vence.getMonth() + i + 1);
        state.collections.unshift({
          id: `cb-${nowTs + i + 1}`,
          saleId: sale.id,
          saleRef: sale.id,
          numeroCuota: i + 1,
          cliente: sale.cliente || "",
          clienteId: sale.clienteId || "",
          telefono,
          concepto: `Cuota ${i + 1}/${cantCuotas} — ${sale.vehiculo || ""}`,
          vehiculo: sale.vehiculo || "",
          monto: montoCuota,
          moneda: sale.moneda || "ARS",
          medio: "",
          vence: vence.toISOString().slice(0, 10),
          estado: "Pendiente",
          notas: `Cuota ${i + 1} de ${cantCuotas}`
        });
      }
    }
  }
}

function openSaleReport(saleId) {
  try {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return toast("No se pudo generar el PDF. Verificá tu conexión a internet.");

  const sale = (state.sales || []).find(s => s.id === saleId);
  if (!sale) return toast("Venta no encontrada.");

  const v      = sale.vehiculoId ? (state.vehicles || []).find(x => x.id === sale.vehiculoId) : null;
  const client = sale.clienteId  ? (state.clients  || []).find(x => x.id === sale.clienteId)  : null;
  const cuotas = getSaleCuotas(saleId);
  const cfg    = state.settings || {};
  const agencia = cfg.businessName || publicConfig.businessName || "Lake Motors";
  const moneda  = sale.moneda || "ARS";
  const fmt = (val) => `${moneda} ${Number(val || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  const clean = (s) => (s || "").replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

  const DARK  = [11, 17, 32];
  const BLUE  = [204, 17, 17];
  const LIGHT = [248, 250, 253];
  const GRAY  = [98, 108, 126];
  const LGRAY = [210, 216, 226];
  const WHITE = [255, 255, 255];

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14;
  let y = 0;

  // ─── HEADER ─────────────────────────────────────────────────────────────────
  const hdrH = 36;
  doc.setFillColor(...DARK).rect(0, 0, W, hdrH, "F");
  doc.setFillColor(...BLUE).rect(0, 0, W, 2.5, "F");
  let logoLoaded = false;
  if (defaultLogoPdfDataUrl) { try { doc.addImage(defaultLogoPdfDataUrl, "JPEG", M, 6, 24, 24, undefined, "FAST"); logoLoaded = true; } catch (_e) {} }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...WHITE);
    doc.text(agencia, M, 20);
  }
  const contactLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(180, 195, 220);
  contactLines.forEach((line, i) => doc.text(line, W - M, 12 + i * 4.8, { align: "right" }));
  const saleNum = saleId.replace(/\D/g, "").slice(-6).padStart(6, "0") || "000001";
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...BLUE);
  doc.text(`VENTA  #${saleNum}`, W - M, hdrH - 7, { align: "right" });
  y = hdrH + 10;

  // ─── TITULO ──────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...DARK);
  doc.text("COMPROBANTE DE VENTA", M, y);
  y += 3;
  const fechaDoc = sale.fecha
    ? new Date(sale.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRAY);
  doc.text(`Fecha de operacion: ${fechaDoc}`, M, y + 5);
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...BLUE);
  doc.text(`Etapa: ${sale.etapa || "—"}`, W - M, y + 5, { align: "right" });
  y += 12;
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M, y, M + 40, y);
  doc.setDrawColor(...LGRAY).setLineWidth(0.3).line(M + 40, y, W - M, y);
  y += 8;

  // ─── CLIENTE + VEHICULO ──────────────────────────────────────────────────────
  const colW = (W - 2 * M - 6) / 2;
  const colR = M + colW + 6;
  const clientName  = client?.nombre   || sale.cliente || "—";
  const clientPhone = client?.telefono || "";
  const clientEmail = client?.email    || "";
  const clientDni   = client?.dni      || "";
  const clientLines = [clientName, clientPhone && `Tel: ${clientPhone}`, clientEmail && `Email: ${clientEmail}`, clientDni && `DNI/CUIT: ${clientDni}`].filter(Boolean);
  const cardH = 8 + clientLines.length * 5.5;

  doc.setFillColor(...LIGHT).roundedRect(M, y, colW, cardH, 2, 2, "F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M, y, colW, cardH, 2, 2, "S");
  doc.setFillColor(...BLUE).rect(M, y, 2.5, cardH, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BLUE);
  doc.text("CLIENTE", M + 5, y + 5);
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...DARK);
  doc.text(clientName, M + 5, y + 10.5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRAY);
  let cy = y + 10.5;
  if (clientPhone) { cy += 5.5; doc.text(`Tel: ${clientPhone}`, M + 5, cy); }
  if (clientEmail) { cy += 5.5; doc.text(`Email: ${clientEmail}`, M + 5, cy); }
  if (clientDni)   { cy += 5.5; doc.text(`DNI/CUIT: ${clientDni}`, M + 5, cy); }

  const vLabel   = v ? `${v.marca || ""} ${v.modelo || ""} ${v.version || ""}`.replace(/ +/g, " ").trim() : (sale.vehiculo || "—");
  const vAnio    = v?.anio ? String(v.anio) : "";
  const vKm      = v?.km   ? `${Number(v.km).toLocaleString("es-AR")} km` : "";
  const vDominio = v?.dominio || "";
  const fotos    = v?.fotos || [];

  doc.setFillColor(...LIGHT).roundedRect(colR, y, colW, cardH, 2, 2, "F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(colR, y, colW, cardH, 2, 2, "S");
  doc.setFillColor(...DARK).rect(colR, y, 2.5, cardH, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...DARK);
  doc.text("VEHICULO", colR + 5, y + 5);
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...DARK);
  const vLabelLines = doc.splitTextToSize(vLabel, colW - 8);
  doc.text(vLabelLines, colR + 5, y + 10.5);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY);
  const vspec = [vAnio, vKm, vDominio].filter(Boolean).join("  ·  ");
  if (vspec) doc.text(vspec, colR + 5, y + 10.5 + 5 * vLabelLines.length);
  y += cardH + 8;

  // ─── FOTOS ───────────────────────────────────────────────────────────────────
  if (fotos.length > 0) {
    const count = Math.min(fotos.length, 3);
    const photoW = (W - 2 * M - 3 * (count - 1)) / count;
    const photoH = photoW * 0.62;
    if (y + photoH > 255) { doc.addPage(); y = 18; }
    for (let i = 0; i < count; i++) {
      try { doc.addImage(fotos[i], undefined, M + i * (photoW + 3), y, photoW, photoH, undefined, "MEDIUM"); } catch (_) {}
    }
    y += photoH + 8;
  }

  // ─── CONDICIONES ─────────────────────────────────────────────────────────────
  if (y + 50 > 270) { doc.addPage(); y = 18; }
  const anticipo  = Number(sale.anticipo || sale.sena || 0);
  const totalCuotas = Number(sale.cantCuotas || 0);
  const condLines = [
    ["Vendedor", sale.vendedor || "—"],
    ["Forma de pago", sale.formaPago || "—"],
    ...(anticipo > 0 ? [["Anticipo / Seña", `${fmt(anticipo)}${sale.medioAnticipo ? " — " + sale.medioAnticipo : ""}`]] : []),
    ...(sale.formaPago === "Cuotas" && totalCuotas > 0 ? [["Plan", `${totalCuotas} cuotas de ${fmt(sale.montoCuota)}`]] : []),
  ];
  const condCardH = 12 + condLines.length * 6.5 + 14;
  doc.setFillColor(...LIGHT).roundedRect(M, y, W - 2 * M, condCardH, 2, 2, "F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M, y, W - 2 * M, condCardH, 2, 2, "S");
  let py = y + 7;
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRAY);
  doc.text("CONDICIONES DE LA OPERACION", M + 5, py); py += 7;
  condLines.forEach(([label, val]) => {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...GRAY);
    doc.text(label + ":", M + 5, py);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...DARK);
    doc.text(String(val), W - M - 5, py, { align: "right" });
    py += 6.5;
  });
  const finalBoxY = y + condCardH - 14;
  doc.setFillColor(...DARK).roundedRect(M + 2, finalBoxY, W - 2 * M - 4, 13, 1.5, 1.5, "F");
  doc.setFillColor(...BLUE).roundedRect(M + 2, finalBoxY, 4, 13, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(160, 185, 220);
  doc.text("PRECIO ACORDADO", M + 9, finalBoxY + 8.5);
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...WHITE);
  doc.text(fmt(sale.monto), W - M - 6, finalBoxY + 8.5, { align: "right" });
  y += condCardH + 8;

  // ─── CUOTAS ──────────────────────────────────────────────────────────────────
  if (cuotas.length > 0 && sale.formaPago === "Cuotas") {
    if (y + 20 > 260) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRAY);
    doc.text("DETALLE DE CUOTAS", M, y); y += 6;
    const colWs = [16, 48, 50, 40];
    const hdrs  = ["N°", "Vencimiento", "Monto", "Estado"];
    const rowH  = 7;
    doc.setFillColor(...DARK).roundedRect(M, y, W - 2 * M, rowH, 1, 1, "F");
    let cx = M + 3;
    hdrs.forEach((h, i) => { doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...WHITE); doc.text(h, cx, y + 5); cx += colWs[i]; });
    y += rowH;
    cuotas.forEach((c, idx) => {
      if (y + rowH > 268) { doc.addPage(); y = 18; }
      if (idx % 2 === 0) doc.setFillColor(...LIGHT).rect(M, y, W - 2 * M, rowH, "F");
      doc.setDrawColor(...LGRAY).setLineWidth(0.1).rect(M, y, W - 2 * M, rowH, "S");
      cx = M + 3;
      [String(c.numeroCuota || "—"), c.vence || "—", fmt(c.monto), c.estado || "—"].forEach((val, i) => {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...DARK);
        doc.text(val, cx, y + 5); cx += colWs[i];
      });
      y += rowH;
    });
    y += 8;
  }

  // ─── NOTAS ───────────────────────────────────────────────────────────────────
  if (sale.notas) {
    if (y + 20 > 270) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRAY);
    doc.text("OBSERVACIONES", M, y); y += 5;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...DARK);
    const lines = doc.splitTextToSize(sale.notas, W - 2 * M);
    if (y + lines.length * 4.5 > 268) { doc.addPage(); y = 18; }
    doc.text(lines, M, y);
  }

  // ─── PIE ─────────────────────────────────────────────────────────────────────
  const footerY = H - 14;
  doc.setFillColor(...DARK).rect(0, footerY - 8, W, 22, "F");
  doc.setFillColor(...BLUE).rect(0, footerY - 8, W, 1.5, "F");
  if (sale.vendedor) {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...WHITE);
    doc.text(`Asesor: ${sale.vendedor}`, M, footerY + 3);
  }
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(160, 185, 220);
  doc.text(`${agencia}  ·  Comprobante de venta`, W - M, footerY + 3, { align: "right" });

  doc.save(`Venta-${clean(clientName)}-${clean(vLabel || sale.vehiculo)}.pdf`);
  } catch (e) { toast("No se pudo generar el PDF: " + (e.message || "error desconocido")); }
}

async function payCuota(cuotaId) {
  const cuota = (state.collections || []).find(c => c.id === cuotaId);
  if (!cuota) return toast("Cuota no encontrada.");
  if (/Confirmado/i.test(cuota.estado || "")) return toast("Esta cuota ya fue pagada.");
  cuota.estado = "Confirmado";
  const saleId = cuota.saleId;
  const sale = (state.sales || []).find(s => s.id === saleId);
  const nowTs = Date.now();
  state.treasury = state.treasury || [];
  state.treasury.unshift({
    id: `trx-${nowTs}`,
    saleId,
    cuenta: "Caja",
    tipo: "Ingreso",
    concepto: `Cuota ${cuota.numeroCuota}/${sale?.cantCuotas || "?"} — ${sale?.vehiculo || ""}`,
    cliente: cuota.cliente || sale?.cliente || "",
    clienteId: cuota.clienteId || sale?.clienteId || "",
    monto: cuota.monto,
    moneda: cuota.moneda || sale?.moneda || "ARS",
    fecha: todayKey(),
    medio: "",
    estado: "Confirmado",
    notas: `Pago de cuota ${cuota.numeroCuota}`
  });
  if (sale) {
    const cuotas = getSaleCuotas(saleId);
    const totalPagadas = cuotas.filter(c => /Confirmado/i.test(c.estado || "")).length;
    const totalCuotas = Number(sale.cantCuotas || cuotas.length);
    if (totalPagadas >= totalCuotas && sale.etapa !== "Cierre") {
      sale.etapa = "Cierre";
      closeSaleEffects(sale);
    }
  }
  addAudit(`Cuota ${cuota.numeroCuota} pagada — ${cuota.cliente || ""}`);
  await saveState(`Cuota ${cuota.numeroCuota} marcada como pagada`);
  render();
}

async function markNextCuota(saleId) {
  const cuotas = getSaleCuotas(saleId);
  const next = cuotas.find(c => !/Confirmado/i.test(c.estado || ""));
  if (!next) return toast("No hay cuotas pendientes.");
  await payCuota(next.id);
}

function generateQuotePDF(quoteId) {
  try {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return toast("No se pudo generar el PDF. Verificá tu conexión a internet.");

  const quote = (state.quotes || []).find(q => q.id === quoteId);
  if (!quote) return toast("Cotización no encontrada.");

  const vehicle = quote.vehiculoId ? (state.vehicles || []).find(v => v.id === quote.vehiculoId) : null;
  const client  = quote.clienteId  ? (state.clients  || []).find(c => c.id === quote.clienteId)  : null;
  const cfg = state.settings || {};
  const agencyName = cfg.businessName || publicConfig.businessName || "Lake Motors";
  const moneda = quote.moneda || "ARS";
  const fmt = (v) => `${moneda} ${Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

  // Palette
  const DARK  = [11, 17, 32];      // #0b1120
  const BLUE  = [204, 17, 17];     // #cc1111 Lake Motors red
  const LIGHT = [248, 250, 253];   // soft page bg
  const GRAY  = [98, 108, 126];
  const LGRAY = [210, 216, 226];
  const WHITE = [255, 255, 255];
  const GREEN = [22, 163, 74];

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14;
  let y = 0;

  // ─── HEADER BANNER ──────────────────────────────────────────────────────────
  const hdrH = 36;
  doc.setFillColor(...DARK).rect(0, 0, W, hdrH, "F");
  // Accent line on top
  doc.setFillColor(...BLUE).rect(0, 0, W, 2.5, "F");

  // Logo or agency name
  let logoLoaded = false;
  if (defaultLogoPdfDataUrl) { try { doc.addImage(defaultLogoPdfDataUrl, "JPEG", M, 6, 24, 24, undefined, "FAST"); logoLoaded = true; } catch (_e) {} }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...WHITE);
    doc.text(agencyName, M, 20);
  }

  // Contact block right-aligned in header
  const contactLines = [];
  if (cfg.phone)   contactLines.push(cfg.phone);
  if (cfg.email)   contactLines.push(cfg.email);
  if (cfg.address) contactLines.push(cfg.address);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(180, 195, 220);
  contactLines.forEach((line, i) => doc.text(line, W - M, 12 + i * 4.8, { align: "right" }));

  // Quote label in header
  const quoteNum = quoteId.replace(/\D/g, "").slice(-6).padStart(6, "0") || "000001";
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...BLUE);
  doc.text(`COTIZACION  #${quoteNum}`, W - M, hdrH - 7, { align: "right" });

  y = hdrH + 10;

  // ─── TITULO + FECHAS ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...DARK);
  doc.text("COTIZACION", M, y);
  y += 3;

  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRAY);
  doc.text(`Emitida el ${today}`, M, y + 5);
  if (quote.validez) {
    const vDate = new Date(quote.validez + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...BLUE);
    doc.text(`Valida hasta: ${vDate}`, W - M, y + 5, { align: "right" });
  }
  y += 12;

  // thin accent rule
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M, y, M + 40, y);
  doc.setDrawColor(...LGRAY).setLineWidth(0.3).line(M + 40, y, W - M, y);
  y += 8;

  // ─── DOS COLUMNAS: CLIENTE + VEHICULO ───────────────────────────────────────
  const colW = (W - 2 * M - 6) / 2;
  const colR = M + colW + 6;

  // Cliente card
  const clientName  = client?.nombre   || quote.cliente   || "—";
  const clientPhone = client?.telefono || quote.telefono  || "";
  const clientEmail = client?.email    || "";
  const clientLines = [clientName, clientPhone && `Tel: ${clientPhone}`, clientEmail && `Email: ${clientEmail}`].filter(Boolean);
  const cardH = 8 + clientLines.length * 5.2;

  doc.setFillColor(...LIGHT).roundedRect(M, y, colW, cardH, 2, 2, "F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M, y, colW, cardH, 2, 2, "S");
  doc.setFillColor(...BLUE).rect(M, y, 2.5, cardH, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BLUE);
  doc.text("CLIENTE", M + 5, y + 5);
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...DARK);
  doc.text(clientName, M + 5, y + 5 + 5.5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRAY);
  if (clientPhone) doc.text(`Tel: ${clientPhone}`, M + 5, y + 5 + 5.5 + 5);
  if (clientEmail) doc.text(clientEmail, M + 5, y + 5 + 5.5 + (clientPhone ? 10 : 5));

  // Vehiculo card
  const vLabel   = vehicle ? `${vehicle.marca || ""} ${vehicle.modelo || ""} ${vehicle.version || ""}`.replace(/ +/g, " ").trim() : (quote.vehiculo || "—");
  const vAnio    = vehicle?.anio    ? `${vehicle.anio}` : "";
  const vKm      = vehicle?.km      ? `${Number(vehicle.km).toLocaleString("es-AR")} km` : "";
  const vDominio = vehicle?.dominio || "";
  const fotos    = vehicle?.fotos   || [];

  doc.setFillColor(...LIGHT).roundedRect(colR, y, colW, cardH, 2, 2, "F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(colR, y, colW, cardH, 2, 2, "S");
  doc.setFillColor(...DARK).rect(colR, y, 2.5, cardH, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...DARK);
  doc.text("VEHICULO", colR + 5, y + 5);
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...DARK);
  const vLabelLines = doc.splitTextToSize(vLabel, colW - 8);
  doc.text(vLabelLines, colR + 5, y + 5 + 5.5);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY);
  const vspec = [vAnio, vKm, vDominio].filter(Boolean).join("  ·  ");
  if (vspec) doc.text(vspec, colR + 5, y + 5 + 5.5 + 5 * vLabelLines.length);

  y += cardH + 8;

  // ─── FOTOS ──────────────────────────────────────────────────────────────────
  if (fotos.length > 0) {
    const count = Math.min(fotos.length, 3);
    const gapX = 3;
    const photoW = (W - 2 * M - gapX * (count - 1)) / count;
    const photoH = photoW * 0.62;
    if (y + photoH > 255) { doc.addPage(); y = 18; }
    for (let i = 0; i < count; i++) {
      try { doc.addImage(fotos[i], undefined, M + i * (photoW + gapX), y, photoW, photoH, undefined, "MEDIUM"); } catch (_) {}
    }
    y += photoH + 8;
  }

  // ─── PRECIO ─────────────────────────────────────────────────────────────────
  if (y + 40 > 270) { doc.addPage(); y = 18; }

  const hasList = quote.precioLista && Number(quote.precioLista) > 0;
  const hasBoni = quote.bonificacion && Number(quote.bonificacion) > 0;
  const priceCardH = 10 + (hasList ? 7 : 0) + (hasBoni ? 7 : 0) + (hasList || hasBoni ? 2 : 0) + 13;

  doc.setFillColor(...LIGHT).roundedRect(M, y, W - 2 * M, priceCardH, 2, 2, "F");
  doc.setDrawColor(...LGRAY).setLineWidth(0.25).roundedRect(M, y, W - 2 * M, priceCardH, 2, 2, "S");

  let py = y + 7;
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRAY);
  doc.text("PRECIO", M + 5, py); py += 6;

  if (hasList) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRAY);
    doc.text("Precio de lista:", M + 5, py);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...DARK);
    doc.text(fmt(quote.precioLista), W - M - 5, py, { align: "right" }); py += 7;
  }
  if (hasBoni) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRAY);
    doc.text("Bonificacion:", M + 5, py);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor([34, 139, 34]);
    doc.text(`- ${fmt(quote.bonificacion)}`, W - M - 5, py, { align: "right" }); py += 7;
  }
  if (hasList || hasBoni) {
    doc.setDrawColor(...LGRAY).setLineWidth(0.2).line(M + 5, py - 2, W - M - 5, py - 2); py += 1;
  }

  // Precio final — caja azul oscuro
  const finalBoxY = y + priceCardH - 14;
  doc.setFillColor(...DARK).roundedRect(M + 2, finalBoxY, W - 2 * M - 4, 13, 1.5, 1.5, "F");
  // Left accent strip
  doc.setFillColor(...BLUE).roundedRect(M + 2, finalBoxY, 4, 13, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(160, 185, 220);
  doc.text("PRECIO FINAL", M + 9, finalBoxY + 8.5);
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...WHITE);
  doc.text(fmt(quote.monto), W - M - 6, finalBoxY + 8.5, { align: "right" });

  y += priceCardH + 8;

  // ─── CONDICIONES ────────────────────────────────────────────────────────────
  if (quote.notas) {
    if (y + 24 > 270) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRAY);
    doc.text("CONDICIONES Y OBSERVACIONES", M, y); y += 5;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...DARK);
    const lines = doc.splitTextToSize(quote.notas, W - 2 * M);
    if (y + lines.length * 4.5 > 268) { doc.addPage(); y = 18; }
    doc.text(lines, M, y);
    y += lines.length * 4.5 + 6;
  }

  // ─── PIE ────────────────────────────────────────────────────────────────────
  const footerY = H - 14;
  doc.setFillColor(...DARK).rect(0, footerY - 8, W, 22, "F");
  doc.setFillColor(...BLUE).rect(0, footerY - 8, W, 1.5, "F");
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(160, 185, 220);
  if (quote.vendedor) {
    doc.setFont("helvetica", "bold").setTextColor(...WHITE);
    doc.text(`Asesor: ${quote.vendedor}`, M, footerY + 3);
  }
  doc.setFont("helvetica", "normal").setTextColor(160, 185, 220);
  doc.text(`${agencyName}  ·  Consultas sin compromiso`, W - M, footerY + 3, { align: "right" });

  // ─── GUARDAR ────────────────────────────────────────────────────────────────
  const clean = (s) => (s || "").replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const filename = `Cotizacion-${clean(clientName)}-${clean(vLabel || quote.vehiculo)}.pdf`;
  doc.save(filename);
  } catch (e) { toast("No se pudo generar el PDF: " + (e.message || "error desconocido")); }
}

function addAudit(text) {
  state.audit = state.audit || [];
  state.audit.unshift(text);
}

function exportCurrent() {
  const map = moduleKeyMap();
  const key = map[currentModule] || sectionData[currentModule]?.key;
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

function moduleKeyMap() {
  return { calendario: "calendar", stock: "vehicles", clientes: "clients", ventas: "sales", gestoria: "paperwork", finanzas: "finance", whatsapp: "messages" };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[ch]));
}

boot();
