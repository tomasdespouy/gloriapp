"""
INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes
Documento técnico-clínico exhaustivo sobre la construcción, comportamiento y limitaciones
del paciente IA "Diego Fuentes" en la plataforma GlorIA 5.0.

Fuentes:
- Supabase prod: SELECT * FROM ai_patients WHERE name = 'Diego Fuentes'
- Migraciones supabase/migrations/* (seed inicial + 18-patient batch + visual + upgrade legacy)
- Documento hermano INF-2026-047 (Alejandro López, GlorIA 1.0)
"""
import json, os
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Image, Table, TableStyle, KeepTogether)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Fonts ──────────────────────────────────────────────────────
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
GREEN = colors.HexColor("#2E7D32")
ORANGE = colors.HexColor("#C25E00")
RED_BG = colors.HexColor("#FCE9E9")  # antes: contenido removido

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
CODE = ParagraphStyle("Code", parent=BODY, fontName="Mono", fontSize=8.5,
    textColor=DARK, leading=11, backColor=CODE_BG, borderPadding=8,
    borderColor=BORDER, borderWidth=0.5, leftIndent=4, rightIndent=4,
    spaceBefore=6, spaceAfter=8, alignment=TA_LEFT)
CODE_REMOVED = ParagraphStyle("CodeR", parent=CODE, backColor=RED_BG,
    borderColor=ORANGE)

# ─── Helpers ────────────────────────────────────────────────────
def p(text, style=BODY): return Paragraph(text, style)
def sp(h=6): return Spacer(1, h)
def hr(): return Table([[" "]], colWidths=[16*cm], style=TableStyle([
    ("LINEABOVE", (0,0), (-1,-1), 0.5, BORDER)]))

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
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe = safe.replace("\n", "<br/>")
    return Paragraph(safe, style)

# ─── Datos ──────────────────────────────────────────────────────
DIEGO = json.load(open("C:/tmp/diego-fuentes.json", encoding="utf8"))[0]

# Prompt original (seed antes del upgrade) para mostrar la decisión clínica
PROMPT_ORIGINAL_FRAGMENT = """IMPORTANTE - EVALUACION DE RIESGO:
- SI el terapeuta pregunta sobre ideacion suicida de forma directa y empatica, puedes decir: "A veces pienso que seria mas facil no despertar. Pero no es que vaya a hacer algo."
- NO tienes un plan concreto
- NO has intentado nada antes
- Factores protectores: tu mama, tu perro que dejaste en casa"""

QUOTE_ORIGINAL = "Siento que no encajo en ningun lado. A veces me pregunto si tiene sentido seguir."
QUOTE_UPGRADED = DIEGO["quote"]

# ─── Página ─────────────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Calibri-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(LETTER[0]-2*cm, LETTER[1]-1.4*cm,
        "INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes")
    canvas.drawCentredString(LETTER[0]/2, 1.2*cm, f"Página {doc.page}")
    canvas.drawString(2*cm, 1.2*cm, "GlorIA · Universidad Gabriela Mistral")
    canvas.drawRightString(LETTER[0]-2*cm, 1.2*cm, "2026-05-07")
    canvas.restoreState()

OUT = "informes/investigacion/INF-2026-048_paciente-5.0-diego-fuentes.pdf"
doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.2*cm, bottomMargin=2*cm,
    title="INF-2026-048 — Diego Fuentes (GlorIA 5.0)",
    author="GlorIA Platform Team")

story = []

# ═══════════════════════════════════════════════════════════════
# PORTADA
# ═══════════════════════════════════════════════════════════════
story.append(sp(80))
story.append(Image("public/branding/gloria-logo.png", width=4*cm, height=4*cm,
    hAlign="CENTER"))
story.append(sp(20))
story.append(Paragraph("INF-2026-048", ParagraphStyle("Num", parent=BODY_C,
    fontName="Calibri-Bold", fontSize=11, textColor=INDIGO)))
story.append(sp(6))
story.append(Paragraph("Caso Clínico — GlorIA 5.0",
    ParagraphStyle("Title", parent=BODY_C, fontName="Calibri-Bold",
        fontSize=24, textColor=INDIGO, leading=30)))
story.append(sp(4))
story.append(Paragraph("Diego Fuentes",
    ParagraphStyle("Sub", parent=BODY_C, fontName="Calibri",
        fontSize=20, textColor=DARK, leading=26)))
story.append(sp(8))
story.append(Paragraph("Anatomía técnica y clínica de un paciente IA contemporáneo",
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
# 0. METADATOS
# ═══════════════════════════════════════════════════════════════
story.append(p("Metadatos del informe", H1))
story.append(kv_table([
    ("Número", "INF-2026-048"),
    ("Fecha", "2026-05-07"),
    ("Categoría", "Investigación"),
    ("Prioridad", "Informativo"),
    ("Sujeto del estudio", "Diego Fuentes — paciente IA, GlorIA 5.0"),
    ("Documento hermano", "INF-2026-047 (Alejandro López — GlorIA 1.0)"),
    ("Fuentes primarias", "Supabase prod (tabla ai_patients) · "
        "supabase/migrations/* · INF-2026-037 (upgrade legacy)"),
    ("Audiencia", "Equipo técnico GlorIA, dirección académica UGM, auditoría externa"),
]))
story.append(sp(8))

story.append(p("Resumen ejecutivo", H2))
story.append(p(
    "Este documento describe en detalle al paciente <b>Diego Fuentes</b>, uno de los "
    "34 pacientes de GlorIA 5.0. Diego pertenece a la generación de pacientes "
    "<i>legacy</i> — su versión inicial fue parte del seed de marzo 2026, y fue "
    "reescrito el 2026-04-15 (INF-2026-037) para integrarlo al estándar moderno y "
    "para resolver una preocupación clínica importante: la versión original incluía "
    "instrucciones sobre cómo simular ideación suicida pasiva, lo que se determinó "
    "incompatible con el contexto pedagógico de pregrado.", BODY))
story.append(p(
    "El paciente está construido como un registro estructurado en PostgreSQL con más "
    "de 30 campos, frente a los 5 campos hardcodeados de su predecesor en 1.0. La "
    "diferencia no es solo de cantidad: es de naturaleza. Diego tiene identidad "
    "visual parametrizada, perfil familiar tipado, perfil de personalidad numérico, "
    "perfil de pacing conversacional, y un prompt sistémico estructurado en cinco "
    "bloques formales (HISTORIA / PERSONALIDAD / COMPORTAMIENTO EN SESIÓN / LO QUE NO "
    "REVELAS / REGLAS) que se compone dinámicamente con safety-prompts adicionales "
    "antes de cada llamada al modelo.", BODY))
story.append(p(
    "Hallazgos principales: (1) la construcción es trazable, versionada en migraciones "
    "Git y reproducible; (2) el prompt está clínicamente estructurado y sigue un "
    "formato común a los 34 pacientes; (3) hay una decisión clínica explícita de "
    "remover ideación suicida del prompt simulado, documentada en INF-2026-037; "
    "(4) el paciente está parametrizado para integrarse con el motor de estado clínico "
    "(<i>clinical_state_log</i>), el pacing conversacional y la generación dinámica "
    "de identidad visual; (5) algunos campos quedan vacíos a propósito (voice_id, "
    "distinctive_factor, teacher_notes), preparados para extensiones futuras.", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 1. IDENTIFICACIÓN
# ═══════════════════════════════════════════════════════════════
story.append(p("1. Identificación del paciente", H1))
story.append(p(
    "Los siguientes datos corresponden al registro actual en producción "
    "(<font face='Mono' size='9'>SELECT * FROM ai_patients WHERE name = 'Diego Fuentes'</font>, "
    "consultado el 2026-05-07).", BODY))

story.append(kv_table([
    ("UUID", f"<font face='Mono' size='9'>{DIEGO['id']}</font>"),
    ("Nombre", DIEGO["name"]),
    ("Edad", f"{DIEGO['age']} años"),
    ("Ocupación", DIEGO["occupation"]),
    ("Cita representativa", f"&quot;{DIEGO['quote']}&quot;"),
    ("Motivo de consulta", DIEGO["presenting_problem"]),
    ("País (operativo)", str(DIEGO["country"])),
    ("Origen / residencia", f"{DIEGO['country_origin']} / {DIEGO['country_residence']}"),
    ("Barrio", DIEGO["neighborhood"]),
    ("Fecha de nacimiento", DIEGO["birthday"]),
    ("Dificultad pedagógica", DIEGO["difficulty_level"]),
    ("Sesiones planificadas", str(DIEGO["total_sessions"])),
    ("Tags clínicos", ", ".join(DIEGO["tags"])),
    ("Competencias practicadas", ", ".join(DIEGO["skills_practiced"])),
    ("Activo (visible)", "Sí" if DIEGO["is_active"] else "No"),
    ("Creado", DIEGO["created_at"][:19].replace("T", " ") + " UTC"),
    ("Última modificación", DIEGO["updated_at"][:19].replace("T", " ") + " UTC"),
]))
story.append(sp(10))

# ═══════════════════════════════════════════════════════════════
# 2. ORIGEN Y CONSTRUCCIÓN
# ═══════════════════════════════════════════════════════════════
story.append(p("2. Origen y construcción del personaje", H1))

story.append(p("2.1 Línea de tiempo de migraciones que afectan a Diego", H2))
story.append(p(
    "A diferencia del paciente de 1.0, todos los cambios al perfil de Diego están "
    "versionados en migraciones SQL del repositorio. Esto permite reconstruir su "
    "historia exacta:", BODY))

migration_data = [
    ["Fecha", "Migración", "Cambio aplicado a Diego"],
    ["2026-03-13",
     "20260313203745_seed_ai_patients.sql",
     "Inserción inicial (seed). Difficulty intermediate, 3 sesiones planificadas, "
     "incluye instrucciones de evaluación de ideación suicida pasiva."],
    ["2026-03-16",
     "20260316032447_fix_nonverbal_instructions.sql",
     "Estandarización del lenguaje no verbal en tercera persona "
     "([mira al suelo] vs [miro al suelo])."],
    ["2026-03-16",
     "20260316115606_fix_accents_all_patients.sql",
     "Corrección de tildes y ñ en todos los campos textuales."],
    ["2026-03-16",
     "20260316220000_patient_visual_identity.sql",
     "Asignación del JSONB <i>visual_identity</i> con 9 atributos visuales para "
     "generación de imagen."],
    ["2026-04-13",
     "20260413120000_upgrade_legacy_patients.sql",
     "<b>Upgrade crítico</b>: prompt reescrito al estándar moderno, "
     "<b>removida toda referencia a ideación suicida</b>, agregados barrio, fecha "
     "de nacimiento y composición familiar (INF-2026-037)."],
    ["2026-04-14",
     "20260414100000_resync_snapshots_post_upgrade.sql",
     "Re-sincronización de prompt_snapshot en conversaciones activas para que "
     "sesiones en curso usen el nuevo prompt sin interrumpir."],
    ["2026-04-14",
     "20260414160000_ai_patients_pacing_profile.sql",
     "Asignación heurística de pacing_profile = <i>conversational_medium</i> "
     "(default por no caer en categoría depresiva ni ansiosa)."],
]

t = Table(migration_data, colWidths=[2.4*cm, 5.4*cm, 8.2*cm])
t.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("FONTNAME", (1,1), (1,-1), "Mono"),
    ("FONTSIZE", (1,1), (1,-1), 7.5),
]))
story.append(t)
story.append(sp(8))

story.append(p("2.2 Pipeline de creación documentado", H3))
story.append(p(
    "Para los pacientes nuevos creados después de marzo 2026, GlorIA 5.0 define un "
    "pipeline formal de 15 pasos "
    "(<font face='Mono' size='9'>20260316165059_patient_creation_workflow.sql</font>) "
    "con campos auxiliares: <i>short_narrative</i>, <i>extended_narrative</i>, "
    "<i>coherence_review</i>, <i>projections</i>, <i>creation_step</i>. Este pipeline "
    "garantiza coherencia narrativa y revisión por etapas. Diego, al ser un paciente "
    "<i>legacy</i> (parte del seed original), no pasó por este pipeline en su "
    "creación; su upgrade del 2026-04-13 lo trajo al estándar moderno pero conservó "
    "su identidad básica.", BODY))

story.append(p("2.3 Modelo y parámetros LLM", H3))
story.append(p(
    "A diferencia de 1.0 (Assistant fijo en gpt-4o), Diego no tiene un modelo "
    "asignado a sí mismo. El modelo es global a la plataforma, controlado por "
    "variables de entorno:", BODY))
story.append(kv_table([
    ("Modelo de chat actual", "<font face='Mono'>gpt-4.1-mini</font> "
        "(<font face='Mono'>OPENAI_CHAT_MODEL</font>, INF-2026-029)"),
    ("Modelo evaluación", "<font face='Mono'>gpt-4o</font> "
        "(<font face='Mono'>OPENAI_EVAL_MODEL</font>)"),
    ("Failover", "Google Gemini 2.5 Flash si OpenAI falla (INF-2026-028)"),
    ("Temperature", "0.7 (configurable en lib/ai.ts; ajustada para coherencia narrativa)"),
    ("Streaming", "Sí, ReadableStream nativo (no polling)"),
    ("Tools", "Ninguno por ahora; safety-prompt y prompt_snapshot inyectados al system."),
]))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 3. SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════
story.append(p("3. System prompt actual (texto literal)", H1))
story.append(p(
    "El campo <font face='Mono' size='9'>system_prompt</font> en la tabla "
    "<i>ai_patients</i> contiene la siguiente cadena. En producción, esta cadena se "
    "envuelve con la capa <i>buildSafetyPrompt</i> (INF-2026-037) y se acompaña de "
    "metadatos de fecha/hora local antes de enviarse al modelo.", BODY_S))
story.append(sp(6))
story.append(code_block(DIEGO["system_prompt"]))
story.append(sp(8))

story.append(p("3.1 Estructura formal del prompt", H2))
story.append(p(
    f"El prompt tiene <b>{len(DIEGO['system_prompt'])} caracteres</b> y se organiza en "
    "5 bloques nominales:", BODY))
story.append(p(
    "• <b>HISTORIA</b> — 4 puntos, contexto biográfico mínimo necesario.<br/>"
    "• <b>PERSONALIDAD</b> — 7 puntos, rasgos disposicionales y léxico.<br/>"
    "• <b>COMPORTAMIENTO EN SESIÓN</b> — 8 puntos, instrucciones operativas turn-by-turn.<br/>"
    "• <b>LO QUE NO REVELAS FÁCILMENTE</b> — material reservado para sesión 3+ con "
    "alianza terapéutica establecida.<br/>"
    "• <b>REGLAS</b> — 8 reglas de meta-conducta (no salir del personaje, no decir "
    "que es IA, máximo 4 oraciones, lenguaje no verbal en tercera persona, etc.).", BODY))

story.append(p("3.2 Cambio crítico respecto del prompt original (seed)", H2))
story.append(p(
    "La versión original de Diego (seed del 2026-03-13) incluía un bloque adicional "
    "de evaluación de riesgo suicida que fue removido en el upgrade del 2026-04-13:", BODY))
story.append(p("Bloque <b>removido</b> en el upgrade:", BODY_S))
story.append(code_block(PROMPT_ORIGINAL_FRAGMENT, style=CODE_REMOVED))
story.append(p(
    "<b>Cita representativa removida:</b> &quot;<i>{}</i>&quot; → reemplazada por "
    "&quot;<i>{}</i>&quot;.".format(QUOTE_ORIGINAL, QUOTE_UPGRADED), BODY))
story.append(p("Justificación de la decisión clínica", H3))
story.append(p(
    "La decisión está documentada en INF-2026-037. Tres razones:", BODY))
story.append(p(
    "1. <b>Contexto pedagógico de pregrado:</b> los estudiantes que practican con "
    "Diego son alumnos de psicología (no profesionales habilitados). Una "
    "evaluación de riesgo suicida real requiere supervisión clínica, contención "
    "inmediata y derivación protocolizada — capacidades que el simulador no puede "
    "ofrecer.", BODY))
story.append(p(
    "2. <b>Riesgo de respuestas iatrogénicas del modelo:</b> aun con un prompt "
    "cuidadoso, un LLM puede producir respuestas que minimicen, banalicen o "
    "<i>romanticen</i> la ideación. El daño potencial supera el beneficio "
    "pedagógico en el contexto actual.", BODY))
story.append(p(
    "3. <b>Capa de safety global:</b> simultáneamente se introdujo "
    "<font face='Mono' size='9'>content-safety.ts</font> + "
    "<font face='Mono' size='9'>buildSafetyPrompt</font>, que filtran globalmente "
    "este tipo de contenido. La remoción a nivel de prompt es defensa en "
    "profundidad — si una capa falla, la otra contiene.", BODY))
story.append(p(
    "Las competencias practicadas también se ajustaron: el seed original incluía "
    "&quot;Evaluación de riesgo&quot; como skill, lo que se reemplazó por "
    "&quot;Manejo de silencio&quot;.", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 4. PERSONALIDAD PARAMETRIZADA
# ═══════════════════════════════════════════════════════════════
story.append(p("4. Perfil de personalidad numérico", H1))
story.append(p(
    "El campo <font face='Mono' size='9'>personality_traits</font> es un JSONB con "
    "rasgos numéricos y categóricos. Aunque no se inyecta directamente al prompt "
    "(no es texto narrativo), sirve como referencia de diseño y para futuras "
    "extensiones del motor de estado clínico.", BODY))

pt = DIEGO["personality_traits"]
story.append(kv_table([
    ("Apertura (openness)", f"{pt['openness']} / 1.0 — baja, indica reticencia inicial a "
        "explorar contenidos nuevos en sesión"),
    ("Neuroticismo", f"{pt['neuroticism']} / 1.0 — muy alto, alta vulnerabilidad emocional "
        "y preocupación"),
    ("Resistencia", f"<i>{pt['resistance']}</i> — pasiva (no confronta, se cierra)"),
    ("Estilo comunicativo", f"<i>{pt['communication_style']}</i> — monosilábico al inicio, "
        "se abre con tiempo"),
]))
story.append(sp(10))

# ═══════════════════════════════════════════════════════════════
# 5. IDENTIDAD VISUAL Y VOZ
# ═══════════════════════════════════════════════════════════════
story.append(p("5. Identidad visual y multi-modalidad", H1))

story.append(p("5.1 Identidad visual estructurada", H2))
story.append(p(
    "El campo <font face='Mono' size='9'>visual_identity</font> es un JSONB con 9 "
    "atributos que se inyectan en el prompt de DALL-E para generar la imagen del "
    "paciente. La generación es repetible y permite múltiples retratos consistentes:", BODY))

vi = DIEGO["visual_identity"]
story.append(kv_table([
    ("Etnia", vi["etnia"]),
    ("Tez", vi["tez"]),
    ("Pelo (estilo)", vi["pelo_estilo"]),
    ("Pelo (color)", vi["pelo_color"]),
    ("Gesto / expresión", vi["gesto"]),
    ("Accesorios", vi["accesorios"]),
    ("Ropa (tipo)", vi["ropa_tipo"]),
    ("Ropa (color)", vi["ropa_color"]),
    ("Fondo", vi["fondo"]),
]))

story.append(p(
    "<b>Contraste con 1.0:</b> la imagen del paciente en 1.0 es una sola foto fija en "
    "Cloudinary que el equipo subió manualmente; no es regenerable y no tiene "
    "metadatos. En 5.0 la imagen se compone desde estos atributos, lo que permite "
    "auditar sesgos representacionales (¿cuántos pacientes son afrodescendientes? "
    "¿cuántos tienen rasgos andinos? ¿cuántos están bien vestidos vs. con ropa "
    "gastada?), regenerar imágenes con consistencia y crear variantes "
    "sin perder identidad.", BODY))

story.append(p("5.2 Voz", H2))
story.append(p(
    f"<b>voice_id:</b> <i>null</i>. Diego no tiene una voz ElevenLabs asignada "
    "todavía. La plataforma soporta voces (otros pacientes como Roberto Salas y "
    "Fernanda Contreras sí tienen <i>voice_id</i>, ver migración "
    "<font face='Mono' size='9'>20260316191043_patient_voice_id.sql</font>), pero "
    "Diego está en lista de pendientes. Cuando se asigne, su voz acompañará el chat "
    "de texto con TTS streaming.", BODY))

story.append(p("5.3 Pacing conversacional", H2))
story.append(p(
    f"<b>pacing_profile:</b> <i>{DIEGO['pacing_profile']}</i>. Los 5 perfiles posibles "
    "son <i>anxious_fast</i>, <i>conversational_medium</i>, <i>reflective_paused</i>, "
    "<i>depressive_slow</i> e <i>inhibited_timid</i>. Cada perfil define "
    "(<font face='Mono' size='9'>src/lib/conversation-pacing.ts</font>) el delay de "
    "<i>pensamiento</i> antes de responder, la velocidad de tipeo en el cliente "
    "(SSE), y la cadencia de nudges de silencio.", BODY))
story.append(p(
    "El backfill heurístico (INF-2026-039) clasificó a Diego en "
    "<i>conversational_medium</i> porque su prompt no contiene marcadores fuertes de "
    "depresión severa, ansiedad aguda ni inhibición tímida explícita — es un caso "
    "intermedio. Se puede revisar este pacing en el editor de pacientes; hasta hoy "
    "no se ha modificado.", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 6. CONTEXTO FAMILIAR
# ═══════════════════════════════════════════════════════════════
story.append(p("6. Contexto familiar y demografía", H1))
story.append(p(
    "El campo <font face='Mono' size='9'>family_members</font> es un array JSONB que "
    "lista núcleo familiar con relación, edad y notas. Estos datos no se inyectan "
    "obligatoriamente al prompt, pero están disponibles para referencia del docente "
    "y para futura inyección dinámica si la sesión deriva a temas familiares.", BODY))

fam_data = [["Nombre", "Relación", "Edad", "Notas"]]
for f in DIEGO["family_members"]:
    fam_data.append([f["name"], f["relationship"], str(f["age"]), f["notes"]])

t_fam = Table(fam_data, colWidths=[3.5*cm, 2.5*cm, 1.5*cm, 8.5*cm])
t_fam.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9.5),
    ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
]))
story.append(t_fam)
story.append(sp(10))

story.append(p(
    "<b>Detalle clínico relevante:</b> Diego es hijo único viviendo lejos por primera "
    "vez (de Estación Central, vino a estudiar a otra ciudad). Su madre Patricia es la "
    "única figura con vínculo consistente. El padre (Tomás) es figura ausente desde la "
    "separación cuando Diego tenía 10 años. Su hermana Valentina (14) representa el "
    "vínculo que Diego añora y que justifica una de sus revelaciones gradadas (no "
    "querer admitir que extraña su casa, &quot;ya no soy un niño&quot;).", BODY))

story.append(p(
    "<b>Coherencia con el barrio y origen:</b> Estación Central es un barrio popular "
    "de Santiago, lo que da contexto socioeconómico al esfuerzo de Patricia mencionado "
    "en las notas (&quot;Se esforzó mucho para que Diego pudiera estudiar&quot;).", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 7. MOTOR DE ESTADO CLÍNICO
# ═══════════════════════════════════════════════════════════════
story.append(p("7. Comportamiento conversacional esperado", H1))
story.append(p(
    "A diferencia de 1.0, donde el comportamiento es la salida directa del LLM sobre "
    "el prompt, en 5.0 cada turno está mediado por un <b>motor de estado clínico</b> "
    "(<font face='Mono' size='9'>src/lib/clinical-state-engine.ts</font>) y por "
    "instrucciones específicas turn-by-turn dentro del propio prompt. Esto hace que "
    "el comportamiento esperado sea predecible y medible.", BODY))

story.append(p("7.1 Variables de estado por turno", H2))
story.append(p(
    "Cada turno se registra en la tabla "
    "<font face='Mono' size='9'>clinical_state_log</font> con 5 variables y 5 deltas:", BODY))
story.append(kv_table([
    ("resistencia", "0–10. Inicial sugerida 7. Disminuye con validación, aumenta con "
        "confrontación prematura."),
    ("alianza", "0–10. Inicial sugerida 2. Aumenta con validación, escucha activa, "
        "tolerancia al silencio."),
    ("apertura_emocional", "0–10. Inicial sugerida 2. Aumenta con preguntas abiertas y "
        "espacio."),
    ("sintomatologia", "0–10. Inicial sugerida 7. Cambia poco intra-sesión; refleja "
        "el motivo de consulta."),
    ("disposicion_cambio", "0–10. Inicial sugerida 2. Aumenta cuando el paciente "
        "verbaliza posibilidades de futuro."),
]))

story.append(p("7.2 Apertura gradual prescrita", H2))
story.append(p(
    "El prompt incluye una sección explícita &quot;LO QUE NO REVELAS FÁCILMENTE&quot; "
    "con tres revelaciones reservadas para sesión 3+ con alianza terapéutica fuerte:", BODY))
story.append(p(
    "1. Sentirse profundamente solo y creer que nadie lo entiende.<br/>"
    "2. Pensar que decepciona a su madre.<br/>"
    "3. Extrañar su casa pero tener vergüenza de admitirlo.", BODY))
story.append(p(
    "Esta arquitectura por capas mimetiza la lógica de la entrevista clínica real: "
    "los contenidos sensibles requieren confianza acumulada. El motor "
    "(eventualmente, hoy parcial) puede consultar variables de alianza y "
    "session_number antes de permitir que el modelo revele estos contenidos.", BODY))

story.append(p("7.3 Tipos de intervención clasificadas", H2))
story.append(p(
    "El sistema clasifica las intervenciones del estudiante en 11 tipos discretos "
    "(<i>pregunta abierta</i>, <i>pregunta cerrada</i>, <i>validación empática</i>, "
    "<i>silencio terapéutico</i>, <i>confrontación</i>, <i>reformulación</i>, "
    "<i>psicoeducación</i>, <i>reflejo</i>, <i>juicio</i>, <i>consejo</i>, "
    "<i>fuera de rol</i>) y aplica reglas de transición sobre las variables de "
    "estado. Estas reglas no están específicas a Diego — son globales, pero su "
    "personalidad pasiva y resistencia baja-pasiva implican que sus deltas serán "
    "menos extremos que los de un paciente como Carmen Torres (advanced, resistencia "
    "active_testing).", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 8. CAPACIDADES TÉCNICAS
# ═══════════════════════════════════════════════════════════════
story.append(p("8. Capacidades técnicas asociadas al paciente", H1))

story.append(kv_table([
    ("Voz (TTS)", "Disponible globalmente en la plataforma; Diego aún no asignó "
        "<i>voice_id</i>. Otros pacientes (Roberto, Fernanda) sí tienen voz ElevenLabs."),
    ("Voz (STT)", "Disponible. El estudiante puede dictar sus intervenciones "
        "(walkie-talkie, INF-2026-005). Asociado al chat global, no al paciente."),
    ("Imagen del paciente", "Generada desde <i>visual_identity</i> con DALL-E. "
        "Regenerable, auditable, parametrizada."),
    ("Streaming de respuestas", "Sí. SSE / ReadableStream nativo. El estudiante ve la "
        "respuesta del paciente palabra por palabra (calibrado en INF-2026-039)."),
    ("Pacing conversacional", "Sí. <i>conversational_medium</i> (~27 cps de tipeo "
        "calibrado, sentenceGap real entre oraciones, thinking-delay server-side)."),
    ("Memoria entre sesiones", "Sí. <i>session_summaries</i>: resumen IA al final de "
        "cada sesión, cargado al inicio de la siguiente para continuidad."),
    ("Estado clínico cuantificado", "Sí. 5 variables snapshot por turno en "
        "<i>clinical_state_log</i>; permite replay y análisis longitudinal."),
    ("Evaluación post-sesión", "Sí. 10 competencias Valdés y Gómez (2023, UST) con "
        "evidencia textual; aprobación docente; visible al estudiante post-aprobación."),
    ("Persistencia local", "Mensajes en PostgreSQL (Supabase) con índices, RLS y "
        "políticas por rol. Backup gestionado, recuperación trivial."),
    ("Capa de seguridad de contenido", "<i>content-safety.ts</i> + <i>buildSafetyPrompt</i> "
        "con doble anclaje (inicio + final del prompt) — INF-2026-037, INF-2026-039."),
    ("Protección mid-session", "<i>prompt_snapshot</i> en conversaciones congela el "
        "prompt al iniciar la sesión, protegiendo a sesiones en curso de cambios al "
        "prompt en producción."),
    ("Notas docentes", "Campo <i>teacher_notes</i> disponible (vacío hoy para Diego). "
        "Permite anotaciones del instructor sobre cómo conducir la práctica con este "
        "paciente."),
]))

story.append(p("Datos clínicos no recolectados (campos vacíos pero soportados)", H3))
story.append(p(
    "• <b>distinctive_factor</b>: <i>null</i>. No hay un rasgo identitario priorizado "
    "(feminismo, identidad de género, migración forzada, discapacidad, etc.). Diego es "
    "un caso clásico de adaptación universitaria sin un eje identitario diferencial.<br/>"
    "• <b>voice_id</b>: <i>null</i>. Pendiente de asignación.<br/>"
    "• <b>teacher_notes</b>: <i>null</i>. Pendiente de redacción por equipo "
    "académico.<br/>"
    "• <b>short_narrative</b>, <b>extended_narrative</b>, <b>coherence_review</b>, "
    "<b>projections</b>: vacíos porque Diego no pasó por el pipeline de creación de "
    "15 pasos (es legacy, no nuevo).", BODY))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 9. LIMITACIONES Y CONSIDERACIONES ÉTICAS
# ═══════════════════════════════════════════════════════════════
story.append(p("9. Limitaciones y consideraciones éticas", H1))

story.append(p("9.1 Limitaciones del informe", H2))
story.append(p(
    "• <b>Sin transcripción real:</b> a diferencia de Alejandro López (donde se "
    "incluyó un fragmento real anonimizado de una sesión rescatada), Diego Fuentes "
    "no tiene volumen suficiente de conversaciones en producción al cierre de este "
    "informe (la base canónica nueva tiene 4 conversaciones totales, ninguna con "
    "Diego). Por eso el §7 describe el comportamiento <i>esperado</i> según el "
    "prompt y la arquitectura, no <i>observado</i>.", BODY))
story.append(p(
    "• <b>Posible deriva entre prompt y comportamiento real:</b> al igual que en "
    "1.0, el LLM puede no adherir perfectamente al prompt. La adherencia se "
    "mide indirectamente por las evaluaciones de competencias y por revisión "
    "docente, pero no hay un test sistemático específico para Diego.", BODY))
story.append(p(
    "• <b>Asignación de pacing por heurística:</b> el pacing_profile fue asignado "
    "con reglas heurísticas sobre el prompt, no con observación empírica. La "
    "calidad del match puede revisarse cuando haya conversaciones reales.", BODY))

story.append(p("9.2 Consideraciones éticas", H2))
story.append(p(
    "• <b>Apropiación cultural de testimonio:</b> Diego es un personaje sintético, "
    "pero está construido sobre arquetipos de jóvenes universitarios chilenos reales. "
    "Aunque no representa a una persona específica, sí tiene patrones reconocibles "
    "(ascendencia europea de tez clara con manchas de sol, hoodie oversized, "
    "audífonos al cuello). El equipo debe vigilar que el conjunto de pacientes 5.0 "
    "no sobrerrepresente perfiles &quot;cómodos&quot; ignorando otros.", BODY))
story.append(p(
    "• <b>Decisión de remover ideación suicida:</b> esta decisión protege en el corto "
    "plazo (prevención de iatrogenia, ver §3.2), pero también <b>limita la práctica</b> "
    "de evaluación de riesgo, que es una competencia clínica esencial. La decisión "
    "es pragmática y revisable: cuando GlorIA tenga supervisión clínica humana real, "
    "esta competencia podría reincorporarse en un paciente dedicado con safeguards "
    "específicos.", BODY))
story.append(p(
    "• <b>Sesgo de género y demografía en el conjunto:</b> Diego es uno de pocos "
    "estudiantes universitarios varones jóvenes en el conjunto de 34 pacientes. "
    "Esto es una elección deliberada (favorecer la diversidad de motivos de consulta "
    "por sobre la diversidad de demografía), pero implica que para practicar con "
    "&quot;hombre joven con malestar académico&quot; sólo está Diego, sin alternativas. "
    "Una expansión futura podría diversificar este nicho.", BODY))
story.append(p(
    "• <b>Privacidad y permanencia:</b> los registros de conversaciones reales con "
    "Diego, cuando los haya, contendrán intervenciones de estudiantes — datos "
    "sensibles que deben rotar y anonimizarse según política institucional. Las "
    "políticas RLS y el módulo de borrado post-piloto cubren este aspecto en el "
    "diseño actual.", BODY))

story.append(sp(10))
story.append(hr())
story.append(sp(8))

# ═══════════════════════════════════════════════════════════════
# 10. CITAS Y REFERENCIAS
# ═══════════════════════════════════════════════════════════════
story.append(p("10. Citas y referencias", H1))

story.append(p("10.1 Migraciones citadas", H2))
story.append(p(
    "Todas en <font face='Mono' size='9'>supabase/migrations/</font>:", BODY))
story.append(p(
    "• <font face='Mono' size='9'>20260313203704_initial_schema.sql</font> — schema "
    "base de <i>ai_patients</i> con campos originales.<br/>"
    "• <font face='Mono' size='9'>20260313203745_seed_ai_patients.sql:39-53</font> — "
    "seed original de Diego (con ideación suicida).<br/>"
    "• <font face='Mono' size='9'>20260315142610_patient_personal_details.sql</font> — "
    "agrega birthday, neighborhood, family_members.<br/>"
    "• <font face='Mono' size='9'>20260316032447_fix_nonverbal_instructions.sql</font> — "
    "estandariza lenguaje no verbal en tercera persona.<br/>"
    "• <font face='Mono' size='9'>20260316115606_fix_accents_all_patients.sql</font> — "
    "tildes y ñ.<br/>"
    "• <font face='Mono' size='9'>20260316165059_patient_creation_workflow.sql</font> — "
    "pipeline de 15 pasos (Diego es legacy, no usó este pipeline).<br/>"
    "• <font face='Mono' size='9'>20260316191043_patient_voice_id.sql</font> — agrega "
    "campo voice_id (Diego sigue sin voz).<br/>"
    "• <font face='Mono' size='9'>20260316220000_patient_visual_identity.sql</font> — "
    "asigna visual_identity a Diego.<br/>"
    "• <font face='Mono' size='9'>20260316230000_patient_distinctive_factor.sql</font> — "
    "agrega campo distinctive_factor (Diego sin asignar).<br/>"
    "• <font face='Mono' size='9'>20260320130000_teacher_notes_ai_patients.sql</font> — "
    "agrega teacher_notes (Diego sin asignar).<br/>"
    "• <font face='Mono' size='9'>20260413120000_upgrade_legacy_patients.sql:142-203</font> — "
    "<b>upgrade crítico</b> de Diego, removida ideación suicida.<br/>"
    "• <font face='Mono' size='9'>20260414100000_resync_snapshots_post_upgrade.sql</font> — "
    "actualización de prompt_snapshot en sesiones activas.<br/>"
    "• <font face='Mono' size='9'>20260414160000_ai_patients_pacing_profile.sql</font> — "
    "asignación de pacing_profile a Diego.", BODY))

story.append(p("10.2 Código relevante", H2))
story.append(p(
    "• <font face='Mono' size='9'>src/lib/ai.ts</font> — interfaz unificada OpenAI/Gemini.<br/>"
    "• <font face='Mono' size='9'>src/lib/clinical-state-engine.ts</font> — motor de "
    "estado clínico.<br/>"
    "• <font face='Mono' size='9'>src/lib/conversation-pacing.ts</font> — pacing por "
    "perfil.<br/>"
    "• <font face='Mono' size='9'>src/lib/content-safety.ts</font> — filtros de "
    "contenido.<br/>"
    "• <font face='Mono' size='9'>src/lib/build-safety-prompt.ts</font> — anclaje doble "
    "del safety-prompt.", BODY))

story.append(p("10.3 Informes hermanos", H2))
story.append(p(
    "• <b>INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López (documento hermano).</b><br/>"
    "• INF-2026-013 — Comparativo arquitectónico GlorIA 1.0 vs 5.0.<br/>"
    "• INF-2026-028 — Resiliencia LLM (failover OpenAI ↔ Gemini).<br/>"
    "• INF-2026-029 — Cambio de modelo gpt-4o-mini → gpt-4.1-mini.<br/>"
    "• INF-2026-037 — Upgrade pacientes legacy y capa de safety.<br/>"
    "• INF-2026-039 — Calibración conversacional, pacing, accesibilidad.<br/>"
    "• INF-2026-008 — Análisis clínico-pedagógico de robustez de pacientes.", BODY))

story.append(p("10.4 Referencias clínicas", H2))
story.append(p(
    "• Valdés, A., y Gómez, J. (2023). <i>Pauta de evaluación de competencias "
    "psicoterapéuticas básicas</i>. Universidad Santo Tomás. — Marco usado para las "
    "10 competencias evaluadas en sesiones 5.0.", BODY))

# ─── Build ──────────────────────────────────────────────────────
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"Generated: {OUT}")
print(f"Size: {os.path.getsize(OUT)/1024:.1f} KB")
