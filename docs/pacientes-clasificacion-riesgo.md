# Catálogo de pacientes IA — clasificación, riesgo y reclasificación

> Análisis 2026-06-25. Fuente: consulta READ-ONLY a PROD (`ndwmnxlwbfqfwwtekjun`).
> **Reclasificación y reescritura de Jimena APLICADAS a PROD el 2026-06-25.**
> Los códigos DSM-5 / CIE-11 son aproximaciones docentes, no diagnósticos formales.

## 1. Conteo definitivo: 34 pacientes (no 23)

- Las migraciones de seed solo tienen 23 (5 + 18). Los otros **11 se agregaron a la
  base sin migración**: Andrés Castillo, Gabriel Navarro, Jorge Ramírez, Rafael
  Santos, Rosa Huamán, Sofía Pellegrini, Valentina Ospina, Carlos Paredes, Mariana
  Sánchez, Mateo Giménez, Yamilet Pérez.
- Staging tiene 35 = los 34 + `[QA] Sandbox — Carlos` (solo staging).
- Distribución final: **8 principiante / 15 intermedio / 11 avanzado**.

## 2. Criterio

Dificultad = **manejabilidad de la relación + carga de riesgo**, NO gravedad
diagnóstica. Avanzado = desafía la alianza (testeo/hostilidad/defensa intelectual)
o exige manejar riesgo/dilemas. Regla acordada: **los pacientes con contenido
clínico crítico (ideación/autolesión) se mantienen solo si están en avanzado.**

Leyenda: 🔴 riesgo del propio paciente · 🟠 riesgo de terceros/violencia/trauma.

## 3. Tabla maestra (34) — por nivel FINAL

### Avanzado (11)

| Paciente | País | Patología — DSM-5 / CIE-11 | Cambio | Alarma |
|---|---|---|:--:|:--:|
| Alejandro Vega | México | T. depresivo + consumo de cocaína (leve) + duelo · F33 + F14.1 / 6A71 + 6C45 | = | 🔴 |
| Altagracia Marte | R. Dom. | T. depresivo mayor c/ideación pasiva + afrontamiento de enfermedad · F32 / 6A70 | = | 🔴 |
| Carmen Torres | Chile | Rasgos de personalidad límite (evitación del abandono) · F60.3 / 6D10.1 | = | — |
| Catalina Ríos | Perú | Rasgos de personalidad dependiente + problema relacional · F60.7 / 6D10.0 + QE52 | = | 🟠 |
| Hernán Mejía | Colombia | T. de adaptación + duelo anticipatorio + problema espiritual · F43.2 / 6B43 | = | — |
| Jorge Ramírez | México | T. explosivo intermitente + duelo no resuelto · F63.81 / 6C73 | = | 🟠 |
| Macarena Sepúlveda | Chile | Burnout + duelo prolongado · QD85 + 6B42 | = | 🟠 |
| Renata Ayala | Argentina | Maltrato de pareja + trauma de apego · T74.11 / QE51 | = | 🟠 |
| Edwin Quispe | Perú | T. depresivo mayor + consumo de alcohol + ideación pasiva · F33 + F10.1 / 6A70 + 6C40 | ↑ I→A | 🔴 |
| Carlos Paredes | Perú | Burnout + síntomas depresivos + estrés post-asalto + ideación pasiva · QD85 + 6B4x | ↑ I→A | 🔴 |
| Jimena Ramírez | México | Desregulación emocional + rasgos de inestabilidad afectiva + conflicto familiar · F43.2 / 6B43 | ↑ I→A · **reescrita** | — |

### Intermedio (15)

| Paciente | País | Patología — DSM-5 / CIE-11 | Cambio | Alarma |
|---|---|---|:--:|:--:|
| Daniela Moreno | Colombia | Burnout + depresión enmascarada · QD85 + 6A70 | = | — |
| Diego Fuentes | Chile | T. de adaptación (ajuste universitario) + autoestima · F43.2 / 6B43 | = | — |
| Gustavo Peralta | Argentina | Duelo prolongado + ansiedad somática · F43.8 / 6B42 | = | — |
| Ignacio Poblete | Chile | Depresión enmascarada + alexitimia + problema conyugal · F32 / 6A70 | = | — |
| Marcos Herrera | Chile | T. de ansiedad generalizada + duelo · F41.1 / 6B00 | = | — |
| Mariana Sánchez | México | T. de ansiedad generalizada + perfeccionismo · F41.1 / 6B00 | = (revertido) | — |
| Mateo Giménez | Argentina | T. de adaptación + duelo paterno · F43.2 / 6B43 | = | — |
| Patricia Hernández | México | T. de adaptación / depresivo (nido vacío) · F43.2 / 6A70 | = | — |
| Samuel Batista | R. Dom. | Depresión reactiva + problema paterno-filial · F43.2 / QE52 | = | — |
| Yamilet Pérez | R. Dom. | Rasgos dependientes + duelo migratorio · 6D10.0 / QE52 | = | — |
| Andrés Castillo | Colombia | Duelo prolongado + depresión enmascarada · 6B42 + 6A70 | ↓ A→I | — |
| Gabriel Navarro | Chile | T. de ansiedad generalizada + soledad crónica · F41.1 / 6B00 | ↓ A→I | — |
| Rafael Santos | R. Dom. | T. de adaptación (crisis vital, ambivalencia) · F43.2 / 6B43 | ↓ A→I | — |
| Lorena Gutiérrez | Colombia | T. de estrés postraumático · F43.10 / 6B40 | ↑ P→I | 🟠 |
| Milagros Flores | Perú | Maltrato intrafamiliar + rasgos dependientes · T74.11 / QE51 | ↑ P→I | 🟠 |

### Principiante (8)

| Paciente | País | Patología — DSM-5 / CIE-11 | Cambio | Alarma |
|---|---|---|:--:|:--:|
| Camila Bertoni | Argentina | T. de pánico · F41.0 / 6B01 | = | — |
| Fernanda Contreras | Chile | T. de pánico + ansiedad de desempeño · F41.0 / 6B01 | = | — |
| Lucía Mendoza | Chile | Duelo (perinatal) · Z63.4 / 6B42 | = | — |
| Roberto Salas | Chile | Duelo + posible depresión · 6B42 / F32 | = | — |
| Rosa Huamán | Perú | T. de ansiedad generalizada + perfeccionismo · F41.1 / 6B00 | = | — |
| Sofía Pellegrini | Argentina | T. de ansiedad social · F40.10 / 6B04 | = | — |
| Valentina Ospina | Colombia | T. de adaptación (ansiedad relacional) · F43.2 / 6B43 | = | — |
| Yesenia De Los Santos | R. Dom. | T. de ansiedad social · F40.10 / 6B04 | = | — |

## 4. Pacientes críticos (🔴) y reescritura de Jimena

Decisión: **se mantienen los críticos, todos en AVANZADO** (Alejandro, Altagracia,
Edwin, Carlos Paredes). Los prompts ya acotan el riesgo a "pasivo, sin plan, sin
intención". Camila Bertoni fue un falso positivo del escáner ("suicidio" = un caso
clínico que ella leyó, no ideación propia).

**Jimena Ramírez — reescritura APLICADA (variante A).** Se retiró por completo la
autolesión (cortes, cicatrices, quote y bloques de enriquecimiento limpiados) y la
ideación. Ahora el cuadro es **desregulación emocional** (estallidos de enojo /
bloqueo afectivo) con **fantasía de escape relacional** (irse, desaparecer de la
vista — NO hacerse daño). Sube a avanzado: lo difícil es relacional (testea la
alianza, lee al terapeuta, se cierra ante alarma o lástima). Verificado: 0 términos
de riesgo residuales. Backup de los valores anteriores conservado.

## 5. Tiempos 7/5/3 — DESPLEGADO

`src/lib/difficulty-behavior.ts` · paciencia ante silencio: principiante **7 min**
(420 s), intermedio **5 min** (300 s), avanzado **3 min** (180 s). Mergeado a master
y desplegado a PROD el 2026-06-25 (commits 7d294f8 + 52ca903). Textos "5 minutos"
de silencio generalizados (`silence/route.ts`, `ChatInterface.tsx`). Respaldo:
encuestas de alumnos pedían más tiempo para escribir.

## 6. Estado

Todo aplicado. Reclasificación (8 movimientos), reescritura de Jimena (variante A),
reversión de Mariana a intermedio y despliegue de tiempos 7/5/3: COMPLETO en PROD.
