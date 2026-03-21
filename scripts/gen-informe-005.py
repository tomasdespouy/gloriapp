#!/usr/bin/env python3
"""
Genera INF-2026-005: Implementación de 16 funcionalidades solicitadas
"""

import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import white

pdfmetrics.registerFont(TTFont("Calibri", "C:/Windows/Fonts/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", "C:/Windows/Fonts/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", "C:/Windows/Fonts/calibrii.ttf"))

INDIGO = HexColor("#4A55A2")
DARK = HexColor("#1A1A1A")
LIGHT_BG = HexColor("#F5F5F5")
GREEN = HexColor("#16A34A")
AMBER = HexColor("#D97706")
RED = HexColor("#DC2626")
GREY = HexColor("#6B7280")
BORDER = HexColor("#E5E5E5")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(BASE, "public", "branding", "gloria-logo.png")
OUT_DIR = os.path.join(BASE, "informes", "desarrollo")
OUT_FILE = os.path.join(OUT_DIR, "INF-2026-005.pdf")
os.makedirs(OUT_DIR, exist_ok=True)

def ms(name, font="Calibri", size=10, color=DARK, align=TA_LEFT,
        sb=0, sa=4, leading=None, li=0):
    return ParagraphStyle(name, fontName=font, fontSize=size, textColor=color,
        alignment=align, spaceBefore=sb, spaceAfter=sa,
        leading=leading or size * 1.35, leftIndent=li)

sTitle    = ms("sTitle",    "Calibri-Bold", 20, INDIGO, TA_CENTER, 0, 6)
sSubtitle = ms("sSubtitle", "Calibri",      11, GREY,   TA_CENTER, 0, 14)
sH1       = ms("sH1",       "Calibri-Bold", 14, INDIGO, sb=14, sa=6)
sH2       = ms("sH2",       "Calibri-Bold", 11, DARK,   sb=10, sa=4)
sBody     = ms("sBody",     "Calibri",      10, DARK,   TA_JUSTIFY, 0, 4)
sBodyI    = ms("sBodyI",    "Calibri-Italic",9.5, GREY, li=12)
sBullet   = ms("sBullet",   "Calibri",      9.5, DARK,  li=12)
sCell     = ms("sCell",     "Calibri",      8.5, DARK)
sCellB    = ms("sCellB",    "Calibri-Bold", 8.5, DARK)
sCellH    = ms("sCellH",    "Calibri-Bold", 8.5, white, TA_CENTER)

def header_footer(canvas, doc):
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

def tbl(headers, rows, widths=None):
    hdr = [Paragraph(h, sCellH) for h in headers]
    data = [hdr] + [[Paragraph(str(c), sCell) for c in r] for r in rows]
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
            cmds.append(("BACKGROUND", (0,i), (-1,i), LIGHT_BG))
    t.setStyle(TableStyle(cmds))
    return t

doc = SimpleDocTemplate(OUT_FILE, pagesize=LETTER,
    leftMargin=22*mm, rightMargin=22*mm, topMargin=24*mm, bottomMargin=22*mm)

story = []

# ── Cover ────────────────────────────────────────────────────────────────
story.append(Spacer(1, 10*mm))
story.append(Paragraph("INF-2026-005", sTitle))
story.append(Paragraph(
    "Implementaci\u00f3n de 16 Funcionalidades Solicitadas<br/>"
    "Estudiantes, Observaci\u00f3n en Vivo, Piloto, Top Bar y Supradmin",
    ms("sub", "Calibri", 12, GREY, TA_CENTER, 4, 10)
))
story.append(hr())

meta = [
    ["Fecha de elaboraci\u00f3n", "21 de marzo de 2026"],
    ["Categor\u00eda", "Desarrollo"],
    ["Prioridad", "Mejora UX + Nuevas Funcionalidades"],
    ["Elaborado por", "Claude (Asistente IA) + Tom\u00e1s (Supradmin)"],
]
mt = Table([[Paragraph(r[0], sCellB), Paragraph(r[1], sCell)] for r in meta],
    colWidths=[55*mm, 110*mm])
mt.setStyle(TableStyle([
    ("GRID",(0,0),(-1,-1),0.4,BORDER),
    ("BACKGROUND",(0,0),(0,-1),LIGHT_BG),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("TOPPADDING",(0,0),(-1,-1),5),
    ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),8),
]))
story.append(mt)

# ── A) SOLICITUD ─────────────────────────────────────────────────────────
story.append(Spacer(1, 6*mm))
story.append(Paragraph("A) Registro de la Solicitud", sH1))
story.append(hr())
story.append(Paragraph(
    "Se solicitaron 16 funcionalidades agrupadas en 5 \u00e1reas: "
    "Estudiantes (4), Observaci\u00f3n en vivo (3), Piloto (5), Top Bar (1) y Supradmin (2). "
    "Adicionalmente se corrigi\u00f3 un error de acceso RLS detectado en la sesi\u00f3n anterior.",
    sBody
))

# ── B) ESTADO ANTERIOR ──────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("B) Estado Anterior", sH1))
story.append(hr())
story.append(tbl(
    ["\u00c1rea", "Funcionalidad", "Estado anterior"],
    [
        ["Estudiantes", "Bloc de notas en chat", "No exist\u00eda"],
        ["Estudiantes", "Autorreflexi\u00f3n layout", "Scroll vertical, max-w-2xl"],
        ["Estudiantes", "Dashboard checklist", "Sistema de XP y niveles"],
        ["Estudiantes", "Flashcards legibilidad", "aspect-square, texto truncado"],
        ["Observaci\u00f3n", "Walkie-talkie", "M\u00f3dulo no exist\u00eda"],
        ["Observaci\u00f3n", "An\u00e1lisis sem\u00e1ntico", "No exist\u00eda"],
        ["Observaci\u00f3n", "Historial diferenciado", "Solo sesiones de chat"],
        ["Piloto", "Logo roto en correos", "URL incorrecta (bucket patients)"],
        ["Piloto", "Asignaci\u00f3n de pacientes", "Sin asignaci\u00f3n al crear piloto"],
        ["Piloto", "Rango fecha/hora", "Solo scheduled_at b\u00e1sico"],
        ["Piloto", "Notificar desactivaci\u00f3n", "No inclu\u00eddo en email"],
        ["Piloto", "Encuesta de cierre", "Sistema encuestas separado"],
        ["Top Bar", "Hover en \u00edconos", "Hover sutil (white/10)"],
        ["Supradmin", "Presencia en tiempo real", "Solo last_active_at en pilotos"],
        ["Supradmin", "Animaci\u00f3n en vivo", "No exist\u00eda"],
    ],
    [25*mm, 55*mm, 86*mm]
))

# ── C) CAMBIOS REALIZADOS ───────────────────────────────────────────────
story.append(PageBreak())
story.append(Paragraph("C) Cambios Realizados y Verificaci\u00f3n", sH1))
story.append(hr())

# 1. Estudiantes
story.append(Paragraph("C.1) \u00c1rea: Estudiantes", sH2))

story.append(Paragraph("<b>C.1.1 \u2014 Bloc de notas en el chat</b>", sBody))
story.append(Paragraph(
    "Se agreg\u00f3 un panel deslizable desde la derecha del chat que permite tomar notas "
    "durante la sesi\u00f3n. Incluye: escritura de texto, dictado por voz (SpeechRecognition API), "
    "autocorrecci\u00f3n de texto (bot\u00f3n Abc), auto-guardado cada 2 segundos, y carga de notas "
    "existentes desde student_notes_v2.",
    sBullet
))
story.append(Paragraph(
    "Archivos: ChatInterface.tsx (+80 l\u00edneas), API sessions/[id]/notes (existente).",
    sBodyI
))
story.append(Paragraph("<b>Verificaci\u00f3n:</b> Build exitoso. Bot\u00f3n \u201cNotas\u201d visible en header del chat.", sBody))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.1.2 \u2014 Autorreflexi\u00f3n sin scroll</b>", sBody))
story.append(Paragraph(
    "Se ampli\u00f3 el contenedor de max-w-2xl a max-w-5xl. Las 5 tarjetas de reflexi\u00f3n "
    "ahora se muestran en grilla responsiva (grid-cols-1 \u2192 sm:grid-cols-2 \u2192 xl:grid-cols-5) "
    "ocupando el ancho completo. Textareas aumentados de 3 a 5 filas.",
    sBullet
))
story.append(Paragraph("<b>Verificaci\u00f3n:</b> En pantalla XL las 5 tarjetas se ven en una fila horizontal.", sBody))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.1.3 \u2014 Dashboard: XP reemplazado por checklist</b>", sBody))
story.append(Paragraph(
    "Se reemplaz\u00f3 la barra de progreso XP y nombre de nivel por una mini checklist de 4 hitos: "
    "Sesi\u00f3n con tutor gu\u00eda, Nano cursos (N/12), Primera sesi\u00f3n, 4ta sesi\u00f3n. "
    "Cada hito muestra c\u00edrculo verde con check cuando se completa.",
    sBullet
))
story.append(Paragraph("<b>Verificaci\u00f3n:</b> Dashboard muestra checklist en lugar de XP.", sBody))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.1.4 \u2014 Flashcards de pacientes ampliados</b>", sBody))
story.append(Paragraph(
    "Se cambi\u00f3 aspect-square a aspect-[4/5] para dar m\u00e1s espacio vertical. "
    "Texto de nombre cambiado a font-bold sin truncate, subt\u00edtulo a text-xs sin truncate.",
    sBullet
))
story.append(Paragraph("<b>Verificaci\u00f3n:</b> Tarjetas m\u00e1s altas con texto completamente visible.", sBody))

# 2. Observación
story.append(Spacer(1, 4*mm))
story.append(Paragraph("C.2) \u00c1rea: Observaci\u00f3n en Vivo (M\u00f3dulo nuevo)", sH2))

story.append(Paragraph("<b>C.2.1 \u2014 Modo walkie-talkie</b>", sBody))
story.append(Paragraph(
    "Se cre\u00f3 un m\u00f3dulo completo de observaci\u00f3n en vivo con interfaz walkie-talkie. "
    "La barra espaciadora inicia/detiene la grabaci\u00f3n y alterna entre observador y paciente. "
    "Incluye indicador visual pulsante, temporizador de sesi\u00f3n y segmento, y lista de segmentos grabados.",
    sBullet
))
story.append(Paragraph(
    "Archivos nuevos: observacion/page.tsx, ObservacionClient.tsx, 3 API routes, "
    "migraci\u00f3n observation_sessions.sql (2 tablas + RLS).",
    sBodyI
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.2.2 \u2014 An\u00e1lisis sem\u00e1ntico</b>", sBody))
story.append(Paragraph(
    "Al finalizar la sesi\u00f3n, el audio se transcribe v\u00eda Whisper (OpenAI) y se presenta "
    "en una p\u00e1gina de revisi\u00f3n con transcripci\u00f3n por segmento (observador/paciente) "
    "y panel de an\u00e1lisis sem\u00e1ntico.",
    sBullet
))
story.append(Paragraph(
    "Archivos: observacion/review/[sessionId]/page.tsx, ObservacionReviewClient.tsx.",
    sBodyI
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.2.3 \u2014 Historial diferenciado</b>", sBody))
story.append(Paragraph(
    "Las sesiones de observaci\u00f3n aparecen en el historial con \u00edcono Radio y estilo distinto "
    "(borde indigo). Se agreg\u00f3 filtro \u201cObservaciones\u201d al dropdown de estado.",
    sBullet
))
story.append(Paragraph("<b>Verificaci\u00f3n:</b> Build exitoso, rutas /observacion y /observacion/review/[id] generadas.", sBody))

# 3. Piloto
story.append(Spacer(1, 4*mm))
story.append(Paragraph("C.3) \u00c1rea: Piloto", sH2))

story.append(Paragraph("<b>C.3.1 \u2014 Logo corregido en correos</b>", sBody))
story.append(Paragraph(
    "URL del logo cambiada de bucket patients a bucket branding: "
    "branding/gloria-logo-email.png. Se agregaron atributos width, height y style para "
    "compatibilidad con clientes de correo.",
    sBullet
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.3.2 \u2014 Asignaci\u00f3n de pacientes al crear piloto</b>", sBody))
story.append(Paragraph(
    "Se agreg\u00f3 secci\u00f3n \u201cPacientes del piloto\u201d en Step3Preview con botones para "
    "asignar pacientes por grupo: Todos, por pa\u00eds (6), por nivel (3). "
    "Nuevo endpoint GET /api/admin/patients/all con filtros ?country= y ?difficulty=.",
    sBullet
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.3.3 \u2014 Rango de fecha/hora + desactivar</b>", sBody))
story.append(Paragraph(
    "Se agregaron campos datetime-local para inicio y fin de acceso en Step1Upload. "
    "Bot\u00f3n \u201cDesactivar piloto\u201d en Step4Dashboard que cambia status a cancelado.",
    sBullet
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.3.4 \u2014 Notificar desactivaci\u00f3n en correo</b>", sBody))
story.append(Paragraph(
    "Se agreg\u00f3 callout \u00e1mbar en el template HTML del email de invitaci\u00f3n mostrando "
    "la fecha de desactivaci\u00f3n cuando pilot.ended_at est\u00e1 definido.",
    sBullet
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.3.5 \u2014 Encuesta de cierre</b>", sBody))
story.append(Paragraph(
    "Se agreg\u00f3 tarjeta \u201cEncuesta de cierre\u201d en Step4Dashboard con bot\u00f3n para crear "
    "encuesta NPS + 2 preguntas abiertas (fortalezas y debilidades) scope:establishment.",
    sBullet
))

# 4. Top Bar
story.append(Spacer(1, 4*mm))
story.append(Paragraph("C.4) \u00c1rea: Top Bar", sH2))
story.append(Paragraph(
    "Se mejoraron los hover states de los 3 botones del header: notificaciones, soporte y perfil. "
    "Se agreg\u00f3 cursor-pointer, hover:scale-105, hover:bg-white/15, y "
    "group-hover:text-white en el nombre del usuario.",
    sBullet
))

# 5. Supradmin
story.append(Spacer(1, 4*mm))
story.append(Paragraph("C.5) \u00c1rea: Supradmin", sH2))

story.append(Paragraph("<b>C.5.1 \u2014 Presencia en tiempo real</b>", sBody))
story.append(Paragraph(
    "Se agreg\u00f3 columna last_seen_at a profiles (migraci\u00f3n presence_tracking.sql). "
    "PlatformActivityTracker env\u00eda heartbeat cada 60s a POST /api/presence. "
    "Panel \u201cUsuarios conectados\u201d en LiveMetrics muestra estudiantes online (last_seen_at < 2 min) "
    "con dot verde pulsante y badge de rol.",
    sBullet
))

story.append(Spacer(1, 2*mm))
story.append(Paragraph("<b>C.5.2 \u2014 Animaci\u00f3n bot\u00f3n en vivo</b>", sBody))
story.append(Paragraph(
    "El indicador de presencia incluye un punto verde con animate-pulse (CSS) que simula "
    "un bot\u00f3n que prende y apaga. Se muestra junto a cada usuario conectado en el panel de m\u00e9tricas.",
    sBullet
))

# ── D) RESUMEN ───────────────────────────────────────────────────────────
story.append(PageBreak())
story.append(Paragraph("D) Resumen Ejecutivo", sH1))
story.append(hr())

story.append(tbl(
    ["Indicador", "Valor"],
    [
        ["Total funcionalidades implementadas", "16 de 16"],
        ["Archivos nuevos creados", "12 (p\u00e1ginas, API routes, migraciones)"],
        ["Archivos modificados", "11"],
        ["Migraciones SQL aplicadas", "2 (presence_tracking, observation_sessions)"],
        ["Tablas nuevas", "2 (observation_sessions, observation_segments)"],
        ["Rutas nuevas", "/observacion, /observacion/review/[id], /api/presence, /api/observation/*, /api/admin/patients/all"],
        ["Build", "Exitoso \u2014 0 errores TypeScript"],
    ],
    [55*mm, 111*mm]
))

story.append(Spacer(1, 6*mm))
story.append(Paragraph("<b>Detalle por \u00e1rea:</b>", sH2))
story.append(tbl(
    ["\u00c1rea", "Items", "Estado"],
    [
        ["Estudiantes", "4/4", "Completado"],
        ["Observaci\u00f3n en vivo", "3/3", "Completado (m\u00f3dulo nuevo)"],
        ["Piloto", "5/5", "Completado"],
        ["Top Bar", "1/1", "Completado"],
        ["Supradmin", "2/2", "Completado"],
        ["Correcci\u00f3n RLS (sesi\u00f3n anterior)", "1/1", "Completado y desplegado"],
    ],
    [40*mm, 20*mm, 106*mm]
))

# ── Firma ────────────────────────────────────────────────────────────────
story.append(Spacer(1, 15*mm))
story.append(hr())
story.append(Paragraph(
    "<b>Elaborado por:</b> Claude (Asistente IA) \u2014 21 de marzo de 2026",
    ms("f1", "Calibri", 9, GREY, sb=4, sa=2)
))
story.append(Paragraph(
    "<b>Revisado por:</b> Tom\u00e1s (Supradmin GlorIA)",
    ms("f2", "Calibri", 9, GREY, sa=2)
))

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"PDF generado: {OUT_FILE}")
