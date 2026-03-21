#!/usr/bin/env python3
"""INF-2026-009: Investigación Sentiment Analysis + POC Resultados"""
import os
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
OUT=os.path.join(BASE,"informes","investigacion","INF-2026-009.pdf")
os.makedirs(os.path.dirname(OUT),exist_ok=True)

def s(n,f="Calibri",sz=10,c=DARK,a=TA_LEFT,sb=0,sa=4,ld=None,li=0):
    return ParagraphStyle(n,fontName=f,fontSize=sz,textColor=c,alignment=a,spaceBefore=sb,spaceAfter=sa,leading=ld or sz*1.4,leftIndent=li)

sT=s("T","Calibri-Bold",22,INDIGO,TA_CENTER,0,6)
sH1=s("H1","Calibri-Bold",14,INDIGO,sb=16,sa=6)
sH2=s("H2","Calibri-Bold",11,DARK,sb=10,sa=4)
sB=s("B","Calibri",10,DARK,TA_JUSTIFY,0,4)
sBI=s("BI","Calibri-Italic",9.5,GREY,li=12)
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
story.append(Paragraph("INF-2026-009",sT))
story.append(Spacer(1,3*mm))
story.append(Paragraph(
    "Investigaci\u00f3n: An\u00e1lisis de Sentimiento en Sesiones Terap\u00e9uticas<br/>"
    "Estado del Arte, Proof of Concept y Propuesta de Implementaci\u00f3n",
    s("sub","Calibri",13,GREY,TA_CENTER,4,10)))
story.append(Spacer(1,4*mm)); story.append(hr())

meta=[
    ["Fecha","21 de marzo de 2026"],
    ["Categor\u00eda","Investigaci\u00f3n"],
    ["Prioridad","Estrat\u00e9gica"],
    ["Fuentes consultadas","12 papers acad\u00e9micos + 6 plataformas comerciales"],
    ["POC desarrollado","gloria-sentiment-poc (proyecto separado, datos ficticios)"],
]
mt=Table([[Paragraph(r[0],sCB),Paragraph(r[1],sC)] for r in meta],colWidths=[50*mm,116*mm])
mt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.4,BORDER),("BACKGROUND",(0,0),(0,-1),LIGHT),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),8)]))
story.append(mt)

# ═══ 1. ESTADO DEL ARTE ════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("1. Estado del Arte: Sentiment Analysis en Psicoterapia",sH1)); story.append(hr())

story.append(Paragraph("1.1 An\u00e1lisis de texto en sesiones terap\u00e9uticas",sH2))
story.append(Paragraph(
    "La investigaci\u00f3n reciente (2024-2025) muestra avances significativos en el uso de NLP para "
    "analizar sesiones terap\u00e9uticas. Los principales hallazgos:",sB))

story.append(Paragraph("<b>nBERT (MDPI, 2025):</b> Modelo BERT fine-tuned con NRC Emotion Lexicon para reconocimiento "
    "de emociones en transcripciones de psicoterapia. Precisi\u00f3n promedio del 91.53% en clasificaci\u00f3n emocional, "
    "superando LSTM, CNN y DistilBERT. Entrenado con 2,021 transcripciones.",sBu))

story.append(Paragraph("<b>Framework multi-dimensional (arXiv, 2025):</b> Propone 42 features en 4 dominios para "
    "cuantificar calidad terap\u00e9utica: din\u00e1mica conversacional, similitud sem\u00e1ntica, clasificaci\u00f3n de "
    "sentimiento y detecci\u00f3n de preguntas. Demuestra que la calidad terap\u00e9utica es medible computacionalmente.",sBu))

story.append(Paragraph("<b>Validez del sentiment analysis en psicoterapia (Psychotherapy Research, 2024):</b> "
    "Estudio que valida que los sentimientos detectados por algoritmos transformer correlacionan significativamente "
    "con reportes de emociones del terapeuta y del paciente en la misma sesi\u00f3n. Los aumentos de sentimiento "
    "positivo a lo largo de la terapia predicen mejores resultados.",sBu))

story.append(Paragraph("<b>PsychEval (arXiv, 2026):</b> Benchmark multi-sesi\u00f3n que operacionaliza escalas validadas "
    "(SCL-90, WAI, HTAIS) en protocolos de evaluaci\u00f3n automatizada. Score CTRS de 9.19 y WAI de 7.26. "
    "Incluye 18 m\u00e9tricas espec\u00edficas para evaluar calidad del consejero.",sBu))

story.append(Spacer(1,3*mm))
story.append(Paragraph("1.2 An\u00e1lisis de audio y prosodia",sH2))

story.append(Paragraph("<b>Speech Emotion Recognition (PMC, 2025):</b> Revisi\u00f3n sistem\u00e1tica de reconocimiento "
    "de emociones en voz para salud mental. Las aplicaciones incluyen: detecci\u00f3n de riesgo suicida, "
    "depresi\u00f3n, y trastornos psic\u00f3ticos. CNNs logran ~67% de mejora en precisi\u00f3n con data augmentation.",sBu))

story.append(Paragraph("<b>Whisper + SER (HuggingFace, 2025):</b> Modelo Whisper Large V3 fine-tuned para "
    "reconocimiento de emociones en habla. 92% de precisi\u00f3n en 7 estados emocionales "
    "(neutral, feliz, triste, enojado, temeroso, sorprendido, disgustado). Entrenado en RAVDESS, SAVEE, TESS.",sBu))

story.append(Paragraph("<b>Hume AI (comercial):</b> API de emociones en voz con modelo Octave 2. "
    "Detecta 48 expresiones emocionales en audio. Pricing desde $3/mes (starter) hasta $500/mes (business). "
    "Multilingual con reducci\u00f3n de 50% en costos desde oct 2025.",sBu))

story.append(Paragraph("<b>Limitaciones cr\u00edticas:</b> La clasificaci\u00f3n de audio se degrada significativamente "
    "con ruido ambiente. Factores dependientes del hablante (acento, edad, estado de salud) afectan resultados. "
    "La precisi\u00f3n puede caer a la mitad con degradaci\u00f3n moderada de SNR.",sBu))

# ═══ 1.3 Medición de alianza terapéutica ═══
story.append(Spacer(1,3*mm))
story.append(Paragraph("1.3 Medici\u00f3n automatizada de alianza terap\u00e9utica",sH2))

story.append(Paragraph("<b>Framework multimodal (PMC, 2024):</b> Usa texto + audio + psicofisiolog\u00eda para examinar "
    "alianza y empat\u00eda. ML clasifica instancias de empat\u00eda del terapeuta basado en medidas validadas. "
    "Integra datos de sensores, audio y algoritmos de ML.",sBu))

story.append(Paragraph("<b>AI-Assisted Provider Platform (PMC, 2024):</b> Plataforma que sugiere respuestas "
    "emp\u00e1ticas al terapeuta. Resultados: reducci\u00f3n del 29.34% en tiempo de respuesta, triplicaci\u00f3n de "
    "la precisi\u00f3n emp\u00e1tica, y aumento de precisi\u00f3n en recomendaciones de objetivos terap\u00e9uticos.",sBu))

# ═══ 1.4 Herramientas para español ═══
story.append(Spacer(1,3*mm))
story.append(Paragraph("1.4 Herramientas disponibles para espa\u00f1ol",sH2))

story.append(tbl(
    ["Herramienta","Tipo","Espa\u00f1ol","Costo","Precisi\u00f3n"],
    [
        ["GPT-4o (JSON mode)","LLM general","Nativo","~$0.01/sesi\u00f3n","Alta (no validada)"],
        ["nBERT","BERT fine-tuned","V\u00eda traducci\u00f3n","Open source","91.53% (ingl\u00e9s)"],
        ["VADER-multi","Lexicon-based","S\u00ed (traducci\u00f3n)","Open source","Moderada"],
        ["sentiment-analysis-spanish","Modelo espa\u00f1ol","Nativo","Open source","Moderada"],
        ["Whisper + SER","Audio fine-tuned","Transcripci\u00f3n s\u00ed","Open source","92% (7 emociones)"],
        ["Hume AI","API comercial","S\u00ed","Desde $3/mes","Alta (48 emociones)"],
    ],
    [32*mm,25*mm,25*mm,25*mm,59*mm]))

# ═══ 2. POC RESULTADOS ═════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("2. Proof of Concept: Resultados",sH1)); story.append(hr())

story.append(Paragraph(
    "Se desarroll\u00f3 un prototipo separado (<b>gloria-sentiment-poc</b>) que analiza sesiones ficticias "
    "usando GPT-4o con JSON mode. El prototipo NO modifica el c\u00f3digo de GlorIA.",sB))

story.append(Paragraph("2.1 Escenarios testeados",sH2))
story.append(tbl(
    ["Escenario","Empat\u00eda (0-4)","P. Abiertas","P. Cerradas","Flags detectados"],
    [
        ["Buena empat\u00eda y escucha activa","4/4","1","0","Ninguno"],
        ["Consejos prematuros y juicios","1/4","0","1","judgment, premature_advice"],
        ["Pasiva, solo preguntas cerradas","1/4","0","5","Ninguno (falta de intervenci\u00f3n)"],
    ],
    [42*mm,22*mm,18*mm,18*mm,66*mm]))

story.append(Spacer(1,3*mm))
story.append(Paragraph("2.2 Capacidades demostradas",sH2))
story.append(Paragraph("\u2022 <b>An\u00e1lisis por mensaje:</b> sentimiento (positivo/negativo/neutro), score (-1 a 1), "
    "nivel de empat\u00eda (0-4), tipo de intervenci\u00f3n, flags de riesgo",sBu))
story.append(Paragraph("\u2022 <b>An\u00e1lisis de sesi\u00f3n:</b> empat\u00eda global, ratio preguntas abiertas/cerradas, "
    "distribuci\u00f3n de intervenciones, arco emocional, momentos cr\u00edticos, fortalezas y \u00e1reas de mejora",sBu))
story.append(Paragraph("\u2022 <b>An\u00e1lisis de audio:</b> sentimiento por segmento, estado emocional, "
    "estimaci\u00f3n de prosodia (ritmo, tono, pausas, muletillas)",sBu))
story.append(Paragraph("\u2022 <b>Discriminaci\u00f3n correcta:</b> El sistema diferenci\u00f3 claramente entre el estudiante "
    "emp\u00e1tico (4/4), el que da consejos prematuros (1/4 + flags) y el pasivo (1/4, 5 preguntas cerradas)",sBu))

story.append(Spacer(1,3*mm))
story.append(Paragraph("2.3 An\u00e1lisis de audio simulado",sH2))
story.append(tbl(
    ["Hablante","Sentimiento","Estado emocional","Tono estimado"],
    [
        ["Terapeuta","\u26aa Neutro","Curiosidad profesional","Calmado"],
        ["Paciente","\ud83d\udd34 Negativo","Angustia y frustraci\u00f3n","Emocional"],
        ["Terapeuta","\u26aa Neutro","Empat\u00eda profesional","C\u00e1lido"],
        ["Paciente","\ud83d\udd34 Negativo","Ansiedad y miedo","Tenso"],
    ],
    [22*mm,22*mm,60*mm,62*mm]))

# ═══ 3. PROPUESTA DE IMPLEMENTACIÓN ════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("3. Propuesta de Implementaci\u00f3n para GlorIA",sH1)); story.append(hr())

story.append(Paragraph("3.1 Arquitectura propuesta",sH2))
story.append(Paragraph(
    "La implementaci\u00f3n se propone en 3 fases, cada una independiente y desplegable por separado. "
    "Ninguna fase modifica la l\u00f3gica de chat existente \u2014 el an\u00e1lisis es post-hoc (despu\u00e9s de la sesi\u00f3n) "
    "o paralelo (en segundo plano, sin afectar la experiencia del estudiante).",sB))

story.append(Spacer(1,3*mm))
story.append(Paragraph("<b>Fase 1: An\u00e1lisis post-sesi\u00f3n (texto)</b>",sH2))
story.append(Paragraph("\u2022 Trigger: cuando una sesi\u00f3n se completa (status = completed)",sBu))
story.append(Paragraph("\u2022 Proceso: job as\u00edncrono que toma la transcripci\u00f3n y la analiza con GPT-4o JSON mode",sBu))
story.append(Paragraph("\u2022 Output: JSON guardado en nueva columna <b>sentiment_analysis</b> en tabla conversations",sBu))
story.append(Paragraph("\u2022 Visualizaci\u00f3n: nuevo tab en la p\u00e1gina de review del docente y del estudiante",sBu))
story.append(Paragraph("\u2022 Costo estimado: ~$0.01 por sesi\u00f3n (1 llamada GPT-4o)",sBu))
story.append(Paragraph("\u2022 Riesgo de regresi\u00f3n: <b>NULO</b> \u2014 no toca c\u00f3digo existente",sBu))

story.append(Spacer(1,3*mm))
story.append(Paragraph("<b>Fase 2: Dashboard de patrones ling\u00fc\u00edsticos</b>",sH2))
story.append(Paragraph("\u2022 Agrega una secci\u00f3n en /progreso del estudiante con gr\u00e1ficos de:",sBu))
story.append(Paragraph("  \u2013 Distribuci\u00f3n de tipos de intervenci\u00f3n (preguntas abiertas vs cerradas, reflejos, validaciones)",sBu))
story.append(Paragraph("  \u2013 Evoluci\u00f3n de empat\u00eda a trav\u00e9s de sesiones",sBu))
story.append(Paragraph("  \u2013 Flags recurrentes (ej: \u201c3 de tus \u00faltimas 5 sesiones tuvieron consejo prematuro\u201d)",sBu))
story.append(Paragraph("\u2022 Riesgo: <b>BAJO</b> \u2014 solo agrega vistas, no modifica flujo existente",sBu))

story.append(Spacer(1,3*mm))
story.append(Paragraph("<b>Fase 3: An\u00e1lisis de audio (observaci\u00f3n en vivo)</b>",sH2))
story.append(Paragraph("\u2022 Aplica al m\u00f3dulo de observaci\u00f3n (ya creado)",sBu))
story.append(Paragraph("\u2022 Pipeline: Whisper (transcripci\u00f3n, ya existe) \u2192 GPT-4o (an\u00e1lisis de sentimiento + prosodia estimada)",sBu))
story.append(Paragraph("\u2022 Futuro: integrar Hume AI o modelo Whisper fine-tuned para an\u00e1lisis de prosodia real (tono, velocidad, pausas) directamente desde el audio",sBu))
story.append(Paragraph("\u2022 Riesgo: <b>BAJO</b> \u2014 el m\u00f3dulo de observaci\u00f3n es nuevo y aislado",sBu))

# ═══ 3.2 Datos que se generarían ═══
story.append(Spacer(1,4*mm))
story.append(Paragraph("3.2 Datos generados por el an\u00e1lisis",sH2))
story.append(tbl(
    ["Dato","Tipo","Uso docente","Uso estudiante"],
    [
        ["Empat\u00eda por mensaje","Score 0-4","Ver d\u00f3nde falla empat\u00eda","Auto-consciencia"],
        ["Tipo de intervenci\u00f3n","Categor\u00eda","Evaluar t\u00e9cnica","Ver patrones propios"],
        ["Flags de riesgo","Lista","Alerta de pr\u00e1ctica da\u00f1ina","Aprendizaje correctivo"],
        ["Preguntas abiertas/cerradas","Ratio","Evaluar habilidad exploratoria","Meta personal"],
        ["Momentos cr\u00edticos","Timestamps","Supervisar puntos clave","Revisar d\u00f3nde mejorar"],
        ["Arco emocional","Descripci\u00f3n","Contexto de la sesi\u00f3n","Comprensi\u00f3n del proceso"],
    ],
    [35*mm,22*mm,48*mm,61*mm]))

# ═══ 3.3 Plan de integración segura ═══
story.append(Spacer(1,4*mm))
story.append(Paragraph("3.3 Plan de integraci\u00f3n segura (sin tocar c\u00f3digo existente)",sH2))
story.append(Paragraph(
    "Para proteger el c\u00f3digo actual, la integraci\u00f3n sigue estos principios:",sB))
story.append(Paragraph("\u2022 <b>Archivos nuevos, no ediciones:</b> Crear /api/analysis/*, /components/SentimentDashboard.tsx, "
    "migraci\u00f3n para columna sentiment_analysis. No editar ChatInterface.tsx, chat/route.ts, ni ReviewClient.tsx",sBu))
story.append(Paragraph("\u2022 <b>Job as\u00edncrono:</b> El an\u00e1lisis corre despu\u00e9s de la sesi\u00f3n (cron o webhook), "
    "no durante la conversaci\u00f3n. No afecta latencia del chat",sBu))
story.append(Paragraph("\u2022 <b>Feature flag:</b> Habilitar/deshabilitar por establecimiento. Si falla, se apaga sin afectar nada",sBu))
story.append(Paragraph("\u2022 <b>Testing previo:</b> Cada fase se prueba primero en el POC separado con datos ficticios",sBu))

# ═══ 4. REFERENCIAS ════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("4. Referencias Acad\u00e9micas y Comerciales",sH1)); story.append(hr())

refs = [
    "[1] nBERT: Harnessing NLP for Emotion Recognition in Psychotherapy. MDPI Information, 2025. mdpi.com/2078-2489/16/4/301",
    "[2] Exploring the validity of sentiment analysis in psychotherapy. Psychotherapy Research, 2024. doi: 10.1080/10503307.2024.2322522",
    "[3] Estimating Quality in Therapeutic Conversations: Multi-Dimensional NLP Framework. arXiv, 2025. arxiv.org/html/2505.06151v1",
    "[4] PsychEval: Multi-Session Benchmark for AI Psychological Counselor. arXiv, 2026. arxiv.org/html/2601.01802v3",
    "[5] Speech Emotion Recognition in Mental Health: Systematic Review. PMC, 2025. PMC12521853",
    "[6] AI-Powered Remote Therapy Platform with Real-Time Emotion Detection. TechRxiv, 2025.",
    "[7] Whisper Large V3 fine-tuned for SER. HuggingFace, 2025. huggingface.co/firdhokk/speech-emotion-recognition",
    "[8] Opening the Black Box of Family-Based Treatments: AI Framework for Therapeutic Alliance. PMC, 2024. PMC10845126",
    "[9] Bridging the Skills Gap: AI-Assisted Provider Platform for Empathetic Delivery. PMC, 2024. PMC10785887",
    "[10] Hume AI \u2014 Empathic Voice Interface (EVI 2). hume.ai, 2025.",
    "[11] Simulated patient systems powered by LLM agents. Nature Communications Medicine, 2025. doi: 10.1038/s43856-025-01283-x",
    "[12] ChatGPT Simulated Patient: Use in Clinical Training. Psicothema, 2024.",
]
for ref in refs:
    story.append(Paragraph(ref, s("ref","Calibri",8.5,GREY,TA_LEFT,1,2,li=8)))

# ═══ 5. RESUMEN ═══
story.append(Spacer(1,6*mm))
story.append(Paragraph("5. Resumen Ejecutivo",sH1)); story.append(hr())

story.append(tbl(["Indicador","Resultado"],[
    ["Papers revisados","12"],
    ["Plataformas comerciales analizadas","6 (Kognito, Shadow Health, Hume AI, Woebot, AIPatient, Wysa)"],
    ["POC desarrollado","gloria-sentiment-poc (proyecto separado)"],
    ["Precisi\u00f3n del POC","Discriminaci\u00f3n correcta en 3/3 escenarios"],
    ["Fases propuestas","3 (post-sesi\u00f3n \u2192 dashboard \u2192 audio)"],
    ["Impacto en c\u00f3digo existente","NULO (archivos nuevos, feature flag, job as\u00edncrono)"],
    ["Costo estimado Fase 1","~$0.01 por sesi\u00f3n"],
    ["Recomendaci\u00f3n","Implementar Fase 1 como piloto en 1 instituci\u00f3n"],
],[55*mm,111*mm]))

# Firma
story.append(Spacer(1,12*mm)); story.append(hr())
story.append(Paragraph("<b>Elaborado por:</b> Claude (Asistente IA) \u2014 21 de marzo de 2026",s("f","Calibri",9,GREY,sb=4,sa=2)))
story.append(Paragraph("<b>Revisado por:</b> Tom\u00e1s (Supradmin GlorIA)",s("f2","Calibri",9,GREY,sa=2)))

doc.build(story,onFirstPage=hf,onLaterPages=hf)
print(f"PDF generado: {OUT}")
