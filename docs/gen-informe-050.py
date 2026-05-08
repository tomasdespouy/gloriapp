"""
INF-2026-050 — Enriquecimiento masivo de los 34 pacientes + propuesta módulo creación.
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
BORDER = colors.HexColor("#CCCCCC")
GREY = colors.HexColor("#666666")
GREEN = colors.HexColor("#2E7D32")
RED = colors.HexColor("#C62828")

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
CODE_NEW = ParagraphStyle("CodeNew", parent=CODE, backColor=GREEN_BG, borderColor=GREEN)
TURN_BODY = ParagraphStyle("TurnBody", parent=BODY, fontSize=10, leading=14)

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

# Datos
SIM = json.load(open("C:/tmp/sim-050.json", encoding="utf8"))
ENRICHED = json.load(open("C:/tmp/enriched-blocks.json", encoding="utf8"))
ANALYSIS = json.load(open("C:/tmp/sim-050-analysis.json", encoding="utf8"))

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Calibri-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(LETTER[0]-2*cm, LETTER[1]-1.4*cm,
        "INF-2026-050 — Enriquecimiento masivo + propuesta módulo creación")
    canvas.drawCentredString(LETTER[0]/2, 1.2*cm, f"Página {doc.page}")
    canvas.drawString(2*cm, 1.2*cm, "GlorIA · Universidad Gabriela Mistral")
    canvas.drawRightString(LETTER[0]-2*cm, 1.2*cm, "2026-05-08")
    canvas.restoreState()

OUT = "informes/investigacion/INF-2026-050_enriquecimiento-masivo-y-modulo-creacion.pdf"
doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.2*cm, bottomMargin=2*cm,
    title="INF-2026-050 — Enriquecimiento masivo + módulo de creación",
    author="GlorIA Platform Team")
story = []

# ─── PORTADA ───
story.append(sp(80))
story.append(Image("public/branding/gloria-logo.png", width=4*cm, height=4*cm, hAlign="CENTER"))
story.append(sp(20))
story.append(Paragraph("INF-2026-050", ParagraphStyle("Num", parent=BODY_C,
    fontName="Calibri-Bold", fontSize=11, textColor=INDIGO)))
story.append(sp(6))
story.append(Paragraph("Enriquecimiento masivo de los 34 pacientes",
    ParagraphStyle("Title", parent=BODY_C, fontName="Calibri-Bold",
        fontSize=20, textColor=INDIGO, leading=26)))
story.append(sp(4))
story.append(Paragraph("y propuesta de rediseño del módulo de creación",
    ParagraphStyle("Sub", parent=BODY_C, fontName="Calibri",
        fontSize=16, textColor=DARK, leading=22)))
story.append(sp(8))
story.append(Paragraph("Generación con gpt-4o + validación empírica con 15 pacientes",
    ParagraphStyle("Tag", parent=BODY_C, fontName="Calibri-Italic",
        fontSize=12, textColor=GREY)))
story.append(sp(40))
story.append(Image("public/branding/ugm-logo.png", width=3.5*cm, height=1.2*cm, hAlign="CENTER"))
story.append(sp(30))
story.append(p("Documento técnico-clínico", BODY_C))
story.append(p("Mayo 2026", BODY_C))
story.append(p("Universidad Gabriela Mistral", BODY_C))
story.append(PageBreak())

# ─── METADATOS + RESUMEN ───
story.append(p("Metadatos del informe", H1))
story.append(kv_table([
    ("Número", "INF-2026-050"),
    ("Fecha", "2026-05-08"),
    ("Categoría", "Investigación / Propositiva"),
    ("Prioridad", "Alta"),
    ("Sujeto del estudio", "Los 34 pacientes IA de GlorIA 5.0 + módulo de creación de pacientes"),
    ("Documentos hermanos", "INF-2026-047 (Alejandro 1.0), INF-2026-048 (Diego 5.0), <b>INF-2026-049 (propuesta enriquecimiento Diego)</b>"),
    ("Alcance experimental",
        "Generación de bloques: 34 pacientes (gpt-4o, T=0.7). Simulación: 15 pacientes aleatorios "
        "(seed=42) × 2 prompts × 15 turnos = 450 llamadas a gpt-4.1-mini, T=0.7"),
    ("Estado de pacientes en producción",
        "<b>NO MODIFICADOS</b> — todo se generó en memoria/archivos JSON locales"),
    ("Costo total API", "≈ USD 0,40 (gpt-4o generación + gpt-4.1-mini simulación)"),
]))
story.append(sp(8))

story.append(p("Resumen ejecutivo", H2))
story.append(p(
    "Este informe extiende el experimento del INF-2026-049 (que demostró el enriquecimiento del "
    "prompt de Diego con 4 bloques nuevos) a los 34 pacientes activos de la plataforma. Para "
    "cada paciente se generaron — vía gpt-4o instruido con un meta-prompt específico — los 4 "
    "bloques RED SOCIAL Y VÍNCULOS, LUGARES SIGNIFICATIVOS, ESTADO CORPORAL Y RUTINA y FRASES "
    "TIPO QUE DICES, garantizando coherencia con la familia ya tipada, el país de origen, el "
    "motivo de consulta y el dialecto regional. Posteriormente se seleccionaron 15 pacientes al "
    "azar (seed=42) y se ejecutó la misma comparativa empírica que con Diego: 15 turnos del "
    "estudiante estandarizado contra prompt original vs prompt enriquecido."))

story.append(p("<b>Hallazgo principal:</b> a diferencia del experimento controlado con Diego "
    f"(que mostró +22% de longitud), el estudio agregado de 15 pacientes muestra un Δ "
    f"promedio de <b>+3,6% en longitud</b> — el enriquecimiento NO hace al modelo más verboso. "
    f"Sin embargo, el uso de elementos biográficos del prompt nuevo se multiplica por <b>3,5×</b> "
    f"(promedio 1,3 entidades en original vs 4,8 en enriquecido). Es decir: el enriquecimiento "
    f"no produce respuestas más largas, sino respuestas <b>biográficamente más precisas</b>. "
    f"Esto es exactamente lo que se esperaba clínicamente: el paciente menciona a sus hijos por "
    f"nombre, ubica anécdotas en lugares específicos, articula su sueño con datos concretos.", BODY))
story.append(p("<b>Hallazgo secundario:</b> la mejora en uso de marcadores dialectales "
    "regionales es leve pero positiva (+17% en promedio). Y la diversidad léxica se mantiene "
    "intacta — no hay degradación.", BODY))
story.append(p("<b>Recomendación:</b> proceder con la migración de los 34 pacientes a su versión "
    "enriquecida en STAGING primero, monitorear durante 2-4 semanas, y luego promover a PROD. "
    "En paralelo, rediseñar el módulo de creación de pacientes incorporando los 4 nuevos bloques "
    "como campos JSONB independientes (ver §8), con un asistente IA para generar borradores que "
    "el equipo académico revisa antes de aprobar.", BODY))

story.append(PageBreak())

# ─── §1 CONTEXTO ───
story.append(p("1. Contexto y objetivo", H1))
story.append(p(
    "El INF-2026-049 propuso enriquecer el prompt de un solo paciente (Diego Fuentes) con 4 "
    "bloques nuevos inspirados en lo que Alejandro López (GlorIA 1.0) tenía y el estándar de 5.0 "
    "carecía: universo poblado de personajes secundarios, lugares físicos concretos, estado "
    "corporal/rutina, y frases prototípicas para anclar el dialecto. La validación con 3 corridas "
    "× 2 prompts × 15 turnos mostró que el enriquecimiento producía respuestas con más densidad "
    "biográfica concreta (citaba personajes por nombre, datos somáticos específicos)."))
story.append(p(
    "Este informe responde a la pregunta natural siguiente: <b>¿el patrón se generaliza a todos "
    "los pacientes?</b> Para responderla, se aplicó el enriquecimiento a los 34 pacientes "
    "activos en producción y se validó con una muestra aleatoria de 15."))

# ─── §2 METODOLOGÍA ───
story.append(p("2. Diseño metodológico", H1))
story.append(kv_table([
    ("Pipeline de generación de bloques",
        "<b>gpt-4o</b> con meta-prompt que recibe: nombre, edad, ocupación, país, barrio, "
        "motivo de consulta, backstory, family_members, visual_identity, system_prompt actual. "
        "Output: JSON con los 4 bloques en formato Markdown coherente."),
    ("Reglas duras del meta-prompt",
        "(1) coherencia absoluta con family_members ya definida; (2) dialecto del país de origen; "
        "(3) coherencia con edad/ocupación/motivo; (4) no contradecir el prompt original; "
        "(5) no agregar elementos clínicos que cambien el cuadro; (6) sin emojis; "
        "(7) formato de líneas con guion."),
    ("Pipeline de simulación",
        "Modelo gpt-4.1-mini (idéntico a producción), T=0.7, max_tokens=400. 15 intervenciones "
        "del estudiante idénticas a INF-049, agnósticas al paciente. Concurrencia 3 a nivel de "
        "paciente."),
    ("Selección de los 15",
        "Random reproducible con Mulberry32, seed=42, sobre los 34 pacientes activos."),
    ("Métricas calculadas",
        "(a) Δ longitud (caracteres totales por sesión); (b) uso de entidades — palabras "
        "capitalizadas extraídas de los bloques nuevos que aparecen en las respuestas; "
        "(c) marcadores dialectales por país; (d) diversidad léxica (tokens únicos/total)."),
    ("Reproducibilidad",
        "<font face='Mono' size='9'>docs/gen-enrichment-blocks.js</font> · "
        "<font face='Mono' size='9'>docs/sim-050.js</font> · "
        "<font face='Mono' size='9'>docs/analyze-sim-050.js</font>. Datos en C:/tmp/."),
]))

# ─── §3 GENERACIÓN ───
story.append(p("3. Generación de bloques para los 34 pacientes", H1))
story.append(p("3.1 Resultados de la generación", H2))

successes = ENRICHED["successes"]
failures = ENRICHED["failures"]
story.append(kv_table([
    ("Pacientes procesados", str(len(ENRICHED["patients"]))),
    ("Bloques generados con éxito", f"{successes}/34"),
    ("Fallos definitivos", str(failures)),
    ("Tiempo total (incluye retry)", "≈ 80 segundos"),
    ("Costo aproximado", "USD ~0,30 (≈ 60K tokens input + 30K output con gpt-4o)"),
    ("Concurrencia inicial", "5 (con rate limit hit en Tier 1, TPM 30K)"),
    ("Strategy de retry", "Concurrencia 1 + backoff exponencial 1,5 → 3 → 6 → 12s, máx 5 intentos"),
]))

story.append(p("3.2 Calidad cualitativa por país", H2))
story.append(p(
    "Spot-check sobre 6 pacientes (uno por país) confirmó que el modelo generador respeta "
    "el dialecto regional y la familia tipada. Tres ejemplos representativos:"))

# 3 micro-ejemplos
def find(name):
    for p2 in ENRICHED["patients"]:
        if p2["name"] == name and p2.get("enriched_blocks"):
            return p2
    return None

for name in ["Roberto Salas", "Yesenia De Los Santos", "Camila Bertoni"]:
    pt = find(name)
    if not pt: continue
    story.append(p(f"<b>{name}</b> ({pt['country']}, {pt['difficulty']})", H3))
    frases = pt["enriched_blocks"]["frases_tipo_que_dices"]
    # Solo las primeras 4 frases para brevedad
    lines = frases.split("\n")[1:5]
    story.append(code_block("\n".join(lines), style=CODE_NEW))

story.append(p(
    "<b>Patrón observado:</b> Roberto (Chile, 52 años, duelo) usa registro formal sin voseo "
    "(\"señora Juana\", \"doctor\"); Yesenia (Rep. Dominicana, 24, ansiedad social) usa apocopes "
    "típicos (\"e' verdad\", \"Ta bien\"); Camila (Argentina, 22) usa voseo correcto (\"entendés\", "
    "\"viste\"). Ningún caso confunde dialectos.", BODY))

story.append(PageBreak())

# ─── §4 SIMULACIÓN ───
story.append(p("4. Selección y simulación de 15 pacientes", H1))
story.append(p("4.1 Pacientes seleccionados (seed=42)", H2))
sel_data = [["Paciente", "País", "Dificultad", "Edad", "Motivo de consulta"]]
for r in SIM["patients"]:
    sel_data.append([r["name"], r["country"], r["difficulty"], str(r["age"]),
        (r["presenting_problem"] or "")[:55] + ("…" if len(r["presenting_problem"] or "") > 55 else "")])

t_sel = Table(sel_data, colWidths=[3.5*cm, 2.4*cm, 1.8*cm, 1.0*cm, 7.3*cm])
t_sel.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
]))
story.append(t_sel)
story.append(sp(8))

story.append(p("4.2 Distribución de la muestra", H3))
sim_p = SIM["patients"]
countries = {}
diffs = {}
for r in sim_p:
    countries[r["country"]] = countries.get(r["country"], 0) + 1
    diffs[r["difficulty"]] = diffs.get(r["difficulty"], 0) + 1
story.append(p(f"Por país: {', '.join(f'{c}: {n}' for c,n in countries.items())}.<br/>"
    f"Por dificultad: {', '.join(f'{d}: {n}' for d,n in diffs.items())}.<br/>"
    f"La muestra cubre los 6 países y los 3 niveles de dificultad. Está ligeramente sesgada "
    f"hacia advanced (6/15) por el azar de la selección.", BODY))

# ─── §5 MÉTRICAS ───
story.append(p("5. Métricas agregadas", H1))
story.append(p(
    "Tabla resumen de los 15 pacientes. Las columnas clave son: "
    "<b>Δchars%</b> (cambio de longitud total de la sesión enriquecida vs original), "
    "<b>Ents O/E</b> (entidades del prompt enriquecido que aparecen en respuestas O=original / E=enriquecido), "
    "<b>Dialect O/E</b> (marcadores dialectales del país detectados).", BODY))

m_data = [["Paciente", "País", "Dif.", "Δchars %", "Ents O/E", "Dial. O/E"]]
for row in ANALYSIS["rows"]:
    delta = float(row["delta_chars_pct"])
    delta_str = f"+{int(delta)}%" if delta >= 0 else f"{int(delta)}%"
    m_data.append([
        row["name"],
        row["country"][:3],
        row["difficulty"][:4],
        delta_str,
        f"{row['entities_used_orig']}/{row['entities_used_enri']} (de {row['entities_total']})",
        f"{row['dialect_orig']}/{row['dialect_enri']}",
    ])

t_m = Table(m_data, colWidths=[3.6*cm, 1.6*cm, 1.4*cm, 2.1*cm, 4.4*cm, 2.9*cm])
t_m.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
]))
story.append(t_m)
story.append(sp(8))

# Promedios
def avg(k):
    return sum(float(r[k]) for r in ANALYSIS["rows"]) / len(ANALYSIS["rows"])
a_delta = avg("delta_chars_pct")
a_ent_o = avg("entities_used_orig")
a_ent_e = avg("entities_used_enri")
a_dia_o = avg("dialect_orig")
a_dia_e = avg("dialect_enri")
ent_factor = a_ent_e / a_ent_o if a_ent_o else 0

story.append(p("<b>Promedios:</b><br/>"
    f"• Δ longitud: <b>{a_delta:+.1f}%</b><br/>"
    f"• Entidades del prompt usadas: <b>{a_ent_o:.1f} (orig) → {a_ent_e:.1f} (enri)</b> = factor "
    f"<b>{ent_factor:.1f}×</b><br/>"
    f"• Marcadores dialectales: {a_dia_o:.1f} → {a_dia_e:.1f} ({((a_dia_e-a_dia_o)/a_dia_o*100 if a_dia_o else 0):+.0f}%)<br/>"
    f"• Diversidad léxica: 0,60 → 0,60 (sin cambio)", BODY))

story.append(PageBreak())

# ─── §6 HALLAZGOS ───
story.append(p("6. Hallazgos", H1))

story.append(p("6.1 El enriquecimiento NO infla la respuesta", H2))
story.append(p(
    f"El Δ de longitud agregado es de <b>{a_delta:+.1f}%</b>, prácticamente nulo. Esto contradice "
    f"la hipótesis intuitiva de que un prompt más largo (~+2.500 chars) haría al modelo más verboso. "
    f"Lo que ocurre es que el modelo ajusta su producción a la pregunta del estudiante, no al "
    f"tamaño del system prompt. El material biográfico nuevo es <b>opcional para el modelo</b> — "
    f"lo usa cuando es relevante a la pregunta, no lo recita compulsivamente. "
    f"Esto es deseable clínicamente: las sesiones no se vuelven más largas o cansadoras.", BODY))

story.append(p("6.2 El enriquecimiento multiplica por 3,5× el uso de elementos biográficos", H2))
story.append(p(
    f"De los ~13 elementos nuevos introducidos por paciente (nombres de personajes, lugares, "
    f"datos somáticos), el prompt original usa en promedio {a_ent_o:.1f} (los que ya estaban en "
    f"family_members), mientras el enriquecido usa <b>{a_ent_e:.1f}</b>. Es decir: el modelo "
    f"<b>activa el material nuevo</b> cuando la pregunta del estudiante lo invoca. Esta es la "
    f"mejora clínicamente significativa: las respuestas son más texturizadas, no más largas.", BODY))

story.append(p("6.3 Mejora dialectal sutil", H2))
story.append(p(
    f"Los marcadores dialectales por país (cachai/po para Chile, e' verdad para Rep. Dom., "
    f"entendés/che para Argentina, etc.) suben de promedio {a_dia_o:.1f} a {a_dia_e:.1f} marcadores "
    f"por sesión (+{((a_dia_e-a_dia_o)/a_dia_o*100 if a_dia_o else 0):.0f}%). Mejora real pero "
    f"modesta. La razón: el dialecto ya estaba parcialmente codificado en family_members (\"tu "
    f"mamá Patricia\") y en el system_prompt original. Las frases prototípicas del bloque 4 "
    f"refuerzan pero no transforman el registro.", BODY))

story.append(p("6.4 Variabilidad por paciente", H2))
story.append(p(
    "Los promedios esconden variabilidad. Tres patrones distintos:", BODY))
story.append(p(
    "<b>(a) Pacientes que se expanden notablemente</b>: Andrés Castillo (+43%), Diego Fuentes "
    "(+40%), Carlos Paredes (+27%). Tienden a ser pacientes con redes sociales ricas en el "
    "bloque RED SOCIAL — muchos personajes secundarios donde explayarse.<br/>"
    "<b>(b) Pacientes que se contraen con el enriquecimiento</b>: Rafael Santos (−38%), "
    "Macarena Sépulveda (−21%), Milagros Flores (−15%). Tienden a ser advanced (caso difícil) "
    "donde el original era ya verboso, y el enriquecido le da pivotes concretos para responder "
    "con más economía.<br/>"
    "<b>(c) Pacientes con cambio mínimo</b>: Lucía Mendoza (0%), Hernán Mejía (−2%), Valentina "
    "Ospina (−3%). El prompt enriquecido aporta pero el modelo lo absorbe sin alterar su "
    "longitud media.", BODY))
story.append(p(
    "Conclusión: el efecto <b>NO es uniforme</b>, depende del perfil del paciente. Esto refuerza "
    "la recomendación de migración por lotes con monitoreo, no de aplicación masiva sin revisar.", BODY))

story.append(PageBreak())

# ─── §7 ANÁLISIS COMPARATIVO ───
story.append(p("7. Análisis comparativo — caso Andrés Castillo", H1))
story.append(p(
    "Se selecciona Andrés Castillo (Colombia, advanced, viudo de 52 años) como ejemplo "
    "ilustrativo. Es uno de los pacientes con mayor delta positivo (+43%) y mayor uso de "
    "entidades nuevas (+5).", BODY))
story.append(p("Tres turnos clave lado a lado:", BODY))

# Buscar Andrés
def get_pat(name):
    for r in SIM["patients"]:
        if r["name"] == name: return r
    return None

andres = get_pat("Andrés Castillo")

def comp_table_3turns(patient, turn_indices, notes):
    headers = ["T", "Pregunta del estudiante", "Original", "Enriquecido"]
    rows_data = [[Paragraph(f"<b>{h}</b>", BODY_S) for h in headers]]
    for i in turn_indices:
        o = patient["original_turns"][i-1]
        e = patient["enriched_turns"][i-1]
        rows_data.append([
            Paragraph(f"<b>T{i}</b>", BODY_S),
            Paragraph(o["student"][:60] + "…" if len(o["student"]) > 60 else o["student"], BODY_S),
            Paragraph(o["reply"].replace("\n", "<br/>"), TURN_BODY),
            Paragraph(e["reply"].replace("\n", "<br/>"), TURN_BODY),
        ])
        if notes.get(i):
            rows_data.append([
                "",
                Paragraph(f"<i>{notes[i]}</i>", BODY_S),
                "", "",
            ])
    t = Table(rows_data, colWidths=[0.9*cm, 4.0*cm, 5.6*cm, 5.6*cm])
    s = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("BACKGROUND", (0,0), (-1,0), INDIGO),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
    ]
    # filas de notas
    for i, row in enumerate(rows_data):
        if i > 0 and row[0] == "":
            s.append(("SPAN", (1,i), (3,i)))
            s.append(("BACKGROUND", (0,i), (-1,i), ORANGE_BG))
    t.setStyle(TableStyle(s))
    return t

andres_notes = {
    2: "Original menciona la muerte de la esposa hace 6 meses. Enriquecido agrega \"trato de ser fuerte por los pelados\" — invoca a los hijos, materializa el motivo.",
    6: "Original: respuesta abstracta sobre la familia. Enriquecido: aparece <b>Camila</b> (hija) + <b>Sebastián</b> (hijo) por nombre, con detalles concretos (universidad, fútbol, sueño de ser ingeniero). Salto cualitativo evidente.",
    9: "Ambos describen el insomnio. Enriquecido cierra con \"hay que seguir pa'lante\" — rasgo dialectal colombiano + actitud activa coherente con el prompt nuevo.",
}
story.append(comp_table_3turns(andres, [2, 6, 9], andres_notes))

story.append(p("7.1 Patrón general observado en los 15 pacientes", H2))
story.append(p(
    "El patrón más consistente es el del <b>turno 6</b> (\"¿y tu familia, cómo está?\"): el "
    "prompt enriquecido produce respuestas que <b>nombran a los miembros familiares</b> "
    "específicamente, con sus actividades (estudia, trabaja, juega fútbol, etc.). El prompt "
    "original tiende a respuestas abstractas (\"la comunicación no es tan fluida\", \"trato de "
    "estar presente con ellos\") que son clínicamente menos útiles porque no permiten al "
    "estudiante explorar a una persona específica.", BODY))
story.append(p(
    "El segundo patrón consistente es <b>turno 9</b> (\"¿cómo está tu sueño?\"): el enriquecido "
    "ofrece datos concretos (\"3 horas / 12 horas\", \"me despierto pensando en ella\") que "
    "permiten formular hipótesis clínicas. El original tiende a generalidades.", BODY))

story.append(PageBreak())

# ─── §8 PROPUESTA MÓDULO ───
story.append(p("8. Propuesta de rediseño del módulo de creación de pacientes", H1))
story.append(p(
    "Actualmente, el flujo de creación de pacientes en supradmin sigue 15 pasos definidos en la "
    "migración <font face='Mono' size='9'>20260316165059_patient_creation_workflow.sql</font>, con "
    "campos auxiliares <i>short_narrative</i>, <i>extended_narrative</i>, <i>coherence_review</i>, "
    "<i>projections</i>, <i>creation_step</i>. Este flujo NO incluye los 4 nuevos bloques. "
    "Proponemos extenderlo así:", BODY))

story.append(p("8.1 Cambios al schema de base de datos", H2))
story.append(p(
    "Agregar 4 columnas JSONB independientes a <font face='Mono' size='9'>ai_patients</font>:", BODY))
story.append(code_block("""ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS enrichment_red_social JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_lugares JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_estado_corporal JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_frases_tipo JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_version INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS enrichment_approved_at TIMESTAMPTZ;""", style=CODE_NEW))
story.append(p(
    "<b>Justificación:</b> separar los 4 bloques en columnas independientes — no como una sola "
    "columna <i>enrichment_blocks</i> ni como texto inline en system_prompt — permite "
    "(a) editar cada bloque por separado en el supradmin sin tocar los otros, "
    "(b) versionar cada bloque, "
    "(c) revisar/aprobar bloques individualmente, "
    "(d) componer dinámicamente el system_prompt al runtime a partir de la base + bloques activos.", BODY))

story.append(p("8.2 Composición dinámica del system_prompt en runtime", H2))
story.append(p(
    "Se modifica <font face='Mono' size='9'>src/lib/build-system-prompt.ts</font> (nuevo módulo) "
    "para que componga el prompt en runtime, no en la BD:", BODY))
story.append(code_block("""// Nuevo: src/lib/build-system-prompt.ts
export function buildSystemPrompt(patient: AiPatient): string {
  const base = patient.system_prompt;          // bloque base con HISTORIA, PERSONALIDAD, COMPORTAMIENTO, REGLAS
  const blocks = [
    patient.enrichment_red_social?.text,
    patient.enrichment_lugares?.text,
    patient.enrichment_estado_corporal?.text,
  ].filter(Boolean).join("\\n\\n");
  const frases = patient.enrichment_frases_tipo?.text;

  // Insertar bloques 1-3 antes de "COMPORTAMIENTO EN SESIÓN"
  let composed = base.replace(
    /\\n\\nCOMPORTAMIENTO EN SESIÓN:/,
    blocks ? `\\n\\n${blocks}\\n\\nCOMPORTAMIENTO EN SESIÓN:` : "$&"
  );
  // Insertar frases antes de "REGLAS:"
  composed = composed.replace(
    /\\n\\nREGLAS:/,
    frases ? `\\n\\n${frases}\\n\\nREGLAS:` : "$&"
  );
  return composed;
}""", style=CODE))
story.append(p(
    "Con esto, <b>el system_prompt almacenado no cambia</b> — sigue siendo el bloque base. Los "
    "4 bloques nuevos se componen al vuelo, lo que facilita la migración progresiva (un paciente "
    "puede tener 0, 1, 2, 3 o 4 bloques activos sin romper nada).", BODY))

story.append(p("8.3 Pipeline de creación actualizado", H2))
story.append(p(
    "Se agregan 4 pasos al pipeline existente, después del paso 8 (visual_identity) y antes del "
    "paso 12 (revisión final):", BODY))

steps_data = [
    ["Paso", "Nombre", "Descripción"],
    ["1-8", "Pasos existentes", "Sin cambios: nombre, edad, ocupación, motivo de consulta, backstory, personalidad, family, visual."],
    ["9 (NUEVO)", "RED SOCIAL", "Personajes secundarios (5-8) con nombre, edad, rol, micro-historia. Asistente IA pre-popula con un draft basado en backstory + family + país."],
    ["10 (NUEVO)", "LUGARES SIGNIFICATIVOS", "3-5 lugares físicos del día a día con detalle sensorial. Asistente IA sugiere lugares coherentes con el barrio + ocupación."],
    ["11 (NUEVO)", "ESTADO CORPORAL Y RUTINA", "Sueño, apetito, vestimenta, energía. Asistente IA genera draft coherente con el motivo de consulta."],
    ["12 (NUEVO)", "FRASES TIPO QUE DICES", "6-8 frases prototípicas. Asistente IA genera con dialecto del país."],
    ["13", "Revisión de coherencia", "Existente. Ahora revisa también que los 4 bloques sean coherentes entre sí."],
    ["14-15", "Aprobación final", "Existente. Cada bloque se aprueba por separado (registro en enrichment_approved_by/at)."],
]
t_steps = Table(steps_data, colWidths=[1.7*cm, 4.2*cm, 10.1*cm])
t_steps.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    # destacar las filas nuevas (índices 2,3,4,5)
    ("BACKGROUND", (0,2), (-1,5), GREEN_BG),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
]))
story.append(t_steps)

story.append(p("8.4 UI del editor en supradmin", H2))
story.append(p(
    "Cada bloque debería tener su propia tab/sección en la página de edición de paciente "
    "(<font face='Mono' size='9'>/supradmin/patients/[id]/edit</font>), con:", BODY))
story.append(p(
    "• <b>Textarea grande</b> (10-15 filas) para el contenido del bloque.<br/>"
    "• <b>Botón \"Generar borrador con IA\"</b> que llama a un endpoint nuevo "
    "<font face='Mono' size='9'>/api/admin/patients/[id]/enrich/[block]</font> que invoca "
    "gpt-4o con el meta-prompt y devuelve un draft.<br/>"
    "• <b>Diff visual</b> contra la versión anterior si <i>enrichment_version &gt; 0</i>.<br/>"
    "• <b>Botón \"Vista previa del system_prompt compuesto\"</b> que muestra cómo quedaría "
    "el prompt final inyectado al modelo.<br/>"
    "• <b>Botón \"Probar con 3 turnos\"</b> que ejecuta una mini-simulación contra gpt-4.1-mini "
    "y muestra las respuestas — para que el equipo académico vea el efecto antes de aprobar.<br/>"
    "• <b>Aprobación con doble click</b> (\"Marcar como aprobado\") que escribe "
    "<i>enrichment_approved_by</i> + <i>enrichment_approved_at</i>.", BODY))

story.append(p("8.5 Asistente IA — flujo de generación de borrador", H2))
story.append(p(
    "Cuando el equipo académico (instructor o admin) hace click en \"Generar borrador con IA\":", BODY))
story.append(p(
    "1. El servidor lee los datos del paciente (system_prompt, family, visual, country, etc.).<br/>"
    "2. Llama a gpt-4o con el meta-prompt (el mismo de "
    "<font face='Mono' size='9'>docs/gen-enrichment-blocks.js</font>) restringido al bloque pedido.<br/>"
    "3. Recibe el JSON con el bloque pedido, lo persiste como <i>draft</i> en una tabla auxiliar "
    "(<i>enrichment_drafts</i>).<br/>"
    "4. Devuelve al UI el contenido para revisión.<br/>"
    "5. El equipo académico edita libremente, prueba con \"3 turnos\" si quiere, y aprueba.<br/>"
    "6. Al aprobar, el contenido se mueve de <i>enrichment_drafts</i> a la columna oficial "
    "<i>enrichment_*</i> con un INSERT inicial o UPDATE incremental, y se incrementa "
    "<i>enrichment_version</i>.", BODY))

story.append(p("8.6 Versionado y reversibilidad", H2))
story.append(p(
    "Cada bloque guarda su historial:", BODY))
story.append(code_block("""CREATE TABLE public.enrichment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ai_patients(id) ON DELETE CASCADE,
  block_name TEXT CHECK (block_name IN
    ('red_social', 'lugares', 'estado_corporal', 'frases_tipo')),
  version INT NOT NULL,
  content JSONB NOT NULL,
  generated_by TEXT,        -- 'ai' o 'human'
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);""", style=CODE_NEW))
story.append(p(
    "Esto permite rollback trivial a una versión anterior si un bloque resulta problemático en "
    "producción — patrón coherente con la cultura de migraciones reversibles establecida en "
    "INF-2026-037 e INF-2026-049.", BODY))

story.append(PageBreak())

# ─── §9 PLAN DE ROLLOUT ───
story.append(p("9. Plan de rollout para los 34 pacientes", H1))
story.append(p(
    "La migración de los 34 pacientes a su versión enriquecida debe ser progresiva. "
    "Plan recomendado en 4 fases:", BODY))

phases_data = [
    ["Fase", "Alcance", "Ambiente", "Duración", "Criterio de éxito"],
    ["1", "Schema + módulo de composición runtime",
        "Staging", "1 semana",
        "Pacientes existentes siguen funcionando idéntico (test de no regresión: 5 conversaciones random)."],
    ["2", "Migrar 5 pacientes piloto (uno por país excepto Chile que tendría 2)",
        "Staging", "2 semanas",
        "Comparativa cualitativa con docentes UGM. Sin regresión en pacing ni safety."],
    ["3", "Migrar los 29 restantes (en lotes de 5)",
        "Staging", "3 semanas",
        "Smoke test por lote. Si lote N falla, revertir antes de pasar a N+1."],
    ["4", "Promoción a PROD",
        "Producción", "Cut over de un día",
        "Mantener feature flag <i>ENABLE_ENRICHMENT_BLOCKS=true</i> para activación gradual."],
]
t_phases = Table(phases_data, colWidths=[1.3*cm, 4.2*cm, 2.0*cm, 1.8*cm, 6.7*cm])
t_phases.setStyle(TableStyle([
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("BACKGROUND", (0,0), (-1,0), INDIGO),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Calibri-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ("BOX", (0,0), (-1,-1), 0.5, BORDER),
    ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER),
]))
story.append(t_phases)
story.append(sp(8))

story.append(p("9.1 Plan de rollback", H2))
story.append(p(
    "Si una fase falla:<br/>"
    "1. Activar feature flag <i>ENABLE_ENRICHMENT_BLOCKS=false</i> → el módulo "
    "<font face='Mono' size='9'>build-system-prompt.ts</font> ignora las columnas de "
    "enriquecimiento y devuelve solo el system_prompt base. Reversión instantánea.<br/>"
    "2. Si hay corrupción de datos, restaurar los bloques desde "
    "<font face='Mono' size='9'>enrichment_history</font> (versión anterior).<br/>"
    "3. Como último recurso, eliminar las 4 columnas: "
    "<font face='Mono' size='9'>ALTER TABLE ai_patients DROP COLUMN enrichment_*</font>. "
    "El system_prompt original queda intacto en su columna de siempre.", BODY))

story.append(p("9.2 Estimación de costo y tiempo de migración inicial", H2))
story.append(p(
    f"• <b>Generación de los 34 bloques iniciales</b> ya completa "
    f"(<font face='Mono' size='9'>C:/tmp/enriched-blocks.json</font>) — costo USD ~0,30, "
    f"tiempo 80 segundos.<br/>"
    f"• <b>Aprobación humana</b>: estimado 15-30 minutos por paciente × 34 = 8-17 horas de "
    f"trabajo del equipo académico, distribuido en 3 semanas.<br/>"
    f"• <b>Cambios de código</b>: schema + build-system-prompt + UI editor + endpoint AI assist = "
    f"~3-4 días de desarrollo.<br/>"
    f"• <b>Costo de operación post-rollout</b>: el system_prompt en runtime crece ~+2.500 chars, "
    f"lo que añade ~0,0008 USD por turno con gpt-4.1-mini (negligible: ~24 ¢ por sesión de 30 turnos).", BODY))

story.append(PageBreak())

# ─── §10 LIMITACIONES ───
story.append(p("10. Limitaciones del experimento", H1))
story.append(p(
    "<b>• Una sola corrida por paciente.</b> A diferencia de INF-049 (3 corridas con Diego), "
    "aquí cada uno de los 15 pacientes se ejecutó solo una vez por prompt. La variabilidad "
    "intra-paciente NO está medida — solo la variabilidad inter-paciente. Esto limita la "
    "robustez estadística de los hallazgos. Para una afirmación rigurosa habría que hacer 3-5 "
    "corridas × 15 pacientes = ~150 corridas adicionales.", BODY))
story.append(p(
    "<b>• Estudiante simulado fijo.</b> Las 15 intervenciones son un script sin adaptación al "
    "paciente. Un estudiante humano podría profundizar más cuando el modelo introduce un nombre "
    "nuevo (\"cuéntame de Camila\"), generando dinámicas que el experimento no captura.", BODY))
story.append(p(
    "<b>• Métricas heurísticas, no clínicas.</b> Δchars, conteo de entidades y marcadores "
    "dialectales son proxies de calidad, no medidas clínicas. La validación con docentes UGM y "
    "supervisión clínica sería el siguiente paso para confirmar que la mejora se traduce en una "
    "mejor experiencia de práctica para el estudiante.", BODY))
story.append(p(
    "<b>• Selección aleatoria con n=15 sobre 34.</b> Cubre los 6 países y los 3 niveles, pero "
    "está sesgada hacia advanced (6/15 advanced vs 11/34 en la población). Una selección "
    "estratificada por dificultad daría una imagen más balanceada.", BODY))
story.append(p(
    "<b>• La generación de bloques con gpt-4o introduce sesgos del modelo.</b> El modelo puede "
    "tender a poblar pacientes femeninos con redes sociales más ricas, o a sobrerrepresentar "
    "ciertas profesiones. Una auditoría sistemática de los 34 bloques generados — antes de "
    "aplicar a producción — es esencial. (Esta auditoría está fuera del alcance de este informe.)", BODY))

story.append(sp(8))

# ─── §11 CITAS ───
story.append(p("11. Citas y referencias", H1))
story.append(p(
    "<b>Documentos hermanos:</b><br/>"
    "• INF-2026-047 — Caso clínico GlorIA 1.0: Alejandro López.<br/>"
    "• INF-2026-048 — Caso clínico GlorIA 5.0: Diego Fuentes.<br/>"
    "• INF-2026-049 — Propuesta de enriquecimiento del prompt de Diego (caso piloto).<br/>"
    "• INF-2026-037 — Upgrade pacientes legacy (origen de la estructura formal de 5.0).", BODY))
story.append(p(
    "<b>Código y datos generados:</b><br/>"
    "• <font face='Mono' size='9'>docs/gen-enrichment-blocks.js</font> — generador de los 4 "
    "bloques para los 34 pacientes (gpt-4o, concurrencia 5).<br/>"
    "• <font face='Mono' size='9'>docs/gen-enrichment-blocks-retry.js</font> — retry con backoff.<br/>"
    "• <font face='Mono' size='9'>docs/sim-050.js</font> — simulación 15 × 2 × 15 (Mulberry32 "
    "seed=42).<br/>"
    "• <font face='Mono' size='9'>docs/analyze-sim-050.js</font> — métricas de uso de "
    "entidades, dialecto, diversidad.<br/>"
    "• <font face='Mono' size='9'>C:/tmp/all-patients.json</font> — los 34 pacientes desde PROD.<br/>"
    "• <font face='Mono' size='9'>C:/tmp/enriched-blocks.json</font> — los 4 bloques × 34 "
    "pacientes.<br/>"
    "• <font face='Mono' size='9'>C:/tmp/sim-050.json</font> — las 30 conversaciones de 15 "
    "turnos.<br/>"
    "• <font face='Mono' size='9'>C:/tmp/sim-050-analysis.json</font> — métricas calculadas.", BODY))
story.append(p(
    "<b>Memorias relevantes:</b><br/>"
    "• <i>project_staging_supabase</i> — staging vhkbbps... para validar antes de prod.<br/>"
    "• <i>feedback_supabase_link</i> — verificar project-ref antes de db push.<br/>"
    "• <i>feedback_cuidado_no_romper</i> — protocolo cuidadoso en producción.", BODY))

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"Generated: {OUT}")
print(f"Size: {os.path.getsize(OUT)/1024:.1f} KB")
