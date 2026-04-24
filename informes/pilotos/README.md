# Formato de informes de piloto

Este directorio guarda el **formato estándar** para informes post-piloto
de GlorIA. El objetivo es que todos los pilotos (UBO, UCSP, UGM, y los
que vengan) tengan una devolución consistente en estructura, visual y
profundidad.

La primera implementación es **INF-2026-042** (piloto UBO, 17 estudiantes,
abril 2026). Su generador y extractor viven acá al lado como referencia
ejecutable.

---

## Estructura del informe (4 secciones, obligatorias)

### Sección 1 · Datos técnicos del piloto
**Propósito:** que cualquier lector entienda en 30 segundos el tamaño y
los numeritos duros del piloto.

Contenido:
- **Cuadro-resumen** (tabla 2 columnas, valor centrado): invitados,
  conectados, encuestas respondidas, sesiones completadas, mensajes
  intercambiados, minutos totales, ventana del piloto.
- **Tabla de participantes**: # · Nombre · Rol · Sesiones · Minutos ·
  Último acceso. Nombre a la izquierda, todo lo demás centrado.

Si el informe es para entrega externa (institución), decidir antes si
los nombres van reales o anonimizados como `Estudiante 01..N`. Para
informes internos, nombres reales.

### Sección 2 · Evaluación cuantitativa de la encuesta
**Propósito:** mostrar los resultados de la encuesta de cierre con
gráficos, sin interpretación.

4 charts (cada uno en su propia fila, centrado, 720×340–360):
1. **Pie — Rol**: docentes (color primario GlorIA) vs estudiantes
2. **Pie — Género**: masculino azul (`#2563EB`), femenino naranjo
   (`#F97316`), otro gris neutro (`#94A3B8`). **No usar rosa ni paleta
   convencional género-sesgada.**
3. **Bar — Usabilidad** (1–5): claridad, feedback, navegación,
   performance
4. **Bar — Valor formativo** (1–5): atención, aplicación, habilidades,
   incorporación, verosimilitud

Convenciones para los bar charts de encuesta:
- **Eje X: 4.0 a 5.0** (las respuestas están concentradas arriba; un eje
  0–5 aplana visualmente)
- **% dentro de la barra en blanco bold**: porcentaje de respuestas en
  la zona alta (4 o 5)
- **Promedio fuera al final de la barra, 1 decimal**
- **Y-axis label: solo el nombre de la variable** (no repetir avg ni %
  ahí — ya están en la barra)

### Sección 3 · 6 testimonios textuales
**Propósito:** voz directa del estudiante, sin interpretación nuestra.

- **3 positivos**: extraídos literal de `survey_responses.answers.q7_mas_gusto`
- **3 de mejora**: extraídos literal de `survey_responses.answers.q8_mejoras`

Filtros:
- Descartar respuestas de menos de 5 palabras
- Descartar respuestas positivas que el estudiante puso en la pregunta
  de mejoras por error ("está perfecta", "fue muy real", "por el momento
  nada") — tenemos una regex `POSITIVE_ONLY_RE` para esto
- Ordenar por longitud descendente y tomar los 3 más sustantivos
- Firmar con el nombre del estudiante

### Sección 4 · Análisis de competencias clínicas
**Propósito:** evaluar el desempeño grupal en las competencias del
framework **Valdés & Gómez (2023), Universidad Santo Tomás Chile**.

Las 10 competencias del framework son:
`setting_terapeutico`, `motivo_consulta`, `datos_contextuales`,
`objetivos`, `escucha_activa`, `actitud_no_valorativa`, `optimismo`,
`presencia`, `conducta_no_verbal`, `contencion_afectos`.

**IMPORTANTE:** Si el piloto es texto-solo (sin audio ni video), excluir
`presencia` y `conducta_no_verbal` del análisis — no son evaluables con
rigor sin mirada, tono y postura. Documentar explícitamente la omisión
en el informe.

Contenido:
- Citación del framework (obligatorio)
- Puntaje global del grupo + N de sesiones evaluadas
- **Bar chart** con las 8 (o 10) competencias, promedio al final de cada
  barra (sin % porque los puntajes suelen caer en 1–3 y mostrar "0% en
  zona alta" es engañoso)
- **Análisis detallado de 5 competencias destacadas:**
  - 2 con mejor puntaje (fortalezas del grupo)
  - 1 transversal (relevancia clínica central)
  - 2 con peor puntaje (oportunidades claras)

Para cada competencia destacada:
- **Definición rica** (3–4 líneas): qué es la capacidad · cómo se
  observa en la práctica · por qué importa clínicamente. No
  diccionario — criterio aplicado.
- **Tabla-resumen de 5 columnas** (todos los valores centrados):
  Puntaje grupal · % grupo con 4-5 · Máximo observado · Mínimo
  observado · Sesiones evaluadas
- **2 ejemplos de desempeño sólido** (accent blue): nombre + puntaje +
  cita textual de la conversación + observación del evaluador
- **2 ejemplos de oportunidad de mejora** (accent amber): mismo formato
- No repetir estudiante entre "sólido" y "mejora" en la misma
  competencia

---

## Convenciones de estilo (reutilizables)

| Elemento | Valor |
|---|---|
| Fuente | Calibri |
| Accent color | `#4A55A2` (azul indigo GlorIA) |
| Warning/mejora color | `#B45309` (amber oscuro) |
| Border color de tablas | `#CCCCCC` |
| Header cell background | `#F3F4F6` |
| Tamaño base body | 22 (docx half-points) |
| Tamaño headings | H1 32 · H2 26 · H3 22 |
| Alineación defaults | Nombres: izquierda · Números/categorías: centro |
| Decimales | 1 decimal en charts y puntajes |

Logo: leer las dimensiones reales del PNG (`readUInt32BE(16)` para
width, `readUInt32BE(20)` para height) y escalar proporcional a una
altura target. **Nunca hardcodear width×height** — estira el logo.

---

## Pipeline técnico

1. **Extractor** (`scripts/extract-*-pilot-data.js`): corre contra prod
   de Supabase, baja todos los datos del piloto a un JSON. El JSON
   tiene PII → está en `.gitignore`, nunca se commitea.

   Query del extractor:
   - `pilots` por nombre/institution
   - `pilot_participants` por `pilot_id`
   - `conversations` por `student_id IN (participants.user_id)`
   - `messages` por `conversation_id IN (...)`
   - `ai_patients` por `id IN (conversations.ai_patient_id)`
   - `surveys` por `pilot_id` → `survey_responses` por `survey_id`
     (**NO por `survey_responses.pilot_id` — ese campo no se popula**)
   - `session_competencies` por `conversation_id IN (...)`

2. **Generador** (`informes/gen-informe-NNN-<piloto>.js`): lee el JSON,
   computa agregados, genera charts via quickchart.io (POST con JSON
   body para soportar function strings en datalabels), arma el docx con
   la librería `docx` y lo escribe a `informes/pilotos/INF-YYYY-NNN_<piloto>.docx`.

3. **Distribución**: el `.docx` también está en `.gitignore`. Se sube
   manualmente a Drive/supradmin según el protocolo de informes del
   proyecto (local + supradmin + reportes@glor-ia.com).

---

## Próxima etapa: endpoint `/api/admin/pilots/[id]/informe`

El generador actual es un script Node standalone. El siguiente paso
natural es **portarlo a un endpoint API** que se llame desde
`/admin/pilotos/[id]` con un botón "Generar informe":

```
POST /api/admin/pilots/[id]/informe
  body: { framework: "valdes-gomez-2023", include_names: true }
  → 200, streams application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

Cambios necesarios para el port:
1. Mover la lógica de agregación y el generador a `src/lib/pilot-report/`
   (separar extractor de generator en módulos).
2. El generador ya no corre como CLI — exporta una función
   `generateReport(pilotId, options): Promise<Buffer>`.
3. Autenticación: superadmin o admin de ese establecimiento.
4. Los charts vía quickchart.io se mantienen (función en runtime vs
   buildtime no importa); evaluar cachear los PNG por ~1 hora para no
   regenerarlos si el admin descarga el informe varias veces.
5. Agregar en la UI del dashboard de piloto un botón "Descargar informe
   (.docx)".

Estimado: ~4–6 horas de desarrollo + 1 hora testing. No tiene
migraciones. No toca RLS.

---

## Historial de iteraciones

La versión actual (INF-042) pasó por 3 iteraciones con el producto:

- **v1**: estructura de 7 bloques narrativos (rechazada — demasiada
  prosa)
- **v2**: 4 secciones data-first (aceptada); 5 destacadas por
  competencia; 1 bien + 1 regular por ejemplo
- **v3** (actual): 2+2 ejemplos por competencia; ejes 4–5 en survey
  bars; % dentro barra en blanco + promedio fuera; pies con colores
  azul-naranja en género; exclusión de presencia y
  conducta_no_verbal; definiciones expandidas de cada competencia;
  "Hoja N" → "Sección N"; logo con aspect ratio real.
