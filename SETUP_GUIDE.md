# GloriA — Guia de Configuracion

Sigue estos pasos en orden para configurar todas las credenciales y servicios.

---

## Paso 1: Crear una cuenta en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Click en "Start your project" o "Sign Up"
3. Puedes registrarte con GitHub (recomendado) o con email
4. Una vez dentro, click en "New Project"
5. Elige:
   - **Organization:** Tu organizacion personal
   - **Project name:** `gloria`
   - **Database password:** Elige una contrasena segura y GUARDALA
   - **Region:** Elige la mas cercana a ti (ej: South America si estas en Chile)
6. Click "Create new project" y espera ~2 minutos

### Obtener las credenciales de Supabase

1. En tu proyecto de Supabase, ve a **Project Settings** (icono de engranaje)
2. Click en **API** en el menu lateral
3. Copia estos valores:

| Valor | Donde encontrarlo |
|---|---|
| **Project URL** | Seccion "Project URL" — es algo como `https://abcdef.supabase.co` |
| **anon/public key** | Seccion "Project API Keys" → `anon` `public` — empieza con `eyJ...` |
| **service_role key** | Seccion "Project API Keys" → `service_role` `secret` — empieza con `eyJ...` |

> **IMPORTANTE:** La `service_role key` es secreta. NUNCA la expongas en el frontend.

---

## Paso 2: Crear la base de datos

1. En tu proyecto de Supabase, ve a **SQL Editor** (menu lateral)
2. Click en "New query"
3. Copia y pega el SQL que esta en el archivo `supabase/schema.sql` del proyecto
4. Click en "Run" (o Ctrl+Enter)
5. Deberias ver "Success. No rows returned" para cada comando

Luego ejecuta el archivo `supabase/seed.sql` de la misma forma para crear los pacientes iniciales.

---

## Paso 3: Configurar autenticacion en Supabase

1. En tu proyecto de Supabase, ve a **Authentication** → **Providers**
2. Asegurate de que **Email** esta habilitado (viene habilitado por defecto)
3. Ve a **Authentication** → **URL Configuration**
4. Configura:
   - **Site URL:** `http://localhost:3000` (para desarrollo)
   - **Redirect URLs:** Agrega `http://localhost:3000/auth/confirm`

5. Ve a **Authentication** → **Email Templates** → **Confirm signup**
6. En el template, cambia el link de confirmacion a:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```

---

## Paso 4: Obtener una API Key de Google Gemini

1. Ve a [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Inicia sesion con tu cuenta de Google
3. Click en "Create API key"
4. Selecciona un proyecto de Google Cloud (o crea uno nuevo)
5. Se generara una clave — COPIALA inmediatamente

> **Nota sobre costos:**
> - Gemini 2.5 Flash tiene un **free tier**: 10 requests/minuto, 250 requests/dia
> - Para uso personal/desarrollo esto es suficiente
> - Si necesitas mas, activa billing en Google Cloud Console
> - Costo pagado: ~$0.30 por millon de tokens de input, ~$2.50 por millon de output

---

## Paso 5: Configurar variables de entorno

Crea el archivo `.env.local` en la raiz del proyecto (`mi-app/.env.local`):

```bash
# =============================================
# SUPABASE
# =============================================

# La URL de tu proyecto Supabase
# La encuentras en: Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co

# La clave publica (anon key) de tu proyecto
# La encuentras en: Project Settings → API → anon public
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# La clave de service role (SECRETA — solo server-side)
# La encuentras en: Project Settings → API → service_role secret
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# =============================================
# GOOGLE GEMINI
# =============================================

# Tu API key de Google AI Studio
# La generas en: https://aistudio.google.com/apikey
GOOGLE_API_KEY=AIzaSy...

# Modelo a usar (no cambiar a menos que quieras otro)
GEMINI_MODEL=gemini-2.5-flash
```

---

## Paso 6: Verificar que todo funciona

1. Abre una terminal en la carpeta del proyecto
2. Ejecuta:
   ```bash
   npm run dev
   ```
3. Abre [http://localhost:3000](http://localhost:3000)
4. Deberias ver la pagina de login
5. Crea una cuenta con tu email
6. Revisa tu email para confirmar la cuenta
7. Inicia sesion y deberias ver la pantalla principal

---

## Resumen de variables de entorno

| Variable | Donde obtenerla | Publica? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Si |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public | Si |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | **NO** |
| `GOOGLE_API_KEY` | Google AI Studio → API Keys | **NO** |
| `GEMINI_MODEL` | Fijo: `gemini-2.5-flash` | Si |

---

## Troubleshooting

### "Invalid API key" de Supabase
- Verifica que copiaste la clave completa (empieza con `eyJ...` y es muy larga)
- Verifica que no hay espacios al inicio o final

### "API key not valid" de Gemini
- Ve a [Google AI Studio](https://aistudio.google.com/apikey) y verifica que la clave esta activa
- Si acabas de crearla, espera 1-2 minutos

### "Email not confirmed"
- Revisa tu bandeja de spam
- En Supabase → Authentication → Users, puedes confirmar manualmente un usuario haciendo click en los 3 puntos → "Confirm user"

### El chat no responde
- Verifica que `GOOGLE_API_KEY` esta correctamente configurado en `.env.local`
- Revisa la consola del servidor (terminal donde corre `npm run dev`) para ver errores
- Verifica que no has excedido el rate limit del free tier (10 req/min)
