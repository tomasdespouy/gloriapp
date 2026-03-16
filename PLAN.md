# Plan: Análisis Turno-a-Turno Post-Sesión

## Resumen

Generar un análisis detallado por cada intervención del estudiante después de finalizar la sesión. El análisis es generado por IA, revisado/editado por el docente, y liberado al estudiante solo tras aprobación. Se apoya en infraestructura existente: `clinical_state_log` (datos de estado por turno) y `message_annotations` (tabla ya creada, sin uso actual).

---

## Flujo completo

```
Sesión finaliza → Estudiante envía reflexión → AI evalúa competencias globales (ya existe)
                                                ↓
                                    AI genera análisis turno-a-turno
                                    (usa clinical_state_log + transcript)
                                                ↓
                                    Resultados guardados en message_annotations
                                                ↓
                                    Docente ve transcripción anotada
                                    (puede editar/eliminar/agregar anotaciones)
                                                ↓
                                    Docente aprueba → estudiante ve transcripción anotada
```

El análisis turno-a-turno se dispara automáticamente al completar la sesión (dentro del endpoint `/api/sessions/[conversationId]/complete` existente), en paralelo con la evaluación global. No requiere acción extra del docente para generarlo.

---

## Cambios por componente

### 1. API: Nuevo endpoint `POST /api/sessions/[conversationId]/turn-analysis`

**Archivo:** `src/app/api/sessions/[conversationId]/turn-analysis/route.ts`

Endpoint separado que genera el análisis turno a turno. Se puede invocar:
- Automáticamente desde el endpoint `complete` existente (fire-and-forget)
- Manualmente por el docente si quiere regenerar

**Lógica:**
1. Cargar todos los mensajes de la conversación
2. Cargar `clinical_state_log` para la conversación (ya tiene intervention_type, deltas, estado)
3. Construir pares de turnos: `[intervención estudiante, respuesta paciente, estado clínico]`
4. Enviar al LLM con un prompt especializado en evaluación por turno
5. El LLM retorna un JSON array con una anotación por cada turno del estudiante:
   ```json
   [
     {
       "turn": 1,
       "annotation_type": "positive" | "suggestion" | "technique" | "warning",
       "text": "Buena pregunta abierta que invita a explorar...",
       "competency": "escucha_activa",
       "alternative": "Podrías haber reformulado: '¿Qué sientes cuando...?'"  // opcional
     }
   ]
   ```
6. Guardar en `message_annotations` (vinculado al `message_id` del turno del estudiante)

**Prompt del LLM:** Evalúa cada intervención del estudiante considerando:
- Tipo de intervención (dato ya disponible del clinical_state_engine)
- Impacto en el estado clínico (deltas reales del estado del paciente)
- Timing y pertinencia en el contexto de la conversación
- Alternativas concretas cuando la intervención no fue óptima

### 2. Migración: Extender `message_annotations`

**Archivo:** `supabase/migrations/XXXXXX_turn_analysis.sql`

Agregar columnas a `message_annotations`:
- `alternative` TEXT — sugerencia alternativa concreta (opcional)
- `turn_number` INTEGER — número de turno para ordenamiento
- `intervention_type` TEXT — tipo de intervención clasificada
- `clinical_impact` JSONB — deltas del estado clínico en ese turno
- `approved` BOOLEAN DEFAULT false — si el docente aprobó esta anotación específica

Agregar políticas RLS para que instructores puedan insertar/actualizar/eliminar anotaciones.

### 3. Integración con `complete` endpoint

**Archivo:** `src/app/api/sessions/[conversationId]/complete/route.ts`

Agregar al final del endpoint existente (después de guardar competencias):
```typescript
// Fire-and-forget: genera análisis turno-a-turno en background
fetch(`${baseUrl}/api/sessions/${conversationId}/turn-analysis`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
}).catch(() => {}); // No bloquea al estudiante
```

### 4. UI Docente: Transcripción anotada

**Archivo:** `src/app/(app)/docente/sesion/[conversationId]/TeacherReviewClient.tsx`

Reemplazar la transcripción plana actual con una vista anotada:

- Cada mensaje del estudiante muestra un badge con el tipo de intervención (ej: "Pregunta abierta", "Validación empática")
- Debajo de cada mensaje del estudiante, si tiene anotación:
  - Chip de color según `annotation_type`:
    - `positive` → verde: "Buena técnica"
    - `suggestion` → ámbar: "Sugerencia"
    - `technique` → azul: "Técnica identificada"
    - `warning` → rojo: "Atención"
  - Texto de la anotación
  - Alternativa sugerida (si existe), en itálica
  - Competencia asociada como tag
- Mini gráfico sparkline del estado clínico (5 variables) que evoluciona turno a turno
- Botones por anotación: Editar / Eliminar
- Botón global: "Regenerar análisis"
- Botón: "Agregar anotación manual" en cualquier turno

### 5. UI Estudiante: Transcripción anotada (post-aprobación)

**Archivo:** `src/app/(app)/review/[conversationId]/ReviewClient.tsx`

Nuevo step o sección dentro de `step === "results"`:

- Botón "Ver análisis turno a turno" que expande la transcripción anotada
- Solo visible si `feedback_status === "approved"` (ya controlado)
- Vista simplificada (sin controles de edición del docente)
- Cada turno del estudiante muestra:
  - Badge de tipo de intervención
  - Anotación del supervisor/IA
  - Alternativa sugerida (si existe)
  - Indicador de impacto: flechita verde (positivo) o roja (negativo) en alianza/resistencia

### 6. Server Component: Cargar datos de anotaciones

**Archivos:**
- `src/app/(app)/docente/sesion/[conversationId]/page.tsx` — agregar query de `message_annotations` + `clinical_state_log`
- `src/app/(app)/review/[conversationId]/page.tsx` — agregar query de `message_annotations` (solo si approved)

---

## Esquema de datos final

```
messages (ya existe)
  ├── message_annotations (ya existe, se extiende)
  │     ├── annotation_type: positive | suggestion | technique | warning
  │     ├── annotation_text: "Buena reformulación que..."
  │     ├── competency: "escucha_activa"
  │     ├── alternative: "Podrías haber dicho..."  (NUEVO)
  │     ├── turn_number: 3  (NUEVO)
  │     ├── intervention_type: "reformulacion"  (NUEVO)
  │     └── clinical_impact: {...deltas}  (NUEVO)
  │
  └── clinical_state_log (ya existe, solo lectura)
        ├── intervention_type, intervention_raw
        ├── state values (resistencia, alianza, etc.)
        └── delta values
```

---

## Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| CREAR | `src/app/api/sessions/[conversationId]/turn-analysis/route.ts` |
| CREAR | `supabase/migrations/XXXXXX_turn_analysis.sql` |
| MODIFICAR | `src/app/api/sessions/[conversationId]/complete/route.ts` (fire-and-forget) |
| MODIFICAR | `src/app/(app)/docente/sesion/[conversationId]/page.tsx` (cargar annotations) |
| MODIFICAR | `src/app/(app)/docente/sesion/[conversationId]/TeacherReviewClient.tsx` (transcripción anotada) |
| MODIFICAR | `src/app/(app)/review/[conversationId]/page.tsx` (cargar annotations) |
| MODIFICAR | `src/app/(app)/review/[conversationId]/ReviewClient.tsx` (vista estudiante) |

---

## Decisiones de diseño

1. **El análisis se genera automáticamente** al completar sesión (no on-demand del docente). Esto permite que cuando el docente abre la revisión, las anotaciones ya estén listas.

2. **El docente puede editar** las anotaciones de IA antes de aprobar. Esto cumple el requisito de que "tendría que ser aprobado por el docente".

3. **Una sola llamada LLM** para todos los turnos (no una por turno). El prompt recibe el transcript completo + state log y retorna todas las anotaciones de una vez. Más eficiente y coherente.

4. **Se reutiliza la tabla `message_annotations`** existente en vez de crear una nueva. Solo se agregan columnas.

5. **La aprobación del docente ya existe** (`feedback_status`). Se reutiliza el mismo mecanismo — cuando el docente aprueba la retroalimentación, se libera todo (competencias globales + análisis turno a turno).
