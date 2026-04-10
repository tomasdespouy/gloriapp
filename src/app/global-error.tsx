"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a1a1a", marginBottom: "0.75rem" }}>
              Error inesperado
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
              {error.message || "La aplicación encontró un problema."}
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", fontFamily: "monospace", marginBottom: "1rem" }}>
                Ref: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, color: "#fff", backgroundColor: "#4A55A2", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
