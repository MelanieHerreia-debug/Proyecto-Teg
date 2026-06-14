
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — reemplaza con tu URL de Google Apps Script desplegado
// ═══════════════════════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMVu7eXg88rUMbwReH7FpzGZeQfgJeFxreD0mLwKnPVsZG7dKgBHNXVoSIKimzHf3-/exec";

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY CONSTANTS — Production values
// ═══════════════════════════════════════════════════════════════════════════════
const IP_UNIVERSIDAD     = "149.50.194.73";
const LAT_UNIVERSIDAD    = -0.199764;
const LON_UNIVERSIDAD    = -78.504938;
const RANGO_TOLERANCIA_M = 500;

// ═══════════════════════════════════════════════════════════════════════════════
// PROFESSORS (estáticos — sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════
const PROFESSORS = [
  { id: "prof001", username: "melanie.docente", password: "profe2026", name: "Dra. Melanie Ortiz",  dept: "Ingeniería de Sistemas" },
  { id: "prof002", username: "e.vasquez",        password: "profe2026", name: "Dr. Elena Vásquez",  dept: "Ingeniería de Sistemas" },
  { id: "prof003", username: "m.herrera",        password: "profe2026", name: "Dr. Marco Herrera",  dept: "Ciencias Exactas"       },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS API SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
const sheetsAPI = {
  async get(action, params = {}) {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res  = await fetch(url.toString());
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error del servidor");
    return json.data;
  },
  async post(body) {
    const res  = await fetch(APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error del servidor");
    return json.data;
  },
  getCursos:              ()          => sheetsAPI.get("getCursos"),
  getAsistencias:         ()          => sheetsAPI.get("getAsistencias"),
  crearCurso:             (id, name)  => sheetsAPI.post({ action: "crearCurso",       id, name }),
  editarCurso:            (id, name)  => sheetsAPI.post({ action: "editarCurso",      id, name }),
  eliminarCurso:          (id)        => sheetsAPI.post({ action: "eliminarCurso",     id }),
  registrarAsistencia:    (data)      => sheetsAPI.post({ action: "registrarAsistencia", ...data }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// HAVERSINE
// ═══════════════════════════════════════════════════════════════════════════════
function haversineMetros(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const toR  = d => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a    = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL ROUTER
// ═══════════════════════════════════════════════════════════════════════════════
function parseQRParams() {
  const p = new URLSearchParams(window.location.search);
  return { courseId: p.get("materia") || p.get("course"), token: p.get("token") };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN CÉDULA ECUATORIANA (10 dígitos, algoritmo módulo 10)
// ═══════════════════════════════════════════════════════════════════════════════
function validarCedula(cedula) {
  if (!/^\d{10}$/.test(cedula)) return false;
  const prov = parseInt(cedula.substring(0, 2));
  if (prov < 1 || prov > 24) return false;
  const digits  = cedula.split("").map(Number);
  const coeffs  = [2,1,2,1,2,1,2,1,2];
  const suma    = coeffs.reduce((acc, c, i) => {
    let val = c * digits[i];
    if (val >= 10) val -= 9;
    return acc + val;
  }, 0);
  const check   = (10 - (suma % 10)) % 10;
  return check === digits[9];
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE SVG ICONS (sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════
const Icon = {
  Lock:       () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  User:       () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  QR:         () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 21h.01M21 14v.01M21 18v.01M21 21v.01"/></svg>,
  Wifi:       ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill={color||"currentColor"}/></svg>,
  MapPin:     ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Shield:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  ShieldOff:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18"/><path d="M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Check:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Chart:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  Bell:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Calendar:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Students:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Play:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  PlusCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  AlertTri:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Loader:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1s linear infinite"}}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>,
  X:          () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Refresh:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Logout:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  BookOpen:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  Edit:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Filter:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  ID:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPINNER
// ═══════════════════════════════════════════════════════════════════════════════
function Spinner({ size = 28, color = "#3b82f6" }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:size, height:size, border:`3px solid rgba(59,130,246,0.15)`, borderTopColor:color, borderRadius:"50%", animation:"spin 0.75s linear infinite" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR TIMER HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useQRTimer(active, interval = 30) {
  const [token,       setToken]       = useState(() => Math.random().toString(36).slice(2,10).toUpperCase());
  const [secondsLeft, setSecondsLeft] = useState(interval);
  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setToken(Math.random().toString(36).slice(2,10).toUpperCase()); return interval; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [active, interval]);
  return { token, secondsLeft };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY VERIFICATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useSecurityVerification() {
  const [status,  setStatus]  = useState("checking");
  const [details, setDetails] = useState({ ip:null, lat:null, lon:null, distMetros:null, ipMatch:false, gpsMatch:false });
  const [errMsg,  setErrMsg]  = useState("");

  const run = async () => {
    setStatus("checking"); setErrMsg("");
    let detectedIp=null, ipMatch=false, lat=null, lon=null, distMetros=null, gpsMatch=false;

    try {
      const res  = await fetch("https://api.ipify.org?format=json");
      const json = await res.json();
      detectedIp = json.ip; ipMatch = detectedIp === IP_UNIVERSIDAD;
    } catch { detectedIp="No disponible"; ipMatch=false; }

    const gpsResult = await new Promise(resolve => {
      if (!navigator.geolocation) { resolve({ ok:false, reason:"Tu dispositivo no soporta geolocalización." }); return; }
      navigator.geolocation.getCurrentPosition(
        pos  => resolve({ ok:true, lat:pos.coords.latitude, lon:pos.coords.longitude }),
        err  => {
          let reason="No se pudo obtener tu ubicación GPS.";
          if (err.code===1) reason="Permiso GPS denegado. Permite la ubicación en tu navegador.";
          if (err.code===2) reason="Ubicación no disponible (señal débil o avión).";
          if (err.code===3) reason="Tiempo de espera GPS agotado.";
          resolve({ ok:false, reason });
        },
        { enableHighAccuracy:true, timeout:12000, maximumAge:0 }
      );
    });

    if (gpsResult.ok) {
      lat=gpsResult.lat; lon=gpsResult.lon;
      distMetros=haversineMetros(lat,lon,LAT_UNIVERSIDAD,LON_UNIVERSIDAD);
      gpsMatch=distMetros<=RANGO_TOLERANCIA_M;
    }

    const finalDetails={ ip:detectedIp, lat, lon, distMetros, ipMatch, gpsMatch };
    setDetails(finalDetails);
    if (ipMatch||gpsMatch) { setStatus("granted"); }
    else {
      const parts=[];
      if (!ipMatch) parts.push(`IP detectada (${detectedIp}) ≠ red universitaria`);
      if (!gpsMatch) {
        if (!gpsResult.ok) parts.push(gpsResult.reason);
        else parts.push(`Distancia al campus: ${Math.round(distMetros)} m (máx. ${RANGO_TOLERANCIA_M} m)`);
      }
      setErrMsg(parts.join(" · ")); setStatus("denied");
    }
  };

  useEffect(() => { run(); }, []);
  return { status, details, errMsg, retry:run };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR GENERATOR (usando qrcode.js vía CDN)
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// QR GENERATOR (Corregido usando un DIV contenedor)
// ═══════════════════════════════════════════════════════════════════════════════
function QRCode({ value, size = 180 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !value) return;
    
    // 1. Limpiamos el contenedor para que no se acumulen QRs viejos
    containerRef.current.innerHTML = "";

    if (window.QRCode) {
      try {
        // 2. Le pasamos el DIV de referencia a la librería
        new window.QRCode(containerRef.current, {
          text:          value,
          width:          size,
          height:         size,
          colorDark:      "#e2e8f0", // Color claro para los módulos del QR
          colorLight:     "#060d1e", // Fondo oscuro que hace match con tu app
          correctLevel:   window.QRCode.CorrectLevel.M,
        });
      } catch (err) {
        console.error("Error al renderizar qrcode.js:", err);
      }
    } else {
      // Fallback en texto por si la librería tarda en responder desde el CDN
      containerRef.current.innerHTML = `<div style="color: #e2e8f0; font-family: monospace; font-size: 12px; text-align: center; line-height: ${size}px;">Cargando QR...</div>`;
    }
  }, [value, size]);

  // CAMBIO CLAVE: Usamos un <div> en lugar de un <canvas>
  return (
    <div 
      ref={containerRef} 
      style={{ 
        ...s.qrImage, 
        width: size, 
        height: size, 
        background: "#060d1e", 
        padding: "8px", 
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }} 
    />
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: GESTIÓN DE CURSOS (Crear / Editar)
// ═══════════════════════════════════════════════════════════════════════════════
function CourseModal({ curso, onSave, onClose }) {
  const isEdit    = !!curso;
  const [id,   setId]   = useState(curso?.id   || "");
  const [name, setName] = useState(curso?.name || "");
  const [saving,  setSaving]  = useState(false);
  const [apiError, setApiError] = useState("");

  const handleSave = async () => {
    setApiError("");
    if (!id.trim() || !name.trim()) { setApiError("Completa todos los campos."); return; }
    if (!/^[A-Za-z0-9]{2,12}$/.test(id.trim())) { setApiError("ID: 2–12 caracteres alfanuméricos (ej. CS301)."); return; }
    setSaving(true);
    try {
      if (isEdit) await sheetsAPI.editarCurso(id.trim(), name.trim());
      else        await sheetsAPI.crearCurso(id.trim().toUpperCase(), name.trim());
      onSave();
    } catch (e) {
      setApiError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.modalOverlay}>
      <div style={{ ...s.modalCard, borderColor:"rgba(59,130,246,0.25)" }}>
        <div style={{ ...s.modalHeader, borderColor:"rgba(59,130,246,0.15)", background:"rgba(59,130,246,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ color:"#3b82f6" }}><Icon.BookOpen /></div>
            <div>
              <div style={s.modalTitle}>{isEdit ? "Editar Curso" : "Nuevo Curso"}</div>
              <div style={{ ...s.modalSub, color:"#475569" }}>{isEdit ? `Editando: ${curso.id}` : "Agrega un curso a tu lista"}</div>
            </div>
          </div>
          <button style={s.modalClose} onClick={onClose}><Icon.X /></button>
        </div>

        <div style={{ padding:"24px" }}>
          {apiError && (
            <div style={s.errorBanner}><span style={{ marginRight:8 }}><Icon.AlertTri /></span>{apiError}</div>
          )}

          <div style={s.fieldGroup}>
            <label style={s.label}>ID del Curso</label>
            <div style={s.inputWrapper}>
              <span style={s.inputIcon}><Icon.ID /></span>
              <input style={{ ...s.input, textTransform:"uppercase" }}
                placeholder="Ej. CS301"
                value={id} onChange={e => setId(e.target.value)}
                disabled={isEdit}
                maxLength={12}
              />
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Nombre del Curso</label>
            <div style={s.inputWrapper}>
              <span style={s.inputIcon}><Icon.BookOpen /></span>
              <input style={s.input}
                placeholder="Ej. Estructuras de Datos"
                value={name} onChange={e => setName(e.target.value)}
                maxLength={60}
              />
            </div>
          </div>

          <button style={{ ...s.primaryBtn, width:"100%", justifyContent:"center", marginTop:8 }}
            onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size={18} color="#fff" /> : <Icon.Check />}
            <span style={{ marginLeft:8 }}>{saving ? "Guardando..." : (isEdit ? "Guardar Cambios" : "Crear Curso")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: ASISTENCIA MANUAL (sin cambios funcionales, actualizado a Google Sheets)
// ═══════════════════════════════════════════════════════════════════════════════
function ManualModal({ courses, onSave, onClose }) {
  const [courseId,    setCourseId]    = useState(courses[0]?.id || "");
  const [studentName, setStudentName] = useState("");
  const [cedula,      setCedula]      = useState("");
  const [saving,      setSaving]      = useState(false);
  const [done,        setDone]        = useState(false);
  const [apiError,    setApiError]    = useState("");

  const handleSave = async () => {
    setApiError("");
    if (!studentName.trim()) { setApiError("Ingresa el nombre del estudiante."); return; }
    if (!validarCedula(cedula)) { setApiError("Cédula inválida. Verifica el número (10 dígitos)."); return; }
    const curso = courses.find(c => c.id === courseId);
    setSaving(true);
    try {
      await sheetsAPI.registrarAsistencia({
        cursoId:     courseId,
        cursoNombre: curso?.name || courseId,
        nombre:      studentName.trim(),
        cedula:      cedula.trim(),
        metodo:      "manual",
      });
      onSave({ cursoId:courseId, cursoNombre:curso?.name||courseId, nombre:studentName.trim(), cedula:cedula.trim(), metodo:"manual" });
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setApiError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.modalOverlay}>
      <div style={s.modalCard}>
        <div style={s.modalHeader}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ color:"#f59e0b" }}><Icon.AlertTri /></div>
            <div>
              <div style={s.modalTitle}>Asistencia Manual — Emergencia</div>
              <div style={s.modalSub}>Úsalo solo si el sistema del alumno falla</div>
            </div>
          </div>
          <button style={s.modalClose} onClick={onClose}><Icon.X /></button>
        </div>

        {done ? (
          <div style={{ padding:"32px 24px", textAlign:"center" }}>
            <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
            <div style={{ color:"#22c55e", fontWeight:700, fontSize:18 }}>Registro guardado en Google Sheets</div>
          </div>
        ) : (
          <div style={{ padding:"24px" }}>
            {apiError && <div style={s.errorBanner}><span style={{ marginRight:8 }}><Icon.AlertTri /></span>{apiError}</div>}

            <div style={s.fieldGroup}>
              <label style={s.label}>Asignatura</label>
              <div style={s.selectWrapper}>
                <select style={s.select} value={courseId} onChange={e => setCourseId(e.target.value)}>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Nombre Completo</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.User /></span>
                <input style={s.input} placeholder="Nombre y apellidos" value={studentName} onChange={e => setStudentName(e.target.value)} />
              </div>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Cédula</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.ID /></span>
                <input style={s.input} placeholder="10 dígitos" value={cedula} onChange={e => setCedula(e.target.value.replace(/\D/g,""))} maxLength={10} />
              </div>
            </div>

            <button style={{ ...s.primaryBtn, width:"100%", justifyContent:"center", background:"linear-gradient(135deg,#d97706,#f59e0b)" }}
              onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size={18} color="#fff" /> : <Icon.Check />}
              <span style={{ marginLeft:8 }}>{saving ? "Guardando..." : "Registrar Asistencia"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — LOGIN (sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = () => {
    setError(""); setLoading(true);
    setTimeout(() => {
      const prof = PROFESSORS.find(p => p.username===username && p.password===password);
      if (prof) { onLogin(prof); }
      else      { setError("Credenciales incorrectas. Verifica tu usuario y contraseña."); }
      setLoading(false);
    }, 600);
  };

  return (
    <div style={s.loginBg}>
      <div style={s.gridOverlay} />
      <div style={s.glowOrb} />
      <div style={s.loginCard}>
        <div style={s.loginLogo}>
          <div style={s.logoMark}><Icon.QR /></div>
          <div>
            <div style={s.logoTitle}>AttendAI</div>
            <div style={s.logoSub}>Sistema de Asistencia por QR</div>
          </div>
        </div>
        <div style={s.loginDivider} />
        <div style={s.loginHeading}>Acceso Docente</div>
        <div style={s.loginSubheading}>Ingresa tus credenciales institucionales</div>

        {error && (
          <div style={{ ...s.errorBanner, marginBottom:16 }}>
            <span style={{ marginRight:8 }}><Icon.AlertTri /></span>{error}
          </div>
        )}

        <div style={s.fieldGroup}>
          <label style={s.label}>Usuario</label>
          <div style={s.inputWrapper}>
            <span style={s.inputIcon}><Icon.User /></span>
            <input style={s.input} placeholder="nombre.apellido" value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleLogin()} />
          </div>
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Contraseña</label>
          <div style={s.inputWrapper}>
            <span style={s.inputIcon}><Icon.Lock /></span>
            <input style={s.input} type={showPw?"text":"password"} placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleLogin()} />
            <button style={s.eyeBtn} onClick={() => setShowPw(p => !p)}>{showPw?"🙈":"👁"}</button>
          </div>
        </div>

        <button style={{ ...s.primaryBtn, width:"100%", justifyContent:"center" }}
          onClick={handleLogin} disabled={loading}>
          {loading ? <Spinner size={18} color="#fff" /> : <Icon.Shield />}
          <span style={{ marginLeft:8 }}>{loading?"Verificando...":"Iniciar Sesión"}</span>
        </button>

        <div style={s.loginHint}>
          <strong style={{ color:"#3b82f6" }}>Demo:</strong> melanie.docente / profe2026
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2A — GESTIÓN DE CURSOS (NUEVA)
// ═══════════════════════════════════════════════════════════════════════════════
function CoursesScreen({ professor, courses, loadingCourses, onRefresh, onSelectCourse, onBack, onLogout }) {
  const [showModal,    setShowModal]    = useState(false);
  const [editCourse,   setEditCourse]   = useState(null);
  const [deletingId,   setDeletingId]   = useState(null);
  const [confirmDelete,setConfirmDelete]= useState(null);
  const [apiError,     setApiError]     = useState("");

  const handleDelete = async (id) => {
    setDeletingId(id); setApiError("");
    try {
      await sheetsAPI.eliminarCurso(id);
      await onRefresh();
    } catch (e) {
      setApiError(e.message);
    } finally {
      setDeletingId(null); setConfirmDelete(null);
    }
  };

  return (
    <div style={s.dashBg}>
      <div style={s.gridOverlay} />

      {/* Header */}
      <header style={s.dashHeader}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button style={s.ghostBtn} onClick={onBack}>← Dashboard</button>
          <div style={s.logoMark}><Icon.BookOpen /></div>
          <div>
            <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:17 }}>Gestión de Cursos</div>
            <div style={{ color:"#475569", fontSize:12 }}>{professor.name}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...s.primaryBtn }} onClick={() => { setEditCourse(null); setShowModal(true); }}>
            <Icon.PlusCircle /><span style={{ marginLeft:6 }}>Nuevo Curso</span>
          </button>
          <button style={s.ghostBtn} onClick={onLogout}><Icon.Logout /></button>
        </div>
      </header>

      <main style={s.dashMain}>
        {apiError && (
          <div style={{ ...s.errorBanner, marginBottom:16 }}>
            <span style={{ marginRight:8 }}><Icon.AlertTri /></span>{apiError}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, letterSpacing:"-0.5px" }}>
            Mis Cursos <span style={{ color:"#475569", fontSize:16, fontWeight:400 }}>({courses.length})</span>
          </div>
          <button style={s.ghostBtn} onClick={onRefresh}>
            <Icon.Refresh /><span style={{ marginLeft:6 }}>Actualizar</span>
          </button>
        </div>

        {loadingCourses ? (
          <div style={{ display:"flex", justifyContent:"center", padding:"60px 0" }}>
            <Spinner size={36} />
          </div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#475569" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📚</div>
            <div style={{ fontSize:18, fontWeight:600, color:"#94a3b8", marginBottom:8 }}>Sin cursos registrados</div>
            <div style={{ fontSize:14 }}>Crea tu primer curso con el botón "Nuevo Curso"</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
            {courses.map(curso => (
              <div key={curso.id} style={s.courseCard}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={s.courseIcon}><Icon.BookOpen /></div>
                    <div>
                      <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:15 }}>{curso.name}</div>
                      <div style={{ color:"#475569", fontSize:12, fontFamily:"monospace" }}>{curso.id}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={s.iconBtn} title="Editar" onClick={() => { setEditCourse(curso); setShowModal(true); }}>
                      <Icon.Edit />
                    </button>
                    <button style={{ ...s.iconBtn, color:"#ef4444", borderColor:"rgba(239,68,68,0.2)" }}
                      title="Eliminar" onClick={() => setConfirmDelete(curso)}>
                      <Icon.Trash />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize:11, color:"#334155", marginBottom:14 }}>
                  Creado: {curso.createdAt ? new Date(curso.createdAt).toLocaleDateString("es-EC") : "—"}
                </div>
                <button style={{ ...s.primaryBtn, width:"100%", justifyContent:"center", fontSize:13 }}
                  onClick={() => onSelectCourse(curso)}>
                  <Icon.Play /><span style={{ marginLeft:6 }}>Tomar Asistencia</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal crear/editar */}
      {showModal && (
        <CourseModal
          curso={editCourse}
          onSave={async () => { setShowModal(false); await onRefresh(); }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modalCard, maxWidth:380, borderColor:"rgba(239,68,68,0.2)" }}>
            <div style={{ padding:"28px 24px", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
              <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:17, marginBottom:8 }}>¿Eliminar curso?</div>
              <div style={{ color:"#64748b", fontSize:14, marginBottom:24 }}>
                Se eliminará <strong style={{ color:"#e2e8f0" }}>{confirmDelete.name}</strong>. Las asistencias registradas se mantendrán en Google Sheets.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...s.ghostBtn, flex:1, justifyContent:"center" }} onClick={() => setConfirmDelete(null)}>
                  Cancelar
                </button>
                <button style={{ ...s.primaryBtn, flex:1, justifyContent:"center", background:"linear-gradient(135deg,#dc2626,#ef4444)" }}
                  onClick={() => handleDelete(confirmDelete.id)}
                  disabled={deletingId===confirmDelete.id}>
                  {deletingId===confirmDelete.id ? <Spinner size={16} color="#fff" /> : <Icon.Trash />}
                  <span style={{ marginLeft:6 }}>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2B — DASHBOARD (actualizado con datos reales + filtros)
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardScreen({ professor, courses, selectedCourse, onLogout, onManualSave, onGoToCourses }) {
  const [tab,          setTab]          = useState("qr");
  const [activeCourse, setActiveCourse] = useState(null);
  const [showManual,   setShowManual]   = useState(false);
  const [asistencias,  setAsistencias]  = useState([]);
  const [loadingData,  setLoadingData]  = useState(false);
  const [apiError,     setApiError]     = useState("");

    const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer); // Limpieza al desmontar
  }, []);


  // Filtros
  const [filterCurso,  setFilterCurso]  = useState("");
  const [filterFecha,  setFilterFecha]  = useState("");
  const [filterCedula, setFilterCedula] = useState("");
  const [filterNombre, setFilterNombre] = useState("");

  const { token, secondsLeft } = useQRTimer(tab === "qr" && !!activeCourse, 30);

  const loadAsistencias = useCallback(async () => {
    setLoadingData(true); setApiError("");
    try {
      const data = await sheetsAPI.getAsistencias();
      setAsistencias(Array.isArray(data) ? data : []);
    } catch (e) {
      setApiError("Error al cargar asistencias: " + e.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { if (tab === "report") loadAsistencias(); }, [tab]);
  useEffect(() => {
    if (selectedCourse) {
      setActiveCourse(selectedCourse);
      setTab("qr");
    }
  }, [selectedCourse]);
  useEffect(() => { if (courses.length > 0 && !activeCourse) setActiveCourse(courses[0]); }, [courses]);

  const qrURL = activeCourse
    ? `${window.location.origin}${window.location.pathname}?materia=${activeCourse.id}&token=${token}`
    : null;

  // Asistencias filtradas
  const asistenciasFiltradas = asistencias.filter(a =>
    (!filterCurso  || a.cursoId===filterCurso) &&
    (!filterFecha  || a.fecha===filterFecha) &&
    (!filterCedula || a.cedula.includes(filterCedula.trim())) &&
    (!filterNombre || a.nombre.toLowerCase().includes(filterNombre.toLowerCase().trim()))
  );

  // Stats
  const totalEstudiantes = [...new Set(asistencias.map(a => a.cedula))].length;
  const totalAsistencias = asistencias.length;
  const cursosActivos    = [...new Set(asistencias.map(a => a.cursoId))].length;

  return (
    <div style={s.dashBg}>
      <div style={s.gridOverlay} />

      {/* Header */}
      <header style={s.dashHeader}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={s.logoMark}><Icon.QR /></div>
          <div>
            <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:17 }}>AttendAI</div>
            <div style={{ color:"#475569", fontSize:12 }}>{professor.name} · {professor.dept}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <button style={s.ghostBtn} onClick={onGoToCourses}><Icon.BookOpen /><span style={{ marginLeft:6 }}>Cursos</span></button>
          <button style={s.ghostBtn} onClick={() => setShowManual(true)}><Icon.AlertTri /><span style={{ marginLeft:6 }}>Manual</span></button>
          <button style={{ ...s.primaryBtn }} onClick={() => setTab(t => t==="qr"?"report":"qr")}>
            {tab==="qr" ? <><Icon.Chart /><span style={{ marginLeft:6 }}>Reporte</span></> : <><Icon.QR /><span style={{ marginLeft:6 }}>QR</span></>}
          </button>
          <button style={s.ghostBtn} onClick={onLogout}><Icon.Logout /></button>
        </div>
      </header>

      <main style={s.dashMain}>
        {/* ── QR TAB ── */}
        {tab === "qr" && (
          <div style={s.qrPanel}>
            {/* Selector de curso */}
            <div style={{ marginBottom:18 }}>
              <label style={s.label}>Curso activo</label>
              <div style={s.selectWrapper}>
                <select style={s.select} value={activeCourse?.id || ""} onChange={e => {
                  const c = courses.find(x => x.id===e.target.value);
                  setActiveCourse(c);
                }}>
                  {courses.length === 0 && <option value="">Sin cursos — crea uno primero</option>}
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                </select>
              </div>
            </div>

            {activeCourse ? (
              <>
                {/* QR */}
                <div style={s.qrWrapper}>
                  <div style={{ position:"relative", display:"inline-block" }}>
                    <QRCode value={qrURL || ""} size={180} />
                  </div>
                </div>

                {/* Timer */}
                <div style={s.timerRow}>
                  <Icon.Clock />
                  <span>QR rota en <strong style={{ color:"#f1f5f9" }}>{secondsLeft}s</strong></span>
                  <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:"#3b82f6", borderRadius:3, width:`${(secondsLeft/30)*100}%`, transition:"width 1s linear" }} />
                  </div>
                </div>

                {/* URL hint */}
                <div style={s.qrHint}>
                  <Icon.Wifi color="#3b82f6" />
                  <span style={{ marginLeft:8, fontSize:11, color:"#475569", wordBreak:"break-all" }}>
                    {qrURL}
                  </span>
                </div>

              </>
            ) : (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#475569" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📚</div>
                <div style={{ color:"#94a3b8", fontSize:15, fontWeight:600 }}>No tienes cursos registrados</div>
                <button style={{ ...s.primaryBtn, marginTop:16 }} onClick={onGoToCourses}>
                  <Icon.PlusCircle /><span style={{ marginLeft:6 }}>Crear Curso</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── REPORT TAB ── */}
        {tab === "report" && (
          <div style={s.reportPanel}>
            <div style={s.reportHeader}>
              <div style={s.reportTitle}>Reporte de Asistencias</div>
              <button style={s.ghostBtn} onClick={loadAsistencias}>
                <Icon.Refresh /><span style={{ marginLeft:6 }}>Actualizar</span>
              </button>
            </div>

            {/* Stats cards */}
            <div style={s.summaryCards}>
              {[
                { label:"Estudiantes únicos", value:totalEstudiantes, color:"#3b82f6" },
                { label:"Total asistencias",  value:totalAsistencias, color:"#22c55e" },
                { label:"Cursos con datos",   value:cursosActivos,    color:"#f59e0b" },
                { label:"Registros hoy",      value:asistencias.filter(a=>a.fecha===new Date().toISOString().slice(0,10)).length, color:"#8b5cf6" },
              ].map((c, i) => (
                <div key={i} style={{ ...s.summaryCard, borderColor:`${c.color}33` }}>
                  <div style={{ fontSize:28, fontWeight:800, color:c.color }}>{c.value}</div>
                  <div style={{ fontSize:11, color:"#475569", textAlign:"center" }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:10, marginBottom:16, padding:"14px 16px", background:"rgba(8,14,30,0.6)", borderRadius:12, border:"1px solid rgba(51,65,85,0.3)" }}>
              <div>
                <label style={s.label}><Icon.Filter /> Curso</label>
                <div style={s.selectWrapper}>
                  <select style={s.select} value={filterCurso} onChange={e => setFilterCurso(e.target.value)}>
                    <option value="">Todos</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={s.label}>Fecha</label>
                <input type="date" style={s.input} value={filterFecha} onChange={e => setFilterFecha(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Cédula</label>
                <input style={s.input} placeholder="Buscar cédula…" value={filterCedula} onChange={e => setFilterCedula(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Nombre</label>
                <input style={s.input} placeholder="Buscar nombre…" value={filterNombre} onChange={e => setFilterNombre(e.target.value)} />
              </div>
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <button style={{ ...s.ghostBtn, width:"100%", justifyContent:"center" }} onClick={() => { setFilterCurso(""); setFilterFecha(""); setFilterCedula(""); setFilterNombre(""); }}>
                  <Icon.X /><span style={{ marginLeft:4 }}>Limpiar</span>
                </button>
              </div>
            </div>

            {apiError && <div style={{ ...s.errorBanner, marginBottom:12 }}>{apiError}</div>}

            {loadingData ? (
              <div style={{ display:"flex", justifyContent:"center", padding:"40px" }}><Spinner size={32} /></div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead style={s.tableHead}>
                    <tr>
                      {["Fecha","Hora","Curso","Nombre","Cédula","Estado","Método"].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {asistenciasFiltradas.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...s.td, textAlign:"center", padding:"32px", color:"#334155" }}>
                        {asistencias.length===0 ? "Sin registros en Google Sheets" : "Sin resultados para los filtros aplicados"}
                      </td></tr>
                    ) : asistenciasFiltradas.map((a, i) => (
                      <tr key={i} style={s.tr}>
                        <td style={s.td}>{a.fecha}</td>
                        <td style={s.td}>{a.hora}</td>
                        <td style={s.td}>
                          <span style={{ ...s.idBadge }}>{a.cursoId}</span>
                          <span style={{ marginLeft:6, color:"#64748b", fontSize:12 }}>{a.cursoNombre}</span>
                        </td>
                        <td style={s.td}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ ...s.studentAvatar, width:28, height:28, fontSize:12, background:`hsl(${(String(a.cedula || "0")).charCodeAt(0)*37%360},45%,30%)` }}>
                              {(a.nombre||"?")[0].toUpperCase()}
                            </div>
                            <span style={{ color:"#e2e8f0" }}>{a.nombre}</span>
                          </div>
                        </td>
                        <td style={s.td}><span style={{ fontFamily:"monospace", fontSize:13 }}>{a.cedula}</span></td>
                        <td style={s.td}>
                          <span style={{ ...s.statusPill, background:"rgba(34,197,94,0.1)", color:"#22c55e", border:"1px solid #22c55e33" }}>
                            ● {a.estado||"Presente"}
                          </span>
                        </td>
                        <td style={s.td}>
                          <span style={{ fontSize:11, color:"#475569", textTransform:"uppercase", letterSpacing:"0.05em" }}>{a.metodo||"qr"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {asistenciasFiltradas.length > 0 && (
              <div style={s.tableLegend}>{asistenciasFiltradas.length} registro(s) mostrado(s) de {asistencias.length} total</div>
            )}
          </div>
        )}
      </main>

      {showManual && (
        <ManualModal
          courses={courses}
          onSave={record => { onManualSave(record); loadAsistencias(); }}
          onClose={() => setShowManual(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — STUDENT MOBILE VIEW (actualizado: nombre + cédula + Google Sheets)
// ═══════════════════════════════════════════════════════════════════════════════
function StudentScreen({ course, token: qrToken, onBack }) {
  const { status, details, errMsg, retry } = useSecurityVerification();
  const [nombre,      setNombre]      = useState("");
  const [cedula,      setCedula]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [formError,   setFormError]   = useState("");
  const now = new Date();

  const fmtDist = m => m===null ? "—" : m<1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`;

  const handleMark = async () => {
    setFormError("");
    if (!nombre.trim()) { setFormError("Ingresa tu nombre completo."); return; }
    if (!cedula || cedula.length < 10) { setFormError("Ingresa tu número de cédula (10 dígitos)."); return; }
    if (!validarCedula(cedula)) { setFormError("Cédula inválida. Verifica el número ingresado."); return; }

    setSubmitting(true);
    try {
      await sheetsAPI.registrarAsistencia({
        cursoId:     course?.id    || "DEMO",
        cursoNombre: course?.name  || "Demo",
        nombre:      nombre.trim(),
        cedula:      cedula.trim(),
        metodo:      "qr",
      });
      setSuccessData({ nombre:nombre.trim(), cedula:cedula.trim() });
      setSuccess(true);
    } catch (e) {
      if (e.message.includes("DUPLICADO")) {
        setFormError("⚠️ Ya registraste tu asistencia en este curso hoy.");
      } else {
        setFormError("Error al guardar: " + e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={s.mobileBg}>
      {/* Status bar */}
      <div style={s.mobileStatusBar}>
        <span>{now.toLocaleTimeString("es-EC",{ hour:"2-digit", minute:"2-digit", hour12: true })}</span>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <Icon.Wifi  color={status==="granted"?"#22c55e":"#334155"} />
          <Icon.MapPin color={status==="granted"?"#22c55e":"#334155"} />
        </div>
      </div>

      <div style={s.mobileCard}>
        {/* Header */}
        <div style={s.mobileHeader}>
          {onBack && <button style={s.backBtn} onClick={onBack}>← Volver</button>}
          <div style={s.mobileLogo}>
            <div style={s.logoMarkSm}><Icon.QR /></div>
            <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:16 }}>AttendAI</span>
          </div>
          {!onBack && <div style={{ width:60 }} />}
        </div>

        {/* Course info */}
        <div style={s.mobileCourseCard}>
          <div style={s.mobileCourseIcon}><Icon.Calendar /></div>
          <div>
            <div style={s.mobileCourseTitle}>{course?.name || "Registro de Asistencia"}</div>
            <div style={s.mobileCourseCode}>
              {course?.id || "—"} · {now.toLocaleDateString("es-EC",{ day:"2-digit", month:"2-digit", year:"numeric" })}
            </div>
          </div>
        </div>

        {/* CHECKING */}
        {status==="checking" && (
          <div style={s.verifyingCard}>
            <Spinner size={40} />
            <div style={s.verifyingTitle}>Verificando entorno…</div>
            <div style={s.verifyingSteps}>
              <div style={s.verifyStep}><Icon.Wifi color="#3b82f6" /><span>Comprobando IP de red…</span></div>
              <div style={s.verifyStep}><Icon.MapPin color="#3b82f6" /><span>Obteniendo coordenadas GPS…</span></div>
            </div>
            <div style={s.verifyHint}>Puede solicitar permiso de ubicación. Acéptalo para continuar.</div>
          </div>
        )}

        {/* DENIED */}
        {status==="denied" && (
          <div style={s.blockedBanner}>
            <div style={{ color:"#ef4444", display:"flex", justifyContent:"center", marginBottom:12 }}><Icon.ShieldOff /></div>
            <div style={s.blockedTitle}>Acceso Denegado</div>
            <div style={s.blockedText}>Debes conectarte al Wi-Fi de la universidad <strong>o</strong> encontrarte físicamente dentro del campus (≤ 500 m).</div>
            {errMsg && <div style={s.blockedDetail}>{errMsg}</div>}
            <div style={s.diagGrid}>
              <div style={{ ...s.diagItem, borderColor:details.ipMatch?"#22c55e33":"#ef444433" }}>
                <Icon.Wifi color={details.ipMatch?"#22c55e":"#ef4444"} />
                <span style={{ color:"#94a3b8", fontSize:11 }}>IP</span>
                <span style={{ color:details.ipMatch?"#22c55e":"#ef4444", fontSize:12, fontWeight:600 }}>
                  {details.ipMatch?"✓ Verificada":"✗ Diferente"}
                </span>
                {details.ip && <span style={{ fontSize:10, fontFamily:"monospace", color:"#475569" }}>{details.ip}</span>}
              </div>
              <div style={{ ...s.diagItem, borderColor:details.gpsMatch?"#22c55e33":"#ef444433" }}>
                <Icon.MapPin color={details.gpsMatch?"#22c55e":"#ef4444"} />
                <span style={{ color:"#94a3b8", fontSize:11 }}>GPS</span>
                <span style={{ color:details.gpsMatch?"#22c55e":"#ef4444", fontSize:12, fontWeight:600 }}>
                  {details.gpsMatch?"✓ En campus":"✗ Fuera"}
                </span>
                <span style={{ fontSize:10, color:"#475569" }}>{fmtDist(details.distMetros)}</span>
              </div>
            </div>
            <button style={{ ...s.ghostBtn, width:"100%", marginTop:16, justifyContent:"center" }} onClick={retry}>
              <Icon.Refresh /><span style={{ marginLeft:8 }}>Reintentar verificación</span>
            </button>
          </div>
        )}

        {/* GRANTED — formulario */}
        {status==="granted" && !success && (
          <div style={s.formArea}>
            <div style={s.grantedBanner}>
              <Icon.Shield />
              <div style={{ marginLeft:10 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>Acceso Autorizado — Entorno Verificado</div>
                <div style={{ fontSize:11, opacity:0.8, marginTop:2 }}>
                  {details.ipMatch && details.gpsMatch && "✓ Wi-Fi universitaria · ✓ Dentro del campus"}
                  {details.ipMatch && !details.gpsMatch && "✓ Red Wi-Fi institucional verificada"}
                  {!details.ipMatch && details.gpsMatch && `✓ GPS: ${fmtDist(details.distMetros)} del campus`}
                </div>
              </div>
            </div>

            <div style={s.diagGridSm}>
              <div style={{ ...s.diagItemSm, borderColor:details.ipMatch?"#22c55e44":"#33415566" }}>
                <Icon.Wifi color={details.ipMatch?"#22c55e":"#475569"} />
                <span style={{ fontSize:11, color:details.ipMatch?"#22c55e":"#475569" }}>
                  {details.ipMatch ? "IP verificada" : `IP: ${details.ip||"—"}`}
                </span>
              </div>
              <div style={{ ...s.diagItemSm, borderColor:details.gpsMatch?"#22c55e44":"#33415566" }}>
                <Icon.MapPin color={details.gpsMatch?"#22c55e":"#475569"} />
                <span style={{ fontSize:11, color:details.gpsMatch?"#22c55e":"#475569" }}>
                  {details.gpsMatch ? `${fmtDist(details.distMetros)} del campus` : details.distMetros!==null ? `${fmtDist(details.distMetros)} (fuera)` : "GPS no disponible"}
                </span>
              </div>
            </div>

            {formError && (
              <div style={s.errorBanner}><span style={{ marginRight:8, flexShrink:0 }}><Icon.AlertTri /></span>{formError}</div>
            )}

            {/* Nombre completo */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Nombre Completo</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.User /></span>
                <input style={s.input} placeholder="Ej. Juan Pérez Gómez"
                  value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
            </div>

            {/* Cédula */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Número de Cédula</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.ID /></span>
                <input style={s.input} placeholder="10 dígitos" inputMode="numeric"
                  value={cedula} onChange={e => setCedula(e.target.value.replace(/\D/g,""))}
                  maxLength={10} />
              </div>
              {cedula.length===10 && (
                <div style={{ fontSize:11, marginTop:4, color:validarCedula(cedula)?"#22c55e":"#ef4444" }}>
                  {validarCedula(cedula) ? "✓ Cédula válida" : "✗ Cédula inválida"}
                </div>
              )}
            </div>

            <button style={{ ...s.primaryBtn, width:"100%", justifyContent:"center", marginTop:8 }}
              onClick={handleMark} disabled={submitting}>
              {submitting ? <Spinner size={18} color="#fff" /> : <Icon.Check />}
              <span style={{ marginLeft:8 }}>{submitting ? "Registrando…" : "Confirmar Asistencia"}</span>
            </button>

            <div style={s.securityFootnote}><Icon.Shield /><span style={{ marginLeft:4 }}>Datos guardados con seguridad en Google Sheets</span></div>
          </div>
        )}

        {/* SUCCESS */}
        {success && successData && (
          <div style={s.successCard}>
            <div style={s.successCheck}><Icon.Check /></div>
            <div style={s.successTitle}>¡Asistencia Registrada!</div>
            <div style={s.successText}>Tu asistencia ha sido guardada correctamente en Google Sheets.</div>
            <div style={s.successMeta}>
              <div>
                <div style={{ fontSize:10, color:"#475569", marginBottom:4, textTransform:"uppercase" }}>Estudiante</div>
                <div style={{ color:"#e2e8f0", fontWeight:600, fontSize:13 }}>{successData.nombre}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#475569", marginBottom:4, textTransform:"uppercase" }}>Cédula</div>
                <div style={{ color:"#e2e8f0", fontWeight:600, fontSize:13, fontFamily:"monospace" }}>{successData.cedula}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#475569", marginBottom:4, textTransform:"uppercase" }}>Hora</div>
                <div style={{ color:"#e2e8f0", fontWeight:600, fontSize:13 }}>{now.toLocaleTimeString("es-EC",{ hour:"2-digit", minute:"2-digit" })}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen,        setScreen]        = useState("boot");
  const [professor,     setProfessor]     = useState(null);
  const [studentCourse, setStudentCourse] = useState(null);
  const [selectedCourse,setSelectedCourse]= useState(null);
  const [courses,       setCourses]       = useState([]);
  const [loadingCourses,setLoadingCourses]= useState(false);

  // Leer URL params al montar
  useEffect(() => {
    const { courseId, token } = parseQRParams();
    if (courseId) {
      setStudentCourse({ id:courseId, name:courseId });
      setScreen("student");
      // Intentar cargar el nombre real del curso
      sheetsAPI.getCursos().then(cursos => {
        const c = cursos.find(x => x.id===courseId);
        if (c) setStudentCourse(c);
      }).catch(() => {});
    } else {
      // Cargar script QR externo
      const script = document.createElement("script");
      script.src   = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      document.head.appendChild(script);
      setScreen("login");
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const data = await sheetsAPI.getCursos();
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Error cargando cursos:", e.message);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const handleLogin = async (prof) => {
    setProfessor(prof);
    await loadCourses();
    setScreen("courses");
  };

  const handleLogout = () => { setProfessor(null); setCourses([]); setSelectedCourse(null); setScreen("login"); };

  const handleTakeAttendance = (course) => {
    setSelectedCourse(course);
    setScreen("dashboard");
  };

  if (screen==="boot") return (
    <div style={{ minHeight:"100vh", background:"#040812", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner size={36} />
    </div>
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #040812; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes glow    { 0%,100%{box-shadow:0 0 24px rgba(59,130,246,0.2)} 50%{box-shadow:0 0 44px rgba(59,130,246,0.5)} }
        @keyframes shake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        ::selection { background:rgba(59,130,246,0.25); }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1e293b; border-radius:3px; }
        input:focus, select:focus { outline:none; border-color:rgba(59,130,246,0.6) !important; box-shadow:0 0 0 3px rgba(59,130,246,0.12); }
        select option { background:#0f172a; color:#e2e8f0; }
        button:active { transform:scale(0.97); }
      `}</style>

      {screen==="login"     && <LoginScreen onLogin={handleLogin} />}
      {screen==="dashboard" && professor && (
        <DashboardScreen
          professor={professor}
          courses={courses}
          selectedCourse={selectedCourse}
          onLogout={handleLogout}
          onManualSave={() => {}}
          onGoToCourses={() => setScreen("courses")}
        />
      )}
      {screen==="courses" && professor && (
        <CoursesScreen
          professor={professor}
          courses={courses}
          loadingCourses={loadingCourses}
          onRefresh={loadCourses}
          onSelectCourse={handleTakeAttendance}
          onBack={() => setScreen("dashboard")}
          onLogout={handleLogout}
        />
      )}
      {screen==="student" && (
        <StudentScreen
          course={studentCourse}
          token={null}
          onBack={professor ? () => setScreen("dashboard") : null}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES — diseño original preservado + estilos nuevos para cursos
// ═══════════════════════════════════════════════════════════════════════════════
const s = {
  // Backgrounds
  loginBg:  { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"radial-gradient(ellipse 80% 55% at 50% 0%, #0c1d3a 0%, #040812 65%)", position:"relative", overflow:"hidden", padding:"24px 16px" },
  dashBg:   { minHeight:"100vh", background:"linear-gradient(160deg,#040812 0%,#060d1e 50%,#040812 100%)", position:"relative" },
  mobileBg: { minHeight:"100vh", background:"linear-gradient(180deg,#040c1e 0%,#040812 100%)", display:"flex", flexDirection:"column", alignItems:"center", padding:"0 16px 48px", position:"relative" },

  // Decorative
  gridOverlay: { position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(59,130,246,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.025) 1px,transparent 1px)", backgroundSize:"56px 56px" },
  glowOrb:     { position:"absolute", top:"-15%", left:"50%", transform:"translateX(-50%)", width:600, height:380, background:"radial-gradient(ellipse,rgba(59,130,246,0.1) 0%,transparent 70%)", pointerEvents:"none" },

  // Login
  loginCard:       { position:"relative", zIndex:1, background:"rgba(8,14,32,0.92)", border:"1px solid rgba(59,130,246,0.13)", borderRadius:22, padding:"40px 48px", width:"100%", maxWidth:440, backdropFilter:"blur(24px)", boxShadow:"0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(59,130,246,0.06) inset", animation:"fadeIn 0.45s ease" },
  loginLogo:       { display:"flex", alignItems:"center", gap:14, marginBottom:24 },
  loginDivider:    { height:1, background:"rgba(59,130,246,0.08)", margin:"0 0 28px" },
  loginHeading:    { fontSize:24, fontWeight:700, color:"#f1f5f9", letterSpacing:"-0.5px", marginBottom:6 },
  loginSubheading: { fontSize:14, color:"#475569", marginBottom:28 },
  loginHint:       { marginTop:20, padding:"10px 16px", background:"rgba(59,130,246,0.05)", borderRadius:8, border:"1px solid rgba(59,130,246,0.1)", fontSize:12, color:"#475569", textAlign:"center", lineHeight:1.7 },

  // Logo
  logoMark:   { width:46, height:46, borderRadius:13, background:"linear-gradient(140deg,#1d4ed8,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", boxShadow:"0 4px 20px rgba(59,130,246,0.4)" },
  logoMarkSm: { width:34, height:34, borderRadius:9,  background:"linear-gradient(140deg,#1d4ed8,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 },
  logoTitle:  { fontSize:20, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.5px" },
  logoSub:    { fontSize:11, color:"#475569", marginTop:1 },

  // Dashboard
  dashHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 28px", borderBottom:"1px solid rgba(59,130,246,0.07)", background:"rgba(4,8,18,0.7)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:100, flexWrap:"wrap", gap:10 },
  dashMain:   { maxWidth:900, margin:"0 auto", padding:"28px 24px" },

  // QR panel
  qrPanel:   { background:"rgba(6,12,26,0.85)", border:"1px solid rgba(59,130,246,0.1)", borderRadius:18, padding:"24px", animation:"fadeIn 0.4s ease" },
  qrWrapper: { display:"flex", justifyContent:"center", margin:"18px 0", padding:16, background:"#060d1e", borderRadius:14 },
  qrImage:   { display:"block", borderRadius:8, imageRendering:"crisp-edges" },
  timerRow:  { display:"flex", alignItems:"center", gap:14, color:"#64748b", fontSize:13, margin:"14px 0" },
  qrHint:    { display:"flex", alignItems:"center", background:"rgba(10,18,40,0.8)", border:"1px solid rgba(51,65,85,0.4)", borderRadius:8, padding:"9px 14px" },

  // Report
  reportPanel:  { animation:"fadeIn 0.4s ease" },
  reportHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:16 },
  reportTitle:  { fontSize:26, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.5px" },
  summaryCards: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 },
  summaryCard:  { background:"rgba(8,14,30,0.75)", border:"1px solid", borderRadius:14, padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, textAlign:"center" },
  tableLegend:  { marginTop:14, fontSize:12, color:"#334155", paddingLeft:4 },

  // Table
  tableWrap: { background:"rgba(6,12,26,0.85)", border:"1px solid rgba(59,130,246,0.08)", borderRadius:16, overflow:"auto" },
  table:     { width:"100%", borderCollapse:"collapse" },
  tableHead: { background:"rgba(59,130,246,0.04)", borderBottom:"1px solid rgba(59,130,246,0.1)" },
  th:        { padding:"13px 18px", textAlign:"left", fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" },
  tr:        { borderBottom:"1px solid rgba(51,65,85,0.18)", transition:"background 0.12s" },
  td:        { padding:"13px 18px", fontSize:14, color:"#94a3b8", verticalAlign:"middle" },
  idBadge:   { padding:"3px 10px", background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.18)", borderRadius:6, fontSize:12, fontFamily:"monospace", color:"#60a5fa" },
  studentAvatar: { width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:700, flexShrink:0 },
  statusPill:    { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, whiteSpace:"nowrap" },

  // Forms
  fieldGroup:   { marginBottom:18 },
  label:        { display:"block", fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 },
  inputWrapper: { position:"relative", display:"flex", alignItems:"center" },
  inputIcon:    { position:"absolute", left:14, color:"#334155", display:"flex", alignItems:"center" },
  input:        { width:"100%", paddingLeft:44, paddingRight:14, height:48, background:"rgba(10,18,40,0.85)", border:"1px solid rgba(51,65,85,0.7)", borderRadius:10, color:"#e2e8f0", fontSize:15, outline:"none", transition:"border-color 0.2s, box-shadow 0.2s", fontFamily:"inherit" },
  selectWrapper:{ position:"relative" },
  select:       { width:"100%", padding:"0 14px", height:48, background:"rgba(10,18,40,0.85)", border:"1px solid rgba(51,65,85,0.7)", borderRadius:10, color:"#e2e8f0", fontSize:15, outline:"none", fontFamily:"inherit", cursor:"pointer" },
  eyeBtn:       { position:"absolute", right:12, background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#475569", lineHeight:1, padding:4 },
  errorBanner:  { display:"flex", alignItems:"center", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 },

  // Buttons
  primaryBtn: { display:"inline-flex", alignItems:"center", padding:"12px 20px", background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"opacity 0.15s, transform 0.1s" },
  ghostBtn:   { display:"inline-flex", alignItems:"center", padding:"10px 16px", background:"rgba(15,23,42,0.6)", color:"#94a3b8", border:"1px solid rgba(51,65,85,0.4)", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", gap:6 },
  iconBtn:    { display:"inline-flex", alignItems:"center", justifyContent:"center", width:32, height:32, background:"rgba(15,23,42,0.6)", color:"#64748b", border:"1px solid rgba(51,65,85,0.3)", borderRadius:8, cursor:"pointer" },

  // Courses
  courseCard: { background:"rgba(8,14,32,0.85)", border:"1px solid rgba(59,130,246,0.1)", borderRadius:16, padding:"18px", animation:"fadeIn 0.4s ease" },
  courseIcon: { width:40, height:40, borderRadius:10, background:"rgba(59,130,246,0.12)", display:"flex", alignItems:"center", justifyContent:"center", color:"#60a5fa", flexShrink:0 },

  // Modal
  modalOverlay: { position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modalCard:    { width:"100%", maxWidth:460, background:"#070e1f", border:"1px solid rgba(245,158,11,0.2)", borderRadius:18, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.7)", animation:"fadeIn 0.3s ease" },
  modalHeader:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:"1px solid rgba(245,158,11,0.12)", background:"rgba(245,158,11,0.04)" },
  modalTitle:   { fontSize:16, fontWeight:700, color:"#f1f5f9" },
  modalSub:     { fontSize:12, color:"#92400e", marginTop:2 },
  modalClose:   { background:"none", border:"none", color:"#475569", cursor:"pointer", display:"flex", alignItems:"center", padding:6 },

  // Mobile
  mobileStatusBar: { width:"100%", maxWidth:420, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 20px 0", fontSize:12, color:"#334155" },
  mobileCard:      { width:"100%", maxWidth:420, marginTop:14, background:"rgba(8,14,32,0.88)", backdropFilter:"blur(22px)", border:"1px solid rgba(59,130,246,0.1)", borderRadius:20, overflow:"hidden", animation:"fadeIn 0.4s ease" },
  mobileHeader:    { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"15px 20px", borderBottom:"1px solid rgba(51,65,85,0.28)" },
  mobileLogo:      { display:"flex", alignItems:"center", gap:8 },
  backBtn:         { background:"none", border:"none", color:"#60a5fa", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" },
  mobileCourseCard: { display:"flex", alignItems:"center", gap:14, padding:"18px 22px", background:"rgba(59,130,246,0.04)", borderBottom:"1px solid rgba(59,130,246,0.08)" },
  mobileCourseIcon: { width:40, height:40, borderRadius:10, background:"rgba(59,130,246,0.12)", display:"flex", alignItems:"center", justifyContent:"center", color:"#60a5fa", flexShrink:0 },
  mobileCourseTitle:{ fontSize:16, fontWeight:700, color:"#f1f5f9", marginBottom:3 },
  mobileCourseCode: { fontSize:12, color:"#475569" },

  // Verification states
  verifyingCard:  { display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 24px", gap:14 },
  verifyingTitle: { fontSize:17, fontWeight:700, color:"#94a3b8" },
  verifyingSteps: { display:"flex", flexDirection:"column", gap:8, width:"100%" },
  verifyStep:     { display:"flex", alignItems:"center", gap:10, background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.12)", borderRadius:8, padding:"9px 14px", color:"#64748b", fontSize:13 },
  verifyHint:     { fontSize:12, color:"#334155", textAlign:"center", lineHeight:1.6, background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.12)", borderRadius:8, padding:"9px 14px" },
  blockedBanner:  { margin:22, padding:"26px 22px", background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:14, animation:"fadeIn 0.3s ease" },
  blockedTitle:   { fontSize:20, fontWeight:800, color:"#fca5a5", marginBottom:8, textAlign:"center" },
  blockedText:    { fontSize:14, color:"#64748b", lineHeight:1.65, marginBottom:14, textAlign:"center" },
  blockedDetail:  { fontSize:12, color:"#7f1d1d", background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:8, padding:"9px 12px", marginBottom:14, lineHeight:1.6 },
  diagGrid:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:4 },
  diagItem:   { display:"flex", flexDirection:"column", alignItems:"center", gap:5, background:"rgba(10,18,40,0.7)", border:"1px solid", borderRadius:10, padding:"12px 10px" },
  diagGridSm: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:18 },
  diagItemSm: { display:"flex", alignItems:"center", gap:7, background:"rgba(10,18,40,0.6)", border:"1px solid", borderRadius:8, padding:"8px 12px" },

  // Form area
  formArea:      { padding:"22px", animation:"fadeIn 0.3s ease" },
  grantedBanner: { display:"flex", alignItems:"flex-start", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.22)", borderRadius:10, padding:"12px 14px", color:"#22c55e", fontSize:13, fontWeight:600, marginBottom:18 },

  // Success
  successCard:  { margin:22, padding:"34px 22px", textAlign:"center", animation:"fadeIn 0.5s ease" },
  successCheck: { width:62, height:62, borderRadius:"50%", background:"rgba(34,197,94,0.12)", border:"2px solid rgba(34,197,94,0.35)", display:"flex", alignItems:"center", justifyContent:"center", color:"#22c55e", margin:"0 auto 16px" },
  successTitle: { fontSize:22, fontWeight:800, color:"#f1f5f9", marginBottom:8 },
  successText:  { fontSize:14, color:"#64748b", lineHeight:1.65, marginBottom:22 },
  successMeta:  { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, textAlign:"center", fontSize:13, background:"rgba(8,14,30,0.8)", border:"1px solid rgba(51,65,85,0.28)", borderRadius:12, padding:14 },

  // Footer
  securityFootnote: { display:"flex", alignItems:"center", justifyContent:"center", marginTop:20, color:"#1e293b", fontSize:11, gap:4 },
};
