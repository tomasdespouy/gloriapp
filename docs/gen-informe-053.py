# -*- coding: utf-8 -*-
"""
INF-2026-053 — Uso histórico de GlorIA 1.0 (4+ trimestres) y backup pre-bajada.
Reporta uso UGM + instituciones extranjeras (UPC, USMP, USB Cali, Unicaribe) +
piloto Supabase intermedio T3 2025, y documenta el respaldo completo en
Supabase 5.0 antes de bajar el stack.
"""
import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Image, Table, TableStyle)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONTS = "C:/Windows/Fonts"
pdfmetrics.registerFont(TTFont("Calibri", f"{FONTS}/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", f"{FONTS}/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", f"{FONTS}/calibrii.ttf"))

INDIGO = colors.HexColor("#4A55A2")
DARK = colors.HexColor("#1A1A1A")
LIGHT_BG = colors.HexColor("#F0F2FA")
BORDER = colors.HexColor("#CCCCCC")
GREY = colors.HexColor("#666666")
GREEN_BG = colors.HexColor("#E8F5E9")
ORANGE_BG = colors.HexColor("#FFF3E0")
RED_BG = colors.HexColor("#FFEBEE")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Calibri-Bold",
    fontSize=18, textColor=INDIGO, spaceBefore=18, spaceAfter=10, leading=22)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Calibri-Bold",
    fontSize=14, textColor=INDIGO, spaceBefore=14, spaceAfter=6, leading=18)
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName="Calibri-Bold",
    fontSize=11.5, textColor=DARK, spaceBefore=10, spaceAfter=4, leading=15)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Calibri",
    fontSize=10.5, textColor=DARK, leading=15, spaceAfter=6, alignment=TA_JUSTIFY)
BODY_C = ParagraphStyle("BodyC", parent=BODY, alignment=TA_CENTER)
BODY_S = ParagraphStyle("BodyS", parent=BODY, fontSize=9.5, textColor=GREY, leading=13)
CELL = ParagraphStyle("Cell", parent=BODY, fontSize=9.5, leading=12)
CELL_R = ParagraphStyle("CellR", parent=CELL, alignment=2)  # right

def p(t, s=BODY): return Paragraph(t, s)
def sp(h=6): return Spacer(1, h)

def kv_table(rows, col_widths=None):
    if col_widths is None: col_widths = [4.5*cm, 12*cm]
    data = [[Paragraph(f"<b>{k}</b>", CELL), Paragraph(v, CELL)] for k, v in rows]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("BACKGROUND", (0,0), (0,-1), LIGHT_BG),
        ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, BORDER),
    ]))
    return t

def data_table(header, rows, col_widths, totals_row=None):
    data = [[Paragraph(f"<b>{c}</b>", CELL) for c in header]]
    for r in rows:
        data.append([Paragraph(str(v), CELL) for v in r])
    if totals_row:
        data.append([Paragraph(f"<b>{v}</b>", CELL) for v in totals_row])
    t = Table(data, colWidths=col_widths)
    style = [
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("BACKGROUND", (0,0), (-1,0), INDIGO),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.3, BORDER),
    ]
    if totals_row:
        style.append(("BACKGROUND", (0,-1), (-1,-1), LIGHT_BG))
    t.setStyle(TableStyle(style))
    return t

# ─── Header / Footer ────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Calibri-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(LETTER[0]-2*cm, LETTER[1]-1.4*cm,
        "INF-2026-053 · Uso histórico GlorIA 1.0 y backup pre-bajada")
    # Logo en esquina superior derecha
    try:
        logo_path = "public/branding/gloria-logo.png"
        canvas.drawImage(logo_path, LETTER[0]-3.2*cm, LETTER[1]-2.2*cm,
            width=1*cm, height=1*cm, mask='auto', preserveAspectRatio=True)
    except Exception:
        pass
    canvas.drawCentredString(LETTER[0]/2, 1.2*cm, f"GlorIA · Página {doc.page}")
    canvas.drawString(2*cm, 1.2*cm, "Universidad Gabriela Mistral")
    canvas.drawRightString(LETTER[0]-2*cm, 1.2*cm, "2026-05-18")
    canvas.restoreState()

OUT = "informes/investigacion/INF-2026-053_uso-gloria1-cuatro-trimestres-y-backup.pdf"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.4*cm, bottomMargin=2*cm,
    title="INF-2026-053 — Uso histórico GlorIA 1.0 y backup pre-bajada",
    author="GlorIA Platform Team")
story = []

# ─── PORTADA ───
story.append(sp(80))
story.append(Image("public/branding/gloria-logo.png", width=4*cm, height=4*cm, hAlign="CENTER"))
story.append(sp(20))
story.append(Paragraph("INF-2026-053",
    ParagraphStyle("Num", parent=BODY_C, fontName="Calibri-Bold", fontSize=11, textColor=INDIGO)))
story.append(sp(6))
story.append(Paragraph("Uso histórico de GlorIA 1.0",
    ParagraphStyle("Title", parent=BODY_C, fontName="Calibri-Bold", fontSize=22, textColor=INDIGO, leading=28)))
story.append(sp(4))
story.append(Paragraph("Cuatro trimestres de actividad UGM e instituciones aliadas",
    ParagraphStyle("Sub", parent=BODY_C, fontName="Calibri", fontSize=15, textColor=DARK, leading=20)))
story.append(sp(2))
story.append(Paragraph("y respaldo completo pre-bajada del stack",
    ParagraphStyle("Sub2", parent=BODY_C, fontName="Calibri-Italic", fontSize=13, textColor=GREY, leading=18)))
story.append(sp(40))
story.append(Image("public/branding/ugm-logo.png", width=3.5*cm, height=1.2*cm, hAlign="CENTER"))
story.append(sp(30))
story.append(p("Informe de cierre · 2026-05-18", BODY_C))
story.append(p("GlorIA Platform Team", BODY_C))
story.append(PageBreak())

# ─── METADATOS ───
story.append(p("Metadatos del informe", H1))
story.append(kv_table([
    ("Número", "INF-2026-053"),
    ("Fecha", "2026-05-18"),
    ("Categoría", "Investigación / Cierre operativo"),
    ("Prioridad", "Informativo"),
    ("Sujeto", "Uso histórico GlorIA 1.0 (ene 2025 – abr 2026) en 4 trimestres y respaldo completo pre-bajada del stack (Render + Vercel IDEAUGM + MySQL en GoDaddy)"),
    ("Audiencia", "Equipo GlorIA · Coordinación académica UGM"),
    ("Documentos relacionados", "INF-2026-014, INF-2026-027 (correcciones GlorIA 1.0) · INF-2026-035, INF-2026-036 (Ximena Herrera + redirección JWT) · INF-2026-043 (apagón abril 2026) · INF-2026-047 (caso clínico Alejandro López 1.0)"),
    ("Bucket de respaldo", "<i>gloria1-archive</i> en proyecto Supabase 5.0 (<i>ndwmnxlwbfqfwwtekjun</i>) · 39,64 MB · 24 archivos · privado"),
    ("Elaborado por", "GlorIA Platform Team"),
]))
story.append(sp(8))

# ─── SUMARIO EJECUTIVO ───
story.append(p("Sumario ejecutivo", H1))
story.append(p(
    "Entre enero de 2025 y abril de 2026, GlorIA 1.0 acumuló <b>25.740 mensajes terapéuticos</b> "
    "a través de <b>794 conversaciones</b> (threads), iniciadas por <b>371 usuarios registrados</b> "
    "entre estudiantes, docentes y administradores. El uso se concentró en cuatro ventanas "
    "trimestrales correspondientes a pilotos académicos: UGM marzo–mayo 2025, UGM julio 2025 (intersemestral), "
    "expansión multi-institucional septiembre–noviembre 2025 (incorporación de UPC Perú, USMP Perú, USB Cali Colombia y Unicaribe República Dominicana), "
    "y piloto UGM marzo–mayo 2026."))
story.append(p(
    "El pico de adopción ocurrió en el <b>tercer trimestre de 2025</b> (sep–nov), "
    "con 8.063 mensajes y 156 usuarios activos, impulsado por las cuatro instituciones "
    "extranjeras incorporadas en paralelo a UGM. El cuarto trimestre observado registró "
    "una recuperación post-incidente (apagón silencioso del 3 al 11 de abril de 2026, "
    "documentado en INF-2026-043) con 3.035 mensajes nuevos en marzo–abril 2026."))
story.append(p(
    "Como parte del cierre operativo del stack 1.0, se ejecutó un <b>respaldo completo</b> "
    "en el proyecto Supabase de GlorIA 5.0, abarcando la base de datos MySQL, los hilos de OpenAI "
    "Assistants API y un proyecto Supabase intermedio (piloto T3 2025) que también se decomisiona. "
    "El respaldo incluye el rescate definitivo de <b>66 threads pendientes</b> que habían quedado "
    "sin recuperar tras el apagón de abril por restricciones de scope en la API key utilizada en su momento."))
story.append(sp(10))

# ─── PÁGINA: GLOBALES + COMPARATIVA ───
story.append(p("1. Cifras globales", H1))
story.append(p("Base de datos al cierre (2026-05-18, post-importación del rescate de 18-may):", BODY))
story.append(data_table(
    ["Entidad", "Filas", "Notas"],
    [
        ["Mensajes (<i>messages</i>)", "25.740", "Incluye los 2.416 importados el 18-may del rescate de 66 threads pendientes"],
        ["Threads", "794", "284 vacíos legítimos (usuario que creó sesión sin chatear) + 510 con contenido"],
        ["Usuarios", "371", "Estudiantes + docentes + administradores"],
        ["Secciones", "11", "UGM + UPC + USMP + USB Cali + Unicaribe + secciones de prueba"],
        ["Estudiantes-sección", "229", "Tabla intermedia <i>EstudiantesSecciones</i>"],
        ["Roles", "3", "estudiante / docente / admin"],
        ["Pacientes IA (asistentes OpenAI)", "7", "Documentados en sección 3"],
    ],
    [4.5*cm, 2*cm, 10*cm]
))
story.append(sp(6))

story.append(p("Distribución mensual de mensajes (FROM_UNIXTIME(created_at)):", BODY))
story.append(data_table(
    ["Mes", "Mensajes", "Mes", "Mensajes"],
    [
        ["2025-01", "143", "2025-09", "27"],
        ["2025-02", "216", "2025-10", "3.534"],
        ["2025-03", "1.262", "2025-11", "4.502"],
        ["2025-04", "2.058", "2025-12", "672"],
        ["2025-05", "3.298", "2026-01", "0"],
        ["2025-06", "387", "2026-02", "84"],
        ["2025-07", "4.102", "2026-03", "1.747"],
        ["2025-08", "4", "2026-04", "1.288"],
    ],
    [3*cm, 4*cm, 3*cm, 4*cm]
))
story.append(sp(4))
story.append(p("<i>Notar el patrón estacional: caída marcada en jun–sep (verano académico chileno) y dic–feb (vacaciones de verano), con picos en may, jul, oct–nov.</i>", BODY_S))
story.append(PageBreak())

# ─── COMPARATIVA TRIMESTRAL ───
story.append(p("2. Comparativa por trimestre", H1))
story.append(p("Las ventanas trimestrales se construyen sobre el calendario académico, "
    "y consolidan datos de MySQL (mensajes + threads + usuarios activos) y del rescate "
    "OpenAI cuando aplica:", BODY))
story.append(sp(4))

story.append(data_table(
    ["Período", "Mensajes", "Threads", "Usuarios", "Pacientes activos", "Notas"],
    [
        ["T1 2025 (mar–may)", "6.578", "311", "28", "7/7", "Primer piloto UGM"],
        ["T2 2025 (jun–ago)", "4.533", "71", "42", "7/7", "Intersemestral, sesiones largas"],
        ["T3 2025 (sep–nov)", "8.063", "231", "156", "7/7", "Expansión UPC, USMP, USB Cali, Unicaribe"],
        ["T4 2025 (dic–feb 26)", "756", "41", "25", "7/7", "Cierre académico + vacaciones"],
        ["T1 2026 (mar–may)", "3.035", "56", "26", "6/7", "Piloto UGM post-fix abril"],
    ],
    [3.5*cm, 1.8*cm, 1.6*cm, 1.6*cm, 2.2*cm, 6*cm],
    totals_row=["Total", "22.965", "710", "—", "—", "Resto: 2.775 msgs / 84 threads pre-marzo 2025"]
))
story.append(sp(8))

story.append(p("Lectura ejecutiva:", H3))
story.append(p("• <b>El T3 2025 es el período de máxima tracción</b>: 156 usuarios únicos, 3,7 veces "
    "el trimestre anterior. Coincide con la incorporación simultánea de cuatro instituciones extranjeras "
    "(UPC Perú, USMP Perú, USB Cali Colombia, Unicaribe República Dominicana) al piloto UGM regular.", BODY))
story.append(p("• <b>La caída del T4 2025</b> obedece al cierre académico y a las vacaciones de verano "
    "del hemisferio sur (diciembre–febrero 2026); el uso casi cesa en enero 2026 (0 mensajes).", BODY))
story.append(p("• <b>El T1 2026 está sesgado a la baja</b> por el apagón silencioso del 3 al 11 de abril "
    "documentado en INF-2026-043. El rescate del 18 de mayo (este informe) recuperó 2.424 mensajes que "
    "originalmente habían fallado por restricción de scope en la API key utilizada en abril.", BODY))
story.append(PageBreak())

# ─── PÁGINA: PACIENTES IA ───
story.append(p("3. Pacientes IA del catálogo 1.0", H1))
story.append(p("El catálogo de pacientes IA de GlorIA 1.0 consistió en <b>7 asistentes</b> "
    "implementados como OpenAI Assistants (modelo <i>gpt-4o</i>), con threads persistentes "
    "para cada sesión estudiante × paciente. Distribución total de threads:", BODY))
story.append(sp(4))

story.append(data_table(
    ["Paciente", "Modelo OpenAI", "Threads totales", "% del total"],
    [
        ["Matías Ríos", "gpt-4o", "186", "23,4 %"],
        ["María Gómez", "gpt-4o", "149", "18,8 %"],
        ["Alejandro López", "gpt-4o", "131", "16,5 %"],
        ["Luis Fernández", "gpt-4o", "98", "12,3 %"],
        ["Carlos Mendoza", "gpt-4o", "84", "10,6 %"],
        ["GLORIA (mascota)", "gpt-4o-2024-11-20", "76", "9,6 %"],
        ["José Ramírez", "gpt-4o", "70", "8,8 %"],
    ],
    [5.5*cm, 4*cm, 3*cm, 3*cm],
    totals_row=["Total", "—", "794", "100,0 %"]
))
story.append(sp(8))

story.append(p("Observaciones:", H3))
story.append(p("• <b>Matías Ríos</b> y <b>María Gómez</b> concentran el 42 % del total de threads "
    "—los pacientes más conversados de todo el catálogo 1.0—.", BODY))
story.append(p("• <b>GLORIA</b> aparece como un paciente más del catálogo (no como nombre de la plataforma), "
    "con un modelo más reciente (<i>gpt-4o-2024-11-20</i>); el resto usa el modelo base <i>gpt-4o</i>.", BODY))
story.append(p("• <b>Alejandro López</b> es el paciente analizado en profundidad en INF-2026-047 "
    "(caso clínico GlorIA 1.0).", BODY))
story.append(p("• Los 7 pacientes participaron en todos los trimestres excepto el último (T1 2026), "
    "donde Carlos Mendoza no recibió ningún thread (<i>6/7 activos</i>).", BODY))
story.append(PageBreak())

# ─── INSTITUCIONES Y SECCIONES ───
story.append(p("4. Instituciones e instancias del piloto", H1))
story.append(p("Las 11 secciones registradas en GlorIA 1.0 corresponden a distintos pilotos académicos. "
    "Se distinguen cinco con uso institucional real y seis de configuración o prueba:", BODY))
story.append(sp(4))

story.append(data_table(
    ["Sección", "Institución / país", "Tipo"],
    [
        ["GC Javi P Sección III", "UGM, Chile", "Piloto académico"],
        ["GC Jesu M Sección I", "UGM, Chile", "Piloto académico"],
        ["GC Clemen A Sección II", "UGM, Chile", "Piloto académico"],
        ["UPC (Perú)", "Universidad Peruana de Ciencias", "Piloto institucional aliado"],
        ["USMP (Perú)", "Universidad San Martín de Porres", "Piloto institucional aliado"],
        ["USB Cali 2025", "Universidad San Buenaventura Cali", "Piloto institucional aliado"],
        ["Unicaribe2025", "Universidad del Caribe (Rep. Dominicana)", "Piloto institucional aliado"],
        ["Sección Test, Sección Alfa, ASD, prueba", "—", "Configuración / sandbox"],
    ],
    [5*cm, 6*cm, 5*cm]
))
story.append(sp(4))

story.append(p("Caveat de la consulta SQL", H3))
story.append(p("En la tabla <i>usuarios</i> de MySQL, la columna <i>id_seccion</i> está en NULL "
    "para los 371 registros: la asignación usuario → sección se materializa por la tabla intermedia "
    "<i>EstudiantesSecciones</i> (229 filas). Las cifras de \"usuarios activos por trimestre\" se "
    "derivan de <i>Threads.id_usuario</i> (cualquier usuario que abrió al menos un thread).", BODY))
story.append(PageBreak())

# ─── PILOTO SUPABASE T3 2025 ───
story.append(p("5. Piloto Supabase intermedio T3 2025", H1))
story.append(p("Durante el T3 2025 funcionó en paralelo un <b>proyecto Supabase intermedio</b> "
    "(<i>qhnkpsmuvlfticatsydk</i>), creado el 17 de julio de 2025 y operativo hasta diciembre de 2025. "
    "Constituye un puente entre la arquitectura MySQL de la 1.0 y la posterior 5.0 sobre Supabase. "
    "Se incorpora al respaldo por solicitud del responsable del proyecto.", BODY))
story.append(sp(4))
story.append(data_table(
    ["Tabla", "Filas", "Observación"],
    [
        ["chats", "59", "Período 2025-07-21 → 2025-12-18"],
        ["messages", "590", "Mensajes individuales del piloto"],
        ["patients", "7", "Maria Gomez, Gloria, Luis Fernández, Alejandro López, Matías Ríos, José Ramírez, Javier Núñez"],
        ["sections", "2", "Una sección 'test' y una 'seccion 1'"],
        ["users", "22", "20 estudiantes (<i>estudiante1@…</i> a <i>estudiante20@…</i>) + 1 admin + 1 más"],
        ["Storage buckets", "0", "Sin archivos respaldados en storage"],
    ],
    [3.5*cm, 2*cm, 11*cm]
))
story.append(sp(6))
story.append(p("Uso efectivo", H3))
story.append(p("De los 22 usuarios registrados, solo <b>estudiante20@ugm.com</b> registra "
    "<b>59 minutos</b> de uso real; el resto figura con 0 min. El piloto no escaló y los usuarios "
    "convergieron a la 1.0 (MySQL) durante el T3 2025. El proyecto Supabase intermedio queda "
    "incluido en el respaldo y se decomisiona junto con la 1.0.", BODY))
story.append(p("<b>Catálogo de pacientes:</b> coincide en seis de siete con la 1.0 — comparten "
    "Maria Gomez, Gloria, Luis, Alejandro, Matías y José; la diferencia es <i>Javier Núñez</i> "
    "en lugar de <i>Carlos Mendoza</i>. Las migraciones posteriores a 5.0 conservan parte de "
    "este catálogo con ajustes clínicos significativos (ver INF-2026-037 y INF-2026-050/051).", BODY))
story.append(PageBreak())

# ─── INCIDENTES Y RESCATES ───
story.append(p("6. Incidentes y rescates documentados", H1))
story.append(p("La operación de 15 meses de GlorIA 1.0 incluyó incidentes que requirieron "
    "intervenciones de rescate de mensajes terapéuticos:", BODY))
story.append(sp(4))

story.append(data_table(
    ["Fecha", "Incidente / acción", "Mensajes afectados"],
    [
        ["2026-03-25", "JWT con expiración 1h causaba sesiones cortadas (INF-2026-014)", "—"],
        ["2026-04-01", "Bugs en historial docente: hora invertida + atribución par/impar (INF-2026-027)", "Sin pérdida, solo presentación"],
        ["2026-04-09", "Caso Ximena Herrera: login silencioso por JWT expirado (INF-2026-035)", "1 thread, 196 min de uso"],
        ["2026-04-10", "Fix redirección automática a login en JWT expirado (INF-2026-036)", "Cobertura 401 de 12,5 % a 100 %"],
        ["2026-04-03 al 12", "Apagón silencioso: OpenAI Assistants API rechazó requests (INF-2026-043)", "1.331 msgs rescatados (14 estudiantes UGM)"],
        ["2026-05-18", "Rescate definitivo de 66 threads pendientes (este informe)", "2.424 msgs nuevos importados"],
    ],
    [2.6*cm, 8.4*cm, 6*cm]
))
story.append(sp(8))

story.append(p("Rescate del 18 de mayo (este informe)", H3))
story.append(p("Tras el apagón documentado en INF-2026-043, el rescate masivo del 11 de abril "
    "recuperó 21.643 mensajes de 724 threads (de 793 totales) pero dejó <b>69 threads sin recuperar</b> "
    "por error <i>401 - missing scope: api.threads.read</i> en la API key utilizada. El rescate de batches "
    "del 27 de abril cubrió 14 estudiantes del piloto UGM activo (1.331 mensajes adicionales) pero quedaron "
    "<b>66 threads</b> pendientes, de los cuales 18 eran de UGM (cohortes de marzo 2026), 13 de UPC Perú, "
    "9 de Unicaribe, 7 de USMP Perú, 6 de USB Cali y 13 de cuentas demo/test.", BODY))
story.append(p("El rescate del 18 de mayo, con una API key nueva con permiso explícito de <i>api.threads.read</i>, "
    "recuperó <b>66/66 threads</b> sin fallos y <b>2.424 mensajes</b> nuevos. De estos, 2.416 se importaron "
    "a la tabla <i>messages</i> de MySQL (los 8 restantes ya existían en la base por importes parciales "
    "anteriores y fueron correctamente identificados como duplicados por el script idempotente).", BODY))
story.append(PageBreak())

# ─── BACKUP ───
story.append(p("7. Respaldo completo en Supabase 5.0", H1))
story.append(p("El backup pre-bajada se materializa en el bucket privado <i>gloria1-archive</i> "
    "del proyecto Supabase de GlorIA 5.0 (<i>ndwmnxlwbfqfwwtekjun</i>). Total: <b>39,64 MB</b> en "
    "24 archivos organizados en cuatro carpetas:", BODY))
story.append(sp(4))

story.append(data_table(
    ["Carpeta", "Contenido", "Tamaño"],
    [
        ["mysql-dump/", "Dump completo MySQL: 7 tablas (SQL restaurable + JSON por tabla) y manifest", "~16,4 MB"],
        ["openai-threads/", "6 archivos JSON con todos los rescates históricos de OpenAI Assistants API", "~8,5 MB"],
        ["supabase-piloto-t3-2025/", "5 tablas + manifest del proyecto Supabase intermedio", "~0,2 MB"],
        ["mysql-pre-import-backups/", "3 snapshots históricos pre-import (27-abr y 18-may)", "~15,5 MB"],
        ["README.md", "Documentación del backup: estructura, historia y restauración", "~4 KB"],
    ],
    [5*cm, 9*cm, 3*cm]
))
story.append(sp(6))

story.append(p("Integridad verificada", H3))
story.append(p("• Verificación post-importación: la suma de filas en MySQL (25.740 mensajes para 794 thread_ids) "
    "coincide con la suma de los rescates históricos cubierta por <i>messages-backup-pre-pending66-2026-05-18.json</i> "
    "(22 filas existentes) + las 2.418 filas adicionales que el script idempotente identificó y la inserción posterior "
    "del rescate del 18-may.", BODY))
story.append(p("• El bucket se creó como privado: solo accesible con la <i>service_role</i> key de "
    "Supabase 5.0. No expuesto públicamente.", BODY))
story.append(p("• Los JSON conservan estructura idéntica a la generada en producción durante los rescates "
    "originales del 11 de abril y 27 de abril, sin transformaciones lossy.", BODY))
story.append(PageBreak())

# ─── CAVEATS Y CIERRE ───
story.append(p("8. Caveats y consideraciones finales", H1))

story.append(p("Sobre los datos del informe", H3))
story.append(p("• Los <b>284 threads vacíos</b> en MySQL incluyen los <b>220</b> que el rescate del 11-abr "
    "reportó como \"recuperados con 0 mensajes\" (usuarios que crearon una sesión pero no enviaron mensaje) "
    "más los 64 threads del rescate del 18-may que también resultaron vacíos en OpenAI.", BODY))
story.append(p("• Los <b>conteos de mensajes por trimestre</b> se hacen sobre <i>messages.created_at</i> "
    "como timestamp Unix; los <b>conteos de threads</b> sobre <i>Threads.fecha_creacion</i> como datetime. "
    "Pueden existir desajustes menores por zona horaria (la BD está en UTC, los estudiantes en hora de Chile).", BODY))
story.append(p("• Algunos threads en MySQL alcanzan exactamente <b>100 mensajes</b> en local (límite "
    "del bulk-import original del 11-abr); su contenido completo está en los JSON de "
    "<i>openai-threads/</i>, no en MySQL.", BODY))

story.append(sp(6))
story.append(p("Pendientes operativos", H3))
story.append(p("1. <b>Bajada del stack 1.0</b>: pausar Render (backend), Vercel cuenta IDEAUGM (frontend) "
    "y Supabase intermedio <i>qhnkpsmuvlfticatsydk</i>. Mantener 30 días por si surge reclamo de algún "
    "usuario; al cabo de ese plazo, eliminar servicios y dropear la BD MySQL.", BODY))
story.append(p("2. <b>Rotación de credenciales</b> al concluir la bajada: (a) revocar la "
    "<i>service-account key</i> de OpenAI (cuenta IDEAUGM) que aparece hardcodeada en los scripts de "
    "rescate originales; (b) cambiar la contraseña del usuario MySQL <i>AdminUgmia</i> en GoDaddy.", BODY))
story.append(p("3. <b>Limpieza de archivos locales</b>: los scripts de <i>gloria1-back/scripts/</i> con "
    "credenciales hardcodeadas no están commiteados al repositorio público de GitHub, pero deben "
    "limpiarse antes de cualquier archivado público del repo.", BODY))
story.append(p("4. <b>Dominio www.glor-ia.com</b>: ya migrado al canónico de GlorIA 5.0 desde "
    "2026-05-05 (ver memoria interna del proyecto). El dominio sigue activo, no requiere acción.", BODY))

story.append(sp(8))
story.append(p("9. Conclusiones", H1))
story.append(p("GlorIA 1.0 sostuvo <b>15 meses de operación productiva</b> con cuatro ventanas de uso "
    "claramente distinguibles, alcanzando un pico de adopción en T3 2025 con 156 usuarios concurrentes "
    "y expansión multi-institucional efectiva. La plataforma sirvió de validación temprana antes del "
    "salto arquitectónico a GlorIA 5.0 (Next.js + Supabase + Postgres con RLS), que permite hoy "
    "el ritmo de evolución documentado entre INF-2026-001 y INF-2026-052.", BODY))
story.append(p("El respaldo ejecutado el 18 de mayo de 2026 captura el estado final de la base de datos "
    "y de los hilos de OpenAI antes del decomiso del stack. Con los 66 threads pendientes finalmente "
    "rescatados, la cobertura del registro histórico de conversaciones queda en <b>~100 % de los "
    "threads con contenido</b> (510 de 510 conversaciones reales) y <b>25.740 mensajes terapéuticos</b> "
    "consolidados en un único almacén consultable.", BODY))
story.append(sp(8))
story.append(p("<i>—</i>", BODY_C))
story.append(p("Elaborado por: GlorIA Platform Team", BODY_C))
story.append(p("Fecha: 18 de mayo de 2026", BODY_C))

# ─── BUILD ───
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"\nPDF generado: {OUT}")
print(f"Tamaño: {os.path.getsize(OUT) / 1024:.1f} KB")
