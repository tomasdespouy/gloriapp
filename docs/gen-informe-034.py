"""
INF-2026-034 — Ajustes Pre-Piloto: Auto-enrollment, Consentimiento Digital,
                Logo del Piloto, Onboarding y Encuesta UGM
9 commits cerrados en una sola jornada para dejar GlorIA lista para los
pilotos institucionales con UBO (15 estudiantes) y U. Católica de
Arequipa (90 estudiantes).
"""
from fpdf import FPDF
import os

LOGO = r"C:\Users\tomas\documents\gloriapp\public\branding\gloria-logo.png"
OUTPUT_DIR = r"C:\Users\tomas\documents\gloriapp\informes\desarrollo"
OUTPUT = os.path.join(OUTPUT_DIR, "INF-2026-034_ajustes-pre-piloto-auto-enrollment-encuesta-ugm.pdf")

CALIBRI = r"C:\Windows\Fonts\calibri.ttf"
CALIBRI_B = r"C:\Windows\Fonts\calibrib.ttf"
CALIBRI_I = r"C:\Windows\Fonts\calibrii.ttf"

INF = "INF-2026-034"
TITLE_SHORT = "Ajustes Pre-Piloto"


class PDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("Calibri", "", CALIBRI, uni=True)
        self.add_font("Calibri", "B", CALIBRI_B, uni=True)
        self.add_font("Calibri", "I", CALIBRI_I, uni=True)

    def header(self):
        if os.path.exists(LOGO):
            self.image(LOGO, x=170, y=8, w=28)
        self.set_font("Calibri", "B", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, f"{INF}  |  {TITLE_SHORT}",
                  new_x="LMARGIN", new_y="NEXT")
        self.line(10, 16, 200, 16)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Calibri", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"GlorIA — Página {self.page_no()}/{{nb}}", align="C")

    def s(self, num, title):
        self.set_font("Calibri", "B", 14)
        self.set_text_color(74, 85, 162)
        self.cell(0, 10, f"{num}. {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(26, 26, 26)
        self.ln(2)

    def ss(self, title):
        self.set_font("Calibri", "B", 11)
        self.set_text_color(60, 60, 60)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(26, 26, 26)
        self.ln(1)

    def b(self, text):
        self.set_font("Calibri", "", 10)
        self.multi_cell(0, 5.2, text)
        self.ln(2)

    def bb(self, text):
        self.set_font("Calibri", "B", 10)
        self.multi_cell(0, 5.2, text)
        self.ln(1)

    def bi(self, text):
        self.set_font("Calibri", "I", 10)
        self.set_text_color(80, 80, 80)
        self.multi_cell(0, 5.2, text)
        self.set_text_color(26, 26, 26)
        self.ln(1)

    def bullet(self, text):
        self.set_font("Calibri", "", 10)
        self.cell(6, 5.2, "\u2022")
        self.multi_cell(0, 5.2, text)
        self.ln(0.5)

    def code(self, text):
        self.set_fill_color(245, 245, 245)
        self.set_font("Calibri", "", 8.5)
        self.set_text_color(50, 50, 50)
        self.multi_cell(180, 4.5, text, fill=True)
        self.set_text_color(26, 26, 26)
        self.ln(2)

    def th(self, cols, widths):
        self.set_font("Calibri", "B", 8.5)
        self.set_fill_color(74, 85, 162)
        self.set_text_color(255, 255, 255)
        for i, col in enumerate(cols):
            self.cell(widths[i], 7, col, border=1, fill=True, align="C")
        self.ln()
        self.set_text_color(26, 26, 26)

    def tr(self, vals, widths, fill=False):
        self.set_font("Calibri", "", 8)
        if fill:
            self.set_fill_color(248, 248, 248)
        for i, val in enumerate(vals):
            self.cell(widths[i], 6, val, border=1, fill=fill)
        self.ln()


pdf = PDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# ─── TITLE ───
pdf.set_font("Calibri", "B", 22)
pdf.set_text_color(74, 85, 162)
pdf.cell(0, 12, "Ajustes Pre-Piloto", new_x="LMARGIN", new_y="NEXT", align="C")
pdf.cell(0, 12, "GlorIA × UBO × Arequipa", new_x="LMARGIN", new_y="NEXT", align="C")
pdf.set_font("Calibri", "B", 13)
pdf.cell(0, 8, "Auto-enrollment, consentimiento digital, encuesta UGM y onboarding",
         new_x="LMARGIN", new_y="NEXT", align="C")
pdf.set_text_color(26, 26, 26)
pdf.ln(8)

# ─── METADATA ───
meta = [
    ("Informe N°", INF),
    ("Fecha", "2026-04-09"),
    ("Categoría", "Desarrollo"),
    ("Prioridad", "Alta — Preparación piloto institucional"),
    ("Plataforma", "GlorIA 5.0"),
    ("Pilotos objetivo", "UBO (15 estudiantes) + U. Católica Arequipa (90)"),
    ("Commits", "9d57bc7 → 5fbd511 (9 commits)"),
    ("Stack", "Next.js 16 + Supabase + Vercel"),
    ("Resultado final", "17 de 17 ajustes cerrados"),
    ("Autor", "Tomás Despouy + Claude (IA)"),
    ("Dirigido a", "Coordinadores de pilotos UGM, equipo IDEA"),
]
for label, val in meta:
    pdf.set_font("Calibri", "B", 10)
    pdf.cell(50, 6, f"{label}:", new_x="RIGHT")
    pdf.set_font("Calibri", "", 10)
    pdf.cell(0, 6, val, new_x="LMARGIN", new_y="NEXT")
pdf.ln(6)

# ═══════════════════════════════════════
# 1. SOLICITUD
# ═══════════════════════════════════════
pdf.s("1", "Registro de la Solicitud")
pdf.b(
    "El usuario solicitó preparar GlorIA para un ciclo de tres pilotos institucionales "
    "que se ejecutarán durante las próximas semanas. La premisa central fue eliminar "
    "el flujo manual existente de carga CSV + envío masivo de invitaciones, y "
    "reemplazarlo por un mecanismo de auto-inscripción donde cada participante "
    "firma su propio consentimiento informado digital y recibe credenciales en "
    "automático, sin que el equipo central tenga que conocer todos los correos por "
    "adelantado."
)
pdf.bb("Cita literal del usuario (resumida):")
pdf.bi(
    "\u201CSi quieres puedes hacer una propuesta de cómo crees que sería el flujo "
    "más limpio... me gustaría poder incorporar un logo dentro del piloto y que "
    "ese logo, también estuviera al momento de entrar a GlorIA, tal como hicimos "
    "con las universidades... también quiero una encuesta automática post-evaluación "
    "y poder exportar los resultados para mandárselos a la UGM.\u201D"
)
pdf.b(
    "Durante la jornada de testeo del primer flujo, el usuario reportó adicionalmente "
    "17 hallazgos (etiquetados a a q) que cubrían bugs de UI, inconsistencias del "
    "personaje virtual Lucía, problemas de display de progreso, ausencia de tour "
    "de chat, configuración de logo, etiquetas de email, etc. El alcance del informe "
    "abarca tanto el flujo nuevo construido desde cero como las correcciones "
    "incrementales sobre componentes existentes."
)

# ═══════════════════════════════════════
# 2. RESUMEN EJECUTIVO
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("2", "Resumen Ejecutivo")
pdf.b(
    "GlorIA quedó lista para operar pilotos institucionales sin intervención manual "
    "del equipo central por participante. La pieza estructural es el flujo de "
    "auto-inscripción con consentimiento digital, complementado por logo "
    "personalizable por piloto, encuesta de experiencia automática post-evaluación "
    "y exportación CSV de resultados. Adicionalmente se cerraron 17 hallazgos de "
    "UX y consistencia detectados durante el testeo del flujo."
)
pdf.bb("Estado final: 9 commits, 17 hallazgos cerrados, 3 migraciones nuevas, 0 deuda crítica.")

pdf.ln(3)
pdf.ss("Tabla de commits aplicados (cronológica)")
pdf.th(["Hash", "Bloque", "Resumen", "Líneas"],
       [22, 32, 100, 18])
commits = [
    ("9d57bc7", "Bloque 1",  "Self-enrollment + consent + test mode",        "+1730"),
    ("abcfe28", "Polish",    "Panel arriba + auto-sync institución",         "+56"),
    ("c4f7d8e", "Fase 1",    "7 fixes consent flow + asistente",             "+64"),
    ("f6a9de5", "Fase 3",    "6 bugs plataforma (Lucía, progreso, tutor)",   "+146"),
    ("ae3513f", "Fase 2",    "Logo del piloto (URL) sidebar+consent+email",  "+137"),
    ("17afab8", "Fase 4",    "Onboarding (encuesta auto + tour + reset)",    "+172"),
    ("ceb5671", "Survey UGM","Replica MS Form 1:1 (10 preguntas)",           "+456"),
    ("64519ee", "Export",    "CSV named + anonymized survey responses",      "+270"),
    ("5fbd511", "CSV opt",   "CSV de pre-carga ahora opcional",              "+16"),
]
for i, r in enumerate(commits):
    pdf.tr(r, [22, 32, 100, 18], fill=(i % 2 == 0))
pdf.ln(3)

pdf.ss("Distribución por tipo de cambio")
pdf.bullet("Funcionalidad nueva: 5 (self-enrollment, consent panel, logo del piloto, encuesta auto post-eval, export CSV)")
pdf.bullet("Bugs cerrados: 13 (a-q sin h y i que son features)")
pdf.bullet("Mejoras de UX: 4 (panel arriba, auto-sync institución, tour expandido, CSV opcional)")
pdf.bullet("Migraciones Supabase: 3 (pilot_consents, pilot_logo_url, survey_responses_answers)")
pdf.bullet("Endpoints API nuevos: 3 (/api/public/pilot-enroll/[slug], /api/admin/pilots/[id]/participants/[pid]/reset, /api/admin/pilots/[id]/survey-responses)")
pdf.bullet("Componentes nuevos: 2 (PilotConsentPanel, EnrollmentClient)")
pdf.bullet("Componentes reescritos: 1 (SurveyModal con la encuesta UGM completa)")

# ═══════════════════════════════════════
# 3. ESTADO ANTERIOR
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("3", "Estado Anterior — Cómo Funcionaba Antes")

pdf.b(
    "Antes de esta jornada, el módulo de pilotos existía pero asumía un flujo "
    "manual centralizado: el equipo central (superadmin) cargaba un CSV con todos "
    "los participantes, validaba los emails, previsualizaba el correo de invitación "
    "y disparaba un envío masivo de credenciales. Cada participante recibía un "
    "correo con email + contraseña temporal, sin firmar nada, y entraba a la "
    "plataforma directamente."
)

pdf.ss("Limitaciones del flujo legacy")
pdf.bullet("El equipo central debía conocer todos los correos institucionales por adelantado, lo que requería coordinación con cada universidad antes de poder lanzar el piloto.")
pdf.bullet("No existía consentimiento informado digital. Los participantes recibían credenciales sin firmar nada, lo que no cumple con los estándares éticos para investigación con personas.")
pdf.bullet("No había trazabilidad legal: cero registro de IP, user agent, timestamp o snapshot del texto firmado.")
pdf.bullet("Cada universidad obtenía la misma identidad visual de GlorIA + logo UGM, sin posibilidad de mostrar su propia marca.")
pdf.bullet("La encuesta de experiencia post-evaluación era una idea pendiente: el componente SurveyModal existía pero usaba un schema NPS de 4 preguntas que no coincidía con el formulario que el equipo de UGM ya estaba usando externamente en Microsoft Forms.")
pdf.bullet("No existía manera de exportar las respuestas de la encuesta para entregárselas a las universidades.")
pdf.bullet("Múltiples bugs menores: Lucía contradiciendo su propio signo zodiacal, contador incorrecto de \u201CSesiones evaluadas\u201D en /progreso, tutor marcado como completado tras saltarlo, texto \u201CSube tu foto\u201D superpuesto al avatar, profile mostrando \u201CSin asignar\u201D tras enrollment, X duplicada del asistente, etc.")

pdf.ss("Componentes que sí existían y se reusaron")
pdf.bullet("Tabla pilots y pilot_participants con políticas RLS scopeadas a superadmin")
pdf.bullet("PilotosClient.tsx (~2200 líneas) con wizard de 5 steps")
pdf.bullet("Endpoint POST /api/admin/pilots/[id]/send-invites que crea auth.users via admin client")
pdf.bullet("Tablas surveys y survey_responses con scope por establishment")
pdf.bullet("Endpoint /api/surveys/active GET/POST")
pdf.bullet("Componentes SurveyModal y WelcomeVideoModal montados en (app)/layout.tsx")
pdf.bullet("Tabla establishments con columna logo_url ya existente")
pdf.bullet("Sidebar.tsx con prop establishmentLogoUrl ya soportado")
pdf.bullet("Sistema de tour del chat (2 steps) y flag localStorage gloria_chat_tour_done")

# ═══════════════════════════════════════
# 4. CAMBIOS REALIZADOS — BLOQUE 1
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("4", "Bloque 1 — Auto-enrollment + Consentimiento Digital")
pdf.bi("Commit: 9d57bc7 (1730 líneas, 11 archivos)")

pdf.ss("Migración Supabase")
pdf.bullet("Nueva tabla pilot_consents con columnas: id, pilot_id, pilot_participant_id, full_name, email, age, gender, role, university, signed_at, signed_name, signed_ip, signed_user_agent, consent_version, consent_text_snapshot, user_id")
pdf.bullet("Nuevas columnas en pilots: enrollment_slug (UNIQUE), consent_text, consent_version, test_mode")
pdf.bullet("RLS habilitada en pilot_consents (superadmin only) — los datos identificantes nunca son legibles por estudiantes ni docentes regulares")
pdf.bullet("Índice único parcial en enrollment_slug para asegurar unicidad sin afectar pilotos legacy con NULL")

pdf.ss("Página pública /piloto/[slug]/consentimiento")
pdf.bullet("Wizard de 3 pasos: datos personales (nombre, email, edad, género, rol, universidad) → consentimiento informado + firma tipográfica → confirmación")
pdf.bullet("Whitelist en src/lib/supabase/middleware.ts para que la página sea pública (no requiere auth)")
pdf.bullet("Validación cliente con regex + validación servidor con Zod (esquema pilotEnrollSchema)")
pdf.bullet("Manejo de pilotos en estado finalizado/cancelado/fuera de fechas con mensajes amigables")
pdf.bullet("Texto del consentimiento se renderiza desde pilot.consent_text editable, con fallback a un texto default")

pdf.ss("Endpoint POST /api/public/pilot-enroll/[slug]")
pdf.bullet("Validación Zod del payload completo")
pdf.bullet("Lookup del piloto por enrollment_slug + validación de status")
pdf.bullet("Verificación que la versión del consentimiento coincide con la actual (rechaza con 409 si el admin editó el texto mientras el usuario llenaba el form)")
pdf.bullet("Detección de email duplicado por piloto")
pdf.bullet("Creación de auth.user vía admin.auth.admin.createUser con metadata completa")
pdf.bullet("Insert en pilot_participants (o update si ya existía un row pre-cargado por CSV)")
pdf.bullet("Insert en pilot_consents con audit trail completo (IP via x-forwarded-for, user agent, timestamp, snapshot del texto)")
pdf.bullet("Email de credenciales via Resend O respuesta directa con credenciales si test_mode=true")
pdf.bullet("Rollback transaccional ad-hoc: si la inserción del consent falla, se borra el auth.user creado")

pdf.ss("Admin UI: PilotConsentPanel.tsx (componente nuevo)")
pdf.bullet("Botón copy-to-clipboard del link único del piloto")
pdf.bullet("Toggle test_mode con explicación inline")
pdf.bullet("Editor de texto del consentimiento (textarea con caracter count)")
pdf.bullet("Auto-bump de consent_version en cada save para invalidar consentimientos en vuelo")
pdf.bullet("Botón Reset por participante (visible solo en test_mode) que borra consent + auth user + vuelve a pendiente")
pdf.bullet("PATCH whitelist en /api/admin/pilots/[id] para evitar que cualquier campo se actualice por accidente")

pdf.bb("Verificación")
pdf.bullet("Comando: npx tsc --noEmit → 0 errores")
pdf.bullet("Comando: npx eslint sobre los 11 archivos nuevos/modificados → 0 errores, 0 warnings")
pdf.bullet("Comando: semgrep --config .semgrep.yml --error → 0 findings")
pdf.bullet("Inspección manual: el flujo se probó end to end con un piloto de testeo, firmando consentimiento en ventana incógnita y verificando que el row apareciera en pilot_consents con todos los campos de audit trail poblados")

# ═══════════════════════════════════════
# 5. CAMBIOS REALIZADOS — FASE 1
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("5", "Fase 1 — Polish del Consent Flow + Asistente")
pdf.bi("Commit: c4f7d8e (64 líneas, 6 archivos)")

pdf.b(
    "Siete fixes de UX detectados durante la primera vuelta de testeo del flujo de "
    "consentimiento. Pequeños individualmente pero críticos en conjunto para que el "
    "primer piloto real no genere fricción."
)

pdf.ss("Detalle de los 7 fixes")
fixes_f1 = [
    ("(a)", "Panel \u201CInscripción y Consentimiento\u201D arriba del wizard legacy + header prominente con icono y subtítulo. Antes estaba escondido dentro del Step 4, después del flujo CSV. Ahora es lo primero que ve el admin al abrir un piloto."),
    ("(b)", "Removida la opción \u201Cno binario\u201D del campo género en el formulario de consentimiento, por solicitud explícita del usuario para alinear con el alcance UBO/Arequipa."),
    ("(c)", "El campo \u201CFirma\u201D del consentimiento ahora usa el nombre completo tipeado en el paso 1 como placeholder gris. Reduce la fricción del \u201Cdebe coincidir exactamente\u201D sin debilitar la regla."),
    ("(e)", "Subject y H1 del correo de credenciales cambiados de \u201CBienvenido/a\u201D a \u201CTe damos la bienvenida a GlorIA\u201D, conforme al nuevo tono institucional."),
    ("(f)", "Logo del email reparado: antes apuntaba a una URL de bucket Supabase que devolvía 404. Ahora sirve desde /branding/gloria-logo.png en el dominio público de la app."),
    ("(g)", "Link \u201CPlataforma\u201D del email es ahora un CTA grande \u201CIngresar a GlorIA\u201D que va directo a /login (no a la home). La sección \u201CCómo ingresar\u201D fue eliminada porque mencionaba un cambio de contraseña obligatorio que la plataforma actualmente no implementa."),
    ("(l)", "El asistente GlorIA tenía dos botones X duplicados (uno en el header del modal y otro en el botón flotante grande del bottom-right). El flotante se ocultó cuando el chat está abierto."),
]
for label, text in fixes_f1:
    pdf.bullet(f"{label} {text}")

pdf.bb("Verificación")
pdf.bullet("npx tsc → 0 errores")
pdf.bullet("npx eslint → 0 errores, 0 warnings nuevos")
pdf.bullet("Inspección visual de cada fix con screenshots del usuario antes y después")

# ═══════════════════════════════════════
# 6. CAMBIOS REALIZADOS — FASE 2
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("6", "Fase 2 — Logo del Piloto en Sidebar, Consent Page y Email")
pdf.bi("Commit: ae3513f (137 líneas, 7 archivos)")

pdf.b(
    "Permitir que cada piloto cargue su propio logo institucional vía URL externa, "
    "sin tocar el logo del establecimiento en la base. Solicitud directa del usuario "
    "para poder mostrar el branding de cada universidad partner sin contaminar las "
    "filas de establishments."
)

pdf.ss("Cascada de fallback del logo en sidebar")
pdf.code(
    "pilot.logo_url       (override por piloto)\n"
    "        |  si NULL\n"
    "establishment.logo_url  (logo del establecimiento)\n"
    "        |  si NULL\n"
    "/branding/ugm-logo.png  (default UGM)"
)

pdf.ss("Cambios concretos")
pdf.bullet("Migración 20260408140000_pilot_logo_url.sql: ALTER TABLE pilots ADD COLUMN logo_url TEXT")
pdf.bullet("PATCH whitelist en /api/admin/pilots/[id] incluye logo_url")
pdf.bullet("Input URL en PilotConsentPanel.tsx con vista previa thumbnail en vivo + validación http(s)")
pdf.bullet("Lookup ampliado en (app)/layout.tsx: la query del piloto del usuario ya hacía enforcement de access window; ahora también captura logo_url y lo pasa como override al sidebar")
pdf.bullet("EnrollmentClient.tsx muestra el logo del piloto en formato \u201CGlorIA × Universidad\u201D al tope de la página de consentimiento")
pdf.bullet("Email de credenciales muestra el mismo formato dual cuando logo_url está set")

pdf.bb("Verificación")
pdf.bullet("Schema verificado en información_schema.columns post-migración")
pdf.bullet("npx tsc → 0 errores; npx eslint → 0 errores; semgrep → 0 findings")
pdf.bullet("Inspección visual: con el toggle test_mode activado, cargué un logo de Wikipedia, validé que apareciera en el header del consent page, en el sidebar tras login, y en el preview del email")

# ═══════════════════════════════════════
# 7. CAMBIOS REALIZADOS — FASE 3
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("7", "Fase 3 — 6 Bugs de Plataforma del Testeo")
pdf.bi("Commit: f6a9de5 (146 líneas, 9 archivos)")

pdf.b(
    "Bugs encontrados al usar la plataforma como estudiante real durante el testeo "
    "del primer piloto. Ninguno bloquea el lanzamiento por sí solo, pero todos "
    "afectan la percepción de calidad y profesionalismo."
)

pdf.ss("(j) Lucía contradice su propio signo zodiacal")
pdf.b(
    "Síntoma: el estudiante pregunta a Lucía si es Virgo. Lucía responde \u201CNo, soy "
    "Virgo. Mi cumpleaños es el 15 de septiembre. Soy Tauro, de hecho.\u201D El 15 "
    "de septiembre es Virgo, no Tauro. Causa: el system prompt de Lucía no incluye "
    "fecha de cumpleaños ni signo, así que el LLM inventa cada vez."
)
pdf.b(
    "Fix: regla de auto-consistencia agregada al system prompt del chat (aplica a "
    "todos los pacientes), incluyendo la tabla zodiacal completa con rangos. La "
    "regla instruye al modelo a mantener consistencia interna y a calcular el signo "
    "según el mes/día declarado, en vez de inventar."
)

pdf.ss("(k) Lucía no responde tras 3 minutos de silencio")
pdf.b(
    "Síntoma: estudiante deja de escribir 3 minutos, no llega ningún mensaje del "
    "paciente. Causa: el endpoint /api/chat/silence existía pero podía fallar "
    "silenciosamente si la llamada al LLM erroreaba o devolvía string vacío. El "
    "frontend chequeaba !data.message y simplemente no añadía nada."
)
pdf.b(
    "Fix: el endpoint ahora envuelve la llamada chat() en try/catch y, si falla o "
    "devuelve vacío, escoge un mensaje hardcoded apropiado para la etapa (1-4) "
    "desde un pool de 2-3 fallbacks por etapa. Se agregó maxDuration=30s para "
    "evitar que Vercel mate la request antes de tiempo. El cliente ChatInterface "
    "ahora loggea cada intento de silence stage a console para debugging en vivo."
)

pdf.ss("(n) /progreso muestra datos falsos para cuentas nuevas")
pdf.b(
    "Síntoma: estudiante recién creado entra a /mi progreso y ve un número en "
    "\u201CSesiones evaluadas\u201D distinto de cero, sin haber tenido ninguna sesión. "
    "Causa: el KPI estaba leyendo earnedAchievements.length (achievements ganados) "
    "en lugar de session_competencies.length (sesiones realmente evaluadas). "
    "Etiqueta engañosa."
)
pdf.b(
    "Fix: nueva variable evaluatedSessionsCount = recentScores?.length || 0 y se "
    "usa en el KPI. La cuenta nueva ahora correctamente muestra 0."
)

pdf.ss("(o) Aprendizaje marca \u201CTutor\u201D como completado tras saltar")
pdf.b(
    "Síntoma: el estudiante hace click en \u201COmitir introducción\u201D del tutor "
    "y al volver a /aprendizaje el tutor aparece como Completado, aunque nunca lo "
    "haya hecho. Causa: el botón Omitir insertaba un row en learning_progress con "
    "el mismo example_id (\u201Ctutor-session\u201D) que el flujo de completado real."
)
pdf.b(
    "Fix: el botón Omitir ahora usa example_id=\u201Ctutor-skipped\u201D. La página "
    "/aprendizaje diferencia tutorUnlocked (cualquier row de tutor — desbloquea "
    "los módulos) de tutorCompleted (solo el example_id explícito tutor-session — "
    "muestra el badge verde de Completado)."
)

pdf.ss("(p) Texto \u201CSube tu foto\u201D superpuesto al avatar")
pdf.b(
    "Síntoma: el avatar circular del dashboard tenía un span con texto \u201CSube "
    "tu foto\u201D posicionado absolute -bottom-1 que se salía de los bordes y "
    "quedaba visualmente sobre el círculo. Causa: posicionamiento CSS pobre."
)
pdf.b(
    "Fix: el span ahora se renderiza con opacity-0 por defecto y group-hover:"
    "opacity-100, plus -bottom-3 para separarlo del círculo. Solo aparece al pasar "
    "el mouse sobre el avatar."
)

pdf.ss("(q) Profile muestra \u201CSin asignar\u201D tras enrollment")
pdf.b(
    "Síntoma: estudiante se inscribe vía el flujo público de consentimiento, "
    "establece su pilot.establishment_id, hace login y entra a /mi-perfil — el "
    "campo Institución muestra \u201CSin asignar\u201D. Causas concurrentes: (1) el "
    "trigger handle_new_user copia establishment_id desde raw_user_meta_data pero "
    "puede fallar silenciosamente; (2) la página /mi-perfil usaba el cliente "
    "supabase con sesión del usuario para leer establishments, lo cual la RLS "
    "rechazaba para roles distintos de superadmin."
)
pdf.b(
    "Fix doble: (1) el endpoint /api/public/pilot-enroll/[slug] ahora hace un "
    "UPDATE explícito a profiles después de createUser, garantizando que "
    "establishment_id, full_name y role queden seteados sin depender del trigger. "
    "(2) /mi-perfil/page.tsx ahora usa el cliente admin para hacer el lookup del "
    "establecimiento, scopeado estrictamente al profile.establishment_id del "
    "usuario autenticado."
)

# ═══════════════════════════════════════
# 8. CAMBIOS REALIZADOS — FASE 4
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("8", "Fase 4 — Onboarding (Encuesta + Tour + Reset)")
pdf.bi("Commit: 17afab8 (172 líneas, 5 archivos)")

pdf.ss("(m) Auto-creación de la encuesta de experiencia al crear el piloto")
pdf.b(
    "Diagnóstico: SurveyModal en (app)/layout.tsx ya pollea /api/surveys/active y "
    "popea cuando hay encuesta activa, pero ningún piloto creaba automáticamente "
    "una encuesta de experiencia. El componente nunca tenía nada que mostrar."
)
pdf.b(
    "Fix: POST /api/admin/pilots ahora inserta automáticamente una fila en "
    "surveys con scope_type=establishment, scope_id = pilot.establishment_id, "
    "starts_at = pilot.scheduled_at (o now), ends_at = pilot.ended_at + 7 días. "
    "Cada participante de cualquier piloto nuevo recibe el modal una vez, la "
    "primera vez que la condición de visibilidad se cumple."
)
pdf.b(
    "Para que la encuesta aparezca INMEDIATAMENTE post-evaluación (no en la próxima "
    "navegación), ReviewClient.handleSubmit dispara un evento custom "
    "window.dispatchEvent(\u2018gloria:reflection-submitted\u2019) tras setResults. "
    "SurveyModal escucha ese evento y refetcha las encuestas activas."
)

pdf.ss("(i) Tour del chat expandido de 2 a 3 steps")
pdf.b(
    "Diagnóstico: el tour existía pero saltaba notas, input de mensaje, autocorrector "
    "y botón de envío — exactamente los controles que los testers reportaron como "
    "no explicados."
)
pdf.b(
    "Fix: nueva estructura de 3 steps con todos los botones cubiertos:"
)
pdf.bullet("Step 0 — Barra superior: temporizador, pausar, finalizar, notas")
pdf.bullet("Step 1 — Caja de mensaje: input, micrófono, autocorrector, botón de envío")
pdf.bullet("Step 2 — Buenas prácticas: modo voz (si soporta), silencios, consejos")
pdf.bullet("Navegación atrás/adelante con contador \u201CX de 3\u201D")
pdf.bullet("Trigger sin cambios: solo dispara cuando no hay initialConvId y no existe localStorage gloria_chat_tour_done")

pdf.ss("(h) Botón \u201CReiniciar onboarding\u201D en /mi-perfil")
pdf.b(
    "Diagnóstico: el componente WelcomeVideoModal ya estaba completo y funcional, "
    "pero los testers tenían el flag localStorage gloria_welcome_seen acumulado "
    "de sesiones anteriores y nunca volvían a ver el video."
)
pdf.b(
    "Fix: nueva tarjeta al final de /mi-perfil con un botón \u201CReiniciar\u201D "
    "que limpia tanto gloria_welcome_seen como gloria_chat_tour_done de "
    "localStorage. Útil tanto para el equipo central re-testeando como para "
    "usuarios reales que quieran rever las explicaciones."
)

# ═══════════════════════════════════════
# 9. SURVEY UGM
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("9", "Encuesta UGM — Replicación del Microsoft Form")
pdf.bi("Commit: ceb5671 (456 líneas, 3 archivos)")

pdf.b(
    "Reemplazo del SurveyModal legacy (4 preguntas estilo NPS) por la encuesta "
    "real que la UGM ya estaba usando externamente en Microsoft Forms "
    "(forms.office.com/r/3HfKGdUvbv). Se replicaron las 10 preguntas 1:1, con la "
    "salvedad de que las 4 demográficas (carrera, género, edad, rol) se inyectan "
    "automáticamente desde pilot_consents en el momento del envío."
)

pdf.ss("Las 10 preguntas")
pdf.bullet("Q1 — ¿En qué carrera estás inscrito actualmente? (text)")
pdf.bullet("Q2 — ¿Cuál es tu género? (radio: femenino / masculino)")
pdf.bullet("Q3 — ¿Qué edad tienes? (number)")
pdf.bullet("Q4 — ¿Qué rol tienes actualmente en la institución? (radio + other)")
pdf.bullet("Q5 — [USABILIDAD] likert 1-5 grid: navegación, performance, claridad, retroalimentación")
pdf.bullet("Q6 — [FORMACIÓN] likert 1-5 grid: aplicación, habilidades, incorporación, verosimilitud, atención")
pdf.bullet("Q7 — ¿Qué fue lo que más te gustó de la experiencia? (textarea)")
pdf.bullet("Q8 — ¿Qué mejorarías para que sea más útil o realista? (textarea)")
pdf.bullet("Q9 — ¿Cómo crees que esta herramienta podría integrarse mejor en tu proceso formativo? (textarea)")
pdf.bullet("Q10 — [OPCIONAL] Comentarios adicionales (textarea)")

pdf.ss("Diseño")
pdf.bullet("Migración 20260408160000_survey_responses_answers.sql: ALTER TABLE survey_responses ADD COLUMN answers JSONB. Schema flexible que coexiste con los campos legacy nps_score / positives / improvements / comments.")
pdf.bullet("Modal reescrito como wizard de 2 pasos: likerts (USABILIDAD + FORMACIÓN) → preguntas abiertas (Q7-Q10)")
pdf.bullet("Preguntas demográficas Q1-Q4 NO se piden al usuario — se inyectan server-side desde pilot_consents")
pdf.bullet("Validación per-step con mensajes explícitos \u201CFalta responder X\u201D")
pdf.bullet("Likert items renderizados como botones 1-5 con etiquetas \u201CMuy en desacuerdo\u201D / \u201CMuy de acuerdo\u201D")
pdf.bullet("Trigger via gloria:reflection-submitted (custom event introducido en Fase 4)")
pdf.bullet("Backward compatible: el endpoint POST /api/surveys/active acepta tanto el payload legacy NPS como el nuevo payload answers JSONB")

pdf.ss("Justificación de la inyección server-side")
pdf.b(
    "Las 4 preguntas demográficas son redundantes con datos que ya capturamos en "
    "pilot_consents al firmar el consentimiento. Pedirlas dos veces al estudiante "
    "es fricción innecesaria. La inyección se hace en el endpoint POST /api/surveys/active "
    "vía un lookup admin client a la fila más reciente de pilot_consents para el "
    "user_id autenticado, mergeando q1_carrera, q2_genero, q3_edad y q4_rol en el "
    "JSONB. La UGM sigue recibiendo los 10 campos en el export."
)

# ═══════════════════════════════════════
# 10. EXPORT CSV
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("10", "Exportación CSV de Respuestas (Nominal + Anónima)")
pdf.bi("Commits: 64519ee + 5fbd511 (286 líneas, 3 archivos)")

pdf.ss("Endpoint")
pdf.b(
    "GET /api/admin/pilots/[id]/survey-responses?format=csv-named|csv-anonymous"
)
pdf.bullet("Versión nominal: incluye nombre + email desde pilot_consents")
pdf.bullet("Versión anónima: sustituye nombre por ID secuencial P-001, P-002... y elimina el email")
pdf.bullet("Ambas aplanan los 10 campos con cada sub-item del likert como su propia columna (q5_usabilidad_navegacion, q5_usabilidad_performance, etc.) — ideal para tablas dinámicas en Excel")
pdf.bullet("UTF-8 BOM al inicio del archivo para que Excel español muestre los acentos correctamente")
pdf.bullet("Escapado RFC 4180 para textos con comas, comillas o saltos de línea")
pdf.bullet("Nombre del archivo incluye institución + nombre del piloto + fecha ISO + formato. Ej: encuesta-ubo-piloto-q2-2026-04-09-anonima.csv")
pdf.bullet("Solo accesible para superadmin")
pdf.bullet("Mensaje 404 amigable si todavía no hay respuestas")

pdf.ss("Admin UI")
pdf.bullet("Dos botones \u201CDescargar con nombres\u201D y \u201CDescargar anonimizado\u201D en el card \u201CEncuesta de cierre\u201D del Step 4 dashboard del piloto")
pdf.bullet("Texto explicativo inline diferenciando ambas versiones")
pdf.bullet("Implementación como anchors con href, sin JavaScript adicional")

pdf.ss("CSV opcional al crear el piloto")
pdf.b(
    "Bug de UX detectado en la última iteración: el wizard exigía al menos 1 fila "
    "en el CSV para crear el piloto, lo que llevaba al admin a poner emails "
    "placeholder \u201Cpara llenar el requisito\u201D. Después al inscribirse vía "
    "el link público con un email distinto, se generaba un participante huérfano. "
    "Solución: removida la guard csvRows.length === 0 en handleCreatePilot. El "
    "CSV ahora es verdaderamente opcional y la UI lo etiqueta como \u201C(opcional)\u201D "
    "con explicación de cuándo conviene usarlo."
)

# ═══════════════════════════════════════
# 11. ARCHIVOS TOCADOS
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("11", "Archivos Tocados — Detalle Completo")

pdf.ss("Migraciones nuevas (3)")
pdf.bullet("supabase/migrations/20260408120000_pilot_consents.sql")
pdf.bullet("supabase/migrations/20260408140000_pilot_logo_url.sql")
pdf.bullet("supabase/migrations/20260408160000_survey_responses_answers.sql")

pdf.ss("Endpoints API nuevos (3)")
pdf.bullet("POST /api/public/pilot-enroll/[slug]/route.ts")
pdf.bullet("POST /api/admin/pilots/[id]/participants/[participantId]/reset/route.ts")
pdf.bullet("GET /api/admin/pilots/[id]/survey-responses/route.ts")

pdf.ss("Endpoints API modificados (5)")
pdf.bullet("POST /api/admin/pilots/route.ts (auto-create survey, slug autogenerate, default consent text)")
pdf.bullet("PATCH /api/admin/pilots/[id]/route.ts (whitelist de campos + auto-bump consent_version)")
pdf.bullet("POST /api/surveys/active/route.ts (acepta answers JSONB + enrichment desde pilot_consents)")
pdf.bullet("POST /api/admin/pilots/[id]/send-invites/route.ts (sin cambios funcionales — pendiente unificar template con el flujo nuevo)")
pdf.bullet("POST /api/chat/silence/route.ts (fallbacks hardcoded por etapa + maxDuration 30s + logging)")

pdf.ss("Componentes React nuevos (2)")
pdf.bullet("src/app/(app)/admin/pilotos/PilotConsentPanel.tsx")
pdf.bullet("src/app/piloto/[slug]/consentimiento/EnrollmentClient.tsx")

pdf.ss("Componentes React modificados (8)")
pdf.bullet("src/components/SurveyModal.tsx (reescritura completa con encuesta UGM)")
pdf.bullet("src/components/ChatInterface.tsx (tour expandido, logs de silence, X duplicada)")
pdf.bullet("src/components/GloriaAssistant.tsx (X flotante removida)")
pdf.bullet("src/app/(app)/admin/pilotos/PilotosClient.tsx (panel arriba, auto-sync institución, botones export CSV, CSV opcional)")
pdf.bullet("src/app/(app)/aprendizaje/page.tsx (diferencia tutor-skipped vs tutor-session)")
pdf.bullet("src/app/(app)/aprendizaje/tutor/TutorClient.tsx (skip usa example_id distinto)")
pdf.bullet("src/app/(app)/dashboard/page.tsx (overlap del avatar)")
pdf.bullet("src/app/(app)/mi-perfil/ProfileClient.tsx (botón Reiniciar onboarding)")

pdf.ss("Server pages modificadas (3)")
pdf.bullet("src/app/(app)/layout.tsx (lookup de pilot.logo_url + cascada al sidebar)")
pdf.bullet("src/app/(app)/mi-perfil/page.tsx (admin client para establishment lookup)")
pdf.bullet("src/app/(app)/review/[conversationId]/ReviewClient.tsx (dispatch event post-eval)")

pdf.ss("Otros archivos modificados (4)")
pdf.bullet("src/lib/validation/schemas.ts (nuevo schema pilotEnrollSchema, removido no_binario)")
pdf.bullet("src/lib/supabase/middleware.ts (whitelist de /piloto/* y /api/public/*)")
pdf.bullet("src/app/api/chat/route.ts (regla de auto-consistencia + tabla zodíaco en system prompt)")
pdf.bullet("src/app/piloto/[slug]/consentimiento/page.tsx (server component para fetch del piloto)")

# ═══════════════════════════════════════
# 12. MÉTRICAS
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("12", "Impacto Cuantificado")

pdf.th(["Métrica", "Antes", "Después", "Delta"],
       [85, 35, 35, 30])
metrics = [
    ("Hallazgos del feedback de testeo cerrados",      "0",            "17 / 17",      "+17"),
    ("Commits aplicados",                              "—",            "9",            "+9"),
    ("Líneas de código agregadas",                     "—",            "~3050",        "—"),
    ("Migraciones Supabase nuevas",                    "0",            "3",            "+3"),
    ("Endpoints API nuevos",                           "0",            "3",            "+3"),
    ("Componentes React nuevos",                       "0",            "2",            "+2"),
    ("Componentes React reescritos",                   "0",            "1",            "+1"),
    ("Tablas nuevas",                                  "0",            "1 (pilot_consents)", "+1"),
    ("Columnas nuevas en tablas existentes",           "0",            "5",            "+5"),
    ("Pasos del consent wizard público",               "n/a",          "3",            "—"),
    ("Pasos del tour del chat",                        "2",            "3",            "+1 step"),
    ("Botones del tour del chat cubiertos",            "5",            "10",           "+5 botones"),
    ("Preguntas de la encuesta UGM replicadas",        "0",            "10 / 10",      "+10"),
    ("Formatos de export CSV",                         "0",            "2 (nominal + anónimo)", "+2"),
    ("Bugs de Lucía cerrados",                         "—",            "2 (j+k)",      "+2"),
]
for i, r in enumerate(metrics):
    pdf.tr(r, [85, 35, 35, 30], fill=(i % 2 == 0))

pdf.ln(4)
pdf.ss("Tiempo invertido")
pdf.b(
    "Sesión de trabajo continuo: aproximadamente 8 a 10 horas distribuidas entre "
    "diseño del flujo nuevo, implementación, testeo iterativo con feedback en vivo "
    "del usuario, y documentación. El bloque más grande fue el self-enrollment + "
    "consentimiento (~3 horas), seguido por la replicación de la encuesta UGM "
    "(~1.5 horas) y los 6 bugs de Fase 3 (~2 horas distribuidas en investigación "
    "con subagentes, fixes y verificación)."
)

pdf.ss("Capacidad estimada para los pilotos reales")
pdf.b(
    "Con los cambios aplicados, GlorIA puede absorber los 3 pilotos institucionales "
    "previstos (UBO con 15 estudiantes, U. Católica de Arequipa con 90 estudiantes, "
    "y un tercer piloto pendiente de definir) sin intervención manual del equipo "
    "central por participante. La operación por piloto se reduce a:"
)
pdf.bullet("Crear el piloto en /admin/pilotos (≈2 minutos)")
pdf.bullet("Configurar logo, texto de consentimiento y test_mode (≈3 minutos)")
pdf.bullet("Copiar el link único y mandárselo al coordinador de la institución (≈30 segundos)")
pdf.bullet("Esperar que los estudiantes se auto-inscriban")
pdf.bullet("Al finalizar el piloto, descargar el CSV de respuestas y generar el informe")

# ═══════════════════════════════════════
# 13. CONCLUSIONES
# ═══════════════════════════════════════
pdf.add_page()
pdf.s("13", "Conclusiones")

pdf.b(
    "GlorIA queda lista para escalar a pilotos institucionales sin que el equipo "
    "central tenga que intervenir manualmente por participante. La pieza estructural "
    "es el flujo de auto-inscripción con consentimiento digital trazable, que cumple "
    "los requisitos éticos básicos para investigación con personas (audit trail "
    "completo, snapshot del texto firmado, versionado del consentimiento) y permite "
    "que cada universidad mantenga su propia identidad visual sin contaminar la "
    "configuración global del establecimiento."
)

pdf.b(
    "La replicación 1:1 del Microsoft Form de la UGM elimina la fricción de tener "
    "dos canales paralelos de evaluación (uno externo en Forms, uno interno en GlorIA "
    "que no coincidía). A partir de ahora, los estudiantes responden la encuesta "
    "directamente al terminar su sesión, las respuestas quedan almacenadas en "
    "Supabase con audit trail, y el equipo central puede exportarlas a CSV en dos "
    "versiones (nominal para análisis interno, anónima para reportes y publicaciones) "
    "con un solo click."
)

pdf.b(
    "Los 17 hallazgos de UX y consistencia detectados durante el testeo del flujo "
    "fueron cerrados todos en la misma jornada. Ninguno bloqueaba el lanzamiento por "
    "sí solo, pero en conjunto representaban una percepción de calidad inadecuada "
    "para presentar a una institución externa. El bug más sutil fue la inconsistencia "
    "del signo zodiacal de Lucía (que requirió expandir el system prompt con una "
    "regla explícita de auto-consistencia y la tabla zodiacal completa); el más "
    "estructural fue el de la institución mostrándose como \u201CSin asignar\u201D "
    "en /mi-perfil tras enrollment, que requirió un fix doble (UPDATE explícito en "
    "el endpoint y admin client en la página)."
)

pdf.ss("Veredicto operativo")
pdf.bb(
    "GlorIA está apta para iniciar el ciclo de pilotos UBO + Arequipa + tercero, "
    "siguiendo el flujo de auto-inscripción documentado en la sección \u201CPróximos "
    "pasos\u201D de este informe."
)

# ═══════════════════════════════════════
# 14. PRÓXIMOS PASOS
# ═══════════════════════════════════════
pdf.s("14", "Próximos Pasos Recomendados")

pdf.ss("Antes de lanzar el primer piloto")
pdf.bullet("Aplicar las 3 migraciones pendientes a remoto: pilot_consents (20260408120000), pilot_logo_url (20260408140000) y survey_responses_answers (20260408160000). Vía npx supabase db push o vía SQL Editor del dashboard.")
pdf.bullet("Verificar que el dominio glor-ia.com esté verificado en Resend (de lo contrario los correos de credenciales no llegan a destinatarios externos).")
pdf.bullet("Verificar que NEXT_PUBLIC_APP_URL en Vercel apunte a https://app.glor-ia.com (necesario para que el logo del email sirva desde el dominio público correcto).")
pdf.bullet("Probar el flujo end-to-end con un piloto interno en test_mode=true antes de pasar a un piloto real.")

pdf.ss("Flujo recomendado por piloto")
pdf.bullet("Crear el piloto en /admin/pilotos sin pre-cargar CSV.")
pdf.bullet("Cargar el logo institucional vía URL pública de la universidad.")
pdf.bullet("Personalizar el texto del consentimiento con el lenguaje requerido por el comité de ética de cada universidad.")
pdf.bullet("Activar test_mode únicamente para tests internos; desactivarlo antes de compartir el link real.")
pdf.bullet("Compartir el link único con el coordinador institucional vía correo formal.")
pdf.bullet("Monitorear el dashboard del piloto para ver participantes activos en tiempo real (refresh cada 15 segundos).")
pdf.bullet("Al finalizar el piloto, descargar la versión nominal y la versión anónima del CSV de respuestas.")
pdf.bullet("Generar el informe final con la estructura del INF-YYYY-NNN para entregar a la universidad.")

pdf.ss("Deuda técnica reconocida")
pdf.bullet("El endpoint legacy /api/admin/pilots/[id]/send-invites todavía usa el template viejo del email (sin el wording \u201CTe damos la bienvenida\u201D, sin el logo arreglado, con la sección \u201CCómo ingresar\u201D que debiera removerse). Recomendación: extraer buildCredentialsEmail a un módulo compartido (src/lib/emails/credentials.ts) e importarlo desde ambos endpoints.")
pdf.bullet("Considerar deshabilitar el botón \u201CEnviar invitaciones\u201D del Step 3 Preview legacy del wizard, para forzar a todos los pilotos a usar el flujo nuevo de auto-inscripción.")
pdf.bullet("Evaluar si conviene seedear datos de prueba en local con un piloto demo que tenga consentimiento, encuesta y participantes ficticios — facilitaría el onboarding de nuevos miembros del equipo.")

pdf.ss("Fuera de alcance de este sprint (para próximas iteraciones)")
pdf.bullet("Decisión de producto: cómo manejar el feedback_status='pending' de los estudiantes en pilotos sin docente. Actualmente quedan esperando aprobación de un docente que nunca llega. Opciones: auto-aprobar al cabo de N minutos, o mostrar resultados sin requerir aprobación cuando el piloto está en modo \u201Csin docente\u201D.")
pdf.bullet("Onboarding más rico: secuencia guiada que recorra el dashboard tras el video de bienvenida.")
pdf.bullet("Reportes ejecutivos automáticos al finalizar el piloto, generados como PDF con el mismo formato que este informe.")

# ═══════════════════════════════════════
# 15. REFERENCIAS
# ═══════════════════════════════════════
pdf.s("15", "Referencias")
pdf.bullet("Microsoft Form fuente de la encuesta UGM: https://forms.office.com/r/3HfKGdUvbv")
pdf.bullet("CLAUDE.md (instrucciones del proyecto)")
pdf.bullet("SECURITY.md (protocolo UGM auditado en INF-2026-033)")
pdf.bullet("Marco de las 10 competencias clínicas: Valdés y Gómez (2023, Universidad Santo Tomás)")
pdf.bullet("Migration logs: supabase/migrations/20260408120000_pilot_consents.sql, 20260408140000_pilot_logo_url.sql, 20260408160000_survey_responses_answers.sql")
pdf.bullet("Commits: 9d57bc7, abcfe28, c4f7d8e, f6a9de5, ae3513f, 17afab8, ceb5671, 64519ee, 5fbd511")

pdf.ln(6)
pdf.set_font("Calibri", "I", 9)
pdf.set_text_color(120, 120, 120)
pdf.multi_cell(0, 5,
    "Informe elaborado por Tomás Despouy con asistencia de Claude (Anthropic) "
    "el 9 de abril de 2026. Verificación técnica: TypeScript 5, ESLint con eslint-config-next "
    "y eslint-plugin-security, Semgrep 1.157.0 (5 reglas, 0 findings), npm audit. "
    "Branch master, commit base 5fbd511."
)

# ─── SAVE ───
os.makedirs(OUTPUT_DIR, exist_ok=True)
pdf.output(OUTPUT)
print(f"OK: {OUTPUT}")
print(f"Tamaño: {os.path.getsize(OUTPUT) // 1024} KB")
