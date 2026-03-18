"use client";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-7 h-7 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Algo salió mal
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Ocurrió un error inesperado. Por favor, intenta nuevamente.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center text-sm font-medium text-white bg-[#4A55A2] px-6 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
