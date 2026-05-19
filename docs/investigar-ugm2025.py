# -*- coding: utf-8 -*-
"""Investiga la duda: ¿hay secciones UGM 2025 en el dump?
   Y si no: ¿dónde quedaron los estudiantes UGM de 2025?
"""
import sqlite3
from collections import Counter
con = sqlite3.connect("gloria1-dump/gloria1.sqlite")
con.row_factory = sqlite3.Row

print("="*70)
print("1) Secciones por año de creación")
print("="*70)
for r in con.execute("""
  SELECT id_seccion, nombre, anio, semestre, enabled,
         SUBSTR(fecha_creacion, 1, 10) AS fecha
  FROM secciones ORDER BY fecha_creacion
"""):
    print(f"  #{r['id_seccion']:<3} {r['fecha']}  año={r['anio']} sem={r['semestre']} "
          f"enabled={r['enabled']}  {r['nombre']}")

print("\n" + "="*70)
print("2) Estudiantes asignados por sección (vía EstudiantesSecciones)")
print("="*70)
for r in con.execute("""
  SELECT s.id_seccion, s.nombre, COUNT(es.id_estudiante) AS estudiantes
  FROM secciones s
  LEFT JOIN estudiantes_secciones es ON es.id_seccion = s.id_seccion
  GROUP BY s.id_seccion ORDER BY s.fecha_creacion
"""):
    print(f"  #{r['id_seccion']:<3}  {r['estudiantes']:>4} est.  {r['nombre']}")

print("\n" + "="*70)
print("3) ¿Cuántos estudiantes NO están en EstudiantesSecciones? (huérfanos)")
print("="*70)
r = con.execute("""
  SELECT COUNT(*) FROM usuarios u
  WHERE u.id_rol = 3   -- estudiante
    AND u.id_usuario NOT IN (SELECT id_estudiante FROM estudiantes_secciones)
""").fetchone()
print(f"  Estudiantes (rol=3) sin sección asignada: {r[0]}")
print()
# Y por rol
print("  Distribución por rol:")
for r in con.execute("""
  SELECT u.id_rol, ro.nombre AS rol, COUNT(*) AS n
  FROM usuarios u LEFT JOIN roles ro ON ro.id_rol = u.id_rol
  GROUP BY u.id_rol, ro.nombre
"""):
    print(f"    rol {r['id_rol']} ({r['rol']:<12}): {r['n']:>4}")

print("\n" + "="*70)
print("4) Dominios de email de los estudiantes huérfanos (sin sección)")
print("="*70)
rows = con.execute("""
  SELECT LOWER(SUBSTR(email, INSTR(email, '@')+1)) AS dominio, COUNT(*) AS n
  FROM usuarios u
  WHERE u.id_rol = 3
    AND u.id_usuario NOT IN (SELECT id_estudiante FROM estudiantes_secciones)
  GROUP BY dominio ORDER BY n DESC
""").fetchall()
total_orph = sum(r["n"] for r in rows)
for r in rows[:25]:
    pct = 100 * r["n"] / total_orph if total_orph else 0
    print(f"  {r['dominio']:<35}  {r['n']:>4}  ({pct:>4.1f} %)")
print(f"  {'TOTAL':<35}  {total_orph:>4}")

print("\n" + "="*70)
print("5) Dominios de email de los estudiantes CON sección")
print("="*70)
rows = con.execute("""
  SELECT LOWER(SUBSTR(u.email, INSTR(u.email, '@')+1)) AS dominio, COUNT(DISTINCT u.id_usuario) AS n
  FROM usuarios u
  INNER JOIN estudiantes_secciones es ON es.id_estudiante = u.id_usuario
  GROUP BY dominio ORDER BY n DESC
""").fetchall()
total_w = sum(r["n"] for r in rows)
for r in rows[:25]:
    pct = 100 * r["n"] / total_w if total_w else 0
    print(f"  {r['dominio']:<35}  {r['n']:>4}  ({pct:>4.1f} %)")
print(f"  {'TOTAL':<35}  {total_w:>4}")

print("\n" + "="*70)
print("6) ¿Cuántos huérfanos tienen actividad (mensajes/threads)?")
print("="*70)
r = con.execute("""
  SELECT COUNT(DISTINCT u.id_usuario) AS users_active,
         COUNT(DISTINCT t.id_thread) AS threads,
         COUNT(m.id) AS msgs
  FROM usuarios u
  INNER JOIN threads t ON t.id_usuario = u.id_usuario
  INNER JOIN messages m ON m.id_thread = t.id_thread
  WHERE u.id_rol = 3
    AND u.id_usuario NOT IN (SELECT id_estudiante FROM estudiantes_secciones)
""").fetchone()
print(f"  Estudiantes huérfanos activos: {r['users_active']}")
print(f"  Threads de huérfanos:           {r['threads']}")
print(f"  Mensajes de huérfanos:          {r['msgs']}")

print("\n" + "="*70)
print("7) Distribución mensual de mensajes — huérfanos vs con sección")
print("="*70)
rows = con.execute("""
  WITH msg_user AS (
    SELECT m.id, m.created_at, t.id_usuario,
      CASE WHEN t.id_usuario IN (SELECT id_estudiante FROM estudiantes_secciones)
           THEN 'con_seccion' ELSE 'sin_seccion' END AS grupo
    FROM messages m INNER JOIN threads t ON t.id_thread = m.id_thread
  )
  SELECT strftime('%Y-%m', datetime(created_at, 'unixepoch')) AS mes,
         SUM(CASE WHEN grupo='con_seccion' THEN 1 ELSE 0 END) AS con_seccion,
         SUM(CASE WHEN grupo='sin_seccion' THEN 1 ELSE 0 END) AS sin_seccion
  FROM msg_user
  GROUP BY mes ORDER BY mes
""").fetchall()
print(f"  {'Mes':<10}  {'con sección':>12}  {'sin sección':>12}")
for r in rows:
    print(f"  {r['mes']:<10}  {r['con_seccion']:>12}  {r['sin_seccion']:>12}")
