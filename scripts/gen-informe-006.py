#!/usr/bin/env python3
"""
Genera INF-2026-006: Correcciones UX Chat y Reflexión + Extracción SessionTimer
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

INDIGO  = HexColor("#4A55A2")
DARK    = HexColor("#1A1A1A")
LIGHT   = HexColor("#F5F5F5")
GREEN   = HexColor("#16A34A")
AMBER   = HexColor("#D97706")
GREY    = HexColor("#6B7280")
BORDER  = HexColor("#E5E5E5")

BASE     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO     = os.path.join(BASE, "public", "branding", "gloria-logo.png")
OUT_DIR  = os.path.join(BASE, "informes", "desarrollo")
OUT_FILE = os.path.join(OUT_DIR, "INF-2026-006.pdf")
os.makedirs(OUT_DIR, exist_ok=True)

def s(name, font="Calibri", sz=10, color=DARK, align=TA_LEFT, sb=0, sa=4, ld=None, li=0):
    return ParagraphStyle(name, fontName=font, fontSize=sz, textColor=color,
        alignment=align, spaceBefore=sb, spaceAfter=sa, leading=ld or sz*1.35, leftIndent=li)

sTitle = s("T","Calibri-Bold",20,INDIGO,TA_CENTER,0,6)
sH1    = s("H1","Calibri-Bold",14,INDIGO,sb=14,sa=6)
sH2    = s("H2","Calibri-Bold",11,DARK,sb=10,sa=4)
sBody  = s("B","Calibri",10,DARK,TA_JUSTIFY,0,4)
sBodyI = s("BI","Calibri-Italic",9.5,GREY,li=12)
sBul   = s("BU","Calibri",9.5,DARK,li=12)
sCell  = s("C","Calibri",8.5,DARK)
sCellB = s("CB","Calibri-Bold",8.5,DARK)
sCellH = s("CH","Calibri-Bold",8.5,white,TA_CENTER)

def hf(canvas, doc):
    canvas.saveState()
    w, h = LETTER
    if os.path.exists(LOGO):
        canvas.drawImage(LOGO, w-55*mm, h-18*mm, 40*mm, 12*mm, preserveAspectRatio=True, mask="auto")
    canvas.setFont("Calibri",8); canvas.setFillColor(GREY)
    canvas.drawCentredString(w/2, 12*mm, f"GlorIA \u2014 P\u00e1gina {doc.page}")
    canvas.restoreState()

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)

def tbl(headers, rows, widths=None):
    hdr = [Paragraph(h, sCellH) for h in headers]
    data = [hdr] + [[Paragraph(str(c), sCell) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    cmds = [
        ("BACKGROUND",(0,0),(-1,0),INDIGO), ("TEXTCOLOR",(0,0),(-1,0),white),
        ("GRID",(0,0),(-1,-1),0.4,BORDER), ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),5), ("RIGHTPADDING",(0,0),(-1,-1),5),
    ]
    for i in range(2,len(data)):
        if i%2==0: cmds.append(("BACKGROUND",(0,i),(-1,i),LIGHT))
    t.setStyle(TableStyle(cmds)); return t

doc = SimpleDocTemplate(OUT_FILE, pagesize=LETTER,
    leftMargin=22*mm, rightMargin=22*mm, topMargin=24*mm, bottomMargin=22*mm)
story = []

# ── Portada ──────────────────────────────────────────────────────────────
story.append(Spacer(1,10*mm))
story.append(Paragraph("INF-2026-006", sTitle))
story.append(Paragraph(
    "Correcciones UX en Chat y Reflexi\u00f3n Post-Sesi\u00f3n<br/>"
    "Correcci\u00f3n Gemini, Extracci\u00f3n SessionTimer y 11 Mejoras de Interfaz",
    s("sub","Calibri",12,GREY,TA_CENTER,4,10)
))
story.append(hr())

meta = [
    ["Fecha de elaboraci\u00f3n","21 de marzo de 2026"],
    ["Categor\u00eda","Desarrollo"],
    ["Prioridad","Correctivo + Mejora UX"],
    ["Elaborado por","Claude (Asistente IA) + Tom\u00e1s (Supradmin)"],
    ["Commits asociados","e89f8b9, 162a622, 354fb0d, 9e4b9df"],
]
mt = Table([[Paragraph(r[0],sCellB),Paragraph(r[1],sCell)] for r in meta], colWidths=[55*mm,110*mm])
mt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.4,BORDER),("BACKGROUND",(0,0),(0,-1),LIGHT),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),5),
    ("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),8)]))
story.append(mt)

# ══ A) SOLICITUD ═════════════════════════════════════════════════════════
story.append(Spacer(1,6*mm))
story.append(Paragraph("A) Registro de la Solicitud", sH1))
story.append(hr())
story.append(Paragraph(
    "Se reportaron 11 problemas y mejoras en la vista de estudiante, agrupados en: "
    "chat (modal finalizar sesi\u00f3n, timers de silencio, acentos), "
    "reflexi\u00f3n post-sesi\u00f3n (layout, botones, XP, notas, validaci\u00f3n), "
    "y un error cr\u00edtico de Gemini (\u201ccontents are required\u201d). "
    "Adicionalmente, se detect\u00f3 un problema recurrente: el timer de sesi\u00f3n se romp\u00eda "
    "cada vez que se editaba ChatInterface.tsx.",
    sBody
))

# ══ B) ESTADO ANTERIOR ══════════════════════════════════════════════════
story.append(Spacer(1,4*mm))
story.append(Paragraph("B) Estado Anterior", sH1))
story.append(hr())
story.append(tbl(
    ["#","Problema","Estado anterior"],
    [
        ["a","Modal finalizar sesi\u00f3n con caracteres rotos","Texto con escapes Unicode (\\u00f3n) visibles en pantalla"],
        ["b","Layout reflexi\u00f3n post-sesi\u00f3n","Grabador en card separada del t\u00edtulo, distinta altura"],
        ["c","Sin advertencia sobre IA","No hab\u00eda aviso de posibles imprecisiones en transcripciones"],
        ["d","Botones sin cursor-pointer","Sin cambio de cursor ni hover visible al pasar mouse"],
        ["e","XP ganados visibles","Sistema de XP/gamificaci\u00f3n mostrado en resultados"],
        ["f","Bot\u00f3n \u201cNueva sesi\u00f3n\u201d sin color","Bot\u00f3n gris, texto \u201cNueva sesi\u00f3n\u201d"],
        ["g","Sin notas en reflexi\u00f3n","No se pod\u00edan ver notas tomadas durante la sesi\u00f3n"],
        ["h","Bot\u00f3n \u201cContinuar sesi\u00f3n\u201d gris","Mismo estilo que texto com\u00fan, sin diferenciaci\u00f3n"],
        ["i","Timers de silencio no arrancaban al inicio","Solo se activaban tras enviar primer mensaje"],
        ["j","Bot\u00f3n \u201cOmitir\u201d visible","Permit\u00eda saltar reflexi\u00f3n sin fricci\u00f3n"],
        ["k","Reflexi\u00f3n vac\u00eda se enviaba directo","Sin confirmaci\u00f3n sobre importancia formativa"],
        ["--","Error Gemini \u201ccontents are required\u201d","Race condition: INSERT y SELECT en paralelo, primer mensaje sin historial"],
        ["--","Timer de sesi\u00f3n se romp\u00eda al editar chat","L\u00f3gica del timer inline en ChatInterface.tsx (1600+ l\u00edneas)"],
    ],
    [8*mm,52*mm,106*mm]
))

# ══ C) CAMBIOS REALIZADOS ═══════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("C) Cambios Realizados y Verificaci\u00f3n", sH1))
story.append(hr())

# Error Gemini
story.append(Paragraph("C.0) Correcci\u00f3n cr\u00edtica: Error Gemini", sH2))
story.append(Paragraph(
    "<b>Causa ra\u00edz:</b> En <font face='Calibri-Bold'>chat/route.ts</font>, el INSERT del mensaje del usuario "
    "y el SELECT del historial corr\u00edan en paralelo (Promise.all). En el primer mensaje de una conversaci\u00f3n nueva, "
    "el SELECT terminaba antes que el INSERT, devolviendo un array vac\u00edo. Gemini requiere al menos un item "
    "en <font face='Calibri-Bold'>contents</font> y lanzaba \u201ccontents are required\u201d.",
    sBody
))
story.append(Paragraph(
    "<b>Fix (2 capas):</b> (1) chat/route.ts: si el mensaje del usuario no aparece en el historial, "
    "se agrega manualmente. (2) ai.ts: guard en chatGemini y chatStreamGemini para nunca enviar contents vac\u00edo.",
    sBul
))
story.append(Paragraph("<b>Verificaci\u00f3n:</b> Primer mensaje de conversaci\u00f3n nueva funciona sin error.", sBody))

# 11 fixes UX
story.append(Spacer(1,4*mm))
story.append(Paragraph("C.1) 11 Correcciones UX (Chat + Reflexi\u00f3n)", sH2))

fixes = [
    ("a","Acentos en modal finalizar sesi\u00f3n",
     "Reemplazados 20+ escapes Unicode (\\u00f3, \\u00e1, etc.) por caracteres reales en todo ChatInterface.tsx. "
     "Ahora se lee \u201c\u00bfFinalizar sesi\u00f3n?\u201d correctamente."),
    ("b","Layout reflexi\u00f3n redise\u00f1ado",
     "Header \u201cReflexi\u00f3n post-sesi\u00f3n\u201d y bot\u00f3n de grabar fusionados en una sola tarjeta con flex. "
     "Bot\u00f3n de grabar ahora es \u00e1mbar (amber-500) a la misma altura del t\u00edtulo."),
    ("c","Advertencia IA en transcripciones",
     "A\u00f1adido texto: \u201cRevisar siempre las transcripciones, la IA puede generar imprecisiones.\u201d debajo del bot\u00f3n de grabar."),
    ("d","cursor-pointer en todos los botones",
     "Agregado cursor-pointer y hover:shadow-md a 13 botones en ReviewClient.tsx."),
    ("e","XP eliminados de resultados",
     "Removido el bloque de XP ganados de la vista \u201cpending\u201d y el card de XP/nivel de la vista \u201cresults\u201d."),
    ("f","Bot\u00f3n \u201cIr a Pacientes\u201d naranjo",
     "Cambiado de gris con borde a bg-amber-500 text-white font-semibold. Texto cambiado de \u201cNueva sesi\u00f3n\u201d a \u201cIr a Pacientes\u201d."),
    ("g","Notas de sesi\u00f3n en reflexi\u00f3n",
     "Agregado textarea \u201cMis notas de sesi\u00f3n\u201d entre las preguntas y el bot\u00f3n enviar."),
    ("h","Bot\u00f3n \u201cContinuar sesi\u00f3n\u201d verde",
     "Cambiado de text-gray-500 a bg-emerald-50 text-emerald-600 font-semibold."),
    ("i","Timers de silencio al iniciar sesi\u00f3n",
     "Nuevo useEffect que arranca silence timers cuando sessionStarted=true, no solo tras el primer mensaje enviado. "
     "Timers: 60s \u2192 saludo, 90s \u2192 \u00bfest\u00e1s?, 180s \u2192 aviso retiro, 300s \u2192 cierre."),
    ("j","Bot\u00f3n \u201cOmitir\u201d removido",
     "Eliminado de la vista de reflexi\u00f3n. La opci\u00f3n de omitir ahora solo aparece en el modal de confirmaci\u00f3n (fix k)."),
    ("k","Modal de reflexi\u00f3n vac\u00eda",
     "Si el estudiante intenta enviar sin escribir nada, aparece modal recordando la importancia formativa de la reflexi\u00f3n, "
     "con botones \u201cVolver a reflexi\u00f3n\u201d (primario) y \u201cOmitir\u201d (secundario)."),
]

for code, title, desc in fixes:
    story.append(Paragraph(f"<b>{code}) {title}</b>", sBody))
    story.append(Paragraph(desc, sBul))
    story.append(Spacer(1,1*mm))

# SessionTimer extraction
story.append(Spacer(1,4*mm))
story.append(Paragraph("C.2) Extracci\u00f3n de SessionTimer (prevenci\u00f3n de regresi\u00f3n)", sH2))
story.append(Paragraph(
    "<b>Problema recurrente:</b> El timer de sesi\u00f3n se romp\u00eda cada vez que se editaba ChatInterface.tsx "
    "(1600+ l\u00edneas). Cambios de layout, imports removidos o restructuraci\u00f3n del JSX afectaban "
    "accidentalmente la l\u00f3gica o visibilidad del timer.",
    sBody
))
story.append(Paragraph(
    "<b>Soluci\u00f3n arquitect\u00f3nica:</b> Se extrajo el timer a un componente aislado "
    "<font face='Calibri-Bold'>SessionTimer.tsx</font> con responsabilidades claras:",
    sBody
))
story.append(Paragraph("\u2022 Owns: setInterval, c\u00e1lculo wall-clock, persistencia a BD cada 15s, sendBeacon al desmontar", sBul))
story.append(Paragraph("\u2022 Owns: display span con flex-shrink-0 (no se colapsa visualmente)", sBul))
story.append(Paragraph("\u2022 Comunica: via callback onTick para sincronizar activeSecondsRef en ChatInterface", sBul))
story.append(Paragraph("\u2022 Regla: NO modificar SessionTimer.tsx al editar ChatInterface", sBul))
story.append(Paragraph(
    "<b>Verificaci\u00f3n:</b> Build exitoso. Timer funciona correctamente con panel de notas abierto/cerrado. "
    "Memoria de proyecto actualizada para prevenir regresiones futuras.",
    sBody
))

# ══ D) RESUMEN ═══════════════════════════════════════════════════════════
story.append(Spacer(1,6*mm))
story.append(Paragraph("D) Resumen Ejecutivo", sH1))
story.append(hr())
story.append(tbl(
    ["Indicador","Valor"],
    [
        ["Correcciones UX aplicadas","11"],
        ["Errores cr\u00edticos corregidos","1 (Gemini \u201ccontents are required\u201d)"],
        ["Componente extra\u00eddo","SessionTimer.tsx (prevenci\u00f3n de regresi\u00f3n)"],
        ["Archivos modificados","3 (ChatInterface.tsx, ReviewClient.tsx, ai.ts)"],
        ["Archivos nuevos","1 (SessionTimer.tsx)"],
        ["Commits","4 (e89f8b9, 162a622, 354fb0d, 9e4b9df)"],
        ["Build","Exitoso \u2014 0 errores TypeScript"],
    ],
    [55*mm,111*mm]
))

# Firma
story.append(Spacer(1,15*mm))
story.append(hr())
story.append(Paragraph("<b>Elaborado por:</b> Claude (Asistente IA) \u2014 21 de marzo de 2026",
    s("f1","Calibri",9,GREY,sb=4,sa=2)))
story.append(Paragraph("<b>Revisado por:</b> Tom\u00e1s (Supradmin GlorIA)",
    s("f2","Calibri",9,GREY,sa=2)))

doc.build(story, onFirstPage=hf, onLaterPages=hf)
print(f"PDF generado: {OUT_FILE}")
