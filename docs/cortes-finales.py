# -*- coding: utf-8 -*-
"""Genera las matrices finales institución × cohorte y otros cortes
   para la sección UGM-céntrica del informe.

Reglas (acordadas con el usuario el 2026-05-19):
  - UGM       = email LIKE %@estudiante.ugm.cl OR %@ugm.cl
                + 8 estudiantes con gmail.com confirmados manualmente como UGM
                  (IDs 134, 136, 141, 147, 154, 172, 173 — UGM T3 2025 ;
                       127 — UGM T2 2025)
  - UPC       = email LIKE %upc%
  - USB Cali  = email LIKE %usbcali%
  - USMP      = email LIKE %usmp%
  - Unicaribe = email LIKE %unicaribe%
  - No atribuible = resto (gmail no confirmado, ugm.com, hotmail, outlook, yahoo, etc.)

Cohortes:
  - PRE 2025  : ene–mar 2025
  - T1 2025   : abr–jun 2025
  - T2 2025   : jul–sep 2025
  - T3 2025   : oct 2025 – ene 2026
  - T1 2026   : feb–abr 2026
"""
import sqlite3
con = sqlite3.connect("gloria1-dump/gloria1.sqlite")
con.row_factory = sqlite3.Row

# Vista auxiliar: cada mensaje con institución y cohorte
con.executescript("""
DROP VIEW IF EXISTS v_msg;
CREATE VIEW v_msg AS
WITH msg_user AS (
  SELECT m.id, m.created_at, t.id_usuario, u.email,
         LOWER(TRIM(u.email)) AS e
  FROM messages m
  INNER JOIN threads t ON t.id_thread = m.id_thread
  INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
)
SELECT id, created_at, id_usuario, email,
  CASE
    WHEN e LIKE '%@estudiante.ugm.cl' OR e LIKE '%@ugm.cl' THEN 'UGM'
    WHEN id_usuario IN (134, 136, 141, 147, 154, 172, 173, 127) THEN 'UGM'
    WHEN e LIKE '%upc%'       THEN 'UPC'
    WHEN e LIKE '%usbcali%'   THEN 'USB Cali'
    WHEN e LIKE '%usmp%'      THEN 'USMP'
    WHEN e LIKE '%unicaribe%' THEN 'Unicaribe'
    ELSE 'No atribuible'
  END AS institucion,
  CASE
    WHEN datetime(created_at, 'unixepoch') BETWEEN '2025-01-01' AND '2025-03-31 23:59:59' THEN 'PRE 2025'
    WHEN datetime(created_at, 'unixepoch') BETWEEN '2025-04-01' AND '2025-06-30 23:59:59' THEN 'T1 2025'
    WHEN datetime(created_at, 'unixepoch') BETWEEN '2025-07-01' AND '2025-09-30 23:59:59' THEN 'T2 2025'
    WHEN datetime(created_at, 'unixepoch') BETWEEN '2025-10-01' AND '2026-01-31 23:59:59' THEN 'T3 2025'
    WHEN datetime(created_at, 'unixepoch') BETWEEN '2026-02-01' AND '2026-04-30 23:59:59' THEN 'T1 2026'
    ELSE 'Fuera de cohorte'
  END AS cohorte,
  strftime('%Y-%m', datetime(created_at, 'unixepoch')) AS mes
FROM msg_user;
""")

INSTS = ["UGM", "UPC", "USB Cali", "USMP", "Unicaribe", "No atribuible"]
COHORTES = ["PRE 2025", "T1 2025", "T2 2025", "T3 2025", "T1 2026"]

def tabla(metric):
    """Devuelve dict[(inst,cohorte)] = valor."""
    if metric == "msg":
        sql = "SELECT institucion, cohorte, COUNT(*) AS v FROM v_msg GROUP BY 1,2"
    elif metric == "thread":
        sql = """SELECT institucion, cohorte, COUNT(DISTINCT m.id_thread) AS v
                 FROM v_msg vm INNER JOIN messages m ON m.id = vm.id GROUP BY 1,2"""
        # Simplification: use the underlying join
        sql = """
          WITH x AS (
            SELECT t.id_thread, t.id_usuario, vm.institucion, vm.cohorte
            FROM v_msg vm
            INNER JOIN messages m ON m.id = vm.id
            INNER JOIN threads t ON t.id_thread = m.id_thread
          )
          SELECT institucion, cohorte, COUNT(DISTINCT id_thread) AS v
          FROM x GROUP BY 1,2
        """
    elif metric == "user":
        sql = "SELECT institucion, cohorte, COUNT(DISTINCT id_usuario) AS v FROM v_msg GROUP BY 1,2"
    return {(r["institucion"], r["cohorte"]): r["v"] for r in con.execute(sql)}

def imprimir(titulo, metric):
    print("\n" + "="*100)
    print(titulo)
    print("="*100)
    data = tabla(metric)
    hdr = f"{'Institucion':<16}" + "".join(f"{c:>11}" for c in COHORTES) + f"{'TOTAL':>11}"
    print(hdr)
    print("-" * len(hdr))
    totals_col = {c: 0 for c in COHORTES}
    for inst in INSTS:
        fila = f"{inst:<16}"
        total = 0
        for c in COHORTES:
            v = data.get((inst, c), 0)
            fila += f"{v:>11,}".replace(",", ".")
            total += v
            totals_col[c] += v
        fila += f"{total:>11,}".replace(",", ".")
        print(fila)
    fila = f"{'TOTAL':<16}"
    gran = 0
    for c in COHORTES:
        fila += f"{totals_col[c]:>11,}".replace(",", ".")
        gran += totals_col[c]
    fila += f"{gran:>11,}".replace(",", ".")
    print("-" * len(hdr))
    print(fila)

imprimir("TABLA A. MENSAJES por institución × cohorte", "msg")
imprimir("TABLA B. THREADS por institución × cohorte", "thread")
imprimir("TABLA C. USUARIOS ÚNICOS por institución × cohorte", "user")

# Mensajes por mes × institución (UGM + 4 institucionales + No atrib)
print("\n" + "="*100)
print("TABLA D. MENSAJES por mes × institución")
print("="*100)
sql = """SELECT mes, institucion, COUNT(*) AS n
         FROM v_msg WHERE mes IS NOT NULL
         GROUP BY mes, institucion ORDER BY mes"""
matrix = {}
meses = []
for r in con.execute(sql):
    matrix.setdefault(r["mes"], {})[r["institucion"]] = r["n"]
    if r["mes"] not in meses: meses.append(r["mes"])
hdr = f"{'Mes':<10}" + "".join(f"{i[:9]:>10}" for i in INSTS) + f"{'TOTAL':>10}"
print(hdr)
print("-" * len(hdr))
for m in meses:
    fila = f"{m:<10}"
    total = 0
    for inst in INSTS:
        v = matrix[m].get(inst, 0)
        fila += f"{v:>10,}".replace(",", ".")
        total += v
    fila += f"{total:>10,}".replace(",", ".")
    print(fila)

# Detalle UGM por cohorte: huérfanos vs secciones GC
print("\n" + "="*100)
print("TABLA E. Detalle UGM — partición por sub-cohorte y origen (sección vs huérfano)")
print("="*100)
sql = """
WITH ugm AS (
  SELECT vm.cohorte, t.id_thread, t.id_usuario, vm.id AS msg_id, vm.email
  FROM v_msg vm
  INNER JOIN messages m ON m.id = vm.id
  INNER JOIN threads t ON t.id_thread = m.id_thread
  WHERE vm.institucion = 'UGM'
),
ugm_tag AS (
  SELECT cohorte, id_thread, id_usuario, msg_id, email,
    CASE WHEN id_usuario IN (SELECT id_estudiante FROM estudiantes_secciones)
         THEN 'GC (secciones)' ELSE 'huérfano (sin sección)' END AS origen
  FROM ugm
)
SELECT cohorte, origen,
  COUNT(*) AS mensajes,
  COUNT(DISTINCT id_thread) AS threads,
  COUNT(DISTINCT id_usuario) AS usuarios
FROM ugm_tag GROUP BY cohorte, origen ORDER BY cohorte, origen
"""
print(f"{'Cohorte':<12}  {'Origen':<25}  {'Msg':>7}  {'Thr':>5}  {'Usr':>4}")
print("-" * 65)
for r in con.execute(sql):
    print(f"{r['cohorte']:<12}  {r['origen']:<25}  {r['mensajes']:>7,}  {r['threads']:>5}  {r['usuarios']:>4}".replace(",","."))
