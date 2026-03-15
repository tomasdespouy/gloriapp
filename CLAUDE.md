# CLAUDE.md — GloriA Project

## Project Overview

GloriA is a web platform for psychology students to practice therapeutic conversations with AI-simulated patients. Each patient has a unique personality, backstory, and clinical condition. Students practice, reflect, and improve their clinical skills.

**Philosophy:** Chat-first, minimalist, no noise. The conversation is the product.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, React 19)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **AI/Chat:** Dual provider — OpenAI GPT-4o or Google Gemini 2.5 Flash (configurable via `LLM_PROVIDER` env var)
- **Structured outputs:** Zod + zod-to-json-schema
- **Hosting:** Vercel (planned)

## Project Structure

```
src/
  app/              # Next.js App Router pages and layouts
    layout.tsx      # Root layout (Sidebar + main content)
    page.tsx        # Home page (patient grid)
    globals.css     # Tailwind v4 + theme config
  components/       # React components
    ui/             # shadcn/ui base components
    PatientCard.tsx  # Patient card UI
    Sidebar.tsx     # Navigation sidebar
  lib/
    ai.ts           # Unified LLM interface (OpenAI + Gemini)
    gemini.ts       # Gemini-only client (legacy, use ai.ts instead)
    utils.ts        # Tailwind merge utilities
    supabase/
      client.ts     # Browser Supabase client
      server.ts     # Server Supabase client
      middleware.ts  # Session/auth management
supabase/
  config.toml       # Supabase CLI configuration
  migrations/       # Database migrations (ordered by timestamp)
  seed.sql          # Seed data (loaded via supabase db reset)
```

## Database

### Supabase CLI (required)

All database changes MUST go through Supabase migrations. Never modify the database directly through the Supabase dashboard SQL editor.

```bash
# Link to remote project (first time)
npx supabase link --project-ref ndwmnxlwbfqfwwtekjun

# Create a new migration
npx supabase migration new <migration_name>

# Push migrations to remote database
npx supabase db push

# Check migration status
npx supabase migration list
```

### Tables

- **profiles** — extends auth.users (id, email, full_name, role)
- **ai_patients** — AI patient definitions (name, age, backstory, system_prompt, difficulty_level, etc.)
- **conversations** — therapy sessions (student_id, ai_patient_id, status, session_number)
- **messages** — chat messages (conversation_id, role, content)
- **session_feedback** — post-session reflection and AI feedback

### RLS Policies

All tables have Row Level Security enabled:
- Students can only see/modify their own data
- AI patients are visible to all authenticated users (if is_active = true)
- Messages are accessible only through owned conversations

## LLM Configuration

The project supports two LLM providers via `src/lib/ai.ts`:

```typescript
import { chat } from "@/lib/ai";
const response = await chat(messages, systemPrompt);
```

Switch providers in `.env.local`:
```
LLM_PROVIDER=openai   # uses GPT-4o
LLM_PROVIDER=gemini   # uses Gemini 2.5 Flash
```

## Development

```bash
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Production build
npm run lint      # Run ESLint
```

## Environment Variables

Required in `.env.local` (see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `LLM_PROVIDER` — "openai" or "gemini"
- `OPENAI_API_KEY` — OpenAI API key (if using openai)
- `OPENAI_MODEL` — OpenAI model (default: gpt-4o)
- `GOOGLE_API_KEY` — Google Gemini API key (if using gemini)
- `GEMINI_MODEL` — Gemini model (default: gemini-2.5-flash)

## Coding Conventions

- Language: TypeScript strict mode
- Path alias: `@/*` maps to `src/*`
- Components: functional components, no class components
- Styling: Tailwind CSS v4 utility classes, no CSS modules
- State: React Server Components by default, "use client" only when needed
- Data fetching: Server Components with Supabase server client
- Forms/mutations: Server Actions or Route Handlers
- UI components: shadcn/ui (install via `npx shadcn@latest add <component>`)

## Design System

- Background: #FAFAFA (warm white)
- Text: #1A1A1A (near black)
- Accent: #4A55A2 (soft indigo)
- Border: #E5E5E5 (light gray)
- No dark mode
- No emojis in UI
- Lots of whitespace
- Typography: system default (Geist via next/font)
