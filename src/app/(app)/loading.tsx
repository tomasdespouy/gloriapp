export default function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="loading-spinner" />
        <p className="text-sm text-gray-400 font-medium">Cargando...</p>
      </div>
    </div>
  );
}
