import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY CONSTANTS — Production values
// ═══════════════════════════════════════════════════════════════════════════════
const IP_UNIVERSIDAD     = "149.50.194.73";
const LAT_UNIVERSIDAD    = -0.199764;
const LON_UNIVERSIDAD    = -78.504938;
const RANGO_TOLERANCIA_M = 500;

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC DATA
// ═══════════════════════════════════════════════════════════════════════════════
const PROFESSORS = [
  { id: "prof001", username: "melanie.docente",  password: "profe2026", name: "Dra. Melanie Ortiz",   dept: "Ingeniería de Sistemas" },
  { id: "prof002", username: "e.vasquez",         password: "profe2026", name: "Dr. Elena Vásquez",    dept: "Ingeniería de Sistemas" },
  { id: "prof003", username: "m.herrera",         password: "profe2026", name: "Dr. Marco Herrera",    dept: "Ciencias Exactas" },
];

const COURSES = [
  { id: "CS301",  name: "Estructuras de Datos",              credits: 4, schedule: "Lun/Mié 08:00–10:00" },
  { id: "CS405",  name: "Redes de Computadoras",             credits: 3, schedule: "Mar/Jue 10:00–12:00" },
  { id: "CS512",  name: "Inteligencia Artificial",           credits: 4, schedule: "Vie 14:00–18:00"    },
  { id: "MAT202", name: "Cálculo Diferencial",               credits: 3, schedule: "Lun/Mié/Vie 07:00–08:00" },
  { id: "CS220",  name: "Programación Orientada a Objetos",  credits: 3, schedule: "Mar/Jue 16:00–18:00" },
];

const MOCK_STUDENTS = [
  { id: "A001", name: "Carlos Mendoza",  sessions: { CS301: 14, CS405: 10, CS512: 9,  MAT202: 12, CS220: 13 } },
  { id: "A002", name: "Sofía Ramírez",   sessions: { CS301: 15, CS405: 14, CS512: 11, MAT202: 15, CS220: 15 } },
  { id: "A003", name: "Diego Fuentes",   sessions: { CS301: 8,  CS405: 7,  CS512: 6,  MAT202: 9,  CS220: 10 } },
  { id: "A004", name: "Valentina Cruz",  sessions: { CS301: 13, CS405: 12, CS512: 10, MAT202: 11, CS220: 14 } },
  { id: "A005", name: "Andrés Paredes",  sessions: { CS301: 5,  CS405: 6,  CS512: 4,  MAT202: 6,  CS220: 7  } },
  { id: "A006", name: "Isabella Torres", sessions: { CS301: 15, CS405: 13, CS512: 12, MAT202: 14, CS220: 15 } },
  { id: "A007", name: "Mateo Gómez",     sessions: { CS301: 11, CS405: 10, CS512: 9,  MAT202: 10, CS220: 12 } },
];

const TOTAL_SESSIONS = 16;

// ═══════════════════════════════════════════════════════════════════════════════
// HAVERSINE — distancia real en metros entre dos coordenadas GPS
// ═══════════════════════════════════════════════════════════════════════════════
function haversineMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radio Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL ROUTER — lee ?materia=CS301&token=XXXXXX de la barra de dirección
// ═══════════════════════════════════════════════════════════════════════════════
function parseQRParams() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("materia") || params.get("course");
  const token    = params.get("token");
  return { courseId, token };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE SVG ICONS
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPINNER
// ═══════════════════════════════════════════════════════════════════════════════
function Spinner({ size = 28, color = "#3b82f6" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: size, height: size, border: `3px solid rgba(59,130,246,0.15)`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR TIMER HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useQRTimer(active, interval = 30) {
  const [token, setToken] = useState(() => Math.random().toString(36).slice(2, 10).toUpperCase());
  const [secondsLeft, setSecondsLeft] = useState(interval);
  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setToken(Math.random().toString(36).slice(2, 10).toUpperCase()); return interval; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [active, interval]);
  return { token, secondsLeft };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL ATTENDANCE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ManualModal({ courses, onSave, onClose }) {
  const [courseId,   setCourseId]   = useState(courses[0].id);
  const [studentId,  setStudentId]  = useState("");
  const [studentName,setStudentName]= useState("");
  const [reason,     setReason]     = useState("falla_tecnica");
  const [saving,     setSaving]     = useState(false);
  const [done,       setDone]       = useState(false);

  const handleSave = () => {
    if (!studentId.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onSave({
        studentId: studentId.trim().toUpperCase(),
        studentName: studentName.trim() || studentId.trim().toUpperCase(),
        courseId,
        courseName: courses.find(c => c.id === courseId)?.name || courseId,
        method: "manual",
        reason,
        date: new Date().toISOString(),
      });
      setSaving(false);
      setDone(true);
      setTimeout(onClose, 1400);
    }, 900);
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
            <div style={{ color:"#22c55e", fontWeight:700, fontSize:18 }}>Registro guardado</div>
          </div>
        ) : (
          <div style={{ padding:"24px" }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Asignatura</label>
              <div style={s.selectWrapper}>
                <select style={s.select} value={courseId} onChange={e => setCourseId(e.target.value)}>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Matrícula / ID Alumno *</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.User /></span>
                <input style={s.input} placeholder="Ej. A001" value={studentId} onChange={e => setStudentId(e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Nombre del Alumno (opcional)</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.User /></span>
                <input style={s.input} placeholder="Nombre completo" value={studentName} onChange={e => setStudentName(e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Motivo</label>
              <div style={s.selectWrapper}>
                <select style={s.select} value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="falla_tecnica">Falla técnica del dispositivo</option>
                  <option value="sin_gps">Sin permiso GPS</option>
                  <option value="red_diferente">Red universitaria no disponible</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button style={{ ...s.ghostBtn, flex:1 }} onClick={onClose}>Cancelar</button>
              <button style={{ ...s.warningBtn, flex:2, opacity: saving?0.7:1 }} onClick={handleSave} disabled={saving||!studentId.trim()}>
                {saving ? <Spinner size={18} color="#fff" /> : <><Icon.PlusCircle /><span style={{marginLeft:8}}>Registrar Asistencia</span></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — PROFESSOR LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const handleSubmit = () => {
    setError("");
    if (!username || !password) { setError("Completa todos los campos."); return; }
    setLoading(true);
    setTimeout(() => {
      const prof = PROFESSORS.find(p => p.username === username.trim() && p.password === password);
      if (prof) { onLogin(prof); }
      else { setError("Usuario o contraseña incorrectos."); setLoading(false); }
    }, 1100);
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
            <div style={s.logoSub}>Sistema de Asistencia · Campus Quito</div>
          </div>
        </div>
        <div style={s.loginDivider} />
        <h2 style={s.loginHeading}>Acceso Docente</h2>
        <p style={s.loginSubheading}>Ingresa tus credenciales institucionales</p>

        {error && (
          <div style={s.errorBanner}>
            <span style={{ marginRight:8, flexShrink:0 }}><Icon.AlertTri /></span>{error}
          </div>
        )}

        <div style={s.fieldGroup}>
          <label style={s.label}>Usuario institucional</label>
          <div style={s.inputWrapper}>
            <span style={s.inputIcon}><Icon.User /></span>
            <input style={s.input} placeholder="usuario.docente" value={username}
              onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSubmit()} />
          </div>
        </div>
        <div style={s.fieldGroup}>
          <label style={s.label}>Contraseña</label>
          <div style={s.inputWrapper}>
            <span style={s.inputIcon}><Icon.Lock /></span>
            <input style={s.input} type={showPw?"text":"password"} placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSubmit()} />
            <button style={s.eyeBtn} onClick={() => setShowPw(v=>!v)}>{showPw?"🙈":"👁"}</button>
          </div>
        </div>

        <button style={{ ...s.primaryBtn, opacity: loading?0.7:1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size={20} color="#fff" /> : "Iniciar Sesión"}
        </button>

        <div style={s.loginHint}>
          Demo: <strong>melanie.docente</strong> · Clave: <strong>profe2026</strong>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — PROFESSOR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardScreen({ professor, onLogout, attendanceLog, onManualSave }) {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [classActive,    setClassActive]    = useState(false);
  const [showDashboard,  setShowDashboard]  = useState(false);
  const [showManual,     setShowManual]     = useState(false);
  const [courseFilter,   setCourseFilter]   = useState(COURSES[0].id);
  const { token, secondsLeft } = useQRTimer(classActive);

  const activeCourse = COURSES.find(c => c.id === selectedCourse);
  const timerPct   = (secondsLeft / 30) * 100;
  const timerColor = secondsLeft > 10 ? "#3b82f6" : secondsLeft > 5 ? "#f59e0b" : "#ef4444";

  // Build QR URL pointing to this same app with URL params
  const baseUrl  = window.location.href.split("?")[0];
  const qrTarget = activeCourse
    ? `${baseUrl}?materia=${activeCourse.id}&token=${token}`
    : "";
  const qrImgUrl = qrTarget
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrTarget)}&bgcolor=040812&color=60a5fa&margin=12`
    : "";

  // Dashboard stats for selected course
  const logForCourse = attendanceLog.filter(r => r.courseId === courseFilter);
  const liveCountMap = {};
  logForCourse.forEach(r => {
    liveCountMap[r.studentId] = (liveCountMap[r.studentId] || 0) + 1;
  });
  const dashRows = MOCK_STUDENTS.map(st => {
    const live  = liveCountMap[st.id] || 0;
    const base  = st.sessions[courseFilter] || 0;
    const total = Math.min(base + live, TOTAL_SESSIONS);
    const pct   = Math.round((total / TOTAL_SESSIONS) * 100);
    return { ...st, total, pct };
  }).sort((a, b) => b.pct - a.pct);

  // Stat totals
  const avgPct     = Math.round(dashRows.reduce((a,r) => a+r.pct,0) / dashRows.length);
  const approved   = dashRows.filter(r => r.pct >= 75).length;
  const atRisk     = dashRows.filter(r => r.pct <  75).length;

  return (
    <div style={s.dashBg}>
      <div style={s.gridOverlay} />

      {/* ── NAVBAR ── */}
      <header style={s.navbar}>
        <div style={s.navBrand}>
          <div style={s.logoMarkSm}><Icon.QR /></div>
          <span style={s.navBrandText}>AttendAI</span>
          <span style={s.navBadge}>DOCENTE</span>
        </div>
        <div style={s.navRight}>
          <button
            style={{ ...s.navBtn, background: showDashboard?"rgba(59,130,246,0.18)":"transparent", color: showDashboard?"#60a5fa":"#94a3b8" }}
            onClick={() => { setShowDashboard(v=>!v); }}
          >
            <Icon.Chart /><span style={{ marginLeft:6, fontSize:13 }}>Dashboard</span>
          </button>
          <button style={{ ...s.navBtn, color:"#f59e0b", borderColor:"rgba(245,158,11,0.3)" }} onClick={() => setShowManual(true)}>
            <Icon.AlertTri /><span style={{ marginLeft:6, fontSize:13 }}>Emergencia</span>
          </button>
          <div style={{ ...s.navBtn, cursor:"default", gap:8 }}>
            <div style={s.navAvatar}>{professor.name[3]}{professor.name.split(" ")[1]?.[0]}</div>
            <span style={{ color:"#94a3b8", fontSize:13 }}>{professor.name.split(" ").slice(0,2).join(" ")}</span>
          </div>
          <button style={{ ...s.navBtn, color:"#ef4444" }} onClick={onLogout}>
            <Icon.Logout />
          </button>
        </div>
      </header>

      <main style={s.dashMain}>
        {!showDashboard ? (
          /* ── QR GENERATOR PANEL ── */
          <div style={s.qrLayout}>
            {/* LEFT: controls */}
            <div style={s.qrControls}>
              <div style={s.sectionTag}>CONTROL DE CLASE</div>
              <h1 style={s.dashTitle}>Generador de<br /><span style={s.titleAccent}>Código QR</span></h1>
              <p style={s.dashSubtitle}>Selecciona la asignatura e inicia la clase. El QR apunta automáticamente a la vista del alumno con el parámetro <code style={{color:"#60a5fa",fontSize:12}}>?materia=</code> en la URL.</p>

              <div style={s.fieldGroup}>
                <label style={s.label}>Asignatura</label>
                <div style={s.selectWrapper}>
                  <select style={s.select} value={selectedCourse}
                    onChange={e => { setSelectedCourse(e.target.value); setClassActive(false); }}>
                    <option value="">— Seleccionar asignatura —</option>
                    {COURSES.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                  </select>
                </div>
              </div>

              {activeCourse && (
                <div style={s.courseCard}>
                  {[["Código", activeCourse.id], ["Créditos", activeCourse.credits], ["Horario", activeCourse.schedule]].map(([k,v]) => (
                    <div key={k} style={s.courseCardRow}>
                      <span style={s.courseCardLabel}>{k}</span>
                      <span style={s.courseCardValue}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                style={{ ...s.startBtn, ...(classActive?s.startBtnActive:{}), opacity:!selectedCourse?0.45:1, cursor:!selectedCourse?"not-allowed":"pointer" }}
                disabled={!selectedCourse}
                onClick={() => setClassActive(v=>!v)}
              >
                {classActive
                  ? <><span style={{ marginRight:8 }}>⏸</span>Detener Clase</>
                  : <><span style={{ display:"flex", marginRight:8 }}><Icon.Play /></span>Iniciar Clase</>
                }
              </button>

              {/* Recent log */}
              {attendanceLog.length > 0 && (
                <div style={s.recentLog}>
                  <div style={s.recentLogTitle}><Icon.Bell /> Últimos registros</div>
                  {[...attendanceLog].reverse().slice(0, 5).map((r, i) => (
                    <div key={i} style={s.recentLogRow}>
                      <div style={{ ...s.recentDot, background: r.method==="manual"?"#f59e0b":"#22c55e" }} />
                      <div style={{ flex:1 }}>
                        <span style={{ color:"#e2e8f0", fontSize:13 }}>{r.studentId}</span>
                        <span style={{ color:"#475569", fontSize:11, marginLeft:8 }}>{r.courseName}</span>
                        {r.method==="manual" && <span style={{ fontSize:10, color:"#f59e0b", marginLeft:6 }}>MANUAL</span>}
                      </div>
                      <span style={{ color:"#475569", fontSize:11 }}>
                        {new Date(r.date).toLocaleTimeString("es-EC",{ hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: QR display */}
            <div style={s.qrDisplayArea}>
              {!classActive ? (
                <div style={s.qrPlaceholder}>
                  <div style={s.qrPlaceholderIcon}><Icon.QR /></div>
                  <p style={{ color:"#334155", marginTop:16, fontSize:15, textAlign:"center", maxWidth:240 }}>
                    {selectedCourse ? "Haz clic en «Iniciar Clase» para generar el QR" : "Selecciona una asignatura para comenzar"}
                  </p>
                </div>
              ) : (
                <div style={s.qrActiveCard}>
                  <div style={s.livePill}><div style={s.liveDot} />CLASE EN VIVO</div>
                  <div style={s.qrCourseName}>{activeCourse?.name}</div>
                  <div style={s.qrCourseId}>{activeCourse?.id} · {professor.name}</div>

                  <div style={s.qrFrame}>
                    <img src={qrImgUrl} alt="QR Asistencia" style={s.qrImage} key={token} width={280} height={280} />
                    <div style={{ ...s.qrCorner, top:0, left:0, borderRight:"none", borderBottom:"none" }} />
                    <div style={{ ...s.qrCorner, top:0, right:0, borderLeft:"none",  borderBottom:"none" }} />
                    <div style={{ ...s.qrCorner, bottom:0, left:0, borderRight:"none", borderTop:"none"  }} />
                    <div style={{ ...s.qrCorner, bottom:0, right:0, borderLeft:"none", borderTop:"none"  }} />
                  </div>

                  {/* Timer */}
                  <div style={s.timerRow}>
                    <span style={{ color:"#475569", fontSize:12 }}>Token se renueva en</span>
                    <div style={s.timerBadge}>
                      <svg width="44" height="44" viewBox="0 0 44 44" style={{ position:"absolute" }}>
                        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="3"
                          strokeDasharray={`${2*Math.PI*18}`}
                          strokeDashoffset={`${2*Math.PI*18*(1-timerPct/100)}`}
                          strokeLinecap="round"
                          style={{ transformOrigin:"center", transform:"rotate(-90deg)", transition:"stroke-dashoffset 1s linear, stroke 0.4s" }}
                        />
                      </svg>
                      <span style={{ color:timerColor, fontWeight:700, fontSize:14, position:"relative" }}>{secondsLeft}s</span>
                    </div>
                  </div>

                  <div style={s.qrHint}>
                    <Icon.Shield />
                    <span style={{ marginLeft:8, fontSize:11, color:"#475569" }}>
                      Token activo: <strong style={{ color:"#60a5fa", fontFamily:"monospace" }}>{token}</strong>
                      &nbsp;· Válido solo en Wi-Fi o campus (≤500 m)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── CONSOLIDATED DASHBOARD ── */
          <div style={s.reportPanel}>
            <div style={s.reportHeader}>
              <div>
                <div style={s.sectionTag}>REPORTE CONSOLIDADO</div>
                <h2 style={s.reportTitle}>Dashboard de <span style={s.titleAccent}>Asistencia</span></h2>
              </div>
              <div>
                <label style={{ ...s.label, marginBottom:6 }}>Filtrar asignatura</label>
                <div style={s.selectWrapper}>
                  <select style={{ ...s.select, minWidth:240 }} value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                    {COURSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div style={s.summaryCards}>
              {[
                { label:"Total alumnos",    value: MOCK_STUDENTS.length, icon:"👥", color:"#3b82f6" },
                { label:"Promedio clase",   value: `${avgPct}%`,         icon:"📊", color:"#a855f7" },
                { label:"Aprobados ≥ 75%",  value: approved,             icon:"✅", color:"#22c55e" },
                { label:"En riesgo < 75%",  value: atRisk,               icon:"⚠️", color:"#ef4444" },
              ].map((c,i) => (
                <div key={i} style={{ ...s.summaryCard, borderColor:c.color+"33" }}>
                  <div style={{ fontSize:28 }}>{c.icon}</div>
                  <div style={{ color:c.color, fontSize:30, fontWeight:800, lineHeight:1 }}>{c.value}</div>
                  <div style={{ color:"#475569", fontSize:12, marginTop:4 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.tableHead}>
                    {["#","Matrícula","Estudiante","Asistencias","Sesiones","% Asistencia","Estado"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashRows.map((row, i) => {
                    const approved = row.pct >= 75;
                    const barColor = row.pct >= 75 ? "#22c55e" : row.pct >= 60 ? "#f59e0b" : "#ef4444";
                    return (
                      <tr key={row.id} style={{ ...s.tr, background: i%2===0?"rgba(255,255,255,0.012)":"transparent" }}>
                        <td style={{ ...s.td, color:"#334155", fontSize:12 }}>{i+1}</td>
                        <td style={s.td}><span style={s.idBadge}>{row.id}</span></td>
                        <td style={s.td}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ ...s.studentAvatar, background:`hsl(${row.id.charCodeAt(1)*23%360},55%,32%)` }}>{row.name[0]}</div>
                            <span style={{ color:"#e2e8f0", fontSize:14 }}>{row.name}</span>
                          </div>
                        </td>
                        <td style={s.td}><span style={{ fontVariantNumeric:"tabular-nums" }}>{row.total}</span></td>
                        <td style={s.td}><span style={{ color:"#334155" }}>{TOTAL_SESSIONS}</span></td>
                        <td style={{ ...s.td, minWidth:160 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={s.progressTrack}>
                              <div style={{ ...s.progressFill, width:`${row.pct}%`, background:barColor }} />
                            </div>
                            <span style={{ color:barColor, fontWeight:700, fontSize:14, minWidth:42, textAlign:"right" }}>{row.pct}%</span>
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.statusPill, background:approved?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", color:approved?"#22c55e":"#ef4444", border:`1px solid ${approved?"#22c55e33":"#ef444433"}` }}>
                            {approved ? "● Aprobado" : "● En riesgo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={s.tableLegend}>
              <span style={{ color:"#22c55e" }}>● Verde</span>: asistencia ≥ 75% (aprobado)&nbsp;&nbsp;
              <span style={{ color:"#f59e0b" }}>● Amarillo</span>: 60–74% (advertencia)&nbsp;&nbsp;
              <span style={{ color:"#ef4444" }}>● Rojo</span>: &lt; 60% (en riesgo)
            </div>
          </div>
        )}
      </main>

      {showManual && (
        <ManualModal
          courses={COURSES}
          onSave={record => { onManualSave(record); }}
          onClose={() => setShowManual(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY VERIFICATION HOOK — IP real + GPS real + Haversine
// ═══════════════════════════════════════════════════════════════════════════════
function useSecurityVerification() {
  // status: "checking" | "granted" | "denied" | "error"
  const [status,   setStatus]   = useState("checking");
  const [details,  setDetails]  = useState({ ip: null, lat: null, lon: null, distMetros: null, ipMatch: false, gpsMatch: false });
  const [errMsg,   setErrMsg]   = useState("");

  const run = async () => {
    setStatus("checking");
    setErrMsg("");

    let detectedIp   = null;
    let ipMatch      = false;
    let lat          = null;
    let lon          = null;
    let distMetros   = null;
    let gpsMatch     = false;

    // ── 1. IP CHECK (real fetch) ──────────────────────────────────────────────
    try {
      const res  = await fetch("https://api.ipify.org?format=json");
      const json = await res.json();
      detectedIp = json.ip;
      ipMatch    = detectedIp === IP_UNIVERSIDAD;
    } catch {
      // IP fetch may fail in sandboxed envs; treat as no-match, don't block GPS path
      detectedIp = "No disponible";
      ipMatch    = false;
    }

    // If IP already matches, we can grant immediately after GPS attempt
    // ── 2. GPS CHECK (real Geolocation API) ──────────────────────────────────
    const gpsResult = await new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: false, reason: "Tu dispositivo no soporta geolocalización." });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ ok: true, lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => {
          let reason = "No se pudo obtener tu ubicación GPS.";
          if (err.code === 1) reason = "Permiso GPS denegado. Permite la ubicación en tu navegador.";
          if (err.code === 2) reason = "Ubicación no disponible (señal débil o avión).";
          if (err.code === 3) reason = "Tiempo de espera GPS agotado.";
          resolve({ ok: false, reason });
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });

    if (gpsResult.ok) {
      lat        = gpsResult.lat;
      lon        = gpsResult.lon;
      distMetros = haversineMetros(lat, lon, LAT_UNIVERSIDAD, LON_UNIVERSIDAD);
      gpsMatch   = distMetros <= RANGO_TOLERANCIA_M;
    }

    const finalDetails = { ip: detectedIp, lat, lon, distMetros, ipMatch, gpsMatch };
    setDetails(finalDetails);

    // ── HYBRID OR LOGIC ───────────────────────────────────────────────────────
    if (ipMatch || gpsMatch) {
      setStatus("granted");
    } else {
      const parts = [];
      if (!ipMatch)   parts.push(`IP detectada (${detectedIp}) ≠ red universitaria`);
      if (!gpsMatch) {
        if (!gpsResult.ok) parts.push(gpsResult.reason);
        else parts.push(`Distancia al campus: ${Math.round(distMetros)} m (máx. ${RANGO_TOLERANCIA_M} m)`);
      }
      setErrMsg(parts.join(" · "));
      setStatus("denied");
    }
  };

  useEffect(() => { run(); }, []);

  return { status, details, errMsg, retry: run };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — STUDENT MOBILE VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function StudentScreen({ course, token: qrToken, onBack, onSubmit, attendanceLog }) {
  const { status, details, errMsg, retry } = useSecurityVerification();
  const [studentId,   setStudentId]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [dupWarning,  setDupWarning]  = useState(false);
  const [formError,   setFormError]   = useState("");
  const now = new Date();

  const handleMark = () => {
    setFormError("");
    const id = studentId.trim().toUpperCase();
    if (!id) { setFormError("Ingresa tu matrícula."); return; }
    if (!/^[A-Za-z0-9]{3,14}$/.test(id)) { setFormError("Matrícula inválida (3–14 caracteres alfanuméricos)."); return; }

    const dup = attendanceLog.find(
      r => r.studentId === id &&
           r.courseId  === (course?.id||"DEMO") &&
           r.date.slice(0,10) === now.toISOString().slice(0,10)
    );
    if (dup) { setDupWarning(true); return; }

    setSubmitting(true);
    setTimeout(() => {
      onSubmit({ studentId: id, courseId: course?.id||"DEMO", courseName: course?.name||"Demo", method:"qr", date: new Date().toISOString() });
      setSubmitting(false);
      setSuccess(true);
    }, 1800);
  };

  // Helper: format distance
  const fmtDist = (m) => m === null ? "—" : m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`;

  return (
    <div style={s.mobileBg}>
      {/* Status bar */}
      <div style={s.mobileStatusBar}>
        <span>{now.toLocaleTimeString("es-EC",{ hour:"2-digit", minute:"2-digit" })}</span>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <Icon.Wifi color={ status==="granted"?"#22c55e":"#334155" } />
          <Icon.MapPin color={ status==="granted"?"#22c55e":"#334155" } />
        </div>
      </div>

      <div style={s.mobileCard}>
        {/* Header */}
        <div style={s.mobileHeader}>
          {onBack && (
            <button style={s.backBtn} onClick={onBack}>← Volver</button>
          )}
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
              {course?.id || "—"} · {now.toLocaleDateString("es-EC",{ weekday:"long", day:"numeric", month:"long" })}
            </div>
          </div>
        </div>

        {/* ── CHECKING ── */}
        {status === "checking" && (
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

        {/* ── DENIED ── */}
        {status === "denied" && (
          <div style={s.blockedBanner}>
            <div style={{ color:"#ef4444", display:"flex", justifyContent:"center", marginBottom:12 }}>
              <Icon.ShieldOff />
            </div>
            <div style={s.blockedTitle}>Acceso Denegado</div>
            <div style={s.blockedText}>
              Debes conectarte al Wi-Fi de la universidad <strong>o</strong> encontrarte físicamente dentro del campus (≤ 500 m).
            </div>
            {errMsg && (
              <div style={s.blockedDetail}>{errMsg}</div>
            )}
            {/* Diagnostic */}
            <div style={s.diagGrid}>
              <div style={{ ...s.diagItem, borderColor: details.ipMatch?"#22c55e33":"#ef444433" }}>
                <Icon.Wifi color={ details.ipMatch?"#22c55e":"#ef4444" } />
                <span style={{ color:"#94a3b8", fontSize:11 }}>IP</span>
                <span style={{ color: details.ipMatch?"#22c55e":"#ef4444", fontSize:12, fontWeight:600 }}>
                  {details.ipMatch ? "✓ Verificada" : "✗ Diferente"}
                </span>
                {details.ip && <span style={{ fontSize:10, fontFamily:"monospace", color:"#475569" }}>{details.ip}</span>}
              </div>
              <div style={{ ...s.diagItem, borderColor: details.gpsMatch?"#22c55e33":"#ef444433" }}>
                <Icon.MapPin color={ details.gpsMatch?"#22c55e":"#ef4444" } />
                <span style={{ color:"#94a3b8", fontSize:11 }}>GPS</span>
                <span style={{ color: details.gpsMatch?"#22c55e":"#ef4444", fontSize:12, fontWeight:600 }}>
                  {details.gpsMatch ? "✓ En campus" : "✗ Fuera"}
                </span>
                <span style={{ fontSize:10, color:"#475569" }}>{fmtDist(details.distMetros)}</span>
              </div>
            </div>
            <button style={{ ...s.ghostBtn, width:"100%", marginTop:16, justifyContent:"center" }} onClick={retry}>
              <Icon.Refresh /><span style={{ marginLeft:8 }}>Reintentar verificación</span>
            </button>
          </div>
        )}

        {/* ── GRANTED ── */}
        {status === "granted" && !success && !dupWarning && (
          <div style={s.formArea}>
            {/* Access granted banner */}
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

            {/* Diagnostic mini */}
            <div style={s.diagGridSm}>
              <div style={{ ...s.diagItemSm, borderColor: details.ipMatch?"#22c55e44":"#33415566" }}>
                <Icon.Wifi color={ details.ipMatch?"#22c55e":"#475569" } />
                <span style={{ fontSize:11, color: details.ipMatch?"#22c55e":"#475569" }}>
                  {details.ipMatch ? "IP verificada" : `IP: ${details.ip||"—"}`}
                </span>
              </div>
              <div style={{ ...s.diagItemSm, borderColor: details.gpsMatch?"#22c55e44":"#33415566" }}>
                <Icon.MapPin color={ details.gpsMatch?"#22c55e":"#475569" } />
                <span style={{ fontSize:11, color: details.gpsMatch?"#22c55e":"#475569" }}>
                  {details.gpsMatch ? `${fmtDist(details.distMetros)} del campus` : details.distMetros!==null ? `${fmtDist(details.distMetros)} (fuera)` : "GPS no disponible"}
                </span>
              </div>
            </div>

            {formError && (
              <div style={s.errorBanner}>
                <span style={{ marginRight:8, flexShrink:0 }}><Icon.AlertTri /></span>{formError}
              </div>
            )}

            <div style={s.fieldGroup}>
              <label style={s.label}>Matrícula / ID Estudiantil</label>
              <div style={s.inputWrapper}>
                <span style={s.inputIcon}><Icon.User /></span>
                <input style={s.input} placeholder="Ej. A001234" value={studentId}
                  onChange={e => setStudentId(e.target.value)} maxLength={14}
                  onKeyDown={e => e.key==="Enter"&&handleMark()} />
              </div>
              <div style={{ color:"#334155", fontSize:11, marginTop:6, display:"flex", alignItems:"center", gap:4 }}>
                <Icon.Clock />&nbsp;Registro válido para hoy, {now.toLocaleDateString("es-EC")}
              </div>
            </div>

            <button style={{ ...s.primaryBtn, marginTop:4, opacity: submitting?0.7:1 }} onClick={handleMark} disabled={submitting}>
              {submitting
                ? <span style={{ display:"flex", alignItems:"center", gap:10 }}><Spinner size={18} color="#fff" />Registrando…</span>
                : <span style={{ display:"flex", alignItems:"center", gap:8 }}><Icon.Check />Marcar Asistencia</span>
              }
            </button>
          </div>
        )}

        {/* ── DUPLICATE ── */}
        {dupWarning && (
          <div style={s.successCard}>
            <div style={{ fontSize:50, marginBottom:12 }}>ℹ️</div>
            <div style={s.successTitle}>Ya registraste hoy</div>
            <div style={s.successText}>
              Tu asistencia para <strong style={{ color:"#60a5fa" }}>{course?.name}</strong> ya fue marcada el día de hoy.
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {success && (
          <div style={s.successCard}>
            <div style={s.successCheck}><Icon.Check /></div>
            <div style={s.successTitle}>¡Asistencia Registrada!</div>
            <div style={s.successText}>
              Tu presencia en <strong style={{ color:"#60a5fa" }}>{course?.name}</strong> fue confirmada.
            </div>
            <div style={s.successMeta}>
              <div><span style={{ color:"#475569" }}>Matrícula</span><br /><strong style={{ color:"#e2e8f0" }}>{studentId.toUpperCase()}</strong></div>
              <div><span style={{ color:"#475569" }}>Hora</span><br /><strong style={{ color:"#e2e8f0" }}>{now.toLocaleTimeString("es-EC",{ hour:"2-digit", minute:"2-digit" })}</strong></div>
              <div><span style={{ color:"#475569" }}>Estado</span><br /><strong style={{ color:"#22c55e" }}>Verificado</strong></div>
            </div>
            <div style={{ marginTop:16, padding:"10px 14px", background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:8 }}>
              <div style={{ fontSize:11, color:"#22c55e", textAlign:"center" }}>
                {details.ipMatch && "✓ Red Wi-Fi institucional"}{details.ipMatch&&details.gpsMatch&&" · "}{details.gpsMatch && `✓ GPS: ${fmtDist(details.distMetros)} del campus`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security footnote */}
      <div style={s.securityFootnote}>
        <Icon.Shield />
        <span style={{ marginLeft:6 }}>
          Verificación híbrida: IP <code style={{ color:"#334155" }}>{IP_UNIVERSIDAD}</code> ó GPS ≤ {RANGO_TOLERANCIA_M} m
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — URL routing + state machine
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen,        setScreen]        = useState("boot"); // boot | login | dashboard | student
  const [professor,     setProfessor]     = useState(null);
  const [studentCourse, setStudentCourse] = useState(null);
  const [studentToken,  setStudentToken]  = useState(null);
  const [attendanceLog, setAttendanceLog] = useState([]);

  // ── On mount: read URL params to decide initial screen ──
  useEffect(() => {
    const { courseId, token } = parseQRParams();
    if (courseId) {
      const course = COURSES.find(c => c.id === courseId) || { id: courseId, name: courseId };
      setStudentCourse(course);
      setStudentToken(token);
      setScreen("student");
    } else {
      setScreen("login");
    }
  }, []);

  const handleLogin        = (prof) => { setProfessor(prof); setScreen("dashboard"); };
  const handleLogout       = () => { setProfessor(null); setScreen("login"); };
  const handleStudentView  = (course) => { setStudentCourse(course); setScreen("student"); };
  const handleBack         = () => setScreen("dashboard");

  const handleSubmitAttendance = (record) =>
    setAttendanceLog(prev => [...prev, record]);

  if (screen === "boot") return (
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

      {screen === "login"     && <LoginScreen onLogin={handleLogin} />}
      {screen === "dashboard" && (
        <DashboardScreen
          professor={professor}
          onLogout={handleLogout}
          attendanceLog={attendanceLog}
          onManualSave={handleSubmitAttendance}
        />
      )}
      {screen === "student"   && (
        <StudentScreen
          course={studentCourse}
          token={studentToken}
          onBack={professor ? handleBack : null}
          onSubmit={handleSubmitAttendance}
          attendanceLog={attendanceLog}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const s = {
  // ── Backgrounds ──
  loginBg: {
    minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
    background:"radial-gradient(ellipse 80% 55% at 50% 0%, #0c1d3a 0%, #040812 65%)",
    position:"relative", overflow:"hidden", padding:"24px 16px",
  },
  dashBg: {
    minHeight:"100vh",
    background:"linear-gradient(160deg,#040812 0%,#060d1e 50%,#040812 100%)",
    position:"relative",
  },
  mobileBg: {
    minHeight:"100vh",
    background:"linear-gradient(180deg,#040c1e 0%,#040812 100%)",
    display:"flex", flexDirection:"column", alignItems:"center",
    padding:"0 16px 48px", position:"relative",
  },

  // ── Decorative ──
  gridOverlay: {
    position:"absolute", inset:0, pointerEvents:"none",
    backgroundImage:"linear-gradient(rgba(59,130,246,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.025) 1px,transparent 1px)",
    backgroundSize:"56px 56px",
  },
  glowOrb: {
    position:"absolute", top:"-15%", left:"50%", transform:"translateX(-50%)",
    width:600, height:380,
    background:"radial-gradient(ellipse,rgba(59,130,246,0.1) 0%,transparent 70%)",
    pointerEvents:"none",
  },

  // ── Login card ──
  loginCard: {
    position:"relative", zIndex:1,
    background:"rgba(8,14,32,0.92)",
    border:"1px solid rgba(59,130,246,0.13)",
    borderRadius:22, padding:"40px 48px",
    width:"100%", maxWidth:440,
    backdropFilter:"blur(24px)",
    boxShadow:"0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(59,130,246,0.06) inset",
    animation:"fadeIn 0.45s ease",
  },
  loginLogo:    { display:"flex", alignItems:"center", gap:14, marginBottom:24 },
  logoMark: {
    width:46, height:46, borderRadius:13,
    background:"linear-gradient(140deg,#1d4ed8,#3b82f6)",
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"#fff", boxShadow:"0 4px 20px rgba(59,130,246,0.4)",
  },
  logoMarkSm: {
    width:34, height:34, borderRadius:9,
    background:"linear-gradient(140deg,#1d4ed8,#3b82f6)",
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"#fff", flexShrink:0,
  },
  logoTitle:    { fontSize:20, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.5px" },
  logoSub:      { fontSize:11, color:"#475569", marginTop:1 },
  loginDivider: { height:1, background:"rgba(59,130,246,0.08)", margin:"0 0 28px" },
  loginHeading: { fontSize:24, fontWeight:700, color:"#f1f5f9", letterSpacing:"-0.5px", marginBottom:6 },
  loginSubheading:{ fontSize:14, color:"#475569", marginBottom:28 },
  loginHint: {
    marginTop:20, padding:"10px 16px",
    background:"rgba(59,130,246,0.05)", borderRadius:8,
    border:"1px solid rgba(59,130,246,0.1)",
    fontSize:12, color:"#475569", textAlign:"center", lineHeight:1.7,
  },

  // ── Form elements ──
  fieldGroup:   { marginBottom:18 },
  label:        { display:"block", fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 },
  inputWrapper: { position:"relative", display:"flex", alignItems:"center" },
  inputIcon:    { position:"absolute", left:14, color:"#334155", display:"flex", alignItems:"center" },
  input: {
    width:"100%", paddingLeft:44, paddingRight:14, height:48,
    background:"rgba(10,18,40,0.85)",
    border:"1px solid rgba(51,65,85,0.7)",
    borderRadius:10, color:"#e2e8f0", fontSize:15,
    outline:"none", transition:"border-color 0.2s, box-shadow 0.2s",
    fontFamily:"inherit",
  },
  eyeBtn: {
    position:"absolute", right:12, background:"none", border:"none",
    cursor:"pointer", fontSize:15, color:"#475569", lineHeight:1, padding:4,
  },
  errorBanner: {
    display:"flex", alignItems:"center",
    background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)",
    borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16,
    gap:6,
  },

  // ── Buttons ──
  primaryBtn: {
    width:"100%", height:50, borderRadius:10,
    background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",
    border:"none", color:"#fff", fontSize:15, fontWeight:700,
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 4px 24px rgba(59,130,246,0.35)",
    transition:"transform 0.15s, box-shadow 0.15s",
    fontFamily:"inherit",
  },
  startBtn: {
    marginTop:8, height:52, borderRadius:12, width:"100%",
    background:"linear-gradient(135deg,#1d4ed8,#2563eb)",
    border:"1px solid rgba(59,130,246,0.35)",
    color:"#fff", fontSize:15, fontWeight:700,
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 4px 20px rgba(59,130,246,0.28)",
    transition:"all 0.2s", fontFamily:"inherit",
  },
  startBtnActive: {
    background:"linear-gradient(135deg,#7f1d1d,#ef4444)",
    borderColor:"rgba(239,68,68,0.35)",
    boxShadow:"0 4px 20px rgba(239,68,68,0.28)",
  },
  ghostBtn: {
    height:42, borderRadius:10, padding:"0 16px",
    background:"rgba(15,23,42,0.8)", border:"1px solid rgba(51,65,85,0.6)",
    color:"#94a3b8", fontSize:13, fontWeight:600,
    cursor:"pointer", display:"flex", alignItems:"center",
    transition:"all 0.15s", fontFamily:"inherit",
  },
  warningBtn: {
    height:42, borderRadius:10, padding:"0 16px",
    background:"linear-gradient(135deg,#92400e,#f59e0b)",
    border:"none", color:"#fff", fontSize:14, fontWeight:700,
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 4px 16px rgba(245,158,11,0.3)",
    transition:"all 0.15s", fontFamily:"inherit",
  },

  // ── Select ──
  selectWrapper: { position:"relative" },
  select: {
    width:"100%", height:48, paddingLeft:14, paddingRight:36,
    background:"rgba(10,18,40,0.85)", border:"1px solid rgba(51,65,85,0.7)",
    borderRadius:10, color:"#e2e8f0", fontSize:14, outline:"none",
    cursor:"pointer", appearance:"none", fontFamily:"inherit",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center",
  },

  // ── Navbar ──
  navbar: {
    position:"sticky", top:0, zIndex:100,
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"0 24px", height:64,
    background:"rgba(4,8,18,0.88)", backdropFilter:"blur(18px)",
    borderBottom:"1px solid rgba(59,130,246,0.08)",
  },
  navBrand:     { display:"flex", alignItems:"center", gap:10 },
  navBrandText: { color:"#f1f5f9", fontWeight:800, fontSize:17, letterSpacing:"-0.5px" },
  navBadge: {
    padding:"2px 8px", background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.25)",
    borderRadius:4, fontSize:9, fontWeight:700, color:"#60a5fa", letterSpacing:"0.1em",
  },
  navRight: { display:"flex", alignItems:"center", gap:8 },
  navBtn: {
    display:"flex", alignItems:"center", padding:"6px 12px", borderRadius:8,
    background:"transparent", border:"1px solid rgba(51,65,85,0.45)",
    color:"#94a3b8", cursor:"pointer", fontFamily:"inherit",
    transition:"all 0.18s",
  },
  navAvatar: {
    width:30, height:30, borderRadius:"50%",
    background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"#fff", fontSize:11, fontWeight:700,
    border:"2px solid rgba(59,130,246,0.28)",
  },

  // ── Dashboard main ──
  dashMain:    { padding:"28px 24px", maxWidth:1300, margin:"0 auto" },
  qrLayout:    { display:"flex", gap:28, alignItems:"flex-start" },
  qrControls:  { flex:"0 0 330px", animation:"fadeIn 0.4s ease" },
  qrDisplayArea: {
    flex:1, minHeight:500,
    background:"rgba(8,14,30,0.6)", borderRadius:20,
    border:"1px solid rgba(59,130,246,0.08)",
    display:"flex", alignItems:"center", justifyContent:"center",
    animation:"fadeIn 0.4s ease",
  },

  sectionTag:   { fontSize:10, fontWeight:700, letterSpacing:"0.14em", color:"#3b82f6", textTransform:"uppercase", marginBottom:10 },
  dashTitle:    { fontSize:34, fontWeight:800, color:"#f1f5f9", lineHeight:1.15, letterSpacing:"-1px", marginBottom:12 },
  titleAccent:  { color:"#3b82f6" },
  dashSubtitle: { fontSize:13, color:"#475569", lineHeight:1.65, marginBottom:28 },

  courseCard: {
    background:"rgba(59,130,246,0.04)", border:"1px solid rgba(59,130,246,0.13)",
    borderRadius:12, padding:"12px 16px", marginBottom:18,
  },
  courseCardRow:   { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0" },
  courseCardLabel: { fontSize:12, color:"#475569" },
  courseCardValue: { fontSize:13, color:"#94a3b8", fontWeight:500 },

  // ── QR display ──
  qrPlaceholder: {
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    padding:40,
  },
  qrPlaceholderIcon: {
    width:76, height:76, borderRadius:18, border:"2px dashed #1e293b",
    display:"flex", alignItems:"center", justifyContent:"center", color:"#1e293b",
  },
  qrActiveCard: {
    display:"flex", flexDirection:"column", alignItems:"center",
    padding:"32px 36px", gap:12, width:"100%", animation:"fadeIn 0.4s ease",
  },
  livePill: {
    display:"flex", alignItems:"center", gap:7, padding:"4px 14px",
    background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.28)",
    borderRadius:20, fontSize:11, fontWeight:700, color:"#ef4444", letterSpacing:"0.08em",
  },
  liveDot: {
    width:7, height:7, borderRadius:"50%", background:"#ef4444",
    animation:"pulse 1.1s ease-in-out infinite",
  },
  qrCourseName: { fontSize:20, fontWeight:700, color:"#f1f5f9", letterSpacing:"-0.3px" },
  qrCourseId:   { fontSize:13, color:"#475569" },
  qrFrame: {
    position:"relative", padding:14,
    background:"rgba(4,8,22,0.9)",
    border:"1px solid rgba(59,130,246,0.18)", borderRadius:16,
    animation:"glow 3s ease-in-out infinite",
  },
  qrImage:  { display:"block", borderRadius:8, imageRendering:"crisp-edges" },
  qrCorner: { position:"absolute", width:20, height:20, border:"2.5px solid #3b82f6", borderRadius:2 },
  timerRow: { display:"flex", alignItems:"center", gap:14, color:"#64748b", fontSize:13 },
  timerBadge: {
    position:"relative", width:44, height:44,
    display:"flex", alignItems:"center", justifyContent:"center",
  },
  qrHint: {
    display:"flex", alignItems:"center",
    background:"rgba(10,18,40,0.8)", border:"1px solid rgba(51,65,85,0.4)",
    borderRadius:8, padding:"9px 14px",
  },

  // ── Recent log ──
  recentLog: {
    marginTop:18, background:"rgba(8,14,30,0.6)",
    border:"1px solid rgba(51,65,85,0.35)", borderRadius:12, padding:"14px 16px",
  },
  recentLogTitle: { display:"flex", alignItems:"center", gap:8, color:"#475569", fontSize:12, fontWeight:600, marginBottom:12 },
  recentLogRow:   { display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid rgba(51,65,85,0.15)" },
  recentDot:      { width:7, height:7, borderRadius:"50%", flexShrink:0 },

  // ── Report ──
  reportPanel:  { animation:"fadeIn 0.4s ease" },
  reportHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:16 },
  reportTitle:  { fontSize:26, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.5px" },
  summaryCards: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 },
  summaryCard: {
    background:"rgba(8,14,30,0.75)", border:"1px solid",
    borderRadius:14, padding:"20px 16px",
    display:"flex", flexDirection:"column", alignItems:"center", gap:6, textAlign:"center",
  },
  tableLegend: { marginTop:14, fontSize:12, color:"#334155", paddingLeft:4 },

  // ── Table ──
  tableWrap:  { background:"rgba(6,12,26,0.85)", border:"1px solid rgba(59,130,246,0.08)", borderRadius:16, overflow:"auto" },
  table:      { width:"100%", borderCollapse:"collapse" },
  tableHead:  { background:"rgba(59,130,246,0.04)", borderBottom:"1px solid rgba(59,130,246,0.1)" },
  th:         { padding:"13px 18px", textAlign:"left", fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" },
  tr:         { borderBottom:"1px solid rgba(51,65,85,0.18)", transition:"background 0.12s" },
  td:         { padding:"13px 18px", fontSize:14, color:"#94a3b8", verticalAlign:"middle" },
  idBadge: {
    padding:"3px 10px", background:"rgba(59,130,246,0.08)",
    border:"1px solid rgba(59,130,246,0.18)", borderRadius:6,
    fontSize:12, fontFamily:"monospace", color:"#60a5fa",
  },
  studentAvatar: {
    width:32, height:32, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"#fff", fontSize:13, fontWeight:700, flexShrink:0,
  },
  progressTrack: { flex:1, height:5, background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden", minWidth:80 },
  progressFill:  { height:"100%", borderRadius:3, transition:"width 0.7s ease" },
  statusPill:    { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, whiteSpace:"nowrap" },

  // ── Modal ──
  modalOverlay: {
    position:"fixed", inset:0, zIndex:500,
    background:"rgba(0,0,0,0.72)", backdropFilter:"blur(8px)",
    display:"flex", alignItems:"center", justifyContent:"center", padding:16,
  },
  modalCard: {
    width:"100%", maxWidth:460,
    background:"#070e1f", border:"1px solid rgba(245,158,11,0.2)",
    borderRadius:18, overflow:"hidden",
    boxShadow:"0 32px 80px rgba(0,0,0,0.7)",
    animation:"fadeIn 0.3s ease",
  },
  modalHeader: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"18px 24px", borderBottom:"1px solid rgba(245,158,11,0.12)",
    background:"rgba(245,158,11,0.04)",
  },
  modalTitle: { fontSize:16, fontWeight:700, color:"#f1f5f9" },
  modalSub:   { fontSize:12, color:"#92400e", marginTop:2 },
  modalClose: {
    background:"none", border:"none", color:"#475569",
    cursor:"pointer", display:"flex", alignItems:"center", padding:6,
  },

  // ── Mobile ──
  mobileStatusBar: {
    width:"100%", maxWidth:420,
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"12px 20px 0", fontSize:12, color:"#334155",
  },
  mobileCard: {
    width:"100%", maxWidth:420, marginTop:14,
    background:"rgba(8,14,32,0.88)", backdropFilter:"blur(22px)",
    border:"1px solid rgba(59,130,246,0.1)", borderRadius:20, overflow:"hidden",
    animation:"fadeIn 0.4s ease",
  },
  mobileHeader: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"15px 20px", borderBottom:"1px solid rgba(51,65,85,0.28)",
  },
  mobileLogo: { display:"flex", alignItems:"center", gap:8 },
  backBtn: {
    background:"none", border:"none", color:"#60a5fa",
    cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit",
  },
  mobileCourseCard: {
    display:"flex", alignItems:"center", gap:14,
    padding:"18px 22px", background:"rgba(59,130,246,0.04)",
    borderBottom:"1px solid rgba(59,130,246,0.08)",
  },
  mobileCourseIcon: {
    width:40, height:40, borderRadius:10,
    background:"rgba(59,130,246,0.12)", display:"flex", alignItems:"center", justifyContent:"center",
    color:"#60a5fa", flexShrink:0,
  },
  mobileCourseTitle: { fontSize:16, fontWeight:700, color:"#f1f5f9", marginBottom:3 },
  mobileCourseCode:  { fontSize:12, color:"#475569" },

  // Verifying
  verifyingCard: {
    display:"flex", flexDirection:"column", alignItems:"center",
    padding:"40px 24px", gap:14,
  },
  verifyingTitle: { fontSize:17, fontWeight:700, color:"#94a3b8" },
  verifyingSteps: { display:"flex", flexDirection:"column", gap:8, width:"100%" },
  verifyStep: {
    display:"flex", alignItems:"center", gap:10,
    background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.12)",
    borderRadius:8, padding:"9px 14px", color:"#64748b", fontSize:13,
  },
  verifyHint: {
    fontSize:12, color:"#334155", textAlign:"center", lineHeight:1.6,
    background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.12)",
    borderRadius:8, padding:"9px 14px",
  },

  // Blocked
  blockedBanner: {
    margin:22, padding:"26px 22px",
    background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.18)",
    borderRadius:14, animation:"fadeIn 0.3s ease",
  },
  blockedTitle:  { fontSize:20, fontWeight:800, color:"#fca5a5", marginBottom:8, textAlign:"center" },
  blockedText:   { fontSize:14, color:"#64748b", lineHeight:1.65, marginBottom:14, textAlign:"center" },
  blockedDetail: {
    fontSize:12, color:"#7f1d1d", background:"rgba(239,68,68,0.07)",
    border:"1px solid rgba(239,68,68,0.15)", borderRadius:8, padding:"9px 12px", marginBottom:14, lineHeight:1.6,
  },

  // Diagnostic grids
  diagGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:4 },
  diagItem: {
    display:"flex", flexDirection:"column", alignItems:"center", gap:5,
    background:"rgba(10,18,40,0.7)", border:"1px solid",
    borderRadius:10, padding:"12px 10px",
  },
  diagGridSm: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:18 },
  diagItemSm: {
    display:"flex", alignItems:"center", gap:7,
    background:"rgba(10,18,40,0.6)", border:"1px solid",
    borderRadius:8, padding:"8px 12px",
  },

  // Granted + form
  formArea: { padding:"22px", animation:"fadeIn 0.3s ease" },
  grantedBanner: {
    display:"flex", alignItems:"flex-start",
    background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.22)",
    borderRadius:10, padding:"12px 14px", color:"#22c55e",
    fontSize:13, fontWeight:600, marginBottom:18,
  },

  // Success
  successCard: {
    margin:22, padding:"34px 22px", textAlign:"center",
    animation:"fadeIn 0.5s ease",
  },
  successCheck: {
    width:62, height:62, borderRadius:"50%",
    background:"rgba(34,197,94,0.12)", border:"2px solid rgba(34,197,94,0.35)",
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"#22c55e", margin:"0 auto 16px",
  },
  successTitle: { fontSize:22, fontWeight:800, color:"#f1f5f9", marginBottom:8 },
  successText:  { fontSize:14, color:"#64748b", lineHeight:1.65, marginBottom:22 },
  successMeta: {
    display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, textAlign:"center", fontSize:13,
    background:"rgba(8,14,30,0.8)", border:"1px solid rgba(51,65,85,0.28)",
    borderRadius:12, padding:14,
  },

  // Footer footnote
  securityFootnote: {
    display:"flex", alignItems:"center", justifyContent:"center",
    marginTop:20, color:"#1e293b", fontSize:11, gap:4,
  },
};
