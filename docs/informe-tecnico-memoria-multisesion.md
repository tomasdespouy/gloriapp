# Informe Técnico: Sistema de Memoria Multi-Sesión y RAG

**Plataforma:** GlorIA v2
**Fecha:** 16 de marzo de 2026
**Autor:** Equipo de desarrollo GlorIA

---

## 1. Resumen ejecutivo

Se implementó un sistema de memoria a largo plazo para pacientes virtuales que permite continuidad narrativa entre sesiones terapéuticas. Cada paciente ahora recuerda TODAS las sesiones previas con un mismo estudiante, hereda el estado clínico acumulado, y puede hacer referencias espontáneas a conversaciones pasadas.

---

## 2. Arquitectura del sistema de memoria

### 2.1 Flujo completo de un mensaje (diagrama)

```
ESTUDIANTE envía mensaje
         │
         ▼
    POST /api/chat
         │
    ┌────┴────────────────────────────────────────┐
    │  1. Autenticación (Supabase Auth)           │
    │  2. Cargar paciente (caché LRU, TTL 10min)  │
    │  3. Contexto temporal (timezone del país)    │
    │  4. ★ MEMORIA MULTI-SESIÓN ★                │
    │     ├─ Cargar TODOS los session_summaries    │
    │     │  (resúmenes de sesiones 1..N-1)        │
    │     └─ Cargar detalle última sesión          │
    │        (30 mensajes crudos más recientes)    │
    │  5. Crear/reusar conversación                │
    │  6. Guardar mensaje + cargar historial (50)  │
    │  7. ★ ESTADO CLÍNICO HEREDADO ★             │
    │     ├─ Buscar en caché de conversación       │
    │     ├─ Si no hay → buscar en clinical_state  │
    │     ├─ Si es sesión nueva → heredar de       │
    │     │  session_summaries.final_clinical_state │
    │     └─ Si no hay historial → INITIAL_STATE   │
    │  8. Clasificar intervención terapéutica      │
    │  9. Calcular deltas de estado                │
    │ 10. ★ RAG DUAL ★                            │
    │     ├─ Vector RAG (pgvector, cosine sim.)    │
    │     └─ Keyword RAG (fallback, 25 entradas)   │
    │ 11. Ensamblar system prompt completo         │
    │ 12. Stream respuesta del LLM                 │
    │ 13. Guardar respuesta + log estado clínico   │
    └─────────────────────────────────────────────┘
         │
         ▼
    ESTUDIANTE ve respuesta (streaming, 35ms/char)
```

### 2.2 Ensamblaje del system prompt

El prompt enviado al LLM se construye en este orden:

| # | Componente | Origen | Tamaño estimado |
|---|-----------|--------|-----------------|
| 1 | System prompt base del paciente | `ai_patients.system_prompt` | ~2000 tokens |
| 2 | Contexto temporal | Generado (fecha, hora, timezone) | ~50 tokens |
| 3 | Reglas de rol | Hardcoded (PACIENTE, no terapeuta) | ~200 tokens |
| 4 | **Memoria multi-sesión** | `session_summaries` + últimos mensajes | ~100-800 tokens |
| 5 | Estado clínico condicionado | `clinical_state_engine` | ~150 tokens |
| 6 | RAG clínico | `clinical_knowledge` (vector/keyword) | ~200 tokens |
| 7 | Regla anti-repetición | Hardcoded | ~30 tokens |

**Total estimado:** 2,700 - 3,400 tokens de system prompt.

---

## 3. Sistema de memoria multi-sesión

### 3.1 Generación de resúmenes (POST /api/sessions/{id}/complete)

Cuando un estudiante completa una sesión, el sistema:

1. Evalúa competencias clínicas (LLM)
2. Calcula XP y logros
3. **Genera un resumen de sesión** usando el LLM con el siguiente prompt:

```
"Resume esta sesión terapéutica para la memoria a largo plazo del paciente."
```

El resumen se genera en primera persona del paciente e incluye:
- **summary**: Narrativa de 80-120 palabras con datos concretos
- **key_revelations**: Array de secretos/datos importantes revelados
- **therapeutic_progress**: Estado de la relación terapéutica

4. **Guarda el estado clínico final** de la sesión (resistencia, alianza, apertura, sintomatología, disposición al cambio)

### 3.2 Tabla `session_summaries`

```sql
session_summaries (
  id                   UUID PRIMARY KEY
  conversation_id      UUID UNIQUE → conversations
  student_id           UUID → profiles
  ai_patient_id        UUID → ai_patients
  session_number       INTEGER
  summary              TEXT          -- Resumen narrativo en 1ra persona
  key_revelations      TEXT[]        -- Datos clave revelados
  therapeutic_progress TEXT          -- Estado de la relación
  final_clinical_state JSONB         -- {resistencia, alianza, ...}
  created_at           TIMESTAMPTZ
)

INDEX: (student_id, ai_patient_id, session_number)
```

### 3.3 Carga de memoria (función loadMemory)

Al iniciar un nuevo mensaje, el sistema carga:

**Capa 1 — Resúmenes de TODAS las sesiones previas:**
```
[MEMORIA A LARGO PLAZO — SESIONES ANTERIORES CON ESTE TERAPEUTA]
Has tenido 7 sesión(es) previa(s) con este terapeuta.

--- Sesión 1 (hace 14 días) ---
En mi primera sesión le conté al terapeuta sobre mi ansiedad...
Revelaciones clave: Mencioné que mi madre se enfermó; No duermo bien
Estado de la relación: Desconfiado pero dispuesto a volver

--- Sesión 2 (hace 12 días) ---
...

--- Sesión 7 (hace 2 días) ---
...
```

**Capa 2 — Detalle de la última sesión** (30 mensajes crudos):
```
--- Detalle de la última sesión (hace 2 días) ---
[14:23] TERAPEUTA: ¿Cómo ha estado desde la última vez?
[14:23] TU (PACIENTE): Más o menos... la verdad es que...
```

### 3.4 Herencia de estado clínico

**Regla:** Mismo estudiante → hereda estado. Distinto estudiante → estado fresco.

```
Sesión nueva, mismo estudiante:
  1. Buscar en session_summaries.final_clinical_state
     (última sesión completada del mismo student_id + ai_patient_id)
  2. Si existe → usar como estado inicial
  3. Si no existe → INITIAL_STATE

Sesión nueva, distinto estudiante:
  → No hay session_summaries para ese student_id
  → Se usa INITIAL_STATE automáticamente
```

Valores del estado clínico (escala 0-10):

| Variable | INITIAL_STATE | Significado |
|----------|---------------|-------------|
| resistencia | 7.0 | Qué tan cerrado/defensivo está |
| alianza | 2.0 | Confianza en el terapeuta |
| apertura_emocional | 2.0 | Disposición a hablar de emociones |
| sintomatologia | 7.0 | Intensidad de síntomas |
| disposicion_cambio | 2.0 | Motivación para cambiar |

Si en sesión 7 el paciente terminó con alianza=6.5 y resistencia=3.2, sesión 8 comienza con esos valores, no desde cero.

---

## 4. Sistema RAG dual

### 4.1 Vector RAG (primario)

- **Modelo de embeddings:** OpenAI `text-embedding-3-small` (1536 dimensiones)
- **Base de datos:** Supabase pgvector con índice IVFFlat
- **Tabla:** `clinical_knowledge` (topic, category, content, source, embedding)
- **Búsqueda:** Similitud coseno, umbral 0.40, top 3 resultados
- **Contexto de búsqueda:** Últimos 4 mensajes + mensaje actual

```sql
SELECT topic, category, content, source,
       1 - (embedding <=> query_embedding) AS similarity
FROM clinical_knowledge
WHERE 1 - (embedding <=> query_embedding) > 0.40
ORDER BY similarity DESC
LIMIT 3;
```

### 4.2 Keyword RAG (fallback)

- **Activación:** Solo si vector RAG retorna 0 resultados
- **Base:** 25 entradas hardcoded en `clinical-knowledge.ts`
- **Categorías:** Duelo, ansiedad, depresión, relaciones, estrés laboral, autoestima, familia, aislamiento, ira, crisis vital, técnicas terapéuticas
- **Búsqueda:** Matching de keywords en el contexto reciente

### 4.3 Inyección en prompt

```
[CONOCIMIENTO CLÍNICO RELEVANTE]
Tema: Ansiedad generalizada
Categoría: Trastornos de ansiedad
Contenido: Los síntomas principales incluyen...
Fuente: DSM-5-TR (2022)
[FIN CONOCIMIENTO]
```

---

## 5. Motor de estado clínico adaptativo

### 5.1 Clasificación de intervenciones

El sistema clasifica cada mensaje del terapeuta en una de 11 categorías usando heurísticas de keywords:

| Intervención | Ejemplos de detección |
|-------------|----------------------|
| pregunta_abierta | "¿Cómo...", "¿Qué piensas..." |
| pregunta_cerrada | "¿Sí o no?", "¿Cuándo exactamente?" |
| validacion_empatica | "Entiendo", "Debe ser difícil" |
| reformulacion | "Lo que me dices es que..." |
| confrontacion | "Sin embargo...", "¿No crees que...?" |
| silencio_terapeutico | "..." (solo puntos) |
| directividad | "Deberías", "Tienes que" |
| interpretacion | "Parece que...", "Quizás lo que pasa..." |
| normalizacion | "Es normal", "Muchas personas..." |
| resumen | "Entonces, resumiendo..." |
| otro | (no clasificado) |

### 5.2 Deltas condicionales

Cada tipo de intervención produce cambios en el estado, algunos condicionales:

```
confrontacion + alianza > 5:
  apertura +0.8, disposicion +1.0, resistencia -0.3

confrontacion + alianza ≤ 5:
  resistencia +1.5, alianza -1.0, apertura -1.0
```

Esto simula que confrontar a un paciente sin alianza suficiente genera resistencia.

### 5.3 Persistencia del estado

```
Turno a turno: caché LRU en memoria (TTL 30min)
Fin de sesión: guardado en clinical_state_log (BD)
Entre sesiones: guardado en session_summaries.final_clinical_state (BD)
```

---

## 6. Cachés en producción

| Caché | Propósito | Max entradas | TTL |
|-------|-----------|-------------|-----|
| patientCache | System prompts de pacientes | 100 | 600s (10min) |
| stateCache | Estado clínico por conversación | 500 | 1800s (30min) |

Tipo: LRU en proceso (serverless). Para escalar a 100+ usuarios concurrentes, se puede migrar a Upstash Redis sin cambios de API.

---

## 7. Escalabilidad para 100+ usuarios

### 7.1 Carga estimada

| Métrica | Valor estimado |
|---------|----------------|
| Usuarios concurrentes (pico) | ~30-50 |
| Mensajes/minuto (pico) | ~60-100 |
| Sesiones/día | ~80-150 |
| Resúmenes generados/día | ~80-150 |
| Consultas vector RAG/día | ~3,000-6,000 |

### 7.2 Bottlenecks y mitigaciones

| Componente | Bottleneck | Mitigación |
|-----------|-----------|------------|
| LLM streaming | Rate limits del provider | Dual provider (OpenAI + Gemini) |
| pgvector search | Latencia en tablas grandes | Índice IVFFlat, límite 3 resultados |
| Session summaries | Generación post-sesión (LLM call) | Non-blocking (fire-and-forget) |
| Caché en memoria | Se pierde entre cold starts | clinical_state_log como fallback en BD |
| Supabase connections | Pool limit | Connection pooling via Supavisor |

### 7.3 Límites de contexto

| Tipo | Límite | Justificación |
|------|--------|---------------|
| Historial conversación actual | 50 mensajes | Balance entre contexto y costo |
| Detalle última sesión | 30 mensajes | Continuidad conversacional reciente |
| Resúmenes de sesiones previas | Sin límite (compactos) | ~100 tokens/resumen, 10 sesiones = ~1000 tokens |
| RAG results | 3 documentos | Relevancia > cantidad |

---

## 8. Seguridad y aislamiento de datos

- **RLS (Row Level Security):** Cada estudiante solo accede a sus propias conversaciones, mensajes y resúmenes
- **Aislamiento de estado:** Cada par (estudiante, paciente) tiene su propio historial clínico independiente
- **Caché aislado:** Las keys de caché incluyen `conversationId`, que es único por estudiante+sesión
- **Service role:** Solo las operaciones del servidor (evaluación, resúmenes) usan el client admin

---

## 9. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260316235000_session_summaries.sql` | Nueva tabla `session_summaries` con índices y RLS |
| `src/app/api/sessions/[conversationId]/complete/route.ts` | Genera resumen + guarda estado clínico final al completar sesión |
| `src/app/api/chat/route.ts` | `loadMemory()` carga TODOS los resúmenes + hereda estado clínico de sesión previa |

**Archivos NO modificados (se mantienen):**
| Archivo | Función |
|---------|---------|
| `src/lib/vector-rag.ts` | Vector RAG con pgvector (sin cambios) |
| `src/lib/clinical-knowledge.ts` | Keyword RAG fallback (sin cambios) |
| `src/lib/clinical-state-engine.ts` | Motor de estado clínico (sin cambios) |
| `src/lib/cache.ts` | LRU cache (sin cambios) |

---

## 10. Pruebas pendientes

Para validar la continuidad narrativa, se deben realizar pruebas con 5 pacientes simulando la sesión 8 de un estudiante, verificando que:

1. El paciente hace referencia a eventos de sesiones anteriores
2. El estado clínico refleja la alianza acumulada
3. Las revelaciones clave se mantienen coherentes
4. El paciente no repite información como si fuera nueva

Estas pruebas requieren datos de sesiones previas en `session_summaries`, que se generarán al completar sesiones reales en la plataforma.
