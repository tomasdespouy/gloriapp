#!/usr/bin/env python3
"""
Genera INF-2026-004: Informe de Progreso — Corrección RLS + Backlog de Funcionalidades
"""

import os
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, ListFlowable, ListItem,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import black, white, lightgrey

# ── Fonts ────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont("Calibri", "C:/Windows/Fonts/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", "C:/Windows/Fonts/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", "C:/Windows/Fonts/calibrii.ttf"))

# ── Colours ──────────────────────────────────────────────────────────────
INDIGO = HexColor("#4A55A2")
DARK = HexColor("#1A1A1A")
LIGHT_BG = HexColor("#F5F5F5")
GREEN = HexColor("#16A34A")
AMBER = HexColor("#D97706")
RED = HexColor("#DC2626")
GREY = HexColor("#6B7280")
BORDER = HexColor("#E5E5E5")

# ── Paths ────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(BASE, "public", "branding", "gloria-logo.png")
OUT_DIR = os.path.join(BASE, "informes", "desarrollo")
OUT_FILE = os.path.join(OUT_DIR, "INF-2026-004.pdf")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Styles ───────────────────────────────────────────────────────────────
def make_style(name, font="Calibri", size=10, color=DARK, align=TA_LEFT,
               space_before=0, space_after=4, leading=None, left_indent=0):
    return ParagraphStyle(
        name, fontName=font, fontSize=size, textColor=color,
        alignment=align, spaceBefore=space_before, spaceAfter=space_after,
        leading=leading or size * 1.35, leftIndent=left_indent,
    )

sTitle    = make_style("sTitle",    "Calibri-Bold", 20, INDIGO, TA_CENTER, 0, 6)
sSubtitle = make_style("sSubtitle", "Calibri",      11, GREY,   TA_CENTER, 0, 14)
sH1       = make_style("sH1",       "Calibri-Bold", 14, INDIGO, space_before=14, space_after=6)
sH2       = make_style("sH2",       "Calibri-Bold", 11, DARK,   space_before=10, space_after=4)
sBody     = make_style("sBody",     "Calibri",      10, DARK,   TA_JUSTIFY, 0, 4)
sBodyI    = make_style("sBodyI",    "Calibri-Italic",9.5, GREY,  TA_LEFT, 0, 4, left_indent=12)
sBullet   = make_style("sBullet",   "Calibri",      9.5, DARK,  TA_LEFT, 0, 3, left_indent=12)
sSmall    = make_style("sSmall",    "Calibri",      8.5, GREY,  TA_CENTER)
sCell     = make_style("sCell",     "Calibri",      8.5, DARK,  TA_LEFT, 0, 2)
sCellB    = make_style("sCellB",    "Calibri-Bold", 8.5, DARK,  TA_LEFT, 0, 2)
sCellH    = make_style("sCellH",    "Calibri-Bold", 8.5, white, TA_CENTER, 0, 2)
sTag      = make_style("sTag",      "Calibri-Bold", 8,   white, TA_CENTER)

# ── Header/Footer ────────────────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    w, h = LETTER
    # Logo top-right
    if os.path.exists(LOGO):
        canvas.drawImage(LOGO, w - 55*mm, h - 18*mm, 40*mm, 12*mm,
                         preserveAspectRatio=True, mask="auto")
    # Footer
    canvas.setFont("Calibri", 8)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(w / 2, 12*mm, f"GlorIA — Página {doc.page}")
    canvas.restoreState()

# ── Helpers ───────────────────────────────────────────────────────────────
def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)

def status_tag(text, color):
    return Paragraph(
        f'<font color="white"><b>{text}</b></font>',
        make_style("tag", "Calibri-Bold", 8, white, TA_CENTER)
    )

def make_table(headers, rows, col_widths=None):
    """Generic styled table."""
    header_cells = [Paragraph(h, sCellH) for h in headers]
    data = [header_cells]
    for row in rows:
        data.append([Paragraph(str(c), sCell) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME",  (0, 0), (-1, 0), "Calibri-Bold"),
        ("FONTSIZE",  (0, 0), (-1, -1), 8.5),
        ("GRID",      (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN",    (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]
    # Alternate row colours
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
    t.setStyle(TableStyle(style_cmds))
    return t

# ══════════════════════════════════════════════════════════════════════════
#  BUILD DOCUMENT
# ══════════════════════════════════════════════════════════════════════════
doc = SimpleDocTemplate(
    OUT_FILE, pagesize=LETTER,
    leftMargin=22*mm, rightMargin=22*mm,
    topMargin=24*mm, bottomMargin=22*mm,
)

story = []

# ── Cover info ───────────────────────────────────────────────────────────
story.append(Spacer(1, 10*mm))
story.append(Paragraph("INF-2026-004", sTitle))
story.append(Paragraph(
    "Informe de Progreso — Corrección RLS, Asignación de Pacientes<br/>"
    "y Backlog de Funcionalidades Solicitadas",
    make_style("sub2", "Calibri", 12, GREY, TA_CENTER, 4, 10)
))
story.append(hr())

# Metadata table
meta_data = [
    ["Fecha de elaboración", "21 de marzo de 2026"],
    ["Categoría", "Desarrollo"],
    ["Prioridad", "Correctivo + Informativo"],
    ["Elaborado por", "Claude (Asistente IA) + Tomás (Supradmin)"],
    ["Commit asociado", "(pendiente — se incluirá al hacer push)"],
]
meta_table = Table(
    [[Paragraph(r[0], sCellB), Paragraph(r[1], sCell)] for r in meta_data],
    colWidths=[55*mm, 110*mm]
)
meta_table.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.4, BORDER),
    ("BACKGROUND", (0,0), (0,-1), LIGHT_BG),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("TOPPADDING", (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING", (0,0), (-1,-1), 8),
]))
story.append(meta_table)
story.append(Spacer(1, 6*mm))

# ══════════════════════════════════════════════════════════════════════════
# SECTION A — SOLICITUD
# ══════════════════════════════════════════════════════════════════════════
story.append(Paragraph("A) Registro de la Solicitud", sH1))
story.append(hr())

story.append(Paragraph(
    "Se recibieron dos tipos de solicitudes en la sesión del 21 de marzo de 2026:",
    sBody
))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("<b>1. Corrección urgente (resuelta):</b>", sBody))
story.append(Paragraph(
    "Asignar al usuario <b>ailab02@ugm.cl</b> acceso a todos los pacientes de la plataforma. "
    "Al intentar ingresar al chat, el estudiante recibía error 404.",
    sBullet
))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("<b>2. Backlog de funcionalidades (registro):</b>", sBody))
story.append(Paragraph(
    "Se documentan 16 solicitudes de mejora agrupadas en 5 áreas: "
    "Estudiantes, Observación en vivo, Piloto, Top Bar y Supradmin.",
    sBullet
))

# ══════════════════════════════════════════════════════════════════════════
# SECTION B — ESTADO ANTERIOR
# ══════════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 4*mm))
story.append(Paragraph("B) Estado Anterior (Baseline)", sH1))
story.append(hr())

story.append(Paragraph("<b>Problema de acceso (RLS):</b>", sH2))
story.append(Paragraph(
    "La tabla <font face='Calibri-Bold'>establishment_patients</font> tenía Row Level Security (RLS) "
    "habilitado con políticas de lectura únicamente para superadmin y admin. Los estudiantes e instructores "
    "no podían leer esta tabla. Esto causaba que el subquery <font face='Calibri-Bold'>EXISTS</font> "
    "dentro de la política RLS de <font face='Calibri-Bold'>ai_patients</font> siempre retornara vacío "
    "para estudiantes, haciendo invisibles los pacientes asignados explícitamente.",
    sBody
))
story.append(Paragraph(
    "Adicionalmente, el usuario <b>ailab02@ugm.cl</b> tenía <b>establishment_id = NULL</b> "
    "(sin establecimiento asignado) y rol <b>student</b>.",
    sBody
))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("<b>Estado de funcionalidades solicitadas:</b>", sH2))

features_baseline = [
    ["Área", "Funcionalidad", "Estado Anterior"],
    ["Estudiantes", "Bloc de notas en chat (texto + voz)", "No implementado"],
    ["Estudiantes", "Autorreflexión sin scroll / flashcards en fila", "Implementado con scroll vertical"],
    ["Estudiantes", "Dashboard: reemplazar XP por checklist", "XP y niveles implementados"],
    ["Estudiantes", "Flashcards de pacientes: letra ilegible", "aspect-square, texto pequeño"],
    ["Observación", "Modo walkie-talkie (spacebar)", "No implementado"],
    ["Observación", "Análisis semántico de sesión", "No implementado"],
    ["Observación", "Guardado en historial diferenciado", "No implementado"],
    ["Piloto", "Logo GlorIA roto en correos", "Logo referenciado pero no visible"],
    ["Piloto", "Asignación de pacientes al crear piloto", "Sin asignación automática"],
    ["Piloto", "Rango de fecha/hora + botón desactivar", "Fechas parciales, sin desactivar"],
    ["Piloto", "Notificar desactivación en correo", "No implementado"],
    ["Piloto", "Encuesta de cierre en pestañas", "Encuestas existen pero separadas"],
    ["Top Bar", "Hover en íconos y cursor pointer", "Hover parcial implementado"],
    ["Supradmin", "Indicador de conexión en tiempo real", "Solo last_active_at en pilotos"],
    ["Supradmin", "Animación botón \"en vivo\"", "No implementado"],
]

ft = Table(
    [[Paragraph(c, sCellH if i == 0 else sCell) for c in row]
     for i, row in enumerate(features_baseline)],
    colWidths=[28*mm, 70*mm, 68*mm], repeatRows=1
)
style_cmds = [
    ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
]
for i in range(2, len(features_baseline)):
    if i % 2 == 0:
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
ft.setStyle(TableStyle(style_cmds))
story.append(ft)

# ══════════════════════════════════════════════════════════════════════════
# SECTION C — CAMBIOS REALIZADOS
# ══════════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("C) Cambios Realizados y Verificación", sH1))
story.append(hr())

story.append(Paragraph("<b>Cambio 1: Corrección de política RLS</b>", sH2))
story.append(Paragraph(
    "Se creó la migración <font face='Calibri-Bold'>20260321030743_student_read_establishment_patients.sql</font> "
    "que agrega una política SELECT en la tabla <font face='Calibri-Bold'>establishment_patients</font> "
    "para estudiantes e instructores, limitada a su propio establecimiento.",
    sBody
))
story.append(Paragraph(
    "Código SQL aplicado:",
    sBodyI
))
story.append(Paragraph(
    '<font face="Calibri" size="8.5" color="#4A55A2">'
    'CREATE POLICY "Student read own establishment patients"<br/>'
    '&nbsp;&nbsp;ON public.establishment_patients FOR SELECT TO authenticated<br/>'
    '&nbsp;&nbsp;USING (<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;public.get_my_role() IN (\'student\', \'instructor\')<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;AND establishment_id = ANY(public.get_my_establishment_ids())<br/>'
    '&nbsp;&nbsp;);</font>',
    make_style("code", "Calibri", 8.5, INDIGO, TA_LEFT, 4, 4, left_indent=16)
))
story.append(Paragraph(
    "<b>Verificación:</b> Migración aplicada exitosamente vía <font face='Calibri-Bold'>supabase db push</font>. "
    "El subquery EXISTS en las políticas de ai_patients ahora retorna correctamente para estudiantes.",
    sBody
))

story.append(Spacer(1, 4*mm))
story.append(Paragraph("<b>Cambio 2: Asignación de usuario a establecimiento Demo</b>", sH2))
story.append(Paragraph(
    "Se actualizó el perfil de <b>ailab02@ugm.cl</b> asignándole el establecimiento "
    "<b>Demo</b> (ID: 08d440c6-ea33-4552-90af-78ad98bbd31c), país: Otro.",
    sBody
))
story.append(Paragraph(
    "<b>Verificación:</b> PATCH a profiles vía REST API retornó HTTP 204 (éxito).",
    sBody
))

story.append(Spacer(1, 4*mm))
story.append(Paragraph("<b>Cambio 3: Asignación de todos los pacientes a Demo</b>", sH2))
story.append(Paragraph(
    "Se insertaron los 34 pacientes activos en la tabla <b>establishment_patients</b> "
    "vinculados al establecimiento Demo, mediante upsert con on_conflict para evitar duplicados.",
    sBody
))
story.append(Paragraph(
    "<b>Verificación:</b> Consulta Content-Range confirmó 34/34 registros. "
    "El estudiante ahora puede ver y acceder a todos los pacientes.",
    sBody
))

# ── Summary of changes table ─────────────────────────────────────────────
story.append(Spacer(1, 5*mm))
story.append(Paragraph("<b>Resumen de cambios aplicados:</b>", sH2))

changes_data = [
    ["#", "Cambio", "Archivo / Recurso", "Verificación"],
    ["1", "Política RLS para estudiantes\nen establishment_patients",
     "20260321030743_student_\nread_establishment_patients.sql",
     "supabase db push exitoso;\nEstudiante ve 34 pacientes"],
    ["2", "Asignar ailab02@ugm.cl\nal establecimiento Demo",
     "profiles (BD remota)",
     "HTTP 204 en PATCH"],
    ["3", "Asignar 34 pacientes\nal establecimiento Demo",
     "establishment_patients\n(BD remota)",
     "Content-Range: 0-33/34"],
]

ct = Table(
    [[Paragraph(c, sCellH if i == 0 else sCell) for c in row]
     for i, row in enumerate(changes_data)],
    colWidths=[10*mm, 45*mm, 55*mm, 56*mm], repeatRows=1
)
ct_style = [
    ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
]
for i in range(2, len(changes_data)):
    if i % 2 == 0:
        ct_style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
ct.setStyle(TableStyle(ct_style))
story.append(ct)

# ══════════════════════════════════════════════════════════════════════════
# SECTION D — BACKLOG DETALLADO
# ══════════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("D) Backlog de Funcionalidades Solicitadas", sH1))
story.append(hr())

story.append(Paragraph(
    "Las siguientes funcionalidades fueron solicitadas y quedan registradas como backlog de desarrollo. "
    "Se categorizan por área y se incluye una evaluación de complejidad estimada.",
    sBody
))

# ── Estudiantes ──────────────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("D.1) Área: Estudiantes", sH2))

story.append(Paragraph(
    "<b>D.1.1 — Bloc de notas en el chat</b><br/>"
    "Panel deslizable a la derecha del chat que permite tomar notas durante la sesión. "
    "Funcionalidades: escritura de texto + dictado por voz. Corrección de texto siempre habilitada. "
    "Se abre y cierra como panel lateral. Las notas se guardan en el historial de la sesión.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Alta — requiere componente nuevo, integración con speech-to-text y persistencia en BD.", sBodyI))

story.append(Paragraph(
    "<b>D.1.2 — Autorreflexión sin scroll</b><br/>"
    "La sección de autorreflexión post-sesión no debería requerir scroll. "
    "Los flashcards deberían estar en una fila horizontal ocupando el ancho completo de la pantalla "
    "para que el espacio de escritura no sea tan ajustado.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Media — rediseño de layout en ReviewClient.tsx.", sBodyI))

story.append(Paragraph(
    "<b>D.1.3 — Reemplazar XP por mini checklist</b><br/>"
    "En el dashboard de inicio, sacar el sistema de XP y reemplazarlo por una mini checklist "
    "de primeras acciones/logros: Sesión con tutor guía + Nano cursos (0/12) + Primera sesión + 4ta sesión.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Media — rediseño de dashboard, nueva lógica de tracking de hitos.", sBodyI))

story.append(Paragraph(
    "<b>D.1.4 — Flashcards de pacientes: mejorar legibilidad</b><br/>"
    "En el dashboard de inicio, las flashcards de pacientes no muestran bien la letra. "
    "Considerar ampliar el flashcard hacia abajo para dar más espacio al texto.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Baja — ajuste CSS de dimensiones de tarjetas.", sBodyI))

# ── Observación en vivo ──────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("D.2) Área: Observación en Vivo", sH2))

story.append(Paragraph(
    "<b>D.2.1 — Modo walkie-talkie</b><br/>"
    "Implementar modo walkie-talkie para observación en vivo: presionar barra espaciadora para "
    "empezar a grabar, volver a presionar para cambiar de persona (observador/paciente).",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Alta — módulo completamente nuevo, WebRTC o grabación de audio segmentada.", sBodyI))

story.append(Paragraph(
    "<b>D.2.2 — Análisis semántico</b><br/>"
    "Análisis semántico de la sesión de observación para revisión posterior.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Alta — requiere pipeline NLP/LLM post-procesamiento de audio transcrito.", sBodyI))

story.append(Paragraph(
    "<b>D.2.3 — Historial diferenciado</b><br/>"
    "Las sesiones de observación en vivo se guardan en historial pero categorizándolas "
    "de forma distinta a las sesiones escritas (chat).",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Media — nuevo tipo de sesión en BD + filtro en historial.", sBodyI))

# ── Piloto ───────────────────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("D.3) Área: Piloto", sH2))

story.append(Paragraph(
    "<b>D.3.1 — Logo GlorIA roto en correos</b><br/>"
    "Al enviar correos de invitación del piloto, el logo de GlorIA aparece quebrado/no se ve. "
    "Verificar URL del logo y hosting de imagen para emails.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Baja — fix de URL o embedding de imagen en email template.", sBodyI))

story.append(Paragraph(
    "<b>D.3.2 — Asignación de pacientes al crear piloto</b><br/>"
    "Actualmente no hay asignación de pacientes al momento de crear un piloto, "
    "por lo que los estudiantes no pueden ver pacientes. Habilitar botón para agregar "
    "grupos de pacientes: todos, por país, por nivel, por edad.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Media — UI de selección grupal + lógica de bulk insert en establishment_patients.", sBodyI))

story.append(Paragraph(
    "<b>D.3.3 — Rango de fecha/hora + botón desactivar</b><br/>"
    "En la sección \"ingreso de usuarios\" del piloto, permitir definir rango de fecha y hora "
    "en que estará habilitada la plataforma. Agregar botón \"desactivar piloto\" en la sección dashboard.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Media — campos datetime + lógica de activación/desactivación.", sBodyI))

story.append(Paragraph(
    "<b>D.3.4 — Notificar desactivación en correo</b><br/>"
    "Dentro del correo de invitación, notificar que la cuenta se desactivará en determinado día y hora.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Baja — template de email con fecha dinámica.", sBodyI))

story.append(Paragraph(
    "<b>D.3.5 — Encuesta de cierre en pestañas</b><br/>"
    "Dentro de las pestañas del piloto, poder diseñar y enviar una encuesta de cierre "
    "cuando termine la sesión. Incluir 2 preguntas de fortalezas, debilidades y NPS.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Media — integración con sistema de encuestas existente + UI en piloto.", sBodyI))

# ── Top Bar ──────────────────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("D.4) Área: Top Bar", sH2))

story.append(Paragraph(
    "<b>D.4.1 — Hover mejorado en íconos</b><br/>"
    "Al pasar el mouse por encima de notificaciones, soporte y usuario, debe haber "
    "un cambio visible en la tonalidad del ícono y el nombre del botón. "
    "El cursor debe cambiar a pointer.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Baja — ajustes CSS de hover states y cursor.", sBodyI))

# ── Supradmin ────────────────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("D.5) Área: Supradmin", sH2))

story.append(Paragraph(
    "<b>D.5.1 — Indicador de conexión en tiempo real</b><br/>"
    "Cuando un estudiante entra a la plataforma, debe aparecer como conectado en el panel supradmin. "
    "También trackear cuándo abrió el correo de invitación.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Alta — requiere sistema de presencia en tiempo real (Supabase Realtime o WebSocket) + tracking de email opens.", sBodyI))

story.append(Paragraph(
    "<b>D.5.2 — Animación botón \"en vivo\"</b><br/>"
    "Poner una animación de botón que prende y apaga como si estuviera \"en vivo\" "
    "junto al indicador de conexión.",
    sBullet
))
story.append(Paragraph("Complejidad estimada: Baja — CSS animation pulse/blink.", sBodyI))

# ══════════════════════════════════════════════════════════════════════════
# SECTION E — RESUMEN EJECUTIVO
# ══════════════════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("E) Resumen Ejecutivo", sH1))
story.append(hr())

summary_data = [
    ["Indicador", "Valor"],
    ["Cambios aplicados en esta sesión", "3 (RLS fix + asignación usuario + asignación pacientes)"],
    ["Funcionalidades pendientes registradas", "16"],
    ["Complejidad Alta", "4 (bloc de notas, walkie-talkie, análisis semántico, presencia en tiempo real)"],
    ["Complejidad Media", "7 (autorreflexión, checklist, historial obs., pacientes piloto, fechas piloto, encuesta, nuevo tipo sesión)"],
    ["Complejidad Baja", "5 (flashcards, logo email, notif. email, hover top bar, animación en vivo)"],
    ["Migración SQL creada", "20260321030743_student_read_establishment_patients.sql"],
    ["Usuario corregido", "ailab02@ugm.cl → establecimiento Demo, 34 pacientes"],
]

st = Table(
    [[Paragraph(c, sCellH if i == 0 else (sCellB if j == 0 else sCell))
      for j, c in enumerate(row)]
     for i, row in enumerate(summary_data)],
    colWidths=[60*mm, 106*mm], repeatRows=1
)
st_style = [
    ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
]
for i in range(2, len(summary_data)):
    if i % 2 == 0:
        st_style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
st.setStyle(TableStyle(st_style))
story.append(st)

# ── Firma ────────────────────────────────────────────────────────────────
story.append(Spacer(1, 15*mm))
story.append(hr())
story.append(Paragraph(
    "<b>Elaborado por:</b> Claude (Asistente IA) — 21 de marzo de 2026",
    make_style("firma", "Calibri", 9, GREY, TA_LEFT, 4, 2)
))
story.append(Paragraph(
    "<b>Revisado por:</b> Tomás (Supradmin GlorIA)",
    make_style("firma2", "Calibri", 9, GREY, TA_LEFT, 0, 2)
))

# ── Build ────────────────────────────────────────────────────────────────
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"PDF generado: {OUT_FILE}")
