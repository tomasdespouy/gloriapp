import { FileText, MessageSquare, ImageIcon } from "lucide-react";

interface PatientCardProps {
  name: string;
  age: number;
  avatarUrl: string;
}

export default function PatientCard({ name, age, avatarUrl }: PatientCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center">
      {/* Avatar */}
      <div className="w-28 h-28 rounded-full border-4 border-sidebar overflow-hidden mb-4">
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Name & Age */}
      <h3 className="text-lg font-bold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-gray-500 mb-5">Edad: {age} años</p>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 w-full">
        <button className="flex items-center justify-center gap-2 bg-btn-action hover:bg-btn-action-hover text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors w-full">
          <FileText size={16} />
          Retomar conversación
        </button>
        <button className="flex items-center justify-center gap-2 bg-btn-action hover:bg-btn-action-hover text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors w-full">
          <MessageSquare size={16} />
          Iniciar nueva conversación
        </button>
        <button className="flex items-center justify-center gap-2 bg-btn-action hover:bg-btn-action-hover text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors w-full">
          <ImageIcon size={16} />
          Ver foto del paciente
        </button>
      </div>
    </div>
  );
}
