const THEME_KEY = "autos-crm-theme";

let state = null;
let authUser = null;
let currentModule = "dashboard";
let query = "";
let publicConfig = {};
let calendarView = "month";
let calendarCursor = new Date().toISOString().slice(0, 10);

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
  stock: { fields: [["dominio", "Dominio"], ["marca", "Marca"], ["modelo", "Modelo"], ["version", "Version"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precio", "Precio", "number"], ["moneda", "Moneda"], ["estado", "Estado"], ["ubicacion", "Ubicacion"], ["origen", "Origen"], ["margen", "Margen", "number"], ["notas", "Notas", "textarea"]] },
  clientes: { fields: [["nombre", "Nombre"], ["telefono", "Telefono"], ["email", "Email", "email"], ["dni", "DNI/CUIT"], ["interes", "Interes"], ["origen", "Origen"], ["vendedor", "Vendedor"], ["proximo", "Proximo contacto"], ["estado", "Estado"], ["notas", "Notas", "textarea"]] },
  ventas: { fields: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["sena", "Sena", "number"], ["vendedor", "Vendedor"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["notas", "Notas", "textarea"]] },
  cotizaciones: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["precioLista", "Precio lista", "number"], ["bonificacion", "Bonificacion", "number"], ["monto", "Monto final", "number"], ["moneda", "Moneda"], ["validez", "Validez hasta", "date"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Condiciones", "textarea"]], columns: [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto"], ["moneda", "Moneda"], ["validez", "Validez"], ["estado", "Estado"]] },
  gestoria: { fields: [["tramite", "Tramite"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["gestor", "Gestor"], ["vence", "Vence", "date"], ["costo", "Costo", "number"], ["estado", "Estado"], ["notas", "Observaciones", "textarea"]] },
  expedientes: { fields: [["numero", "Numero"], ["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["tramite", "Tramite"], ["responsable", "Responsable"], ["fechaAlta", "Fecha alta", "date"], ["vence", "Vence", "date"], ["estado", "Estado"], ["detalle", "Documentacion", "textarea"]], columns: [["numero", "Numero"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["tramite", "Tramite"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  reclamos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["responsable", "Responsable"], ["proximo", "Proximo paso"], ["estado", "Estado"], ["detalle", "Detalle", "textarea"]], columns: [["cliente", "Cliente"], ["motivo", "Motivo"], ["canal", "Canal"], ["prioridad", "Prioridad"], ["responsable", "Responsable"], ["estado", "Estado"]] },
  tesoreria: { fields: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["concepto", "Concepto"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["medio", "Medio de pago"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cuenta", "Cuenta"], ["tipo", "Tipo"], ["concepto", "Concepto"], ["monto", "Monto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  consignaciones: { fields: [["titular", "Titular"], ["telefono", "Telefono"], ["vehiculo", "Vehiculo"], ["dominio", "Dominio"], ["anio", "Anio", "number"], ["km", "Kilometros", "number"], ["precioPretendido", "Precio pretendido", "number"], ["comision", "Comision", "number"], ["vence", "Vence", "date"], ["estado", "Estado"], ["notas", "Condiciones", "textarea"]], columns: [["titular", "Titular"], ["vehiculo", "Vehiculo"], ["precioPretendido", "Precio pretendido"], ["comision", "Comision"], ["vence", "Vence"], ["estado", "Estado"]] },
  pedidos: { fields: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["anioDesde", "Anio desde", "number"], ["anioHasta", "Anio hasta", "number"], ["presupuesto", "Presupuesto maximo", "number"], ["moneda", "Moneda"], ["vendedor", "Vendedor"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["cliente", "Cliente"], ["telefono", "Telefono"], ["marca", "Marca"], ["modelo", "Modelo"], ["presupuesto", "Presupuesto"], ["moneda", "Moneda"], ["estado", "Estado"]] },
  liquidaciones: { fields: [["beneficiario", "Beneficiario"], ["operacion", "Operacion"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["concepto", "Concepto"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["estado", "Estado"], ["notas", "Detalle", "textarea"]], columns: [["beneficiario", "Beneficiario"], ["operacion", "Operacion"], ["concepto", "Concepto"], ["monto", "Monto"], ["fecha", "Fecha"], ["estado", "Estado"]] },
  infracciones: { fields: [["dominio", "Dominio"], ["vehiculo", "Vehiculo"], ["detalle", "Detalle"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["vence", "Vence", "date"], ["responsable", "Responsable"], ["estado", "Estado"], ["notas", "Notas", "textarea"]], columns: [["dominio", "Dominio"], ["vehiculo", "Vehiculo"], ["detalle", "Detalle"], ["monto", "Monto"], ["vence", "Vence"], ["estado", "Estado"]] },
  finanzas: { fields: [["concepto", "Concepto"], ["tipo", "Tipo"], ["categoria", "Categoria"], ["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["monto", "Monto", "number"], ["moneda", "Moneda"], ["fecha", "Fecha", "date"], ["medio", "Medio de pago"], ["estado", "Estado"], ["notas", "Notas", "textarea"]] },
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
  ventas: { key: "sales", title: "Ventas", item: "oportunidad" },
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
  if (currentModule === "calendario") return calendarPage();
  if (currentModule === "ventas") return salesPage();
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
            ${rows.length ? rows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row[c.key], row) : escapeHtml(row[c.key])}</td>`).join("")}<td class="record-actions">${flows.map(([flow, label]) => `<button class="icon-btn" data-module-flow="${flow}:${key}:${row.id}" title="${escapeHtml(label)}">${escapeHtml(label.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase())}</button>`).join("")}<button class="icon-btn" data-edit="${key}:${row.id}" title="Editar">E</button><button class="icon-btn" data-delete="${key}:${row.id}" title="Eliminar">X</button></td></tr>`).join("") : `<tr><td colspan="${columns.length + 1}" class="empty">No hay registros para mostrar.</td></tr>`}
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
  const rows = filtered(state[def.key] || []);
  const allRows = state[def.key] || [];
  const moneyTotal = totalForRows(allRows);
  const next = nextDatedRow(allRows);
  const first = rows[0] || allRows[0];
  return `
    <div class="grid stats module-stats">
      ${stat("Registros", allRows.length, "Total del modulo")}
      ${stat("Visibles", rows.length, query ? "Resultado filtrado" : "Sin filtro activo")}
      ${stat("Pendientes", pendingRows(allRows), "Requieren seguimiento")}
      ${stat("Monto", moneyTotal ? money(moneyTotal) : "-", "Valores asociados")}
    </div>
    <div class="grid two-col module-grid" style="margin-top:16px">
      ${tablePage(def.key, def.title, genericColumns(moduleId), false, moduleId)}
      <section class="card module-panel">
        <div class="card-head"><h2>Gestion</h2><span class="pill info">${escapeHtml(def.title)}</span></div>
        <div class="card-body">
          <div class="module-actions">
            <button class="btn" data-section-action="new:${def.key}">Nuevo</button>
            <button class="btn ghost" data-section-action="complete:${def.key}">Resolver pendiente</button>
            <button class="btn ghost" data-section-action="duplicate:${def.key}">Duplicar primero</button>
            <button class="btn ghost" data-action="export">Exportar CSV</button>
            ${moduleFlowButtons(moduleId, def.key)}
          </div>
          <div class="detail-box">
            <h3>${first ? "Ultimo registro" : "Sin registros"}</h3>
            ${first ? detailList(first, def.columns) : `<p class="muted">Carga un registro para administrar esta seccion.</p>`}
          </div>
          <div class="detail-box">
            <h3>Proximo vencimiento</h3>
            ${next ? detailList(next, def.columns.slice(0, 4)) : `<p class="muted">No hay fechas pendientes.</p>`}
          </div>
        </div>
      </section>
    </div>
  `;
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
  return `<dl class="detail-list">${columns.map(([key, label]) => `<div><dt>${escapeHtml(label)}</dt><dd>${renderDetailValue(key, row[key])}</dd></div>`).join("")}</dl>`;
}

function renderDetailValue(key, value) {
  if (/monto|precio|comision|costo|presupuesto/i.test(key)) return money(value);
  if (/estado|prioridad|tipo/i.test(key)) return pill(value);
  return escapeHtml(value);
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

function calendarPage() {
  const items = filteredCalendar();
  const today = todayKey();
  const pending = (state.calendar || []).filter(x => /Pendiente|Programado/i.test(x.estado || "")).length;
  const confirmed = (state.calendar || []).filter(x => /Confirmado|Listo/i.test(x.estado || "")).length;
  const overdue = (state.calendar || []).filter(x => x.fecha < today && !/Hecho|Cancelado|Listo/i.test(x.estado || "")).length;
  return `
    <div class="grid stats calendar-stats">
      ${stat("Eventos cargados", state.calendar.length, "Agenda total")}
      ${stat("Hoy", calendarForDay(today).length, "Compromisos del dia")}
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
  const rows = filtered(state.calendar || []);
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
      <button class="btn" data-add="sales">Nueva oportunidad</button>
      <button class="btn ghost" data-action="advance">Avanzar primera venta</button>
    </div>
    <div class="grid two-col module-grid">
      <section class="card">
        <div class="card-head"><h2>Pipeline comercial</h2><span class="pill info">${state.sales.length} operaciones</span></div>
        <div class="card-body">${kanban()}</div>
      </section>
      <section class="card module-panel">
        <div class="card-head"><h2>Gestion</h2><span class="pill info">Ventas</span></div>
        <div class="card-body">
          <div class="module-actions">
            <button class="btn" data-section-action="new:sales">Nuevo</button>
            <button class="btn ghost" data-section-action="complete:sales">Marcar hecho</button>
            <button class="btn ghost" data-section-action="duplicate:sales">Duplicar primero</button>
            <button class="btn ghost" data-action="export">Exportar CSV</button>
          </div>
          <div class="detail-box">
            <h3>Ultima operacion</h3>
            ${state.sales[0] ? detailList(state.sales[0], [["cliente", "Cliente"], ["vehiculo", "Vehiculo"], ["etapa", "Etapa"], ["monto", "Monto"], ["vendedor", "Vendedor"], ["proximo", "Proximo"]]) : `<p class="muted">Sin ventas cargadas.</p>`}
          </div>
        </div>
      </section>
    </div>
    <div style="margin-top:16px">${tablePage("sales", "Operaciones", genericColumns("ventas"), true, "ventas")}</div>
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
  const linkedKeys = ["sales", "paperwork", "calendar", "quotes", "files", "consignments"];
  const linkedHtml = linkedKeys.includes(key)
    ? `<fieldset class="form-section"><legend><span>+</span>VINCULOS</legend><div class="form-grid">${linkedClientVehicleFields(row)}</div></fieldset>`
    : "";
  return linkedHtml + groupedForm(key, fields, row);
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
    sales: "Operacion activa dentro del pipeline.",
    calendar: "Agenda de test drives, entregas, llamados y vencimientos.",
    paperwork: "Tramite administrativo vinculado a cliente y vehiculo.",
    finance: "Movimiento de caja, banco, ingreso o egreso.",
    messages: "Plantilla o mensaje operativo para enviar."
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
      <div class="form-grid">${section.fields.map(field => fieldControl(normalizeField(field, row, key))).join("")}</div>
    </fieldset>
  `).join("");
}

function linkedClientVehicleFields(row = {}) {
  const clientOptions = [`<option value="">— Sin vincular —</option>`]
    .concat((state.clients || []).map(c => `<option value="${escapeHtml(c.id)}" ${c.id === (row.clienteId || "") ? "selected" : ""} data-name="${escapeHtml(c.nombre)}" data-phone="${escapeHtml(c.telefono)}">${escapeHtml(c.nombre)} · ${escapeHtml(c.telefono)}</option>`))
    .join("");
  const vehicleOptions = [`<option value="">— Sin vincular —</option>`]
    .concat((state.vehicles || []).map(v => {
      const label = `${v.marca || ""} ${v.modelo || ""}${v.dominio ? ` (${v.dominio})` : ""}`.trim();
      return `<option value="${escapeHtml(v.id)}" ${v.id === (row.vehiculoId || "") ? "selected" : ""} data-nombre="${escapeHtml(`${v.marca || ""} ${v.modelo || ""}`.trim())}" data-dominio="${escapeHtml(v.dominio || "")}">${escapeHtml(label)}</option>`;
    }))
    .join("");
  return `<div class="field"><label>Cliente vinculado</label><select name="clienteId" data-client-link>${clientOptions}</select><small>Autocompleta nombre y telefono</small></div><div class="field"><label>Vehiculo vinculado</label><select name="vehiculoId" data-vehicle-link>${vehicleOptions}</select><small>Autocompleta nombre del vehiculo</small></div>`;
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
        ${fieldControl({ name: "marca", label: "Marca", required: true, placeholder: "Ej. BMW, Toyota, Audi", value: row.marca || "" })}
        ${fieldControl({ name: "modelo", label: "Modelo", placeholder: "Ej. X3, Hilux, Q5", value: row.modelo || "" })}
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
    return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><input name="${escapeHtml(field.name)}" list="${listId}" value="${escapeHtml(value)}"${placeholder}${required}><datalist id="${listId}">${(field.options || []).map(option => `<option value="${escapeHtml(option)}"></option>`).join("")}</datalist></div>`;
  }
  if (field.type === "textarea") {
    return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><textarea name="${escapeHtml(field.name)}"${placeholder}${required}>${escapeHtml(value)}</textarea></div>`;
  }
  return `<div class="field${wide}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label><input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${escapeHtml(value)}"${placeholder}${required}></div>`;
}

function labelForKey(key) {
  const dynamicDef = Object.values(sectionData).find(def => def.key === key);
  return dynamicDef?.item || ({ vehicles: "vehiculo", clients: "cliente", sales: "oportunidad", paperwork: "tramite", finance: "movimiento", messages: "mensaje", calendar: "evento" }[key] || "registro");
}

function pill(value) {
  const s = String(value);
  const cls = /Disponible|Listo|Confirmado|Ingreso|Enviado|Pagado|Hecho/.test(s) ? "ok" : /Pendiente|Reservado|Programado|Tasacion/.test(s) ? "warn" : /Caliente|Egreso|Preparacion|Cancelado/.test(s) ? "hot" : "info";
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
  document.querySelectorAll("[data-section-action]").forEach(btn => btn.addEventListener("click", () => handleSectionAction(btn.dataset.sectionAction)));
  document.querySelectorAll("[data-module-flow]").forEach(btn => btn.addEventListener("click", () => handleModuleFlow(btn.dataset.moduleFlow)));
  document.querySelector("[data-action='quick-add']")?.addEventListener("click", () => {
    const map = moduleKeyMap();
    const dynamicDef = sectionData[currentModule];
    openModal(map[currentModule] || dynamicDef?.key || "clients");
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
      const key = e.target.dataset.save;
      const id = e.target.dataset.id;
      const item = Object.fromEntries(new FormData(e.target).entries());
      Object.keys(item).forEach(k => {
        if (/^(anio|anioDesde|anioHasta|km|precio|margen|monto|precioPretendido|comision|costo|presupuesto|puntaje|dias)$/.test(k)) item[k] = Number(item[k]);
      });
      const prevEtapa = (id && key === "sales") ? (state[key].find(x => x.id === id)?.etapa) : null;
      if (id) {
        state[key] = state[key].map(x => x.id === id ? { ...x, ...item, id } : x);
      } else {
        state[key].unshift({ ...item, id: `${key}-${Date.now()}` });
      }
      if (key === "sales" && item.etapa === "Cierre" && prevEtapa !== "Cierre") {
        const savedId = id || state[key][0]?.id;
        const saved = state[key].find(x => x.id === savedId);
        if (saved) closeSaleEffects(saved);
      }
      addAudit(`${id ? "Actualizado" : "Creado"} ${labelForKey(key)}`);
      await saveState("Datos guardados");
      document.querySelector("[data-modal]")?.remove();
      render();
    });
  });
  document.querySelectorAll("[data-client-link]").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const option = select.selectedOptions[0];
      const form = select.closest("form");
      const name = option?.dataset.name || "";
      const phone = option?.dataset.phone || "";
      if (name && form?.elements.cliente) form.elements.cliente.value = name;
      if (phone && form?.elements.telefono) form.elements.telefono.value = phone;
    });
  });
  document.querySelectorAll("[data-vehicle-link]").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const option = select.selectedOptions[0];
      const form = select.closest("form");
      const nombre = option?.dataset.nombre || "";
      const dominio = option?.dataset.dominio || "";
      if (nombre && form?.elements.vehiculo) form.elements.vehiculo.value = nombre;
      if (dominio && form?.elements.dominio) form.elements.dominio.value = dominio;
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
    const parts2 = (source.vehiculo || "").split(" ");
    state.vehicles.unshift({ id: `vehicles-${nowId}`, dominio: source.dominio || "", marca: parts2[0] || "", modelo: parts2.slice(1).join(" ") || source.vehiculo || "", anio: source.anio || 0, km: source.km || 0, precio: source.precioPretendido || 0, moneda: "ARS", estado: "Disponible", ubicacion: "", origen: "Consignacion", margen: 0, notas: `Consignado de ${source.titular || ""}` });
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
  if (sale.vehiculoId) {
    const v = state.vehicles.find(x => x.id === sale.vehiculoId);
    if (v) v.estado = "Vendido";
  }
  const vLabel = sale.vehiculo || "";
  if (!state.finance.some(f => f.saleRef === sale.id)) {
    state.finance.unshift({
      id: `fin-${Date.now()}`,
      saleRef: sale.id,
      concepto: `Venta ${vLabel}`,
      tipo: "Ingreso",
      categoria: "Venta",
      cliente: sale.cliente || "",
      vehiculo: vLabel,
      monto: Number(sale.monto || 0),
      moneda: sale.moneda || "ARS",
      fecha: todayKey(),
      medio: "",
      estado: "Confirmado",
      notas: ""
    });
  }
  if (sale.clienteId) {
    const c = state.clients.find(x => x.id === sale.clienteId);
    if (c) c.estado = "Cerrado";
  }
  addAudit(`Cierre: ${sale.cliente || "cliente"} — ${vLabel}`);
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
