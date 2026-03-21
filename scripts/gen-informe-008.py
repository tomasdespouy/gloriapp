#!/usr/bin/env python3
"""INF-2026-008: Análisis de Robustez Clínica y Pedagógica — Mejoras Futuras"""
import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import white

pdfmetrics.registerFont(TTFont("Calibri", "C:/Windows/Fonts/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", "C:/Windows/Fonts/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", "C:/Windows/Fonts/calibrii.ttf"))

INDIGO = HexColor("#4A55A2")
DARK = HexColor("#1A1A1A")
LIGHT = HexColor("#F5F5F5")
GREY = HexColor("#6B7280")
BORDER = HexColor("#E5E5E5")
RED_BG = HexColor("#FEF2F2")
RED_T = HexColor("#991B1B")
AMBER_BG = HexColor("#FFFBEB")
AMBER_T = HexColor("#92400E")
GREEN_BG = HexColor("#F0FDF4")
GREEN_T = HexColor("#166534")
BLUE_BG = HexColor("#EFF6FF")
BLUE_T = HexColor("#1E40AF")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(BASE, "public", "branding", "gloria-logo.png")
OUT = os.path.join(BASE, "informes", "desarrollo", "INF-2026-008.pdf")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

def s(name, font="Calibri", sz=10, color=DARK, align=TA_LEFT, sb=0, sa=4, ld=None, li=0):
    return ParagraphStyle(name, fontName=font, fontSize=sz, textColor=color,
        alignment=align, spaceBefore=sb, spaceAfter=sa, leading=ld or sz * 1.4, leftIndent=li)

sTitle = s("T", "Calibri-Bold", 22, INDIGO, TA_CENTER, 0, 6)
sH1 = s("H1", "Calibri-Bold", 14, INDIGO, sb=16, sa=6)
sH2 = s("H2", "Calibri-Bold", 11, DARK, sb=10, sa=4)
sH3 = s("H3", "Calibri-Bold", 10, INDIGO, sb=8, sa=3)
sBody = s("B", "Calibri", 10, DARK, TA_JUSTIFY, 0, 4)
sBodyI = s("BI", "Calibri-Italic", 9.5, GREY, li=12)
sBul = s("Bu", "Calibri", 9.5, DARK, li=14, sa=3)
sCell = s("C", "Calibri", 8.5, DARK)
sCellB = s("CB", "Calibri-Bold", 8.5, DARK)
sCellH = s("CH", "Calibri-Bold", 8.5, white, TA_CENTER)
sSmall = s("Sm", "Calibri", 8, GREY)

def hf(canvas, doc):
    canvas.saveState()
    w, h = LETTER
    if os.path.exists(LOGO):
        canvas.drawImage(LOGO, w - 55*mm, h - 18*mm, 40*mm, 12*mm,
                         preserveAspectRatio=True, mask="auto")
    canvas.setFont("Calibri", 8)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(w / 2, 12*mm, f"GlorIA \u2014 P\u00e1gina {doc.page}")
    canvas.restoreState()

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)

def tbl(headers, rows, widths=None, col_colors=None):
    hdr = [Paragraph(h, sCellH) for h in headers]
    data = [hdr]
    for row in rows:
        data.append([Paragraph(str(c), sCell) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    cmds = [
        ("BACKGROUND", (0,0), (-1,0), INDIGO),
        ("TEXTCOLOR", (0,0), (-1,0), white),
        ("GRID", (0,0), (-1,-1), 0.4, BORDER),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ]
    for i in range(2, len(data)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    if col_colors:
        for row_idx, color in col_colors:
            cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), color))
    t.setStyle(TableStyle(cmds))
    return t

def priority_badge(level):
    colors = {
        "CR\u00cdTICA": ('<font color="#991B1B"><b>CR\u00cdTICA</b></font>', RED_BG),
        "ALTA": ('<font color="#92400E"><b>ALTA</b></font>', AMBER_BG),
        "MEDIA": ('<font color="#1E40AF"><b>MEDIA</b></font>', BLUE_BG),
        "BAJA": ('<font color="#166534"><b>BAJA</b></font>', GREEN_BG),
    }
    return colors.get(level, ('<font color="#6B7280"><b>?</b></font>', LIGHT))

doc = SimpleDocTemplate(OUT, pagesize=LETTER,
    leftMargin=22*mm, rightMargin=22*mm, topMargin=24*mm, bottomMargin=22*mm)
story = []

# ═══════════════════════════════════════════════════════════════════════
# PORTADA
# ═══════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 15*mm))
story.append(Paragraph("INF-2026-008", sTitle))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    "An\u00e1lisis de Robustez Cl\u00ednica y Pedag\u00f3gica<br/>"
    "Hoja de Ruta de Mejoras para Escala Multi-Pa\u00eds",
    s("sub", "Calibri", 13, GREY, TA_CENTER, 4, 10)
))
story.append(Spacer(1, 4*mm))
story.append(hr())

meta = [
    ["Fecha de elaboraci\u00f3n", "21 de marzo de 2026"],
    ["Categor\u00eda", "Investigaci\u00f3n + Arquitectura"],
    ["Prioridad", "Estrat\u00e9gica"],
    ["Alcance", "5 pa\u00edses \u00b7 10 instituciones \u00b7 5,000+ usuarios"],
    ["Elaborado por", "Claude (Asistente IA) + Tom\u00e1s (Supradmin)"],
]
mt = Table([[Paragraph(r[0], sCellB), Paragraph(r[1], sCell)] for r in meta],
    colWidths=[50*mm, 116*mm])
mt.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.4, BORDER),
    ("BACKGROUND", (0,0), (0,-1), LIGHT),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("TOPPADDING", (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING", (0,0), (-1,-1), 8),
]))
story.append(mt)

# Contexto
story.append(Spacer(1, 6*mm))
story.append(Paragraph(
    "Este informe analiza las \u00e1reas de mejora de GlorIA para garantizar robustez cl\u00ednica y "
    "pedag\u00f3gica a escala. Se audita el estado actual de la plataforma contra est\u00e1ndares de "
    "formaci\u00f3n cl\u00ednica, normativa de protecci\u00f3n de datos latinoamericana y buenas pr\u00e1cticas "
    "de EdTech en salud mental. Cada mejora incluye: estado actual, brecha, propuesta y prioridad.",
    sBody
))

# ═══════════════════════════════════════════════════════════════════════
# 1. SEGURIDAD CLÍNICA
# ═══════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("1. Seguridad Cl\u00ednica", sH1))
story.append(hr())

# 1.1 Protocolo de crisis
story.append(Paragraph("1.1 Protocolo de crisis e ideaci\u00f3n suicida", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> No existe detecci\u00f3n de contenido de riesgo durante la sesi\u00f3n. "
    "Si un estudiante menciona ideaci\u00f3n suicida (propia o del \u201cpaciente\u201d), autolesiones o violencia, "
    "la plataforma no alerta ni interviene.",
    sBody
))
story.append(Paragraph(
    "<b>Brecha:</b> Con 5,000 usuarios practicando terapia, la exposici\u00f3n a contenido sensible es inevitable. "
    "Pacientes como Gabriel Navarro (adicci\u00f3n + ideaci\u00f3n suicida) y Lorena Guti\u00e9rrez (violencia intrafamiliar) "
    "generan escenarios donde un estudiante podr\u00eda necesitar contenci\u00f3n. Adem\u00e1s, el propio estudiante podr\u00eda "
    "revelar malestar emocional durante la reflexi\u00f3n post-sesi\u00f3n.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Clasificador en tiempo real (keyword + LLM) que detecte menciones de riesgo en mensajes del estudiante",
    sBul
))
story.append(Paragraph(
    "\u2022 Al detectar riesgo: pausar sesi\u00f3n, mostrar recursos de ayuda (l\u00edneas de crisis por pa\u00eds), "
    "notificar al docente supervisor por push + email",
    sBul
))
story.append(Paragraph(
    "\u2022 Panel de incidentes en supradmin con log de eventos de riesgo",
    sBul
))
story.append(Paragraph("<b>Prioridad: CR\u00cdTICA</b> \u2014 Riesgo legal y \u00e9tico.", sBody))

# 1.2 Detección de intervenciones dañinas
story.append(Spacer(1, 3*mm))
story.append(Paragraph("1.2 Detecci\u00f3n de intervenciones da\u00f1inas del estudiante", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> El motor cl\u00ednico (clinical-state-engine) clasifica intervenciones en 8 tipos "
    "(pregunta abierta, reflejo, confrontaci\u00f3n, etc.) pero no detecta intervenciones potencialmente da\u00f1inas.",
    sBody
))
story.append(Paragraph(
    "<b>Brecha:</b> Un estudiante podr\u00eda: dar consejos m\u00e9dicos prematuros (\u201cdeber\u00edas tomar tal medicamento\u201d), "
    "minimizar sufrimiento (\u201cno es para tanto\u201d), romper confidencialidad (\u201cle voy a contar a tu familia\u201d), "
    "o imponer juicios morales. La IA eval\u00faa despu\u00e9s, pero no interviene durante.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Agregar clasificaci\u00f3n \u201charmful_intervention\u201d al motor cl\u00ednico con subtipos (consejo_prematuro, "
    "minimizaci\u00f3n, juicio_moral, ruptura_confidencialidad)",
    sBul
))
story.append(Paragraph(
    "\u2022 El paciente reacciona negativamente cuando detecta intervenci\u00f3n da\u00f1ina (incremento resistencia, "
    "ca\u00edda alianza) \u2014 esto ya est\u00e1 parcialmente implementado en el state engine",
    sBul
))
story.append(Paragraph(
    "\u2022 Flag en la evaluaci\u00f3n post-sesi\u00f3n que identifique espec\u00edficamente estas intervenciones",
    sBul
))
story.append(Paragraph("<b>Prioridad: ALTA</b>", sBody))

# ═══════════════════════════════════════════════════════════════════════
# 2. VALIDACIÓN DE LA EVALUACIÓN
# ═══════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 4*mm))
story.append(Paragraph("2. Validaci\u00f3n de la Evaluaci\u00f3n", sH1))
story.append(hr())

story.append(Paragraph("2.1 Calibraci\u00f3n con r\u00fabricas validadas", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> Las 10 competencias V2 son evaluadas por IA (GPT-4o) con un prompt "
    "que define cada competencia y una escala 0-4. No hay calibraci\u00f3n contra evaluadores humanos.",
    sBody
))
story.append(Paragraph(
    "<b>Brecha:</b> Para que 10 instituciones conf\u00eden en los puntajes, se necesita evidencia de "
    "inter-rater reliability (concordancia IA vs. panel de expertos). Sin esto, la evaluaci\u00f3n "
    "es percibida como \u201copini\u00f3n de la m\u00e1quina\u201d, no como medici\u00f3n validada.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Estudio de calibraci\u00f3n: 50 sesiones evaluadas por 3 expertos + IA. Calcular Kappa de Cohen o ICC",
    sBul
))
story.append(Paragraph(
    "\u2022 Anclar competencias a instrumentos validados (CICS, Helping Skills Measure, adaptaciones locales)",
    sBul
))
story.append(Paragraph(
    "\u2022 Publicar resultados de validaci\u00f3n como white paper para uso comercial con instituciones",
    sBul
))
story.append(Paragraph("<b>Prioridad: ALTA</b> \u2014 Credibilidad institucional.", sBody))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("2.2 Mecanismo de disputa y correcci\u00f3n", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> El docente aprueba o rechaza la evaluaci\u00f3n (feedbackStatus: pending/approved), "
    "pero no puede corregir puntajes individuales ni agregar observaciones por competencia.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Permitir al docente editar puntajes por competencia con justificaci\u00f3n",
    sBul
))
story.append(Paragraph(
    "\u2022 Log de cambios: puntaje original IA vs. puntaje corregido por docente",
    sBul
))
story.append(Paragraph(
    "\u2022 Estas correcciones alimentan un dataset de fine-tuning para mejorar el evaluador IA",
    sBul
))
story.append(Paragraph("<b>Prioridad: MEDIA</b>", sBody))

# ═══════════════════════════════════════════════════════════════════════
# 3. PEDAGOGÍA
# ═══════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("3. Robustez Pedag\u00f3gica", sH1))
story.append(hr())

story.append(Paragraph("3.1 Progresi\u00f3n longitudinal del estudiante", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> El estudiante ve puntajes por sesi\u00f3n individual y un radar de competencias. "
    "No hay curva de progreso en el tiempo, ni comparaci\u00f3n con cohorte, ni metas personalizadas.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Gr\u00e1fico de l\u00ednea temporal en /progreso mostrando cada competencia a trav\u00e9s de las sesiones",
    sBul
))
story.append(Paragraph(
    "\u2022 Benchmark an\u00f3nimo: \u201cTu puntaje en escucha activa est\u00e1 en el percentil 72 de tu cohorte\u201d",
    sBul
))
story.append(Paragraph(
    "\u2022 Plan de mejora autom\u00e1tico: \u201cTu competencia m\u00e1s baja es contencion_afectos \u2014 te sugerimos practicar con Lorena Guti\u00e9rrez\u201d",
    sBul
))
story.append(Paragraph("<b>Prioridad: ALTA</b> \u2014 Diferenciador pedag\u00f3gico clave.", sBody))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("3.2 Dashboard docente con vista de cohorte", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> El docente ve sesiones individuales en /docente/sesion/[id] y puede aprobar evaluaciones. "
    "No tiene vista de cohorte, comparaci\u00f3n entre estudiantes, ni alertas de riesgo acad\u00e9mico.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Vista de cohorte: tabla de estudiantes \u00d7 competencias con heatmap de puntajes",
    sBul
))
story.append(Paragraph(
    "\u2022 Alertas: estudiantes que no han practicado en 7+ d\u00edas, puntajes en ca\u00edda, sesiones muy cortas",
    sBul
))
story.append(Paragraph(
    "\u2022 Comparaci\u00f3n entre secciones/grupos del mismo docente",
    sBul
))
story.append(Paragraph("<b>Prioridad: ALTA</b> \u2014 Los docentes son quienes deciden renovar.", sBody))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("3.3 Scaffolding y progresión de dificultad", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> Los pacientes tienen difficulty_level (beginner/intermediate/advanced) y badges de color, "
    "pero no hay itinerarios sugeridos ni restricci\u00f3n por nivel del estudiante.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Itinerarios sugeridos por instituci\u00f3n: \u201cSemana 1-2: pacientes principiantes, Semana 3-4: intermedios\u201d",
    sBul
))
story.append(Paragraph(
    "\u2022 Desbloqueo progresivo: pacientes avanzados visibles solo tras completar 3+ sesiones con principiantes",
    sBul
))
story.append(Paragraph(
    "\u2022 Configuraci\u00f3n por establecimiento: el admin elige qu\u00e9 pacientes est\u00e1n disponibles por semana/m\u00f3dulo",
    sBul
))
story.append(Paragraph("<b>Prioridad: MEDIA</b>", sBody))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("3.4 Alineamiento curricular configurable", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> Las 10 competencias V2 son fijas para todas las instituciones. "
    "No hay configuraci\u00f3n por establecimiento.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Tabla establishment_competencies que permita activar/desactivar competencias y ajustar pesos por instituci\u00f3n",
    sBul
))
story.append(Paragraph(
    "\u2022 Mapeo a resultados de aprendizaje espec\u00edficos de cada malla curricular",
    sBul
))
story.append(Paragraph("<b>Prioridad: MEDIA</b> \u2014 Escalabilidad comercial.", sBody))

# ═══════════════════════════════════════════════════════════════════════
# 4. DIVERSIDAD CLÍNICA
# ═══════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 4*mm))
story.append(Paragraph("4. Diversidad Cl\u00ednica", sH1))
story.append(hr())

story.append(Paragraph("4.1 Cobertura diagn\u00f3stica", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> 34 pacientes con diversidad de pa\u00edses, edades y problem\u00e1ticas. "
    "No hay mapeo sistem\u00e1tico contra categor\u00edas diagn\u00f3sticas.",
    sBody
))
story.append(Paragraph("<b>Brecha:</b> Posibles gaps en: trastornos alimentarios, duelo patol\u00f3gico, "
    "adicciones (solo 1 paciente), diversidad de g\u00e9nero/sexual, neurodivergencia (TEA, TDAH), "
    "trauma complejo, violencia de g\u00e9nero (perspectiva del agresor).",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph(
    "\u2022 Matriz de cobertura: 34 pacientes \u00d7 categor\u00edas DSM-5/CIE-11. Identificar gaps.",
    sBul
))
story.append(Paragraph(
    "\u2022 Crear 6-8 pacientes nuevos para cubrir gaps cr\u00edticos",
    sBul
))
story.append(Paragraph(
    "\u2022 Casos de interculturalidad: migrante venezolano en Chile, ind\u00edgena quechua en consulta urbana",
    sBul
))
story.append(Paragraph("<b>Prioridad: MEDIA</b>", sBody))

# ═══════════════════════════════════════════════════════════════════════
# 5. INFRAESTRUCTURA Y ESCALA
# ═══════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("5. Infraestructura y Escala", sH1))
story.append(hr())

story.append(Paragraph("5.1 Monitoreo de costos LLM", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> No hay tracking de costos por instituci\u00f3n, ni l\u00edmites de uso, "
    "ni alertas de gasto an\u00f3malo. El logger registra m\u00e9tricas pero no costos.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph("\u2022 Dashboard de costos en supradmin: tokens consumidos por instituci\u00f3n/d\u00eda/mes", sBul))
story.append(Paragraph("\u2022 L\u00edmites configurables por establecimiento (tokens/mes)", sBul))
story.append(Paragraph("\u2022 Alertas autom\u00e1ticas al superar 80% del l\u00edmite", sBul))
story.append(Paragraph("<b>Prioridad: ALTA</b> \u2014 Sostenibilidad financiera.", sBody))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("5.2 Protecci\u00f3n de datos y privacidad", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> RLS en Supabase, autenticaci\u00f3n con JWT, datos en Supabase Cloud (AWS us-east-1). "
    "No hay pol\u00edtica de retenci\u00f3n, consentimiento informado digital, ni an\u00e1lisis de cumplimiento por pa\u00eds.",
    sBody
))
story.append(Paragraph("<b>Normativa aplicable:</b>", sBody))
story.append(tbl(
    ["Pa\u00eds", "Ley", "Requisitos clave"],
    [
        ["Chile", "Ley 19.628 + Ley 21.719 (2024)", "Consentimiento expl\u00edcito, derecho al olvido, DPO obligatorio"],
        ["Colombia", "Ley 1581 de 2012", "Registro de BD ante SIC, autorizaci\u00f3n previa, transferencia internacional"],
        ["M\u00e9xico", "LFPDPPP", "Aviso de privacidad, consentimiento t\u00e1cito para datos sensibles de salud"],
        ["Per\u00fa", "Ley 29733", "Registro en APDP, principio de finalidad, plazo m\u00e1ximo de retenci\u00f3n"],
        ["Rep. Dominicana", "Ley 172-13", "Consentimiento informado, habeas data, protecci\u00f3n datos de salud"],
    ],
    [28*mm, 40*mm, 98*mm]
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph("\u2022 Consentimiento informado digital al registrarse (por pa\u00eds, con checkbox trazable)", sBul))
story.append(Paragraph("\u2022 Pol\u00edtica de retenci\u00f3n: eliminar conversaciones > 2 a\u00f1os, anonimizar despu\u00e9s de 1 a\u00f1o", sBul))
story.append(Paragraph("\u2022 Bot\u00f3n \u201celiminar mis datos\u201d en perfil del estudiante (derecho al olvido)", sBul))
story.append(Paragraph("\u2022 Aviso de privacidad espec\u00edfico por pa\u00eds", sBul))
story.append(Paragraph("<b>Prioridad: CR\u00cdTICA</b> \u2014 Requisito legal en 5 pa\u00edses.", sBody))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("5.3 Alta disponibilidad y observabilidad", sH2))
story.append(Paragraph(
    "<b>Estado actual:</b> Existe /api/health y logging b\u00e1sico. No hay alertas autom\u00e1ticas, "
    "ni fallback si OpenAI/Gemini caen, ni monitoreo de latencia end-to-end.",
    sBody
))
story.append(Paragraph("<b>Propuesta:</b>", sBody))
story.append(Paragraph("\u2022 Integraci\u00f3n con Sentry o similar para errores en producci\u00f3n", sBul))
story.append(Paragraph("\u2022 Fallback autom\u00e1tico entre OpenAI y Gemini si uno falla", sBul))
story.append(Paragraph("\u2022 Dashboard de uptime visible para instituciones", sBul))
story.append(Paragraph("\u2022 Alertas por Slack/email cuando error rate > 5%", sBul))
story.append(Paragraph("<b>Prioridad: ALTA</b>", sBody))

# ═══════════════════════════════════════════════════════════════════════
# 6. TABLA RESUMEN
# ═══════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("6. Tabla Resumen de Prioridades", sH1))
story.append(hr())

summary_rows = [
    ["1", "Protocolo de crisis e ideaci\u00f3n suicida", "Seguridad cl\u00ednica", "CR\u00cdTICA", "No existe"],
    ["2", "Protecci\u00f3n de datos por pa\u00eds", "Legal/Compliance", "CR\u00cdTICA", "Parcial (RLS)"],
    ["3", "Calibraci\u00f3n de evaluaci\u00f3n con expertos", "Validaci\u00f3n", "ALTA", "No existe"],
    ["4", "Dashboard docente con vista de cohorte", "Pedagog\u00eda", "ALTA", "B\u00e1sico"],
    ["5", "Monitoreo de costos LLM", "Infraestructura", "ALTA", "No existe"],
    ["6", "Alta disponibilidad y fallback LLM", "Infraestructura", "ALTA", "Parcial"],
    ["7", "Progresi\u00f3n longitudinal del estudiante", "Pedagog\u00eda", "ALTA", "No existe"],
    ["8", "Detecci\u00f3n de intervenciones da\u00f1inas", "Seguridad cl\u00ednica", "ALTA", "Parcial"],
    ["9", "Mecanismo de disputa/correcci\u00f3n", "Validaci\u00f3n", "MEDIA", "No existe"],
    ["10", "Scaffolding y progresi\u00f3n de dificultad", "Pedagog\u00eda", "MEDIA", "Parcial (badges)"],
    ["11", "Alineamiento curricular configurable", "Pedagog\u00eda", "MEDIA", "No existe"],
    ["12", "Cobertura diagn\u00f3stica (gaps DSM-5)", "Diversidad cl\u00ednica", "MEDIA", "Parcial"],
]

story.append(tbl(
    ["#", "Mejora", "\u00c1rea", "Prioridad", "Estado actual"],
    summary_rows,
    [8*mm, 60*mm, 32*mm, 18*mm, 48*mm]
))

story.append(Spacer(1, 6*mm))
story.append(Paragraph("<b>Distribuci\u00f3n por prioridad:</b>", sBody))
story.append(Paragraph("\u2022 CR\u00cdTICA: 2 items (protocolo de crisis + protecci\u00f3n de datos)", sBul))
story.append(Paragraph("\u2022 ALTA: 6 items (evaluaci\u00f3n, dashboard docente, costos, disponibilidad, progresi\u00f3n, intervenciones)", sBul))
story.append(Paragraph("\u2022 MEDIA: 4 items (disputa, scaffolding, curricular, diversidad)", sBul))

story.append(Spacer(1, 6*mm))
story.append(Paragraph(
    "<b>Nota:</b> Algunas de estas funcionalidades pueden existir parcialmente en la plataforma "
    "(especialmente en el panel de supradmin). Este informe documenta las brechas identificadas "
    "a nivel de c\u00f3digo y arquitectura para servir como referencia en la planificaci\u00f3n de desarrollo.",
    s("note", "Calibri-Italic", 9, GREY, TA_JUSTIFY, 4, 4)
))

# Firma
story.append(Spacer(1, 12*mm))
story.append(hr())
story.append(Paragraph(
    "<b>Elaborado por:</b> Claude (Asistente IA) \u2014 21 de marzo de 2026",
    s("f1", "Calibri", 9, GREY, sb=4, sa=2)
))
story.append(Paragraph(
    "<b>Revisado por:</b> Tom\u00e1s (Supradmin GlorIA)",
    s("f2", "Calibri", 9, GREY, sa=2)
))

doc.build(story, onFirstPage=hf, onLaterPages=hf)
print(f"PDF generado: {OUT}")
