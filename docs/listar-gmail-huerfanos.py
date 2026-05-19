# -*- coding: utf-8 -*-
"""Lista los 9 estudiantes @gmail.com sin sección con su actividad
   para atribución uno a uno (UGM, externo, demo).
"""
import sqlite3
con = sqlite3.connect("gloria1-dump/gloria1.sqlite")
con.row_factory = sqlite3.Row

q = """
SELECT u.id_usuario, u.nombre, u.email, u.enabled,
       SUBSTR(u.ultimo_acceso, 1, 10) AS ultimo_acceso,
       (SELECT COUNT(*) FROM threads t WHERE t.id_usuario = u.id_usuario) AS threads,
       (SELECT COUNT(m.id) FROM messages m
        INNER JOIN threads t ON t.id_thread = m.id_thread
        WHERE t.id_usuario = u.id_usuario) AS mensajes,
       (SELECT MIN(SUBSTR(t.fecha_creacion, 1, 10)) FROM threads t
        WHERE t.id_usuario = u.id_usuario) AS primer_thread,
       (SELECT MAX(SUBSTR(t.fecha_creacion, 1, 10)) FROM threads t
        WHERE t.id_usuario = u.id_usuario) AS ultimo_thread
FROM usuarios u
WHERE u.id_rol = 3
  AND LOWER(u.email) LIKE '%@gmail.com'
  AND u.id_usuario NOT IN (SELECT id_estudiante FROM estudiantes_secciones)
ORDER BY mensajes DESC, u.id_usuario
"""

print(f"{'ID':>4}  {'Nombre':<28}  {'Email':<35}  {'Msg':>5}  {'Thr':>4}  Período de uso")
print("-" * 130)
for r in con.execute(q):
    periodo = f"{r['primer_thread']} a {r['ultimo_thread']}" if r['primer_thread'] else "(sin actividad)"
    print(f"{r['id_usuario']:>4}  {r['nombre'][:28]:<28}  {r['email'][:35]:<35}  "
          f"{r['mensajes'] or 0:>5}  {r['threads'] or 0:>4}  {periodo}")
