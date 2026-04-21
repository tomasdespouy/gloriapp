"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import HelpTip from "@/components/HelpTip";

type Establishment = {
  id?: string;
  name: string;
  slug: string;
  country?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  is_active?: boolean;
};

export default function EstablishmentForm({
  establishment,
}: {
  establishment?: Establishment;
}) {
  const router = useRouter();
  const [name, setName] = useState(establishment?.name || "");
  const [slug, setSlug] = useState(establishment?.slug || "");
  const [country, setCountry] = useState(establishment?.country || "");
  const [logoUrl, setLogoUrl] = useState(establishment?.logo_url || "");
  const [websiteUrl, setWebsiteUrl] = useState(establishment?.website_url || "");
  const [contactName, setContactName] = useState(establishment?.contact_name || "");
  const [contactEmail, setContactEmail] = useState(establishment?.contact_email || "");
  const [isActive, setIsActive] = useState(establishment?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!establishment?.id;

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit) {
      setSlug(val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = isEdit
      ? `/api/admin/establishments/${establishment.id}`
      : "/api/admin/establishments";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          country: country || null,
          logo_url: logoUrl || null,
          website_url: websiteUrl || null,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        setLoading(false);
        return;
      }

      toast.success(isEdit ? "Institución actualizada" : "Institución creada");
      router.refresh();
      if (!isEdit) {
        router.push("/admin/establecimientos");
      }
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información básica */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información de la institución</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la institución</label>
            <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required placeholder="Universidad Gabriela Mistral" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug (identificador único)<HelpTip text="Identificador único de la institución (sin espacios ni caracteres especiales)" /></label>
            <input type="text" value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" required placeholder="ugm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">País</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-gray-300 cursor-pointer">
              <option value="">Seleccionar país</option>
              <option value="Chile">Chile</option>
              <option value="Argentina">Argentina</option>
              <option value="Colombia">Colombia</option>
              <option value="México">México</option>
              <option value="Perú">Perú</option>
              <option value="España">España</option>
              <option value="Ecuador">Ecuador</option>
              <option value="Bolivia">Bolivia</option>
              <option value="Uruguay">Uruguay</option>
              <option value="Paraguay">Paraguay</option>
              <option value="Venezuela">Venezuela</option>
              <option value="República Dominicana">República Dominicana</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL del sitio web</label>
            <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="https://www.ugm.cl" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">URL del logo<HelpTip text="URL directa a la imagen del logotipo (PNG o SVG recomendado)" /></label>
            <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
            {logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Preview" className="h-10 w-auto rounded bg-sidebar p-1" />
                <span className="text-[10px] text-gray-400">Vista previa (fondo real del sidebar)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persona de contacto */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Persona de contacto</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="contacto@ugm.cl" />
          </div>
        </div>
      </div>

      {/* Estado */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_active" checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
        <label htmlFor="is_active" className="text-sm text-gray-700">Institución activa</label>
        <span className="text-[10px] text-gray-400">
          {isActive ? "(visible para todos los usuarios)" : "(oculta — los usuarios no podrán acceder)"}
        </span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={loading}
        className="bg-sidebar text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50">
        {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear institución"}
      </button>
    </form>
  );
}
