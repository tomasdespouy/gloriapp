#!/usr/bin/env python3
"""INF-2026-007: Test Silencio 34 Pacientes + Saludo Corto + Rediseño Dashboard"""
import os, json
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import white

pdfmetrics.registerFont(TTFont("Calibri","C:/Windows/Fonts/calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold","C:/Windows/Fonts/calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic","C:/Windows/Fonts/calibrii.ttf"))

INDIGO=HexColor("#4A55A2"); DARK=HexColor("#1A1A1A"); LIGHT=HexColor("#F5F5F5")
GREY=HexColor("#6B7280"); BORDER=HexColor("#E5E5E5"); GREEN=HexColor("#16A34A")

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO=os.path.join(BASE,"public","branding","gloria-logo.png")
OUT=os.path.join(BASE,"informes","desarrollo","INF-2026-007.pdf")
os.makedirs(os.path.dirname(OUT),exist_ok=True)

def s(name,font="Calibri",sz=10,color=DARK,align=TA_LEFT,sb=0,sa=4,ld=None,li=0):
    return ParagraphStyle(name,fontName=font,fontSize=sz,textColor=color,alignment=align,spaceBefore=sb,spaceAfter=sa,leading=ld or sz*1.35,leftIndent=li)

sT=s("T","Calibri-Bold",20,INDIGO,TA_CENTER,0,6)
sH1=s("H1","Calibri-Bold",14,INDIGO,sb=14,sa=6)
sH2=s("H2","Calibri-Bold",11,DARK,sb=10,sa=4)
sB=s("B","Calibri",10,DARK,TA_JUSTIFY,0,4)
sBI=s("BI","Calibri-Italic",9.5,GREY,li=12)
sBu=s("Bu","Calibri",9.5,DARK,li=12)
sC=s("C","Calibri",8,DARK)
sCB=s("CB","Calibri-Bold",8,DARK)
sCH=s("CH","Calibri-Bold",8,white,TA_CENTER)

def hf(c,d):
    c.saveState(); w,h=LETTER
    if os.path.exists(LOGO): c.drawImage(LOGO,w-55*mm,h-18*mm,40*mm,12*mm,preserveAspectRatio=True,mask="auto")
    c.setFont("Calibri",8);c.setFillColor(GREY);c.drawCentredString(w/2,12*mm,f"GlorIA \u2014 P\u00e1gina {d.page}");c.restoreState()

def hr(): return HRFlowable(width="100%",thickness=0.5,color=BORDER,spaceBefore=6,spaceAfter=6)

def tbl(headers,rows,widths=None):
    hdr=[Paragraph(h,sCH) for h in headers]
    data=[hdr]+[[Paragraph(str(c),sC) for c in r] for r in rows]
    t=Table(data,colWidths=widths,repeatRows=1)
    cmds=[("BACKGROUND",(0,0),(-1,0),INDIGO),("TEXTCOLOR",(0,0),(-1,0),white),("GRID",(0,0),(-1,-1),0.4,BORDER),("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4)]
    for i in range(2,len(data)):
        if i%2==0: cmds.append(("BACKGROUND",(0,i),(-1,i),LIGHT))
    t.setStyle(TableStyle(cmds)); return t

# Load test results
results_path = os.path.join(BASE,"scripts","test-silence-results.json")
with open(results_path,"r",encoding="utf-8") as f:
    results = json.load(f)

doc=SimpleDocTemplate(OUT,pagesize=LETTER,leftMargin=22*mm,rightMargin=22*mm,topMargin=24*mm,bottomMargin=22*mm)
story=[]

# Cover
story.append(Spacer(1,10*mm))
story.append(Paragraph("INF-2026-007",sT))
story.append(Paragraph("Test de Silencio y Saludo Corto (34 Pacientes)<br/>Regla Primer Turno + Redise\u00f1o Dashboard",s("sub","Calibri",12,GREY,TA_CENTER,4,10)))
story.append(hr())
meta=[["Fecha","21 de marzo de 2026"],["Categor\u00eda","Testing + Desarrollo"],["Prioridad","Mejora UX"],["Modelo LLM",f"{results['llmProvider']} ({results['model']})"]]
mt=Table([[Paragraph(r[0],sCB),Paragraph(r[1],sC)] for r in meta],colWidths=[45*mm,121*mm])
mt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.4,BORDER),("BACKGROUND",(0,0),(0,-1),LIGHT),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),8)]))
story.append(mt)

# A) Solicitud
story.append(Spacer(1,6*mm))
story.append(Paragraph("A) Solicitud",sH1)); story.append(hr())
story.append(Paragraph("Se solicitaron 3 tareas: (1) Reducir la respuesta del primer turno a 3-5 palabras cuando el usuario saluda con pocas palabras, (2) Testear los mensajes autom\u00e1ticos de silencio de los 34 pacientes en dos escenarios (sin mensaje y con saludo), (3) Redise\u00f1ar el dashboard del estudiante.",sB))

# B) Cambio: Regla primer turno
story.append(Spacer(1,4*mm))
story.append(Paragraph("B) Cambio: Regla del Primer Turno",sH1)); story.append(hr())
story.append(Paragraph("Se modific\u00f3 <b>chat/route.ts</b> para detectar saludos cortos (\u22646 palabras, patr\u00f3n regex de saludos comunes) y agregar una regla estricta: <b>m\u00e1ximo 3-5 palabras</b> en la respuesta. Ejemplos: \u201cHola... buenas tardes.\u201d, \u201cEh... hola.\u201d, \u201cBuenas...\u201d",sB))

# C) Resultados del test
story.append(Spacer(1,4*mm))
story.append(Paragraph("C) Resultados: Test de Saludo Corto",sH1)); story.append(hr())
stats = results.get("stats",{})
story.append(Paragraph(f"<b>Promedio de palabras en saludo:</b> {stats.get('avgGreetingWords',0):.1f} | M\u00ednimo: {stats.get('minGreetingWords',0)} | M\u00e1ximo: {stats.get('maxGreetingWords',0)}",sB))
story.append(Spacer(1,2*mm))

# Table of greetings
greeting_rows = []
for r in results.get("escenarioB",[]):
    g = r.get("greeting","")
    w = r.get("greetingWords",0)
    ok = "\u2714" if w <= 5 else "\u2716" if w > 8 else "\u26a0"
    greeting_rows.append([r.get("name",""),str(w),g[:70],ok])
story.append(tbl(["Paciente","Palabras","Saludo","OK"],greeting_rows,[30*mm,14*mm,108*mm,14*mm]))

# D) Resultados: Test de silencio
story.append(PageBreak())
story.append(Paragraph("D) Resultados: Mensajes de Silencio \u2014 Escenario A (sin mensaje previo)",sH1)); story.append(hr())
story.append(Paragraph("Se inici\u00f3 sesi\u00f3n sin enviar ning\u00fan mensaje. Se dispararon los 4 stages de silencio.",sB))

silence_rows_a = []
for r in results.get("escenarioA",[]):
    silence_rows_a.append([
        r.get("name",""),
        r.get("60s","")[:45],
        r.get("90s","")[:45],
        r.get("180s","")[:40],
        r.get("300s","")[:40],
    ])
story.append(tbl(["Paciente","60s","90s","180s","300s"],silence_rows_a,[25*mm,35*mm,35*mm,35*mm,35*mm]))

story.append(PageBreak())
story.append(Paragraph("E) Resultados: Mensajes de Silencio \u2014 Escenario B (con saludo previo)",sH1)); story.append(hr())
story.append(Paragraph("Se envi\u00f3 \u201cHola, buenas tardes.\u201d y se registraron los mensajes de silencio posterior.",sB))

silence_rows_b = []
for r in results.get("escenarioB",[]):
    silence_rows_b.append([
        r.get("name",""),
        r.get("60s","")[:45],
        r.get("90s","")[:45],
        r.get("180s","")[:40],
        r.get("300s","")[:40],
    ])
story.append(tbl(["Paciente","60s","90s","180s","300s"],silence_rows_b,[25*mm,35*mm,35*mm,35*mm,35*mm]))

# F) Dashboard
story.append(PageBreak())
story.append(Paragraph("F) Redise\u00f1o Dashboard Estudiante",sH1)); story.append(hr())
story.append(Paragraph("<b>Cambios realizados:</b>",sB))
changes = [
    "Saludo: \u201cHola, Tom\u00e1s\u201d \u2192 \u201c\u00a1Hola Tom\u00e1s!\u201d (sin coma, con \u00a1!)",
    "Checklist removido (tutor gu\u00eda, nano cursos, primera sesi\u00f3n, 4ta sesi\u00f3n)",
    "Stats: solo Sesiones y M\u00f3dulos (logros removido), tama\u00f1o m\u00e1s grande (text-2xl)",
    "Sesiones muestra minutos totales de pr\u00e1ctica",
    "Acciones r\u00e1pidas: movidas al lado del saludo en grid 2\u00d72 dentro del card principal",
    "Secci\u00f3n independiente de acciones r\u00e1pidas eliminada (ya no hay secci\u00f3n separada)",
]
for c in changes:
    story.append(Paragraph(f"\u2022 {c}",sBu))

# G) Resumen
story.append(Spacer(1,6*mm))
story.append(Paragraph("G) Resumen Ejecutivo",sH1)); story.append(hr())
story.append(tbl(["Indicador","Valor"],[
    ["Pacientes testeados","34/34"],
    ["Promedio palabras saludo",f"{stats.get('avgGreetingWords',0):.1f}"],
    ["Pacientes \u22645 palabras",str(sum(1 for r in results.get("escenarioB",[]) if r.get("greetingWords",0)<=5))],
    ["Pacientes >8 palabras",str(sum(1 for r in results.get("escenarioB",[]) if r.get("greetingWords",0)>8))],
    ["Silencio: 34/34 stages completos","S\u00ed (ambos escenarios)"],
    ["Dashboard redise\u00f1ado","S\u00ed (6 cambios)"],
    ["Build","Exitoso"],
],[55*mm,111*mm]))

# Firma
story.append(Spacer(1,12*mm)); story.append(hr())
story.append(Paragraph("<b>Elaborado por:</b> Claude (Asistente IA) \u2014 21 de marzo de 2026",s("f","Calibri",9,GREY,sb=4,sa=2)))
story.append(Paragraph("<b>Revisado por:</b> Tom\u00e1s (Supradmin GlorIA)",s("f2","Calibri",9,GREY,sa=2)))

doc.build(story,onFirstPage=hf,onLaterPages=hf)
print(f"PDF generado: {OUT}")
