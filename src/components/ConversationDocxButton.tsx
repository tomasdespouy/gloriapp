"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Descarga de una conversación en .docx. Único punto de entrada, para que la
 * ficha del docente y el visor del monitor descarguen exactamente lo mismo.
 *
 * Va por fetch y no por un <a href> pelado a propósito: si el servidor
 * responde 403 o 404, un enlace directo llevaría al docente a una página de
 * JSON crudo. Así el error se muestra como aviso y la vista no se mueve.
 */
export default function ConversationDocxButton({
  conversationId,
  variant = "button",
  label = "Descargar .docx",
  source = "docente",
}: {
  conversationId: string;
  variant?: "button" | "link";
  label?: string;
  /**
   * Qué ruta usar. "docente" pasa por el alcance del monitor; "propia" solo
   * verifica que la conversación sea del que la pide. El documento resultante
   * es idéntico — lo que cambia es quién tiene derecho a pedirlo.
   */
  source?: "docente" | "propia";
}) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (loading) return;
    setLoading(true);
    let objectUrl: string | null = null;
    try {
      const endpoint =
        source === "propia"
          ? `/api/sessions/${conversationId}/docx`
          : `/api/docente/sesion/${conversationId}/docx`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Error ${res.status}`);
      }

      // Con la sesión vencida, el middleware redirige a /login y el fetch la
      // sigue: llega un 200 con HTML. Sin este control se descargaría un
      // .docx corrupto que en realidad es la página de ingreso.
      const type = res.headers.get("Content-Type") || "";
      if (!type.includes("wordprocessingml")) {
        throw new Error("Tu sesión expiró. Vuelve a ingresar para descargar la conversación.");
      }

      // El nombre lo decide el servidor; acá solo se lee del encabezado.
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `sesion-${conversationId}.docx`;

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el documento");
    } finally {
      // Recién acá: revocar antes de que el navegador tome el blob cancela la descarga.
      const url = objectUrl;
      if (url) setTimeout(() => URL.revokeObjectURL(url), 10000);
      setLoading(false);
    }
  };

  if (variant === "link") {
    return (
      <button
        onClick={download}
        disabled={loading}
        className="text-[11px] text-gray-400 hover:text-gray-700 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? "Generando…" : "Descargar .docx ↓"}
      </button>
    );
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 bg-white rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      title="Descarga la transcripción completa de esta sesión en Word"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {loading ? "Generando…" : label}
    </button>
  );
}
