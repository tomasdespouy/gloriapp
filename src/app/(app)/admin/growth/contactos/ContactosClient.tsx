"use client";

import { useState } from "react";
import {
  Plus, Search, Building2, User, Mail, Phone,
  Globe, Trash2, Edit3, X, ChevronDown, ChevronRight,
} from "lucide-react";

type School = {
  id: string;
  name: string;
  country: string;
  city: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type Contact = {
  id: string;
  school_id: string | null;
  full_name: string;
  email: string;
  role_title: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  schoolName: string;
  schoolCountry: string;
};

type Props = {
  schools: School[];
  contacts: Contact[];
};

const statusLabels: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-gray-100 text-gray-700" },
  contacted: { label: "Contactado", color: "bg-blue-50 text-blue-700" },
  interested: { label: "Interesado", color: "bg-amber-50 text-amber-700" },
  negotiating: { label: "Negociando", color: "bg-purple-50 text-purple-700" },
  client: { label: "Cliente", color: "bg-green-50 text-green-700" },
  rejected: { label: "Rechazado", color: "bg-red-50 text-red-700" },
};

const COUNTRIES = [
  "Argentina", "Bolivia", "Chile", "Colombia", "Costa Rica", "Cuba",
  "Ecuador", "El Salvador", "España", "Guatemala", "Honduras", "México",
  "Nicaragua", "Panamá", "Paraguay", "Perú", "Portugal", "Puerto Rico",
  "República Dominicana", "Uruguay", "Venezuela",
];

export default function ContactosClient({ schools: initialSchools, contacts: initialContacts }: Props) {
  const [schools, setSchools] = useState(initialSchools);
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [tab, setTab] = useState<"schools" | "contacts">("schools");
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // School form
  const [schoolForm, setSchoolForm] = useState({
    name: "", country: "", city: "", website: "", notes: "", status: "lead",
  });

  // Contact form
  const [contactForm, setContactForm] = useState({
    school_id: "", full_name: "", email: "", role_title: "", phone: "", notes: "",
  });

  const filteredSchools = schools.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.country.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCountry && s.country !== filterCountry) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const filteredContacts = contacts.filter((c) => {
    if (search && !c.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !c.email.toLowerCase().includes(search.toLowerCase()) &&
        !c.schoolName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCountry && c.schoolCountry !== filterCountry) return false;
    return true;
  });

  // ── School CRUD ──
  const openSchoolForm = (school?: School) => {
    if (school) {
      setEditingSchool(school);
      setSchoolForm({
        name: school.name,
        country: school.country,
        city: school.city || "",
        website: school.website || "",
        notes: school.notes || "",
        status: school.status,
      });
    } else {
      setEditingSchool(null);
      setSchoolForm({ name: "", country: "", city: "", website: "", notes: "", status: "lead" });
    }
    setShowSchoolModal(true);
  };

  const saveSchool = async () => {
    if (!schoolForm.name || !schoolForm.country) return;
    setSaving(true);

    const method = editingSchool ? "PUT" : "POST";
    const body = editingSchool ? { id: editingSchool.id, ...schoolForm } : schoolForm;

    const res = await fetch("/api/admin/growth/schools", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      if (editingSchool) {
        setSchools((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      } else {
        setSchools((prev) => [data, ...prev]);
      }
      setShowSchoolModal(false);
    }
    setSaving(false);
  };

  const deleteSchool = async (id: string) => {
    if (!confirm("Eliminar escuela y todos sus contactos?")) return;
    const res = await fetch("/api/admin/growth/schools", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setSchools((prev) => prev.filter((s) => s.id !== id));
      setContacts((prev) => prev.filter((c) => c.school_id !== id));
    }
  };

  // ── Contact CRUD ──
  const openContactForm = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setContactForm({
        school_id: contact.school_id || "",
        full_name: contact.full_name,
        email: contact.email,
        role_title: contact.role_title || "",
        phone: contact.phone || "",
        notes: contact.notes || "",
      });
    } else {
      setEditingContact(null);
      setContactForm({ school_id: "", full_name: "", email: "", role_title: "", phone: "", notes: "" });
    }
    setShowContactModal(true);
  };

  const saveContact = async () => {
    if (!contactForm.full_name || !contactForm.email) return;
    setSaving(true);

    const method = editingContact ? "PUT" : "POST";
    const payload = {
      ...(editingContact ? { id: editingContact.id } : {}),
      ...contactForm,
      school_id: contactForm.school_id || null,
    };

    const res = await fetch("/api/admin/growth/contacts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      // Reload page to get fresh data with joins
      window.location.reload();
    }
    setSaving(false);
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Eliminar contacto?")) return;
    const res = await fetch("/api/admin/growth/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escuelas y Contactos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {schools.length} escuelas, {contacts.length} contactos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openSchoolForm()}
            className="flex items-center gap-2 px-4 py-2 bg-[#4A55A2] text-white rounded-lg text-sm font-medium hover:bg-[#3d4789] transition-colors"
          >
            <Plus size={16} /> Escuela
          </button>
          <button
            onClick={() => openContactForm()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Plus size={16} /> Contacto
          </button>
        </div>
      </header>

      <div className="px-8 pb-8 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
            />
          </div>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
          >
            <option value="">Todos los paises</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {tab === "schools" && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
            >
              <option value="">Todos los estados</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          )}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab("schools")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "schools" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Escuelas
            </button>
            <button
              onClick={() => setTab("contacts")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "contacts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Contactos
            </button>
          </div>
        </div>

        {/* Schools tab */}
        {tab === "schools" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Escuela</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pais / Ciudad</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contactos</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map((school) => {
                  const schoolContacts = contacts.filter((c) => c.school_id === school.id);
                  const isExpanded = expandedSchool === school.id;
                  return (
                    <tr key={school.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedSchool(isExpanded ? null : school.id)}
                          className="flex items-center gap-2"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{school.name}</p>
                            {school.website && (
                              <a href={school.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#4A55A2] hover:underline">
                                {school.website}
                              </a>
                            )}
                          </div>
                        </button>
                        {isExpanded && schoolContacts.length > 0 && (
                          <div className="mt-2 ml-6 space-y-1">
                            {schoolContacts.map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-xs text-gray-500 py-1">
                                <User size={12} />
                                <span className="font-medium">{c.full_name}</span>
                                <span className="text-gray-400">({c.role_title || "Sin cargo"})</span>
                                <a href={`mailto:${c.email}`} className="text-[#4A55A2]">{c.email}</a>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{school.country}</p>
                        {school.city && <p className="text-[10px] text-gray-400">{school.city}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusLabels[school.status]?.color || "bg-gray-100"}`}>
                          {statusLabels[school.status]?.label || school.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{schoolContacts.length}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openSchoolForm(school)} className="p-1.5 text-gray-400 hover:text-[#4A55A2]">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => deleteSchool(school.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSchools.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                      No hay escuelas. Agrega una para empezar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Contacts tab */}
        {tab === "contacts" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Escuela</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{contact.full_name}</p>
                      {contact.phone && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {contact.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${contact.email}`} className="text-sm text-[#4A55A2] hover:underline">
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.role_title || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{contact.schoolName}</p>
                      <p className="text-[10px] text-gray-400">{contact.schoolCountry}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        contact.status === "active" ? "bg-green-50 text-green-700" :
                        contact.status === "bounced" ? "bg-red-50 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openContactForm(contact)} className="p-1.5 text-gray-400 hover:text-[#4A55A2]">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => deleteContact(contact.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                      No hay contactos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* School Modal */}
      {showSchoolModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowSchoolModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSchool ? "Editar escuela" : "Nueva escuela"}
              </h2>
              <button onClick={() => setShowSchoolModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                    placeholder="Universidad de..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pais *</label>
                  <select
                    value={schoolForm.country}
                    onChange={(e) => setSchoolForm({ ...schoolForm, country: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  >
                    <option value="">Seleccionar...</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={schoolForm.city}
                    onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={schoolForm.website}
                    onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={schoolForm.status}
                  onChange={(e) => setSchoolForm({ ...schoolForm, status: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                >
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={schoolForm.notes}
                  onChange={(e) => setSchoolForm({ ...schoolForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
            </div>

            <button
              onClick={saveSchool}
              disabled={!schoolForm.name || !schoolForm.country || saving}
              className="w-full bg-[#4A55A2] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d4789] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingSchool ? "Guardar cambios" : "Crear escuela"}
            </button>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowContactModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingContact ? "Editar contacto" : "Nuevo contacto"}
              </h2>
              <button onClick={() => setShowContactModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={contactForm.full_name}
                    onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={contactForm.role_title}
                    onChange={(e) => setContactForm({ ...contactForm, role_title: e.target.value })}
                    placeholder="Director, Decano..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escuela</label>
                <select
                  value={contactForm.school_id}
                  onChange={(e) => setContactForm({ ...contactForm, school_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                >
                  <option value="">Sin escuela asignada</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
            </div>

            <button
              onClick={saveContact}
              disabled={!contactForm.full_name || !contactForm.email || saving}
              className="w-full bg-[#4A55A2] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d4789] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingContact ? "Guardar cambios" : "Crear contacto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
