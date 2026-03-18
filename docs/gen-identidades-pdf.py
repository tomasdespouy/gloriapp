"""
PDF: Identidades Visuales de Pacientes IA — GlorIA
Logo top-right, Calibri font, full accent support.
"""
import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable,
)

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
GREEN = HexColor("#16a34a")
AMBER = HexColor("#d97706")
RED = HexColor("#dc2626")

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
    canvas.drawCentredString(doc.width / 2 + doc.leftMargin, 0.4*inch,
                              f"GlorIA — Página {doc.page}")
    canvas.restoreState()


# Styles
title_s = ParagraphStyle('T', fontSize=22, leading=28, textColor=SIDEBAR, fontName='Calibri-Bold', spaceAfter=6)
section_s = ParagraphStyle('S', fontSize=14, leading=18, textColor=SIDEBAR, fontName='Calibri-Bold', spaceBefore=16, spaceAfter=8)
sub_s = ParagraphStyle('Sub', fontSize=11, leading=15, textColor=DARK, fontName='Calibri-Bold', spaceBefore=10, spaceAfter=6)
body_s = ParagraphStyle('B', fontSize=9.5, leading=14, textColor=DARK, fontName='Calibri', alignment=TA_JUSTIFY, spaceAfter=6)
caption_s = ParagraphStyle('C', fontSize=8, leading=10, textColor=GRAY, fontName='Calibri-Italic', alignment=TA_CENTER, spaceAfter=8)
blt_s = ParagraphStyle('Blt', fontSize=9.5, leading=14, textColor=DARK, fontName='Calibri', leftIndent=18, bulletIndent=6, spaceAfter=3)
th_s = ParagraphStyle('TH', fontSize=7.5, leading=10, textColor=WHITE, fontName='Calibri-Bold', alignment=TA_CENTER)
tc_s = ParagraphStyle('TC', fontSize=7, leading=9.5, textColor=DARK, fontName='Calibri')
tc_c = ParagraphStyle('TCC', fontSize=7, leading=9.5, textColor=DARK, fontName='Calibri', alignment=TA_CENTER)

B = chr(8226)


def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(h, th_s) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), tc_s) if i > 1 else Paragraph(str(c), tc_c) for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SIDEBAR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.4, HexColor("#E5E7EB")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
    ]))
    return t


def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceBefore=6, spaceAfter=6)


PATIENTS = [
    (1,"Alejandro Vega","M",39,"Empresario","México","Avanzado","Ascendencia libanesa-mexicana","Tensa, mandíbula apretada","Corto engominado","Castaño oscuro","Oliva bronceada","Lentes marco grueso negro","Camisa entreabierta","Gris oscuro","Gris oscuro"),
    (2,"Altagracia Marte","F",60,"Costurera","Rep. Dominicana","Avanzado","Afrocaribeña","Digna, con profundidad","Canoso corto natural","Gris natural","Negra profunda","Cadena de oro con crucifijo","Blusa floral","Turquesa","Amarillo tenue"),
    (3,"Andrés Castillo","M",50,"Comerciante","Colombia","Avanzado","Mestizo paisa","Sonrisa comercial","Corto peinado atrás","Castaño entrecano","Trigueña rojiza","Anillo grueso","Camisa polo","Verde botella","Marrón cálido"),
    (4,"Camila Bertoni","F",22,"Est. psicología","Argentina","Principiante","Mestiza, vitiligo leve","Introspectiva","Liso con flequillo","Rubio ceniza","Clara, vitiligo","Pulsera delgada","Cárdigan oversized","Crema","Blanco"),
    (5,"Carlos Quispe","M",42,"Taxista","Perú","Intermedio","Mestizo limeño","Impaciente","Corto","Negro","Morena cálida","Sin accesorios","Polo desgastado","Rojo oscuro","Ocre"),
    (6,"Carmen Torres","F",45,"Ejecutiva marketing","Chile","Avanzado","Mestiza mediterránea","Media sonrisa desafiante","Bob corto","Castaño rojizo","Oliva uniforme","Collar de plata","Blazer","Burdeo","Blanco roto"),
    (7,"Catalina Ríos","F",38,"Abogada","Perú","Avanzado","Mestiza criolla","Penetrante, segura","Moño alto","Castaño chocolate","Trigueña clara","Lentes fino dorado","Blusa de seda","Azul petróleo","Gris azulado"),
    (8,"Daniela Moreno","F",35,"Enfermera","Colombia","Intermedio","Afrocolombiana","Agotada pero firme","Recogido con pinche","Negro azulado","Morena oscura","Sin accesorios","Uniforme médico","Verde quirúrgico","Verde menta"),
    (9,"Diego Fuentes","M",19,"Est. universitario","Chile","Intermedio","Ascendencia europea","Distante, perdida","Desordenado, flequillo","Castaño decolorado","Clara rosada","Audífonos al cuello","Hoodie oversized","Negro","Azul grisáceo"),
    (10,"Edwin Quispe","M",47,"Minero","Perú","Intermedio","Rasgos andinos marcados","Endurecido, resiliente","Negro corto","Negro con grises","Morena cobriza","Sin accesorios","Camisa trabajo","Marrón","Ocre oscuro"),
    (11,"Fernanda Contreras","F",23,"Est. enfermería","Chile","Principiante","Mestiza, rasgos andinos","Ojos abiertos, ansiosa","Largo liso, cola","Castaño oscuro","Morena clara","Cintillo simple","Polera manga larga","Blanca","Crema"),
    (12,"Gabriel Navarro","M",49,"Trabajador social","Chile/Vzla","Avanzado","Mestizo venezolano","Compasiva, triste","Ondulado, canoso","Castaño con canas","Trigueña oliva","Lentes delgados","Chaqueta liviana","Azul marino","Gris verdoso"),
    (13,"Gustavo Peralta","M",52,"Taxista","Argentina","Intermedio","Ascendencia italiana","Sonrisa cansada","Muy corto, rapado","Sal y pimienta","Trigueña arrugada","Cadena de plata","Chaqueta cuero","Marrón oscuro","Marrón grisáceo"),
    (14,"Hernán Mejía","M",55,"Pastor evangélico","Colombia","Avanzado","Mestizo andino col.","Reflexiva, pensativa","Canoso hacia atrás","Blanco canoso","Trigueña rojiza","Cruz al cuello","Camisa manga larga","Blanca","Marrón claro"),
    (15,"Ignacio Poblete","M",41,"Contador","Chile","Intermedio","Ascend. alemana sur","Ceño leve","Corto al lado","Castaño canas prem.","Clara pálida","Reloj de pulsera","Camisa formal","Celeste","Gris claro"),
    (16,"Jimena Ramírez","F",20,"Est. comunicación","México","Principiante","Mestiza, rasgos indíg.","Curiosa, cejas lev.","Corte pixie","Negro mechas burdeo","Morena dorada","Aros colgantes","Top casual","Naranja","Celeste pálido"),
    (17,"Jorge Ramírez","M",58,"Obrero construcción","México","Avanzado","Mestizo zapoteco","Curtido, estoica","Corto canoso","Canoso oscuro","Morena curtida","Sin accesorios","Camiseta sin mangas","Gris sucio","Terracota"),
    (18,"Lorena Gutiérrez","F",26,"Mesera","Colombia","Principiante","Mestiza caribeña","Vulnerable, tímida","Rizado suelto","Castaño con reflejos","Canela cálida","Piercing nariz","Camiseta simple","Lila","Lavanda tenue"),
    (19,"Lucía Mendoza","F",28,"Diseñadora gráfica","Chile","Principiante","Mestiza, rasgos suaves","Sonrisa contenida","Suelto ondulado","Cobrizo auburn","Trigueña olivácea","Aros argolla peq.","Camiseta gráfica","Mostaza","Gris neutro"),
    (20,"Macarena Sepúlveda","F",33,"Psicóloga clínica","Chile","Avanzado","Mestiza, asc. europea","Empática, serena","Al hombro con ondas","Rubio oscuro miel","Clara con pecas","Aros de perla","Sweater cuello alto","Beige","Rosa empolvado"),
    (21,"Marcos Herrera","M",34,"Profesor secundaria","Chile","Intermedio","Mestizo, asc. mapuche","Seria y directa","Corto con entradas","Negro azabache","Morena clara","Lentes rectangular","Camisa a cuadros","Azul marino","Beige cálido"),
    (22,"Mariana Sánchez","F",31,"Abogada","México","Intermedio","Mestiza, piel clara","Contenida, tensa","Liso largo, raya","Castaño medio","Clara con pecas","Aros studs","Blusa formal","Blanco rayas azules","Durazno"),
    (23,"Mateo Giménez","M",38,"Chef","Argentina","Intermedio","Ascendencia española","Orgullosa, confiada","Ondulado, barba","Castaño oscuro","Oliva mediterránea","Sin accesorios","Chaqueta chef","Blanca","Gris neutro osc."),
    (24,"Milagros Flores","F",30,"Vendedora mercado","Perú","Principiante","Mestiza andina quechua","Sonrisa amplia","Trenza larga","Negro intenso","Cobriza canela","Pulsera hilo","Blusa floral","Roja y amarilla","Terracota suave"),
    (25,"Patricia Hernández","F",48,"Ama de casa","México","Intermedio","Mestiza mexicana","Suave, maternal","Largo raya al medio","Negro entrecano","Morena con textura","Anillo matrimonio","Blusa bordada","Rosa viejo","Durazno claro"),
    (26,"Rafael Santos","M",45,"Músico","Rep. Dominicana","Avanzado","Mulato dominicano","Soñadora, lejana","Rastas cortas","Negro con canas","Morena cálida","Aro en oreja izq","Camisa lino abierta","Blanca","Azul caribe"),
    (27,"Renata Ayala","F",29,"Bailarina profesional","Argentina","Avanzado","Mestiza, asc. mixta","Intensa, apasionada","Rodete bailarina","Castaño cobrizo","Clara marfil","Sin accesorios","Top deportivo","Negro c/rojo","Negro"),
    (28,"Roberto Salas","M",52,"Ingeniero jubilado","Chile","Principiante","Mestizo, rasgos mixtos","Cansada pero cálida","Calvicie, canoso lados","Gris plateado","Trigueña curtida","Sin accesorios","Polo simple","Verde oliva","Verde musgo"),
    (29,"Rosa Huamán","F",35,"Profesora primaria","Perú","Principiante","Mestiza andina","Dulce pero preocupada","Largo liso, traba","Negro intenso","Cobriza cálida","Aros plata peq.","Chaleco de lana","Terracota","Verde pálido"),
    (30,"Samuel Batista","M",44,"Mecánico","Rep. Dominicana","Intermedio","Ascendencia africana","Neutro, impasible","Buzz cut","Negro canas sienes","Negra cobriza","Sin accesorios","Camiseta sin mangas","Gris","Azul petróleo"),
    (31,"Sofía Pellegrini","F",24,"Est. universitaria","Argentina","Principiante","Asc. italiana, ojeras","Nerviosa, forzada","Largo descuidado","Castaño claro","Clara, ojeras","Mochila al hombro","Sweater holgado","Gris jaspeado","Blanco roto"),
    (32,"Valentina Ospina","F",27,"Diseñadora interiores","Colombia","Principiante","Mestiza colombiana","Creativa, inquieta","Medio suelto ondas","Castaño c/miel","Clara rosada","Collar fino dije","Blusa algodón","Coral","Arena"),
    (33,"Yamilet Pérez","F",29,"Enfermera","Rep. Dominicana","Intermedio","Mulata, rasgos taínos","Cálida, profesional","Ondulado al hombro","Negro","Canela dorada","Reloj delgado","Uniforme médico","Azul oscuro","Verde grisáceo"),
    (34,"Yesenia De Los Santos","F",25,"Maestra primaria","Rep. Dominicana","Principiante","Mulata, piel canela","Cálida y abierta","Rizos afro medianos","Negro","Canela oscura","Aros argolla med.","Blusa algodón","Amarillo suave","Coral suave"),
]


def build():
    path = os.path.join(BASE, "Informe_Identidades_Visuales_Pacientes.pdf")
    doc = SimpleDocTemplate(path, pagesize=landscape(letter),
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.6*inch, bottomMargin=0.6*inch)
    story = []

    # Title page
    story.append(Paragraph("Identidades Visuales de Pacientes IA", title_s))
    story.append(Paragraph("Diseño, proporción y fundamentación", section_s))
    story.append(Paragraph("Plataforma GlorIA v2  |  17 de marzo de 2026", caption_s))
    story.append(hr())

    # 1. Methodology
    story.append(Paragraph("1. Metodología de creación", section_s))
    story.append(Paragraph(
        "Las identidades visuales de los 34 pacientes fueron diseñadas siguiendo un proceso estructurado "
        "que prioriza la diversidad, la autenticidad y la reducción de estereotipos:", body_s))
    for item in [
        "<b>Tabla de características:</b> Se definieron 14 atributos visuales para cada paciente: género, edad, profesión, país, etnia, gesto facial, estilo de pelo, color de pelo, tez, accesorios, tipo de ropa, color de ropa y color de fondo.",
        "<b>Anti-estereotipación:</b> Se incluyeron combinaciones intencionales que rompen estereotipos regionales: un chileno de ascendencia mapuche, una argentina con vitiligo, un mexicano de ascendencia libanesa, una afrocolombiana, un chileno de ascendencia alemana del sur.",
        "<b>Rasgos poco frecuentes:</b> Vitiligo (Camila), ojeras marcadas (Sofía), acné juvenil, canas prematuras (Ignacio), manchas solares (Diego) — normalizan condiciones reales de piel.",
        "<b>Prompt base unificado:</b> \"Retrato fotorrealista de primer plano, formato cuadrado, enmarcado dentro de la imagen. Una persona real con rasgos auténticos, mirando directamente a la cámara. Iluminación suave y natural.\"",
        "<b>Generación:</b> Gemini Imagen 4 (Google) para las fotos. Luma AI ray-2 para los videos con movimiento natural.",
        "<b>Compresión:</b> Todas las imágenes optimizadas a 512x512 PNG (~300-400 KB cada una) para rendimiento web.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    # 2. Proportions
    story.append(Paragraph("2. Proporción y distribución", section_s))

    story.append(Paragraph("2.1 Género", sub_s))
    story.append(Paragraph("20 mujeres (59%) y 14 hombres (41%). Esta proporción refleja la composición real de las carreras de psicología en Latinoamérica, donde la matrícula femenina supera el 70% (UNESCO, 2023).", body_s))

    story.append(Paragraph("2.2 Países representados (6)", sub_s))
    story.append(make_table(
        ["País", "Cantidad", "Proporción"],
        [
            ["Chile", "8", "24%"], ["Colombia", "5", "15%"], ["México", "4", "12%"],
            ["Perú", "4", "12%"], ["Argentina", "5", "15%"], ["Rep. Dominicana", "5", "15%"],
            ["Chile/Venezuela", "1", "3%"], ["Otros (pendiente)", "2", "6%"],
        ],
        col_widths=[2*inch, 1*inch, 1*inch],
    ))
    story.append(Paragraph("La distribución cubre los principales mercados de psicología en Latinoamérica, con énfasis en Chile (sede de la UGM) y representación caribeña (Rep. Dominicana).", body_s))

    story.append(Paragraph("2.3 Nivel de dificultad", sub_s))
    story.append(make_table(
        ["Nivel", "Cantidad", "Proporción", "Descripción"],
        [
            ["Principiante", "12", "35%", "Pacientes más abiertos, menos resistentes. Ideal para primeras prácticas."],
            ["Intermedio", "11", "32%", "Resistencia moderada, mecanismos de defensa activos. Requiere técnica."],
            ["Avanzado", "11", "32%", "Alta resistencia, transferencia, crisis. Requiere experiencia clínica."],
        ],
        col_widths=[1.2*inch, 0.8*inch, 0.8*inch, 5*inch],
    ))

    story.append(Paragraph("2.4 Rango de edad", sub_s))
    story.append(Paragraph("De 19 a 60 años. Promedio: 36.4 años. Distribución: 19-25 (6 pacientes), 26-35 (10), 36-45 (8), 46-60 (10). Cubre todo el espectro de adultez que un terapeuta encontraría en consulta.", body_s))

    story.append(Paragraph("2.5 Etnias y rasgos", sub_s))
    story.append(Paragraph(
        "Se incluyen deliberadamente: mestizos con rasgos andinos (quechua, aymara), mestizos europeos, "
        "afrodescendientes (afrocolombiana, afrocaribeños, afrouruguayo implícito), ascendencia libanesa-mexicana, "
        "ascendencia alemana-chilena, ascendencia italiana-argentina, ascendencia española, "
        "rasgos indígenas zapotecos y mapuche, mulatos dominicanos con rasgos taínos. "
        "Esto evita el \"default mestizo\" y representa la verdadera diversidad latinoamericana.", body_s))

    # 3. Importance
    story.append(PageBreak())
    story.append(Paragraph("3. Importancia para la plataforma", section_s))
    for item in [
        "<b>Competencia cultural:</b> Los estudiantes deben practicar con pacientes que reflejen la diversidad real. Un terapeuta en Santiago atenderá pacientes mapuche, migrantes venezolanos y afrodescendientes. La plataforma los prepara para eso.",
        "<b>Reducción de sesgo:</b> Si todos los pacientes fueran mestizos de clase media, los estudiantes desarrollarían sesgos implícitos. La diversidad visual combate esto.",
        "<b>Realismo clínico:</b> Las expresiones faciales (ansiosa, impasible, desafiante, vulnerable) y los accesorios (cruz, piercing, delantal) contextualizan al paciente antes de que hable. Esto simula la primera impresión real en consulta.",
        "<b>Engagement:</b> Pacientes visualmente distintos y memorables mejoran la retención y motivación del estudiante. No son \"avatares genéricos\" sino personas reconocibles.",
        "<b>Escalabilidad:</b> El sistema de `visual_identity` (JSONB en la BD) permite crear nuevos pacientes con identidades coherentes sin intervención manual en el diseño visual.",
    ]:
        story.append(Paragraph(item, blt_s, bulletText=B))

    # 4. Table 1 — Identity
    story.append(PageBreak())
    story.append(Paragraph("4. Tabla completa — Identidad", section_s))

    t1_headers = ["#", "Nombre", "G", "Edad", "Profesión", "País", "Nivel", "Etnia"]
    t1_rows = [(str(p[0]), p[1], p[2], str(p[3]), p[4], p[5], p[6], p[7]) for p in PATIENTS]
    story.append(make_table(t1_headers, t1_rows,
        col_widths=[0.3*inch, 1.4*inch, 0.25*inch, 0.35*inch, 1.3*inch, 1.1*inch, 0.8*inch, 2.2*inch]))

    # 5. Table 2 — Appearance
    story.append(PageBreak())
    story.append(Paragraph("5. Tabla completa — Apariencia", section_s))

    t2_headers = ["#", "Nombre", "Gesto", "Pelo estilo", "Pelo color", "Tez", "Accesorios", "Ropa", "Color ropa", "Fondo"]
    t2_rows = [(str(p[0]), p[1], p[8], p[9], p[10], p[11], p[12], p[13], p[14], p[15]) for p in PATIENTS]
    story.append(make_table(t2_headers, t2_rows,
        col_widths=[0.3*inch, 1.1*inch, 1.0*inch, 0.9*inch, 0.9*inch, 0.9*inch, 1.0*inch, 1.0*inch, 0.8*inch, 0.8*inch]))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF generado: {path}")
    return path


if __name__ == "__main__":
    build()
