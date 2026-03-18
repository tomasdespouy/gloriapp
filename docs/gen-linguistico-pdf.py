"""
PDF: Identidad Lingüística de Pacientes IA — GlorIA
"""
import os
from reportlab.lib.pagesizes import landscape, letter
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
body_s = ParagraphStyle('B', fontSize=9.5, leading=14, textColor=DARK, fontName='Calibri', alignment=TA_JUSTIFY, spaceAfter=6)
caption_s = ParagraphStyle('C', fontSize=8, leading=10, textColor=GRAY, fontName='Calibri-Italic', alignment=TA_CENTER, spaceAfter=8)
blt_s = ParagraphStyle('Blt', fontSize=9.5, leading=14, textColor=DARK, fontName='Calibri', leftIndent=18, bulletIndent=6, spaceAfter=3)
th_s = ParagraphStyle('TH', fontSize=7, leading=9.5, textColor=WHITE, fontName='Calibri-Bold', alignment=TA_CENTER)
tc_s = ParagraphStyle('TC', fontSize=6.5, leading=9, textColor=DARK, fontName='Calibri')
tc_c = ParagraphStyle('TCC', fontSize=6.5, leading=9, textColor=DARK, fontName='Calibri', alignment=TA_CENTER)

B = chr(8226)

def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(h, th_s) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), tc_c) if i < 3 else Paragraph(str(c), tc_s) for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SIDEBAR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.4, HexColor("#E5E7EB")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
    ]))
    return t

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceBefore=6, spaceAfter=6)

PATIENTS = [
    ("Alejandro Vega", "México", 39, "Alto", "Formal ejecutivo, anglicismos de negocios. Tutea. Modismos: \"neta\", \"no mames\", \"está cabrón\". NO errores gramaticales."),
    ("Altagracia Marte", "Rep. Dominicana", 60, "Bajo", "Habla popular dominicana, elimina la \"s\" final (\"loh muchachoh\"). Refranes religiosos. Modismos: \"dique\", \"vaina\", \"ay bendito\". Errores: \"toy cansá\", \"pa' qué\"."),
    ("Andrés Castillo", "Colombia", 50, "Medio", "Paisa antioqueño, voseo parcial (\"vos sabés\"). Tono comercial amigable. Modismos: \"pues\", \"parce\", \"qué más\", \"echar pa'lante\". NO errores."),
    ("Camila Bertoni", "Argentina", 22, "Medio", "Porteña joven, voseo pleno (\"vos tenés\"). Lenguaje universitario. Modismos: \"tipo que\", \"re\", \"boluda\", \"posta\". NO errores."),
    ("Carlos Quispe", "Perú", 42, "Bajo", "Español limeño popular, tuteo, frases cortas. Modismos: \"pe\", \"causa\", \"ya fue\". Errores: \"haiga\" (haya), \"más mejor\"."),
    ("Carmen Torres", "Chile", 45, "Alto", "Español chileno formal, vocabulario ejecutivo amplio. Modismos: \"o sea\", \"mira\", \"cachai\" (solo en confianza). NO errores."),
    ("Catalina Ríos", "Perú", 38, "Alto", "Español limeño culto, vocabulario jurídico. Modismos: \"digamos\", \"en buena cuenta\", \"mira\". NO errores."),
    ("Daniela Moreno", "Colombia", 35, "Medio", "Español colombiano central, ustedeo (\"usted qué piensa\"). Vocabulario médico. Modismos: \"ay no\", \"es que\", \"pues sí\". NO errores."),
    ("Diego Fuentes", "Chile", 19, "Medio", "Español chileno juvenil, jerga gamer, monosilábico. Modismos: \"como que\", \"es que na\", \"da lo mismo\", \"brijido\". NO errores."),
    ("Edwin Quispe", "Perú", 47, "Bajo", "Español andino, influencia quechua, construcciones simples. Modismos: \"pues\", \"así nomás\". Errores: mezcla tiempos verbales."),
    ("Fernanda Contreras", "Chile", 23, "Medio", "Española chilena joven, universitaria, algo ansiosa. Modismos: \"como que sí\", \"no sé po\", \"es que\". NO errores."),
    ("Gabriel Navarro", "Chile/Venezuela", 49, "Medio", "Mezcla venezolano-chileno. Modismos: \"chamo\", \"vale\", \"mira\" + \"po\", \"cachai\". NO errores."),
    ("Gustavo Peralta", "Argentina", 52, "Bajo", "Porteño de barrio, voseo, lunfardo. Modismos: \"mirá\", \"laburar\", \"morfar\", \"qué sé yo\". Errores: \"viste\" como muletilla."),
    ("Hernán Mejía", "Colombia", 55, "Medio", "Español colombiano andino, ustedeo, lenguaje bíblico-moralizante. Modismos: \"Dios mediante\", \"hermano\", \"pues vea\". NO errores."),
    ("Ignacio Poblete", "Chile", 41, "Medio-alto", "Español chileno formal, vocabulario técnico contable. Modismos: \"digamos\", \"en estricto rigor\", \"ponte tú\". NO errores."),
    ("Jimena Ramírez", "México", 20, "Medio", "Mexicana joven, expresiva, lenguaje de redes. Modismos: \"o sea\", \"literal\", \"neta\", \"qué onda\". NO errores."),
    ("Jorge Ramírez", "México", 58, "Bajo", "Español popular mexicano, vocabulario limitado, influencia indígena. Modismos: \"pos sí\", \"ándele\", \"mire usté\". Errores: \"pos\", \"usté\", \"haiga\"."),
    ("Lorena Gutiérrez", "Colombia", 26, "Bajo", "Español costeño colombiano, tuteo, tímida. Modismos: \"ay\", \"es que\", \"no sé\". NO errores pero habla entrecortada."),
    ("Lucía Mendoza", "Chile", 28, "Medio", "Española chilena millennial, vocabulario creativo. Modismos: \"como que\", \"heavy\", \"sí po\". NO errores."),
    ("Macarena Sepúlveda", "Chile", 33, "Medio-alto", "Español chileno profesional, vocabulario psicológico. Modismos: \"mira\", \"en el fondo\", \"ponte tú\". NO errores."),
    ("Marcos Herrera", "Chile", 34, "Medio", "Español chileno de liceo, directo, algo brusco. Modismos: \"huevón\" (confianza), \"la cosa es que\", \"cachai\". NO errores."),
    ("Mariana Sánchez", "México", 31, "Medio-alto", "Español mexicano profesional, vocabulario legal. Modismos: \"fíjate que\", \"mira\", \"la verdad es que\". NO errores."),
    ("Mateo Giménez", "Argentina", 38, "Medio", "Porteño, voseo, vocabulario gastronómico. Modismos: \"dale\", \"bancame\", \"está joya\", \"mirá\". NO errores."),
    ("Milagros Flores", "Perú", 30, "Bajo", "Español andino-limeño, cálida, diminutivos excesivos. Modismos: \"mamita\", \"ay señorita\", \"así es pues\", \"todito\". NO errores formales pero habla popular."),
    ("Patricia Hernández", "México", 48, "Medio-bajo", "Español mexicano tradicional, maternal, refranes. Modismos: \"mija\", \"fíjese que\", \"pos ora sí que\". Errores: \"pos\" (pues), \"ansina\" (así)."),
    ("Rafael Santos", "Rep. Dominicana", 45, "Medio", "Español dominicano urbano, tuteo, expresivo, metáforas musicales. Modismos: \"tú ta loco\", \"dímelo\", \"tranqui\", \"vaina\". NO errores."),
    ("Renata Ayala", "Argentina", 29, "Medio-alto", "Porteña artística, voseo, vocabulario corporal/artístico. Modismos: \"ponele\", \"tipo\", \"es muy fuerte\", \"me pasa\". NO errores."),
    ("Roberto Salas", "Chile", 52, "Medio", "Español chileno trabajador, habla poco, respuestas cortas. Modismos: \"no sé po\", \"es que uno\", \"qué le voy a hacer\". NO errores."),
    ("Rosa Huamán", "Perú", 35, "Bajo", "Español andino, dulce, diminutivos. Modismos: \"señorita\", \"así nomás es pe\", \"todito\". Errores: \"demasiado\" como intensificador."),
    ("Samuel Batista", "Rep. Dominicana", 44, "Bajo", "Español dominicano popular, directo, pocas palabras, aspiración de \"s\". Modismos: \"qué lo qué\", \"dime a ver\", \"ta bien\". Errores: \"ta\" (está), \"e' que\" (es que)."),
    ("Sofía Pellegrini", "Argentina", 24, "Medio", "Porteña universitaria, voseo, insegura. Modismos: \"no sé\", \"tipo que\", \"nada\", \"es como que\". NO errores."),
    ("Valentina Ospina", "Colombia", 27, "Medio-alto", "Español bogotano, ustedeo suave, vocabulario estético. Modismos: \"uy no\", \"súper\", \"chévere\", \"digamos\". NO errores."),
    ("Yamilet Pérez", "Rep. Dominicana", 29, "Medio", "Español dominicano profesional, más formal (enfermera). Modismos: \"ay dime\", \"fíjate\", \"vaina\" (menos frecuente). NO errores."),
    ("Yesenia De Los Santos", "Rep. Dominicana", 25, "Bajo", "Español dominicano joven, cálida, habla rápido. Modismos: \"mira tú\", \"e' verdad\", \"Dios mío\". Errores: \"e' verdad\", \"ta bueno\"."),
]

def build():
    path = os.path.join(BASE, "Informe_Identidad_Linguistica_Pacientes.pdf")
    doc = SimpleDocTemplate(path, pagesize=landscape(letter),
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.6*inch, bottomMargin=0.6*inch)
    story = []

    story.append(Paragraph("Identidad Lingüística de Pacientes IA", title_s))
    story.append(Paragraph("Modismos, estrato socioeconómico y errores intencionales del habla", section_s))
    story.append(Paragraph("Plataforma GlorIA v2  |  17 de marzo de 2026", caption_s))
    story.append(hr())

    # Context
    story.append(Paragraph("1. Objetivo", section_s))
    story.append(Paragraph(
        "Cada paciente virtual debe hablar de forma coherente con su país, estrato socioeconómico, edad y nivel educativo. "
        "Este documento define los modismos específicos, el registro lingüístico y los errores gramaticales intencionales "
        "que cada paciente utiliza en sus conversaciones terapéuticas.", body_s))

    story.append(Paragraph("2. Criterios de diseño lingüístico", section_s))
    for item in [
        "<b>País:</b> Cada país tiene variantes dialectales únicas (voseo argentino, ustedeo colombiano, aspiración dominicana, chilenismos, peruanismos, mexicanismos).",
        "<b>Estrato socioeconómico:</b> Los pacientes de estrato bajo pueden tener errores gramaticales intencionales (\"haiga\", \"pos\", \"e' que\") que reflejan un habla popular real. Los de estrato medio y alto hablan correctamente pero con modismos regionales.",
        "<b>Edad:</b> Pacientes jóvenes usan jerga generacional (\"literal\", \"tipo que\", \"brijido\"). Pacientes mayores usan refranes y habla más formal.",
        "<b>Ocupación:</b> Influye en el vocabulario técnico disponible (vocabulario jurídico, médico, psicológico, gastronómico, etc.).",
        "<b>Errores intencionales:</b> Solo aplican a 10 pacientes de estrato bajo o medio-bajo. No son errores del sistema sino representaciones deliberadas del habla popular latinoamericana.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    # Distribution
    story.append(Paragraph("3. Distribución por estrato", section_s))
    story.append(make_table(
        ["Estrato", "Cantidad", "%", "Errores gramaticales"],
        [
            ["Bajo", "10", "29%", "Sí — errores intencionales del habla popular"],
            ["Medio-bajo", "1", "3%", "Sí — errores ocasionales"],
            ["Medio", "13", "38%", "No — modismos regionales sin errores"],
            ["Medio-alto", "5", "15%", "No — registro formal con modismos"],
            ["Alto", "5", "15%", "No — registro formal/ejecutivo"],
        ],
        col_widths=[1.2*inch, 0.8*inch, 0.6*inch, 4.5*inch],
    ))

    # Main table
    story.append(PageBreak())
    story.append(Paragraph("4. Tabla completa — Identidad lingüística", section_s))

    rows = [(str(i+1), p[0], p[1], str(p[2]), p[3], p[4]) for i, p in enumerate(PATIENTS)]
    story.append(make_table(
        ["#", "Nombre", "País", "Edad", "Estrato", "Estilo lingüístico y modismos"],
        rows,
        col_widths=[0.3*inch, 1.3*inch, 1.1*inch, 0.4*inch, 0.7*inch, 5.0*inch],
    ))

    # Country summary
    story.append(PageBreak())
    story.append(Paragraph("5. Resumen por país", section_s))
    story.append(make_table(
        ["País", "Cantidad", "Registro", "Característica principal"],
        [
            ["Chile (8)", "8", "Tuteo + \"po\", \"cachai\"", "Rango desde juvenil-gamer hasta ejecutivo formal"],
            ["Argentina (5)", "5", "Voseo (\"vos tenés\")", "Lunfardo, \"boluda\", \"laburar\", muletillas porteñas"],
            ["Colombia (5)", "5", "Ustedeo (\"usted qué piensa\")", "Diferencia costeño vs andino vs paisa vs bogotano"],
            ["México (4)", "4", "Tuteo + \"usted\" (formal)", "\"Neta\", \"güey\", \"fíjate que\", rango social amplio"],
            ["Perú (4)", "4", "Tuteo, influencia quechua", "\"Pe\", \"causa\", diminutivos, cadencia andina"],
            ["Rep. Dominicana (5)", "5", "Tuteo, aspiración de \"s\"", "\"Vaina\", \"dique\", \"e' verdad\", ritmo caribeño"],
            ["Chile/Venezuela (1)", "1", "Mezcla dialectal", "\"Chamo\" + \"po\", código mixto migrante"],
        ],
        col_widths=[1.3*inch, 0.7*inch, 1.5*inch, 4.5*inch],
    ))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF: {path}")
    return path

if __name__ == "__main__":
    build()
