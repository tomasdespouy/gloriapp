import { LogOut } from "lucide-react";
import PatientCard from "@/components/PatientCard";

const patients = [
  { name: "Matías Ríos", age: 25, avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
  { name: "Gloria", age: 42, avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "Alejandro López", age: 21, avatarUrl: "https://randomuser.me/api/portraits/men/45.jpg" },
  { name: "Luis Fernández", age: 29, avatarUrl: "https://randomuser.me/api/portraits/men/67.jpg" },
  { name: "María Gomez", age: 34, avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "José Ramírez", age: 72, avatarUrl: "https://randomuser.me/api/portraits/men/77.jpg" },
  { name: "Carlos Mendoza", age: 58, avatarUrl: "https://randomuser.me/api/portraits/men/52.jpg" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="flex justify-end items-center px-6 py-4">
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm font-medium">
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </header>

      {/* Patient Grid */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {patients.map((patient) => (
            <PatientCard
              key={patient.name}
              name={patient.name}
              age={patient.age}
              avatarUrl={patient.avatarUrl}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
