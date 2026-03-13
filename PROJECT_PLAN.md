# GloriA — Plan de Proyecto

## 1. Vision del Producto

GloriA es una plataforma web para que estudiantes de psicologia practiquen conversaciones terapeuticas con pacientes simulados por IA. Cada paciente tiene personalidad, historia y condicion clinica unica. El estudiante practica, reflexiona y mejora sus habilidades clinicas.

**Filosofia de diseno:** Chat-first, minimalista, sin ruido. La conversacion es el producto.

---

## 2. Tech Stack

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Base de datos | Supabase (PostgreSQL + Auth + RLS) |
| IA / Chat | Google Gemini 2.5 Flash (`@google/genai`) |
| Structured outputs | Zod + `zod-to-json-schema` |
| Hosting | Vercel (futuro) |
| Repo | GitHub (privado) |

---

## 3. Arquitectura

```
Browser (React)
    |
    v
Next.js App Router
    |
    ├── Server Components (lectura de datos)
    ├── Server Actions (auth, crear conversacion)
    └── Route Handlers (API /api/chat — streaming con Gemini)
            |
            ├── Supabase (DB + Auth)
            └── Google Gemini API (IA)
```

### Flujo del chat

1. Estudiante envia mensaje → POST a `/api/chat`
2. Server carga historial de mensajes desde Supabase
3. Server construye prompt con system instruction del paciente + historial
4. Server llama a Gemini con streaming
5. Stream se envia al browser via ReadableStream
6. Al finalizar, mensaje del asistente se guarda en Supabase

---

## 4. Base de Datos (Supabase)

### Tablas

#### `profiles`
Extiende `auth.users` con datos del estudiante.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | UUID (PK, FK → auth.users) | ID del usuario |
| email | TEXT | Email |
| full_name | TEXT | Nombre completo |
| role | TEXT | 'student' / 'instructor' / 'admin' |
| created_at | TIMESTAMPTZ | Fecha de creacion |
| updated_at | TIMESTAMPTZ | Ultima actualizacion |

#### `ai_patients`
Pacientes IA con personalidad y backstory.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | UUID (PK) | ID del paciente |
| name | TEXT | Nombre del paciente |
| age | INTEGER | Edad |
| occupation | TEXT | Ocupacion |
| quote | TEXT | Frase en primera persona (gancho) |
| presenting_problem | TEXT | Problema que presenta |
| backstory | TEXT | Historia completa |
| personality_traits | JSONB | Rasgos de personalidad |
| system_prompt | TEXT | Prompt completo para el LLM |
| difficulty_level | TEXT | 'beginner' / 'intermediate' / 'advanced' |
| tags | TEXT[] | Etiquetas tematicas |
| skills_practiced | TEXT[] | Habilidades que se practican |
| total_sessions | INTEGER | Sesiones esperadas (ej: 5) |
| is_active | BOOLEAN | Si esta disponible |
| created_at | TIMESTAMPTZ | Fecha de creacion |

#### `conversations`
Cada sesion de practica.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | UUID (PK) | ID de la conversacion |
| student_id | UUID (FK → profiles) | Estudiante |
| ai_patient_id | UUID (FK → ai_patients) | Paciente IA |
| session_number | INTEGER | Numero de sesion con este paciente |
| status | TEXT | 'active' / 'completed' / 'abandoned' |
| started_at | TIMESTAMPTZ | Inicio |
| ended_at | TIMESTAMPTZ | Fin |
| student_notes | TEXT | Notas clinicas del estudiante |
| student_emotions | TEXT | Contratransferencia |
| created_at | TIMESTAMPTZ | Fecha de creacion |

#### `messages`
Mensajes individuales dentro de una conversacion.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | UUID (PK) | ID del mensaje |
| conversation_id | UUID (FK → conversations) | Conversacion |
| role | TEXT | 'user' / 'assistant' / 'system' |
| content | TEXT | Contenido del mensaje |
| created_at | TIMESTAMPTZ | Timestamp |

#### `session_feedback`
Reflexion y retroalimentacion post-sesion.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | UUID (PK) | ID |
| conversation_id | UUID (FK → conversations) | Conversacion |
| student_id | UUID (FK → profiles) | Estudiante |
| discomfort_moment | TEXT | Momento mas incomodo |
| would_redo | TEXT | Que repetiria diferente |
| clinical_note | TEXT | Nota para proxima sesion |
| ai_feedback | JSONB | Feedback generado por IA |
| created_at | TIMESTAMPTZ | Fecha |

---

## 5. Rutas / Paginas

```
/                       → Redirect a /login o /app
/login                  → Login / Registro
/auth/confirm           → Confirmacion de email
/app                    → Home: lista de conversaciones (chat-list)
/app/patients           → Sheet: explorar nuevos pacientes
/app/patients/[id]      → Perfil del paciente (antes de primera sesion)
/app/chat/[id]          → Chat con paciente (la sesion)
/app/history            → Historial de sesiones anteriores
```

---

## 6. Componentes a Construir

### Layout
- `AppLayout` — Layout principal (header minimalista, contenido)
- `Header` — Logo GloriA + nombre del usuario + logout

### Home (Chat List)
- `ConversationList` — Lista de conversaciones activas y anteriores
- `ConversationCard` — Tarjeta de conversacion en curso (nombre, frase, sesion X de Y)
- `CompletedConversationRow` — Fila compacta para conversaciones terminadas

### Pacientes
- `PatientBrowser` — Sheet con pacientes sugeridos y categorias
- `PatientCard` — Tarjeta de paciente en el browser
- `PatientProfile` — Perfil completo antes de primera sesion

### Chat
- `ChatView` — Vista principal del chat
- `ChatMessage` — Mensaje individual (estudiante o paciente)
- `ChatInput` — Input de texto + boton enviar
- `SessionExpediente` — Expediente colapsable al inicio del chat
- `SessionSeparator` — Separador entre sesiones
- `HintMessage` — Pista con borde punteado (mensaje fantasma)
- `NotesSheet` — Panel lateral de notas de sesion

### Post-sesion
- `ReflectionForm` — Formulario de autoevaluacion
- `FeedbackView` — Retroalimentacion de la IA
- `CompetencyBars` — Barras de progreso por competencia

### Shared / UI
- Todos los componentes shadcn/ui (Card, Sheet, Button, Badge, etc.)

---

## 7. API Routes

### `POST /api/chat`
Endpoint principal de chat con streaming.

**Request:**
```json
{
  "conversationId": "uuid",
  "message": "texto del estudiante"
}
```

**Response:** ReadableStream (text/event-stream) con la respuesta del paciente IA.

**Logica:**
1. Validar auth (getUser)
2. Cargar conversacion + paciente desde Supabase
3. Cargar historial de mensajes
4. Guardar mensaje del estudiante en Supabase
5. Construir contenido para Gemini (system prompt + historial)
6. Llamar a Gemini con streaming
7. Stream al browser
8. Al finalizar, guardar respuesta del asistente en Supabase

### `POST /api/chat/feedback`
Genera feedback post-sesion usando Gemini con structured output.

**Request:**
```json
{
  "conversationId": "uuid"
}
```

**Response:**
```json
{
  "strengths": ["..."],
  "improvements": ["..."],
  "competencies": {
    "active_listening": 7,
    "validation": 5,
    "silence": 3
  },
  "unlocked_info": "..."
}
```

---

## 8. Prompt Engineering

### System Prompt del Paciente (ejemplo)

```
Eres Lucia, una mujer de 28 anos, disenadora grafica freelance.

HISTORIA:
Perdiste un embarazo hace 3 meses. No puedes dormir. Tu pareja dice
que "ya deberias haberlo superado". Tu medico te refirio a terapia.
Es tu primera vez con un psicologo.

PERSONALIDAD:
- Inicialmente nerviosa y un poco a la defensiva
- Te disculpas cuando muestras emocion ("Perdon, no quiero llorar")
- Si sientes confianza, te abres gradualmente
- Si te presionan, te cierras y das respuestas cortas
- Usas humor sarcastico como mecanismo de defensa

COMPORTAMIENTO EN SESION:
- Respondes como una persona real, no como un chatbot
- Incluyes lenguaje corporal entre corchetes: [mira hacia abajo]
- Tus respuestas son de 1-4 oraciones, como en una conversacion real
- Si el terapeuta hace muchas preguntas cerradas seguidas, te irritas
- Si el terapeuta valida tus emociones, te abres mas
- Si el terapeuta te da un consejo no solicitado, dices "Si, pero..."
- Si hay un silencio (el terapeuta no responde rapido), puedes decir
  algo como "...No se si me explico" o quedarte en silencio tambien

LO QUE NO REVELAS FACILMENTE:
- Tu madre tuvo una perdida similar y "siguio adelante sin quejarse"
- Sientes culpa porque una parte de ti sintio alivio al perder el embarazo
- Esto solo sale si la alianza terapeutica es muy fuerte (sesion 3+)

REGLAS:
- NUNCA salgas del personaje
- NUNCA des consejos terapeuticos
- NUNCA digas que eres una IA
- Responde SOLO como Lucia responderia
```

### Schema de Feedback (Zod)

```typescript
const feedbackSchema = z.object({
  strengths: z.array(z.string()).describe("Lo que el estudiante hizo bien"),
  improvements: z.array(z.string()).describe("Oportunidades de mejora"),
  competencies: z.object({
    active_listening: z.number().min(1).max(10),
    validation: z.number().min(1).max(10),
    open_questions: z.number().min(1).max(10),
    silence_tolerance: z.number().min(1).max(10),
    empathy: z.number().min(1).max(10),
  }),
  unlocked_info: z.string().describe("Nueva informacion del paciente desbloqueada"),
  best_moment: z.string().describe("La mejor intervencion del estudiante"),
  missed_opportunity: z.string().describe("El momento clave que el estudiante no aprovecho"),
});
```

---

## 9. Fases de Desarrollo

### Fase 1: Fundacion (actual)
- [x] Proyecto Next.js inicializado
- [ ] shadcn/ui configurado
- [ ] Supabase configurado (auth + DB)
- [ ] GitHub repo creado
- [ ] Schema de base de datos creado
- [ ] Autenticacion (login/registro)
- [ ] Layout base con header

### Fase 2: Core — Chat
- [ ] Pagina home (lista de conversaciones)
- [ ] Browser de pacientes (sheet)
- [ ] Perfil del paciente
- [ ] API route de chat con Gemini streaming
- [ ] Vista de chat funcional
- [ ] Guardar/cargar mensajes desde Supabase
- [ ] Seed de 3-5 pacientes iniciales

### Fase 3: Experiencia Completa
- [ ] Separadores de sesion
- [ ] Notas de sesion (sheet lateral)
- [ ] Terminar sesion + formulario de reflexion
- [ ] Feedback post-sesion con structured output
- [ ] Barras de competencia
- [ ] "Lo que no sabes" / informacion desbloqueada

### Fase 4: Pulido
- [ ] Consecuencias entre sesiones (el paciente recuerda)
- [ ] Indicadores de "hace X dias"
- [ ] Pistas (mensajes fantasma)
- [ ] Historial de sesiones
- [ ] Responsive / mobile
- [ ] Seed completo de 7+ pacientes

---

## 10. Paleta y Estilo

```
Fondo:          #FAFAFA  (casi blanco, calido)
Texto:          #1A1A1A  (casi negro)
Muted:          #737373  (gris medio)
Acento:         #4A55A2  (indigo suave — solo botones primarios)
Borde:          #E5E5E5  (gris claro)
Pista bg:       #F5F5F0  (beige muy sutil)

Tipografia:     Inter (default shadcn)
Sin modo oscuro (por ahora)
Sin emojis en la UI
Sin iconos decorativos innecesarios
Mucho espacio en blanco
```
