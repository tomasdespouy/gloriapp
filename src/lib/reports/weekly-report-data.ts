import type { SupabaseClient } from "@supabase/supabase-js";
import { cappedActiveSeconds } from "@/lib/active-seconds";
import { countMessagesByConversation } from "@/lib/message-counts";
import { COMPETENCY_INFO } from "@/lib/competency-definitions";
import { RUBRIC_VERSION } from "@/lib/evaluation-prompt";

/**
 * Datos del informe semanal de uso, para una institución.
 *
 * Todo lo que el informe muestra se calcula acá y se devuelve como cifras ya
 * resueltas. El generador del .docx no vuelve a consultar la base: así el
 * documento y la foto que queda guardada en report_runs.snapshot son
 * exactamente lo mismo.
 *
 * Versión 2 (21-sep-2026). La primera versión nació copiando un informe
 * manual temprano y quedó más delgada que el que después se escribió a mano
 * para UPC y USS. Esta incorpora lo que de ese informe es CÁLCULO (embudo,
 * ritmo por sesión, anexo de la rúbrica, próximos pasos por reglas) y deja
 * afuera lo que es JUICIO: esa parte entra como texto revisado por una persona
 * (ver `lectura` en weekly-report-docx), nunca se inventa acá.
 *
 * Reglas que no son detalles (varias salieron de una verificación
 * adversarial del primer borrador contra producción):
 *
 *  - El 0 y el NA no son lo mismo. NULL es "no aplicaba" y se excluye; 0 es
 *    "había oportunidad y no la tomó", que es una nota real y se cuenta.
 *  - Una fila de session_competencies sin ai_original y con todo en 0 NO es
 *    una evaluación: la crea la plataforma cuando un docente aprueba una
 *    sesión que GlorIA nunca evaluó. Contarla hunde los promedios con ceros
 *    que nadie puso. Ver esRelleno.
 *  - La rúbrica cambió de escala en una competencia el 10-sep-2026 (v3.0 →
 *    v3.1, conducta no verbal). Esas notas no se mezclan entre versiones.
 *  - Conducta no verbal no entra en la comparación primera/última: su nota
 *    depende de cuántas señales muestre el paciente en cada sesión, y esa
 *    frecuencia cambia entre sesiones (entre el 10 y el 15-sep cayó del 58% al
 *    12% de los mensajes), así que la diferencia no mide al estudiante.
 *  - Nada de nombres de estudiantes, y ninguna cifra con menos de MIN_N casos
 *    presentada como estadística de grupo. Los docentes aparecen solo en la
 *    tabla de su sección, nunca en el titular.
 *  - Ninguna frase afirma algo que no salga de los datos de esta institución.
 */

export const INFORME_VERSION = 2;

const CLAVES = [
  "setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos",
  "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia",
  "conducta_no_verbal", "contencion_afectos",
] as const;

export const COMPETENCIAS: { key: string; label: string; dominio: string }[] = CLAVES.map((key) => ({
  key,
  label: COMPETENCY_INFO[key]?.name ?? key,
  dominio: COMPETENCY_INFO[key]?.domain === "estructura" ? "Estructura" : "Actitudes",
}));

/**
 * Desde qué versión de la rúbrica es comparable cada competencia con la
 * escala vigente. Las que no figuran son comparables en todas las versiones.
 * Con hora: una fecha sola se lee como medianoche UTC, que en Chile todavía es
 * el día anterior. 15:00 UTC es la primera evaluación v3.1.
 */
const COMPARABLE_DESDE: Record<string, { version: string; fecha: string }> = {
  conducta_no_verbal: { version: "v3.1", fecha: "2026-09-10T15:00:00Z" },
};

/** Competencias que no entran en la comparación primera/última. Ver arriba. */
const FUERA_DE_LONGITUDINAL = new Set(["conducta_no_verbal"]);

/** Desde cuándo existe conversations.paste_count (migración 20260910120000).
 *  Antes, el 0 es el valor por defecto de la columna, no una medición. */
const PEGADO_DESDE = "2026-09-10T12:00:00Z";

/**
 * Cuentas del equipo GlorIA creadas DENTRO de una institución para probar el
 * flujo. No son alumnos ni docentes: si cuentan, el informe no cuadra con la
 * lista de curso de la institución.
 */
const CUENTA_INTERNA = /smoketest|tomasdespouy|@glor-ia\.com$/i;

/** Mínimo de casos para mostrar un promedio o una mediana. */
const MIN_N = 5;

/** Una sesión más corta que esto no es comparable con otra: suele ser una
 *  sesión abandonada, y compararla fabrica "mejoras" que no ocurrieron. */
const MIN_MENSAJES_COMPARABLE = 12;

/** Mismo criterio que /api/cron/sweep-evals: por debajo de ambos umbrales, la
 *  sesión no se evalúa por diseño y no cuenta como sesión con contenido. */
const CON_CONTENIDO_SEGUNDOS = 300;
const CON_CONTENIDO_MENSAJES = 6;

const DIA = 86_400_000;

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Embudo = {
  alumnos: number;
  credenciales: number;
  ingresaron: number;
  activaron: number;
  practicaron: number;
  conDevolucion: number;
};

export type FilaSeccion = {
  nombre: string;
  alumnos: number;
  ingresaron: number;
  practicaron: number;
  conDevolucion: number;
  sesiones: number;
  sesionesSemana: number;
};

export type FilaRitmo = {
  etiqueta: string;
  sesiones: number;
  estudiantes: number;
  /** null cuando hay menos de MIN_N sesiones: con menos, describe personas. */
  minutosMediana: number | null;
  mensajesMediana: number | null;
};

export type FilaCompetencia = {
  key: string;
  label: string;
  dominio: string;
  promedio: number | null;
  n: number;
  /** true si el promedio usa solo evaluaciones con la escala vigente. */
  soloEscalaVigente: boolean;
};

export type FilaDevolucion = {
  seccion: string;
  supervision: string;
  evaluaciones: number;
  aprobadas: number;
  pendientes: number;
  pendienteMasAntiguaDias: number | null;
  /** Días que espera el estudiante desde que cierra la sesión hasta que su
   *  devolución se aprueba; para las pendientes, hasta hoy. null bajo MIN_N. */
  esperaMediana: number | null;
  sinEvaluacion: number;
};

export type FilaLongitudinal = {
  key: string;
  label: string;
  primera: number;
  ultima: number;
  cambio: number;
  n: number;
};

export type WeeklyReportData = {
  version: number;
  establecimiento: string;
  cursos: string[];
  generadoEl: string;
  ventana: { desde: string; hasta: string };
  rubrica: { vigente: string; cambios: { label: string; version: string; fecha: string }[] };
  totales: {
    alumnos: number;
    ingresaron: number;
    practicaron: number;
    conDevolucion: number;
    sesiones: number;
    sesionesUltimos7: number;
    sesionesSemanaAnterior: number;
    evaluaciones: number;
    pendientes: number;
    /** Estudiantes con al menos una evaluación pendiente. */
    estudiantesConPendientes: number;
    /** De ellos, los que no tienen ninguna devolución disponible. */
    estudiantesSinNinguna: number;
    horasTotales: number;
    ultimaSesion: string | null;
  };
  embudo: Embudo;
  secciones: FilaSeccion[];
  ritmo: FilaRitmo[];
  competencias: FilaCompetencia[];
  devolucion: FilaDevolucion[];
  edicionDocente: { aprobadas: number; notasAjustadas: number; comentarios: number };
  longitudinal: {
    pares: number;
    mejoraron: number;
    empeoraron: number;
    medianaCambio: number;
    filas: FilaLongitudinal[];
    excluidosPorLargo: number;
  };
  seguridad: {
    alertasPendientes: { tipo: string; n: number }[];
    sesionesAntiprofesional: number;
    sesionesConPegado: number;
    /** Sesiones posteriores a PEGADO_DESDE: las únicas donde el pegado se mide. */
    sesionesMedidasPegado: number;
    pegadoDesde: string;
  };
  proximosPasos: string[];
  /** Frase de portada, derivada de los datos. Ver elegirTitular. */
  titular: { texto: string; detalle: string };
  hayActividad: boolean;
};

// ── Utilidades ───────────────────────────────────────────────────────────────

const mediana = (a: number[]): number => {
  if (!a.length) return 0;
  const x = [...a].sort((p, q) => p - q);
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long" });

const versionNum = (v: unknown): number => {
  const m = /v?(\d+)\.(\d+)/.exec(String(v ?? ""));
  return m ? Number(m[1]) + Number(m[2]) / 10 : 0;
};

/** ¿La nota de esta competencia, en esta evaluación, está en la escala vigente? */
const escalaVigente = (key: string, version: unknown) =>
  !COMPARABLE_DESDE[key] || versionNum(version) >= versionNum(COMPARABLE_DESDE[key].version);

const leerOriginal = (raw: unknown): { rubric_version?: string; scores?: Record<string, number> } | null => {
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw as never); } catch { return null; }
};

/** Orden natural: "Sección 9" antes que "Sección 10". Fijo entre semanas. */
const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
  a.nombre.localeCompare(b.nombre, "es", { numeric: true });

const ETIQUETA_ALERTA: Record<string, string> = {
  self_harm: "Posible riesgo de autolesión",
  violence: "Violencia",
  abuse: "Maltrato",
  disrespect: "Falta de respeto",
  substance: "Consumo de sustancias",
  sexual: "Contenido sexual",
};

// ── Titular y próximos pasos: reglas, no redacción ───────────────────────────

type Base = Omit<WeeklyReportData, "titular" | "proximosPasos">;

/**
 * El titular sale del cuello de botella más grande que muestran los datos.
 * El orden de las preguntas importa: de nada sirve hablar de competencias si
 * nadie ha entrado todavía. Nunca nombra personas. Las oraciones empiezan con
 * palabras, no con cifras.
 */
function elegirTitular(d: Base): { texto: string; detalle: string } {
  const t = d.totales;
  const nunca = d.embudo.credenciales - d.embudo.ingresaron;

  if (t.sesiones === 0) {
    return {
      texto: `Todavía no hay sesiones: ${t.ingresaron} de ${t.alumnos} estudiantes ${t.ingresaron === 1 ? "ha ingresado" : "han ingresado"} a la plataforma.`,
      detalle: nunca > 0
        ? `Hay ${plural(nunca, "estudiante con credenciales enviadas que no ha", "estudiantes con credenciales enviadas que no han")} ingresado nunca.`
        : "Todos los estudiantes con credenciales ya ingresaron; falta la primera sesión.",
    };
  }

  if (t.sesionesUltimos7 === 0 && t.ultimaSesion) {
    return {
      texto: `Sin sesiones nuevas desde el ${fechaCorta(t.ultimaSesion)}: ${t.practicaron} de ${t.alumnos} estudiantes ${t.practicaron === 1 ? "ha practicado" : "han practicado"} al menos una vez.`,
      detalle: t.pendientes > 0
        ? `Quedan ${plural(t.pendientes, "evaluación", "evaluaciones")} esperando revisión docente.`
        : "La revisión docente está al día: no hay evaluaciones esperando.",
    };
  }

  const conPend = d.devolucion.filter((x) => x.pendientes > 0).sort((a, b) => b.pendientes - a.pendientes);
  if (t.pendientes >= MIN_N && conPend.length) {
    const peor = conPend[0];
    const antigua = peor.pendienteMasAntiguaDias;
    return {
      texto: `Hay ${t.pendientes} evaluaciones esperando revisión docente, de ${t.estudiantesConPendientes} estudiantes; ${t.estudiantesSinNinguna} de ellos todavía no tienen ninguna retroalimentación disponible.`,
      detalle: `${conPend.length === 1 ? "Todas son" : `La mayor parte (${peor.pendientes}) es`} de la ${peor.seccion}${antigua !== null ? `, y la más antigua lleva ${plural(antigua, "día", "días")} esperando` : ""}. GlorIA propone la evaluación al cerrar la sesión; el estudiante la ve cuando su docente la aprueba.`,
    };
  }

  const dormidas = d.secciones.filter((s) => s.alumnos >= MIN_N && s.practicaron / s.alumnos < 0.5);
  if (dormidas.length) {
    const peor = [...dormidas].sort((a, b) => a.practicaron / a.alumnos - b.practicaron / b.alumnos)[0];
    return {
      texto: `En la ${peor.nombre}, ${peor.practicaron} de ${peor.alumnos} estudiantes tienen al menos una sesión.`,
      detalle: `En toda la institución, ${t.practicaron} de ${t.alumnos} ya practicaron.`,
    };
  }

  return {
    texto: `De ${t.alumnos} estudiantes, ${t.conDevolucion} ya tienen su retroalimentación disponible, sobre ${plural(t.sesiones, "sesión", "sesiones")} acumuladas.`,
    detalle: `En los últimos siete días hubo ${plural(t.sesionesUltimos7, "sesión nueva", "sesiones nuevas")}${t.pendientes ? ` y quedan ${plural(t.pendientes, "evaluación", "evaluaciones")} por revisar` : " y no hay evaluaciones esperando revisión"}.`,
  };
}

/**
 * Sugerencias por reglas, en el orden del recorrido del estudiante: primero
 * lo que impide entrar, después lo que impide practicar, después lo que
 * impide ver la devolución. Solo afirman lo que los datos muestran, y
 * distinguen un problema de acceso (se resuelve reenviando la clave) de uno
 * de agenda (se resuelve en clase).
 */
function elegirPasos(d: Base, sinActivar: number, conSegunda: number): string[] {
  const pasos: string[] = [];
  const e = d.embudo;
  const t = d.totales;

  const nunca = e.credenciales - e.ingresaron;
  if (nunca > 0) {
    pasos.push(`Hay ${plural(nunca, "estudiante con credenciales enviadas que no ha", "estudiantes con credenciales enviadas que no han")} ingresado nunca. No tenemos confirmación de que el correo les haya llegado; si nos lo piden, reenviamos el acceso a esa lista.`);
  }

  if (sinActivar > 0) {
    const uno = sinActivar === 1;
    pasos.push(`Hay ${plural(sinActivar, "estudiante que ingresó, pero no completó", "estudiantes que ingresaron, pero no completaron")} la activación de su cuenta (${uno ? "sigue" : "siguen"} con la clave temporal). Suele ser un problema de acceso, no de agenda: podemos ${uno ? "reenviarle" : "reenviarles"} la clave.`);
  }

  const sinPractica = e.activaron - e.practicaron;
  if (sinPractica > 0) {
    pasos.push(`Hay ${plural(sinPractica, "estudiante que activó su cuenta, pero aún no ha hecho", "estudiantes que activaron su cuenta, pero aún no han hecho")} su primera sesión. Una opción es agendar esa primera práctica dentro de un bloque de clase.`);
  }

  const conPend = d.devolucion.filter((x) => x.pendientes > 0).sort((a, b) => b.pendientes - a.pendientes);
  const antigua = (x: FilaDevolucion) =>
    x.pendienteMasAntiguaDias !== null ? `la más antigua lleva ${plural(x.pendienteMasAntiguaDias, "día", "días")}` : "";
  if (conPend.length === 1) {
    const x = conPend[0];
    pasos.push(`${x.pendientes === 1 ? "La evaluación por revisar es" : `Las ${x.pendientes} evaluaciones por revisar son`} de la ${x.seccion}${antigua(x) ? `; ${antigua(x)}` : ""}. Mientras no se aprueben, esos estudiantes no tienen esa retroalimentación disponible.`);
  } else if (conPend.length > 1) {
    const detalle = conPend.map((x) => `${x.seccion}, ${x.pendientes}${antigua(x) ? ` (${antigua(x)})` : ""}`).join("; ");
    pasos.push(`Hay ${plural(t.pendientes, "evaluación esperando", "evaluaciones esperando")} revisión docente: ${detalle}.`);
  }

  if (t.practicaron >= MIN_N && conSegunda === 0) {
    pasos.push("Todavía nadie tiene una segunda sesión: sin ella no hay forma de ver cómo cambia la práctica de cada estudiante.");
  }

  return pasos;
}

// ── Cálculo ──────────────────────────────────────────────────────────────────

type Conv = {
  id: string; student_id: string; status: string; created_at: string;
  active_seconds: number | null; started_at: string | null; ended_at: string | null;
  paste_count: number | null; unprofessional_count: number | null;
};
type Ev = Record<string, unknown> & {
  conversation_id: string; student_id: string; feedback_status: string;
  created_at: string; approved_at: string | null; ai_original: unknown;
};

/**
 * Fila creada por la plataforma al aprobar una sesión que GlorIA nunca
 * evaluó: sin ai_original y con las 10 competencias en 0. No es una
 * evaluación y no entra en ninguna cifra de notas ni de devolución.
 */
const esRelleno = (e: Ev) =>
  !e.ai_original && CLAVES.every((k) => e[k] === 0 || e[k] === null || e[k] === undefined);

export async function buildWeeklyReportData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  establishmentId: string,
  ahora: Date = new Date(),
): Promise<WeeklyReportData> {
  const tAhora = ahora.getTime();
  const hace7 = tAhora - 7 * DIA;
  const hace14 = tAhora - 14 * DIA;

  const { data: est } = await admin
    .from("establishments").select("name").eq("id", establishmentId).maybeSingle();

  const { data: perfiles } = await admin
    .from("profiles")
    .select("id, full_name, email, role, section_id, course_id, credentials_sent_at, must_change_password")
    .eq("establishment_id", establishmentId);

  const alumnos = (perfiles || []).filter((p) => p.role === "student" && !CUENTA_INTERNA.test(p.email || ""));
  const docentes = (perfiles || []).filter((p) => p.role === "instructor" && !CUENTA_INTERNA.test(p.email || ""));

  const { data: cursosEst } = await admin
    .from("courses").select("id, name").eq("establishment_id", establishmentId);
  const cursoIds = (cursosEst || []).map((c) => c.id);
  const { data: secciones } = cursoIds.length
    ? await admin.from("sections").select("id, name, course_id").in("course_id", cursoIds)
    : { data: [] as { id: string; name: string; course_id: string }[] };

  const cursos = (cursosEst || [])
    .filter((c) => alumnos.some((a) => a.course_id === c.id))
    .map((c) => c.name);

  const ids = alumnos.map((a) => a.id);

  const { data: ls } = ids.length
    ? await admin.rpc("auth_last_sign_in", { p_ids: ids })
    : { data: [] };
  const ingreso = new Map(
    ((ls || []) as { user_id: string; last_sign_in_at: string | null }[]).map((x) => [x.user_id, x.last_sign_in_at]),
  );

  const { data: convsRaw } = ids.length
    ? await admin
        .from("conversations")
        .select("id, student_id, status, created_at, active_seconds, started_at, ended_at, paste_count, unprofessional_count")
        .in("student_id", ids)
        // Piloto de voz (A-05/AC-20): fuera de reportes institucionales.
        .eq("modality", "text")
    : { data: [] };
  const convs = (convsRaw || []) as Conv[];
  const convIds = convs.map((c) => c.id);
  const convDe = new Map(convs.map((c) => [c.id, c]));

  const { data: compsRaw } = convIds.length
    ? await admin.from("session_competencies").select("*").in("conversation_id", convIds)
    : { data: [] };
  // Solo las evaluaciones que GlorIA hizo de verdad. Ver esRelleno.
  const evals = ((compsRaw || []) as Ev[]).filter((e) => !esRelleno(e));
  const evalDe = new Map(evals.map((e) => [e.conversation_id, e]));

  const { data: fbs } = convIds.length
    ? await admin.from("session_feedback").select("conversation_id, teacher_comment").in("conversation_id", convIds)
    : { data: [] };

  const { data: alertasRaw } = convIds.length
    ? await admin.from("chat_alerts").select("kind, conversation_id").is("reviewed_at", null).in("conversation_id", convIds)
    : { data: [] };

  const cuenta = convIds.length ? await countMessagesByConversation(admin, convIds) : new Map<string, number>();
  const conContenido = (c: Conv) =>
    (c.active_seconds || 0) >= CON_CONTENIDO_SEGUNDOS || (cuenta.get(c.id) || 0) >= CON_CONTENIDO_MENSAJES;

  const visible = (e: Ev) => ["approved", "evaluated"].includes(e.feedback_status);
  const conDevolucion = new Set(evals.filter(visible).map((e) => e.student_id));
  const practico = new Set(convs.map((c) => c.student_id));

  // ── Embudo ─────────────────────────────────────────────────────────────────
  const embudo: Embudo = {
    alumnos: alumnos.length,
    credenciales: alumnos.filter((a) => a.credentials_sent_at).length,
    ingresaron: alumnos.filter((a) => ingreso.get(a.id)).length,
    activaron: alumnos.filter((a) => ingreso.get(a.id) && !a.must_change_password).length,
    practicaron: alumnos.filter((a) => practico.has(a.id)).length,
    conDevolucion: alumnos.filter((a) => conDevolucion.has(a.id)).length,
  };
  const sinActivar = alumnos.filter((a) => ingreso.get(a.id) && a.must_change_password && !practico.has(a.id)).length;

  // ── Por sección ────────────────────────────────────────────────────────────
  const filasSeccion: FilaSeccion[] = [];
  for (const sec of secciones || []) {
    const sa = alumnos.filter((a) => a.section_id === sec.id);
    if (!sa.length) continue;
    const set = new Set(sa.map((a) => a.id));
    const sc = convs.filter((c) => set.has(c.student_id));
    filasSeccion.push({
      nombre: sec.name,
      alumnos: sa.length,
      ingresaron: sa.filter((a) => ingreso.get(a.id)).length,
      practicaron: sa.filter((a) => practico.has(a.id)).length,
      conDevolucion: sa.filter((a) => conDevolucion.has(a.id)).length,
      sesiones: sc.length,
      sesionesSemana: sc.filter((c) => Date.parse(c.created_at) >= hace7).length,
    });
  }
  filasSeccion.sort(porNombre);

  // ── Ritmo: primera, segunda, tercera o más, por orden real de cada alumno ──
  // Solo sesiones con contenido (un intento de dos minutos no es "la primera
  // sesión"), ordenadas por fecha: session_number no siempre coincide con el
  // orden en que ocurrieron.
  const ordinal = new Map<string, number>();
  const porAlumnoConv: Record<string, Conv[]> = {};
  for (const c of convs.filter(conContenido)) (porAlumnoConv[c.student_id] ||= []).push(c);
  for (const lista of Object.values(porAlumnoConv)) {
    lista.sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((c, i) => ordinal.set(c.id, i + 1));
  }
  const conSegunda = Object.values(porAlumnoConv).filter((l) => l.length >= 2).length;
  const ritmo: FilaRitmo[] = [
    { etiqueta: "Primera", f: (n: number) => n === 1 },
    { etiqueta: "Segunda", f: (n: number) => n === 2 },
    { etiqueta: "Tercera o más", f: (n: number) => n >= 3 },
  ].map(({ etiqueta, f }) => {
    const g = convs.filter((c) => ordinal.has(c.id) && f(ordinal.get(c.id) as number));
    const suficiente = g.length >= MIN_N;
    return {
      etiqueta,
      sesiones: g.length,
      estudiantes: new Set(g.map((c) => c.student_id)).size,
      minutosMediana: suficiente ? r1(mediana(g.map(cappedActiveSeconds).filter((x) => x > 0)) / 60) : null,
      mensajesMediana: suficiente ? Math.round(mediana(g.map((c) => cuenta.get(c.id) || 0))) : null,
    };
  }).filter((x) => x.sesiones > 0);

  // ── Perfil de competencias ─────────────────────────────────────────────────
  const competencias: FilaCompetencia[] = COMPETENCIAS.map((c) => {
    const vals = evals
      .filter((e) => escalaVigente(c.key, leerOriginal(e.ai_original)?.rubric_version))
      .map((e) => e[c.key])
      .filter((v): v is number => typeof v === "number");
    return {
      key: c.key, label: c.label, dominio: c.dominio,
      promedio: vals.length ? r2(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      n: vals.length,
      soloEscalaVigente: Boolean(COMPARABLE_DESDE[c.key]),
    };
  });

  // ── Ciclo de devolución ────────────────────────────────────────────────────
  const seccionDe = new Map(alumnos.map((a) => [a.id, a.section_id]));
  const cierreDe = (e: Ev) => {
    const c = convDe.get(e.conversation_id);
    return Date.parse(c?.ended_at || c?.created_at || e.created_at);
  };
  const devolucion: FilaDevolucion[] = [];
  for (const sec of [...(secciones || [])].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))) {
    if (!alumnos.some((a) => a.section_id === sec.id)) continue;
    const evs = evals.filter((e) => seccionDe.get(e.student_id) === sec.id);
    const pendientes = evs.filter((e) => e.feedback_status === "pending");
    // Espera desde que el estudiante cierra la sesión, no desde que se creó la
    // fila: una reevaluación tardía parecería una aprobación instantánea. Las
    // pendientes cuentan lo que llevan esperando hasta hoy.
    const esperas = evs
      .map((e) => (visible(e) && e.approved_at ? Date.parse(String(e.approved_at)) : e.feedback_status === "pending" ? tAhora : NaN) - cierreDe(e))
      .filter((x) => Number.isFinite(x) && x >= 0)
      .map((x) => x / DIA);
    const masAntigua = pendientes.length
      ? Math.round((tAhora - Math.min(...pendientes.map(cierreDe))) / DIA)
      : null;
    // Supervisión: el docente de la sección; si no hay, los del curso que no
    // tienen sección (supervisan la asignatura entera).
    const deSeccion = docentes.filter((d) => d.section_id === sec.id);
    const deCurso = docentes.filter((d) => !d.section_id && d.course_id === sec.course_id);
    const sup = (deSeccion.length ? deSeccion : deCurso).map((d) => d.full_name).filter(Boolean);
    const setSec = new Set(alumnos.filter((a) => a.section_id === sec.id).map((a) => a.id));
    const sinEvaluacion = convs.filter((c) =>
      setSec.has(c.student_id) && c.status === "completed" && !evalDe.has(c.id) && conContenido(c),
    ).length;
    devolucion.push({
      seccion: sec.name,
      supervision: sup.length ? sup.join(" · ") : "—",
      evaluaciones: evs.length,
      aprobadas: evs.filter(visible).length,
      pendientes: pendientes.length,
      pendienteMasAntiguaDias: masAntigua,
      esperaMediana: esperas.length >= MIN_N ? r1(mediana(esperas)) : null,
      sinEvaluacion,
    });
  }

  // ── Cuánto corrige el docente la propuesta de GlorIA ───────────────────────
  const aprobadas = evals.filter(visible);
  let notasAjustadas = 0;
  for (const e of aprobadas) {
    const sc = leerOriginal(e.ai_original)?.scores || {};
    if (CLAVES.some((k) => sc[k] != null && e[k] != null && Number(sc[k]) !== Number(e[k]))) notasAjustadas++;
  }
  const idsAprobadas = new Set(aprobadas.map((e) => e.conversation_id));
  const comentarios = ((fbs || []) as { conversation_id: string; teacher_comment: string | null }[])
    .filter((f) => idsAprobadas.has(f.conversation_id) && (f.teacher_comment || "").trim()).length;

  // ── Longitudinal: primera contra última, comparables ───────────────────────
  // Primera y última evaluación de cada estudiante entre sus sesiones con
  // largo suficiente. Cada competencia se compara solo si las dos notas están
  // en la escala vigente; conducta no verbal queda fuera (ver encabezado). La
  // variación general de cada estudiante es el promedio de la variación de sus
  // competencias comparables, no la resta de overall_score_v2, que incluye
  // conducta no verbal y mezcla escalas.
  const fechaConv = new Map(convs.map((c) => [c.id, c.created_at]));
  const evPorAlumno: Record<string, Ev[]> = {};
  for (const e of evals) (evPorAlumno[e.student_id] ||= []).push(e);
  const pares: [Ev, Ev][] = [];
  let excluidosPorLargo = 0;
  for (const lista of Object.values(evPorAlumno)) {
    if (lista.length < 2) continue;
    const largas = lista
      .filter((e) => (cuenta.get(e.conversation_id) || 0) >= MIN_MENSAJES_COMPARABLE)
      .sort((a, b) => String(fechaConv.get(a.conversation_id)).localeCompare(String(fechaConv.get(b.conversation_id))));
    if (largas.length < 2) { excluidosPorLargo++; continue; }
    pares.push([largas[0], largas[largas.length - 1]]);
  }
  const comparable = (key: string, a: Ev, b: Ev) =>
    !FUERA_DE_LONGITUDINAL.has(key) &&
    escalaVigente(key, leerOriginal(a.ai_original)?.rubric_version) &&
    escalaVigente(key, leerOriginal(b.ai_original)?.rubric_version);
  const notaPar = (key: string, a: Ev, b: Ev): [number, number] | null =>
    typeof a[key] === "number" && typeof b[key] === "number" && comparable(key, a, b)
      ? [a[key] as number, b[key] as number] : null;

  const deltas: number[] = [];
  for (const [a, b] of pares) {
    const d = CLAVES.map((k) => notaPar(k, a, b)).filter((x): x is [number, number] => x !== null);
    if (d.length) deltas.push(d.reduce((s, [x, y]) => s + (y - x), 0) / d.length);
  }
  const filasLong: FilaLongitudinal[] = [];
  for (const c of COMPETENCIAS) {
    const pp = pares.map(([a, b]) => notaPar(c.key, a, b)).filter((x): x is [number, number] => x !== null);
    if (pp.length < MIN_N) continue;
    const p1 = pp.reduce((s, [a]) => s + a, 0) / pp.length;
    const p2 = pp.reduce((s, [, b]) => s + b, 0) / pp.length;
    filasLong.push({ key: c.key, label: c.label, primera: r2(p1), ultima: r2(p2), cambio: r2(p2 - p1), n: pp.length });
  }
  filasLong.sort((a, b) => b.cambio - a.cambio);

  // ── Seguridad y uso ────────────────────────────────────────────────────────
  const porTipo: Record<string, number> = {};
  for (const a of (alertasRaw || []) as { kind: string }[]) {
    const k = ETIQUETA_ALERTA[a.kind] || a.kind;
    porTipo[k] = (porTipo[k] || 0) + 1;
  }
  const medidasPegado = convs.filter((c) => c.created_at >= PEGADO_DESDE);

  // ── Pendientes por estudiante ──────────────────────────────────────────────
  const conPendiente = new Set(evals.filter((e) => e.feedback_status === "pending").map((e) => e.student_id));

  // ── Totales ────────────────────────────────────────────────────────────────
  const segs = convs.map(cappedActiveSeconds).filter((x) => x > 0);
  const fechas = convs.map((c) => c.created_at).sort();
  const ultima = fechas.length ? fechas[fechas.length - 1] : null;

  const base: Base = {
    version: INFORME_VERSION,
    establecimiento: est?.name || "Institución",
    cursos,
    generadoEl: ahora.toISOString(),
    ventana: { desde: new Date(hace7).toISOString(), hasta: ahora.toISOString() },
    rubrica: {
      vigente: RUBRIC_VERSION,
      cambios: Object.entries(COMPARABLE_DESDE).map(([k, v]) => ({
        label: COMPETENCY_INFO[k]?.name ?? k, version: v.version, fecha: v.fecha,
      })),
    },
    totales: {
      alumnos: alumnos.length,
      ingresaron: embudo.ingresaron,
      practicaron: embudo.practicaron,
      conDevolucion: embudo.conDevolucion,
      sesiones: convs.length,
      sesionesUltimos7: convs.filter((c) => Date.parse(c.created_at) >= hace7).length,
      sesionesSemanaAnterior: convs.filter((c) => {
        const t = Date.parse(c.created_at);
        return t >= hace14 && t < hace7;
      }).length,
      evaluaciones: evals.length,
      pendientes: evals.filter((e) => e.feedback_status === "pending").length,
      estudiantesConPendientes: conPendiente.size,
      estudiantesSinNinguna: [...conPendiente].filter((id) => !conDevolucion.has(id)).length,
      horasTotales: r1(segs.reduce((a, b) => a + b, 0) / 3600),
      ultimaSesion: ultima,
    },
    embudo,
    secciones: filasSeccion,
    ritmo,
    competencias,
    devolucion,
    edicionDocente: { aprobadas: aprobadas.length, notasAjustadas, comentarios },
    longitudinal: {
      pares: deltas.length,
      mejoraron: deltas.filter((x) => x > 0.05).length,
      empeoraron: deltas.filter((x) => x < -0.05).length,
      medianaCambio: r2(mediana(deltas)),
      filas: filasLong,
      excluidosPorLargo,
    },
    seguridad: {
      alertasPendientes: Object.entries(porTipo).map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
      sesionesAntiprofesional: convs.filter((c) => (c.unprofessional_count || 0) > 0).length,
      sesionesConPegado: medidasPegado.filter((c) => (c.paste_count || 0) > 0).length,
      sesionesMedidasPegado: medidasPegado.length,
      pegadoDesde: PEGADO_DESDE,
    },
    hayActividad: convs.length > 0,
  };

  return {
    ...base,
    titular: elegirTitular(base),
    proximosPasos: elegirPasos(base, sinActivar, conSegunda),
  };
}

export const REGLAS = { MIN_N, MIN_MENSAJES_COMPARABLE };
