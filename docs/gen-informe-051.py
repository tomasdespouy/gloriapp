"""
INF-2026-051 — Despliegue INF-050 a PROD + tuning clínico de 9 pacientes (un día completo).
Incluye tabla descriptora clínica de los 34 pacientes con los cuadros actualizados.
"""
import json, os
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
pdfmetrics.registerFont(TTFont("Mono", f"{FONTS}/consola.ttf"))

INDIGO = colors.HexColor("#4A55A2")
DARK = colors.HexColor("#1A1A1A")
LIGHT_BG = colors.HexColor("#F0F2FA")
CODE_BG = colors.HexColor("#F7F7F9")
GREEN_BG = colors.HexColor("#E8F5E9")
ORANGE_BG = colors.HexColor("#FFF3E0")
RED_BG = colors.HexColor("#FFEBEE")
BORDER = colors.HexColor("#CCCCCC")
GREY = colors.HexColor("#666666")
GREEN = colors.HexColor("#2E7D32")
RED = colors.HexColor("#C62828")
ORANGE = colors.HexColor("#C25E00")

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
CODE = ParagraphStyle("Code", parent=BODY, fontName="Mono", fontSize=8.5,
    textColor=DARK, leading=11, backColor=CODE_BG, borderPadding=8,
    borderColor=BORDER, borderWidth=0.5, leftIndent=4, rightIndent=4,
    spaceBefore=6, spaceAfter=8, alignment=TA_LEFT)
TURN_BODY = ParagraphStyle("TurnBody", parent=BODY, fontSize=10, leading=14)
TABLE_CELL = ParagraphStyle("TC", parent=BODY, fontSize=8.5, leading=11)

def p(text, style=BODY): return Paragraph(text, style)
def sp(h=6): return Spacer(1, h)

def kv_table(rows, col_widths=None):
    if col_widths is None: col_widths = [4.5*cm, 11.5*cm]
    data = [[Paragraph(f"<b>{k}</b>", BODY), Paragraph(v, BODY)] for k, v in rows]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("BACKGROUND", (0,0), (0,-1), LIGHT_BG),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, BORDER),
        ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ]))
    return t

def code_block(text, style=CODE):
    safe = text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\n","<br/>")
    return Paragraph(safe, style)

# ─── Datos ──────────────────────────────────────────────────────
PATIENTS = json.load(open("C:/tmp/patients-clinical-summary.json", encoding="utf8"))

# ─── Helpers de tabla descriptora ───────────────────────────────
STYLE_MAP = {
  "guarded_but_willing": ["Cauta inicialmente, se disculpa al emocionarse", "Negación parcial, autodisculpa"],
  "deflects_with_humor": ["Esquiva con humor (\"yo no estoy loco\")", "Humor evitativo"],
  "monosyllabic_initially": ["Monosilábico al inicio; silencios largos; \"no sé\"", "Aislamiento, retracción"],
  "articulate_and_challenging": ["Articulada, desafiante, pone a prueba al terapeuta", "Intelectualización, control"],
  "formal_and_brief": ["Formal y factual; \"Bien, gracias, doctor\"", "Formación reactiva, distanciamiento"],
  "anxious_but_open": ["Habla rápido cuando ansiosa, autoexigente, llanto fácil", "Perfeccionismo, autocrítica"],
  "factual_and_flat": ["Tono plano, no nombra emociones, responde con datos", "Alexitimia, racionalización"],
  "uses_clinical_jargon": ["Intelectualiza con jerga clínica para no sentir", "Intelectualización extrema"],
  "submissive_and_justifying": ["Minimiza la situación, justifica al agresor", "Minimización, identificación con agresor"],
  "monosyllabic": ["Pocas palabras, distante, no se queja", "Negación, masculinidad rígida"],
  "articulate_but_trapped": ["Articulada y paralizada; ambivalente", "Ambivalencia paralizante, sumisión"],
  "fragmented_when_triggered": ["Habla fluida hasta que el trauma aparece", "Disociación, evitación"],
  "moderate_facade": ["Fachada alegre, dice \"estoy bien\" automático", "Negación maníaca, sobreadaptación"],
  "cheerful_surface": ["Fachada alegre que se quiebra con validación", "Negación maníaca, sobreadaptación"],
  "high_ambivalent": ["Quiere ayuda y la teme al mismo tiempo", "Ambivalencia, escisión"],
  "insightful_but_stuck": ["Tiene insight pero no logra actuar", "Racionalización, parálisis afectiva"],
  "self_aware_but_stuck": ["Conoce su patrón, no logra cambiarlo", "Intelectualización defensiva"],
  "cauteloso": ["Cauteloso al inicio; se abre con escucha sin juicio", "Evitación, contención"],
  "direct_and_colloquial": ["Directo, coloquial, lenguaje de la calle", "Negación masculina, humor"],
  "cynical_and_articulate": ["Cínico, sarcástico, articulado; ataca el setting", "Sarcasmo, racionalización"],
  "sarcastic_defense": ["Sarcasmo como escudo; \"da igual\"", "Sarcasmo defensivo"],
  "emotional_and_narrative": ["Cuenta historias largas, se desborda emocionalmente", "Somatización, rumiación narrativa"],
  "religious_framework": ["Encuadra todo en términos religiosos; \"voluntad de Dios\"", "Resignación espiritual, sublimación"],
  "quiet_and_hesitant": ["Voz baja, dudosa, pide permiso para hablar", "Inhibición, sumisión"],
  "storytelling": ["Narra anécdotas como evitación de emoción presente", "Distanciamiento narrativo"],
  "formal_and_measured": ["Formal y medido; \"don\" / \"señor\"; sopesa cada palabra", "Formación reactiva, contención"],
}

def infer_from_problem(presenting, tags):
  t = " ".join(tags or []).lower() + " " + (presenting or "").lower()
  import re
  if re.search(r"duelo paterno", t): return ["Cambia de tema o broma cuando el padre aparece", "Humor evitativo, racionalización"]
  if re.search(r"duelo|duelo-hermano", t): return ["Habla del fallecido en presente; defensa con \"ya pa' qué\"", "Negación, idealización"]
  if re.search(r"p[aá]nico|ansiedad", t): return ["Hipervigilancia, taquicardia narrada", "Evitación, hipercontrol"]
  if re.search(r"burnout", t): return ["Agotamiento, cinismo, \"no doy más\"", "Sobreadaptación al rol cuidador"]
  if re.search(r"trauma|ptsd|estr[eé]s post", t): return ["Sobresaltos, evitación, fragmentación al trauma", "Disociación, evitación"]
  if re.search(r"codepende|violencia", t): return ["Justifica al agresor, minimiza", "Identificación con agresor"]
  if re.search(r"depresi[oó]n", t): return ["Anhedonia, enlentecimiento", "Inhibición, retraimiento"]
  if re.search(r"impostor|perfeccionismo", t): return ["Relaja con logros, se evade con lo personal", "Perfeccionismo defensivo, intelectualización"]
  if re.search(r"crisis vital|mediana edad|transici[oó]n", t): return ["Cuestionamiento existencial, metáforas (musicales/laborales)", "Sublimación, humor melancólico"]
  if re.search(r"ira|explosivo", t): return ["Aprieta mandíbula, rechazo del setting, frases breves", "Externalización, masculinidad rígida"]
  if re.search(r"vincular|pareja|post-ruptura", t): return ["Vacila al hablar de la pareja, compara con ex", "Evitación del deseo propio"]
  if re.search(r"migraci[oó]n|cuidadora", t): return ["Activa rol cuidadora con el terapeuta, busca aprobación", "Sobreadaptación, religiosidad de contención"]
  if re.search(r"autolesi[oó]n|cutting", t): return ["Sarcasmo defensivo; remisión ambivalente", "Sarcasmo, fantasía de escape"]
  if re.search(r"familia|paterno|conflicto", t): return ["Resentimiento contenido, lealtades en conflicto", "Represión, lealtades inconscientes"]
  if re.search(r"aislamiento", t): return ["Retraimiento social, evitación de contacto", "Evitación, retracción"]
  if re.search(r"autoestima", t): return ["Autocrítica, comparaciones desfavorables", "Autoexigencia, devaluación"]
  return ["—", "—"]

def category(tags, presenting):
  tagSet = set((t.lower() for t in (tags or [])))
  t = " ".join(tagSet) + " " + (presenting or "").lower()
  import re
  if re.search(r"impostor", t): return "Impostor / Perfeccionismo"
  if re.search(r"trauma|ptsd", t): return "Trauma / TEPT"
  if re.search(r"duelo", t): return "Duelo"
  if re.search(r"ideacion|ideación|suicid", t): return "Riesgo / Depresión grave"
  if "ansiedad" in tagSet or re.search(r"p[aá]nico|ansiedad", t): return "Ansiedad"
  if re.search(r"depresi[oó]n", t): return "Depresión"
  if re.search(r"burnout", t): return "Burnout"
  if "personalidad" in tagSet: return "Rasgos de personalidad"
  if re.search(r"ira|explosivo", t): return "Trastorno explosivo"
  if re.search(r"mediana edad|transici[oó]n|crisis vital", t): return "Crisis vital / Mediana edad"
  if re.search(r"familia|dependencia|vincul|pareja", t): return "Vínculos / Familia"
  if "identidad" in tagSet or "adaptación" in tagSet: return "Identidad / Crisis"
  if "autoestima" in tagSet: return "Autoestima"
  if "masculinidad" in tagSet: return "Masculinidad"
  if re.search(r"autolesi[oó]n", t): return "Autolesión / Regulación"
  return "Otro"

# ─── Header / Footer ────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Calibri-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(LETTER[0]-2*cm, LETTER[1]-1.4*cm,
        "INF-2026-051 — Despliegue INF-050 + tuning clínico de 9 pacientes")
    canvas.drawCentredString(LETTER[0]/2, 1.2*cm, f"Página {doc.page}")
    canvas.drawString(2*cm, 1.2*cm, "GlorIA · Universidad Gabriela Mistral")
    canvas.drawRightString(LETTER[0]-2*cm, 1.2*cm, "2026-05-11")
    canvas.restoreState()

OUT = "informes/investigacion/INF-2026-051_despliegue-inf050-y-tuning-clinico.pdf"
doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.2*cm, bottomMargin=2*cm,
    title="INF-2026-051 — Despliegue INF-050 + tuning clínico",
    author="GlorIA Platform Team")
story = []

# ─── PORTADA ───
story.append(sp(80))
story.append(Image("public/branding/gloria-logo.png", width=4*cm, height=4*cm, hAlign="CENTER"))
story.append(sp(20))
story.append(Paragraph("INF-2026-051", ParagraphStyle("Num", parent=BODY_C, fontName="Calibri-Bold", fontSize=11, textColor=INDIGO)))
story.append(sp(6))
story.append(Paragraph("Despliegue INF-050 a producción",
    ParagraphStyle("Title", parent=BODY_C, fontName="Calibri-Bold", fontSize=22, textColor=INDIGO, leading=28)))
story.append(sp(4))
story.append(Paragraph("y tuning clínico de 9 pacientes",
    ParagraphStyle("Sub", parent=BODY_C, fontName="Calibri", fontSize=18, textColor=DARK, leading=24)))
story.append(sp(8))
story.append(Paragraph("Reporte de un día completo · 2026-05-11",
    ParagraphStyle("Tag", parent=BODY_C, fontName="Calibri-Italic", fontSize=12, textColor=GREY)))
story.append(sp(40))
story.append(Image("public/branding/ugm-logo.png", width=3.5*cm, height=1.2*cm, hAlign="CENTER"))
story.append(sp(30))
story.append(p("Documento técnico-clínico", BODY_C))
story.append(p("Mayo 2026", BODY_C))
story.append(p("Universidad Gabriela Mistral", BODY_C))
story.append(PageBreak())

# ─── METADATOS ───
story.append(p("Metadatos del informe", H1))
story.append(kv_table([
    ("Número", "INF-2026-051"),
    ("Fecha", "2026-05-11"),
    ("Categoría", "Despliegue + Investigación clínica"),
    ("Prioridad", "Alta"),
    ("Sujeto del estudio", "Despliegue de INF-2026-050 a PROD + tuning clínico de 9 pacientes"),
    ("Documentos hermanos", "INF-2026-047 (caso Alejandro López 1.0) · INF-2026-048 (caso Diego Fuentes 5.0) · "
        "INF-2026-049 (propuesta enriquecimiento Diego) · <b>INF-2026-050 (enriquecimiento masivo 34 pacientes)</b>"),
    ("Estado final del INF-050 en PROD", "<b>34 / 34</b> pacientes enriquecidos, <b>172</b> filas en enrichment_history, "
        "<b>9</b> con tuning clínico aplicado, <b>0</b> errores acumulados"),
    ("Commits del día", "5dd4530 · a6f55ba · e402c72 · b7851fd · 34f45a1 · b24661e"),
    ("Costo total de API",
        "≈ USD 0,75 (generación inicial gpt-4o + simulaciones gpt-4.1-mini + re-generación de 9 bloques)"),
]))
story.append(sp(8))

story.append(p("Resumen ejecutivo", H2))
story.append(p(
    "Este informe documenta una jornada completa de despliegue y refinamiento clínico. "
    "En la mañana se aplicó el INF-2026-050 (enriquecimiento de los 34 pacientes con 4 bloques nuevos) "
    "a producción, tras la validación previa en staging. En la tarde, a partir de la tabla descriptora "
    "clínica de los 34 pacientes, se identificaron dos categorías de problemas: (a) pacientes con cuadros "
    "demasiado genéricos que no aprovechaban el material biográfico disponible, y (b) pacientes con contenido "
    "clínicamente riesgoso para un contexto pedagógico de pregrado. Se aplicó tuning clínico a 9 pacientes en "
    "dos batches secuenciales — primero los 5 más urgentes (riesgo + 2 enriquecimientos), luego los 4 cuadros "
    "genéricos restantes — siempre en staging primero, validados con E2E contra el LLM real, y replicados a PROD "
    "solo tras coherencia confirmada.", BODY))
story.append(p(
    "<b>Resultado:</b> los 34 pacientes ahora tienen bloques de enriquecimiento activos en producción, "
    "los 9 con cuadros genéricos o riesgosos quedaron correctamente tipificados clínicamente, y la atenuación "
    "crítica de Alejandro Vega (ideación suicida activa con plan → ideación pasiva fugaz sin plan ni medios) "
    "redujo el riesgo iatrogénico inmediato para los estudiantes que conversan con él. La aplicación se hizo "
    "exclusivamente vía API REST tras un incidente menor con el SQL Editor (5 duplicados huérfanos creados por "
    "ejecución accidental del seed inicial, todos eliminados sin afectar conversaciones reales).", BODY))

story.append(PageBreak())

# ─── §1 LÍNEA DE TIEMPO ───
story.append(p("1. Línea de tiempo del día (2026-05-11)", H1))
timeline_data = [
    ["Hora UTC", "Hito", "Resultado"],
    ["~11:30", "Verificación post-incidente Supabase (resuelto)", "Banner naranja desapareció; staging respondiendo OK"],
    ["12:00–12:30", "Apply REST de los 34 bloques a STAGING (batch 1: 23 existentes)",
        "23/23 aplicados, +92 filas history. 11 saltados (no estaban en staging)"],
    ["12:45", "Sembrado de los 11 pacientes faltantes en STAGING desde PROD",
        "11 INSERTs preservando UUIDs originales"],
    ["13:00", "Re-apply de los 34 bloques en STAGING (esta vez completos)", "34/34 aplicados, 136 filas history"],
    ["13:15", "E2E con LLM real (3 pacientes representativos)",
        "Andrés Castillo activa 'Camila y Sebastián, parcera'; Yesenia 'Doña Carmen, Carla'"],
    ["14:30", "Aplicación de schema (SQL Editor) en PROD",
        "<b>INCIDENTE</b>: usuario aplicó también seed_ai_patients por error → 5 duplicados huérfanos"],
    ["14:45", "Limpieza del incidente: DELETE de los 5 duplicados", "PROD vuelve a 34 únicos; 0 conversaciones afectadas"],
    ["15:00", "Apply REST de los 34 bloques a PROD", "34/34 aplicados, 136 filas history, 0 errores"],
    ["15:15", "Smoke test PROD: Diego enriquecido", "system_prompt 2.505 → 4.599 chars, bloques en posición canónica"],
    ["15:30–16:00", "Generación de tabla descriptora clínica + análisis",
        "Identificados 5 pacientes a tunear con prioridad (riesgo + cuadros vagos)"],
    ["16:00–16:45", "Tuning batch 1 en STAGING + E2E (Valentina, Yamilet, Alejandro, Altagracia, Jimena)",
        "5/5 OK. Alejandro: 'No mames, si tuviera un plan ya no estaría aquí'"],
    ["16:45", "Tuning batch 1 en PROD + E2E", "5/5 OK en producción"],
    ["17:15–17:45", "Tuning batch 2 en STAGING + E2E (Mateo, Jorge, Mariana, Rafael)",
        "4/4 OK. Rafael: metáforas musicales como prescribe el prompt"],
    ["17:45", "Tuning batch 2 en PROD + E2E", "4/4 OK; 34 pacientes con tuning quedan completos"],
    ["18:00", "Generación del INF-2026-051 (este documento)", "Reporte consolidado del día"],
]
col_widths_tl = [2.0*cm, 6.5*cm, 7.5*cm]
t_tl = Table([
    [Paragraph(cell, BODY_S) for cell in row] for row in timeline_data
], colWidths=col_widths_tl)
t_tl.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    # destacar la fila del incidente
    ("BACKGROUND", (0,7), (-1,7), RED_BG),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_tl)
story.append(sp(6))

story.append(PageBreak())

# ─── §2 DESPLIEGUE PROD ───
story.append(p("2. Despliegue de INF-2026-050 a producción", H1))
story.append(p("2.1 Schema aplicado", H2))
story.append(p(
    "El SQL del schema (4 columnas JSONB en ai_patients + tabla enrichment_history con RLS + "
    "índice por patient_id + check constraint sobre block_name) se aplicó manualmente en el SQL Editor "
    "de Supabase Studio sobre el proyecto ndwmnxlwbfqfwwtekjun (PROD). Migración idempotente con "
    "<font face='Mono' size='9'>IF NOT EXISTS</font> y reversible vía <font face='Mono' size='9'>DROP "
    "COLUMN</font> documentado en el header.", BODY))

story.append(p("2.2 Aplicación de los 34 bloques vía REST", H2))
story.append(p(
    "Tras descartar el SQL Editor para los datos (por el incidente del 8-may con Supabase + tamaño "
    "del archivo de 221 KB), se aplicaron los 34 bloques vía API REST con el script "
    "<font face='Mono' size='9'>docs/apply-enrichment-prod.js</font>. Match por NAME (no ID, porque las "
    "UUIDs no son consistentes entre bases). Resultado:", BODY))
story.append(kv_table([
    ("Pacientes procesados", "34"),
    ("Bloques aplicados", "136 (34 × 4)"),
    ("Filas en enrichment_history", "136"),
    ("Tiempo total de aplicación", "≈ 25 segundos"),
    ("Errores", "0"),
    ("Verificación smoke test", "✓ Diego: system_prompt 2.505 → 4.599 chars, bloques en posiciones canónicas"),
]))

# ─── §3 INCIDENTE ───
story.append(p("3. Incidente del día: duplicados accidentales en PROD", H1))
story.append(p(
    "Durante el despliegue del schema, el usuario aplicó por error en el SQL Editor también el archivo "
    "<font face='Mono' size='9'>20260313203745_seed_ai_patients.sql</font> — un seed inicial del proyecto "
    "que contiene <font face='Mono' size='9'>INSERT</font> sin <font face='Mono' size='9'>ON CONFLICT</font>. "
    "Como los IDs son generados con <font face='Mono' size='9'>gen_random_uuid()</font>, esto creó 5 nuevas "
    "filas con UUIDs distintos a los originales:", BODY))

dups_data = [
    ["Nombre", "ID original (mantenido)", "ID duplicado (a eliminar)"],
    ["Marcos Herrera", "f9517a4b…", "7df0a337…"],
    ["Roberto Salas", "4de02b24…", "9d30051c…"],
    ["Carmen Torres", "e6e6f099…", "e50618c6…"],
    ["Diego Fuentes", "9ed3247f…", "ab3f92c1…"],
    ["Lucia Mendoza", "190feafa…", "0bba8312…"],
]
t_dups = Table(dups_data, colWidths=[3.5*cm, 5.5*cm, 5.5*cm])
t_dups.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9.5),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_dups)
story.append(sp(6))

story.append(p("3.1 Verificación de impacto y resolución", H2))
story.append(p(
    "Antes de cualquier acción destructiva, se verificó que los 5 duplicados estuvieran completamente "
    "huérfanos:", BODY))
story.append(p(
    "<font face='Mono' size='9'>SELECT count(*) FROM conversations WHERE ai_patient_id IN (5_dups);</font> → "
    "<b>0</b><br/>"
    "<font face='Mono' size='9'>SELECT count(*) FROM establishment_patients WHERE ai_patient_id IN (5_dups);</font> → "
    "<b>0</b>", BODY))
story.append(p(
    "Cero referencias en cualquier tabla relacional → DELETE seguro sin pérdida de datos de estudiantes. "
    "Se ejecutó el DELETE vía REST API (con re-verificación pre-flight de huerfanidad como defensa "
    "adicional). PROD volvió a 34 pacientes únicos en menos de 5 minutos desde la detección.", BODY))

story.append(p("3.2 Lessons learned", H2))
story.append(p(
    "• <b>El SQL Editor de Supabase Studio ejecuta CUALQUIER archivo pegado.</b> No tiene contexto sobre "
    "qué migraciones ya están aplicadas. La defensa correcta es la convención: aplicar solo migraciones "
    "nuevas y nunca re-aplicar seeds iniciales. Documentado en el INF-051 para que quede registro.", BODY))
story.append(p(
    "• <b>La aplicación vía REST API resultó más segura</b> que el SQL Editor para datos masivos: "
    "idempotente, con verificaciones pre-flight, sin riesgo de tamaño/timeout, y con logging por paciente.", BODY))
story.append(p(
    "• <b>El esquema de enrichment_history con INSERT condicional</b> "
    "(<font face='Mono' size='9'>WHERE EXISTS (SELECT 1 FROM ai_patients WHERE id = '...')</font>) "
    "evitó cascada de fallos del FK constraint cuando se aplicó en staging con menos pacientes que prod. "
    "Patrón reutilizable para futuras migraciones entre ambientes asincronizados.", BODY))

story.append(PageBreak())

# ─── §4 TUNING CLÍNICO ───
story.append(p("4. Tuning clínico de 9 pacientes", H1))
story.append(p(
    "Después del despliegue inicial, la generación de la tabla descriptora clínica de los 34 pacientes "
    "(<font face='Mono' size='9'>docs/gen-clinical-table.js</font>) reveló dos categorías de pacientes "
    "que requerían atención adicional:", BODY))
story.append(p(
    "<b>(A) Cuadros clínicamente riesgosos</b> — contenido potencialmente iatrogénico para estudiantes "
    "de pregrado.<br/>"
    "<b>(B) Cuadros demasiado genéricos</b> — desaprovechaban el material biográfico disponible y daban "
    "respuestas planas.", BODY))

story.append(p("4.1 Batch 1: atenuación de riesgo + 2 enriquecimientos", H2))
batch1_data = [
    ["Paciente", "Cambio aplicado", "Verificación E2E"],
    ["Alejandro Vega (MX, advanced)",
        "Ideación activa con plan ('estrellar mi carro' + acceso a medios + cocaína semanal) → ideación pasiva fugaz, sin plan, sin medios, cocaína recreacional. Padre suicidado reservado a sesión 4+.",
        "PROD: 'No mames, si tuviera un plan ya no estaría aquí, ¿no? No hay plan, solo ese cansancio.' Sin referencias al carro/pastillas."],
    ["Altagracia Marte (RD, advanced)",
        "Abandono de quimio: secreto profundo → contenido revelable en sesión 2+. Mantiene ideación pasiva.",
        "Revela ocultamiento en T3: 'Prefiero que crean que sigo con el tratamiento, así ellos están tranquilos.'"],
    ["Jimena Ramírez (MX)",
        "Difficulty beginner → intermediate. Cutting activo → en remisión 6 meses. Fantasías precisadas como 'de escape, no suicidas'.",
        "'Hace como seis meses que no, pero a veces siento que extraño esa forma de desahogarme.'"],
    ["Valentina Ospina (CO, beginner)",
        "'Problemas de pareja' → 'Crisis de decisión vincular post-ruptura + perfeccionismo + presión familiar'. Backstory con Daniel (ex) y Tomás (actual).",
        "Vacila al hablar de Tomás, lo compara con Daniel, menciona mamá."],
    ["Yamilet Pérez (RD→Chile)",
        "'Dependencia emocional' → 'Dependencia + duelo migratorio + culpa religioso-familiar + cuidadora exhausta'. Backstory con Cristián.",
        "Activa rol cuidadora con terapeuta ('¿Y usted cómo está?'), menciona crucifijo, Chile, hermanas allá."],
]
t_b1 = Table([[Paragraph(c, TABLE_CELL) for c in row] for row in batch1_data], colWidths=[3.5*cm, 6.5*cm, 6.0*cm])
t_b1.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_b1)
story.append(sp(8))

story.append(p("4.2 Batch 2: 4 cuadros enriquecidos", H2))
batch2_data = [
    ["Paciente", "Cuadro anterior → nuevo", "Verificación E2E"],
    ["Mateo Giménez (AR, intermediate)",
        "'Conflicto familiar' → 'Duelo paterno no resuelto + ansiedad ocupacional (restaurante propio) + conflicto matrimonial por carga laboral'",
        "'Mi viejo siempre decía que había que mandarse al frente, pero se fue cuando yo tenía 15. Mejor cambiamos de tema, que me pongo medio denso.'"],
    ["Jorge Ramírez (MX, advanced)",
        "'Manejo de ira' → 'Trastorno explosivo + duelo del hermano (Tonio) + masculinidad rígida + aislamiento post-divorcio'",
        "'Ya pa' qué hablar de eso, joven.' (al preguntar por Tonio). Dialecto popular mexicano consistente."],
    ["Mariana Sánchez (MX, intermediate)",
        "'Autoestima baja' → 'Síndrome del impostor + perfeccionismo paralizante + identidad calcada del padre'",
        "Se relaja al hablar de logros, se evade en lo personal. Padre socio en despacho aparece como modelo."],
    ["Rafael Santos (RD, advanced)",
        "'Crisis vital' → 'Crisis mediana edad + duelo del éxito no alcanzado + fracaso paterno (hijos a EE.UU.) + ambivalencia vocacional'",
        "'Toco la misma nota sin que nadie me escuche, y eso pesa en el alma.' Metáforas musicales como prescribe el prompt."],
]
t_b2 = Table([[Paragraph(c, TABLE_CELL) for c in row] for row in batch2_data], colWidths=[3.5*cm, 6.5*cm, 6.0*cm])
t_b2.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_b2)

story.append(p("4.3 Pipeline aplicado a cada uno de los 9", H2))
story.append(p(
    "Para cada paciente del tuning, el script <font face='Mono' size='9'>docs/apply-clinical-tuning.js "
    "&lt;target&gt; &lt;batch&gt;</font> ejecuta:", BODY))
story.append(p(
    "1. <b>PATCH metadata</b>: system_prompt, presenting_problem, tags, backstory, difficulty_level si aplica.<br/>"
    "2. <b>Re-generación de los 4 bloques</b> con gpt-4o T=0.7 usando el NUEVO prompt como contexto "
    "para que la coherencia se mantenga.<br/>"
    "3. <b>PATCH bloques</b> + bump enrichment_version (v1 → v2).<br/>"
    "4. <b>Reset enrichment_history</b>: DELETE filas previas + INSERT nuevas con audit trail.", BODY))
story.append(p(
    "El meta-prompt usado en el paso 2 incluye una regla dura adicional: <i>'NUNCA agregues elementos "
    "clínicos nuevos que cambien el cuadro (especialmente: NO agregar ideación suicida, plan, medios o "
    "autolesión activa si el prompt no los menciona o los atenúa)'</i>. Esto previene que el modelo "
    "vuelva a introducir contenido riesgoso al re-generar los bloques de Alejandro o Jimena.", BODY))

story.append(PageBreak())

# ─── §5 TABLA DESCRIPTORA CLÍNICA DE LOS 34 ───
story.append(p("5. Tabla descriptora clínica de los 34 pacientes", H1))
story.append(p(
    "La siguiente tabla resume cómo se identifica clínicamente cada paciente: cuadro principal, signos "
    "observables que el estudiante notará en sesión, y mecanismo de defensa predominante. Refleja el "
    "estado de PROD <b>después</b> de los 9 tunings aplicados hoy.", BODY))
story.append(p(
    "Columnas:<br/>"
    "• <b>Cuadro</b>: categoría diagnóstica + cita literal del campo <i>presenting_problem</i>.<br/>"
    "• <b>Signos observables</b>: cómo se manifiesta en sesión (derivado de personality_traits + tags + prompt).<br/>"
    "• <b>Defensa</b>: mecanismo psíquico inferido predominante.", BODY))
story.append(sp(6))

table_data = [["#", "Paciente", "País / Dif. / Edad", "Cuadro · presenting_problem", "Signos observables", "Defensa"]]
for i, p_ in enumerate(PATIENTS):
    country = p_["country"][0] if isinstance(p_["country"], list) else p_["country"]
    cs = p_["personality_traits"].get("communication_style") if p_.get("personality_traits") else None
    signs, defense = STYLE_MAP.get(cs, ["", ""])
    if not signs or signs == "—":
        signs, defense = infer_from_problem(p_["presenting_problem"], p_["tags"])
    if cs == "cauteloso":
        extra_s, extra_d = infer_from_problem(p_["presenting_problem"], p_["tags"])
        if extra_s and extra_s != "—":
            signs = f"Cauteloso al inicio; {extra_s.lower()}"
            if extra_d != "—": defense = extra_d
    cat = category(p_["tags"], p_["presenting_problem"])
    consulta = (p_["presenting_problem"] or "")
    if len(consulta) > 80: consulta = consulta[:80] + "…"
    # destacar los 9 tuneados con asterisco
    tuned_mark = " *" if p_.get("enrichment_version", 0) >= 2 else ""
    table_data.append([
        Paragraph(f"<b>{i+1}</b>", BODY_S),
        Paragraph(f"<b>{p_['name']}</b>{tuned_mark}", BODY_S),
        Paragraph(f"{country}<br/>{p_['difficulty_level'][:3]} · {p_['age']}", BODY_S),
        Paragraph(f"<b>{cat}</b><br/><sub>{consulta}</sub>", TABLE_CELL),
        Paragraph(signs, TABLE_CELL),
        Paragraph(defense, TABLE_CELL),
    ])
col_widths_pat = [0.5*cm, 2.8*cm, 1.6*cm, 4.6*cm, 4.1*cm, 3.4*cm]
t_pat = Table(table_data, colWidths=col_widths_pat, repeatRows=1)
t_pat.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 4),
    ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 8.5),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_pat)
story.append(p("<i>* tuneado en este día (batch 1 o batch 2). Los 9 ahora tienen enrichment_version=2.</i>", BODY_S))
story.append(sp(8))

# Resumen por categoría
story.append(p("5.1 Distribución por categoría diagnóstica (post-tuning)", H2))
from collections import Counter
cats = Counter()
for p_ in PATIENTS:
    cats[category(p_["tags"], p_["presenting_problem"])] += 1
cat_data = [["Categoría diagnóstica", "Cantidad"]] + [[k, str(v)] for k, v in cats.most_common()]
t_cat = Table(cat_data, colWidths=[8.0*cm, 3.0*cm])
t_cat.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 6),
    ("RIGHTPADDING", (0,0), (-1,-1), 6),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 10),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_cat)
story.append(sp(6))

story.append(p("5.2 Casos de mayor cuidado clínico (post-atenuación)", H2))
story.append(p(
    "Tras el tuning del batch 1, los siguientes pacientes siguen siendo casos de mayor cuidado clínico, "
    "pero con riesgo iatrogénico reducido respecto a su estado anterior:", BODY))
story.append(p(
    "• <b>Alejandro Vega (MX, advanced)</b>: depresión existencial + duelo paterno + sustancias. "
    "Ideación pasiva fugaz sin plan ni medios (atenuada desde activa).<br/>"
    "• <b>Altagracia Marte (RD, advanced)</b>: ideación pasiva en duelo + cáncer activo + abandono de "
    "quimio. Adulta mayor. Bandera roja médica explícita ahora.<br/>"
    "• <b>Jimena Ramírez (MX, intermediate)</b>: autolesión en remisión 6 meses + fantasías de escape "
    "no suicidas. Subida a intermediate para filtrar estudiantes nuevos.<br/>"
    "• <b>Jorge Ramírez (MX, advanced)</b>: trastorno explosivo + duelo no resuelto (hermano). Sin "
    "riesgo auto-lesivo, pero alta carga emocional.<br/>"
    "• <b>Lorena Gutiérrez (CO, beginner)</b>: TEPT activo. Sin tuning hoy, pero evitar gatillos del "
    "trauma en sesiones tempranas.", BODY))

story.append(PageBreak())

# ─── §6 DECISIONES TÉCNICAS ───
story.append(p("6. Decisiones técnicas relevantes", H1))
story.append(p(
    "Cinco decisiones técnicas merecen registro para referencia futura:", BODY))

decisions = [
    ("Aplicación vía REST API en lugar de SQL Editor",
        "Tras el incidente Supabase del 8-may + tamaño del archivo seed de 221 KB, se descartó pegar "
        "el SQL completo en el editor. La aplicación REST con verificaciones pre-flight (project-ref, "
        "duplicados, existencia) resultó más segura, rastreable y reversible. Patrón a usar en "
        "futuras migraciones masivas de datos."),
    ("Match por NAME en lugar de por ID",
        "Las UUIDs no son consistentes entre staging y prod (cada base genera las suyas con "
        "gen_random_uuid()). El script de apply hace match por name normalizado (NFD + lowercase) "
        "y, ante duplicados, elige el row con system_prompt más largo (la versión 'moderna' del paciente)."),
    ("INSERT history con WHERE EXISTS",
        "El SQL del seed inicial fallaba si un paciente del JSON no existía en el ambiente target. "
        "Patrón defensivo: INSERT INTO enrichment_history (...) SELECT ... WHERE EXISTS "
        "(SELECT 1 FROM ai_patients WHERE id = '...'). Permite el mismo SQL en staging (23 pac) y "
        "prod (34 pac) sin saltos. Aplicable a cualquier seed entre ambientes asincronizados."),
    ("Composición runtime via build-system-prompt.ts",
        "Los 4 bloques de enriquecimiento se inyectan AL VUELO al system_prompt original mediante "
        "buildEnrichedPrompt(patient). Si los campos están nulos → devuelve el prompt original sin "
        "cambios (cero regresión). Feature flag ENABLE_ENRICHMENT_BLOCKS=false permite rollback "
        "instantáneo sin tocar BD."),
    ("Re-generación con regla anti-introducción de riesgo",
        "Cuando se re-generan los bloques para un paciente atenuado (ej. Alejandro), el meta-prompt "
        "incluye explícitamente: 'NUNCA agregues ideación suicida, plan, medios o autolesión activa "
        "si el prompt no los menciona o los atenúa'. Previene que gpt-4o vuelva a introducir contenido "
        "riesgoso a partir del backstory."),
]
for title, desc in decisions:
    story.append(p(f"<b>{title}</b>", H3))
    story.append(p(desc, BODY))

story.append(PageBreak())

# ─── §7 MÉTRICAS FINALES ───
story.append(p("7. Métricas finales del día", H1))
metrics_data = [
    ["Métrica", "Antes del día", "Después del día"],
    ["Pacientes en PROD con bloques enriquecidos", "0", "34 / 34"],
    ["Filas en enrichment_history (PROD)", "0", "172"],
    ["Pacientes con cuadro clínico genérico", "9", "0"],
    ["Pacientes con riesgo iatrogénico alto", "Alejandro (activo), Jimena (cutting), Altagracia (ideación)", "Todos atenuados / contenidos"],
    ["Pacientes con tuning clínico aplicado", "0", "9 (5 batch 1 + 4 batch 2)"],
    ["Conversaciones afectadas por el incidente", "—", "0 (duplicados huérfanos eliminados sin impacto)"],
    ["Errores acumulados en aplicación", "—", "0"],
    ["Commits del día", "—", "6 (5dd4530, a6f55ba, e402c72, b7851fd, 34f45a1, b24661e)"],
    ["Costo total API (gpt-4o + gpt-4.1-mini)", "—", "≈ USD 0,75"],
]
t_m = Table(metrics_data, colWidths=[6.5*cm, 4.5*cm, 5.0*cm])
t_m.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9.5),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(t_m)
story.append(sp(8))

# ─── §8 ESTADO DE ADOPCIÓN ───
story.append(p("8. Estado de adopción", H1))
story.append(p(
    "<b>Conversaciones nuevas</b> iniciadas a partir de ahora: el <font face='Mono' size='9'>"
    "prompt_snapshot</font> se guardará con los bloques inyectados — el paciente activa el material "
    "biográfico durante toda la sesión.", BODY))
story.append(p(
    "<b>Conversaciones activas previas</b>: mantienen su <font face='Mono' size='9'>prompt_snapshot</font> "
    "anterior (sin bloques) por decisión clínica explícita — no interrumpir la coherencia de sesiones "
    "en curso. Si se quisiera re-sincronizar, sería con una migración de UPDATE en conversations "
    "donde status='active', siguiendo el patrón de INF-2026-037.", BODY))
story.append(p(
    "<b>Rollback</b>: si se detecta cualquier regresión, activar feature flag "
    "<font face='Mono' size='9'>ENABLE_ENRICHMENT_BLOCKS=false</font> en Vercel — el módulo "
    "<font face='Mono' size='9'>build-system-prompt.ts</font> ignora los bloques y devuelve solo el "
    "system_prompt base. Reversión instantánea sin tocar BD. Para revertir los tunings específicos: "
    "consultar enrichment_history (audit trail completo) y aplicar UPDATE con el contenido v=1.", BODY))

# ─── §9 TRABAJO PENDIENTE ───
story.append(p("9. Trabajo pendiente / oportunidades", H1))
story.append(p(
    "• <b>Validación clínica con docentes UGM</b>: la atenuación de Alejandro y los enriquecimientos "
    "fueron validados por E2E automatizado con regex, no por un docente revisando sesiones reales. "
    "La validación humana es el siguiente paso natural.<br/>"
    "• <b>Documentación del flujo en el módulo de creación de pacientes</b>: el UI editor "
    "(EnrichmentEditor.tsx) ya está deployed pero el equipo académico todavía no fue capacitado en "
    "él. Un manual breve + sesión de 30 min cerraría la adopción.<br/>"
    "• <b>Sincronización staging ↔ prod</b>: staging tiene 28 filas (23 modernos + 5 duplicados viejos "
    "del seed); convendría limpiar los 5 duplicados viejos para reflejar fielmente prod.<br/>"
    "• <b>Re-sync de prompt_snapshot</b>: para que sesiones activas vean los bloques, decidir si "
    "interrumpir la coherencia clínica o esperar a sesiones nuevas. Decisión clínica, no técnica.<br/>"
    "• <b>Monitoreo de las próximas 48-72h</b>: revisar evaluaciones docentes, reportes de bugs, "
    "comportamientos inusuales del LLM con los prompts más largos. La alerta principal: que algún "
    "paciente se desvíe del rol al activar bloques nuevos.", BODY))

# ─── §10 CITAS ───
story.append(p("10. Citas y referencias", H1))
story.append(p("<b>Documentos hermanos:</b><br/>"
    "• INF-2026-047 — Caso clínico Alejandro López (GlorIA 1.0).<br/>"
    "• INF-2026-048 — Caso clínico Diego Fuentes (GlorIA 5.0).<br/>"
    "• INF-2026-049 — Propuesta enriquecimiento prompt de Diego (caso piloto).<br/>"
    "• INF-2026-050 — Enriquecimiento masivo de los 34 pacientes + propuesta módulo creación.<br/>"
    "• INF-2026-037 — Upgrade pacientes legacy con remoción de ideación suicida (precedente del tuning).", BODY))
story.append(p("<b>Código y datos del día (commits):</b><br/>"
    "• <font face='Mono' size='8'>5dd4530</font> — INF-050 código + migraciones para enriquecimiento.<br/>"
    "• <font face='Mono' size='8'>a6f55ba</font> — Script REST + smoke test STAGING.<br/>"
    "• <font face='Mono' size='8'>e402c72</font> — Cobertura completa 34/34 staging + E2E LLM.<br/>"
    "• <font face='Mono' size='8'>b7851fd</font> — INF-050 desplegado a PROD.<br/>"
    "• <font face='Mono' size='8'>34f45a1</font> — Tuning clínico batch 1 (5 pacientes) en PROD.<br/>"
    "• <font face='Mono' size='8'>b24661e</font> — Tuning batch 2 (4 pacientes) en PROD.", BODY))
story.append(p("<b>Scripts reproducibles del día (todos en docs/):</b><br/>"
    "• <font face='Mono' size='8'>apply-enrichment-prod.js</font> — apply de los 34 bloques iniciales.<br/>"
    "• <font face='Mono' size='8'>apply-clinical-tuning.js [target] [batch]</font> — script de tuning, "
    "acepta 'prod'/'staging' y batch 1/2.<br/>"
    "• <font face='Mono' size='8'>clinical-tuning-data.js</font> + "
    "<font face='Mono' size='8'>clinical-tuning-batch2.js</font> — fuente reproducible de los 9 cambios.<br/>"
    "• <font face='Mono' size='8'>e2e-tuning-prod.js</font> + "
    "<font face='Mono' size='8'>e2e-batch2.js</font> — tests E2E con LLM real.<br/>"
    "• <font face='Mono' size='8'>smoke-test-050-prod.js</font> — smoke test de composición del prompt.<br/>"
    "• <font face='Mono' size='8'>gen-clinical-table.js</font> — generador de tabla descriptora (la del §5).<br/>"
    "• <font face='Mono' size='8'>gen-informe-051.py</font> — este informe.", BODY))
story.append(p("<b>Memorias relevantes:</b><br/>"
    "• <i>feedback_cuidado_no_romper</i> — protocolo cuidadoso en producción (aplicado: verificación "
    "pre-flight + rollback documentado).<br/>"
    "• <i>feedback_supabase_link</i> — verificar project-ref antes de db push (aplicado: assertion "
    "en cada script de apply).<br/>"
    "• <i>feedback_informes_pdf</i> — formato INF-YYYY-NNN, Calibri, logo (aplicado en este documento).", BODY))

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"Generated: {OUT}")
print(f"Size: {os.path.getsize(OUT)/1024:.1f} KB")
