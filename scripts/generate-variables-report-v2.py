"""
GlorIA — Reporte de Variables (v2 con referencias verificadas por Perplexity)
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable, KeepTogether
)
from datetime import datetime
import json

SIDEBAR = HexColor("#4A55A2")
GRAY = HexColor("#6B7280")
DARK = HexColor("#1A1A1A")
WHITE = HexColor("#FFFFFF")
LINK_COLOR = HexColor("#2563EB")

OUTPUT = "C:/Users/tomas/documents/gloriapp/GlorIA_Variables_Perfiles_IA_v2.pdf"
REFS_FILE = "C:/Users/tomas/documents/gloriapp/scripts/verified_references.json"

with open(REFS_FILE, "r", encoding="utf-8") as f:
    verified_refs = json.load(f)

# Build a flat list of unique references
all_refs = []
seen = set()
for group in verified_refs:
    for ref in group.get("refs", []):
        cita = ref.get("citation_apa", "")
        url = ref.get("url", "")
        if cita and cita not in seen:
            seen.add(cita)
            all_refs.append({"citation": cita, "url": url})

# Map query index to variable
QUERY_MAP = {
    0: "Género", 1: "Edad", 2: "Ocupación", 3: "País de origen / Residencia",
    4: "Contexto sociocultural", 5: "Motivo de consulta", 6: "Nivel de dificultad clínica",
    7: "Nivel de apertura emocional", 8: "Temas sensibles", 9: "Variabilidad intersesión",
    10: "Arquetipo conductual", 11: "Rasgos de personalidad", 12: "Mecanismos de defensa",
    13: "Resistencia", 14: "Alianza terapéutica", 15: "Apertura emocional (dinámica)",
    16: "Sintomatología", 17: "Disposición al cambio",
    18: "Relato corto / Relato extenso", 19: "Proyecciones terapéuticas",
    20: "Revisión de coherencia (DSM-5 / PDM-2)",
}

doc = SimpleDocTemplate(OUTPUT, pagesize=letter, topMargin=1*inch, bottomMargin=0.8*inch, leftMargin=1*inch, rightMargin=1*inch)
styles = getSampleStyleSheet()

styles.add(ParagraphStyle("DocTitle", parent=styles["Title"], fontSize=22, textColor=SIDEBAR, spaceAfter=6, alignment=TA_CENTER, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("DocSub", parent=styles["Normal"], fontSize=11, textColor=GRAY, spaceAfter=20, alignment=TA_CENTER))
styles.add(ParagraphStyle("SecTitle", parent=styles["Heading1"], fontSize=15, textColor=SIDEBAR, spaceBefore=20, spaceAfter=8, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("Body", parent=styles["Normal"], fontSize=9.5, textColor=DARK, spaceAfter=6, leading=13, alignment=TA_JUSTIFY))
styles.add(ParagraphStyle("BodySm", parent=styles["Normal"], fontSize=8.5, textColor=GRAY, spaceAfter=4, leading=11))
styles.add(ParagraphStyle("VarName", parent=styles["Normal"], fontSize=10, textColor=SIDEBAR, fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=2))
styles.add(ParagraphStyle("Evidence", parent=styles["Normal"], fontSize=8.5, textColor=HexColor("#4B5563"), spaceAfter=4, leading=11, leftIndent=12, fontName="Helvetica-Oblique"))
styles.add(ParagraphStyle("RefStyle", parent=styles["Normal"], fontSize=7.5, textColor=DARK, leading=9.5, spaceAfter=3, leftIndent=12, firstLineIndent=-12))
styles.add(ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7.5, textColor=GRAY, alignment=TA_CENTER))

VARIABLES = [
    {
        "category": "1. Variables Demográficas",
        "vars": [
            {"name": "Género", "qi": 0, "options": "Masculino, Femenino, No binario",
             "definition": "Identidad de género del paciente simulado. Influye en la dinámica terapéutica, las expectativas de rol, la expresión emocional y los temas que el paciente está dispuesto a abordar."},
            {"name": "Edad", "qi": 1, "options": "18 - 65 años (numérico)",
             "definition": "Edad cronológica del paciente. Determina el momento evolutivo, las tareas del desarrollo, los referentes culturales, el lenguaje y los desafíos psicológicos típicos de cada etapa vital."},
            {"name": "Ocupación", "qi": 2, "options": "Texto libre (ej: Enfermera, Profesor, Estudiante)",
             "definition": "Actividad laboral o académica del paciente. Define su contexto social, estresores específicos, nivel socioeconómico implícito y áreas de competencia o frustración."},
            {"name": "País de origen / Residencia", "qi": 3, "options": "Chile, Argentina, Colombia, México, Perú, Rep. Dominicana, y otros",
             "definition": "Nacionalidad y país de residencia actual. Determina el uso de modismos, expresiones culturales, referencias sociales y el contexto sociopolítico que influye en la vivencia del paciente."},
            {"name": "Contexto sociocultural", "qi": 4, "options": "Urbano clase media/alta/baja, Rural, Migrante",
             "definition": "Marco socioeconómico y cultural del paciente. Influye en el acceso a recursos, las expectativas hacia la terapia, el vocabulario utilizado y los estresores ambientales."},
        ],
    },
    {
        "category": "2. Variables Clínicas",
        "vars": [
            {"name": "Motivo de consulta", "qi": 5, "options": "Ansiedad, Duelo, Pareja, Familia, Burnout, Autoestima, Aislamiento, Adaptación, Ira, Dependencia, Crisis vital",
             "definition": "Problemática principal que lleva al paciente a buscar ayuda terapéutica. Define el foco clínico de la sesión, las intervenciones esperadas y el tipo de competencias que el estudiante debe demostrar."},
            {"name": "Nivel de dificultad clínica", "qi": 6, "options": "Principiante, Intermedio, Avanzado",
             "definition": "Grado de complejidad terapéutica del caso. Principiante: pacientes colaboradores. Intermedio: ambivalencia moderada. Avanzado: alta resistencia, transferencia o riesgo."},
            {"name": "Nivel de apertura emocional", "qi": 7, "options": "Bajo, Medio, Alto",
             "definition": "Disposición inicial del paciente a compartir información emocional. Un nivel bajo implica respuestas breves y defensivas; alto implica disposición a explorar desde el inicio."},
            {"name": "Temas sensibles", "qi": 8, "options": "Infancia, Padres, Sexualidad, Muerte, Dinero, Fracaso, Soledad, Abandono, Imagen corporal, Adicciones",
             "definition": "Áreas temáticas que generan mayor resistencia o activación emocional. Contenidos que el paciente evita y que emergen en etapas avanzadas de la alianza terapéutica."},
            {"name": "Variabilidad intersesión", "qi": 9, "options": "Baja, Media, Alta",
             "definition": "Grado en que el paciente cambia entre sesiones. Alta variabilidad simula la realidad clínica donde el paciente puede llegar en estados emocionales muy diferentes."},
        ],
    },
    {
        "category": "3. Variables de Personalidad",
        "vars": [
            {"name": "Arquetipo conductual", "qi": 10, "options": "Resistente, Complaciente, Intelectualizador, Evitativo, Demandante, Silencioso, Verborreico, Desconfiado",
             "definition": "Patrón conductual predominante del paciente en sesión. Define cómo interactúa con el terapeuta y qué estrategias terapéuticas requiere."},
            {"name": "Rasgos de personalidad", "qi": 11, "options": "Introvertido, Extrovertido, Ansioso, Perfeccionista, Dependiente, Impulsivo, Controlador, Sensible, Desconfiado, Rígido",
             "definition": "Características estables de personalidad (2-4 rasgos) que definen el estilo interpersonal, la regulación emocional y la reactividad del paciente."},
            {"name": "Mecanismos de defensa", "qi": 12, "options": "Negación, Racionalización, Proyección, Humor, Intelectualización, Somatización, Evitación, Minimización, Desplazamiento",
             "definition": "Estrategias psicológicas inconscientes para manejar la ansiedad. Determinan cómo el paciente responde ante intervenciones que tocan material amenazante."},
        ],
    },
    {
        "category": "4. Variables del Motor Adaptativo",
        "vars": [
            {"name": "Resistencia", "qi": 13, "options": "Escala 0-100 (dinámica)",
             "definition": "Grado de oposición al proceso terapéutico. Varía según las intervenciones: confrontación prematura la aumenta, validación empática la disminuye."},
            {"name": "Alianza terapéutica", "qi": 14, "options": "Escala 0-100 (dinámica)",
             "definition": "Calidad del vínculo paciente-terapeuta. Incluye acuerdo en metas, tareas y vínculo emocional (Bordin, 1979). Es el predictor más consistente de resultado."},
            {"name": "Apertura emocional (dinámica)", "qi": 15, "options": "Escala 0-100 (dinámica)",
             "definition": "Nivel de profundidad emocional que el paciente permite en cada momento. Fluctúa según la intervención del terapeuta."},
            {"name": "Sintomatología", "qi": 16, "options": "Escala 0-100 (dinámica)",
             "definition": "Nivel de síntomas activos. Puede aumentar temporalmente al explorar material difícil (paradoja terapéutica) antes de disminuir."},
            {"name": "Disposición al cambio", "qi": 17, "options": "Escala 0-100 (dinámica)",
             "definition": "Motivación y preparación para modificar patrones disfuncionales. Basado en el modelo transteórico de Prochaska y DiClemente."},
        ],
    },
    {
        "category": "5. Variables Narrativas (Workflow de 15 pasos)",
        "vars": [
            {"name": "Relato corto y extenso", "qi": 18, "options": "5 secciones (corto) + 8 secciones (extenso) con datos de anclaje",
             "definition": "Narrativa clínica que establece los ejes del caso. Incluye datos específicos (nombres, lugares, instituciones) y sigue el modelo de anamnesis biopsicosocial y psicodinámica."},
            {"name": "Proyecciones terapéuticas", "qi": 19, "options": "3 niveles × 8 sesiones con variables adaptativas",
             "definition": "Simulación de cómo evolucionaría el proceso según el nivel del terapeuta. Cada sesión incluye foco, estado del paciente, intervención esperada y valores del motor adaptativo."},
            {"name": "Revisión de coherencia", "qi": 20, "options": "Score 0-100, DSM-5, PDM-2",
             "definition": "Evaluación automática de coherencia interna del perfil. Verifica consistencia con marcos diagnósticos (DSM-5 y PDM-2)."},
        ],
    },
]

story = []

# Cover
story.append(Spacer(1, 1.5*inch))
story.append(Paragraph("GlorIA", styles["DocTitle"]))
story.append(Paragraph("Plataforma de Entrenamiento Clínico con IA", styles["DocSub"]))
story.append(Spacer(1, 0.3*inch))
story.append(HRFlowable(width="40%", thickness=2, color=SIDEBAR, spaceAfter=20))
story.append(Spacer(1, 0.3*inch))
story.append(Paragraph(
    "<b>Variables para la Creación de Perfiles<br/>de Pacientes Simulados</b>",
    ParagraphStyle("BT", parent=styles["Title"], fontSize=18, textColor=DARK, alignment=TA_CENTER, leading=24)
))
story.append(Spacer(1, 0.3*inch))
story.append(Paragraph("Definiciones, opciones y evidencia empírica verificada", styles["DocSub"]))
story.append(Spacer(1, 0.8*inch))
story.append(Paragraph(
    f"Universidad Gabriela Mistral — Facultad de Psicología<br/><br/>"
    f"Fecha: {datetime.now().strftime('%d de marzo de %Y')}<br/><br/>"
    f"<i>Referencias bibliográficas verificadas mediante búsqueda web (Perplexity Sonar)</i>",
    ParagraphStyle("CI", parent=styles["Normal"], fontSize=10, textColor=GRAY, alignment=TA_CENTER, leading=14)
))

story.append(PageBreak())

# TOC
story.append(Paragraph("Índice de contenidos", styles["SecTitle"]))
story.append(Spacer(1, 6))
for s in VARIABLES:
    story.append(Paragraph(f"• {s['category']}", styles["Body"]))
story.append(Paragraph("• Referencias bibliográficas verificadas", styles["Body"]))
story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceAfter=10))
story.append(Paragraph(
    "Este documento describe las 17 variables utilizadas en GlorIA para la creación de perfiles de pacientes simulados por IA. "
    "Cada variable incluye su definición operacional, opciones disponibles y referencias bibliográficas verificadas mediante "
    "búsqueda web automatizada. Las fuentes fueron obtenidas a través de Perplexity Sonar y contienen DOIs o URLs verificables.",
    styles["Body"]
))
story.append(PageBreak())

# Variables
for section in VARIABLES:
    story.append(Paragraph(section["category"], styles["SecTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SIDEBAR, spaceAfter=12))

    for var in section["vars"]:
        block = []
        block.append(Paragraph(var["name"], styles["VarName"]))
        block.append(Paragraph(f"<b>Opciones:</b> {var['options']}", styles["BodySm"]))
        block.append(Paragraph(f"<b>Definición:</b> {var['definition']}", styles["Body"]))

        # Get verified refs for this variable
        qi = var.get("qi", -1)
        if 0 <= qi < len(verified_refs):
            refs = verified_refs[qi].get("refs", [])
            if refs:
                block.append(Paragraph("<b>Evidencia empírica (fuentes verificadas):</b>", styles["Evidence"]))
                for ref in refs[:3]:
                    cita = ref.get("citation_apa", "")
                    url = ref.get("url", "")
                    if cita:
                        if url and url.startswith("http"):
                            block.append(Paragraph(
                                f'• {cita} <br/><font color="#2563EB" size="7"><link href="{url}">{url}</link></font>',
                                styles["Evidence"]
                            ))
                        else:
                            block.append(Paragraph(f"• {cita}", styles["Evidence"]))

        block.append(Spacer(1, 6))
        block.append(HRFlowable(width="100%", thickness=0.3, color=HexColor("#E5E7EB"), spaceAfter=4))
        story.append(KeepTogether(block))

    story.append(Spacer(1, 8))

# References
story.append(PageBreak())
story.append(Paragraph("Referencias bibliográficas verificadas", styles["SecTitle"]))
story.append(HRFlowable(width="100%", thickness=1, color=SIDEBAR, spaceAfter=8))
story.append(Paragraph(
    f"Total: {len(all_refs)} referencias únicas obtenidas mediante Perplexity Sonar (búsqueda web verificada).",
    styles["BodySm"]
))
story.append(Spacer(1, 6))

for i, ref in enumerate(sorted(all_refs, key=lambda r: r["citation"]), 1):
    cita = ref["citation"]
    url = ref["url"]
    if url and url.startswith("http"):
        story.append(Paragraph(
            f'{i}. {cita}<br/><font color="#2563EB" size="7"><link href="{url}">{url}</link></font>',
            styles["RefStyle"]
        ))
    else:
        story.append(Paragraph(f"{i}. {cita}", styles["RefStyle"]))

# Footer
story.append(Spacer(1, 0.4*inch))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceAfter=8))
story.append(Paragraph(
    "Documento generado por GlorIA — Plataforma de Entrenamiento Clínico con IA<br/>"
    "Universidad Gabriela Mistral · Facultad de Psicología · 2026<br/>"
    "Referencias verificadas mediante Perplexity Sonar (búsqueda web)",
    styles["Footer"]
))

doc.build(story)
print(f"PDF generado: {OUTPUT}")
