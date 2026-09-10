import type { SupabaseClient } from "@supabase/supabase-js";
import { cappedActiveSeconds } from "@/lib/active-seconds";
import { countMessagesByConversation } from "@/lib/message-counts";

/**
 * Datos del informe semanal de uso, para una institución.
 *
 * Todo lo que el informe muestra se calcula acá y se devuelve como cifras ya
 * resueltas. El generador del .docx no vuelve a consultar la base: así el
 * documento y la foto que queda guardada en report_runs.snapshot son
 * exactamente lo mismo, y dentro de un mes se puede responder "¿qué decía el
 * informe de esa semana?" sin recalcular sobre datos que ya cambiaron.
 *
 * Dos reglas heredadas de los informes escritos a mano, que no son detalles:
 *
 *  - El 0 y el NA NO son lo mismo, y confundirlos falsea los promedios hacia
 *    arriba. En session_competencies, NULL es "no aplicaba" (viene con su
 *    justificación en na_justifications) y 0 es "el estudiante lo omitió
 *    habiendo oportunidad", que es una nota real y penaliza. Ver
 *    buildCompetencyUpsert, que es lo que escribe. Acá se excluye el NULL y se
 *    cuenta el 0. Excluir también los ceros subía conducta no verbal de 0,52 a
 *    1,00 y objetivos de 0,80 a 1,65: media rúbrica de diferencia.
 *  - El tiempo de sesión pasa por cappedActiveSeconds, el mismo tope que usan
 *    los informes de piloto, para que una pestaña olvidada no invente horas.
 */

export const COMPETENCIAS: { key: string; label: string }[] = [
  { key: "setting_terapeutico", label: "Setting terapéutico" },
  { key: "motivo_consulta", label: "Motivo de consulta" },
  { key: "datos_contextuales", label: "Datos contextuales" },
  { key: "objetivos", label: "Objetivos" },
  { key: "escucha_activa", label: "Escucha activa" },
  { key: "actitud_no_valorativa", label: "Actitud no valorativa" },
  { key: "optimismo", label: "Optimismo" },
  { key: "presencia", label: "Presencia" },
  { key: "conducta_no_verbal", label: "Conducta no verbal" },
  { key: "contencion_afectos", label: "Contención de afectos" },
];

/**
 * Cuentas del equipo GlorIA creadas DENTRO de una institución para probar el
 * flujo. Tienen rol de estudiante y sesiones reales, pero no son alumnos: si
 * cuentan, el informe le dice al cliente que tiene un estudiante más de los
 * que matriculó, y la cifra no cuadra con su lista de curso.
 */
const CUENTA_INTERNA = /smoketest|tomasdespouy|@glor-ia\.com$/i;

/** Con menos pares que esto, un promedio comparado habla del azar. */
const MIN_PARES_LONGITUDINAL = 3;

export type FilaSeccion = {
  nombre: string;
  alumnos: number;
  ingresaron: number;
  practicaron: number;
  sesiones: number;
  minutosMediana: number;
  mensajesMediana: number;
  conDevolucion: number;
};

export type FilaCompetencia = { label: string; promedio: number; n: number };

export type FilaDevolucion = {
  seccion: string;
  docente: string;
  evaluaciones: number;
  aprobadas: number;
  pendientes: number;
  diasMediana: number | null;
};

export type FilaLongitudinal = {
  label: string;
  primera: number;
  segunda: number;
  cambio: number;
  n: number;
};

export type WeeklyReportData = {
  establecimiento: string;
  generadoEl: string;
  totales: {
    alumnos: number;
    ingresaron: number;
    practicaron: number;
    sesiones: number;
    minutosMediana: number;
    mensajesMediana: number;
    conDevolucion: number;
    horasTotales: number;
    evaluaciones: number;
    sesionesUltimos7: number;
  };
  secciones: FilaSeccion[];
  competencias: FilaCompetencia[];
  devolucion: FilaDevolucion[];
  longitudinal: {
    alumnos: number;
    mejoraron: number;
    empeoraron: number;
    medianaCambio: number;
    filas: FilaLongitudinal[];
  };
  edicionDocente: { evaluaciones: number; notasAjustadas: number; comentarios: number };
  /** Frase de portada, derivada de los datos. Ver elegirTitular. */
  titular: { texto: string; detalle: string };
  hayActividad: boolean;
};

const mediana = (a: number[]): number => {
  if (!a.length) return 0;
  const x = [...a].sort((p, q) => p - q);
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};

/**
 * El titular no se escribe a mano cada semana: sale del cuello de botella más
 * grande que tengan los datos. El orden de las preguntas importa — de nada
 * sirve hablar de competencias si nadie ha entrado todavía.
 */
function elegirTitular(d: Omit<WeeklyReportData, "titular">): { texto: string; detalle: string } {
  const t = d.totales;

  if (t.sesiones === 0) {
    return {
      texto: `Todavía no hay sesiones registradas: ${t.ingresaron} de ${t.alumnos} estudiantes han ingresado.`,
      detalle:
        "La primera práctica casi nunca ocurre sola. En los cursos donde se agenda dentro de un bloque de clase, la participación llega sobre el 95%; donde se deja como tarea, se queda bajo la mitad.",
    };
  }

  // Evaluaciones esperando revisión docente: el alumno practicó y no ve nada.
  const conPendientes = d.devolucion.filter((x) => x.pendientes > 0).sort((a, b) => b.pendientes - a.pendientes);
  const totalPendientes = conPendientes.reduce((s, x) => s + x.pendientes, 0);
  if (totalPendientes >= 5) {
    const peor = conPendientes[0];
    return {
      texto: `Hay ${totalPendientes} evaluaciones esperando revisión docente. Hasta que se aprueben, esos estudiantes no ven su retroalimentación.`,
      detalle: `La que más acumula es la ${peor.seccion} (${peor.pendientes}), a cargo de ${peor.docente}. GlorIA propone la evaluación al terminar la sesión, pero el estudiante no la ve hasta que su docente la revisa y la aprueba: ese paso es el que convierte la práctica en aprendizaje.`,
    };
  }

  // Secciones que entraron pero no practican.
  const dormidas = d.secciones.filter((s) => s.alumnos > 0 && s.practicaron / s.alumnos < 0.5);
  if (dormidas.length) {
    const peor = dormidas.sort((a, b) => a.practicaron / a.alumnos - b.practicaron / b.alumnos)[0];
    return {
      texto: `La ${peor.nombre} tiene ${peor.practicaron} de ${peor.alumnos} estudiantes con al menos una sesión.`,
      detalle:
        "La diferencia entre las secciones que despegan y las que no suele estar en una decisión: agendar la primera práctica dentro de un bloque de clase en vez de dejarla como tarea.",
    };
  }

  return {
    texto: `${t.conDevolucion} de ${t.alumnos} estudiantes ya tienen su retroalimentación, sobre ${t.sesiones} sesiones acumuladas.`,
    detalle: `Esta semana se registraron ${t.sesionesUltimos7} sesiones nuevas. El ciclo está al día: no hay evaluaciones esperando revisión.`,
  };
}

export async function buildWeeklyReportData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  establishmentId: string,
): Promise<WeeklyReportData> {
  const { data: est } = await admin
    .from("establishments").select("name").eq("id", establishmentId).maybeSingle();

  const { data: perfiles } = await admin
    .from("profiles")
    .select("id, full_name, email, role, section_id, course_id")
    .eq("establishment_id", establishmentId);

  const alumnos = (perfiles || []).filter(
    (p) => p.role === "student" && !CUENTA_INTERNA.test(p.email || ""),
  );
  const docentes = (perfiles || []).filter((p) => p.role === "instructor");

  const { data: secciones } = await admin
    .from("sections").select("id, name, course_id");
  const seccionesDeEst = (secciones || []).filter((s) =>
    alumnos.some((a) => a.section_id === s.id) || docentes.some((d) => d.section_id === s.id),
  );

  const ids = alumnos.map((a) => a.id);
  if (!ids.length) {
    const base = vacio(est?.name || "Institución");
    return { ...base, titular: elegirTitular(base) };
  }

  // last_sign_in vive en auth.users; hay una función para consultarlo.
  const { data: ls } = await admin.rpc("auth_last_sign_in", { p_ids: ids });
  const ingreso = new Map((ls || []).map((x: { user_id: string; last_sign_in_at: string | null }) => [x.user_id, x.last_sign_in_at]));

  const { data: convs } = await admin
    .from("conversations")
    .select("id, student_id, status, active_seconds, started_at, ended_at, created_at")
    .in("student_id", ids);
  const conversaciones = convs || [];
  const convIds = conversaciones.map((c) => c.id);

  const { data: comps } = convIds.length
    ? await admin.from("session_competencies").select("*").in("conversation_id", convIds)
    : { data: [] };
  const evaluaciones = comps || [];

  const { data: fbs } = convIds.length
    ? await admin.from("session_feedback").select("conversation_id, teacher_comment").in("conversation_id", convIds)
    : { data: [] };

  const cuenta = convIds.length
    ? await countMessagesByConversation(admin, convIds)
    : new Map<string, number>();

  const conDevolucion = new Set(
    evaluaciones.filter((e) => ["approved", "evaluated"].includes(e.feedback_status)).map((e) => e.student_id),
  );

  // ── Por sección ────────────────────────────────────────────────────────────
  const filasSeccion: FilaSeccion[] = [];
  let todosSeg: number[] = [];
  let todosMsg: number[] = [];
  for (const sec of seccionesDeEst) {
    const sa = alumnos.filter((a) => a.section_id === sec.id);
    if (!sa.length) continue;
    const set = new Set(sa.map((a) => a.id));
    const sc = conversaciones.filter((c) => set.has(c.student_id));
    const segs = sc.map(cappedActiveSeconds).filter((x) => x > 0);
    const msgs = sc.map((c) => cuenta.get(c.id) || 0);
    todosSeg = todosSeg.concat(segs);
    todosMsg = todosMsg.concat(msgs);
    filasSeccion.push({
      nombre: sec.name,
      alumnos: sa.length,
      ingresaron: sa.filter((a) => ingreso.get(a.id)).length,
      practicaron: new Set(sc.map((c) => c.student_id)).size,
      sesiones: sc.length,
      minutosMediana: Math.round((mediana(segs) / 60) * 10) / 10,
      mensajesMediana: Math.round(mediana(msgs)),
      conDevolucion: sa.filter((a) => conDevolucion.has(a.id)).length,
    });
  }
  filasSeccion.sort((a, b) => b.sesiones - a.sesiones);

  // ── Perfil de competencias ─────────────────────────────────────────────────
  const filasComp: FilaCompetencia[] = [];
  for (const c of COMPETENCIAS) {
    // NULL (NA) fuera; 0 (omitido) dentro, porque es una nota.
    const vals = evaluaciones
      .map((e) => (e as Record<string, unknown>)[c.key])
      .filter((v): v is number => typeof v === "number");
    filasComp.push({
      label: c.label,
      promedio: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      n: vals.length,
    });
  }
  filasComp.sort((a, b) => b.promedio - a.promedio);

  // ── Ciclo de devolución, por sección y su docente ──────────────────────────
  const seccionDe = new Map(alumnos.map((a) => [a.id, a.section_id]));
  const filasDev: FilaDevolucion[] = [];
  for (const sec of seccionesDeEst) {
    const evs = evaluaciones.filter((e) => seccionDe.get(e.student_id) === sec.id);
    if (!evs.length && !alumnos.some((a) => a.section_id === sec.id)) continue;
    const dias = evs
      .filter((e) => e.approved_at && e.created_at)
      .map((e) => (Date.parse(e.approved_at) - Date.parse(e.created_at)) / 86400000);
    const doc = docentes.find((d) => d.section_id === sec.id);
    filasDev.push({
      seccion: sec.name,
      docente: doc?.full_name || "sin docente asignado",
      evaluaciones: evs.length,
      aprobadas: evs.filter((e) => ["approved", "evaluated"].includes(e.feedback_status)).length,
      pendientes: evs.filter((e) => e.feedback_status === "pending").length,
      diasMediana: dias.length ? Math.round(mediana(dias) * 10) / 10 : null,
    });
  }
  filasDev.sort((a, b) => b.evaluaciones - a.evaluaciones);

  // ── Longitudinal: primera contra última sesión evaluada ────────────────────
  const fecha = new Map(conversaciones.map((c) => [c.id, c.created_at]));
  const porAlumno: Record<string, Record<string, unknown>[]> = {};
  for (const e of evaluaciones) {
    (porAlumno[e.student_id] ||= []).push({ ...e, _fecha: fecha.get(e.conversation_id) });
  }
  const conDos = Object.values(porAlumno)
    .filter((v) => v.length >= 2)
    .map((v) => v.sort((a, b) => String(a._fecha).localeCompare(String(b._fecha))));

  const deltas = conDos
    .map((v) => Number(v[v.length - 1].overall_score_v2) - Number(v[0].overall_score_v2))
    .filter((d) => Number.isFinite(d));

  const filasLong: FilaLongitudinal[] = [];
  for (const c of COMPETENCIAS) {
    const pares: [number, number][] = conDos
      .map((v) => [v[0][c.key], v[v.length - 1][c.key]])
      .filter((par) => typeof par[0] === "number" && typeof par[1] === "number")
      .map((par) => [Number(par[0]), Number(par[1])]);
    if (pares.length < MIN_PARES_LONGITUDINAL) continue;
    const p1 = pares.reduce((s, [a]) => s + a, 0) / pares.length;
    const p2 = pares.reduce((s, [, b]) => s + b, 0) / pares.length;
    filasLong.push({ label: c.label, primera: p1, segunda: p2, cambio: p2 - p1, n: pares.length });
  }
  filasLong.sort((a, b) => b.cambio - a.cambio);

  // ── Cuánto corrige el docente a GlorIA ─────────────────────────────────────
  let notasAjustadas = 0;
  for (const e of evaluaciones) {
    const raw = e.ai_original;
    if (!raw) continue;
    let orig: { scores?: Record<string, number> } | null = null;
    try { orig = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { continue; }
    const sc = orig?.scores || {};
    const cambio = COMPETENCIAS.some((c) => {
      const antes = sc[c.key];
      const ahora = (e as Record<string, unknown>)[c.key];
      return antes != null && ahora != null && Number(antes) !== Number(ahora);
    });
    if (cambio) notasAjustadas++;
  }

  const hace7 = Date.now() - 7 * 86400000;
  const base: Omit<WeeklyReportData, "titular"> = {
    establecimiento: est?.name || "Institución",
    generadoEl: new Date().toISOString(),
    totales: {
      alumnos: alumnos.length,
      ingresaron: alumnos.filter((a) => ingreso.get(a.id)).length,
      practicaron: new Set(conversaciones.map((c) => c.student_id)).size,
      sesiones: conversaciones.length,
      minutosMediana: Math.round((mediana(todosSeg) / 60) * 10) / 10,
      mensajesMediana: Math.round(mediana(todosMsg)),
      conDevolucion: conDevolucion.size,
      horasTotales: Math.round((todosSeg.reduce((a, b) => a + b, 0) / 3600) * 10) / 10,
      evaluaciones: evaluaciones.length,
      sesionesUltimos7: conversaciones.filter((c) => Date.parse(c.created_at) >= hace7).length,
    },
    secciones: filasSeccion,
    competencias: filasComp,
    devolucion: filasDev,
    longitudinal: {
      alumnos: conDos.length,
      mejoraron: deltas.filter((d) => d > 0.05).length,
      empeoraron: deltas.filter((d) => d < -0.05).length,
      medianaCambio: deltas.length ? Math.round(mediana(deltas) * 100) / 100 : 0,
      filas: filasLong,
    },
    edicionDocente: {
      evaluaciones: evaluaciones.length,
      notasAjustadas,
      comentarios: (fbs || []).filter((f) => (f.teacher_comment || "").trim()).length,
    },
    hayActividad: conversaciones.length > 0,
  };

  return { ...base, titular: elegirTitular(base) };
}

function vacio(nombre: string): Omit<WeeklyReportData, "titular"> {
  return {
    establecimiento: nombre,
    generadoEl: new Date().toISOString(),
    totales: {
      alumnos: 0, ingresaron: 0, practicaron: 0, sesiones: 0, minutosMediana: 0,
      mensajesMediana: 0, conDevolucion: 0, horasTotales: 0, evaluaciones: 0, sesionesUltimos7: 0,
    },
    secciones: [], competencias: [], devolucion: [],
    longitudinal: { alumnos: 0, mejoraron: 0, empeoraron: 0, medianaCambio: 0, filas: [] },
    edicionDocente: { evaluaciones: 0, notasAjustadas: 0, comentarios: 0 },
    hayActividad: false,
  };
}
