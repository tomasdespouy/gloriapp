"""
GlorIA — Reporte de Variables para Creación de Perfiles de Pacientes IA
Genera un PDF profesional con definiciones y evidencia empírica
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from datetime import datetime

SIDEBAR_COLOR = HexColor("#4A55A2")
LIGHT_BG = HexColor("#F0F1F8")
GREEN = HexColor("#16A34A")
AMBER = HexColor("#D97706")
GRAY = HexColor("#6B7280")
DARK = HexColor("#1A1A1A")
WHITE = HexColor("#FFFFFF")

OUTPUT_PATH = "C:/Users/tomas/documents/gloriapp/GlorIA_Variables_Perfiles_IA.pdf"

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=letter,
    topMargin=1*inch,
    bottomMargin=0.8*inch,
    leftMargin=1*inch,
    rightMargin=1*inch,
)

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    "DocTitle", parent=styles["Title"], fontSize=22, textColor=SIDEBAR_COLOR,
    spaceAfter=6, alignment=TA_CENTER, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "DocSubtitle", parent=styles["Normal"], fontSize=11, textColor=GRAY,
    spaceAfter=20, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    "SectionTitle", parent=styles["Heading1"], fontSize=15, textColor=SIDEBAR_COLOR,
    spaceBefore=20, spaceAfter=8, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "SubTitle", parent=styles["Heading2"], fontSize=12, textColor=DARK,
    spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "Body", parent=styles["Normal"], fontSize=9.5, textColor=DARK,
    spaceAfter=6, leading=13, alignment=TA_JUSTIFY,
))
styles.add(ParagraphStyle(
    "BodySmall", parent=styles["Normal"], fontSize=8.5, textColor=GRAY,
    spaceAfter=4, leading=11,
))
styles.add(ParagraphStyle(
    "VarName", parent=styles["Normal"], fontSize=10, textColor=SIDEBAR_COLOR,
    fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=2,
))
styles.add(ParagraphStyle(
    "Evidence", parent=styles["Normal"], fontSize=8.5, textColor=HexColor("#4B5563"),
    spaceAfter=4, leading=11, leftIndent=12, fontName="Helvetica-Oblique",
))
styles.add(ParagraphStyle(
    "TableHeader", parent=styles["Normal"], fontSize=8.5, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    "TableCell", parent=styles["Normal"], fontSize=8, textColor=DARK, leading=10,
))
styles.add(ParagraphStyle(
    "Footer", parent=styles["Normal"], fontSize=7.5, textColor=GRAY, alignment=TA_CENTER,
))


# ══════════════════════════════════════════
# DATA
# ══════════════════════════════════════════

VARIABLES = [
    {
        "category": "1. Variables Demográficas",
        "vars": [
            {
                "name": "Género",
                "options": "Masculino, Femenino, No binario",
                "definition": "Identidad de género del paciente simulado. Influye en la dinámica terapéutica, las expectativas de rol, la expresión emocional y los temas que el paciente está dispuesto a abordar.",
                "evidence": "La investigación muestra diferencias de género en la expresión emocional en terapia (Addis & Mahalik, 2003). Los hombres tienden a minimizar síntomas afectivos mientras que mujeres expresan más abiertamente malestar emocional (Levant et al., 2009).",
            },
            {
                "name": "Edad",
                "options": "18 - 65 años (numérico)",
                "definition": "Edad cronológica del paciente. Determina el momento evolutivo, las tareas del desarrollo, los referentes culturales, el lenguaje y los desafíos psicológicos típicos de cada etapa vital.",
                "evidence": "Las teorías del desarrollo de Erikson (1950) y Levinson (1978) fundamentan cómo las crisis vitales varían según la etapa. La edad impacta directamente en la formulación de caso y la elección de intervención.",
            },
            {
                "name": "Ocupación",
                "options": "Texto libre (ej: Enfermera, Profesor, Estudiante)",
                "definition": "Actividad laboral o académica del paciente. Define su contexto social, estresores específicos, nivel socioeconómico implícito y áreas de competencia o frustración.",
                "evidence": "El estrés laboral y el burnout son factores de riesgo reconocidos para trastornos de ansiedad y depresión (Maslach & Leiter, 2016). La ocupación contextualiza el motivo de consulta.",
            },
            {
                "name": "País de origen / Residencia",
                "options": "Chile, Argentina, Colombia, México, Perú, Rep. Dominicana, y otros",
                "definition": "Nacionalidad y país de residencia actual. Determina el uso de modismos, expresiones culturales, referencias sociales y el contexto sociopolítico que influye en la vivencia del paciente.",
                "evidence": "La competencia cultural es un eje central en la formación terapéutica (Sue & Sue, 2015). Pacientes de distintos contextos culturales latinoamericanos presentan variaciones significativas en la expresión del malestar psicológico.",
            },
            {
                "name": "Contexto sociocultural",
                "options": "Urbano clase media, Urbano clase alta, Urbano clase baja, Rural, Migrante",
                "definition": "Marco socioeconómico y cultural del paciente. Influye en el acceso a recursos, las expectativas hacia la terapia, el vocabulario utilizado y los estresores ambientales.",
                "evidence": "Los determinantes sociales de la salud mental están ampliamente documentados (Marmot, 2005). El nivel socioeconómico afecta tanto la prevalencia de trastornos como la adherencia terapéutica.",
            },
        ],
    },
    {
        "category": "2. Variables Clínicas",
        "vars": [
            {
                "name": "Motivo de consulta",
                "options": "Ansiedad generalizada, Duelo, Problemas de pareja, Conflicto familiar, Estrés laboral/burnout, Autoestima baja, Aislamiento social, Problemas de adaptación, Manejo de ira, Dependencia emocional, Crisis vital/transición",
                "definition": "Problemática principal que lleva al paciente a buscar ayuda terapéutica. Define el foco clínico de la sesión, las intervenciones esperadas y el tipo de competencias que el estudiante debe demostrar.",
                "evidence": "Los motivos de consulta seleccionados corresponden a los cuadros más prevalentes en atención primaria de salud mental en Latinoamérica (Kohn et al., 2005; Vicente et al., 2006 para Chile).",
            },
            {
                "name": "Nivel de dificultad clínica",
                "options": "Principiante, Intermedio, Avanzado",
                "definition": "Grado de complejidad terapéutica del caso. Principiante: pacientes colaboradores con cuadros claros. Intermedio: ambivalencia y resistencia moderada. Avanzado: alta resistencia, transferencia, riesgo o personalidad compleja.",
                "evidence": "Los modelos de competencias en psicoterapia (Roth & Pilling, 2008) reconocen niveles progresivos de habilidad. El marco de la APA (2006) para la educación clínica establece competencias graduales.",
            },
            {
                "name": "Nivel de apertura emocional",
                "options": "Bajo, Medio, Alto",
                "definition": "Disposición inicial del paciente a compartir información emocional. Un nivel bajo implica respuestas breves y defensivas; alto implica disposición a explorar desde el inicio.",
                "evidence": "La apertura emocional es un predictor significativo de la alianza terapéutica temprana (Horvath & Symonds, 1991). La investigación de Stiles et al. (1990) muestra su relación con el resultado terapéutico.",
            },
            {
                "name": "Temas sensibles",
                "options": "Infancia, Relación con padres, Sexualidad, Muerte/pérdida, Dinero, Fracaso, Soledad, Abandono, Imagen corporal, Adicciones",
                "definition": "Áreas temáticas que generan mayor resistencia o activación emocional en el paciente. Son contenidos que el paciente evita o aborda con dificultad, y que típicamente emergen en etapas avanzadas de la alianza.",
                "evidence": "Los modelos de formulación de caso (Persons, 2008) identifican temas centrales (core beliefs) que organizan la experiencia del paciente. La exposición gradual a temas sensibles es parte del proceso terapéutico.",
            },
            {
                "name": "Variabilidad intersesión",
                "options": "Baja, Media, Alta",
                "definition": "Grado en que el paciente cambia entre sesiones. Baja: consistente y predecible. Alta: puede llegar en estados emocionales muy diferentes de una sesión a otra, simulando la variabilidad real de un proceso terapéutico.",
                "evidence": "La variabilidad en el proceso terapéutico es un fenómeno bien documentado (Hayes et al., 2007). Los modelos de cambio no-lineal sugieren que el progreso terapéutico incluye fluctuaciones naturales.",
            },
        ],
    },
    {
        "category": "3. Variables de Personalidad",
        "vars": [
            {
                "name": "Arquetipo conductual",
                "options": "El resistente, El complaciente, El intelectualizador, El evitativo, El demandante, El silencioso, El verborreico, El desconfiado",
                "definition": "Patrón conductual predominante del paciente en sesión. Define cómo el paciente interactúa con el terapeuta: si desafía, evade, complace, intelectualiza o demanda. Cada arquetipo requiere estrategias terapéuticas específicas.",
                "evidence": "Basado en la tipología de resistencia de Beutler et al. (2001) y los patrones interpersonales de Kiesler (1996). La literatura sobre alianza terapéutica identifica estos patrones como los más frecuentes en la práctica clínica.",
            },
            {
                "name": "Rasgos de personalidad",
                "options": "Introvertido, Extrovertido, Ansioso, Perfeccionista, Dependiente, Impulsivo, Controlador, Sensible, Desconfiado, Rígido",
                "definition": "Características estables de personalidad que colorean la presentación clínica. Se seleccionan 2-4 rasgos que definen el estilo interpersonal, la regulación emocional y la reactividad del paciente.",
                "evidence": "Alineado con el modelo de los Cinco Grandes (Costa & McCrae, 1992) y la conceptualización dimensional de personalidad del DSM-5 Sección III. Los rasgos de personalidad predicen el estilo de interacción en terapia (Mulder, 2002).",
            },
            {
                "name": "Mecanismos de defensa",
                "options": "Negación, Racionalización, Proyección, Humor como defensa, Intelectualización, Somatización, Evitación, Minimización, Desplazamiento",
                "definition": "Estrategias psicológicas inconscientes que el paciente utiliza para manejar la ansiedad y proteger el self. Determinan cómo el paciente responde ante intervenciones que tocan material amenazante.",
                "evidence": "La jerarquía de mecanismos de defensa está fundamentada en la tradición psicodinámica (Vaillant, 1977) y operacionalizada en el Defense Style Questionnaire (Bond et al., 1983). El PDM-2 los incluye como eje diagnóstico central.",
            },
        ],
    },
    {
        "category": "4. Variables del Proceso Terapéutico (Motor Adaptativo)",
        "vars": [
            {
                "name": "Resistencia",
                "options": "Escala 0-100 (dinámica por sesión)",
                "definition": "Grado de oposición activa o pasiva del paciente al proceso terapéutico. Varía dinámicamente según las intervenciones del terapeuta. Una confrontación prematura la aumenta; la validación empática la disminuye.",
                "evidence": "La resistencia terapéutica es uno de los predictores más robustos de resultado (Beutler et al., 2001). El modelo de Reactancia de Brehm (1966) explica cómo las intervenciones directivas pueden aumentar la resistencia.",
            },
            {
                "name": "Alianza terapéutica",
                "options": "Escala 0-100 (dinámica por sesión)",
                "definition": "Calidad del vínculo entre paciente y terapeuta. Incluye acuerdo en metas, acuerdo en tareas y vínculo emocional (Bordin, 1979). Es el predictor más consistente de resultado terapéutico.",
                "evidence": "Meta-análisis de Horvath et al. (2011) con k=190 estudios confirma la alianza como factor transdiagnóstico con correlación moderada (r=.275) con el resultado. El modelo de Bordin (1979) es el más utilizado.",
            },
            {
                "name": "Apertura emocional (dinámica)",
                "options": "Escala 0-100 (dinámica por sesión)",
                "definition": "Nivel de profundidad emocional que el paciente permite en cada momento de la sesión. Fluctúa según la intervención: preguntas abiertas la aumentan, juicios la disminuyen.",
                "evidence": "La profundidad de experiencia emocional (Experiencing Scale de Klein et al., 1986) es un proceso clave en psicoterapia. La investigación de Pascual-Leone & Greenberg (2007) muestra su relación con el cambio terapéutico.",
            },
            {
                "name": "Sintomatología",
                "options": "Escala 0-100 (dinámica por sesión)",
                "definition": "Nivel de síntomas activos del paciente (ansiedad, tristeza, irritabilidad, somatización). Puede aumentar temporalmente al explorar material difícil (paradoja terapéutica) antes de disminuir.",
                "evidence": "El modelo de respuesta a dosis (Howard et al., 1986) y el modelo de fase (remoralización → remediación → rehabilitación) explican la evolución no-lineal de los síntomas en terapia.",
            },
            {
                "name": "Disposición al cambio",
                "options": "Escala 0-100 (dinámica por sesión)",
                "definition": "Grado de motivación y preparación del paciente para modificar patrones disfuncionales. Basado en el modelo transteórico de cambio.",
                "evidence": "El modelo de Prochaska & DiClemente (1983) identifica etapas de cambio (precontemplación → contemplación → preparación → acción → mantenimiento). La adaptación de las intervenciones a la etapa del paciente mejora el resultado.",
            },
        ],
    },
    {
        "category": "5. Variables Narrativas (Workflow de 15 pasos)",
        "vars": [
            {
                "name": "Relato corto (5 secciones)",
                "options": "Historia personal, Dinámica familiar, Motivo de consulta, Patrón relacional, Momento vital",
                "definition": "Narrativa clínica breve que establece los ejes centrales del caso. Incluye datos de anclaje específicos (nombres de familiares, lugares, instituciones) para dar robustez al personaje.",
                "evidence": "La formulación de caso narrativa (McWilliams, 2011) es un estándar en la práctica clínica. La especificidad de datos biográficos aumenta la coherencia y credibilidad del paciente simulado.",
            },
            {
                "name": "Relato extenso (8 secciones)",
                "options": "Infancia y apego, Familia de origen, Desarrollo adolescente, Relaciones significativas, Historia laboral/académica, Evento precipitante, Estado actual, Recursos y fortalezas",
                "definition": "Historia de vida detallada que sigue el modelo de anamnesis clínica. Cada sección profundiza un eje del desarrollo, permitiendo que el paciente tenga respuestas coherentes ante cualquier exploración del terapeuta.",
                "evidence": "La estructura sigue el modelo de evaluación biopsicosocial (Engel, 1977) y la anamnesis psicodinámica (Kernberg, 1984). Las 8 secciones cubren los dominios evaluados en el PDM-2.",
            },
            {
                "name": "Revisión de coherencia",
                "options": "Score 0-100, Consistencia clínica, Brechas narrativas, Alineación DSM-5, Alineación PDM-2",
                "definition": "Evaluación automática de la coherencia interna del perfil generado. Verifica que los síntomas, la historia y la personalidad sean consistentes entre sí y con los marcos diagnósticos establecidos.",
                "evidence": "La coherencia narrativa es un indicador de calidad en formulación de caso (Eells, 2007). La validación cruzada con DSM-5 (APA, 2013) y PDM-2 (Lingiardi & McWilliams, 2017) asegura realismo clínico.",
            },
            {
                "name": "Proyecciones terapéuticas",
                "options": "3 niveles (principiante/intermedio/experto) × 8 sesiones con variables adaptativas",
                "definition": "Simulación de cómo evolucionaría el proceso terapéutico según el nivel del terapeuta. Cada sesión incluye el foco, estado del paciente, intervención esperada, momento clave y los 5 valores del motor adaptativo.",
                "evidence": "Los modelos de simulación clínica (Barrows, 1993; Ziv et al., 2003) demuestran que la práctica con escenarios graduados mejora significativamente las competencias clínicas.",
            },
        ],
    },
]


# ══════════════════════════════════════════
# BUILD PDF
# ══════════════════════════════════════════

story = []

# Title page
story.append(Spacer(1, 1.5*inch))
story.append(Paragraph("GlorIA", styles["DocTitle"]))
story.append(Paragraph("Plataforma de Entrenamiento Clínico con IA", styles["DocSubtitle"]))
story.append(Spacer(1, 0.3*inch))
story.append(HRFlowable(width="40%", thickness=2, color=SIDEBAR_COLOR, spaceAfter=20))
story.append(Spacer(1, 0.3*inch))
story.append(Paragraph(
    "<b>Variables para la Creación de Perfiles<br/>de Pacientes Simulados</b>",
    ParagraphStyle("BigTitle", parent=styles["Title"], fontSize=18, textColor=DARK, alignment=TA_CENTER, leading=24)
))
story.append(Spacer(1, 0.3*inch))
story.append(Paragraph(
    "Definiciones, opciones y evidencia empírica",
    styles["DocSubtitle"]
))
story.append(Spacer(1, 1*inch))
story.append(Paragraph(
    f"Universidad Gabriela Mistral<br/>Facultad de Psicología<br/><br/>Fecha: {datetime.now().strftime('%d de %B de %Y').replace('March', 'marzo')}",
    ParagraphStyle("CoverInfo", parent=styles["Normal"], fontSize=10, textColor=GRAY, alignment=TA_CENTER, leading=14)
))

story.append(PageBreak())

# Table of contents
story.append(Paragraph("Índice de contenidos", styles["SectionTitle"]))
story.append(Spacer(1, 10))
for section in VARIABLES:
    story.append(Paragraph(f"• {section['category']}", styles["Body"]))
story.append(Paragraph("• Referencias bibliográficas", styles["Body"]))
story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceAfter=10))

story.append(Paragraph(
    "Este documento describe las variables utilizadas en GlorIA para la creación de perfiles de pacientes simulados. "
    "Cada variable está fundamentada en evidencia empírica y marcos teóricos reconocidos en psicología clínica. "
    "El sistema utiliza estas variables en un flujo de 15 pasos que combina configuración humana con generación por IA, "
    "asegurando perfiles clínicamente coherentes y pedagógicamente útiles.",
    styles["Body"]
))

story.append(PageBreak())

# Variables sections
for section in VARIABLES:
    story.append(Paragraph(section["category"], styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=SIDEBAR_COLOR, spaceAfter=12))

    for var in section["vars"]:
        block = []
        block.append(Paragraph(var["name"], styles["VarName"]))

        # Options in a light box
        options_text = f"<b>Opciones:</b> {var['options']}"
        block.append(Paragraph(options_text, styles["BodySmall"]))

        # Definition
        block.append(Paragraph(f"<b>Definición:</b> {var['definition']}", styles["Body"]))

        # Evidence
        block.append(Paragraph(f"<b>Evidencia:</b> {var['evidence']}", styles["Evidence"]))

        block.append(Spacer(1, 8))
        block.append(HRFlowable(width="100%", thickness=0.3, color=HexColor("#E5E7EB"), spaceAfter=4))

        story.append(KeepTogether(block))

    story.append(Spacer(1, 10))

# References page
story.append(PageBreak())
story.append(Paragraph("Referencias bibliográficas", styles["SectionTitle"]))
story.append(HRFlowable(width="100%", thickness=1, color=SIDEBAR_COLOR, spaceAfter=12))

references = [
    "Addis, M. E., & Mahalik, J. R. (2003). Men, masculinity, and the contexts of help seeking. American Psychologist, 58(1), 5-14.",
    "American Psychiatric Association. (2013). Diagnostic and Statistical Manual of Mental Disorders (5th ed.). APA Publishing.",
    "American Psychological Association. (2006). APA Task Force on the Assessment of Competence in Professional Psychology.",
    "Barrows, H. S. (1993). An overview of the uses of standardized patients for teaching and evaluating clinical skills. Academic Medicine, 68(6), 443-451.",
    "Beutler, L. E., Moleiro, C., & Talebi, H. (2001). Resistance in psychotherapy. Journal of Clinical Psychology, 57(2), 167-176.",
    "Bond, M., Gardner, S. T., Christian, J., & Sigal, J. J. (1983). Empirical study of self-rated defense styles. Archives of General Psychiatry, 40(3), 333-338.",
    "Bordin, E. S. (1979). The generalizability of the psychoanalytic concept of the working alliance. Psychotherapy: Theory, Research & Practice, 16(3), 252-260.",
    "Brehm, J. W. (1966). A Theory of Psychological Reactance. Academic Press.",
    "Costa, P. T., & McCrae, R. R. (1992). NEO-PI-R Professional Manual. Psychological Assessment Resources.",
    "Eells, T. D. (2007). Handbook of Psychotherapy Case Formulation (2nd ed.). Guilford Press.",
    "Engel, G. L. (1977). The need for a new medical model: A challenge for biomedicine. Science, 196(4286), 129-136.",
    "Erikson, E. H. (1950). Childhood and Society. W. W. Norton.",
    "Hayes, A. M., Laurenceau, J. P., Feldman, G., Strauss, J. L., & Cardaciotto, L. (2007). Change is not always linear. Clinical Psychology Review, 27(6), 715-723.",
    "Horvath, A. O., Del Re, A. C., Flückiger, C., & Symonds, D. (2011). Alliance in individual psychotherapy. Psychotherapy, 48(1), 9-16.",
    "Horvath, A. O., & Symonds, B. D. (1991). Relation between working alliance and outcome in psychotherapy. Journal of Counseling Psychology, 38(2), 139-149.",
    "Howard, K. I., Kopta, S. M., Krause, M. S., & Orlinsky, D. E. (1986). The dose-effect relationship in psychotherapy. American Psychologist, 41(2), 159-164.",
    "Kernberg, O. F. (1984). Severe Personality Disorders: Psychotherapeutic Strategies. Yale University Press.",
    "Kiesler, D. J. (1996). Contemporary Interpersonal Theory and Research. John Wiley & Sons.",
    "Klein, M. H., Mathieu-Coughlan, P., & Kiesler, D. J. (1986). The Experiencing Scales. In L. S. Greenberg & W. M. Pinsof (Eds.), The Psychotherapeutic Process. Guilford Press.",
    "Kohn, R., Levav, I., Caldas de Almeida, J. M., et al. (2005). Mental disorders in Latin America and the Caribbean. Revista Panamericana de Salud Pública, 18(4-5), 229-240.",
    "Levant, R. F., Hall, R. J., Williams, C. M., & Hasan, N. T. (2009). Gender differences in alexithymia. Psychology of Men & Masculinity, 10(3), 190-203.",
    "Levinson, D. J. (1978). The Seasons of a Man's Life. Ballantine Books.",
    "Lingiardi, V., & McWilliams, N. (Eds.). (2017). Psychodynamic Diagnostic Manual (2nd ed.). Guilford Press.",
    "Marmot, M. (2005). Social determinants of health inequalities. The Lancet, 365(9464), 1099-1104.",
    "Maslach, C., & Leiter, M. P. (2016). Understanding the burnout experience. World Psychiatry, 15(2), 103-111.",
    "McWilliams, N. (2011). Psychoanalytic Diagnosis (2nd ed.). Guilford Press.",
    "Mulder, R. T. (2002). Personality pathology and treatment outcome in major depression. American Journal of Psychiatry, 159(4), 561-567.",
    "Pascual-Leone, A., & Greenberg, L. S. (2007). Emotional processing in experiential therapy. Journal of Consulting and Clinical Psychology, 75(6), 875-887.",
    "Persons, J. B. (2008). The Case Formulation Approach to Cognitive-Behavior Therapy. Guilford Press.",
    "Prochaska, J. O., & DiClemente, C. C. (1983). Stages and processes of self-change of smoking. Journal of Consulting and Clinical Psychology, 51(3), 390-395.",
    "Roth, A., & Pilling, S. (2008). Using an evidence-based methodology to identify the competences required to deliver effective CBT. Behavioural and Cognitive Psychotherapy, 36(2), 129-147.",
    "Sue, D. W., & Sue, D. (2015). Counseling the Culturally Diverse: Theory and Practice (7th ed.). John Wiley & Sons.",
    "Vaillant, G. E. (1977). Adaptation to Life. Little, Brown and Company.",
    "Vicente, B., Kohn, R., Rioseco, P., Saldivia, S., Levav, I., & Torres, S. (2006). Lifetime and 12-month prevalence of DSM-III-R disorders in the Chile Psychiatric Prevalence Study. American Journal of Psychiatry, 163(8), 1362-1370.",
    "Ziv, A., Wolpe, P. R., Small, S. D., & Glick, S. (2003). Simulation-based medical education: An ethical imperative. Academic Medicine, 78(8), 783-788.",
]

for ref in references:
    story.append(Paragraph(f"• {ref}", ParagraphStyle(
        "Ref", parent=styles["Normal"], fontSize=8, textColor=DARK, leading=10, spaceAfter=4, leftIndent=12, firstLineIndent=-12,
    )))

# Footer note
story.append(Spacer(1, 0.5*inch))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceAfter=10))
story.append(Paragraph(
    "Documento generado por GlorIA — Plataforma de Entrenamiento Clínico con IA<br/>"
    "Universidad Gabriela Mistral · Facultad de Psicología · 2026",
    styles["Footer"]
))

# Build
doc.build(story)
print(f"PDF generado: {OUTPUT_PATH}")
