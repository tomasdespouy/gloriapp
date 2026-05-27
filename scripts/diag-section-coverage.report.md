# Cobertura de secciones — Fase 0 (monitor operacional)

Generado con `node scripts/diag-section-coverage.js` (READ-ONLY, PROD).

## Hallazgo

- **Instructores con sección asignada: 7/19 (37%)**
- **Alumnos con sección asignada:** mayoría sin sección, concentrada en Demo, Testeo y UGM.
- 466 alumnos y 8 instructores quedan **sin `establishment_id`** (corpus legado / GlorIA 1.0).

Cobertura por establecimiento (resumen):

| Establecimiento | Instructores c/sección | Alumnos c/sección |
|---|---|---|
| Testeo | 2/2 (100%) | 30/33 (91%) |
| UGM | 3/4 (75%) | 43/45 (96%) |
| Demo | 2/4 (50%) | 14/35 (40%) |
| UCSP, UBO, Cuyo, ULima, UDLA | 0 | 0% |

## Decisión

El alcance **por sección para instructores cae a establecimiento cuando el
instructor no tiene `section_id`** (fallback acordado). Con la cobertura actual,
solo Testeo/UGM/Demo verían acotado a su sección; el resto vería su
establecimiento completo. Funciona sin romper el panel docente actual.

Acción futura (fuera de PR-A): asignar `section_id` a instructores y alumnos
de los pilotos activos para que el acotamiento por sección tenga efecto real.
