# Diseño V4 — Motor de Retroalimentación de GlorIA

**Estado:** Borrador para revisión humana
**Autor:** Diseño técnico — equipo GlorIA
**Fecha:** 2026-05-18
**Rama:** `feat/v4-design`
**Base empírica:** F4 — Proyección con 3 estudiantes × 3 niveles (`C:/tmp/projection/analysis.md`)
**Fuente clínica:** Valdés Sánchez, N. & Gómez Gallo, D. (2023). *Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas.* Ediciones Universidad Santo Tomás / RIL Editores. Cap. 2 + Anexo B (PECT).

---

## 1. Resumen ejecutivo

V3 mide un fragmento limitado del PECT (10 competencias sobre 46 ítems + 17 técnicas) y, según la proyección empírica F4, **no logra discriminar pericia técnica** entre estudiantes nivel Medio y Avanzado (Δ = +0.1 en V3 vs Δ = +0.43 en PECT-extendido, con la sección 7 — Técnicas — alcanzando Δ = +2.0).

V4 propone seis cambios fundamentales respecto de V3:

| Cambio | Resuelve |
|---|---|
| 1. Expandir cobertura de 10 a 35 ítems observables vía chat (de 6 dimensiones del libro) | Bandera roja 1: subcobertura del PECT (V3 cubre ~22%) |
| 2. Incorporar dimensión de Técnicas (sección 7) con 6 técnicas de alta señal | Bandera naranja: Δ=+2 en técnicas entre Básico y Avanzado, ignoradas por V3 |
| 3. Anclas conductuales fieles al Cap. 2 del libro + glosa GlorIA (heredado de `fix/v3-fidelity-pect`) | Bandera roja 2: anclas V3 inventadas, no diferenciables Medio/Avanzado |
| 4. Reglas anti-NA estrictas por competencia y contexto de sesión | Bandera amarilla: objetivos/optimismo recibieron NA sistemáticamente |
| 5. Evaluador en cascada (pasada PECT-ext → agregado UI) | Mantiene UI manejable sin sacrificar granularidad evaluativa |
| 6. Schema retrocompatible — V3 sigue funcionando, V4 vive en columnas nuevas | Migración progresiva sin romper sesiones históricas |

V4 **no es una refundación** sino una expansión disciplinada: mantiene la unidad pedagógica que ya funciona (rúbrica conductual + evidencia + NA explícito) y la extiende a la pauta completa que el libro ya provee.

---

## 2. Cobertura ampliada

### 2.1 Mapa de cobertura V3 → V4

El libro tiene 7 secciones / 46 ítems + 17 sub-técnicas. V3 cubre 10 ítems (~22%). V4 cubre 35 ítems observables vía chat (~76%) más 6 técnicas con señal empírica probada (10%).

| Sección PECT (libro) | Ítems totales | Evaluables vía chat | V3 cubre | V4 cubre | Justificación |
|---|---|---|---|---|---|
| 1. Estructura terapéutica | 7 | 5 | 4 | 5 | Agrega `modifica_setting`. Excluye `consentimientos_informados` y `elementos_institucionales` (fuera del flujo de chat). |
| 2. Diseño y comunicación del plan | 5 | 3 | 0 | 3 | Agrega `plan_de_trabajo`, `modifica_tareas_metas`, `cierre`. F4 muestra Δ=+1 entre Básico y Avanzado. Excluye `derivaciones` (no aplica a 1 sesión) y `redacta_informes` (artefacto fuera de chat). |
| 3. Actitud de la terapeuta | 10 | 10 | 6 | 10 | Agrega `curiosidad_cordialidad`, `espontaneidad`, `manejo_silencios`, `actitud_etica`. F4 muestra Δ=+2 en curiosidad y manejo de silencios (alta discriminación). |
| 4. Características de la terapeuta | 8 | 0 | 0 | 0 | **Excluida por completo.** Requiere observación presencial del estudiante (apariencia, autocuidado, regulación afectiva propia). No observable en chat. |
| 5. Conceptualización del caso | 5 | 0 | 0 | 0 | **Excluida por completo.** El propio libro indica que se evalúa en supervisión escrita/oral, no en sesión. |
| 6. Evaluación del proceso | 6 | 5 | 0 | 5 | Agrega `timing`, `desarrollo_vinculo`, `identifica_tensiones`, `repara_tensiones`, `monitoreo_avance`. F4 muestra Δ=+2 en identifica_tensiones. Excluye `aplica_sugerencias_supervisión` (requiere ciclo de supervisión). |
| 7. Tipos de intervención y técnicas | 5 + 17 | 4 + 6 | 0 | 4 + 6 | Agrega las 4 intervenciones principales y 6 técnicas con señal F4: paráfrasis, reflejo, focalización, clarificación, argumentación, asignación de tareas. |
| **TOTAL** | **46 + 17** | **35** | **10 (22%)** | **35 (76%) + 6 técnicas** | |

### 2.2 Justificación empírica por competencia agregada

Cada agregado de V4 está respaldado por la proyección F4 (3 estudiantes × 3 niveles, Diego Fuentes en staging, gpt-4o evaluador). Las Δ son entre Básico (B) y Avanzado (A) del evaluador PECT-extendido.

**Sección 2 — Diseño y comunicación del plan:**
- `plan_de_trabajo` — Δ=+1 (1→2). Item discriminador en niveles intermedios.
- `cierre` — Δ=+1 (2→3). Detecta calidad del cierre de sesión.

**Sección 3 — Actitud de la terapeuta (agregados V4):**
- `curiosidad_cordialidad` — Δ=+2 (2→4). Item de alta discriminación.
- `manejo_silencios` — Δ=+2 (1→3). El silencio funcional es un marcador clínico clásico.
- `actitud_etica` — Δ=+1 (3→4). Baja discriminación pero alto valor formativo.
- `espontaneidad` — Δ=+1 (2→3).

**Sección 6 — Evaluación del proceso:**
- `identifica_tensiones` — Δ=+2 (1→3). **Marcador empírico fuerte de pericia avanzada.**
- `timing` — Δ=+1.
- `desarrollo_vinculo` — Δ=+1.
- `monitoreo_avance` y `repara_tensiones` — Δ=0 en F4, pero su ausencia es diagnóstica.

**Sección 7 — Intervenciones principales:**
- `explorar_contenidos`, `sintonia_paciente`, `apoyar`, `resignificar` — todas con Δ=+2.

**Sección 7 — Técnicas específicas (6 con señal):**
- `tec_parafrasis` — Δ=+2 (1→3). Técnica básica.
- `tec_reflejo` — Δ=+2 (1→3). Técnica básica.
- `tec_focalizacion` — Δ=+2 (1→3). Técnica intermedia.
- `tec_clarificacion` — Δ=+2 (1→3). Técnica básica/intermedia.
- `tec_argumentacion` — Δ=+2 (1→3).
- `tec_tareas` — Δ=+2 (1→3). Técnica de cierre/entre-sesiones.

**Técnicas excluidas de evaluación V4 (11 técnicas restantes):** autorrevelación, confrontación, consejo, imaginación, información, interpretación, metáfora, paradoja, refuerzo, resumen, role playing. Estas técnicas mostraron Δ=0 en F4 (es decir, ningún estudiante las usó o el evaluador no las identificó). V4 puede detectarlas pasivamente (campos en BD) pero NO penaliza su ausencia ni las muestra como déficit. Si en F5/F6 muestran señal con más estudiantes, se activan.

### 2.3 Dimensiones del libro NO evaluables vía chat

Tres áreas del libro permanecen fuera del alcance de V4 y de cualquier evaluación automática:

- **Sección 4 (Características de la terapeuta):** apariencia, autocuidado, conciencia de reacciones fisiológicas propias. Requiere co-presencia o autoinforme.
- **Sección 5 (Conceptualización del caso):** teoría psicopatológica, del desarrollo, del trauma. Requiere informe escrito o supervisión oral.
- **Sub-ítems específicos:** consentimientos informados (UI), derivaciones, informes de caso, aplicación de sugerencias de supervisión.

**Decisión:** estas dimensiones NO entran en V4 ni como flag ni como métrica. Se documenta en la UI del estudiante una nota: *"Esta evaluación cubre los aspectos observables en la conversación. Las dimensiones de Conceptualización del caso y Características personales se trabajan en supervisión presencial."*

---

## 3. Estructura de evaluación propuesta

### 3.1 Dominios visibles para el estudiante: de 2 a 4

V3 muestra 2 dominios en la UI (Estructura + Actitudes). V4 expande a **4 dominios visibles**, que mapean directamente a las 6 secciones del libro evaluables vía chat:

| Dominio UI V4 | Secciones libro | # Ítems V4 | Color sugerido |
|---|---|---|---|
| **Estructura y plan** | 1 + 2 | 8 (5 + 3) | #7C3AED púrpura |
| **Actitudes terapéuticas** | 3 | 10 | #4A55A2 indigo |
| **Proceso y vínculo** | 6 | 5 | #0891B2 cian |
| **Intervenciones y técnicas** | 7 (principales + 6 técnicas) | 4 + 6 | #D97706 ámbar |

Razón de agrupar Estructura + Plan: ambas son pre-sesión / arranque y la separación didáctica (ítems de la sección 2 son escasos y aparecen entremezclados con los de la sección 1 en la fase inicial). Razón de mantener Intervenciones como dominio propio: la dimensión técnica fue la más invisible en V3 y merece visibilidad propia.

### 3.2 Las 17 técnicas: evaluadas todas, mostradas selectivamente

**Evaluación interna:** el LLM evalúa las **17 técnicas** del libro como ítems independientes (compatibilidad total con la pauta). Esto evita perder señal si una técnica empieza a aparecer con uso real.

**Presentación al estudiante:** se muestran solo las **6 técnicas con señal empírica F4** (paráfrasis, reflejo, focalización, clarificación, argumentación, asignación de tareas), con su score 0-4 y al menos una cita textual.

Las **11 técnicas restantes** se guardan en BD pero **no aparecen en la UI** hasta que F5/F6 demuestre que algún estudiante las usa con regularidad. Esto evita ruido visual y la sensación de "11 ítems vacíos".

### 3.3 Evaluador en cascada (dos pasadas)

Para preservar la UI familiar V3 sin sacrificar la granularidad PECT, V4 usa **un único call al LLM** que devuelve dos shapes:

1. **Pasada PECT-ext (interna):** 35 ítems + 17 técnicas → 52 scores con evidencia. Es el output crudo, persistido en `session_techniques` y `session_pect_items`.
2. **Pasada agregada (UI):** 4 dominios + 10 competencias derivadas (compatibles con el radar V2). La agregación se hace en código (no en el LLM) usando reglas determinísticas — esto evita drift de un call a otro.

**Regla de agregación dominio → competencia V2:**

```text
overall_dominio = promedio de ítems del dominio con score numérico (0-4),
                  excluyendo "NA". Si todos NA → null.
```

Las 10 competencias V3 sobreviven como "vista legacy" en el radar, con esta proyección:

```text
setting_terapeutico → setting_comunicado (1 a 1)
motivo_consulta     → motivo_consulta (1 a 1)
datos_contextuales  → datos_contextuales (1 a 1)
objetivos           → objetivos (1 a 1)
escucha_activa      → escucha_activa (1 a 1)
actitud_no_valorativa → actitud_no_valorativa (1 a 1)
optimismo           → optimismo (1 a 1)
presencia           → presencia (1 a 1)
conducta_no_verbal  → conducta_no_verbal (1 a 1)
contencion_afectos  → contencion_afectos (1 a 1)
```

Es decir, las 10 V3 se mantienen idénticas (esto preserva el radar) y las nuevas 25 competencias + 17 técnicas viven como capa adicional.

---

## 4. Schema de base de datos

### 4.1 Filosofía

V3 modificó `session_competencies` con `na_justifications JSONB` y `ai_original JSONB`. V4 sigue el mismo principio (additive, retrocompatible) pero agrega **dos tablas hijas** para no inflar la fila central.

### 4.2 Nueva migración: `20260520120000_feedback_engine_v4.sql`

```sql
-- ============================================================
-- Feedback Engine V4 — Schema additive
-- ============================================================
-- V4 expande la cobertura PECT de 10 a 35 ítems + 17 técnicas.
-- Mantiene session_competencies intacta (las 10 V2/V3 siguen vivas).
-- Agrega dos tablas para los ítems y técnicas adicionales.
-- Flag de versión: ai_original.rubric_version = "v4.0"
-- ============================================================

-- 1) Ítems PECT extendidos (los 25 ítems nuevos)
CREATE TABLE IF NOT EXISTS public.session_pect_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  item_key TEXT NOT NULL,            -- ej. 'manejo_silencios', 'timing', 'plan_de_trabajo'
  section TEXT NOT NULL,             -- ej. 'estructura', 'actitud', 'proceso', 'intervenciones'
  score INTEGER,                     -- NULL = NA, 0-4 = puntaje
  evidence JSONB DEFAULT '[]'::jsonb,
  na_justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, item_key)
);

CREATE INDEX idx_session_pect_items_conversation ON public.session_pect_items(conversation_id);
CREATE INDEX idx_session_pect_items_student ON public.session_pect_items(student_id);

-- 2) Técnicas terapéuticas (las 17 del libro, evaluadas todas)
CREATE TABLE IF NOT EXISTS public.session_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  technique_key TEXT NOT NULL,       -- ej. 'tec_parafrasis', 'tec_reflejo'
  score INTEGER,                     -- NULL = NA, 0-4 = puntaje
  evidence JSONB DEFAULT '[]'::jsonb,
  shown_to_student BOOLEAN DEFAULT FALSE,  -- TRUE solo para las 6 con señal F4
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, technique_key)
);

CREATE INDEX idx_session_techniques_conversation ON public.session_techniques(conversation_id);
CREATE INDEX idx_session_techniques_student ON public.session_techniques(student_id);
CREATE INDEX idx_session_techniques_shown ON public.session_techniques(shown_to_student) WHERE shown_to_student = TRUE;

-- 3) RLS — mismas reglas que session_competencies
ALTER TABLE public.session_pect_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own pect items"
  ON public.session_pect_items FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students see own techniques"
  ON public.session_techniques FOR SELECT
  USING (auth.uid() = student_id);

-- 4) Service role policy (para route handlers que escriben con SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY "Service role full access pect items"
  ON public.session_pect_items FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access techniques"
  ON public.session_techniques FOR ALL TO service_role USING (true);

-- 5) Dominios agregados (opcional — denormalizado para queries rápidos en dashboard)
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS dominio_estructura_plan NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS dominio_actitudes NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS dominio_proceso_vinculo NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS dominio_intervenciones NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS overall_score_v4 NUMERIC(3, 1);

COMMENT ON TABLE public.session_pect_items IS
  'V4: ítems PECT extendidos (25 ítems nuevos no cubiertos por session_competencies V3).';
COMMENT ON TABLE public.session_techniques IS
  'V4: técnicas terapéuticas del PECT sección 7 (17 técnicas evaluadas, 6 mostradas al estudiante).';
```

### 4.3 Backward compat con V3

- `session_competencies` se mantiene intacta. Sus 10 columnas V2/V3 siguen siendo la fuente para el radar.
- `eval_version` sigue siendo `2` (no se incrementa). La distinción V3/V4 se hace por `ai_original.rubric_version`.
- Sesiones históricas V3 (`rubric_version = "v3.0"`) seguirán funcionando sin cambios en la UI.
- Sesiones V4 (`rubric_version = "v4.0"`) tendrán datos adicionales en las dos tablas hijas. La UI detecta su presencia y muestra los dominios extendidos.

### 4.4 Estimación de costo en tokens

- Prompt V3 actual: ~16k chars (~4000 tokens).
- Prompt V4: ~28k chars (~7000 tokens) — duplica el rubric con 25 ítems extra + 17 técnicas + reglas anti-NA expandidas.
- Output V3: ~1.5k tokens.
- Output V4: ~2.5k tokens (52 scores + evidencia mínima).
- **Costo por sesión:** estimado **~$0.10 USD con gpt-4o** vs ~$0.06 actual. Incremento ~67%. Cache hit típico ~40% (prompt es estable), costo efectivo: ~$0.07.
- **Aceptable:** GlorIA cobra licencia institucional, no por sesión. El costo unitario es marginal.

---

## 5. Prompt al LLM evaluador V4

### 5.1 Estructura del prompt

El prompt V4 mantiene la estructura V3 pero expande tres bloques:

```
SECCIÓN 0 — Contexto de sesión (igual que V3, con buildUserMessage)
SECCIÓN 1 — Escala PECT (literal del libro: 0=NA, 1=Ausente, 2=Insuficiente, 3=Buena, 4=Excelente)
SECCIÓN 2 — Reglas críticas anti-NA por contexto (expandidas, ver §5.2)
SECCIÓN 3 — Rúbrica conductual por competencia (35 ítems × 4 niveles + descriptor NA)
SECCIÓN 4 — 17 técnicas (descriptor breve + ejemplos del libro)
SECCIÓN 5 — Evidencia obligatoria (al menos 2 citas para scores 1-4 en los 10 ítems V3, 1 cita para los 25 ítems nuevos)
SECCIÓN 6 — Formato JSON estricto (52 scores + evidencia + commentary + strengths + areas_to_improve)
```

### 5.2 Reglas anti-NA por contexto

V3 sufrió de NA sistemático en `objetivos` y `optimismo`. V4 codifica reglas explícitas por contexto:

| Competencia | Regla NA-permitido | Regla NA-prohibido (auto-rechazo del LLM) |
|---|---|---|
| `setting_comunicado` | Solo si sesión 2+ y no hay quiebre de encuadre. | Primera sesión SIEMPRE evaluable (NA prohibido). |
| `motivo_consulta` | Solo si sesión 2+ y no emerge nuevo motivo. | Primera sesión SIEMPRE evaluable. |
| `datos_contextuales` | Solo si sesión 2+ y la red contextual ya está mapeada. | Primera sesión SIEMPRE evaluable. |
| `objetivos` | Solo si la sesión completa fue exploración inicial Y duración < 20min. | Si la sesión > 30min y aún no se abrieron objetivos → 0 (omitido), NO NA. |
| `optimismo` | Solo si hubo crisis aguda, duelo intenso o ideación suicida en la sesión. | Bandera amarilla F4: si la sesión transcurrió "normal", optimismo NO es NA. |
| `manejo_silencios` | Solo si el paciente no produjo silencios significativos. | Si hubo silencios >5s y el estudiante los ignoró → 1, NO NA. |
| `actitud_etica` | Casi nunca NA. | Cualquier sesión ofrece oportunidades éticas mínimas. |
| `repara_tensiones` | NA si nunca se detectó tensión. | Si se detectó tensión y no se intentó reparar → 0, NO NA. |
| `monitoreo_avance` | NA en primera sesión. | Sesión 2+ con avance ya pactado: evaluable. |
| **Técnicas** | NA permitido si el contexto de la sesión no demandaba esa técnica. | Si demandaba la técnica y NO se usó → 1, NO NA. |

### 5.3 Manejo de evidencia múltiple

V3 ya requiere ≥2 citas por competencia con score numérico. V4 lo mantiene **solo para las 10 competencias V3** (las dimensiones centrales del radar). Para los **25 ítems agregados** y **17 técnicas**, basta **1 cita** mínima. Razón: si pedimos 2 citas para 52 ítems el output supera los 3500 tokens y empieza a alucinar.

Las citas viven en `evidence: {item_key: [{quote, turn, observation, polarity}, ...]}` con el mismo shape V3.

### 5.4 Output esperado (JSON)

```json
{
  "scores": {
    "setting_comunicado": 3,
    "setting_modificado": "NA",
    "motivo_consulta": 3,
    "datos_contextuales": 2,
    "objetivos": 2,
    "plan_de_trabajo": 2,
    "modifica_tareas_metas": "NA",
    "cierre": 3,
    "escucha_activa": 3,
    "actitud_no_valorativa": 4,
    "optimismo": 3,
    "presencia": 3,
    "conducta_no_verbal": 3,
    "contencion_afectos": 3,
    "curiosidad_cordialidad": 3,
    "espontaneidad": 3,
    "manejo_silencios": 3,
    "actitud_etica": 4,
    "timing": 3,
    "desarrollo_vinculo": 3,
    "identifica_tensiones": 2,
    "repara_tensiones": "NA",
    "monitoreo_avance": "NA",
    "explorar_contenidos": 3,
    "sintonia_paciente": 3,
    "apoyar": 3,
    "resignificar": 2,
    "tec_parafrasis": 3,
    "tec_reflejo": 3,
    "tec_focalizacion": 2,
    "tec_clarificacion": "NA",
    "tec_argumentacion": "NA",
    "tec_tareas": 2
  },
  "dominio_scores": {
    "estructura_plan": 2.6,
    "actitudes": 3.1,
    "proceso_vinculo": 2.5,
    "intervenciones": 2.8
  },
  "overall_score_v4": 2.75,
  "na_justifications": { "setting_modificado": "...", "..." },
  "commentary": "...",
  "strengths": [...],
  "areas_to_improve": [...],
  "evidence": { "item_key": [...] }
}
```

**Importante:** `dominio_scores` y `overall_score_v4` SE CALCULAN EN CÓDIGO desde `scores`, no se confía en el LLM (V3 ya mostró que el LLM redondea inconsistentemente).

---

## 6. Cambios en UI

### 6.1 Vista del estudiante (ReviewClient.tsx)

La UI V4 se sirve con un **toggle interno** que detecta `rubric_version`:

```text
if (rubric_version === "v4.0"):
  Mostrar radar V2 (10 competencias, igual que ahora)
  + Bloque expansible "Detalle por dominio" con los 4 dominios y sus ítems
  + Bloque expansible "Técnicas observadas" con las 6 técnicas con señal
elif (rubric_version === "v3.0" || legacy):
  Mostrar UI V3 actual (sin cambios)
```

### 6.2 Mockup textual del nuevo bloque

```
┌────────────────────────────────────────────────┐
│  RADAR DE COMPETENCIAS (sin cambios)           │
│  [radar V2 con 10 ejes]                        │
└────────────────────────────────────────────────┘

▼ Detalle por dominio  (colapsado por defecto)

  ESTRUCTURA Y PLAN  ●●●○ 2.6/4
    Setting terapéutico:     3
    Motivo de consulta:      3
    Datos contextuales:      2
    Objetivos:               2
    Plan de trabajo:         2
    Cierre:                  3

  ACTITUDES TERAPÉUTICAS  ●●●● 3.1/4
    Escucha activa:          3
    Actitud no valorativa:   4
    Optimismo:               3
    Presencia:               3
    Conducta no verbal:      3
    Contención de afectos:   3
    Curiosidad/cordialidad:  3      ← nuevo V4
    Espontaneidad:           3      ← nuevo V4
    Manejo de silencios:     3      ← nuevo V4
    Actitud ética:           4      ← nuevo V4

  PROCESO Y VÍNCULO  ●●○○ 2.5/4   ← nuevo dominio V4
    Timing:                  3
    Desarrollo del vínculo:  3
    Identifica tensiones:    2
    Repara tensiones:        N/A
    Monitorea avance:        N/A

  INTERVENCIONES Y TÉCNICAS  ●●●○ 2.8/4   ← nuevo dominio V4
    Explorar contenidos:     3
    Sintonía con el paciente: 3
    Ofrecer apoyo:           3
    Resignificación:         2

    Técnicas observadas en esta sesión:
      Paráfrasis:            3   "Entiendo que sientes..."
      Reflejo:               3   "Te veo desganado..."
      Focalización:          2   "Volvamos a lo que..."

▼ Lo que NO se evaluó automáticamente
  · Tu autocuidado y manejo de afectos propios
  · Tu conceptualización del caso
  · Tu apariencia y conducta no verbal de ti misma
  (estas dimensiones se trabajan en supervisión presencial)
```

### 6.3 Radar V2 — ¿sobrevive?

**Sí.** El radar V2 con 10 ejes se mantiene intacto. Razón: es la imagen central de retroalimentación, los estudiantes ya lo conocen, y los 10 ejes mapean a las 10 competencias V3 (que son las más visibles del libro). El detalle V4 vive como **información secundaria expandible**, no reemplaza el radar.

**Alternativa rechazada:** radar con 35 ejes. Es ilegible y satura visualmente. La granularidad PECT vive en la lista expandible, no en el SVG.

### 6.4 Vista del docente (TeacherReviewClient)

El docente ve **todos los 52 scores** sin colapsar, en una tabla. Puede editar cualquiera, con la edición persistida en `session_pect_items` o `session_techniques`. La fila V2 en `session_competencies` se recalcula automáticamente al editar un ítem de su dominio (vía trigger SQL o lógica en route handler — TBD).

---

## 7. Migración V3 → V4

### 7.1 Datos históricos

**Decisión:** las sesiones V3 NO se re-evalúan retroactivamente con V4. Razón:

- Cada re-evaluación cuesta ~$0.10 USD. Con ~3000 sesiones históricas estaríamos en $300 + 3 horas de cómputo.
- El valor pedagógico es bajo: los estudiantes que vieron una sesión V3 ya internalizaron la retroalimentación recibida.
- La fidelidad histórica es importante: cambiar retroactivamente las evaluaciones podría confundir a estudiantes que comparan sesiones.

**Lo que SÍ se hace:** las sesiones V3 conviven con sesiones V4 sin fricción. El radar de progreso del estudiante muestra ambas en el mismo gráfico (las 10 competencias V2 son comunes). El bloque "Detalle por dominio" aparece solo en sesiones V4.

### 7.2 Plan de rollout

| Fase | Etapa | Validación | Decisión gate |
|---|---|---|---|
| F5.1 | Implementación V4 en rama `feat/v4-feedback-engine` | Tests unitarios + 1 sesión sintética | PR review |
| F5.2 | Despliegue a staging (`vhkbbps...`) con feature flag `FEEDBACK_ENGINE_V4=true` | Smoke test con 5 sesiones reales del piloto interno | Approve por dueño técnico |
| F5.3 | Activación gradual en PROD: 10% del tráfico durante 1 semana | Monitoreo de tasa de NA, distribución de scores, costo en tokens | Dashboard de salud V4 |
| F5.4 | 100% en PROD | Sesiones V4 corren en paralelo con V3 históricas | — |
| F6 | Validación con Escuela de Psicología UGM (ver §8) | Sesión de revisión clínica con 3 docentes UGM + Nelson Valdés (UST si disponible) | Ajustes finales antes de marcar V4 estable |

### 7.3 Feature flag

```typescript
// src/lib/feature-flags.ts
export const FEEDBACK_ENGINE_VERSION =
  process.env.FEEDBACK_ENGINE_V4 === "true" ? "v4" : "v3";
```

- Default: `v3` (estado actual).
- Override por institución / piloto: posible vía columna en `profiles` o `institutions`.
- Rollback inmediato: cambiar env var, no requiere redeploy de migración.

### 7.4 Riesgos del rollout

- **Inconsistencia visual:** un estudiante con sesiones V3 y V4 verá el bloque expandible solo en algunas. Mitigación: nota informativa "Detalle ampliado disponible desde mayo 2026".
- **Costo runaway:** si el flag se activa global de golpe en una institución con 200 estudiantes/día, el costo en LLM se duplica. Mitigación: rollout 10%/30%/100% en una semana, monitorear factura diaria.

---

## 8. Validación esperada con UGM (F6)

V4 es un diseño técnico, no clínico. Necesita validación de la Escuela de Psicología antes de marcarse como estable.

### 8.1 Preguntas para Nelson Valdés Sánchez (UST, co-autor de la PECT)

1. **¿Es legítimo evaluar la PECT a partir de una transcripción de chat sin video/audio?** La PECT fue diseñada para sesiones presenciales con observación. ¿Qué validez y limitaciones implica reducir el canal?
2. **Las 4 técnicas excluidas por baja señal F4** (autorrevelación, confrontación, paradoja, role playing): ¿son centrales para el modelo de competencias o periféricas? Si son centrales, ¿cómo deberíamos forzar su detección?
3. **Las anclas conductuales por nivel** (heredadas de `fix/v3-fidelity-pect`): ¿son fieles al espíritu del Cap. 2 del libro o requieren ajuste?
4. **Escala 0=NA vs 0=Omitido:** el libro define 0=NA. V3 inventó la distinción NA(null)/Omitido(0). ¿Es una innovación útil o se aparta del instrumento?
5. **Validez del evaluador LLM:** ¿UST tiene experiencia (o interés) en estudios de concordancia inter-evaluador entre supervisores humanos y LLMs?

### 8.2 Preguntas para la Escuela de Psicología UGM

1. **Adopción curricular:** ¿los 4 dominios V4 (Estructura+Plan, Actitudes, Proceso+Vínculo, Intervenciones) son legibles para una estudiante de 3° año?
2. **Carga cognitiva:** ¿35 ítems + 6 técnicas mostradas es demasiado o útil?
3. **Lenguaje de la rúbrica:** las anclas usan vocabulario técnico (e.g., "co-construcción explícita", "resignificación"). ¿Necesita glosa pedagógica adicional?
4. **Dimensiones excluidas:** ¿la Escuela está de acuerdo con que Conceptualización del caso y Características de la terapeuta vivan fuera del chat y se evalúen en supervisión presencial?
5. **Sesgo del paciente IA:** Diego Fuentes en F4 puede no haber generado todos los gatillos esperables. ¿La Escuela puede aportar 2-3 casos clínicos arquetípicos para diseñar pacientes IA que estresen las 35 dimensiones?

### 8.3 Decisiones que requieren validación clínica antes de implementar

1. **Anclas conductuales finales por nivel** (35 ítems × 4 niveles = 140 descriptores). Es el bloque más caro de validar pero el más sensible.
2. **Reglas anti-NA por competencia.** Las que propone V4 son inferidas; necesitan revisión clínica.
3. **Pesos en el `overall_score_v4`.** El borrador V4 usa promedio simple. ¿Algunas dimensiones (e.g., Actitud Ética, Repara Tensiones) deberían pesar más?

---

## 9. Riesgos y trade-offs

### 9.1 Riesgo técnico

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Output del LLM alucina 52 scores | Media | Alta | Validar shape, fallback a V3 si parseo falla, log de fallos |
| Costo en tokens 2x | Alta (cierto) | Media | Prompt caching ~40%; está dentro del presupuesto institucional |
| Latencia ↑ (más output) | Media | Baja | Stream del LLM, mostrar UI parcial mientras llega el resto |
| LLM evalúa técnicas como NA en masa | Media | Alta | Reglas anti-NA específicas para técnicas (§5.2) + post-procesamiento que detecta NA sistemático |

### 9.2 Riesgo pedagógico

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Estudiante se siente sobre-evaluado | Media | Alta | UI con detalle colapsado; radar V2 sigue siendo la imagen central |
| Estudiante interpreta mal los nuevos ítems | Alta | Media | Tooltips clínicos (CompetencyTooltip ya existe), validar lenguaje con UGM |
| Docente sobrecarga al editar 52 scores | Media | Alta | Vista del docente con scores LLM precargados; edición opcional, no requerida |

### 9.3 Riesgo clínico

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| LLM evalúa una técnica como adecuada cuando no lo es (falso positivo) | Alta | Media | Evidencia textual obligatoria; docente puede invalidar |
| LLM no detecta riesgo clínico (suicidalidad, crisis) | Baja | Crítica | V4 NO reemplaza el flujo de alertas de chat (chat_alerts ya cubre esto) |
| Sobre-confianza en el score numérico | Alta | Alta | UI muestra "evaluación automática preliminar — revisión docente recomendada" |

### 9.4 Trade-off central

**V4 sacrifica simplicidad por fidelidad al instrumento.** V3 era didácticamente más limpio (10 competencias) pero clínicamente incompleto (cubría 22% del PECT). V4 acepta la complejidad de 35+6 ítems para honrar el instrumento de Valdés & Gómez Gallo. La justificación es ética: si GlorIA dice citar la PECT, debe cubrirla.

**Salvaguarda contra complejidad:** la UI mantiene la jerarquía de información (radar V2 prominente, detalle V4 colapsado). El estudiante no se enfrenta a 35 ítems al abrir la página.

---

## 10. Próximos pasos (post-aprobación)

1. **Sub-diseño detallado:** `docs/v4/anclas-conductuales.md` con las 35 × 4 = 140 anclas. Heredar de `fix/v3-fidelity-pect` para las 10 V3; redactar las 25 nuevas.
2. **Sub-diseño detallado:** `docs/v4/migracion-data.md` con plan de rollout granular y queries de verificación.
3. **Implementación:** rama `feat/v4-feedback-engine` (separada de `feat/v4-design`), commits atómicos por componente (schema → prompt → parseo → UI).
4. **Smoke test:** repetir F4 con V4 implementado y comparar contra PECT-extendido. Esperar que V4 cierre el gap de 0.43 → ~0.1.
5. **Validación humana:** F6 con UGM + Nelson Valdés (UST).

---

## Apéndice A — Crosswalk completo V3 ↔ V4 ↔ PECT-libro

| Ítem V3 (10) | Ítem V4 (35) | Sección PECT | Δ B→A en F4 | Mantenido en radar V2 |
|---|---|---|---|---|
| setting_terapeutico | setting_comunicado | 1 | +2 | Sí |
| — | setting_modificado | 1 | 0 | No (solo BD) |
| motivo_consulta | motivo_consulta | 1 | +2 | Sí |
| datos_contextuales | datos_contextuales | 1 | +2 | Sí |
| objetivos | objetivos | 1 | +1 | Sí |
| — | plan_de_trabajo | 2 | +1 | No |
| — | modifica_tareas_metas | 2 | 0 | No |
| — | cierre | 2 | +1 | No |
| escucha_activa | escucha_activa | 3 | +2 | Sí |
| actitud_no_valorativa | actitud_no_valorativa | 3 | +2 | Sí |
| optimismo | optimismo | 3 | +1 | Sí |
| presencia | presencia | 3 | +2 | Sí |
| conducta_no_verbal | conducta_no_verbal | 3 | +3 | Sí |
| contencion_afectos | contencion_afectos | 3 | +2 | Sí |
| — | curiosidad_cordialidad | 3 | +2 | No |
| — | espontaneidad | 3 | +1 | No |
| — | manejo_silencios | 3 | +2 | No |
| — | actitud_etica | 3 | +1 | No |
| — | timing | 6 | +1 | No |
| — | desarrollo_vinculo | 6 | +1 | No |
| — | identifica_tensiones | 6 | +2 | No |
| — | repara_tensiones | 6 | 0 | No |
| — | monitoreo_avance | 6 | 0 | No |
| — | explorar_contenidos | 7 | +2 | No |
| — | sintonia_paciente | 7 | +2 | No |
| — | apoyar | 7 | +2 | No |
| — | resignificar | 7 | +2 | No |
| — | tec_parafrasis | 7 | +2 | No (mostrado en bloque técnicas) |
| — | tec_reflejo | 7 | +2 | No (mostrado en bloque técnicas) |
| — | tec_focalizacion | 7 | +2 | No (mostrado en bloque técnicas) |
| — | tec_clarificacion | 7 | +2 | No (mostrado en bloque técnicas) |
| — | tec_argumentacion | 7 | +2 | No (mostrado en bloque técnicas) |
| — | tec_tareas | 7 | +2 | No (mostrado en bloque técnicas) |

---

## Apéndice B — Referencias

- Valdés Sánchez, N. & Gómez Gallo, D. (2023). *Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas.* Cap. 2 + Anexo B. Ediciones Universidad Santo Tomás / RIL Editores.
- F4 — Proyección Empírica V3 vs PECT-extendido (2026-05-18). `C:/tmp/projection/analysis.md`.
- INF-2026-053 — Análisis crítico motor V3 vs PECT. `informes/desarrollo/INF-2026-053_analisis-motor-v3-vs-pect.docx`.
- INF-2026-052 — Definición de las 10 competencias del motor V3.
- Rama `fix/v3-fidelity-pect` (commit f3bd674) — anclas conductuales fieles al libro, NO mergeada a master al momento de este diseño.
