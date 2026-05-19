# -*- coding: utf-8 -*-
"""Desglose de PRE 2025 (ene-mar 2025): qué usuarios estuvieron activos,
   cuántos mensajes hicieron, en qué mes, qué rol, qué dominio.
"""
import sqlite3
con = sqlite3.connect("gloria1-dump/gloria1.sqlite")
con.row_factory = sqlite3.Row

print("="*100)
print("1) Resumen por mes (ene/feb/mar 2025)")
print("="*100)
q = """
SELECT strftime('%Y-%m', datetime(m.created_at, 'unixepoch')) AS mes,
       COUNT(*) AS mensajes,
       COUNT(DISTINCT t.id_usuario) AS usuarios,
       COUNT(DISTINCT t.id_thread) AS threads
FROM messages m
INNER JOIN threads t ON t.id_thread = m.id_thread
WHERE strftime('%Y-%m', datetime(m.created_at, 'unixepoch')) IN ('2025-01','2025-02','2025-03')
GROUP BY mes ORDER BY mes
"""
for r in con.execute(q):
    print(f"  {r['mes']}  msgs={r['mensajes']:>5}  usuarios={r['usuarios']:>3}  threads={r['threads']:>4}")

print("\n" + "="*100)
print("2) Por usuario × mes (todos los activos en PRE 2025), ordenados por total")
print("="*100)
q = """
WITH msg_user AS (
  SELECT m.id, m.created_at, t.id_usuario, u.nombre AS nombre, u.email, u.id_rol,
         ro.nombre AS rol,
         strftime('%Y-%m', datetime(m.created_at, 'unixepoch')) AS mes
  FROM messages m
  INNER JOIN threads t ON t.id_thread = m.id_thread
  INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
  LEFT JOIN roles ro ON ro.id_rol = u.id_rol
)
SELECT id_usuario, nombre, email, rol,
       SUM(CASE WHEN mes='2025-01' THEN 1 ELSE 0 END) AS ene,
       SUM(CASE WHEN mes='2025-02' THEN 1 ELSE 0 END) AS feb,
       SUM(CASE WHEN mes='2025-03' THEN 1 ELSE 0 END) AS mar,
       SUM(CASE WHEN mes IN ('2025-01','2025-02','2025-03') THEN 1 ELSE 0 END) AS total
FROM msg_user
GROUP BY id_usuario, nombre, email, rol
HAVING total > 0
ORDER BY total DESC
"""
print(f"{'ID':>4}  {'Nombre':<28}  {'Email':<32}  {'Rol':<10}  {'Ene':>4} {'Feb':>4} {'Mar':>4}  {'Tot':>5}")
print("-" * 110)
for r in con.execute(q):
    nombre = (r['nombre'] or "")[:28]
    email = (r['email'] or "")[:32]
    print(f"{r['id_usuario']:>4}  {nombre:<28}  {email:<32}  {(r['rol'] or '-')[:10]:<10}  "
          f"{r['ene']:>4} {r['feb']:>4} {r['mar']:>4}  {r['total']:>5}")

print("\n" + "="*100)
print("3) Sub-total por dominio de email en PRE 2025")
print("="*100)
q = """
WITH msg_user AS (
  SELECT m.id, t.id_usuario, u.email,
         strftime('%Y-%m', datetime(m.created_at, 'unixepoch')) AS mes
  FROM messages m
  INNER JOIN threads t ON t.id_thread = m.id_thread
  INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
)
SELECT LOWER(SUBSTR(email, INSTR(email,'@')+1)) AS dominio,
       COUNT(*) AS mensajes,
       COUNT(DISTINCT id_usuario) AS usuarios
FROM msg_user
WHERE mes IN ('2025-01','2025-02','2025-03')
GROUP BY dominio ORDER BY mensajes DESC
"""
print(f"{'Dominio':<32}  {'Msg':>5}  {'Usuarios':>9}")
print("-" * 50)
for r in con.execute(q):
    print(f"{(r['dominio'] or '-')[:32]:<32}  {r['mensajes']:>5}  {r['usuarios']:>9}")
