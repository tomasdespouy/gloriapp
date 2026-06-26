# Propuestas: paciencia por alianza y realismo de agenda

> 2026-06-25. Estado: **propuesta de diseño** (no implementado). El sesgo inicial
> por dificultad (`initialStateBias`) y el ocultamiento del badge SÍ se aplicaron;
> esto es lo que queda por decidir.

## 1. Paciencia ante el silencio escalada por la alianza

### Idea
Hoy `patienceMs` es fijo por dificultad (7/5/3 min). Propuesta: que **se estire o
encoja según la alianza** del par paciente–estudiante. Como la alianza ya
**persiste entre sesiones** (`session_summaries.final_clinical_state` se hereda al
abrir cada sesión, `chat/route.ts`), escalar por alianza resuelve gratis la
intuición original: en la sesión 8 con buen vínculo, el avanzado tolera más
silencio; en la sesión 1, frío, sigue impaciente. **Es el vínculo, no el número de
sesión** — un paciente con 8 sesiones pero mala alianza no gana paciencia (correcto).

### Fórmula propuesta
```
factor   = 0.7 + 0.6 * (alianza / 10)     // alianza 0→0.7, 5→1.0, 10→1.3
patiencia = clamp(patienceMs_base * factor, MIN 90s, MAX 600s)
```

Tiempos resultantes (minutos):

| Dificultad | base | alianza 0 (frío) | alianza 5 (medio) | alianza 10 (sólido) |
|---|---|---|---|---|
| Principiante | 7 min | ~4.9 | 7.0 | ~9.1 |
| Intermedio | 5 min | 3.5 | 5.0 | 6.5 |
| Avanzado | 3 min | ~2.1 | 3.0 | ~3.9 |

### Dónde se conecta
`src/app/api/chat/route.ts`, justo donde hoy se calculan los umbrales (≈ línea 376),
usando el `newState.alianza` ya calculado en ese turno (se recalcula por turno → la
paciencia se adapta también DENTRO de la sesión):

```ts
const base = getDifficultyBehavior(patient.difficulty_level).patienceMs;
const factor = 0.7 + 0.6 * (newState.alianza / 10);
const adjustedPatienceMs = Math.max(90_000, Math.min(600_000, Math.round(base * factor)));
const silenceThresholdsMs = scaleSilenceThresholds(pacingProfile.silenceThresholdsMs, adjustedPatienceMs);
```

### Sinergia con el sesgo inicial (ya aplicado)
Con `initialStateBias`, un avanzado en su PRIMERA sesión arranca con alianza 0 →
factor 0.7 → ~2.1 min de paciencia (muy cortante, "todavía no te conozco"). A
medida que el estudiante construye alianza (turno a turno y sesión a sesión), la
paciencia sube hacia ~3.9 min. Comportamiento humano: más vínculo, más aguante.

### Perillas de ajuste
- Piso/techo del factor (0.7 / 1.3) y los clamps (90 s / 600 s).
- Opcional: sumar un pequeño bono por nº de sesión (tope), pero la alianza ya lo cubre.

---

## 2. Realismo de agenda + mejoras de prompt entre sesiones

### Qué ya existe (no rehacer)
- **Commitments** (`session_summaries.commitments TEXT[]`): el resumen por IA ya
  extrae acuerdos, **incluida la próxima cita con día y hora** si la hubo.
- **Bloqueo suave de cita**: al reentrar, banner "en tu última sesión quedaron en:
  {cita}. ¿Comenzar igual?" (`chat/[patientId]/page.tsx`, `ChatInterface.tsx`).
- **Memoria cross-sesión**: se inyectan todos los resúmenes previos con tiempo REAL
  transcurrido, revelaciones, acuerdos y transcript de la última sesión.
- **Contexto temporal**: el paciente sabe fecha/hora actual en su zona horaria y
  cuánto pasó desde cada sesión.

### Lo que FALTA (tu ejemplo de la cita del 26-jul a las 9pm)
El paciente NO detecta una cita **incumplida o cambiada** ni la trae a colación.
Propuesta — "conciencia de agenda":

1. **Capturar la cita de forma estructurada.** Hoy la próxima cita vive como texto
   libre en `commitments`. Agregar una columna `next_appointment TIMESTAMPTZ` (o
   parsear el texto al cerrar) para tener una fecha comparable.
2. **Comparar al abrir la sesión.** Si `ahora` es claramente posterior a la cita
   acordada, o cae en otro día, inyectar una regla al prompt: el paciente lo notó.
3. **Modular el tono por alianza** (reusando `newState.alianza`):
   - Alianza baja → dolido/retraído: "Vi que cambiaste la hora... pensé que no querías verme."
   - Alianza alta → directo y confiado: "Quedamos el jueves a las 9, ¿pasó algo? No me avisaste."
4. **Dejar que el paciente acepte la explicación** si el estudiante responde (no
   quedarse pegado en el reclamo).

### Otras mejoras de prompt de alto valor (priorizadas)
1. **Seguimiento de SUS tareas** (alto valor, bajo riesgo): si el paciente se
   comprometió a algo (registrar la ansiedad, hablar con su hermano), en la sesión
   siguiente debería referirse a si lo cumplió — con incumplimiento realista
   ("lo intenté pero…"). Hoy el acuerdo está en memoria, pero no se le pide
   explícitamente hacer el seguimiento de su propia tarea.
2. **Encuadre de cierre** (alto valor, bajo riesgo): que el paciente a veces proponga
   o acepte naturalmente una próxima cita al final. Esto **alimenta** el loop de
   agenda (puebla `commitments`/`next_appointment` de forma fiable).
3. **Estado de ánimo del día variable** (medio): el ánimo inicial podría variar según
   el tiempo transcurrido o un microevento, en vez de resetear siempre al baseline.
4. **Ficha de hechos canónicos** (medio, anti-deriva): un set acotado de hechos
   duros (nombres, edades, eventos clave) que se arrastre verbatim para que el
   paciente no se contradiga en arcos largos. Complementa la memoria narrativa.
5. **Microeventos de vida entre sesiones** (alto impacto, MAYOR riesgo de
   incoherencia): que "haya pasado algo" entre sesiones. Requiere control fino;
   dejar para el final.

### Orden sugerido de implementación
Agenda (1–4 de arriba) → seguimiento de tareas → encuadre de cierre. Todo se apoya
en infraestructura existente (commitments, memoria, timeContext, estado clínico);
el único cambio de esquema sería `next_appointment` (o parseo del texto).
