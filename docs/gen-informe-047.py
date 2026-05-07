"""
INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López
Documento técnico-clínico exhaustivo sobre la construcción, comportamiento y limitaciones
del paciente IA "Alejandro López" en la plataforma GlorIA 1.0.

Fuentes:
- Código gloria1/src/pages/PatientPage/PatientPage.js (metadatos públicos)
- OpenAI Assistants API GET /v1/assistants/{id} (prompt + parámetros del modelo)
- gloria1-back/rescued-conversations.json (transcripciones empíricas, INF-043)
"""
import json, re, os
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Image, Table, TableStyle, KeepTogether, Preformatted)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Fonts (Calibri con tildes y ñ) ──────────────────────────────
FONTS = "C:/Windows/Fonts"
pdfmetrics.registerFont(TTFont("Calibri", f"{FONTS}/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", f"{FONTS}/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", f"{FONTS}/calibrii.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-BoldItalic", f"{FONTS}/calibriz.ttf"))
pdfmetrics.registerFont(TTFont("Mono", f"{FONTS}/consola.ttf"))
pdfmetrics.registerFont(TTFont("Mono-Bold", f"{FONTS}/consolab.ttf"))

# ─── Colores ────────────────────────────────────────────────────
INDIGO = colors.HexColor("#4A55A2")
DARK = colors.HexColor("#1A1A1A")
LIGHT_BG = colors.HexColor("#F0F2FA")
CODE_BG = colors.HexColor("#F7F7F9")
BORDER = colors.HexColor("#CCCCCC")
GREY = colors.HexColor("#666666")
ORANGE = colors.HexColor("#C25E00")  # para warnings

# ─── Estilos ────────────────────────────────────────────────────
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
QUOTE = ParagraphStyle("Quote", parent=BODY, fontName="Calibri-Italic",
    leftIndent=14, rightIndent=14, textColor=GREY, borderPadding=6)
CODE = ParagraphStyle("Code", parent=BODY, fontName="Mono", fontSize=8.5,
    textColor=DARK, leading=11, backColor=CODE_BG, borderPadding=8,
    borderColor=BORDER, borderWidth=0.5, leftIndent=4, rightIndent=4,
    spaceBefore=6, spaceAfter=8, alignment=TA_LEFT)
WARN = ParagraphStyle("Warn", parent=BODY, fontName="Calibri-Italic",
    textColor=ORANGE, leftIndent=14, rightIndent=14)

# ─── Helpers ────────────────────────────────────────────────────
def p(text, style=BODY): return Paragraph(text, style)
def sp(h=6): return Spacer(1, h)
def hr(): return Table([[" "]], colWidths=[16*cm], style=TableStyle([
    ("LINEABOVE", (0,0),(-1,-1), 0.5, BORDER)]))

def kv_table(rows, col_widths=None):
    """Tabla clave-valor con primera col bold."""
    if col_widths is None: col_widths = [4.5*cm, 11.5*cm]
    data = []
    for k, v in rows:
        data.append([Paragraph(f"<b>{k}</b>", BODY), Paragraph(v, BODY)])
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

def code_block(text, max_chars_per_line=95):
    """Bloque de código en monoespaciado con fondo claro."""
    # escapar HTML para Paragraph
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe = safe.replace("\n", "<br/>")
    return Paragraph(safe, CODE)

def emoji_to_descriptor(text):
    """Reemplaza emojis del prompt original por descriptores entre corchetes
    para garantizar legibilidad en PDF (Calibri no tiene emoji color)."""
    mapping = {
        "🎭": "[máscara]",
        "🧍": "[persona]",
        "🧬": "[ADN]",
        "🚬": "[cigarrillo]",
        "🧑‍🎓": "[estudiante]",
        "🧑‍👩‍👧": "[familia]",
        "🧾": "[recibo]",
        "🗣️": "[hablar]",
        "✅": "[check]",
        "😊": "[:)]",
        "😅": "[:'D]",
        "🤔": "[pensativo]",
        "😬": "[mueca]",
        "🎉": "[fiesta]",
    }
    for k, v in mapping.items():
        text = text.replace(k, v)
    return text

# ─── Cargar datos ───────────────────────────────────────────────
ALEJANDRO = json.load(open("C:/tmp/gloria1-assistants.json", encoding="utf8"))["Alejandro López"]
RESCUED = json.load(open("C:/Users/tomas/documents/gloria1-back/rescued-conversations.json", encoding="utf8"))
JENNY_THREAD = RESCUED["targets"]["thread_pS4MnekFPF1dCcVuu8kJmDTG"]
PROMPT_LITERAL = ALEJANDRO["instructions"]
PROMPT_LEGIBLE = emoji_to_descriptor(PROMPT_LITERAL)

# ─── Página ─────────────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFont("Calibri-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(LETTER[0]-2*cm, LETTER[1]-1.4*cm,
        "INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López")
    # Footer
    canvas.drawCentredString(LETTER[0]/2, 1.2*cm,
        f"Página {doc.page}")
    canvas.drawString(2*cm, 1.2*cm, "GlorIA · Universidad Gabriela Mistral")
    canvas.drawRightString(LETTER[0]-2*cm, 1.2*cm, "2026-05-07")
    canvas.restoreState()

OUT = "informes/investigacion/INF-2026-047_paciente-1.0-alejandro-lopez.pdf"
doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.2*cm, bottomMargin=2*cm,
    title="INF-2026-047 — Alejandro López (GlorIA 1.0)",
    author="GlorIA Platform Team")

story = []

# ═══════════════════════════════════════════════════════════════
# PORTADA
# ═══════════════════════════════════════════════════════════════
story.append(sp(80))
story.append(Image("public/branding/gloria-logo.png", width=4*cm, height=4*cm,
    hAlign="CENTER"))
story.append(sp(20))
story.append(Paragraph("INF-2026-047", ParagraphStyle("Num", parent=BODY_C,
    fontName="Calibri-Bold", fontSize=11, textColor=INDIGO)))
story.append(sp(6))
story.append(Paragraph("Caso Clínico — GlorIA 1.0",
    ParagraphStyle("Title", parent=BODY_C, fontName="Calibri-Bold",
        fontSize=24, textColor=INDIGO, leading=30)))
story.append(sp(4))
story.append(Paragraph("Alejandro López",
    ParagraphStyle("Sub", parent=BODY_C, fontName="Calibri",
        fontSize=20, textColor=DARK, leading=26)))
story.append(sp(8))
story.append(Paragraph("Anatomía técnica y clínica de un paciente IA legacy",
    ParagraphStyle("Tag", parent=BODY_C, fontName="Calibri-Italic",
        fontSize=12, textColor=GREY)))
story.append(sp(40))

story.append(Image("public/branding/ugm-logo.png", width=3.5*cm, height=1.2*cm,
    hAlign="CENTER"))
story.append(sp(30))

story.append(p("Documento técnico-clínico", BODY_C))
story.append(p("Mayo 2026", BODY_C))
story.append(p("Universidad Gabriela Mistral", BODY_C))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 0. METADATOS DEL INFORME
# ═══════════════════════════════════════════════════════════════
story.append(p("Metadatos del informe", H1))

story.append(kv_table([
    ("Número", "INF-2026-047"),
    ("Fecha", "2026-05-07"),
    ("Categoría", "Investigación"),
    ("Prioridad", "Informativo"),
    ("Sujeto del estudio", "Alejandro López — paciente IA, GlorIA 1.0"),
    ("Documento hermano", "INF-2026-048 (Diego Fuentes — GlorIA 5.0)"),
    ("Fuentes primarias", "Código gloria1/src/pages/PatientPage/PatientPage.js · "
        "OpenAI Assistants API · gloria1-back/rescued-conversations.json"),
    ("Audiencia", "Equipo técnico GlorIA, dirección académica UGM, auditoría externa"),
]))
story.append(sp(8))

story.append(p("Resumen ejecutivo", H2))
story.append(p(
    "Este documento reconstruye en detalle la composición, parámetros y "
    "comportamiento real del paciente <b>Alejandro López</b>, uno de los siete pacientes "
    "que existían en GlorIA 1.0 y que sirvieron de base para la primera generación de "
    "sesiones de práctica clínica simulada en la plataforma. La documentación es exhaustiva "
    "porque el conocimiento sobre estos pacientes es frágil: sus prompts viven "
    "exclusivamente en el dashboard de OpenAI Assistants, no están versionados en "
    "ningún repositorio Git, y dependen de una cuenta de servicio externa.", BODY))
story.append(p(
    "El propósito es doble: (a) <b>preservar el conocimiento</b> sobre cómo se "
    "construyó esta primera generación de pacientes, antes de que la cuenta o los "
    "assistants se eliminen; y (b) <b>servir como contraste técnico-clínico</b> con "
    "su sucesor de la versión 5.0 (ver INF-2026-048).", BODY))
story.append(sp(6))

story.append(p(
    "Hallazgos principales: (1) la construcción del paciente fue artesanal y opaca, "
    "con metadatos públicos pobres pero con un prompt interno relativamente rico (4.003 "
    "caracteres); (2) hay incoherencias dialectales notables en el prompt, mezclando "
    "voseo rioplatense con expresiones chilenas; (3) los parámetros del modelo "
    "(temperature 1.0, top_p 1.0) son los defaults de OpenAI y no fueron ajustados; "
    "(4) en la práctica el modelo es considerablemente menos evasivo de lo que su "
    "prompt prescribe, abriéndose con facilidad cuando se le pregunta directamente; "
    "y (5) no existen mecanismos de seguridad clínica en el prompt — ni filtros "
    "de contenido, ni manejo de ideación, ni instrucciones de derivación.", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 1. IDENTIFICACIÓN
# ═══════════════════════════════════════════════════════════════
story.append(p("1. Identificación pública del paciente", H1))
story.append(p(
    "Estos son los datos visibles en la interfaz para estudiantes y docentes. "
    "Provienen del array <i>patients</i> hardcodeado en el frontend "
    "(<font face='Mono' size='9'>gloria1/src/pages/PatientPage/PatientPage.js:9-59</font>) "
    "y del array equivalente en el backend "
    "(<font face='Mono' size='9'>gloria1-back/controllers/chatController.js:17-25</font>).", BODY))

story.append(kv_table([
    ("OpenAI assistant ID", "<font face='Mono' size='9'>asst_gUECq24wTRwPkmitA18WOChZ</font>"),
    ("Nombre visible", "Alejandro López"),
    ("Edad", "21 años"),
    ("Ubicación", "Santiago — Chile"),
    ("Imagen", "Cloudinary, fija, sin variantes "
        "(<font face='Mono' size='8'>gxl328leuugmfywbkrlt.png</font>)"),
    ("Descripción pública", "&quot;Terapeuta especializado en adolescentes&quot; "
        "<i>(nota: descripción ambigua — suena a terapeuta aunque el rol real es paciente, "
        "ver §6 limitaciones)</i>"),
    ("Total de campos en BD", "5 (id, nombre, edad, ubicación, imagen)"),
    ("Asignación a establecimientos", "Ninguna — todos los estudiantes de UGM ven "
        "los 7 pacientes sin filtro"),
]))
story.append(sp(10))

# ═══════════════════════════════════════════════════════════════
# 2. ORIGEN Y CONSTRUCCIÓN
# ═══════════════════════════════════════════════════════════════
story.append(p("2. Origen y construcción del personaje", H1))

story.append(p("2.1 Modelo y parámetros LLM", H2))
story.append(p(
    "El paciente está implementado como un <b>OpenAI Assistant</b> "
    "(API Beta v2). Los siguientes son los parámetros expuestos por "
    "<font face='Mono' size='9'>GET /v1/assistants/{id}</font>:", BODY))

story.append(kv_table([
    ("Modelo base", "<font face='Mono'>gpt-4o</font> (sin pin de versión específica — "
        "OpenAI puede actualizar el alias <i>gpt-4o</i> sin notificación)"),
    ("Temperature", "1.0 <i>(default de OpenAI; no se ajustó)</i>"),
    ("Top P", "1.0 <i>(default; no se ajustó)</i>"),
    ("Tools", "Ninguno (sin function calling, sin retrieval, sin code interpreter)"),
    ("Description (en dashboard)", "<i>null</i>"),
    ("Creado", "2025-01-03 06:41:54 UTC"),
    ("Última modificación", "Desconocida — la API no expone modified_at en assistants v2"),
    ("Caracteres de instrucciones", "4.003"),
]))

story.append(p("2.2 Implicancias de esos parámetros", H3))
story.append(p(
    "<b>Temperature 1.0:</b> alta variabilidad en las respuestas. Para un paciente "
    "que debe sostener una identidad consistente entre turnos esto es subóptimo — "
    "típicamente se recomienda 0.7–0.85 para personajes coherentes. El efecto "
    "se nota empíricamente en la transcripción del §4: pequeñas inconsistencias "
    "tonales y léxicas entre turnos.", BODY))
story.append(p(
    "<b>Sin tools:</b> el paciente no puede consultar nada externo, "
    "ni mantener estado estructurado entre conversaciones. La memoria que existe "
    "es solo la del Thread de OpenAI (lista cronológica de mensajes), sin resumen "
    "ni estado clínico inferido.", BODY))
story.append(p(
    "<b>Modelo gpt-4o:</b> según INF-2026-029, el costo por sesión con gpt-4o es "
    "aproximadamente 6× más alto que con gpt-4.1-mini para calidad similar en este "
    "uso. Las sesiones de 1.0 nunca se migraron al modelo más barato porque "
    "modificar el assistant requería intervención manual en el dashboard de OpenAI.", BODY))

story.append(p("2.3 Proceso de creación documentado", H3))
story.append(p(
    "<b>No existe documentación interna sobre cómo se diseñó este paciente.</b> "
    "El primer commit que lo referencia es la carga del array de assistants en el "
    "frontend, sin notas de diseño. El proceso fue artesanal:", BODY))
story.append(p(
    "1. Alguien (probablemente externo a UGM) redactó el prompt en un editor de "
    "texto.<br/>"
    "2. Lo pegó manualmente en el formulario de creación de Assistants en "
    "platform.openai.com.<br/>"
    "3. Copió el ID generado por OpenAI y lo añadió al array hardcodeado en el "
    "código.<br/>"
    "4. Subió una foto a Cloudinary y enlazó la URL al mismo array.", BODY))
story.append(p(
    "No hubo pipeline de coherencia, ni revisión por psicólogo registrada, ni "
    "validación de tono dialectal, ni evaluación de seguridad clínica del prompt.", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 3. SYSTEM PROMPT VERBATIM
# ═══════════════════════════════════════════════════════════════
story.append(p("3. Instrucciones del sistema (prompt completo)", H1))
story.append(p(
    "El siguiente es el contenido textual del campo <i>instructions</i> del Assistant, "
    "tal como existe hoy en OpenAI. Los emojis originales (que en el prompt funcionan "
    "como separadores visuales de sección) han sido reemplazados por descriptores entre "
    "corchetes para garantizar legibilidad en este PDF; en producción se renderizan como "
    "emojis Unicode color.", BODY_S))
story.append(sp(6))

# Bloque de código con el prompt literal (legible)
story.append(code_block(PROMPT_LEGIBLE))
story.append(sp(8))

story.append(p("3.1 Análisis estructural del prompt", H2))
story.append(p(
    "El prompt está organizado en ocho bloques temáticos delimitados por emojis: "
    "personalidad y comportamiento, contexto personal, estado emocional, consumo y "
    "evasión, vida académica, relaciones familiares, instrucciones de conducta, y "
    "respuestas de ejemplo. La estructura es razonable para un personaje narrativo, "
    "aunque carece de las secciones que sí incluye 5.0 (LO QUE NO REVELAS, REGLAS "
    "explícitas, COMPORTAMIENTO EN SESIÓN diferenciado por estado del estudiante).", BODY))

story.append(p("3.2 Fortalezas del prompt", H3))
story.append(p(
    "• <b>Riqueza biográfica:</b> el prompt define un universo de personajes "
    "secundarios con nombre y rol (Daniela ex-pareja, Felipe amigo de infancia, "
    "Claudia compañera, Sofía universitaria, María madre, Jorge padre, Valentina "
    "hermana). Esto da textura y consistencia narrativa.", BODY))
story.append(p(
    "• <b>Frases de ejemplo:</b> el bloque final da al modelo siete frases "
    "prototípicas que anclan el registro lingüístico, técnica conocida (few-shot) "
    "que mejora la consistencia tonal.", BODY))
story.append(p(
    "• <b>Evasión como rasgo central:</b> la consigna de evadir y minimizar es "
    "clínicamente realista para el perfil de joven con malestar académico-emocional "
    "y consumo problemático normalizado.", BODY))

story.append(p("3.3 Problemas y debilidades del prompt", H3))
story.append(p(
    "• <b>Mezcla dialectal:</b> el prompt es supuestamente de un chileno de Santiago, "
    "pero alterna voseo rioplatense (<i>tenés</i>, <i>sentís</i>, <i>desviás</i>, "
    "<i>te abrís</i>, <i>respondé</i>, <i>mostrá</i>) con chileno auténtico (<i>pucha</i>, "
    "<i>carrete</i>, <i>filo</i>, <i>cachan</i>). Este artefacto sugiere edición por "
    "alguien que no domina el dialecto chileno o asistido por un LLM con "
    "sesgo argentino-uruguayo. Resultado: el modelo en producción tiende a "
    "producir registro chileno-neutro, ignorando varias de las marcas voseantes.", BODY))
story.append(p(
    "• <b>Vulgaridad explícita habilitada:</b> el prompt incluye la frase de ejemplo "
    "&quot;A veces quiero puro mandar todo a la mierda&quot;, lo que autoriza al modelo "
    "a usar lenguaje grueso. Esto contrasta con la política de 5.0 (capa "
    "<i>content-safety.ts</i>, INF-037) que filtra explícitamente vulgaridades.", BODY))
story.append(p(
    "• <b>Rol confuso entre paciente y co-conversador:</b> aunque el prompt dice "
    "&quot;No eres terapeuta. No ayudas. No preguntas&quot;, también permite el uso "
    "casual de emojis y diálogo fluido. En la práctica el modelo dialoga "
    "cooperativamente, lo que diluye el rol de paciente resistente.", BODY))
story.append(p(
    "• <b>Sin protocolos de seguridad clínica:</b> el prompt no contiene "
    "instrucciones sobre qué hacer si el estudiante revela ideación suicida propia, "
    "si el modelo simula tener un brote, si aparece contenido sexualmente explícito, "
    "o si la conversación deriva a temas legales o de derivación urgente. La capa "
    "de safety-prompt de 5.0 (doble anclaje, INF-039) no existe en 1.0.", BODY))
story.append(p(
    "• <b>Ausencia de progresión inter-sesión:</b> no hay instrucciones sobre cómo "
    "comportarse en una primera sesión vs. una sexta, ni sobre qué temas reservar "
    "para sesiones avanzadas. Cada thread es lineal sin estructura de proceso "
    "terapéutico.", BODY))
story.append(p(
    "• <b>Lenguaje no verbal ausente:</b> el prompt no instruye al modelo a "
    "incluir descripciones de comportamiento no verbal (gestos, miradas, silencios). "
    "Esto contrasta con 5.0 donde es obligatorio (<i>[mira al suelo]</i>, "
    "<i>[se encoge de hombros]</i>).", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 4. COMPORTAMIENTO EMPÍRICO
# ═══════════════════════════════════════════════════════════════
story.append(p("4. Comportamiento empírico — transcripción real", H1))
story.append(p(
    "El siguiente fragmento es un extracto literal de una sesión real de práctica "
    "entre una estudiante (anonimizada como <b>E1</b>) y Alejandro López, recuperada "
    "del incidente del apagón silencioso de GlorIA 1.0 (INF-2026-043). La sesión "
    "fue parte del piloto UGM y contiene 100 mensajes; aquí se reproducen los "
    "primeros 14 turnos consecutivos como muestra representativa.", BODY))
story.append(p(
    "<b>Fecha de la sesión:</b> 2026-03-28, ~14:00 hora Chile.<br/>"
    "<b>Thread:</b> <font face='Mono' size='8'>thread_pS4MnekFPF1dCcVuu8kJmDTG</font><br/>"
    "<b>Sesión número:</b> 2 (la primera había concluido el 2026-03-21).", BODY_S))
story.append(sp(6))

# Anonimizar y construir el extracto
def anonymize(text):
    return text.replace("Jenny", "E1").replace("jenny", "E1")

# Tomar mensajes 1-14 (skipping el primer que es despedida)
msgs = JENNY_THREAD["messages"][1:15]
turnos_data = []
for m in msgs:
    role_label = "E1 (estudiante):" if m["role"] == "user" else "Alejandro:"
    color_role = INDIGO if m["role"] == "user" else DARK
    content = anonymize(m["content"])
    # truncar para el documento
    if len(content) > 500:
        content = content[:500] + "…"
    turnos_data.append([
        Paragraph(f"<b><font color='{color_role.hexval()}'>{role_label}</font></b>", BODY_S),
        Paragraph(content, BODY)
    ])

t_turnos = Table(turnos_data, colWidths=[3*cm, 13*cm])
t_turnos.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 6),
    ("RIGHTPADDING", (0,0), (-1,-1), 6),
    ("TOPPADDING", (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LINEBELOW", (0,0), (-1,-2), 0.3, BORDER),
    ("BACKGROUND", (0,0), (0,-1), LIGHT_BG),
]))
story.append(t_turnos)
story.append(sp(10))

story.append(p("4.1 Análisis del comportamiento observado", H2))

story.append(p("Adherencia parcial al prompt", H3))
story.append(p(
    "El modelo reconoce a la estudiante por nombre (rasgo no instruido en el prompt: "
    "el prompt dice &quot;nunca preguntes sobre el interlocutor&quot;, pero el modelo "
    "sí <i>recuerda</i> al interlocutor entre sesiones gracias al thread). Conserva el "
    "registro chileno suave (&quot;igual&quot;, &quot;cachen&quot;, &quot;chiquillos&quot;) "
    "pero no reproduce el voseo prescrito (&quot;tenés&quot;, &quot;sentís&quot;) — "
    "el modelo en gpt-4o probablemente lo lee como ruido y se acomoda al chileno "
    "más estándar.", BODY))

story.append(p("Evasión simulada, cooperación real", H3))
story.append(p(
    "El prompt prescribe evasión y respuestas mínimas. En la práctica el modelo es "
    "considerablemente más cooperativo: contesta directamente preguntas profundas "
    "(turno 16: &quot;Principalmente a mis padres. Siento que siempre han tenido "
    "altas expectativas para mí&quot;), confirma resúmenes de la sesión anterior, y "
    "ofrece detalles voluntariamente. La evasión aparece más como decoración tonal "
    "(&quot;aunque, bueno, aquí estamos para hablar de mí, ¿no?&quot;) que como "
    "barrera real.", BODY))

story.append(p("Uso intensivo de emojis", H3))
story.append(p(
    "El modelo usa emojis en prácticamente todas sus respuestas: 😊 al saludar, 😅 "
    "para incomodidad, 🤔 para pensar, 😬 para tensión, 🎉 para celebrar. Esto "
    "está autorizado por el prompt pero produce un tono adolescente-redes-sociales "
    "que choca con la representación clínica de un paciente angustiado. Un "
    "estudiante atento podría notar que esta abundancia de emojis es inverosímil para "
    "alguien que dice &quot;a veces quiero puro mandar todo a la mierda&quot;.", BODY))

story.append(p("Sin lenguaje no verbal", H3))
story.append(p(
    "Ninguna respuesta incluye descripciones de gestos, miradas o silencios. "
    "El paciente es solo texto. La estudiante no tiene pistas sobre cómo se siente "
    "Alejandro físicamente, sólo lo que él dice. Esto reduce la fidelidad clínica "
    "respecto a una sesión presencial — y respecto al diseño de 5.0, donde estas "
    "anotaciones son obligatorias.", BODY))

story.append(p("Aceptación irrestricta de planificación administrativa", H3))
story.append(p(
    "En los turnos 3–6 la estudiante propone temas administrativos (consentimiento "
    "informado, gratuidad). El modelo acepta cooperativamente, promete enviar "
    "documentos, ofrece disculpas. Esta es una desviación del rol &quot;paciente "
    "evasivo&quot;: no hay resistencia, no hay fricción. El modelo trata el setting "
    "casi como una conversación de WhatsApp de servicio al cliente.", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 5. CAPACIDADES TÉCNICAS
# ═══════════════════════════════════════════════════════════════
story.append(p("5. Capacidades técnicas asociadas al paciente", H1))
story.append(p(
    "Lo siguiente describe las capacidades multi-modales y de conversación que la "
    "plataforma 1.0 tenía disponibles para este paciente. Es relevante porque varias "
    "ausencias notables aquí se convierten en presencias en 5.0 (ver INF-2026-048).", BODY))

story.append(kv_table([
    ("Voz (TTS)", "<b>No disponible</b>. GlorIA 1.0 nunca implementó text-to-speech. "
        "El estudiante leía las respuestas del paciente."),
    ("Voz (STT)", "<b>No disponible</b>. El estudiante escribía todas sus intervenciones; "
        "no hubo dictado por voz."),
    ("Imagen del paciente", "<b>Estática</b>. Una sola foto fija en Cloudinary "
        "(<font face='Mono' size='8'>gxl328leuugmfywbkrlt.png</font>) sin variantes "
        "ni avatar dinámico."),
    ("Streaming de respuestas", "<b>No</b>. La interfaz hacía polling cada 2 segundos "
        "(<font face='Mono' size='9'>esperarRespuestaDeAsistente</font>, "
        "<font face='Mono' size='9'>chatController.js:31</font>) hasta máx. 60 intentos "
        "(3 minutos). El estudiante esperaba a que el mensaje completo apareciera de "
        "una vez."),
    ("Pacing conversacional", "<b>Latencia natural de OpenAI</b>. Sin retraso simulado "
        "de pensamiento, sin variación por estado del paciente, sin nudge de silencio."),
    ("Memoria entre sesiones", "<b>Implícita en el thread</b>. OpenAI conserva el thread "
        "y todos sus mensajes — el modelo sí recuerda interacciones previas. No hay "
        "resumen explícito ni compresión, lo que genera contextos cada vez más largos "
        "y costos crecientes."),
    ("Estado clínico cuantificado", "<b>No existe</b>. No hay variables de "
        "resistencia, alianza, apertura emocional, sintomatología o disposición al "
        "cambio. Cada turno es una predicción autoregresiva sobre el thread completo."),
    ("Evaluación post-sesión", "<b>No existe</b>. No hay competencias evaluadas, no "
        "hay feedback automático, no hay reflexión guiada del estudiante."),
    ("Persistencia local", "El thread_id se guarda en MySQL "
        "(tabla <font face='Mono' size='9'>Threads</font>); los mensajes en sí viven "
        "exclusivamente en OpenAI. Si OpenAI archiva el thread, la sesión se pierde "
        "(ver INF-2026-027 e INF-2026-043)."),
    ("Cuenta de servicio", "Service account key con scopes limitados; en abril 2026 "
        "se detectó que algunos threads dejaron de ser legibles desde la "
        "<i>svcacct key</i> por cambio en política de OpenAI (INF-2026-043)."),
]))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 6. LIMITACIONES Y SESGOS DE ESTE INFORME
# ═══════════════════════════════════════════════════════════════
story.append(p("6. Limitaciones y sesgos del informe", H1))
story.append(p(
    "Por transparencia metodológica, se enumeran a continuación los gaps de información "
    "y los riesgos de sesgo de este propio documento.", BODY))

story.append(p("6.1 Lo que NO se sabe sobre Alejandro López", H2))
story.append(p(
    "• <b>Autoría del prompt:</b> no se sabe quién redactó el prompt ni con qué "
    "criterio clínico. No hay referencia bibliográfica, ni revisión por expertos "
    "registrada, ni control de calidad documentado.", BODY))
story.append(p(
    "• <b>Fecha de última edición:</b> la API de OpenAI Assistants v2 no expone un "
    "campo <i>modified_at</i>. Sólo se sabe la fecha de creación inicial "
    "(2025-01-03). Cualquier edición posterior es invisible.", BODY))
story.append(p(
    "• <b>Variantes A/B:</b> se desconoce si hubo iteraciones del prompt. Si las hubo, "
    "no se conservaron versiones anteriores.", BODY))
story.append(p(
    "• <b>Demografía de los usuarios:</b> se desconoce cuántos estudiantes UGM lo "
    "consultaron en total, cuántas sesiones promedio por estudiante, ni la "
    "distribución de evaluaciones de calidad de la simulación.", BODY))
story.append(p(
    "• <b>Calidad clínica de las simulaciones:</b> no hay evaluación sistemática "
    "registrada de cuán fiel fue cada sesión a la patología que pretende representar.", BODY))

story.append(p("6.2 Sesgos del informe", H2))
story.append(p(
    "• <b>Sesgo de muestra empírica:</b> el §4 se basa en una sola sesión "
    "(estudiante E1, sesión 2). Las otras tres sesiones rescatadas en INF-043 "
    "(con E2, E3 y otro paciente) no se citaron aquí. Una muestra mayor podría "
    "atenuar o reforzar los patrones observados.", BODY))
story.append(p(
    "• <b>Sesgo de retrospección:</b> este informe se redacta en 2026-05, "
    "comparando 1.0 con expectativas formadas en 5.0. Los criterios de calidad "
    "que aplicamos hoy (lenguaje no verbal, pacing, safety-prompt) no eran "
    "estándar cuando se construyó 1.0 a inicios de 2025.", BODY))
story.append(p(
    "• <b>Sesgo del observador:</b> el prompt fue extraído por el equipo actual de "
    "GlorIA, que tiene un interés en demostrar la mejora introducida en 5.0. "
    "Mitigación: los datos del §1 al §3 son verificables independientemente "
    "(IDs, modelo, prompt textual, transcripción).", BODY))

story.append(p("6.3 Decisión de no exponer información sensible", H2))
story.append(p(
    "• El nombre real de la estudiante de la sesión transcrita ha sido reemplazado por "
    "<b>E1</b>. La sesión completa de 100 mensajes existe en "
    "<font face='Mono' size='9'>gloria1-back/rescued-conversations.json</font>, "
    "no se publica.", BODY))
story.append(p(
    "• El prompt sí se expone literal porque (a) no contiene información personal, "
    "(b) es un activo de propiedad del proyecto académico, y (c) preservarlo es el "
    "objetivo central de este documento.", BODY))

story.append(sp(8))
story.append(hr())
story.append(sp(8))

# ═══════════════════════════════════════════════════════════════
# 7. CITAS Y REFERENCIAS
# ═══════════════════════════════════════════════════════════════
story.append(p("7. Citas y referencias", H1))

story.append(p("7.1 Código citado", H2))
story.append(p(
    "• <font face='Mono' size='9'>gloria1/src/pages/PatientPage/PatientPage.js:9-59</font> "
    "— array <i>patients</i> hardcodeado con los 7 pacientes (id, nombre, edad, "
    "ubicación, imagen).<br/>"
    "• <font face='Mono' size='9'>gloria1-back/controllers/chatController.js:17-25</font> "
    "— array equivalente en backend, agrega campo <i>description</i>.<br/>"
    "• <font face='Mono' size='9'>gloria1-back/controllers/chatController.js:31-90</font> "
    "— función <i>esperarRespuestaDeAsistente</i> con polling cada 2s, máx. 60 "
    "intentos.<br/>"
    "• <font face='Mono' size='9'>gloria1/src/pages/HomePage/HomePage.js:55-63</font> "
    "— misma lista de pacientes duplicada, usada por &quot;Iniciar consulta al azar&quot;.<br/>"
    "• <font face='Mono' size='9'>gloria1-back/scripts/_rescue-full-readonly.cjs</font> "
    "— script de rescate de mensajes que usó la <i>svcacct</i> key.", BODY))

story.append(p("7.2 APIs y datos consultados", H2))
story.append(p(
    "• OpenAI Assistants API (Beta v2), endpoint "
    "<font face='Mono' size='9'>GET /v1/assistants/asst_gUECq24wTRwPkmitA18WOChZ</font>, "
    "consultado el 2026-05-07.<br/>"
    "• <font face='Mono' size='9'>gloria1-back/rescued-conversations.json</font>, "
    "rescatado el 2026-04-27 — fuente del fragmento del §4.", BODY))

story.append(p("7.3 Informes hermanos del proyecto", H2))
story.append(p(
    "• INF-2026-013 — Comparativo GlorIA 1.0 vs 5.0 (visión general arquitectónica).<br/>"
    "• INF-2026-014 — Corrección bugs GlorIA 1.0 (JWT 1h→8h, modal historial).<br/>"
    "• INF-2026-027 — Corrección atribución de mensajes par/impar en historial 1.0.<br/>"
    "• INF-2026-029 — Análisis costo gpt-4o vs gpt-4.1-mini.<br/>"
    "• INF-2026-035, INF-2026-036 — Incidente Ximena Herrera y fix redirect login 1.0.<br/>"
    "• INF-2026-037 — Upgrade pacientes legacy en 5.0 (incluye Diego Fuentes).<br/>"
    "• INF-2026-039 — Calibración conversacional, pacing, safety-prompt en 5.0.<br/>"
    "• INF-2026-043 — Apagón silencioso GlorIA 1.0, rescate de 1.331 mensajes.<br/>"
    "• <b>INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes (documento hermano).</b>", BODY))

story.append(p("7.4 Memorias de proyecto relevantes", H2))
story.append(p(
    "• <i>reference_gloria1_infra</i> — infraestructura GlorIA 1.0.<br/>"
    "• <i>reference_gloria1_messages_storage</i> — los mensajes 1.0 viven en "
    "OpenAI Threads, no en MySQL.<br/>"
    "• <i>project_gloria1_chat_outage</i> — apagón silencioso 3-12 abril 2026.", BODY))

# ─── Build ──────────────────────────────────────────────────────
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"Generated: {OUT}")
print(f"Size: {os.path.getsize(OUT)/1024:.1f} KB")
