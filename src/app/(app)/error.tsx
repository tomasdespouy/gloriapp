"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlorIA] App error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Algo no cargó correctamente
        </h2>
        <p className="text-sm text-gray-500">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">
            Ref: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-white bg-sidebar rounded-lg hover:bg-sidebar-hover transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
