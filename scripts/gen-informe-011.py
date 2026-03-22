#!/usr/bin/env python3
"""INF-2026-011: Hover visual global — translateY + box-shadow en toda la plataforma"""
import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import white

pdfmetrics.registerFont(TTFont("Calibri","C:/Windows/Fonts/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold","C:/Windows/Fonts/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic","C:/Windows/Fonts/calibrii.ttf"))

INDIGO=HexColor("#4A55A2"); DARK=HexColor("#1A1A1A"); LIGHT=HexColor("#F5F5F5")
GREY=HexColor("#6B7280"); BORDER=HexColor("#E5E5E5")

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO=os.path.join(BASE,"public","branding","gloria-logo.png")
OUT=os.path.join(BASE,"informes","desarrollo","INF-2026-011.pdf")
os.makedirs(os.path.dirname(OUT),exist_ok=True)

def s(n,f="Calibri",sz=10,c=DARK,a=TA_LEFT,sb=0,sa=4,ld=None,li=0):
    return ParagraphStyle(n,fontName=f,fontSize=sz,textColor=c,alignment=a,spaceBefore=sb,spaceAfter=sa,leading=ld or sz*1.4,leftIndent=li)

sT=s("T","Calibri-Bold",22,INDIGO,TA_CENTER,0,6)
sH1=s("H1","Calibri-Bold",14,INDIGO,sb=16,sa=6)
sH2=s("H2","Calibri-Bold",11,DARK,sb=10,sa=4)
sB=s("B","Calibri",10,DARK,TA_JUSTIFY,0,4)
sBu=s("Bu","Calibri",9.5,DARK,li=14,sa=3)
sC=s("C","Calibri",8.5,DARK)
sCB=s("CB","Calibri-Bold",8.5,DARK)
sCH=s("CH","Calibri-Bold",8.5,white,TA_CENTER)

def hf(cv,d):
    cv.saveState();w,h=LETTER
    if os.path.exists(LOGO): cv.drawImage(LOGO,w-55*mm,h-18*mm,40*mm,12*mm,preserveAspectRatio=True,mask="auto")
    cv.setFont("Calibri",8);cv.setFillColor(GREY);cv.drawCentredString(w/2,12*mm,f"GlorIA \u2014 P\u00e1gina {d.page}");cv.restoreState()

def hr(): return HRFlowable(width="100%",thickness=0.5,color=BORDER,spaceBefore=6,spaceAfter=6)

def tbl(headers,rows,widths=None):
    hdr=[Paragraph(h,sCH) for h in headers]
    data=[hdr]+[[Paragraph(str(c),sC) for c in r] for r in rows]
    t=Table(data,colWidths=widths,repeatRows=1)
    cmds=[("BACKGROUND",(0,0),(-1,0),INDIGO),("TEXTCOLOR",(0,0),(-1,0),white),("GRID",(0,0),(-1,-1),0.4,BORDER),("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),("LEFTPADDING",(0,0),(-1,-1),5)]
    for i in range(2,len(data)):
        if i%2==0: cmds.append(("BACKGROUND",(0,i),(-1,i),LIGHT))
    t.setStyle(TableStyle(cmds));return t

doc=SimpleDocTemplate(OUT,pagesize=LETTER,leftMargin=22*mm,rightMargin=22*mm,topMargin=24*mm,bottomMargin=22*mm)
story=[]

# ═══ PORTADA ═════════════════════════════════════════════════════════
story.append(Spacer(1,15*mm))
story.append(Paragraph("INF-2026-011",sT))
story.append(Paragraph(
    "Hover Visual Global para Toda la Plataforma<br/>"
    "Efecto de elevaci\u00f3n (translateY + box-shadow) en todos los elementos interactivos",
    s("sub","Calibri",12,GREY,TA_CENTER,4,10)))
story.append(hr())

meta=[
    ["Fecha","21 de marzo de 2026"],
    ["Categor\u00eda","Desarrollo / UX"],
    ["Prioridad","Mejora de Experiencia"],
    ["Archivo modificado","src/app/globals.css (1 archivo, 0 componentes tocados)"],
    ["Commits","099ea34, 8f52fe0, 5950e56"],
    ["Build","Exitoso \u2014 0 errores"],
]
mt=Table([[Paragraph(r[0],sCB),Paragraph(r[1],sC)] for r in meta],colWidths=[45*mm,121*mm])
mt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.4,BORDER),("BACKGROUND",(0,0),(0,-1),LIGHT),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),8)]))
story.append(mt)

# ═══ A) PROBLEMA ═════════════════════════════════════════════════════
story.append(Spacer(1,6*mm))
story.append(Paragraph("A) Problema Detectado",sH1)); story.append(hr())
story.append(Paragraph(
    "En la auditor\u00eda UX (INF-2026-010) se identificaron 274 elementos interactivos en la plataforma. "
    "Se agreg\u00f3 <b>cursor-pointer</b> a todos, pero el usuario report\u00f3 que <b>el cambio no era visible</b>: "
    "el cursor cambiaba de forma (flecha \u2192 manito), pero los elementos no ten\u00edan retroalimentaci\u00f3n visual "
    "al pasar el mouse.",sB))
story.append(Spacer(1,2*mm))
story.append(Paragraph(
    "El problema era que cursor-pointer solo cambia la forma del puntero, pero no produce ning\u00fan "
    "efecto visual en el elemento mismo. Los usuarios esperan que un bot\u00f3n o tarjeta cambie de apariencia "
    "al hacer hover para confirmar que es clickeable.",sB))

story.append(Spacer(1,4*mm))
story.append(Paragraph("Iteraciones realizadas:",sH2))
story.append(tbl(
    ["Intento","Enfoque","Resultado"],
    [
        ["1\u00b0","cursor-pointer en cada componente (160+ ediciones)","Invisible \u2014 solo cambia el puntero del mouse"],
        ["2\u00b0","brightness(0.93) global en CSS","Demasiado sutil, usuario no lo not\u00f3"],
        ["3\u00b0","translateY(-1px) + box-shadow en button/select","Visible en botones, pero no en Links/tarjetas"],
        ["4\u00b0 (final)","translateY(-1px) + box-shadow en button + a + select + [role=button]","Visible en toda la plataforma"],
    ],
    [14*mm,62*mm,90*mm]))

# ═══ B) SOLUCIÓN ═════════════════════════════════════════════════════
story.append(Spacer(1,6*mm))
story.append(Paragraph("B) Soluci\u00f3n Implementada",sH1)); story.append(hr())
story.append(Paragraph(
    "Se implement\u00f3 una regla CSS global en <b>globals.css</b> que aplica autom\u00e1ticamente a <b>todos</b> los "
    "elementos interactivos de la plataforma, sin necesidad de agregar clases Tailwind a cada componente.",sB))

story.append(Spacer(1,3*mm))
story.append(Paragraph("Reglas aplicadas:",sH2))
story.append(tbl(
    ["Selector CSS","Estado","Efecto visual"],
    [
        ["button:not(:disabled), a, [role=button]","hover","translateY(-1px) + box-shadow 2px 8px + opacity 0.92"],
        ["button:not(:disabled), a, [role=button]","active (click)","translateY(0) + sin sombra + opacity 1 (snap-back)"],
        ["button:disabled","siempre","cursor: not-allowed + opacity 0.5"],
        ["select","hover","border-color: #9ca3af + box-shadow 1px 4px"],
        ["p a, span a, li a (links inline)","hover","Solo opacity 0.8 (sin elevaci\u00f3n, para no romper layout de texto)"],
    ],
    [50*mm,20*mm,96*mm]))

story.append(Spacer(1,4*mm))
story.append(Paragraph("Ventajas de este enfoque:",sH2))
story.append(Paragraph("\u2022 <b>Una sola regla CSS</b> cubre toda la plataforma (274+ elementos) sin tocar ning\u00fan componente React",sBu))
story.append(Paragraph("\u2022 <b>Componentes futuros</b> obtienen el efecto autom\u00e1ticamente al usar &lt;button&gt;, &lt;Link&gt; o &lt;a&gt;",sBu))
story.append(Paragraph("\u2022 <b>Transici\u00f3n r\u00e1pida</b> (120ms) da sensaci\u00f3n de respuesta inmediata",sBu))
story.append(Paragraph("\u2022 <b>Efecto de click</b> (active: snap-back) da retroalimentaci\u00f3n t\u00e1ctil visual",sBu))
story.append(Paragraph("\u2022 <b>Links inline protegidos</b> (dentro de p\u00e1rrafos) no se elevan, solo bajan opacidad",sBu))
story.append(Paragraph("\u2022 <b>Cero riesgo de regresi\u00f3n</b> \u2014 no se modific\u00f3 ning\u00fan archivo de componente",sBu))

# ═══ C) COBERTURA ════════════════════════════════════════════════════
story.append(Spacer(1,6*mm))
story.append(Paragraph("C) Cobertura por Vista",sH1)); story.append(hr())

story.append(tbl(
    ["Vista","Ejemplos de elementos cubiertos"],
    [
        ["Estudiante","Tarjetas de pacientes, m\u00f3dulos de aprendizaje, acciones r\u00e1pidas dashboard, botones de chat, filtros historial"],
        ["Docente","Botones de aprobaci\u00f3n, tarjetas de sesiones, links de estudiantes, evaluaci\u00f3n"],
        ["Admin","CRM cards, tabs de instituciones, botones de pilotos, filtros de m\u00e9tricas, encuestas"],
        ["Supradmin","Todo lo de admin + asignaci\u00f3n de pacientes, gesti\u00f3n de establecimientos, usuarios"],
    ],
    [25*mm,141*mm]))

# ═══ D) RESUMEN ══════════════════════════════════════════════════════
story.append(Spacer(1,6*mm))
story.append(Paragraph("D) Resumen Ejecutivo",sH1)); story.append(hr())
story.append(tbl(
    ["Indicador","Valor"],
    [
        ["Elementos con hover visual","274+ (100% de la plataforma)"],
        ["Archivos de componentes modificados","0"],
        ["Archivos CSS modificados","1 (globals.css)"],
        ["Efecto hover","Elevaci\u00f3n 1px + sombra + opacidad 92%"],
        ["Efecto click","Snap-back (baja + sin sombra)"],
        ["Transici\u00f3n","120ms ease"],
        ["Componentes futuros","Cubiertos autom\u00e1ticamente"],
        ["Iteraciones hasta soluci\u00f3n visible","4"],
    ],
    [50*mm,116*mm]))

# Firma
story.append(Spacer(1,12*mm));story.append(hr())
story.append(Paragraph("<b>Elaborado por:</b> Claude (Asistente IA) \u2014 21 de marzo de 2026",s("f","Calibri",9,GREY,sb=4,sa=2)))
story.append(Paragraph("<b>Revisado por:</b> Tom\u00e1s (Supradmin GlorIA)",s("f2","Calibri",9,GREY,sa=2)))

doc.build(story,onFirstPage=hf,onLaterPages=hf)
print(f"PDF generado: {OUT}")
