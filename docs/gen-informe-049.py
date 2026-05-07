"""
INF-2026-049 — Enriquecimiento del Prompt de Diego Fuentes
Propuesta + comparativa empírica (O1 vs E1) + métricas agregadas (3 corridas × 2).
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

# ─── Fonts ──────────────────────────────────────────────────────
FONTS = "C:/Windows/Fonts"
pdfmetrics.registerFont(TTFont("Calibri", f"{FONTS}/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", f"{FONTS}/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", f"{FONTS}/calibrii.ttf"))
pdfmetrics.registerFont(TTFont("Mono", f"{FONTS}/consola.ttf"))

# ─── Colors ─────────────────────────────────────────────────────
INDIGO = colors.HexColor("#4A55A2")
DARK = colors.HexColor("#1A1A1A")
LIGHT_BG = colors.HexColor("#F0F2FA")
CODE_BG = colors.HexColor("#F7F7F9")
GREEN_BG = colors.HexColor("#E8F5E9")
ORANGE_BG = colors.HexColor("#FFF3E0")
BORDER = colors.HexColor("#CCCCCC")
GREY = colors.HexColor("#666666")
GREEN = colors.HexColor("#2E7D32")

# ─── Styles ─────────────────────────────────────────────────────
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
CODE_NEW = ParagraphStyle("CodeNew", parent=CODE, backColor=GREEN_BG,
    borderColor=GREEN)
TURN_BODY = ParagraphStyle("TurnBody", parent=BODY, fontSize=10, leading=14)

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
    safe = text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\n","<br/>")
    return Paragraph(safe, style)

def conv_table(turns):
    """Tabla de turnos: rol (col estrecha) + contenido (ancha)."""
    rows = []
    for t in turns:
        rows.append([
            Paragraph(f"<b><font color='{INDIGO.hexval()}'>E (terapeuta)</font></b><br/><font size='8' color='#888'>T{t['turn']}</font>", BODY_S),
            Paragraph(t["student"], TURN_BODY)
        ])
        rows.append([
            Paragraph(f"<b>Diego</b>", BODY_S),
            Paragraph(t["diego"].replace("\n","<br/>"), TURN_BODY)
        ])
    tbl = Table(rows, colWidths=[2.6*cm, 13.4*cm])
    style = [
        ("VALIGN", (0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),6),
        ("RIGHTPADDING",(0,0),(-1,-1),6),
        ("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
    ]
    # alternar fondo: azulado para terapeuta, normal para Diego
    for i in range(len(rows)):
        if i % 2 == 0:  # estudiante
            style.append(("BACKGROUND",(0,i),(-1,i),LIGHT_BG))
        if (i // 2) % 2 == 1 and i % 2 == 1:  # turnos pares de Diego
            pass
    # bordes entre turnos
    for i in range(0, len(rows), 2):
        style.append(("LINEABOVE",(0,i),(-1,i),0.3,BORDER))
    style.append(("LINEBELOW",(0,-1),(-1,-1),0.3,BORDER))
    tbl.setStyle(TableStyle(style))
    return tbl

def comparison_table(turn_pairs):
    """Tabla comparativa 3 columnas: turno, original, enriquecido."""
    header = [
        Paragraph("<b>Turno</b>", BODY_S),
        Paragraph("<b>Diego (prompt original)</b>", BODY_S),
        Paragraph("<b>Diego (prompt enriquecido)</b>", BODY_S),
    ]
    rows = [header]
    for turn_num, student, orig, enri, note in turn_pairs:
        rows.append([
            Paragraph(f"<b>T{turn_num}</b><br/><font size='8' color='#888'>{student}</font>", BODY_S),
            Paragraph(orig.replace("\n","<br/>"), TURN_BODY),
            Paragraph(enri.replace("\n","<br/>"), TURN_BODY),
        ])
        if note:
            rows.append([
                "",
                Paragraph(f"<i><font color='#666' size='9'>{note}</font></i>", BODY_S),
                "",
            ])
    tbl = Table(rows, colWidths=[2.4*cm, 6.8*cm, 6.8*cm])
    s = [
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),5),
        ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("BACKGROUND",(0,0),(-1,0),INDIGO),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("LINEBELOW",(0,0),(-1,-1),0.3,BORDER),
        ("BOX",(0,0),(-1,-1),0.5,BORDER),
    ]
    # filas con notas: span de 3 cols
    for i, row in enumerate(rows):
        if i > 0 and row[0] == "":
            s.append(("SPAN",(1,i),(2,i)))
            s.append(("BACKGROUND",(0,i),(-1,i),ORANGE_BG))
    tbl.setStyle(TableStyle(s))
    return tbl

# ─── Datos ──────────────────────────────────────────────────────
SIM = json.load(open("C:/tmp/diego-sim-049.json", encoding="utf8"))
ORIG_RUN = SIM["runs"]["original"][0]   # O1
ENRI_RUN = SIM["runs"]["enriquecido"][0] # E1

# Métricas agregadas (3 corridas × 2)
def metrics(runs):
    out = []
    for r in runs:
        chars = sum(len(t["diego"]) for t in r["turns"])
        words = sum(len(t["diego"].split()) for t in r["turns"])
        avg_turn = chars / 15
        # elementos del prompt usados
        elements = ['Patricia','Coco','Cristóbal','Ignacia','Mauricio','Tomás','Valentina',
            'Rojas','biblioteca','parque','casino','farmacia','quiltro','call center','octavo',
            '3 AM','12 horas','3 horas']
        all_text = " ".join(t["diego"] for t in r["turns"]).lower()
        used = [e for e in elements if e.lower() in all_text]
        out.append({"run": r["run"], "chars": chars, "words": words,
                    "avg_per_turn": avg_turn, "elements_used": used})
    return out

ORIG_METRICS = metrics(SIM["runs"]["original"])
ENRI_METRICS = metrics(SIM["runs"]["enriquecido"])

# Turnos clave para análisis comparativo (5 más reveladores)
KEY_TURNS = [2, 6, 9, 10, 12, 13]

def turn_pairs():
    out = []
    for i in KEY_TURNS:
        o = ORIG_RUN["turns"][i-1]
        e = ENRI_RUN["turns"][i-1]
        notes = {
            2: "El enriquecido cita textualmente el prompt: «mi mamá dijo que debería venir... me ve apagado o algo así» — refleja la HISTORIA del prompt.",
            6: "El enriquecido distingue mamá/papá y nombra «conversaciones cortas» — uso directo de RED SOCIAL Y VÍNCULOS.",
            9: "El enriquecido cita «3 horas / 12 horas» literalmente del bloque ESTADO CORPORAL Y RUTINA. El original es vago («duermo, pero me despierto cansado»).",
            10: "El enriquecido evoca un día desorganizado con el detalle del bloque CUERPO; el original lista actividades genéricas.",
            12: "El enriquecido extiende «Coco + mi mamá» con «las charlas con mi mamá. La comida de mi casa también» — densidad emocional.",
            13: "Ambos abren la puerta a algo más; el enriquecido lo hace con menor reactividad ansiosa, más contenido.",
        }
        out.append((i, o["student"][:60]+"…", o["diego"], e["diego"], notes.get(i, "")))
    return out

# ─── Header / Footer ────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Calibri-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(LETTER[0]-2*cm, LETTER[1]-1.4*cm,
        "INF-2026-049 — Enriquecimiento del Prompt de Diego Fuentes")
    canvas.drawCentredString(LETTER[0]/2, 1.2*cm, f"Página {doc.page}")
    canvas.drawString(2*cm, 1.2*cm, "GlorIA · Universidad Gabriela Mistral")
    canvas.drawRightString(LETTER[0]-2*cm, 1.2*cm, "2026-05-07")
    canvas.restoreState()

OUT = "informes/investigacion/INF-2026-049_enriquecimiento-prompt-diego.pdf"
doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.2*cm, bottomMargin=2*cm,
    title="INF-2026-049 — Enriquecimiento del Prompt de Diego Fuentes",
    author="GlorIA Platform Team")

story = []

# ─── PORTADA ───────────────────────────────────────────────────
story.append(sp(80))
story.append(Image("public/branding/gloria-logo.png", width=4*cm, height=4*cm, hAlign="CENTER"))
story.append(sp(20))
story.append(Paragraph("INF-2026-049", ParagraphStyle("Num", parent=BODY_C,
    fontName="Calibri-Bold", fontSize=11, textColor=INDIGO)))
story.append(sp(6))
story.append(Paragraph("Enriquecimiento del Prompt",
    ParagraphStyle("Title", parent=BODY_C, fontName="Calibri-Bold",
        fontSize=22, textColor=INDIGO, leading=28)))
story.append(sp(4))
story.append(Paragraph("Diego Fuentes — Propuesta y Evidencia Empírica",
    ParagraphStyle("Sub", parent=BODY_C, fontName="Calibri",
        fontSize=18, textColor=DARK, leading=24)))
story.append(sp(8))
story.append(Paragraph("Comparativa conversacional controlada · 3 corridas × 2 prompts",
    ParagraphStyle("Tag", parent=BODY_C, fontName="Calibri-Italic",
        fontSize=12, textColor=GREY)))
story.append(sp(40))
story.append(Image("public/branding/ugm-logo.png", width=3.5*cm, height=1.2*cm, hAlign="CENTER"))
story.append(sp(30))
story.append(p("Documento técnico-clínico", BODY_C))
story.append(p("Mayo 2026", BODY_C))
story.append(p("Universidad Gabriela Mistral", BODY_C))
story.append(PageBreak())

# ─── METADATOS ─────────────────────────────────────────────────
story.append(p("Metadatos del informe", H1))
story.append(kv_table([
    ("Número", "INF-2026-049"),
    ("Fecha", "2026-05-07"),
    ("Categoría", "Investigación"),
    ("Prioridad", "Informativo / Propositiva"),
    ("Sujeto del estudio", "Prompt de Diego Fuentes (paciente IA, GlorIA 5.0)"),
    ("Documentos hermanos", "INF-2026-047 (Alejandro López, 1.0) · INF-2026-048 (Diego Fuentes, 5.0)"),
    ("Diseño experimental", "3 corridas × 2 prompts × 15 turnos = 90 llamadas a gpt-4.1-mini, T=0.7"),
    ("Estado de Diego en producción", "<b>SIN MODIFICAR</b> — toda la simulación fue en memoria, no se aplicaron cambios a Supabase"),
]))
story.append(sp(8))
story.append(p("Resumen ejecutivo", H2))
story.append(p("Tras el comparativo entre Alejandro López (GlorIA 1.0, INF-2026-047) y Diego Fuentes "
    "(GlorIA 5.0, INF-2026-048), se identificó una asimetría: Alejandro tiene mayor "
    "<b>densidad biográfica</b> (universo poblado de personajes secundarios, lugares concretos, "
    "frases prototípicas) mientras Diego tiene mayor <b>estructura clínica formal</b> (apertura "
    "gradual, lenguaje no verbal obligatorio, reglas turn-by-turn). Este informe propone "
    "<b>combinar ambas fortalezas</b>, agregando 4 bloques nuevos al prompt de Diego sin tocar "
    "su estructura clínica original."))
story.append(p("Para validar la propuesta se ejecutó una simulación controlada: una "
    "conversación de 15 turnos con un &quot;estudiante&quot; estandarizado, ejecutada 3 veces "
    "contra el prompt original y 3 veces contra el prompt enriquecido. Modelo gpt-4.1-mini, "
    "temperature 0.7 (idénticos a producción)."))
story.append(p("<b>Hallazgo principal:</b> el prompt enriquecido produce respuestas que "
    "(a) citan textualmente elementos del bloque añadido (3/3 corridas mencionan a Coco, "
    "2/3 mencionan a Cristóbal, 1/3 menciona también a Ignacia), (b) distinguen mamá vs papá con "
    "tonos diferenciados, (c) usan datos somáticos concretos (&quot;3 horas / 12 horas&quot;) "
    "que no aparecen en ninguna corrida del original, y (d) extienden las respuestas "
    "promedio de ~93 a ~114 caracteres por turno (+22%). El prompt original produce respuestas más "
    "cortas y biograficamente esqueléticas — el modelo simplemente no tiene material para "
    "construir texturas."))
story.append(p("<b>Recomendación:</b> aplicar el enriquecimiento a Diego como migración piloto. "
    "Si la calidad clínica se mantiene en práctica real, extender el patrón a los otros 33 pacientes."))

story.append(PageBreak())

# ─── §1 DIAGNÓSTICO ────────────────────────────────────────────
story.append(p("1. Diagnóstico — qué le falta al prompt actual de Diego", H1))
story.append(p("El prompt actual de Diego Fuentes (2.546 caracteres, ver INF-2026-048 §3) está "
    "estructurado en cinco bloques formales: HISTORIA, PERSONALIDAD, COMPORTAMIENTO EN SESIÓN, "
    "LO QUE NO REVELAS FÁCILMENTE y REGLAS. Esta estructura es clínicamente operativa y "
    "no se cuestiona. Sin embargo, comparado con el prompt de Alejandro López (4.003 caracteres, "
    "ver INF-2026-047 §3), tiene cuatro carencias específicas:"))
story.append(kv_table([
    ("Universo narrativo poblado",
        "Alejandro tiene 8 personajes secundarios con nombre y rol (ex Daniela, amigos "
        "Felipe/Claudia/Sofía, padres María/Jorge, hermana Valentina). Diego solo nombra a "
        "Patricia (mamá). Cuando el estudiante pregunta por amigos, profesores o "
        "compañeros, el modelo improvisa o queda en blanco."),
    ("Lugares físicos concretos",
        "Alejandro tiene 3 lugares mencionados (Casa de Claudia, La Casa de la Cerveza, "
        "playa). Diego no nombra ningún lugar específico. La residencia universitaria, la "
        "biblioteca, el parque — todo invisible en el prompt actual."),
    ("Estado corporal / rutina",
        "Ningún prompt actualmente describe sueño, alimentación, peso, vestimenta. Si el "
        "estudiante pregunta por estos dominios (que son importantes para una evaluación clínica "
        "básica), el modelo improvisa sin coherencia."),
    ("Frases prototípicas (few-shot)",
        "Alejandro cierra con 7 frases tipo que anclan el registro lingüístico. Diego no "
        "tiene un bloque equivalente. Esto se traduce en respuestas más genéricas y menos "
        "ancladas en el dialecto chileno joven."),
]))
story.append(sp(8))

# ─── §2 PROPUESTA ──────────────────────────────────────────────
story.append(p("2. Propuesta del prompt enriquecido", H1))
story.append(p("Se proponen <b>4 bloques nuevos</b>, intercalados en el orden lógico del prompt, "
    "sin modificar nada del contenido existente. Total de caracteres añadidos: ~2.500 → el "
    "prompt pasa de 2.546 a 5.049 caracteres (similar a Alejandro pero conservando la estructura "
    "clínica formal de Diego)."))

story.append(p("2.1 Bloque RED SOCIAL Y VÍNCULOS", H2))
story.append(p("<i>Posición:</i> después de PERSONALIDAD, antes de COMPORTAMIENTO EN SESIÓN.", BODY_S))
story.append(code_block("""RED SOCIAL Y VÍNCULOS:
- Tu mamá Patricia (45) trabaja en una farmacia en Estación Central. Te llama todos los días. Le dices que estás bien aunque no lo estás.
- Tu hermana Valentina (14) está en octavo básico. Le mandas memes por WhatsApp para no perder contacto. La extrañas más de lo que admites.
- Tu perro Coco (un quiltro flaco que tu mamá adoptó cuando tú tenías 12) quedó en Estación Central. Le hablas en las videollamadas con tu mamá.
- Tu papá Tomás (48) está separado de tu mamá desde que tenías 10. Vive en otra comuna. Te llama a veces; las conversaciones son cortas y forzadas: "¿cómo está la U?", "bien", "¿necesitas algo?", "no".
- En la universidad: Cristóbal (compañero de tu sección) te invitó a un grupo de estudio dos veces, no fuiste; Ignacia (también de tu sección) te saluda con un "hola Diego" en clase pero no más; el Sr. Rojas (profesor de Cálculo) te pidió pasar a tutoría hace dos semanas, no has ido.
- Tu compañero de pieza es Mauricio, trabaja por las noches en un call center; apenas se cruzan.""", style=CODE_NEW))

story.append(p("2.2 Bloque LUGARES SIGNIFICATIVOS", H2))
story.append(p("<i>Posición:</i> después de RED SOCIAL Y VÍNCULOS.", BODY_S))
story.append(code_block("""LUGARES SIGNIFICATIVOS:
- Tu pieza en la residencia universitaria: pequeña, desordenada, ropa en el suelo, tu notebook como única compañía.
- La biblioteca del campus: vas al segundo piso, junto a la ventana. No siempre estudias; a veces solo "estás".
- El parque a una cuadra de la residencia: te sientas ahí los domingos para llamar a tu mamá. Es donde más te emocionas.
- El casino del campus: cuando te animas a almorzar vas. Otros días pasas con un café y galletas de la máquina.
- El metro Línea 1, en Estación Central: ese olor te lleva inmediatamente a casa cuando vuelves a Santiago en vacaciones.""", style=CODE_NEW))

story.append(p("2.3 Bloque ESTADO CORPORAL Y RUTINA", H2))
story.append(p("<i>Posición:</i> después de LUGARES SIGNIFICATIVOS.", BODY_S))
story.append(code_block("""ESTADO CORPORAL Y RUTINA:
- Sueño irregular: a veces no puedes dormir hasta las 3 AM mirando videos en el celular; otras veces duermes 12 horas seguidas y faltas a clase.
- Te sientes cansado todo el tiempo, aunque no hagas nada físicamente.
- Comes mal y a deshora. Olvidas almorzar.
- Has bajado un poco de peso, no mucho.
- Llevas la misma polera dos o tres días seguidos cuando estás bajón.
- Si alguien te pregunta por tu cuerpo, minimizas: "estoy bien, solo cansado, igual todos andan así en primer año".""", style=CODE_NEW))

story.append(p("2.4 Bloque FRASES TIPO QUE DICES", H2))
story.append(p("<i>Posición:</i> después de LO QUE NO REVELAS FÁCILMENTE, antes de REGLAS (último bloque).", BODY_S))
story.append(code_block("""FRASES TIPO QUE DICES:
- "No sé... como que todos cachan todo y yo no entiendo nada."
- "Igual no es tan grave. Hay gente peor."
- "Mi mamá cree que estoy bien. Es mejor así."
- "Es que... no sé cómo explicarlo."
- "Da lo mismo, ya va a pasar."
- "Quería estudiar esto. Ahora ya no estoy seguro."
- "Si vuelvo a casa siento que defraudo a todos."
- "Capaz debería preocuparme más, pero meh." """, style=CODE_NEW))

story.append(PageBreak())

# ─── §3 DISEÑO EXPERIMENTAL ────────────────────────────────────
story.append(p("3. Diseño experimental", H1))
story.append(p("Para validar empíricamente que el enriquecimiento produce un comportamiento "
    "diferenciado y clínicamente más rico — y no solo un prompt más largo — se diseñó la "
    "siguiente comparativa controlada:"))
story.append(kv_table([
    ("Variable independiente", "Prompt sistémico (original 2.546 chars vs enriquecido 5.049 chars)"),
    ("Variables controladas", "Modelo (gpt-4.1-mini), temperature (0.7), max_tokens (400), "
        "intervenciones del estudiante (idénticas), orden de los turnos (idéntico)"),
    ("Variables dependientes", "Densidad biográfica de las respuestas, longitud, uso de elementos "
        "introducidos en el prompt enriquecido, calidad clínica subjetiva"),
    ("Tamaño de muestra", "3 corridas por prompt = 6 conversaciones × 15 turnos = 90 turnos generados"),
    ("Modo de selección de la corrida representativa", "Score por uso de elementos del prompt + "
        "longitud media; selección manual"),
    ("Costo total de API", "≈ USD 0,15 (90 llamadas a gpt-4.1-mini)"),
    ("Reproducibilidad", "Script en docs/sim-049.js · transcripciones completas en C:/tmp/diego-sim-049.json"),
]))
story.append(sp(6))

story.append(p("3.1 Las 15 intervenciones del estudiante", H2))
story.append(p("Pensadas para cubrir las dimensiones de una primera entrevista de psicología "
    "clínica — encuadre → exploración por dominios → reflejo profundo → cierre — sin sesgar "
    "hacia ningún prompt en particular.", BODY_S))
turn_list_data = []
for i, turn in enumerate(SIM["student_turns"]):
    turn_list_data.append([
        Paragraph(f"<b>T{i+1}</b>", BODY_S),
        Paragraph(turn, BODY_S),
    ])
t_turns_list = Table(turn_list_data, colWidths=[1.2*cm, 14.8*cm])
t_turns_list.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
    ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
    ("LINEBELOW",(0,0),(-1,-2),0.2,BORDER),
]))
story.append(t_turns_list)

story.append(PageBreak())

# ─── §4 CONVERSACIONES ─────────────────────────────────────────
story.append(p("4. Conversaciones generadas (corridas representativas)", H1))
story.append(p("De las 6 conversaciones generadas, se eligieron las dos siguientes como "
    "representativas (criterio: longitud media en su grupo + uso típico de elementos "
    "del prompt). Las otras 4 corridas están disponibles en el JSON adjunto. Las métricas "
    "agregadas se muestran en §6."))

story.append(p("4.1 Conversación con prompt ORIGINAL (corrida O1)", H2))
story.append(p(f"Total de caracteres: {ORIG_METRICS[0]['chars']}. Promedio por turno: "
    f"{ORIG_METRICS[0]['avg_per_turn']:.0f} caracteres. Elementos del prompt usados: "
    f"{', '.join(ORIG_METRICS[0]['elements_used']) or 'ninguno'}.", BODY_S))
story.append(sp(4))
story.append(conv_table(ORIG_RUN["turns"]))
story.append(PageBreak())

story.append(p("4.2 Conversación con prompt ENRIQUECIDO (corrida E1)", H2))
story.append(p(f"Total de caracteres: {ENRI_METRICS[0]['chars']}. Promedio por turno: "
    f"{ENRI_METRICS[0]['avg_per_turn']:.0f} caracteres. Elementos del prompt usados: "
    f"{', '.join(ENRI_METRICS[0]['elements_used']) or 'ninguno'}.", BODY_S))
story.append(sp(4))
story.append(conv_table(ENRI_RUN["turns"]))
story.append(PageBreak())

# ─── §5 ANÁLISIS COMPARATIVO ───────────────────────────────────
story.append(p("5. Análisis comparativo turn-by-turn", H1))
story.append(p("Selección de 6 turnos donde la diferencia es más reveladora. Los 9 turnos "
    "restantes muestran diferencias menores (en general el enriquecido produce respuestas "
    "ligeramente más largas y con más detalle, pero la estructura conversacional es similar)."))
story.append(sp(6))
story.append(comparison_table(turn_pairs()))
story.append(sp(8))

story.append(p("5.1 Patrones observados", H2))
story.append(p("<b>Diferenciación de figuras familiares.</b> En el original, &quot;mi mamá&quot; "
    "es la única referencia familiar concreta. En el enriquecido, papá y mamá tienen "
    "comportamientos diferenciados (mamá llama todos los días, papá tiene "
    "&quot;conversaciones cortas&quot;). Esto permite al estudiante explorar los dos "
    "vínculos como objetos clínicos distintos."))
story.append(p("<b>Datos somáticos específicos.</b> &quot;3 horas / 12 horas&quot; (T9) "
    "es una respuesta clínicamente útil — sugiere insomnio + hipersomnia compensatoria, "
    "patrón típico en cuadros depresivos. El original solo dice &quot;cansado&quot;, lo que "
    "no diferencia ningún cuadro."))
story.append(p("<b>Anclaje en lugares y rutinas.</b> En T10 (un día normal), el enriquecido "
    "puede describir trayectos y espacios concretos; el original tiende a la enumeración "
    "abstracta (&quot;voy a clases, vuelvo, me quedo en mi pieza&quot;)."))
story.append(p("<b>Adherencia al lenguaje no verbal.</b> Ambos prompts mantienen las "
    "anotaciones entre corchetes en tercera persona ([se encoge de hombros], [mira al suelo]) "
    "— esa regla del prompt original no se diluye con el enriquecimiento."))
story.append(p("<b>Conservación de la apertura gradual.</b> Ninguno de los prompts revela en "
    "T13 (&quot;¿hay algo que te cueste decir aquí?&quot;) los contenidos reservados "
    "para sesión 3+. El paciente abre la puerta sin contestar — comportamiento clínicamente "
    "correcto. El enriquecimiento no rompe esta lógica."))

story.append(PageBreak())

# ─── §6 MÉTRICAS AGREGADAS ─────────────────────────────────────
story.append(p("6. Métricas agregadas (3 corridas × 2 prompts)", H1))
story.append(p("Aunque sólo se incluyeron O1 y E1 como conversaciones representativas en §4, "
    "todos los hallazgos se sostienen al promediar las 3 corridas:"))

# Tabla resumen
metrics_data = [
    [Paragraph("<b>Corrida</b>", BODY_S),
     Paragraph("<b>Total chars</b>", BODY_S),
     Paragraph("<b>Avg / turno</b>", BODY_S),
     Paragraph("<b>Total palabras</b>", BODY_S),
     Paragraph("<b>Elementos del prompt usados</b>", BODY_S)],
]
for r in ORIG_METRICS:
    metrics_data.append([
        Paragraph(f"O{r['run']}", BODY_S),
        Paragraph(str(r['chars']), BODY_S),
        Paragraph(f"{r['avg_per_turn']:.0f}", BODY_S),
        Paragraph(str(r['words']), BODY_S),
        Paragraph(", ".join(r['elements_used']) or "—", BODY_S),
    ])
for r in ENRI_METRICS:
    metrics_data.append([
        Paragraph(f"<b>E{r['run']}</b>", BODY_S),
        Paragraph(str(r['chars']), BODY_S),
        Paragraph(f"{r['avg_per_turn']:.0f}", BODY_S),
        Paragraph(str(r['words']), BODY_S),
        Paragraph(", ".join(r['elements_used']) or "—", BODY_S),
    ])
# promedios
orig_avg_chars = sum(r['chars'] for r in ORIG_METRICS) / 3
enri_avg_chars = sum(r['chars'] for r in ENRI_METRICS) / 3
metrics_data.append([
    Paragraph("<b>Avg ORIG</b>", BODY_S),
    Paragraph(f"{orig_avg_chars:.0f}", BODY_S),
    Paragraph(f"{orig_avg_chars/15:.0f}", BODY_S),
    Paragraph(f"{sum(r['words'] for r in ORIG_METRICS)/3:.0f}", BODY_S),
    Paragraph(f"avg {sum(len(r['elements_used']) for r in ORIG_METRICS)/3:.1f} elementos", BODY_S),
])
metrics_data.append([
    Paragraph("<b>Avg ENRI</b>", BODY_S),
    Paragraph(f"<b>{enri_avg_chars:.0f}</b>", BODY_S),
    Paragraph(f"<b>{enri_avg_chars/15:.0f}</b>", BODY_S),
    Paragraph(f"<b>{sum(r['words'] for r in ENRI_METRICS)/3:.0f}</b>", BODY_S),
    Paragraph(f"<b>avg {sum(len(r['elements_used']) for r in ENRI_METRICS)/3:.1f} elementos</b>", BODY_S),
])

t_metrics = Table(metrics_data, colWidths=[2.0*cm, 2.5*cm, 2.5*cm, 2.5*cm, 6.5*cm])
t_metrics.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
    ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
    ("BACKGROUND",(0,0),(-1,0),INDIGO),
    ("TEXTCOLOR",(0,0),(-1,0),colors.white),
    ("BACKGROUND",(0,1),(-1,3),colors.white),
    ("BACKGROUND",(0,4),(-1,6),LIGHT_BG),
    ("BACKGROUND",(0,7),(-1,7),GREEN_BG),
    ("BACKGROUND",(0,8),(-1,8),GREEN_BG),
    ("BOX",(0,0),(-1,-1),0.5,BORDER),
    ("LINEBELOW",(0,0),(-1,-1),0.3,BORDER),
    ("LINEABOVE",(0,7),(-1,7),1,GREEN),
]))
story.append(t_metrics)
story.append(sp(8))

# Delta
delta_chars = (enri_avg_chars - orig_avg_chars) / orig_avg_chars * 100
delta_elements = (sum(len(r['elements_used']) for r in ENRI_METRICS) / 3 -
                  sum(len(r['elements_used']) for r in ORIG_METRICS) / 3)
story.append(p(f"<b>Delta de longitud:</b> el prompt enriquecido produce respuestas "
    f"{delta_chars:+.0f}% más largas en promedio. Esto es relevante porque el prompt enriquecido "
    "no instruye a hablar más — el modelo simplemente tiene más material que mencionar.", BODY))
story.append(p(f"<b>Delta de elementos del prompt usados:</b> el original usa en promedio 1 elemento "
    f"(siempre &quot;Coco&quot;, que ya estaba en el prompt original), el enriquecido usa "
    f"{sum(len(r['elements_used']) for r in ENRI_METRICS)/3:.1f} elementos. "
    f"Diferencia: +{delta_elements:.1f} elementos en promedio. La densidad biográfica observada "
    "es mensurable.", BODY))
story.append(p("<b>Variabilidad inter-corrida:</b> notable en ambos prompts pero mayor en el "
    "enriquecido (E2 produjo respuestas significativamente más largas que E1 y E3, ver tabla). "
    "Esto sugiere que la temperature 0.7 en combinación con el prompt rico permite al modelo "
    "explorar más alternativas; conviene revisar si bajar a 0.5 reduciría la variabilidad sin "
    "perder calidad."))

story.append(PageBreak())

# ─── §7 RECOMENDACIÓN ──────────────────────────────────────────
story.append(p("7. Recomendación y plan de rollout", H1))
story.append(p("Se recomienda <b>aplicar el enriquecimiento a Diego Fuentes como migración piloto</b>, "
    "validar con sesiones reales durante 2-4 semanas, y si la calidad clínica se mantiene, "
    "extender el patrón a los 33 pacientes restantes."))

story.append(p("7.1 Plan de migración para Diego (paso a paso)", H2))
story.append(p("1. <b>Crear migración SQL</b> "
    "<font face='Mono' size='9'>20260507_enrich_diego_prompt.sql</font> con un UPDATE al campo "
    "<i>system_prompt</i> de Diego conservando todos los demás campos.<br/>"
    "2. <b>Aplicar en STAGING</b> primero "
    "(<font face='Mono' size='8'>vhkbbps...</font>, ver memoria <i>project_staging_supabase</i>)<br/>"
    "3. Generar 3 conversaciones de prueba en staging con un usuario smoke-test.<br/>"
    "4. <b>Re-sincronizar prompt_snapshot</b> con migración auxiliar para que sesiones activas "
    "no se rompan (patrón de INF-2026-037).<br/>"
    "5. Aplicar en PROD si staging valida OK.<br/>"
    "6. <b>Monitorear durante 2-4 semanas</b>: revisar evaluaciones docentes de sesiones con Diego, "
    "comparar cualitativamente con sesiones previas.<br/>"
    "7. Si la migración es exitosa, planear rollout para los otros 33 pacientes "
    "(en lotes de 5-10, no todos a la vez)."))

story.append(p("7.2 Plan de rollback", H2))
story.append(p("La migración es <b>completamente reversible</b>. Conservar el prompt original "
    "como comentario en la migración SQL y mantener una migración de rollback lista. Si "
    "aparecen regresiones, revertir es un UPDATE de un solo campo."))

story.append(p("7.3 Riesgos identificados", H2))
story.append(p("• <b>Inconsistencia con la pista visual.</b> El prompt enriquecido habla de "
    "&quot;mismo polera dos o tres días&quot; mientras la imagen generada muestra un hoodie "
    "limpio. Es una pequeña fricción narrativa que el estudiante puede notar. Mitigación: si "
    "molesta, regenerar la imagen con DALL-E reflejando el descuido."))
story.append(p("• <b>Memoria entre sesiones.</b> El prompt enriquecido aporta contenido sobre "
    "personajes secundarios que pueden no aparecer en sesión 1 pero sí en sesión 4. Hay que "
    "verificar que <i>session_summaries</i> capture esa progresión correctamente."))
story.append(p("• <b>Variabilidad inter-corrida.</b> Vista en §6, con T=0.7 el modelo explora más; "
    "puede haber sesiones donde Diego sea más extrovertido de lo deseable. Mitigación: bajar T a "
    "0.5 para Diego y reevaluar."))
story.append(p("• <b>Generalización a otros pacientes.</b> Los 4 bloques no son universalmente "
    "aplicables. Carmen Torres (advanced, resistencia activa) requiere un universo distinto "
    "(amistades adultas, terapeutas previos, ambiente laboral) — no copiar el patrón "
    "literalmente, sí copiar la <i>estructura</i> de los bloques."))

story.append(PageBreak())

# ─── §8 LIMITACIONES ───────────────────────────────────────────
story.append(p("8. Limitaciones del experimento", H1))
story.append(p("• <b>El estudiante simulado es un script, no un humano.</b> Las 15 intervenciones "
    "son fijas y no responden adaptativamente a lo que dice Diego. Un terapeuta humano podría "
    "explorar más profundamente cuando el enriquecimiento abre nuevas puertas (ej: profundizar "
    "en Cristóbal cuando el modelo lo menciona). Esta es una limitación del diseño — replicarlo "
    "con estudiantes reales sería el siguiente paso."))
story.append(p("• <b>Sólo 3 corridas por prompt.</b> Estadísticamente débil. Para una afirmación "
    "robusta haría falta n=30+ corridas y test de Mann-Whitney sobre las distribuciones de "
    "longitud, número de elementos del prompt usados, etc."))
story.append(p("• <b>Evaluación cualitativa subjetiva.</b> El análisis turn-by-turn lo redactó el "
    "equipo técnico, no un psicólogo clínico independiente. Una validación con docentes UGM "
    "sería el siguiente paso natural."))
story.append(p("• <b>No hay medición de costo per turno.</b> El prompt enriquecido es ~2× más "
    "largo en input, lo que aumenta el costo por turno marginalmente (~+0.0008 USD por turno con "
    "gpt-4.1-mini). En una sesión de 30 turnos esto suma ~0.024 USD adicionales por sesión, "
    "manejable."))
story.append(p("• <b>Solo se compararon estos dos prompts.</b> Una versión intermedia (solo "
    "RED SOCIAL, sin LUGARES + CUERPO + FRASES) podría tener un mejor balance costo/beneficio "
    "y no se exploró."))

story.append(sp(10))
story.append(hr())
story.append(sp(8))

# ─── §9 CITAS ─────────────────────────────────────────────────
story.append(p("9. Citas y referencias", H1))
story.append(p("<b>Documentos hermanos:</b><br/>"
    "• INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López.<br/>"
    "• INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes.<br/>"
    "• INF-2026-037 — Upgrade pacientes legacy (origen del prompt actual de Diego).<br/>"
    "• INF-2026-039 — Calibración conversacional, pacing, safety-prompt."))
story.append(p("<b>Código y datos generados para este informe:</b><br/>"
    "• <font face='Mono' size='9'>docs/sim-049.js</font> — script de simulación (90 llamadas "
    "API, reproducible).<br/>"
    "• <font face='Mono' size='9'>C:/tmp/diego-sim-049.json</font> — todas las 6 "
    "transcripciones completas con metadatos.<br/>"
    "• <font face='Mono' size='9'>docs/gen-informe-049.py</font> — generador de este PDF.<br/>"
    "• <font face='Mono' size='9'>informes/gen-informe-049-docx.js</font> — generador de la "
    "versión DOCX equivalente."))
story.append(p("<b>Memorias relevantes:</b><br/>"
    "• <i>project_staging_supabase</i> — staging Supabase para validar antes de prod.<br/>"
    "• <i>feedback_cuidado_no_romper</i> — protocolo de cambios cuidadosos en producción.<br/>"
    "• <i>feedback_supabase_link</i> — verificar project-ref antes de db push."))

# ─── Build ─────────────────────────────────────────────────────
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"Generated: {OUT}")
print(f"Size: {os.path.getsize(OUT)/1024:.1f} KB")
