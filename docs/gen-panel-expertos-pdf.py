"""
PDF: Propuesta de Panel de Expertos para Validación de GlorIA
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable

FONTS_DIR = "C:/Windows/Fonts"
pdfmetrics.registerFont(TTFont("Calibri", os.path.join(FONTS_DIR, "calibri.ttf")))
pdfmetrics.registerFont(TTFont("Calibri-Bold", os.path.join(FONTS_DIR, "calibrib.ttf")))
pdfmetrics.registerFont(TTFont("Calibri-Italic", os.path.join(FONTS_DIR, "calibrii.ttf")))
pdfmetrics.registerFontFamily("Calibri", normal="Calibri", bold="Calibri-Bold", italic="Calibri-Italic")

SIDEBAR = HexColor("#4A55A2")
GRAY = HexColor("#6B7280")
DARK = HexColor("#1A1A1A")
WHITE = HexColor("#FFFFFF")
LIGHT = HexColor("#F3F4F6")
PURPLE = HexColor("#7C3AED")

BASE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(BASE)
LOGO = os.path.join(PROJECT, "public", "branding", "gloria-logo.png")

def header_footer(canvas, doc):
    canvas.saveState()
    if os.path.exists(LOGO):
        canvas.drawImage(LOGO, doc.width + doc.leftMargin - 1.2*inch,
                         doc.height + doc.topMargin - 0.15*inch,
                         width=1.2*inch, height=0.35*inch,
                         preserveAspectRatio=True, mask='auto')
    canvas.setFont("Calibri", 8)
    canvas.setFillColor(GRAY)
    canvas.drawCentredString(doc.width / 2 + doc.leftMargin, 0.4*inch, f"GlorIA — Página {doc.page}")
    canvas.restoreState()

title_s = ParagraphStyle('T', fontSize=22, leading=28, textColor=SIDEBAR, fontName='Calibri-Bold', spaceAfter=6)
section_s = ParagraphStyle('S', fontSize=14, leading=18, textColor=SIDEBAR, fontName='Calibri-Bold', spaceBefore=16, spaceAfter=8)
sub_s = ParagraphStyle('Sub', fontSize=11, leading=15, textColor=DARK, fontName='Calibri-Bold', spaceBefore=10, spaceAfter=6)
body_s = ParagraphStyle('B', fontSize=9.5, leading=14, textColor=DARK, fontName='Calibri', alignment=TA_JUSTIFY, spaceAfter=6)
caption_s = ParagraphStyle('C', fontSize=8, leading=10, textColor=GRAY, fontName='Calibri-Italic', alignment=TA_CENTER, spaceAfter=8)
blt_s = ParagraphStyle('Blt', fontSize=9.5, leading=14, textColor=DARK, fontName='Calibri', leftIndent=18, bulletIndent=6, spaceAfter=3)
ref_s = ParagraphStyle('Ref', fontSize=8, leading=11, textColor=GRAY, fontName='Calibri-Italic', leftIndent=24, spaceAfter=2)
th_s = ParagraphStyle('TH', fontSize=8, leading=11, textColor=WHITE, fontName='Calibri-Bold', alignment=TA_CENTER)
tc_s = ParagraphStyle('TC', fontSize=8, leading=11, textColor=DARK, fontName='Calibri')
expert_name_s = ParagraphStyle('EN', fontSize=12, leading=16, textColor=PURPLE, fontName='Calibri-Bold', spaceBefore=12, spaceAfter=4)

B = chr(8226)

def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(h, th_s) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), tc_s) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SIDEBAR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.4, HexColor("#E5E7EB")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ]))
    return t

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceBefore=6, spaceAfter=6)

def build():
    path = os.path.join(BASE, "Propuesta_Panel_Expertos_GlorIA.pdf")
    doc = SimpleDocTemplate(path, pagesize=letter,
                            leftMargin=0.7*inch, rightMargin=0.7*inch,
                            topMargin=0.65*inch, bottomMargin=0.65*inch)
    story = []

    # Title
    story.append(Paragraph("Propuesta de Panel de Expertos", title_s))
    story.append(Paragraph("Validación Académica de la Plataforma GlorIA", section_s))
    story.append(Paragraph("Universidad Gabriela Mistral  |  Marzo 2026", caption_s))
    story.append(hr())

    # 1. Introduction
    story.append(Paragraph("1. Objetivo", section_s))
    story.append(Paragraph(
        "Constituir un panel de 5 expertos multidisciplinarios que evalúen la plataforma GlorIA en sus dimensiones "
        "clínica, ética, lingüística, pedagógica y de experiencia de usuario. El panel emitirá un veredicto formal "
        "que podrá ser utilizado para publicaciones académicas, postulación a fondos de investigación, acreditación "
        "institucional y comunicación a stakeholders.", body_s))

    # 2. Experts
    story.append(Paragraph("2. Composición del panel", section_s))

    # Expert 1
    story.append(Paragraph("Experto 1: Psicólogo/a clínico/a con experiencia docente", expert_name_s))
    story.append(Paragraph("<b>Perfil:</b> Supervisor/a de prácticas clínicas con al menos 10 años de experiencia en formación de psicoterapeutas. Idealmente con experiencia en supervisión de competencias terapéuticas básicas.", body_s))
    story.append(Paragraph("<b>Foco de revisión:</b> Realismo clínico de los pacientes virtuales, pertinencia del instrumento de competencias (ECCBP), coherencia narrativa entre sesiones.", body_s))
    story.append(Paragraph("<b>Base teórica desde la que evalúa:</b>", body_s))
    for item in [
        "Norcross, J.C. & Wampold, B.E. (2019). <i>Psychotherapy Relationships That Work</i> (3rd ed.). Oxford University Press. — Meta-análisis sobre competencias terapéuticas efectivas: alianza, empatía, feedback, adaptación al paciente.",
        "Hill, C.E. (2014). <i>Helping Skills: Facilitating Exploration, Insight, and Action</i> (4th ed.). APA. — Marco de formación gradual de competencias clínicas (exploración → insight → acción).",
        "Roth, A.D. & Pilling, S. (2007). <i>The Competences Required to Deliver Effective CBT</i>. UCL. — Framework de competencias terapéuticas del NHS, referente internacional.",
        "PsyCET-S (2024). Psychology Competency Evaluation Tool – Summative. Herramienta validada para evaluar competencias en psicología clínica durante la formación.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))
    story.append(Paragraph("Evalúa: ¿Los pacientes se comportan como pacientes reales? ¿Las resistencias, defensas y apertura son creíbles? ¿Las 10 competencias del instrumento UGM están bien definidas y aplicadas?", ref_s))

    # Expert 2
    story.append(Paragraph("Experto 2: Especialista en ética y salud mental", expert_name_s))
    story.append(Paragraph("<b>Perfil:</b> Miembro de comité de ética o bioética, con experiencia en regulación de tecnologías en salud mental. Conocimiento de marcos éticos para IA en contexto clínico.", body_s))
    story.append(Paragraph("<b>Foco de revisión:</b> Manejo de situaciones de riesgo (ideación suicida, autolesión), estereotipos, consentimiento informado, privacidad de datos, límites de la IA.", body_s))
    story.append(Paragraph("<b>Base teórica desde la que evalúa:</b>", body_s))
    for item in [
        "American Psychological Association (2025). <i>Ethical Guidance for AI in the Professional Practice of Health Service Psychology</i>. — Guía oficial de la APA para uso ético de IA en práctica clínica.",
        "Pope, K.S. & Vasquez, M.J.T. (2016). <i>Ethics in Psychotherapy and Counseling</i> (5th ed.). Wiley. — Referente en ética terapéutica: límites, consentimiento, dual relationships.",
        "Stoll, J. et al. (2025). <i>Exploring the Ethical Challenges of Conversational AI in Mental Health Care</i>. JMIR Mental Health. — Scoping review de 15 riesgos éticos de IA conversacional en salud mental.",
        "Torous, J. & Hsin, H. (2018). Empowering the digital therapeutic relationship. <i>npj Digital Medicine</i>. — Marco para relaciones terapéuticas mediadas por tecnología.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))
    story.append(Paragraph("Evalúa: ¿Se manejan bien las crisis simuladas? ¿Hay estereotipos dañinos? ¿El consentimiento es claro? ¿La IA puede causar daño al estudiante?", ref_s))

    story.append(PageBreak())

    # Expert 3
    story.append(Paragraph("Experto 3: Sociolingüista latinoamericanista", expert_name_s))
    story.append(Paragraph("<b>Perfil:</b> Investigador/a en variación dialectal del español latinoamericano, con conocimiento de registros sociolingüísticos por país, estrato y edad. Experiencia en comunicación intercultural.", body_s))
    story.append(Paragraph("<b>Foco de revisión:</b> Autenticidad de modismos por país, adecuación de errores intencionales del habla, representación cultural sin caricatura, diversidad étnica.", body_s))
    story.append(Paragraph("<b>Base teórica desde la que evalúa:</b>", body_s))
    for item in [
        "Díaz-Campos, M. (Ed.) (2011). <i>The Handbook of Hispanic Sociolinguistics</i>. Wiley-Blackwell. — Referente en variación fonológica, morfosintáctica y pragmática del español.",
        "Díaz-Campos, M. & Sessarego, S. (2021). <i>Aspects of Latin American Spanish Dialectology</i>. John Benjamins. — Dialectología contemporánea con datos empíricos de variación regional.",
        "Lipski, J.M. (2012). <i>El español de América</i> (6th ed.). Cátedra. — Referencia fundamental sobre variantes dialectales del español americano.",
        "Moreno Fernández, F. (2020). <i>Variedades de la lengua española</i>. Routledge. — Marco teórico para clasificación de variedades del español por registro y geografía.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))
    story.append(Paragraph("Evalúa: ¿Los modismos son correctos para cada país? ¿Los errores del habla popular son realistas sin ser ofensivos? ¿La diversidad étnica se representa con autenticidad?", ref_s))

    # Expert 4
    story.append(Paragraph("Experto 4: Especialista en tecnología educativa (EdTech)", expert_name_s))
    story.append(Paragraph("<b>Perfil:</b> Investigador/a o profesional en diseño instruccional y tecnología educativa, con experiencia en simulación clínica y evaluación de competencias mediada por tecnología.", body_s))
    story.append(Paragraph("<b>Foco de revisión:</b> Diseño pedagógico del flujo de aprendizaje, efectividad de la retroalimentación, usabilidad, accesibilidad, métricas de impacto.", body_s))
    story.append(Paragraph("<b>Base teórica desde la que evalúa:</b>", body_s))
    for item in [
        "Cook, D.A. et al. (2013). <i>Technology-Enhanced Simulation for Health Professions Education: A Systematic Review and Meta-Analysis</i>. JAMA. — Meta-análisis con effect size de 0.80 para simulación con tecnología.",
        "INACSL Standards Committee (2024). <i>Healthcare Simulation Standards of Best Practice</i>. — Estándares internacionales para simulación clínica, incluyendo diseño, facilitación y evaluación.",
        "Issenberg, S.B. et al. (2005). Features and uses of high-fidelity medical simulations. <i>Medical Teacher</i>. — 10 características de simulaciones efectivas.",
        "Prochaska, J.O. & DiClemente, C.C. (1992). In search of how people change. <i>American Psychologist</i>. — Modelo transteórico que fundamenta la graduación de dificultad clínica.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))
    story.append(Paragraph("Evalúa: ¿El flujo aprendizaje → práctica → feedback es coherente? ¿La gamificación aporta o distrae? ¿Las métricas miden lo que dicen medir?", ref_s))

    # Expert 5
    story.append(Paragraph("Experto 5: Estudiante avanzado/a de psicología (usuario real)", expert_name_s))
    story.append(Paragraph("<b>Perfil:</b> Estudiante de 4to-5to año de psicología clínica que ha realizado al menos una práctica supervisada con pacientes reales. Representa la voz del usuario final.", body_s))
    story.append(Paragraph("<b>Foco de revisión:</b> Experiencia subjetiva, realismo percibido, utilidad para la formación, intuitividad de la interfaz, comparación con práctica presencial.", body_s))
    story.append(Paragraph("<b>Base teórica desde la que evalúa:</b>", body_s))
    for item in [
        "Experiencia directa como usuario de la plataforma — mínimo 5 sesiones con pacientes de distintos niveles.",
        "Comparación con su experiencia en prácticas clínicas reales supervisadas.",
        "Kolb, D.A. (1984). <i>Experiential Learning</i>. — Ciclo de aprendizaje experiencial (experiencia → reflexión → conceptualización → experimentación) como marco de evaluación.",
        "Feedback cualitativo estructurado: ¿Qué le falta? ¿Qué le sobra? ¿Lo recomendaría a compañeros?",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))
    story.append(Paragraph("Evalúa: ¿Se siente real la conversación? ¿La retroalimentación le ayudó? ¿Es intuitivo? ¿Le generó malestar emocional?", ref_s))

    # 3. Methodology
    story.append(PageBreak())
    story.append(Paragraph("3. Metodología", section_s))

    story.append(Paragraph("Fase 1 — Acceso individual (1 semana)", sub_s))
    for item in [
        "Cada experto recibe una cuenta de prueba con rol apropiado.",
        "Se le asignan 3 pacientes (1 por nivel: principiante, intermedio, avanzado).",
        "Recibe una guía de evaluación con rúbrica y los informes técnicos de la plataforma.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    story.append(Paragraph("Fase 2 — Evaluación estructurada (2 semanas)", sub_s))
    for item in [
        "Cada experto completa mínimo 3 sesiones con pacientes diferentes.",
        "Completa un formulario de evaluación (escala 1-5 por dimensión).",
        "Redacta un informe escrito (1-2 páginas): qué le gustó, qué no, qué recomienda.",
        "Emite veredicto: Aprobado / Aprobado con observaciones / No aprobado.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    story.append(Paragraph("Fase 3 — Mesa redonda (1 sesión, 2 horas)", sub_s))
    for item in [
        "Presentación cruzada de hallazgos entre los 5 expertos.",
        "Discusión de divergencias y consenso en recomendaciones.",
        "Firma de acta de validación.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    # 4. Rubric
    story.append(Paragraph("4. Rúbrica de evaluación", section_s))
    story.append(make_table(
        ["Dimensión", "Evalúa", "Experto", "Escala"],
        [
            ["Realismo clínico", "¿El paciente se comporta como uno real?", "#1 Clínico", "1-5"],
            ["Coherencia narrativa", "¿La historia es consistente entre sesiones?", "#1 Clínico", "1-5"],
            ["Pertinencia del instrumento", "¿Las 10 competencias ECCBP son correctas?", "#1 Clínico", "1-5"],
            ["Seguridad ética", "¿Se manejan bien crisis, límites, estereotipos?", "#2 Ética", "1-5"],
            ["Consentimiento y privacidad", "¿Está claro que es IA? ¿Datos protegidos?", "#2 Ética", "1-5"],
            ["Autenticidad lingüística", "¿Los modismos y registro son realistas?", "#3 Lingüista", "1-5"],
            ["Representación cultural", "¿La diversidad es genuina, no caricaturesca?", "#3 Lingüista", "1-5"],
            ["Diseño pedagógico", "¿El flujo de aprendizaje es efectivo?", "#4 EdTech", "1-5"],
            ["Usabilidad", "¿La plataforma es intuitiva y accesible?", "#4 EdTech", "1-5"],
            ["Experiencia subjetiva", "¿Se siente útil para la formación?", "#5 Estudiante", "1-5"],
        ],
        col_widths=[1.3*inch, 2.2*inch, 1.0*inch, 0.5*inch],
    ))

    # 5. Deliverable
    story.append(Paragraph("5. Entregable final", section_s))
    story.append(Paragraph(
        "Un <b>Informe de Validación por Panel de Expertos</b> (PDF) que incluya:", body_s))
    for item in [
        "Veredicto por dimensión (escala 1-5) con promedios.",
        "Fortalezas identificadas por consenso del panel.",
        "Debilidades identificadas por consenso del panel.",
        "Recomendaciones priorizadas: corto plazo (1 mes), mediano plazo (3 meses), largo plazo (6+ meses).",
        "Firmas de los 5 expertos con sus credenciales.",
        "Sello institucional de la Universidad Gabriela Mistral.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Este informe podrá ser utilizado para: publicaciones en revistas indexadas, postulación a fondos de investigación "
        "(ANID, FONDECYT), acreditación de programas, comunicación institucional y marketing académico.", body_s))

    # References
    story.append(PageBreak())
    story.append(Paragraph("6. Referencias bibliográficas", section_s))
    refs = [
        "American Psychological Association (2025). Ethical Guidance for AI in the Professional Practice of Health Service Psychology. APA.",
        "Cook, D.A. et al. (2013). Technology-Enhanced Simulation for Health Professions Education: A Systematic Review and Meta-Analysis. JAMA, 306(9), 978-988.",
        "Díaz-Campos, M. (Ed.) (2011). The Handbook of Hispanic Sociolinguistics. Wiley-Blackwell.",
        "Díaz-Campos, M. & Sessarego, S. (2021). Aspects of Latin American Spanish Dialectology. John Benjamins.",
        "Hill, C.E. (2014). Helping Skills: Facilitating Exploration, Insight, and Action (4th ed.). APA.",
        "INACSL Standards Committee (2024). Healthcare Simulation Standards of Best Practice.",
        "Issenberg, S.B. et al. (2005). Features and uses of high-fidelity medical simulations that lead to effective learning. Medical Teacher, 27(1), 10-28.",
        "Kolb, D.A. (1984). Experiential Learning: Experience as the Source of Learning and Development. Prentice-Hall.",
        "Lipski, J.M. (2012). El español de América (6th ed.). Cátedra.",
        "Moreno Fernández, F. (2020). Variedades de la lengua española. Routledge.",
        "Norcross, J.C. & Wampold, B.E. (2019). Psychotherapy Relationships That Work (3rd ed.). Oxford University Press.",
        "Pope, K.S. & Vasquez, M.J.T. (2016). Ethics in Psychotherapy and Counseling (5th ed.). Wiley.",
        "Prochaska, J.O. & DiClemente, C.C. (1992). In search of how people change. American Psychologist, 47(9), 1102-1114.",
        "Roth, A.D. & Pilling, S. (2007). The Competences Required to Deliver Effective CBT. University College London.",
        "Stoll, J. et al. (2025). Exploring the Ethical Challenges of Conversational AI in Mental Health Care: Scoping Review. JMIR Mental Health.",
    ]
    for r in refs:
        story.append(Paragraph(r, ref_s))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF: {path}")
    return path

if __name__ == "__main__":
    build()
