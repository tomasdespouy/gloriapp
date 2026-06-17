# Capa de comportamiento por dificultad — GlorIA

Diseño de cómo el `difficulty_level` de un paciente IA (`beginner` /
`intermediate` / `advanced`) genera diferencias **reales** de conducta en
sesión. Hasta ahora el campo era solo etiqueta de UI + filtro; esta capa lo
activa en runtime.

## 1. Dos capas ortogonales

| Campo | Gobierna | Pregunta que responde |
|---|---|---|
| `pacing_profile` | Temperamento / ritmo (ansioso, depresivo, tímido…) | **¿Cómo escribe?** |
| `difficulty_level` | Dureza clínica | **¿Qué tan difícil es tratarlo?** |

Son independientes: existe el "principiante ansioso" y el "avanzado
depresivo". El pacing es el *acento*; la dificultad es cuán *blindado* está
emocionalmente.

Config: `src/lib/difficulty-behavior.ts` (espejo de
`src/lib/conversation-pacing.ts`).

## 2. Tabla maestra de variables por nivel

Leyenda: ⚙️ = parámetro duro (código, fiable ~100%) · 🧠 = conducta
(modelo, frágil — ver §3).

| Variable | 🌱 Principiante | 🌿 Intermedio | 🌳 Avanzado | Tipo |
|---|---|---|---|---|
| **Presupuesto de paciencia** (silencio total antes de irse) | **5 min** | **4 min** | **3 min** | ⚙️ |
| **Respeta el tipeo** (¿el tipeo pausa el "¿sigue ahí?"?) | `full` — siempre | `partial` — salvo el nudge final | `from2` — pausa el nudge 1; desde el nudge 2, si escribe, pregunta igual | ⚙️ |
| **Sensibilidad a comentarios torpes** (juicio, minimizar, consejo prematuro) | ninguna | **leve** | alta — se siente herido y lo expresa | 🧠 |
| **Velocidad de alianza** (confianza por buena intervención) | rápida | media | lenta | 🧠 |
| **Apertura inicial** (cuánto comparte sin alianza) | alta | media | baja | 🧠 |
| **Reacción a confrontación sin alianza** | la tolera | se incomoda leve | sube resistencia / amaga cerrarse | 🧠 |

Decisiones tomadas con el usuario:

- **#1 Sensibilidad** → gradiente de 3 escalones: Principiante `none`,
  Intermedio `mild` (punto medio), Avanzado `high`.
- **#2 Respeto al tipeo** → Principiante `full`; Intermedio `partial`
  (respeta salvo el nudge final); Avanzado `from2` (respeta el nudge 1,
  pero **desde el nudge 2**, si el estudiante está escribiendo, pregunta
  igual).

## 3. El split ⚙️ vs 🧠 y por qué importa

El `system_prompt` base ya pesa ~550 tokens de promedio (máx ~700) y en
runtime se le apilan varios bloques inyectados (estado/alianza, memoria,
contexto temporal, `[PROTOCOLO DE IDENTIFICACION]`, `[INSISTENCIA]`,
`[CIERRE SIN FECHA]`, `[COHERENCIA]`…). Cada bloque nuevo no infla tanto el
tamaño como **compite por la atención** del modelo. Sumado al hallazgo
documentado **"la rúbrica estática NO predice la conducta en sesión"**,
pedir conducta vía prosa es poco fiable y **erosiona la identidad** que
costó enriquecer.

| Capa | Fiabilidad | Cómo se implementa |
|---|---|---|
| ⚙️ Determinista | ~100% | Timers y lógica de cliente. No le pide nada al modelo, no agranda el prompt. |
| 🧠 Conductual (como prosa) | ~50–70%, inconsistente | **EVITAR.** Diluye identidad. |

### Reencuadre de la capa 🧠 (no es prosa apilada)

La conducta se baja a mecanismos que **ya funcionan** en el código:

1. **Timers / lógica de cliente** (⚙️) → paciencia, respeto al tipeo,
   cadencia de nudges.
2. **Sembrar el ESTADO CLÍNICO inicial** (numérico) → el chat ya modula por
   alianza y registra `clinical_state_log`. En vez de *decirle* "tu
   apertura es baja", se **arranca** al avanzado con `resistencia` alta /
   `alianza` baja (`initialStateBias`), y el motor ya renderiza **una línea
   corta por turno** ("estás muy cerrado, respuestas cortas"). Es ~1 línea,
   no un párrafo — y emerge del motor, no de la memoria del LLM.
3. **Micro-inyecciones POR EVENTO** → para "ofenderse" se **detecta el
   comentario torpe / hostilidad en código** (ya se clasifican
   intervenciones para chat-alerts y ruptura) y solo entonces se inyecta
   **una línea reactiva**. Mismo patrón que silencio / insistencia / cita:
   el código decide, el LLM solo lo verbaliza.

Así el `system_prompt` de identidad queda **casi intacto**.

## 4. Estado de implementación

### ✅ Hecho (capa ⚙️, server-side, seguro)

- `src/lib/difficulty-behavior.ts`: config `DIFFICULTY_BEHAVIOR`,
  `getDifficultyBehavior()`, `scaleSilenceThresholds()`.
- `src/app/api/chat/route.ts`:
  - `difficulty_level` agregado al `select` del paciente.
  - El evento `pacing` ahora emite `silenceThresholdsMs` **escalados** al
    presupuesto de paciencia de la dificultad (`scaleSilenceThresholds`),
    más `respectsTyping` para el futuro refactor del cliente.
  - `scaleSilenceThresholds` **preserva la longitud** del array → el
    `silence/route.ts` (que deriva `totalStages` de `.length`) **no
    requiere cambios**.

> Modo voz: usa `SILENCE_THRESHOLDS_VOICE` hardcodeado en `ChatInterface` y
> queda fuera de esta capa por ahora.

### 🧠 Scaffold (datos en el config, SIN cablear)

`offenseSensitivity`, `allianceSpeed`, `initialStateBias`. Se validan con
el harness A/B (`scripts/ab-conductual.js`) en staging con 1 paciente por
nivel **antes** de extender a los 34.

### ✅ Hecho — refactor de `ChatInterface` (capa ⚙️ de tipeo)

El cliente consume `respectsTyping` del evento `pacing` y decide por etapa
si el tipeo suprime el nudge. **No se tocó `SessionTimer.tsx`.**

Cambios aplicados:

1. `respectsTypingRef` (`"full" | "partial" | "from2"`, default `"full"`),
   poblado desde el evento `pacing` junto a `silenceThresholdsRef`.
2. `applyTypingPause(hasText)` ya **no** llama `clearSilenceTimers()` (eso
   reiniciaba el reloj). Ahora solo setea `isTypingRef = hasText`. El reloj
   de silencio sigue corriendo; lo que cambia es si el nudge se DISPARA.
3. Helper puro a nivel de módulo `typingSuppressesNudge(mode, nextStage,
   totalStages, isTyping)`:

   ```ts
   if (!isTyping) return false;            // no escribe → nunca suprime
   switch (mode) {
     case "full":    return true;          // siempre pausa al tipear
     case "partial": return nextStage < totalStages; // pausa salvo el final
     case "from2":   return nextStage < 2;  // pausa solo el nudge 1
   }
   ```

4. **CORRECCIÓN respecto al diseño inicial:** la guarda **SÍ avanza**
   `silenceStageRef` (consume la etapa) aunque suprima el disparo. Si NO se
   avanzara, como las etapas son secuenciales (`nextStage = stage + 1`),
   `partial`/`from2` quedarían atascados en la etapa 1 y sus nudges
   posteriores nunca se alcanzarían. Entonces: suprimir = **consumir la
   etapa en silencio sin emitir el mensaje**.
5. La supresión por tipeo **no aplica en modo voz** (`voiceModeRef` → no hay
   caja de texto activa); modo voz queda igual que antes.
6. `totalStages` en el cliente = `thresholds.length` del perfil vigente.

Verificado: `tsc --noEmit` (0 errores), `eslint` (0 errores), test de la
matriz completa de `typingSuppressesNudge` (24/24), y `npm run build` OK.

⚠️ **Pendiente de verificación en navegador** (no automatizable aquí porque
requiere esperar minutos reales): el *feel* de los umbrales, foco con caja
vacía contando como silencio, y borrar un borrador a media espera (caso
borde: en `full`, si se consumieron todas las etapas tipeando y luego se
vacía la caja sin enviar, no vuelve a haber nudge hasta el próximo envío).

## 5. Rollout

- **Capa ⚙️** (paciencia + tipeo): segura para los **34 pacientes ya**, es
  determinista. (Paciencia: activa. Tipeo: tras el refactor de cliente.)
- **Capa 🧠** (apertura, sensibilidad, sesgo de estado): **validar primero
  con el harness A/B** (`scripts/ab-conductual.js`) con 1 paciente por
  nivel; recién ahí extender a los 34. Es la única forma de medir el % real
  de adherencia sin adivinar.

## 6. Archivos

- `src/lib/difficulty-behavior.ts` — config + helpers (nuevo).
- `src/app/api/chat/route.ts` — select + escalado de paciencia + evento.
- `docs/difficulty-behavior-layer.md` — este documento.
- Sin migración: `difficulty_level` ya existe en `ai_patients`.
- **No** se tocó `ChatInterface.tsx` ni `SessionTimer.tsx`.
