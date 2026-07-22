const THEME_KEY = "autos-crm-theme";

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
  fetch("/data/vehiculos-ar.json").then(r => r.json()).then(data => { catalogoVehiculos = data; }).catch(() => {});
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
}
const sectionData = {
  calendario: { key: "calendarItems", title: "Calendario", item: "evento", fields: [["fecha", "Fecha", "date"], ["hora", "Hora"], ["tipo", "Tipo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"]], columns: [["fecha", "Fecha"], ["hora", "Hora"], ["tipo", "Tipo"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"]] },
  alertas: { key: "alerts", title: "Alertas", item: "alerta", fields: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["vence", "Vence", "date"], ["estado", "Estado"]], columns: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["vence", "Vence"], ["estado", "Estado"]] },
  cotizaciones: { key: "quotes", title: "Cotizaciones", item: "cotizacion", fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["estado", "Estado"], ["fecha", "Fecha", "date"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto"], ["moneda", "Moneda"], ["estado", "Estado"], ["fecha", "Fecha"]] },
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

const moduleEnhancements = {
  alertas: { fields: [["titulo", "Titulo"], ["tipo", "Tipo"], ["prioridad", "Prioridad"], ["area", "Area"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["vence", "Vence", "date"], ["responsable", "Responsable"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["titulo", "Titulo"], ["prioridad", "Prioridad"], ["area", "Area"], ["cliente", "Cliente"], ["vence", "Vence"], ["estado", "Estado"]] },
  stock: { fields: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["version", "Version"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precio", "Precio", "number"], ["moneda", "Moneda"], ["estado", "Estado"], ["ubicacion", "Ubicacion"], ["origen", "Origen"], ["margen", "Margen", "number"], ["notas", "Notas", "textarea"]], columns: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["anio", "Anio"], ["precio", "Precio"], ["estado", "Estado"]] },
  clientes: { fields: [["nombre", "Nombre"], ["telefono", "Telefono"], ["email", "Email", "email"], ["dni", "DNI/CUIT"], ["interes", "Interes"], ["origen", "Origen"], ["vendedor", "Vendedor"], ["proximo", "Proximo contacto"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["nombre", "Nombre"], ["telefono", "Telefono"], ["interes", "Interes"], ["origen", "Origen"], ["estado", "Estado"]] },
  ventas: { fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["sena", "Sena", "number"], ["vendedor", "Vendedor"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["vendedor", "Vendedor"], ["estado", "Estado"]] },
  cotizaciones: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["precioLista", "Precio lista", "number"], ["bonificacion", "Bonificacion", "number"], ["monto", "Monto final", "number"], ["moneda", "Moneda"], ["validez", "Validez hasta", "date"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Condiciones", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto"], ["moneda", "Moneda"], ["validez", "Validez"], ["estado", "Estado"]] },
  gestoria: { fields: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["gestor", "Gestor"], ["vence", "Vence", "date"], ["costo", "Costo", "number"], ["estado", "Estado"], ["notas", "Observaciones", "textarea"]], columns: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["estado", "Estado"], ["vence", "Vence"]] },
  expedientes: { fields: [["tipo", "Tipo"], ["numero", "Numero"], ["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["vehiculoRef", "Vehiculo (legajo)"], ["dominio", "Dominio"], ["tramite", "Tramite"], ["responsable", "Responsable"], ["fechaAlta", "Fecha alta", "date"], ["vence", "Vence", "date"], ["estado", "Estado"], ["detalle", "Documentacion", "textarea"]], columns: [["tipo", "Tipo"], ["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["estado", "Estado"]] },
  reclamos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  tesoreria: { fields: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["concepto", "Concepto"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["medio", "Medio de pago"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["concepto", "Concepto"], ["monto", "Monto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  consignaciones: { fields: [["titular", "Titular"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precioPretendido", "Precio pretendido", "number"], ["comision", "Comision", "number"], ["vence", "Vence", "date"], ["estado", "Estado"], ["notas", "Condiciones", "textarea"]], columns: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido"], ["comision", "Comision"], ["vence", "Vence"], ["estado", "Estado"]] },
  pedidos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["anioDesde", "Anio desde", "number"], ["anioHasta", "Anio hasta", "number"], ["presupuesto", "Presupuesto maximo", "number"], ["moneda", "Moneda"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  liquidaciones: { fields: [["beneficiario", "Beneficiario"], ["operacion", "Operacion"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Detalle", "textarea"]], columns: [["beneficiario", "Beneficiario"], ["operacion", "Operacion"], ["concepto", "Concepto"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  infracciones: { fields: [["dominio", "Dominio"], ["vehiculo", "Vehiculo"], ["detalle", "Detalle"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["vence", "Vence", "date"], ["responsable", "Responsable"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["dominio", "Dominio"], ["vehiculo", "Vehiculo"], ["detalle", "Detalle"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  finanzas: { fields: [["concepto", "Concepto"], ["tipo", "Tipo"], ["categoria", "Categoria"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["medio", "Medio de pago"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["concepto", "Concepto"], ["tipo", "Tipo"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  reportes: { fields: [["nombre", "Nombre"], ["periodo", "Periodo"], ["area", "Area"], ["indicador", "Indicador"], ["valor", "Valor"], ["responsable", "Responsable"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["nombre", "Nombre"], ["periodo", "Periodo"], ["area", "Area"], ["indicador", "Indicador"], ["valor", "Valor"], ["estado", "Estado"]] },
  mensajes: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["canal", "Canal"], ["plantilla", "Plantilla"], ["mensaje", "Mensaje", "textarea"], ["hora", "Hora"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["canal", "Canal"], ["plantilla", "Plantilla"], ["hora", "Hora"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  conversaciones: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["canal", "Canal"], ["ultimoMensaje", "Ultimo mensaje"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  correos: { fields: [["para", "Para"], ["cliente", "Cliente"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["mensaje", "Mensaje", "textarea"], ["fecha", "Fecha", "date"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["para", "Para"], ["asunto", "Asunto"], ["plantilla", "Plantilla"], ["fecha", "Fecha"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  misventas: { fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["sena", "Sena", "number"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["proximo", "Proximo paso"], ["estado", "Estado"]] },
  postventa: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["entrega", "Entrega", "date"], ["control", "Control"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["entrega", "Entrega"], ["control", "Control"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  miscomisiones: { fields: [["operacion", "Operacion"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["porcentaje", "Porcentaje", "number"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["operacion", "Operacion"], ["cliente", "Cliente"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  cobros: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["concepto", "Concepto"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["medio", "Medio"], ["vence", "Vence", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["concepto", "Concepto"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  sugerencias: { fields: [["titulo", "Titulo"], ["area", "Area"], ["detalle", "Detalle", "textarea"], ["autor", "Autor"], ["prioridad", "Prioridad"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["titulo", "Titulo"], ["area", "Area"], ["autor", "Autor"], ["prioridad", "Prioridad"], ["estado", "Estado"]] },
  autorizaciones: { fields: [["solicitud", "Solicitud"], ["solicitante", "Solicitante"], ["area", "Area"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["prioridad", "Prioridad"], ["vence", "Vence", "date"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["solicitud", "Solicitud"], ["solicitante", "Solicitante"], ["monto", "Monto"], ["prioridad", "Prioridad"], ["estado", "Estado"]] },
  dormidos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["interes", "Interes"], ["ultimoContacto", "Ultimo contacto", "date"], ["dias", "Dias", "number"], ["responsable", "Responsable"], ["accion", "Accion"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["interes", "Interes"], ["ultimoContacto", "Ultimo contacto"], ["dias", "Dias"], ["accion", "Accion"], ["estado", "Estado"]] },
  miespacio: { fields: [["tarea", "Tarea"], ["area", "Area"], ["prioridad", "Prioridad"], ["vence", "Vence", "date"], ["responsable", "Responsable"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["tarea", "Tarea"], ["area", "Area"], ["prioridad", "Prioridad"], ["vence", "Vence"], ["estado", "Estado"]] },
  wishlist: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo buscado"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto", "number"], ["moneda", "Moneda"], ["match", "Match"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo buscado"], ["presupuesto", "Presupuesto"], ["match", "Match"], ["estado", "Estado"]] },
  nps: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["puntaje", "Puntaje", "number"], ["comentario", "Comentario", "textarea"], ["fecha", "Fecha", "date"], ["responsable", "Responsable"], ["estado", "Estado"]], columns: [["cliente", "Cliente"], ["puntaje", "Puntaje"], ["fecha", "Fecha"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  papelera: { fields: [["origen", "Origen"], ["detalle", "Detalle", "textarea"], ["eliminadoPor", "Eliminado por"], ["fecha", "Fecha", "date"], ["estado", "Estado"]], columns: [["origen", "Origen"], ["detalle", "Detalle"], ["eliminadoPor", "Eliminado por"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  telefonos: { fields: [["nombre", "Nombre"], ["area", "Area"], ["telefono", "Telefono"], ["email", "Email", "email"], ["rol", "Rol"], ["horario", "Horario"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["nombre", "Nombre"], ["area", "Area"], ["telefono", "Telefono"], ["email", "Email"], ["rol", "Rol"], ["estado", "Estado"]] },
  oportunidades: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["interes", "Interes"], ["vehiculo", "Vehiculo"], ["probabilidad", "Probabilidad"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["interes", "Interes"], ["probabilidad", "Probabilidad"], ["monto", "Monto"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  taller: { fields: [["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["trabajo", "Trabajo"], ["responsable", "Responsable"], ["proveedor", "Proveedor"], ["costo", "Costo", "number"], ["fechaIngreso", "Fecha ingreso", "date"], ["vence", "Entrega estimada", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["vehiculo", "Vehiculo"], ["trabajo", "Trabajo"], ["responsable", "Responsable"], ["costo", "Costo"], ["vence", "Entrega"], ["estado", "Estado"]] }
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

function tablePage(key, title, columns, embedded = false, moduleId = "") {
  const rows = filtered(state[key] || []);
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
            ${rows.length ? rows.map(row => `<tr${key === "clients" ? ` data-client-row="${escapeHtml(row.id)}" class="clickable-row"` : key === "vehicles" ? ` data-vehicle-row="${escapeHtml(row.id)}" class="clickable-row"` : ""}>${columns.map(c => `<td>${c.render ? c.render(row[c.key], row) : escapeHtml(row[c.key])}</td>`).join("")}<td class="record-actions">${flows.map(([flow, label]) => `<button class="icon-btn" data-module-flow="${flow}:${key}:${row.id}" title="${escapeHtml(label)}">${escapeHtml(label.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase())}</button>`).join("")}${moduleId === "cotizaciones" ? `<button class="icon-btn" data-quote-pdf="${escapeHtml(row.id)}" title="Descargar PDF" style="font-weight:700;color:var(--accent)">PDF</button>` : ""}${moduleId === "consignaciones" ? `<button class="icon-btn" data-consign-exp="${escapeHtml(row.id)}" title="Expediente tecnico">ET</button>` : ""}${key === "files" && row.tipo === "Vehiculo" ? `<button class="icon-btn" data-file-exp="${escapeHtml(row.id)}" title="Ver expediente">ET</button>` : ""}<button class="icon-btn" data-edit="${key}:${row.id}" title="Editar">E</button><button class="icon-btn" data-delete="${key}:${row.id}" title="Eliminar">X</button></td></tr>`).join("") : `<tr><td colspan="${columns.length + 1}" class="empty">No hay registros para mostrar.</td></tr>`}
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
    ...genericColumns("consignaciones")
  ];
}

function genericSectionPage(moduleId) {
  const def = sectionData[moduleId];
  if (!def) {
    return '<section class="card"><div class="card-head"><h2>Modulo en preparacion</h2></div><div class="card-body"><p class="muted">Esta seccion esta lista para conectarse.</p></div></section>';
  }
  const allRows = state[def.key] || [];
  const rows = filtered(allRows);
  const moneyTotal = totalForRows(allRows);
  const cols = moduleId === "stock" ? vehicleColumns() : moduleId === "consignaciones" ? consignacionColumns() : genericColumns(moduleId);
  return `
    <div class="grid stats module-stats">
      ${stat("Registros", allRows.length, "Total del modulo")}
      ${stat("Visibles", rows.length, query ? "Resultado filtrado" : "Sin filtro activo")}
      ${stat("Pendientes", pendingRows(allRows), "Requieren seguimiento")}
      ${stat("Monto", moneyTotal ? money(moneyTotal) : "-", "Valores asociados")}
    </div>
    <div style="margin-top:16px">
      ${tablePage(def.key, def.title, cols, false, moduleId)}
    </div>
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
        ${clientProfileTab === "resumen"    ? clientProfileResumen(client)    : ""}
        ${clientProfileTab === "cuenta"     ? clientProfileCuenta(client)     : ""}
        ${clientProfileTab === "compras"    ? clientProfileCompras(client)    : ""}
        ${clientProfileTab === "documentos" ? clientProfileDocumentos(client) : ""}
        ${clientProfileTab === "agenda"     ? clientProfileAgenda(client)     : ""}
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

function clientProfileCuenta(client) {
  const cId = client.id || "";
  const cName = (client.nombre || "").toLowerCase().trim();

  // Strict filter: ID match when record has clienteId; exact name match only for legacy records without clienteId
  function matchesCuenta(r) {
    if (!cId) return false;
    if (r.clienteId) return r.clienteId === cId;
    const rName = (r.cliente || "").toLowerCase().trim();
    return cName.length > 0 && rName === cName;
  }

  const financeRows = (state.finance || []).filter(matchesCuenta).map(r => ({ fecha: r.fecha || "", concepto: r.concepto || "", tipo: r.tipo || "Ingreso", monto: Number(r.monto || 0), origen: "Finanzas" }));
  const treasuryRows = (state.treasury || []).filter(matchesCuenta).map(r => ({ fecha: r.fecha || "", concepto: r.concepto || "", tipo: r.tipo || "Ingreso", monto: Number(r.monto || 0), origen: "Tesoreria" }));
  const collectionRows = (state.collections || []).filter(matchesCuenta).map(r => ({ fecha: r.vence || "", concepto: r.concepto || "Cobro", tipo: "Cobro pendiente", monto: Number(r.monto || 0), origen: "Cobros" }));
  const all = [...financeRows, ...treasuryRows, ...collectionRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const emptyState = `<div class="card-body"><p class="muted">Sin movimientos registrados para este cliente.</p></div>`;
  let balance = 0;
  const rows = all.map(r => {
    balance += /Ingreso/i.test(r.tipo) ? r.monto : /Egreso/i.test(r.tipo) ? -r.monto : 0;
    return { ...r, balance };
  });
  const total = rows[rows.length - 1]?.balance || 0;
  return `
    <section class="card profile-section">
      <div class="card-head">
        <h2>Cuenta corriente</h2>
        <div style="display:flex;gap:8px;align-items:center">
          ${all.length ? `<span class="pill ${total >= 0 ? "ok" : "hot"}">Saldo: ${money(Math.abs(total))} ${total >= 0 ? "a favor" : "a cargo"}</span>` : ""}
          <button class="btn" data-quick-action="client-payment:${escapeHtml(cId)}">+ Registrar pago</button>
        </div>
      </div>
      ${!all.length ? emptyState : `<div style="overflow:auto">
        <table>
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Origen</th><th>Saldo acum.</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td>${escapeHtml(r.fecha)}</td>
              <td>${escapeHtml(r.concepto)}</td>
              <td>${pill(r.tipo)}</td>
              <td class="${/Ingreso/i.test(r.tipo) ? "cuenta-ingreso" : "cuenta-egreso"}">${money(r.monto)}</td>
              <td><span class="pill info">${escapeHtml(r.origen)}</span></td>
              <td class="${r.balance >= 0 ? "saldo-ok" : "saldo-neg"}">${money(Math.abs(r.balance))} ${r.balance >= 0 ? "+" : "-"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
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
        ${sales.length ? `<div style="overflow:auto"><table><thead><tr><th></th><th>Vehiculo</th><th>Monto</th><th>Etapa</th><th>Vendedor</th></tr></thead><tbody>
          ${sales.map(s => {
            const v = s.vehiculoId ? (state.vehicles || []).find(x => x.id === s.vehiculoId) : null;
            const thumb = v?.fotos?.[0] ? `<img class="row-thumb" src="${escapeHtml(v.fotos[0])}" alt="foto">` : `<div class="row-thumb-placeholder"></div>`;
            return `<tr><td style="width:60px">${thumb}</td><td><strong>${escapeHtml(s.vehiculo)}</strong></td><td>${money(s.monto)}</td><td>${pill(s.etapa)}</td><td>${escapeHtml(s.vendedor)}</td></tr>`;
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
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal">
        <div class="modal-head">
          <div><h2>Registrar pago</h2><p>Movimiento en cuenta corriente de ${escapeHtml(client.nombre)}</p></div>
          <button class="icon-btn" data-close>X</button>
        </div>
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
    pedidos: [["order-opportunity", "Crear oportunidad"], ["order-calendar", "Agendar busqueda"]],
    wishlist: [["order-opportunity", "Crear oportunidad"], ["order-calendar", "Agendar busqueda"]],
    oportunidades: [["opportunity-sale", "Pasar a venta"], ["opportunity-calendar", "Agendar seguimiento"]],
    cotizaciones: [["quote-message", "Preparar mensaje"], ["quote-sale", "Crear venta"]],
    reclamos: [["claim-calendar", "Agendar reclamo"], ["claim-message", "Avisar cliente"]],
    postventa: [["after-calendar", "Agendar control"], ["after-message", "Mensaje postventa"]],
    cobros: [["collection-alert", "Crear alerta"], ["collection-message", "Avisar cobro"]],
    taller: [["workshop-alert", "Alerta taller"], ["workshop-calendar", "Agendar entrega"]],
    expedientes: [["file-alert", "Alerta tramite"], ["file-calendar", "Agendar gestion"]],
    infracciones: [["ticket-alert", "Alerta multa"]],
    autorizaciones: [["authorization-alert", "Alerta aprobacion"]],
    dormidos: [["sleeping-message", "Reactivar lead"], ["sleeping-calendar", "Agendar llamada"]],
    nps: [["nps-message", "Responder encuesta"]],
    clientes: [["client-opportunity", "Crear oportunidad"], ["client-calendar", "Agendar contacto"]],
    stock: [["stock-quote", "Crear cotizacion"]],
    ventas: [["sale-file", "Generar expediente"]],
    consignaciones: [["consignment-stock", "Pasar a Stock"]]
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
        <div style="max-height:35vh;overflow-y:auto;padding:0 2px 12px;border-bottom:1px solid var(--border);margin-bottom:16px">
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);margin-bottom:10px">HISTORIAL (${historial.length} ${historial.length === 1 ? "entrada" : "entradas"})</h3>
          ${histHtml}
        </div>
        <div>
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);margin-bottom:10px">NUEVA ENTRADA</h3>
          <div class="field full" style="margin-bottom:12px">
            <label>Notas de estado (mecanico, chapa, interior, documentacion)</label>
            <textarea id="exp-notas" rows="4" placeholder="Ej: Golpe en paragolpes trasero. Motor sin observaciones. Cedula verde presente. VTV vence 10/2026."></textarea>
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
    if (!notas && _expPhotosBuf.length === 0) return toast("Escribi una nota o agrega al menos una foto.");
    const entrada = {
      id: `h-${Date.now()}`,
      fecha: todayKey(),
      autor: authUser?.name || authUser?.email || "Sistema",
      notas,
      fotos: _expPhotosBuf.slice()
    };
    state.files = state.files || [];
    if (existing) {
      existing.historial = existing.historial || [];
      existing.historial.push(entrada);
    } else {
      state.files.unshift({
        id: `ex-V-${Date.now()}`,
        tipo: "Vehiculo",
        vehiculoId: vehiculoId || "",
        vehiculoRef: label,
        consignacionId: consignacionId || "",
        estado: "Activo",
        historial: [entrada]
      });
    }
    addAudit(`Expediente tecnico actualizado: ${label}`);
    await saveState("Entrada guardada en expediente tecnico");
    document.querySelector("[data-modal]")?.remove();
    toast("Entrada guardada correctamente");
  });
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
  const agencyName = publicConfig.businessName || state?.settings?.businessName || "Sote CRM";
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
    { moduleId: "autorizaciones",key: "authorizations",dateField: "vence",          label: "Autorizacion", titleFn: r => r.solicitud || "Autorizacion" },
    { moduleId: "infracciones",  key: "tickets",       dateField: "vence",          label: "Infraccion",   titleFn: r => [r.dominio, r.detalle].filter(Boolean).join(" - ") || "Infraccion" },
    { moduleId: "postventa",     key: "afterSales",    dateField: "entrega",        label: "Postventa",    titleFn: r => `Entrega: ${[r.cliente, r.vehiculo].filter(Boolean).join(" - ")}` },
    { moduleId: "taller",        key: "workshop",      dateField: "vence",          label: "Taller",       titleFn: r => [r.vehiculo, r.trabajo].filter(Boolean).join(" - ") || "Taller" },
    { moduleId: "miespacio",     key: "workspace",     dateField: "vence",          label: "Mi espacio",   titleFn: r => r.tarea || "Tarea" },
    { moduleId: "dormidos",      key: "sleepingLeads", dateField: "ultimoContacto", label: "Dormido",      titleFn: r => `Reactivar: ${r.cliente || "lead"}` },
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
  return fieldControl({ name, label, type, value });
}

function logoMarkup(className) {
  const src = state?.settings?.logoDataUrl || publicConfig.logoDataUrl;
  if (!src) return "";
  return `<img class="${className}" src="${escapeHtml(src)}" alt="Logo de la agencia">`;
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
    return groupedForm(key, fields, row) + vehiclePhotoSection(row);
  }
  if (key === "consignments") {
    _vehiclePhotosBuf = (row.fotos || []).slice();
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
  const anticipo = Number(row.anticipo || row.sena || 0);
  const showAnticipo = anticipo > 0;

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
            ${["Contado", "Financiado", "Cuotas"].map(o => `<option ${formaPago === o ? "selected" : ""}>${o}</option>`).join("")}
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
    probabilidad: { type: "select", options: ["Alta", "Media", "Baja"] }
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
    orders: ["Activo", "Buscando", "Pausado", "Con match", "Cerrado"]
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
    "Alerta": "hot", "Demorado": "hot",
    // crit — rojo
    "Cancelado": "crit", "Vencido": "crit", "Critico": "crit",
    "Baja": "crit", "Rechazado": "crit", "Suspendido": "crit",
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
      await saveState("Bienvenido a Sote CRM");
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
  document.querySelectorAll("[data-quote-pdf]").forEach(btn => btn.addEventListener("click", () => generateQuotePDF(btn.dataset.quotePdf)));
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
          if (/^(anio|anioDesde|anioHasta|km|precio|margen|monto|sena|anticipo|cantCuotas|montoCuota|precioPretendido|comision|costo|presupuesto|puntaje|dias)$/.test(k)) item[k] = Number(item[k]);
        });
        const prevEtapa = (id && key === "sales") ? (state[key].find(x => x.id === id)?.etapa) : null;
        if (key === "vehicles" || key === "consignments") item.fotos = _vehiclePhotosBuf.slice();
        if (key === "sales") {
          const cSel = e.target.querySelector("[data-sales-client]");
          const vSel = e.target.querySelector("[data-sales-vehicle]");
          if (cSel?.value) item.cliente = cSel.selectedOptions[0]?.dataset.nombre || item.cliente || "";
          if (vSel?.value) item.vehiculo = vSel.selectedOptions[0]?.dataset.nombre || item.vehiculo || "";
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
          if (!id && saved) {
            if (item.tieneAnticipo === "1" && Number(item.anticipo || 0) > 0) {
              saved.sena = Number(item.anticipo);
            }
            onNewSaleCreated(item, saved);
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

  // Sales form: show/hide cuotas section on forma de pago change
  const sfFormaPago = document.querySelector("#sf-forma-pago");
  if (sfFormaPago && !sfFormaPago.dataset.bound) {
    sfFormaPago.dataset.bound = "true";
    sfFormaPago.addEventListener("change", () => {
      const sec = document.getElementById("sf-cuotas-section");
      if (sec) sec.style.display = sfFormaPago.value === "Cuotas" ? "" : "none";
      sfRecalcMontoCuota();
    });
  }

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
    sfMonto2.addEventListener("input", sfRecalcMontoCuota);
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
  }

  if (!(state.finance || []).some(f => f.saleRef === sale.id)) {
    state.finance = state.finance || [];
    state.finance.unshift({
      id: `fin-${nowId}`,
      saleRef: sale.id,
      concepto: `Venta ${vLabel}`,
      tipo: "Ingreso",
      categoria: "Venta",
      cliente: sale.cliente || "",
      clienteId: sale.clienteId || "",
      vehiculo: vLabel,
      vehiculoId: sale.vehiculoId || "",
      monto: total,
      moneda: sale.moneda || "ARS",
      fecha: todayKey(),
      medio: "",
      estado: "Confirmado",
      notas: sena > 0 ? `Seña previa: ${money(sena)} · Saldo: ${money(saldo)}` : ""
    });
  }

  const saldoYaEnTesoreria = (state.treasury || []).some(t => t.saleRef === sale.id && /saldo/i.test(t.concepto || ""));
  if (saldo > 0 && !saldoYaEnTesoreria) {
    state.treasury = state.treasury || [];
    state.treasury.unshift({
      id: `trx-${nowId + 1}`,
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

  if (saldo > 0) {
    state.collections = state.collections || [];
    const yaEnCobros = state.collections.some(c => c.saleRef === sale.id);
    if (!yaEnCobros) {
      state.collections.unshift({
        id: `cb-${nowId + 2}`,
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
  if (!(state.files || []).some(f => f.saleRef === sale.id)) {
    state.files = state.files || [];
    const vDom = (state.vehicles || []).find(x => x.id === sale.vehiculoId)?.dominio || "";
    state.files.unshift({
      id: `ex-${nowId + 10}`,
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
  if (sale.vendedor && !(state.settlements || []).some(s => s.saleRef === sale.id)) {
    const comision = Math.round(Number(sale.monto || 0) * 0.02);
    state.settlements = state.settlements || [];
    state.settlements.unshift({
      id: `li-${nowId + 11}`,
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
    const yaRegistrada = (state.treasury || []).some(t => t.saleRef === sale.id && /seña/i.test(t.concepto || ""));
    if (sena > 0 && !yaRegistrada) {
      state.treasury = state.treasury || [];
      state.treasury.unshift({
        id: `trx-${nowId}`,
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
  const sale = (state.sales || []).find(s => s.id === saleId);
  if (!sale) return toast("Venta no encontrada.");
  const v = sale.vehiculoId ? (state.vehicles || []).find(x => x.id === sale.vehiculoId) : null;
  const client = sale.clienteId ? (state.clients || []).find(x => x.id === sale.clienteId) : null;
  const cuotas = getSaleCuotas(saleId);
  const agencia = state.settings?.businessName || publicConfig.businessName || "Sote Auto";
  const thumb = v?.fotos?.[0] ? `<img src="${escapeHtml(v.fotos[0])}" style="max-width:180px;border-radius:6px;margin:8px 0">` : "";
  const vehiculoDesc = v ? `${v.marca || ""} ${v.modelo || ""} ${v.version || ""}`.trim() : (sale.vehiculo || "—");
  const anticipo = Number(sale.anticipo || sale.sena || 0);
  const totalCuotas = Number(sale.cantCuotas || 0);

  const cuotasHtml = totalCuotas > 0 && sale.formaPago === "Cuotas" ? `
    <h4 style="margin:16px 0 8px;font-size:13px;text-transform:uppercase;color:#666">Detalle de cuotas</h4>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:6px 8px;text-align:left;border:1px solid #ddd">N°</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #ddd">Vencimiento</th>
        <th style="padding:6px 8px;text-align:right;border:1px solid #ddd">Monto</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #ddd">Estado</th>
      </tr></thead>
      <tbody>${cuotas.map(c => `<tr>
        <td style="padding:5px 8px;border:1px solid #ddd">${c.numeroCuota || "—"}</td>
        <td style="padding:5px 8px;border:1px solid #ddd">${c.vence || "—"}</td>
        <td style="padding:5px 8px;text-align:right;border:1px solid #ddd">${money(c.monto)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd">${c.estado || "—"}</td>
      </tr>`).join("")}</tbody>
    </table>` : "";

  const reportHtml = `
    <div style="font-family:Georgia,serif;color:#111;padding:8px">
      <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px">
        <h2 style="margin:0;font-size:20px">${escapeHtml(agencia)}</h2>
        <p style="margin:4px 0;font-size:12px;color:#666">Comprobante de operación — ${escapeHtml(sale.fecha || new Date().toLocaleDateString("es-AR"))}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px">
        <div>
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#888;font-family:sans-serif">Vehículo</p>
          ${thumb}
          <p style="margin:4px 0;font-size:15px"><strong>${escapeHtml(vehiculoDesc)}</strong></p>
          ${v?.dominio ? `<p style="margin:3px 0;font-size:13px">Dominio: <strong>${escapeHtml(v.dominio)}</strong></p>` : ""}
          ${v?.anio ? `<p style="margin:3px 0;font-size:13px">Año: ${escapeHtml(String(v.anio))}</p>` : ""}
          ${v?.km ? `<p style="margin:3px 0;font-size:13px">Km: ${Number(v.km).toLocaleString("es-AR")}</p>` : ""}
        </div>
        <div>
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#888;font-family:sans-serif">Cliente</p>
          <p style="margin:4px 0;font-size:15px"><strong>${escapeHtml(client?.nombre || sale.cliente || "—")}</strong></p>
          ${client?.telefono ? `<p style="margin:3px 0;font-size:13px">Tel: ${escapeHtml(client.telefono)}</p>` : ""}
          ${client?.email ? `<p style="margin:3px 0;font-size:13px">Email: ${escapeHtml(client.email)}</p>` : ""}
          ${client?.dni ? `<p style="margin:3px 0;font-size:13px">DNI/CUIT: ${escapeHtml(client.dni)}</p>` : ""}
        </div>
      </div>
      <div style="border:1px solid #ddd;border-radius:4px;padding:14px;margin-bottom:16px;font-size:13px">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;color:#888;font-family:sans-serif">Condiciones de la operación</p>
        <p style="margin:4px 0">Precio acordado: <strong>${money(sale.monto)} ${escapeHtml(sale.moneda || "ARS")}</strong></p>
        <p style="margin:4px 0">Forma de pago: <strong>${escapeHtml(sale.formaPago || "—")}</strong></p>
        ${anticipo > 0 ? `<p style="margin:4px 0">Anticipo entregado: <strong>${money(anticipo)}</strong>${sale.medioAnticipo ? ` (${escapeHtml(sale.medioAnticipo)})` : ""}</p>` : ""}
        ${sale.formaPago === "Cuotas" && totalCuotas > 0 ? `<p style="margin:4px 0">Plan: <strong>${totalCuotas} cuotas de ${money(sale.montoCuota)}</strong></p>` : ""}
        <p style="margin:4px 0">Vendedor: ${escapeHtml(sale.vendedor || "—")}</p>
        <p style="margin:4px 0">Fecha de operación: ${escapeHtml(sale.fecha || "—")}</p>
        <p style="margin:4px 0">Etapa: ${escapeHtml(sale.etapa || "—")}</p>
        ${sale.notas ? `<p style="margin:4px 0;color:#555"><em>${escapeHtml(sale.notas)}</em></p>` : ""}
      </div>
      ${cuotasHtml}
      <div style="text-align:center;margin-top:20px;font-size:11px;color:#aaa;font-family:sans-serif">Generado por Sote CRM · ${escapeHtml(agencia)}</div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-modal>
      <section class="modal" style="max-width:680px;max-height:88vh;overflow-y:auto">
        <div class="modal-head">
          <div><h2>Informe de venta</h2><p>${escapeHtml(vehiculoDesc)}</p></div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn ghost" onclick="window.print()">Imprimir</button>
            <button class="icon-btn" data-close>X</button>
          </div>
        </div>
        <div style="padding:16px">${reportHtml}</div>
      </section>
    </div>
  `);
  document.querySelectorAll("[data-close]").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => btn.closest("[data-modal]")?.remove());
  });
}

async function markNextCuota(saleId) {
  const cuotas = getSaleCuotas(saleId);
  const next = cuotas.find(c => !/Confirmado/i.test(c.estado || ""));
  if (!next) return toast("No hay cuotas pendientes.");
  next.estado = "Confirmado";
  const sale = (state.sales || []).find(s => s.id === saleId);
  const nowTs = Date.now();
  state.treasury = state.treasury || [];
  state.treasury.unshift({
    id: `trx-${nowTs}`,
    saleId,
    cuenta: "Caja",
    tipo: "Ingreso",
    concepto: `Cuota ${next.numeroCuota}/${sale?.cantCuotas || "?"} — ${sale?.vehiculo || ""}`,
    cliente: next.cliente || sale?.cliente || "",
    clienteId: next.clienteId || sale?.clienteId || "",
    monto: next.monto,
    moneda: next.moneda || sale?.moneda || "ARS",
    fecha: todayKey(),
    medio: "",
    estado: "Confirmado",
    notas: `Pago de cuota ${next.numeroCuota}`
  });
  const totalPagadas = cuotas.filter(c => /Confirmado/i.test(c.estado || "")).length;
  const totalCuotas = Number(sale?.cantCuotas || cuotas.length);
  if (totalPagadas >= totalCuotas && sale && sale.etapa !== "Cierre") {
    sale.etapa = "Cierre";
    closeSaleEffects(sale);
  }
  addAudit(`Cuota ${next.numeroCuota} pagada — ${next.cliente || ""}`);
  await saveState(`Cuota ${next.numeroCuota} marcada como pagada`);
  render();
}

function generateQuotePDF(quoteId) {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return toast("No se pudo generar el PDF. Verificá tu conexión a internet.");

  const quote = (state.quotes || []).find(q => q.id === quoteId);
  if (!quote) return toast("Cotización no encontrada.");

  const vehicle = quote.vehiculoId ? (state.vehicles || []).find(v => v.id === quote.vehiculoId) : null;
  const client  = quote.clienteId  ? (state.clients  || []).find(c => c.id === quote.clienteId)  : null;
  const cfg = state.settings || {};
  const agencyName = cfg.businessName || publicConfig.businessName || "Sote CRM";
  const moneda = quote.moneda || "ARS";
  const fmt = (v) => `${moneda} ${Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  let y = 18;

  // ─── ENCABEZADO ─────────────────────────────────────────────────────────────
  let logoLoaded = false;
  if (cfg.logoDataUrl) {
    try {
      doc.addImage(cfg.logoDataUrl, undefined, M, y, 38, 18, undefined, "FAST");
      logoLoaded = true;
    } catch (_) { /* fallback to text */ }
  }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20, 40, 80);
    doc.text(agencyName, M, y + 10);
  }
  // agency contact (right-aligned block)
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90, 90, 90);
  const contactLines = [agencyName];
  if (cfg.phone)   contactLines.push(`Tel: ${cfg.phone}`);
  if (cfg.email)   contactLines.push(cfg.email);
  if (cfg.address) contactLines.push(cfg.address);
  contactLines.forEach((line, i) => doc.text(line, W - M, y + 3 + i * 4.5, { align: "right" }));
  y += 24;

  // horizontal rule
  doc.setDrawColor(210, 210, 210).setLineWidth(0.4).line(M, y, W - M, y);
  y += 8;

  // ─── TÍTULO ─────────────────────────────────────────────────────────────────
  const quoteNum = quoteId.replace(/\D/g, "").slice(-6).padStart(6, "0") || "000001";
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20, 40, 80);
  doc.text("COTIZACIÓN", M, y);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110, 110, 110);
  doc.text(`Ref. #${quoteNum}`, M + 60, y);
  y += 7;

  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(9).setTextColor(80, 80, 80);
  doc.text(`Emisión: ${today}`, M, y);
  if (quote.validez) {
    const vDate = new Date(quote.validez + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Válida hasta: ${vDate}`, M + 80, y);
  }
  y += 10;

  // ─── CLIENTE ────────────────────────────────────────────────────────────────
  const clientName  = client?.nombre   || quote.cliente   || "—";
  const clientPhone = client?.telefono || quote.telefono  || "";
  const clientEmail = client?.email    || "";
  doc.setFillColor(240, 245, 255).rect(M, y - 1, W - 2 * M, 5 + (clientPhone ? 5 : 0) + (clientEmail ? 5 : 0) + 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 40, 80);
  doc.text("CLIENTE", M + 2, y + 3);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(20, 20, 20);
  y += 7;
  doc.text(clientName, M + 2, y); y += 5;
  if (clientPhone) { doc.setFontSize(9).setTextColor(80,80,80); doc.text(`Tel: ${clientPhone}`, M + 2, y); y += 5; }
  if (clientEmail) { doc.setFontSize(9).setTextColor(80,80,80); doc.text(`Email: ${clientEmail}`, M + 2, y); y += 5; }
  y += 5;

  // ─── VEHÍCULO ───────────────────────────────────────────────────────────────
  const vLabel   = vehicle ? `${vehicle.marca || ""} ${vehicle.modelo || ""} ${vehicle.version || ""}`.replace(/ +/g, " ").trim() : (quote.vehiculo || "—");
  const vAnio    = vehicle?.anio    ? String(vehicle.anio)   : "";
  const vKm      = vehicle?.km      ? `${Number(vehicle.km).toLocaleString("es-AR")} km` : "";
  const vDominio = vehicle?.dominio || "";
  const fotos    = vehicle?.fotos   || [];

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 40, 80);
  doc.text("VEHÍCULO", M, y); y += 5;
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(10, 10, 10);
  doc.text(vLabel, M, y); y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80, 80, 80);
  const vDetails = [vAnio && `Año: ${vAnio}`, vKm && `Km: ${vKm}`, vDominio && `Dominio: ${vDominio}`].filter(Boolean);
  if (vDetails.length) { doc.text(vDetails.join("   ·   "), M, y); y += 6; }
  y += 2;

  // vehicle photos (up to 3)
  if (fotos.length > 0) {
    const count = Math.min(fotos.length, 3);
    const gapX = 4, photoW = (W - 2 * M - gapX * (count - 1)) / count;
    const photoH = photoW * 0.62;
    if (y + photoH > 265) { doc.addPage(); y = 20; }
    for (let i = 0; i < count; i++) {
      try {
        doc.addImage(fotos[i], undefined, M + i * (photoW + gapX), y, photoW, photoH, undefined, "MEDIUM");
      } catch (_) { /* skip failed image */ }
    }
    y += photoH + 6;
  }

  // ─── PRECIO ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 210, 210).line(M, y, W - M, y); y += 8;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 40, 80);
  doc.text("PRECIO", M, y); y += 6;

  if (quote.precioLista && Number(quote.precioLista) > 0) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 60, 60);
    doc.text(`Precio de lista:`, M, y);
    doc.text(fmt(quote.precioLista), W - M, y, { align: "right" }); y += 5;
  }
  if (quote.bonificacion && Number(quote.bonificacion) > 0) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 60, 60);
    doc.text(`Bonificación:`, M, y);
    doc.text(`- ${fmt(quote.bonificacion)}`, W - M, y, { align: "right" }); y += 5;
  }
  // final price — big and highlighted
  y += 2;
  doc.setFillColor(20, 40, 80).rect(M, y - 4, W - 2 * M, 12, "F");
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(255, 255, 255);
  doc.text("PRECIO FINAL:", M + 4, y + 4);
  doc.setFontSize(15);
  doc.text(fmt(quote.monto), W - M - 4, y + 4, { align: "right" });
  y += 16;

  // ─── CONDICIONES ────────────────────────────────────────────────────────────
  if (quote.notas) {
    doc.setDrawColor(210,210,210).line(M, y, W - M, y); y += 7;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 40, 80);
    doc.text("CONDICIONES", M, y); y += 5;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(quote.notas, W - 2 * M);
    if (y + lines.length * 4.5 > 265) { doc.addPage(); y = 20; }
    doc.text(lines, M, y);
    y += lines.length * 4.5 + 4;
  }

  // ─── PIE ────────────────────────────────────────────────────────────────────
  const footerY = 285;
  doc.setDrawColor(210,210,210).line(M, footerY - 4, W - M, footerY - 4);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120,120,120);
  if (quote.vendedor) doc.text(`Asesor: ${quote.vendedor}`, M, footerY);
  doc.text(`${agencyName} · Ante cualquier consulta no dudes en contactarnos.`, W - M, footerY, { align: "right" });

  // ─── GUARDAR ────────────────────────────────────────────────────────────────
  const clean = (s) => (s || "").replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const filename = `Cotizacion-${clean(clientName)}-${clean(vLabel || quote.vehiculo)}.pdf`;
  try { doc.save(filename); } catch (e) { toast("No se pudo guardar el PDF: " + (e.message || "error desconocido")); }
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
  return { calendario: "calendar", stock: "vehicles", clientes: "clients", ventas: "sales", gestoria: "paperwork", finanzas: "finance", whatsapp: "messages", mensajes: "messages" };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[ch]));
}

boot();
