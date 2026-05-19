# -*- coding: utf-8 -*-
"""
Convierte los JSON de gloria1-dump/mysql-dump/ a una DB SQLite local
en gloria1-dump/gloria1.sqlite. Valida conteos contra el manifest.
"""
import json
import sqlite3
from pathlib import Path

DUMP = Path("gloria1-dump/mysql-dump")
OUT = Path("gloria1-dump/gloria1.sqlite")
OUT.unlink(missing_ok=True)

con = sqlite3.connect(OUT)
con.executescript("""
CREATE TABLE secciones (
  id_seccion INTEGER PRIMARY KEY,
  nombre TEXT, id_profesor INTEGER, fecha_creacion TEXT,
  enabled INTEGER, anio INTEGER, semestre INTEGER
);
CREATE TABLE usuarios (
  id_usuario INTEGER PRIMARY KEY,
  nombre TEXT, email TEXT, id_rol INTEGER,
  enabled INTEGER, ultimo_acceso TEXT, minutos_uso INTEGER,
  id_seccion INTEGER
);
CREATE TABLE estudiantes_secciones (
  id INTEGER PRIMARY KEY,
  id_seccion INTEGER, id_estudiante INTEGER, fecha_asignacion TEXT
);
CREATE TABLE threads (
  id_thread TEXT PRIMARY KEY,
  id_usuario INTEGER, fecha_creacion TEXT,
  created_at TEXT, updated_at TEXT,
  enabled INTEGER, id_asistente TEXT
);
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  id_thread TEXT, role TEXT, content TEXT, created_at INTEGER
);
CREATE TABLE roles (
  id_rol INTEGER PRIMARY KEY, nombre TEXT
);
CREATE INDEX ix_threads_user ON threads(id_usuario);
CREATE INDEX ix_msg_thread ON messages(id_thread);
CREATE INDEX ix_es_estu ON estudiantes_secciones(id_estudiante);
CREATE INDEX ix_es_secc ON estudiantes_secciones(id_seccion);
""")

def load(name, table, cols, transform=None):
    rows = json.loads((DUMP / f"{name}.json").read_text(encoding="utf-8"))
    placeholders = ",".join(["?"] * len(cols))
    sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
    data = []
    for r in rows:
        if transform: r = transform(r)
        data.append(tuple(r.get(c) for c in cols))
    con.executemany(sql, data)
    con.commit()
    print(f"  {table:<25} {len(rows):>6} rows")

# secciones — renombrar año → anio
load("secciones", "secciones",
     ["id_seccion","nombre","id_profesor","fecha_creacion","enabled","anio","semestre"],
     transform=lambda r: {**r, "anio": r.get("año")})

load("usuarios", "usuarios",
     ["id_usuario","nombre","email","id_rol","enabled","ultimo_acceso","minutos_uso","id_seccion"])

load("EstudiantesSecciones", "estudiantes_secciones",
     ["id","id_seccion","id_estudiante","fecha_asignacion"])

load("Threads", "threads",
     ["id_thread","id_usuario","fecha_creacion","created_at","updated_at","enabled","id_asistente"],
     transform=lambda r: {**r, "created_at": r.get("createdAt"), "updated_at": r.get("updatedAt")})

load("messages", "messages",
     ["id","id_thread","role","content","created_at"])

load("roles", "roles", ["id_rol","nombre"])

# Validación
print("\nValidación de conteos:")
expected = {"secciones": 11, "usuarios": 371, "estudiantes_secciones": 229,
            "threads": 794, "messages": 25740, "roles": 3}
for table, n in expected.items():
    got = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    flag = "OK" if got == n else f"MISMATCH (esperado {n})"
    print(f"  {table:<25} {got:>6}   {flag}")

con.close()
print(f"\nDB lista: {OUT}")
