# Plan: Flujo de 15 pasos para creacion de pacientes

## Estado actual
- Wizard de 4 pasos: Configurar -> Perfil (preview + validator) -> Prueba (test conversation) -> Guardar (image/video)
- APIs existentes: generate-profile, test-conversation, validate-profile, generate-image, generate-video
- El generate-profile genera system_prompt + backstory + personality_traits de una vez

## Nuevo flujo de 15 pasos

### Fase 1: Variables (Paso 1 - Humano)
- **Reusar** el formulario actual (Step 0) sin cambios
- Al enviar, llama al nuevo endpoint `generate-narrative`

### Fase 2: Relato simplificado (Paso 2 - IA)
- **Nuevo endpoint**: `POST /api/patients/generate-narrative`
- Recibe el form data, genera un relato estructurado CORTO del paciente
- Secciones: Datos basicos, Motivo de consulta, Contexto familiar, Personalidad, Dinamica relacional
- Output: JSON con `short_narrative` (objeto con secciones, ~1-2 paginas)

### Fase 3: Ajustar relato corto (Paso 3 - Humano)
- UI: muestra el relato por secciones, cada seccion editable
- Boton "Regenerar seccion" por cada seccion
- Boton "Validar y continuar"

### Fase 4: Relato extenso (Paso 4 - IA)
- **Nuevo endpoint**: `POST /api/patients/generate-extended-narrative`
- Recibe el relato corto validado + form data
- Genera relato extenso (~10 paginas) con secciones obligatorias:
  1. Historia personal (infancia, adolescencia, adultez)
  2. Historia familiar (familia de origen, dinamicas, eventos significativos)
  3. Vinculos de apego y estilo relacional
  4. Historia profesional/academica
  5. Eventos traumaticos o significativos
  6. Mecanismos de defensa y patrones repetitivos
  7. Contexto cultural y socioeconomico
  8. Estado actual y motivo de consulta
- Usa valores demograficos reales del pais seleccionado

### Fase 5: Revision de coherencia (Paso 5 - IA)
- **Nuevo endpoint**: `POST /api/patients/review-coherence`
- Dos tipos de revision:
  - **Coherencia interna**: contradicciones en la historia (edades, fechas, eventos)
  - **Coherencia clinica**: patologia vs historia de vida (referencias DSM-5, PDM-2)
- Output: lista de observaciones con severidad (critica, sugerencia, ok)

### Fase 6: Ajustar relato extenso (Paso 6 - Humano)
- UI: muestra relato extenso por secciones editables
- Muestra resultados de coherencia al costado (items criticos en rojo, sugerencias en amarillo)
- Boton "Re-evaluar coherencia" despues de editar
- Boton "Validar y continuar"

### Fase 7: Proyecciones paralelas (Paso 7 - IA)
- **Nuevo endpoint**: `POST /api/patients/generate-projections`
- Genera 3 proyecciones de 8 sesiones (principiante, intermedio, experto)
- Por cada sesion: resumen, estado del paciente, alianza terapeutica, sintomas, resistencias
- Evalua: coherencia temporal, evolucion/involucion realista, mantenimiento de personalidad

### Fase 8: Revisar proyecciones (Paso 8 - Humano)
- UI: 3 tabs (Principiante / Intermedio / Experto)
- Por cada tab: timeline de 8 sesiones con resumen, scores, evolucion
- Indicadores visuales de coherencia, evolucion de sintomas, alianza
- Boton "Guardar paciente" o "Volver a ajustar"

### Fase 9: Generar system_prompt (Paso 9 - IA)
- **Nuevo endpoint**: `POST /api/patients/generate-system-prompt`
- Recibe: relato extenso validado + proyecciones aprobadas + form data
- Genera system_prompt optimizado para el LLM (formato existente con secciones)
- Tambien genera: quote, presenting_problem, tags, skills_practiced, total_sessions

### Fase 10: Validar system_prompt (Paso 10 - Humano)
- UI: reutilizar el editor actual de system_prompt
- Incluir el ProfileValidator existente
- Boton "Activar paciente"

### Fase 11: Paciente activo (Paso 11)
- Se guarda en BD (tabla ai_patients + nuevos campos para narrativas)
- Paciente queda con is_active = true, listo para uso
- Redirige a la ficha del paciente con opcion de agregar media

### Fase 12-13: Imagen (Pasos 12-13 - IA + Humano)
- Reusar la funcionalidad existente de ImageGenerator
- Se accede desde la ficha del paciente (no bloquea publicacion)

### Fase 14-15: Video (Pasos 14-15 - IA + Humano)
- Reusar la funcionalidad existente de video upload/generation
- Se accede desde la ficha del paciente (no bloquea publicacion)

## Cambios en base de datos

### Nueva migracion: agregar campos de narrativa a ai_patients
```sql
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS short_narrative JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS extended_narrative JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS coherence_review JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS projections JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS creation_step INTEGER DEFAULT 0;
```

## Archivos a crear/modificar

### Nuevos archivos:
1. `src/app/api/patients/generate-narrative/route.ts`
2. `src/app/api/patients/generate-extended-narrative/route.ts`
3. `src/app/api/patients/review-coherence/route.ts`
4. `src/app/api/patients/generate-projections/route.ts`
5. `src/app/api/patients/generate-system-prompt/route.ts`

### Archivos a modificar:
1. `src/app/(app)/perfiles/nuevo/page.tsx` - Reescribir wizard completo
2. `src/lib/patient-options.ts` - Agregar tipos para narrativas, coherencia, proyecciones
3. Nueva migracion SQL

## UI del stepper

Agrupar los 15 pasos en 6 fases visuales para no abrumar:
1. **Variables** (paso 1)
2. **Relato** (pasos 2-3-4)
3. **Validacion** (pasos 5-6)
4. **Proyecciones** (pasos 7-8)
5. **System prompt** (pasos 9-10)
6. **Activar** (paso 11 + media opcional 12-15)

## Orden de implementacion

1. Migracion de BD (nuevos campos)
2. Tipos en patient-options.ts
3. APIs nuevas (5 endpoints)
4. UI del wizard (reescritura del page.tsx)
