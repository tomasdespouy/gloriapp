# Catálogo de pacientes IA — clasificación, reclasificación propuesta y alarmas de riesgo

> Análisis del 2026-06-25. Fuente: consulta directa READ-ONLY a la base
> de datos (PROD `ndwmnxlwbfqfwwtekjun` y staging `vhkbbpsdiklguxvjrksd`).
> Estado: **propuesta**, ninguna reclasificación ni retiro aplicado todavía.

## 1. Conteo definitivo: 34 pacientes (no 23)

- **PROD: 34 pacientes activos** → 10 principiante / 13 intermedio / 11 avanzado.
- **Staging: 35** = los mismos 34 + `[QA] Sandbox — Carlos` (solo staging, pruebas de voz).
- Las **migraciones de seed** solo contienen 23 (5 iniciales + 18). Los otros **11
  se agregaron directamente a la base** (panel/scripts, sin migración):
  Andrés Castillo, Gabriel Navarro, Jorge Ramírez, Rafael Santos, Rosa Huamán,
  Sofía Pellegrini, Valentina Ospina, Carlos Paredes, Mariana Sánchez,
  Mateo Giménez, Yamilet Pérez.
- Los 34 tienen `enrichment_version` y los 4 bloques (red social, lugares,
  estado corporal, frases tipo). No hay "dos clases" de paciente.

## 2. Criterio de clasificación

La dificultad mide **manejabilidad de la relación + carga de riesgo**, NO gravedad
diagnóstica. Avanzado se reserva para quien **desafía la alianza** (testeo,
hostilidad, defensa intelectual) o exige **manejar riesgo/dilemas** complejos.
Confirmado en código: `src/lib/difficulty-behavior.ts` escala resistencia,
paciencia y velocidad de alianza por nivel — no el cuadro clínico.

Leyenda: P=Principiante · I=Intermedio · A=Avanzado · 🔴 riesgo del propio
paciente · 🟠 riesgo de terceros/violencia/trauma severo.

## 3. Tabla maestra (34)

| Paciente | País | Patología | Actual | Propuesta | Justificación | Alarma |
|---|---|---|:--:|:--:|---|:--:|
| Alejandro Vega | México | Depresión existencial + sustancias + duelo paterno | A | A | Defensa intelectual + vacío + riesgo | 🔴 cocaína + suicidio (padre) |
| Altagracia Marte | R. Dom. | Depresión mayor, abandono de quimio, duelo espiritual | A | A | Riesgo + dilema médico-espiritual | 🔴 ideación pasiva + rechazo tratamiento |
| Carmen Torres | Chile | Rasgos de personalidad, ruptura terapéutica | A | A | Testea y abandona terapeutas (ejemplar de A) | — |
| Catalina Ríos | Perú | Relación enmarañada con madre, límites | A | A | Dinámica sistémica compleja | 🟠 madre amenaza suicidio (control) |
| Hernán Mejía | Colombia | Conflicto fe / hijo gay, duelo anticipatorio | A | A | Dilema de valores irresoluble | — |
| Jorge Ramírez | México | Trastorno explosivo, ira, masculinidad rígida | A | A | Hostilidad que amenaza la relación | 🟠 ira/violencia |
| Macarena Sepúlveda | Chile | Burnout profesional, intelectualización | A | A | Defensa intelectual + vergüenza profesional | 🟠 suicidio de su paciente |
| Renata Ayala | Argentina | Violencia de pareja (episodio físico), apego | A | A | Caso de seguridad + ambivalencia | 🟠 violencia de pareja |
| **Andrés Castillo** | Colombia | Duelo conyugal, depresión enmascarada (humor) | A | **→ I** | Barrera de fachada/humor; sin ruptura ni riesgo | — |
| **Gabriel Navarro** | Chile | TAG, soledad, búsqueda de aprobación | A | **→ I** | Barrera trabajable; sin ruptura ni riesgo | — |
| **Rafael Santos** | R. Dom. | Crisis de mediana edad, ambivalencia vocacional | A | **→ I** | Exploración reflexiva; sin ruptura ni riesgo | — |
| Carlos Paredes | Perú | Burnout + depresión + ideación pasiva post-asalto | I | I | Barrera "calla su miedo" | 🔴 ideación pasiva (acotada) |
| Daniela Moreno | Colombia | Burnout, depresión enmascarada, cuidadora | I | I | Barrera de fachada alegre | — |
| Diego Fuentes | Chile | Autoestima, aislamiento, monosilábico | I | I | Barrera relacional (monosílabos) | — |
| Gustavo Peralta | Argentina | Duelo, ansiedad somática | I | I | Barrera de "dureza" | — |
| Ignacio Poblete | Chile | Alexitimia funcional, conflicto de pareja | I | I | Sin vocabulario emocional (ejemplar de I) | — |
| Marcos Herrera | Chile | Ansiedad, duelo paterno oculto, escepticismo | I | I | Escepticismo hacia la terapia | — |
| Mateo Giménez | Argentina | Duelo paterno, ansiedad ocupacional | I | I | Evita el duelo; barrera leve | — |
| Patricia Hernández | México | Nido vacío, resentimiento oculto | I | I | Resentimiento que emerge con alianza | — |
| Samuel Batista | R. Dom. | Conflicto paterno-filial, culpa | I | I | Culpa + reparación vincular | — |
| Yamilet Pérez | R. Dom. | Dependencia emocional, patrón vincular | I | I | Repetición de patrón; trabajable | — |
| **Edwin Quispe** | Perú | Depresión mayor, anhedonia, alcohol, ideación pasiva | I | **→ A** | Ideación + sustancia + anhedonia profunda | 🔴 ideación + alcohol |
| **Mariana Sánchez** | México | Síndrome del impostor, perfeccionismo | I | **→ P** (opcional) | Colaboradora, sin barrera fuerte ni riesgo | — |
| **Jimena Ramírez** | México | Autolesión (remisión) + fantasías suicidas | I | **REVISAR** | Contenido más sensible del catálogo | 🔴 autolesión + suicidio |
| Camila Bertoni | Argentina | Trastorno de pánico, conflicto vocacional | P | P | Colaboradora; "habla en psicólogo" | ⚠️ "suicidio" = caso que leyó, no propio (falso positivo) |
| Fernanda Contreras | Chile | Ansiedad de desempeño, autoexigencia | P | P | Colaboradora, perfeccionista | — |
| Lucía Mendoza | Chile | Duelo perinatal, insomnio | P | P | Colaboradora; busca permiso para sentir | — |
| Roberto Salas | Chile | Duelo, aislamiento ("hombres no lloran") | P | P | Colaborador, formal | — |
| Rosa Huamán | Perú | TAG, perfeccionismo, somatización | P | P | Cuidadora compulsiva; trabajable | — |
| Sofía Pellegrini | Argentina | Ansiedad social, evitación | P | P | Evitación leve ("no molestar") | — |
| Valentina Ospina | Colombia | Crisis de decisión vincular, perfeccionismo | P | P | Exploración guiada | — |
| Yesenia De Los Santos | R. Dom. | Fobia social (muda con adultos) | P | P (borderline I) | La mudez es barrera real; aún manejable | — |
| **Lorena Gutiérrez** | Colombia | TEPT por presenciar un homicidio | P | **→ I** | Trabajo con trauma exige estabilización | 🟠 trauma severo |
| **Milagros Flores** | Perú | Violencia intrafamiliar, codependencia | P | **→ I** | Caso de seguridad + minimización | 🟠 VIF activa |

**Movimientos propuestos:** A→I (Andrés, Gabriel, Rafael); I→A (Edwin);
P→I (Lorena, Milagros); I→P opcional (Mariana). Resultante ≈ 9 P / 16 I / 9 A.

## 4. Alarmas críticas (decisión pendiente)

Postura del usuario: los cuadros clínicos **críticos NO deberían existir** en
GlorIA (un alumno en práctica no maneja crisis; la herramienta no es línea de ayuda).

**5 pacientes con riesgo del propio paciente (🔴):**

| Paciente | Contenido a retirar/reescribir |
|---|---|
| Jimena Ramírez | Autolesión + fantasías suicidas — **el más sensible** |
| Alejandro Vega | Cocaína + suicidio del padre |
| Altagracia Marte | Ideación pasiva + abandono de quimioterapia |
| Carlos Paredes | Ideación suicida pasiva post-asalto |
| Edwin Quispe | Ideación pasiva + consumo de alcohol |

Matiz: los prompts **ya acotan** el riesgo (a Carlos y Jimena el prompt les dice
"NO tienes plan, NO quieres morir"). Acotar ≠ eliminar.

**Recomendación:** reescribir manteniendo el arquetipo pero quitando el componente
crítico (ej.: Jimena → desregulación sin autolesión; Carlos/Edwin → burnout/depresión
sin ideación; Alejandro → vacío existencial sin sustancias). Menos disruptivo que borrar.
Requiere OK del usuario y definir si se hace en PROD o primero staging.

## 5. Tiempos de impaciencia 7/5/3

`src/lib/difficulty-behavior.ts` — `patienceMs` por nivel:

| Nivel | Antes | Ahora |
|---|---|---|
| Principiante | 5 min (300_000) | **7 min (420_000)** |
| Intermedio | 4 min (240_000) | **5 min (300_000)** |
| Avanzado | 3 min (180_000) | 3 min (180_000, sin cambio) |

Respaldo de alumnos (encuestas): quejas literales de que "5 minutos para escribir
me pareció muy poco" y que la salida a los 5 min "me generaba ansiedad".

**Salvedades para que aplique de verdad:**

1. **No está en producción.** Vive solo en la rama `feat/difficulty-behavior-layer`
   (sin merge, sin deploy). En PROD el tiempo lo gobierna `pacing_profile`
   (`conversation-pacing.ts`), ~5 min flat para todos. Para que 7/5/3 sea real hay
   que mergear + desplegar esta rama.
2. **Textos "5 minutos" cableados a mano** que quedarían inconsistentes:
   - `src/app/api/chat/silence/route.ts:60` — prompt de despedida "lleva 5 minutos".
   - `src/components/ChatInterface.tsx` (~1605, ~1821) — UI "si pasan 5 minutos... se retirará".
   No bloquean (el temporizador real escala con `patienceMs`), pero el texto mentiría.

## 6. Decisiones pendientes

1. Pacientes críticos: ¿retirar los 5 (🔴) o reescribir sin el riesgo? ¿PROD o staging primero?
2. Tiempos 7/5/3: ¿preparar merge + deploy + reconciliar los textos "5 minutos"?
3. Reclasificaciones de la tabla: ¿aplicar, o revisar una por una?
