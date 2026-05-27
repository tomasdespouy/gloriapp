# Reflexiones UX/UI e interacción con pacientes IA

> Documento de trabajo. Fecha: 2026-05-27.
> Captura (1) una investigación sobre el comportamiento de los pacientes IA y
> (2) propuestas de rediseño visual para la vista de pacientes y el menú.
> Nada de esto está implementado todavía — es material de diseño y análisis.

---

## Parte 1 — Interacción: ¿por qué los pacientes preguntan el nombre del terapeuta en distintos turnos?

### Hallazgo principal

No es un error: **el turno en que el paciente pregunta el nombre depende de su
arquetipo conversacional** (`ai_patients.pacing_profile`). La lógica vive en
`src/lib/conversation-pacing.ts` (`buildIntroductionRule`) y se inyecta una sola
vez en el system prompt desde `src/app/api/chat/route.ts`.

| Arquetipo | Pregunta el nombre en | Estilo |
|---|---|---|
| `anxious_fast` (ansioso) | turno 2 | demandante, impaciente |
| `conversational_medium` (medio) | turno 3 | natural y cálido |
| `reflective_paused` (reflexivo) | turno 4 | introspectivo |
| `depressive_slow` (depresivo) | turno 5 | suave, se disculpa |
| `inhibited_timid` (tímido) | turno 6 | entrecortado, con vergüenza |

El turno 3 es solo el del perfil "medio" (el default). Es un comportamiento
escalonado intencional: cada personalidad pregunta cuando le resulta natural.

### Tres condiciones que además suprimen la pregunta (sin importar el arquetipo)

1. **Solo en la primera sesión** (`session_number === 1`). En sesiones 2+ no pregunta.
2. **Solo en el turno exacto, una vez.** No reintenta en turnos siguientes.
3. **Solo si el alumno no se presentó.** Si el alumno escribió "soy X", "me llamo X",
   "mi nombre es X" o "aquí habla X", el paciente no pregunta — ya sabe el nombre.

### Distribución real en PRODUCCIÓN (`ndwmnxlwbfqfwwtekjun`, 34 pacientes activos)

```
turno 3   conversational_medium   23 pacientes   68%
turno 4   reflective_paused       10 pacientes   29%   ← todos los "advanced"
turno 6   inhibited_timid          1 paciente     3%   ← Gabriel Navarro
```

- Solo el **68%** pregunta en la 3.ª interacción. El 32% restante son los casos
  "advanced", que por diseño preguntan en el turno 4.
- **Nadie quedó en `anxious_fast` (turno 2) ni `depressive_slow` (turno 5)**: esos
  estilos existen en el código pero no se usan con ningún paciente en producción.
- Producción está limpia (sin duplicados ni perfiles en NULL); los duplicados y
  NULL observados en staging eran ruido de ese entorno.

### El patrón efectivo, en una frase

En la práctica el turno está casi totalmente determinado por la dificultad:
**advanced → turno 4**, **el resto → turno 3**, y **Gabriel Navarro → turno 6**
(único que matcheó "tímido/inhibido" en la heurística de la migración
`20260414160000_ai_patients_pacing_profile.sql`).

### Herramienta de auditoría

`scripts/audit-pacing-profiles.js` — read-only. Lista cada paciente con su perfil
y el turno en que pregunta el nombre, más un resumen de distribución.

```
node scripts/audit-pacing-profiles.js                 # usa .env.local (staging)
node scripts/audit-pacing-profiles.js .env.production  # producción
```

### Observación (no es un fix)

El número de turno se cuenta desde `clinical_state_log`. Si un turno falla y el
reintento no escribe el log (ver `route.ts`, rama "retry failed"), el conteo
podría desfasarse de lo que el alumno percibe como "3.ª interacción". No hay un
caso reportado que lo confirme; queda señalado como riesgo.

---

## Parte 2 — Reflexiones UX/UI

Diagnóstico del estado actual:
- Grilla de pacientes (`PacientesClient.tsx`) fija en 1 → 4 columnas.
- `PatientCard` recibe `quote` y `tags` pero **no los muestra** — datos desaprovechados.
- Menú (`Sidebar.tsx`) con íconos de 18px; al colapsar, se esconde por completo.

Todo lo propuesto respeta el design system de GlorIA: paleta indigo/ámbar,
sin emojis, mucho espacio en blanco; los íconos serían de lucide.

### 2.1 — Menú con íconos más grandes

Íconos a 24px dentro de un recuadro que se ilumina al seleccionar:

```
╔════════════════════════════╗
║        G l o r I A          ║
║                             ║
║   ╭─────╮                   ║
║   │  ⌂  │   Inicio          ║
║   ╰─────╯                   ║
║   ╭─────╮                   ║
║   │  ◫  │   Mi progreso     ║
║   ╰─────╯                   ║
║   ╭─────╮  ◄── seleccionado ║
║   │  ☺  │   Pacientes       ║
║   ╰─────╯                   ║
║                             ║
║    [ logo institución ]     ║
╚════════════════════════════╝
```

Mejora al colapsar: en vez de esconderse, queda un **rail de solo íconos** (con
tooltip), siempre accesible:

```
╔═══════╗
║   G   ║
║ ╭───╮ ║
║ │ ⌂ │ ║ ·· Inicio
║ ╰───╯ ║
║ ╭───╮ ║
║ │ ☺ │ ║
║ ╰───╯ ║
╚═══════╝
```

### 2.2 — Vista de pacientes: selector de 3 modos

Un toggle arriba a la derecha que recuerda la preferencia del usuario:

```
 Pacientes                                    vista:  [ ☰ ] [ ▭ ] [ ▦ ]
 [ País ▾ ]  [ Nivel ▾ ]   34 pacientes               lista  cáps. galería
```

**A · Lista** — máxima densidad, para encontrar a alguien puntual entre 34:

```
┌────────────────────────────────────────────────────────────────────┐
│ ◯  Catalina Ríos    38·Abogada      ●Avanzado     CL voz  [Iniciar ›]│
├────────────────────────────────────────────────────────────────────┤
│ ◯  Diego Fuentes    19·Estudiante   ●Intermedio   CL      [Retomar ›]│
└────────────────────────────────────────────────────────────────────┘
```

**B · Cápsulas** — balance; estrena los `#tags` que hoy no se ven:

```
╭──────────────────────────────╮ ╭──────────────────────────────╮
│ ◯  Catalina Ríos · 38        │ │ ◯  Diego Fuentes · 19        │
│    Abogada · CL · voz        │ │    Estudiante · CL           │
│    #duelo  #resistencia      │ │    #ansiedad  #universitario │
│    ● Avanzado    [Iniciar ›] │ │    ● Intermedio  [Retomar ›] │
╰──────────────────────────────╯ ╰──────────────────────────────╯
```

**C · Galería "póster"** — la propuesta principal (ver 2.3).

### 2.3 — Propuesta principal: galería "póster" (persona protagonista)

El problema del diseño actual es que trata la foto como un detalle (un círculo de
96px sobre una tarjeta blanca). En la propuesta, **la foto/video ocupa toda la
tarjeta** en formato póster vertical, con el nombre y la frase (`quote`)
superpuestos sobre un degradado — como un perfil de streaming.

Pantalla completa (menú + barra superior + galería):

```
┌─────────────┐
│   GlorIA    │   Hola, Tomás              ⌕ Buscar paciente...              ( TD )
│             │ ─────────────────────────────────────────────────────────────────────
│  ╭─────╮    │   Pacientes · 34                  vista:  ☰ Lista  ▭ Cápsulas  [▦ Galería]
│  │  ⌂  │ In │   [ País ▾ ]  [ Nivel ▾ ]
│  ╰─────╯    │
│  ╭─────╮    │   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  │  ◫  │ Pr │   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  ╰─────╮    │   │▓ ●Avanzado   CL ▓│ │▓ ●Interm.    CL ▓│ │▓ ●Princip.   PE ▓│
│  ╭─────╮    │   │▓▓▓▓▓ video ▓▓▓▓▓▓│ │▓▓▓▓▓ video ▓▓▓▓▓▓│ │▓▓▓▓▓ video ▓▓▓▓▓▓│
│  │  ☺  │◀Pa │   │░░░░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░░░░░░│
│  ╰─────╯    │   │ Catalina Ríos  ◍ │ │ Diego Fuentes    │ │ Camila Bertoni ◍ │
│  ╭─────╮    │   │ 38 · Abogada     │ │ 19 · Estudiante  │ │ 22 · Diseñadora  │
│  │  ↻  │ Hi │   │ "No sé por qué   │ │ "Todo me supera  │ │ "No duermo hace  │
│  ╰─────╯    │   │  sigo viniendo"  │ │  últimamente"    │ │  semanas"        │
│  [ logo ]   │   │ #duelo #resist.  │ │ #ansiedad #univ. │ │ #insomnio        │
└─────────────┘   └──────────────────┘ └──────────────────┘ └──────────────────┘
                  ▼ sigue scroll (filas de 3–4 según ancho)
```

Comportamiento de la tarjeta — el botón aparece al pasar el mouse:

```
        en reposo                          al pasar el mouse (se eleva)
┌────────────────────────┐         ┌────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│         │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓ ●Avanzado        CL ▓▓│         │▓ ●Avanzado        CL ▓▓│
│▓▓▓▓▓▓▓▓ video ▓▓▓▓▓▓▓▓▓│         │▓▓▓▓▓▓▓▓ video ▓▓▓▓▓▓▓▓▓│  ← arranca al hover
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│         │░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░│         │ Catalina Ríos      ◍voz│
│ Catalina Ríos      ◍voz│         │ 38 · Abogada           │
│ 38 · Abogada           │         │ "No sé por qué sigo    │
│ "No sé por qué sigo    │         │  viniendo acá..."      │
│  viniendo acá..."      │         │ ╭────────────────────╮ │
│ #duelo  #resistencia   │         │ │ Iniciar conversación›│ │
└────────────────────────┘         │ ╰────────────────────╯ │
                                   └────────────────────────┘
```

Qué cambia respecto a hoy y por qué se ve mejor:
- **La imagen es la tarjeta** (póster vertical full-bleed), no un círculo chico.
- **Nombre, edad·oficio y la frase (`quote`) superpuestos** sobre un degradado
  oscuro — engancha y aprovecha datos hoy ocultos.
- **Dificultad y bandera flotan** sobre la imagen; ícono de voz junto al nombre.
- **Hover**: la tarjeta se eleva, el video recién ahí arranca (con 34 pacientes,
  hoy todos reproducen a la vez; esto también descarga la página) y emerge el botón.
- **Sesión activa**: ese póster lleva borde ámbar y el botón dice "Retomar".

### Estado y próximos pasos

- Pendiente de decisión: variante con **banda destacada** arriba (un "Retoma con…"
  grande estilo Netflix cuando hay sesión activa), proporción de la tarjeta, qué
  datos van sobre la imagen, número de columnas.
- Esfuerzo estimado: las 3 vistas comparten los datos que `PacientesClient` ya
  tiene (≈ medio día a 1 día); el menú, un par de horas.
- No toca el chat ni `SessionTimer`.
