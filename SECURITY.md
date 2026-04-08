# Guia de Seguridad - Plantilla UGM Next.js 15

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Vulnerabilidades Criticas](#vulnerabilidades-criticas)
3. [SQL Injection](#sql-injection)
4. [Librerias Vulnerables](#librerias-vulnerables)
5. [Prisma - Patron Singleton](#prisma---patron-singleton)
6. [Validacion de Entrada](#validacion-de-entrada)
7. [Docker Security Hardening](#docker-security-hardening)
8. [Autenticacion y Autorizacion](#autenticacion-y-autorizacion)
9. [Analisis Estatico (Semgrep)](#analisis-estatico-semgrep)
10. [Checklist de Seguridad](#checklist-de-seguridad)

---

## Resumen Ejecutivo

Este documento establece las practicas de seguridad obligatorias para todos los desarrollos basados en la plantilla UGM Next.js 15. Estas practicas fueron establecidas tras el analisis de incidentes de seguridad reales y auditorias de codigo.

**Principios Fundamentales:**
- Defense in Depth (Defensa en Profundidad)
- Principle of Least Privilege (Minimo Privilegio)
- Input Validation (Validacion de Entrada)
- Secure by Default (Seguro por Defecto)

---

## Vulnerabilidades Criticas

### OWASP Top 10 - Vulnerabilidades Detectadas

| Rank | Vulnerabilidad | Prevencion |
|------|---------------|------------|
| A03 | Injection (SQL) | `$queryRaw` con template literals |
| A01 | Broken Access Control | Validacion server-side obligatoria |
| A06 | Vulnerable Components | Auditoria de dependencias |
| A07 | Auth Failures | MSAL + verificacion server-side |

---

## SQL Injection

### PROHIBIDO: `$queryRawUnsafe` con interpolacion

```typescript
// VULNERABLE - SQL INJECTION
const data = await prisma.$queryRawUnsafe(`
  SELECT * FROM users WHERE id = '${userId}'
`)

// VULNERABLE - Concatenacion de strings
const data = await prisma.$queryRawUnsafe(
  "SELECT * FROM users WHERE name = '" + userName + "'"
)
```

### OBLIGATORIO: `$queryRaw` con template literals

```typescript
// SEGURO - Parametros automaticamente escapados
const data = await prisma.$queryRaw<User[]>`
  SELECT * FROM users WHERE id = ${userId}
`

// SEGURO - Multiples parametros
const data = await prisma.$queryRaw<Course[]>`
  SELECT * FROM courses
  WHERE year = ${validationYear}
    AND period = ${validationPeriod}
    AND career_code = ${careerCode}
`
```

### Para clausulas IN dinamicas: `Prisma.join()`

```typescript
import { Prisma } from '@prisma/client'

// SEGURO - Array de valores parametrizados
const validatedIds = ['123', '456', '789']
const data = await prisma.$queryRaw<Professor[]>`
  SELECT * FROM professors
  WHERE id IN (${Prisma.join(validatedIds)})
`
```

### Validacion ANTES de la query

```typescript
// OBLIGATORIO: Validar entrada antes de usar en query
function isValidAlphanumeric(str: string): boolean {
  return /^[A-Z0-9]+$/i.test(str)
}

function isValidYear(year: number): boolean {
  return !isNaN(year) && year >= 2000 && year <= 2100
}

function isValidPeriod(period: number): boolean {
  return !isNaN(period) && period >= 1 && period <= 4
}

// Uso en API route
export async function POST(request: NextRequest) {
  const { careerCode, year, period } = await request.json()

  // Validar ANTES de usar
  if (!isValidAlphanumeric(careerCode)) {
    return NextResponse.json({ error: 'Invalid career code' }, { status: 400 })
  }

  if (!isValidYear(parseInt(year))) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  // Ahora es seguro usar en query
  const data = await prisma.$queryRaw`
    SELECT * FROM careers WHERE code = ${careerCode}
  `
}
```

---

## Librerias Vulnerables

### CVE-2024-22363: Libreria `xlsx` (SheetJS)

**Severidad:** CRITICA (RCE - Remote Code Execution)
**Tipo:** Prototype Pollution -> Command Injection
**Impacto:** Ejecucion de codigo arbitrario en el servidor

#### PROHIBIDO

```json
// package.json - NUNCA usar
{
  "dependencies": {
    "xlsx": "^0.18.5"  // VULNERABLE
  }
}
```

#### OBLIGATORIO: Usar ExcelJS

```json
// package.json - Usar esta alternativa segura
{
  "dependencies": {
    "exceljs": "^4.4.0"
  }
}
```

#### Migracion de xlsx a ExcelJS

```typescript
// ANTES (xlsx - VULNERABLE)
import * as XLSX from 'xlsx'
const workbook = XLSX.read(buffer, { type: 'buffer' })
const worksheet = workbook.Sheets[workbook.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(worksheet)

// DESPUES (ExcelJS - SEGURO)
import ExcelJS from 'exceljs'

async function parseExcel(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('El archivo Excel no contiene hojas')
  }

  const data: Record<string, string>[] = []
  const headers: string[] = []

  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '')
  })

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const rowData: Record<string, string> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) {
        rowData[header] = String(cell.value || '')
      }
    })
    data.push(rowData)
  })

  return data
}
```

#### Validacion de archivos Excel

```typescript
async function validateExcelFile(file: File): Promise<ArrayBuffer> {
  // 1. Validar extension
  const allowedExtensions = ['.xlsx', '.xls']
  const fileName = file.name.toLowerCase()
  if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
    throw new Error('Solo se permiten archivos Excel (.xlsx, .xls)')
  }

  // 2. Validar tamano (max 10MB)
  const arrayBuffer = await file.arrayBuffer()
  const maxSize = 10 * 1024 * 1024
  if (arrayBuffer.byteLength > maxSize) {
    throw new Error('Archivo excede tamano maximo (10MB)')
  }

  // 3. Validar magic bytes
  const uint8Array = new Uint8Array(arrayBuffer)
  const xlsxMagic = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B &&
                    uint8Array[2] === 0x03 && uint8Array[3] === 0x04
  const xlsMagic = uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF &&
                   uint8Array[2] === 0x11 && uint8Array[3] === 0xE0

  if (!xlsxMagic && !xlsMagic) {
    throw new Error('El archivo no es un Excel valido')
  }

  return arrayBuffer
}
```

### Otras librerias a evitar

| Libreria | Vulnerabilidad | Alternativa |
|----------|---------------|-------------|
| `xlsx` | CVE-2024-22363 (RCE) | `exceljs` |
| `node-serialize` | CVE-2017-5941 (RCE) | JSON nativo |
| `eval()` | Code Injection | Evitar siempre |
| `vm.runInContext()` | Sandbox escape | Evitar |

---

## Prisma - Patron Singleton

### PROHIBIDO: Multiples instancias

```typescript
// INCORRECTO - Cada archivo crea su propia instancia
// api/users/route.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()  // MAL

// api/courses/route.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()  // MAL - Segunda instancia!
```

**Problemas:**
- Agotamiento del pool de conexiones
- Memory leaks
- Conexiones zombi

### OBLIGATORIO: Singleton en `app/contexto/precargado/database.ts`

```typescript
// app/contexto/precargado/database.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### Uso correcto en API routes

```typescript
// api/users/route.ts
import { prisma } from '@/app/contexto/precargado/database'

export async function GET() {
  // Usar singleton - NO crear nueva instancia
  const users = await prisma.user.findMany()
  return NextResponse.json(users)
  // NO llamar prisma.$disconnect() - el singleton lo maneja
}
```

### NO llamar `$disconnect()` en API routes

```typescript
// INCORRECTO
export async function GET() {
  try {
    const data = await prisma.user.findMany()
    return NextResponse.json(data)
  } finally {
    await prisma.$disconnect()  // NO HACER - rompe el singleton
  }
}

// CORRECTO
export async function GET() {
  const data = await prisma.user.findMany()
  return NextResponse.json(data)
  // Sin disconnect - el pool se gestiona automaticamente
}
```

---

## Validacion de Entrada

### Funciones de validacion estandar

```typescript
// lib/validation.ts

// Alfanumerico (codigos de carrera, escuela, etc.)
export function isValidAlphanumeric(str: string): boolean {
  return /^[A-Z0-9]+$/i.test(str)
}

// Ano academico
export function isValidYear(year: number): boolean {
  return !isNaN(year) && year >= 2000 && year <= 2100
}

// Periodo academico (1-4)
export function isValidPeriod(period: number): boolean {
  return !isNaN(period) && period >= 1 && period <= 4
}

// RUT chileno (solo numeros, sin DV)
export function isValidRutFormat(rut: string): boolean {
  return /^\d{7,9}$/.test(rut)
}

// Email
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Codigo de asignatura (4 letras + 3-4 digitos)
export function isValidCourseCode(code: string): boolean {
  return /^[A-Z]{4}\d{3,4}$/i.test(code)
}
```

### Patron de validacion en API routes

```typescript
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const escuelaCodigo = formData.get('escuela') as string
    const carreraCodigo = formData.get('carrera') as string
    const year = formData.get('year') as string
    const period = formData.get('period') as string

    // PASO 1: Validar presencia
    if (!escuelaCodigo || !carreraCodigo) {
      return NextResponse.json(
        { error: 'Faltan parametros requeridos' },
        { status: 400 }
      )
    }

    // PASO 2: Validar formato
    if (!isValidAlphanumeric(escuelaCodigo)) {
      return NextResponse.json(
        { error: 'Codigo de escuela invalido' },
        { status: 400 }
      )
    }

    if (!isValidAlphanumeric(carreraCodigo)) {
      return NextResponse.json(
        { error: 'Codigo de carrera invalido' },
        { status: 400 }
      )
    }

    const validationYear = parseInt(year)
    const validationPeriod = parseInt(period)

    if (!isValidYear(validationYear)) {
      return NextResponse.json(
        { error: 'Ano invalido' },
        { status: 400 }
      )
    }

    if (!isValidPeriod(validationPeriod)) {
      return NextResponse.json(
        { error: 'Periodo invalido' },
        { status: 400 }
      )
    }

    // PASO 3: Ahora es seguro procesar
    // ... logica de negocio

  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
```

---

## Docker Security Hardening

### Dockerfile seguro

```dockerfile
# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-alpine AS deps

# SECURITY: Instalar solo lo necesario
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps
RUN npx prisma generate

# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

RUN npx prisma generate
RUN npm run build

# ==========================================
# Stage 3: Runner (Production) - HARDENED
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# SECURITY: Instalar solo OpenSSL, remover herramientas peligrosas
RUN apk add --no-cache openssl && \
    rm -f /usr/bin/wget 2>/dev/null || true && \
    rm -f /usr/bin/curl 2>/dev/null || true && \
    rm -f /bin/wget /bin/curl 2>/dev/null || true && \
    rm -f /sbin/apk 2>/dev/null || true

# SECURITY: Usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copiar solo lo necesario
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# SECURITY: Permisos minimos
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
```

### docker-compose.yml seguro

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME:-ugm-app}
    restart: unless-stopped

    # SECURITY: Usuario no-root
    user: "1001:1001"

    # SECURITY: Filesystem de solo lectura
    read_only: true

    # SECURITY: Tmpfs para directorios que necesitan escritura
    tmpfs:
      - /tmp:noexec,nosuid,size=100M
      - /app/.next/cache:noexec,nosuid,size=500M

    # SECURITY: Remover todas las capabilities
    cap_drop:
      - ALL

    # SECURITY: Prevenir escalacion de privilegios
    security_opt:
      - no-new-privileges:true

    # SECURITY: Limitar recursos
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M

    ports:
      - "${APP_PORT:-3000}:3000"

    environment:
      DATABASE_URL: ${DATABASE_URL}
      NEXT_PUBLIC_AZURE_AD_CLIENT_ID: ${NEXT_PUBLIC_AZURE_AD_CLIENT_ID}
      NEXT_PUBLIC_AZURE_AD_TENANT_ID: ${NEXT_PUBLIC_AZURE_AD_TENANT_ID}
      NODE_ENV: production

    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    networks:
      - ugm-network

networks:
  ugm-network:
    driver: bridge
```

### Por que estas medidas?

| Medida | Proteccion |
|--------|------------|
| `user: "1001:1001"` | Previene ejecucion como root |
| `read_only: true` | Previene escritura de malware |
| `tmpfs: noexec` | Previene ejecucion desde /tmp |
| `cap_drop: ALL` | Minimo privilegio |
| `no-new-privileges` | Previene escalacion |
| Sin wget/curl | Previene descarga de payloads |
| Limites de recursos | Previene DoS |

---

## Autenticacion y Autorizacion

### Verificacion server-side OBLIGATORIA

```typescript
// lib/auth.ts
import { NextRequest } from 'next/server'
import { verifyToken } from '@/app/auth/msal/verify'

export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    const user = await verifyToken(token)
    return user
  } catch {
    return null
  }
}
```

### Uso en API routes

```typescript
export async function POST(request: NextRequest) {
  // OBLIGATORIO: Verificar autenticacion
  const user = await verifyAuth(request)

  if (!user) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    )
  }

  // Verificar autorizacion (permisos)
  if (!user.roles.includes('admin')) {
    return NextResponse.json(
      { error: 'Permisos insuficientes' },
      { status: 403 }
    )
  }

  // Ahora procesar la solicitud...
}
```

### Validacion de propiedad de datos

```typescript
// OBLIGATORIO: Filtrar por usuario autenticado
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // CORRECTO: Filtrar por RUT del usuario
  const validations = await prisma.validation.findMany({
    where: {
      userRut: user.rut  // Solo datos del usuario autenticado
    }
  })

  return NextResponse.json(validations)
}
```

---

## Analisis Estatico (Semgrep)

### Configuracion `.semgrep.yml`

El archivo `.semgrep.yml` en la raiz del proyecto contiene reglas personalizadas:

1. **sql-injection-queryrawunsafe** (ERROR - Bloqueante)
   - Detecta `$queryRawUnsafe` con interpolacion
   - Requiere usar `$queryRaw` con template literals

2. **api-route-without-auth** (ERROR - Bloqueante)
   - Detecta API routes sin `verifyAuth()`
   - Excluye rutas de autenticacion

3. **unvalidated-access-token** (WARNING)
   - Detecta tokens sin validacion server-side

4. **missing-user-data-ownership-check** (WARNING)
   - Detecta queries sin filtro de usuario

### Ejecutar localmente

```bash
# Instalar Semgrep
pip install semgrep

# Ejecutar analisis
semgrep --config .semgrep.yml --config p/security-audit --config p/owasp-top-ten .

# Generar reporte JSON
semgrep --config .semgrep.yml --json -o semgrep-results.json .
```

### Integracion con Jenkins

El pipeline de Jenkins ejecuta Semgrep automaticamente en el stage "Security Analysis":
- 0 errores: Pipeline continua
- Errores criticos: Pipeline BLOQUEADO

---

## Checklist de Seguridad

### Antes de cada commit

- [ ] No usar `$queryRawUnsafe` con interpolacion
- [ ] Usar `$queryRaw` con template literals
- [ ] Validar TODA entrada del usuario
- [ ] Usar singleton de Prisma (`@/app/contexto/precargado/database`)
- [ ] No llamar `$disconnect()` en API routes
- [ ] Verificar autenticacion server-side
- [ ] No usar libreria `xlsx` (usar `exceljs`)

### Antes de cada deploy

- [ ] `npm audit` sin vulnerabilidades criticas
- [ ] Semgrep sin errores bloqueantes
- [ ] SonarQube Quality Gate passed
- [ ] Tests pasando
- [ ] Docker con usuario no-root
- [ ] Variables de entorno sin secretos en codigo

### Revision periodica

- [ ] Actualizar dependencias mensualmente
- [ ] Revisar CVEs de dependencias
- [ ] Rotar secretos trimestralmente
- [ ] Revisar logs de acceso

---

## Contacto

**Equipo de Seguridad TI - UGM**
- Reportar vulnerabilidades: seguridad@ugm.cl
- Consultas de desarrollo: desarrollo@ugm.cl

---

**Version**: 1.0.0
**Ultima actualizacion**: 2025-01-16
**Basado en**: Incidente de seguridad validador-academico-nextjs (Enero 2025)
