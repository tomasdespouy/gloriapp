"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search, Plus, Download, Filter, Building2, Globe, Mail,
  Phone, ChevronDown, ChevronUp, X, ExternalLink, MessageSquare,
  Calendar, Trash2, Edit3, Save, MapPin, Send, Loader2, FileText,
} from "lucide-react";
import { sanitizeHTML } from "@/lib/sanitize";

type University = {
  id: string;
  name: string;
  country: string;
  city: string;
  website: string | null;
  type: "pública" | "privada";
  program_name: string;
  contact_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  estimated_students: number | null;
  status: string;
  priority: string;
  notes: string | null;
  next_followup: string | null;
  google_sheets_url: string | null;
  created_at: string;
  updated_at: string;
};

type Activity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string;
  is_default: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  prospecto: "bg-gray-100 text-gray-700",
  contactado: "bg-blue-100 text-blue-700",
  "en conversación": "bg-yellow-100 text-yellow-700",
  "propuesta enviada": "bg-purple-100 text-purple-700",
  negociación: "bg-orange-100 text-orange-700",
  cliente: "bg-green-100 text-green-700",
  descartado: "bg-red-100 text-red-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-50 text-red-700 border-red-200",
  media: "bg-yellow-50 text-yellow-700 border-yellow-200",
  baja: "bg-gray-50 text-gray-600 border-gray-200",
};

const STATUSES = ["prospecto", "contactado", "en conversación", "propuesta enviada", "negociación", "cliente", "descartado"];
const PRIORITIES = ["alta", "media", "baja"];
const ACTIVITY_TYPES = ["nota", "llamada", "email", "reunión", "demo", "otro"];

export default function CRMClient({ universities: initial }: { universities: University[] }) {
  const router = useRouter();
  const [universities, setUniversities] = useState(initial);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortField, setSortField] = useState<"name" | "country" | "status" | "priority">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<University | null>(null);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivity, setNewActivity] = useState({ type: "nota", description: "" });
  const [emailTarget, setEmailTarget] = useState<University | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [formData, setFormData] = useState({
    name: "", country: "", city: "", website: "", type: "privada" as "pública" | "privada",
    program_name: "Psicología", contact_email: "", contact_name: "", contact_phone: "",
    estimated_students: "", status: "prospecto", priority: "media", notes: "",
    next_followup: "", google_sheets_url: "",
  });

  const countries = useMemo(() => {
    const c = [...new Set(universities.map((u) => u.country))].sort();
    return c;
  }, [universities]);

  const filtered = useMemo(() => {
    let list = universities.filter((u) => {
      if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.city.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCountry && u.country !== filterCountry) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (filterType && u.type !== filterType) return false;
      return true;
    });
    list.sort((a, b) => {
      const av = a[sortField] || "";
      const bv = b[sortField] || "";
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [universities, search, filterCountry, filterStatus, filterType, sortField, sortAsc]);

  const stats = useMemo(() => ({
    total: universities.length,
    clientes: universities.filter((u) => u.status === "cliente").length,
    enConversacion: universities.filter((u) => ["en conversación", "propuesta enviada", "negociación"].includes(u.status)).length,
    paises: new Set(universities.map((u) => u.country)).size,
  }), [universities]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-30" />;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const resetForm = () => {
    setFormData({
      name: "", country: "", city: "", website: "", type: "privada",
      program_name: "Psicología", contact_email: "", contact_name: "", contact_phone: "",
      estimated_students: "", status: "prospecto", priority: "media", notes: "",
      next_followup: "", google_sheets_url: "",
    });
    setEditingId(null);
  };

  const openEdit = (u: University) => {
    setFormData({
      name: u.name, country: u.country, city: u.city, website: u.website || "",
      type: u.type, program_name: u.program_name, contact_email: u.contact_email || "",
      contact_name: u.contact_name || "", contact_phone: u.contact_phone || "",
      estimated_students: u.estimated_students?.toString() || "", status: u.status,
      priority: u.priority, notes: u.notes || "", next_followup: u.next_followup || "",
      google_sheets_url: u.google_sheets_url || "",
    });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...formData,
      estimated_students: formData.estimated_students ? parseInt(formData.estimated_students) : null,
      website: formData.website || null,
      contact_email: formData.contact_email || null,
      contact_name: formData.contact_name || null,
      contact_phone: formData.contact_phone || null,
      notes: formData.notes || null,
      next_followup: formData.next_followup || null,
      google_sheets_url: formData.google_sheets_url || null,
    };

    try {
      const res = editingId
        ? await fetch(`/api/admin/crm/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/crm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success(editingId ? "Universidad actualizada" : "Universidad creada");
      setShowForm(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Error al guardar la universidad");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/crm/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Universidad eliminada");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Error al eliminar la universidad");
      setDeleteTarget(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/crm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      router.refresh();
    } catch {
      toast.error("Error al cambiar el estado");
    }
  };

  const loadActivities = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    try {
      const res = await fetch(`/api/admin/crm/${id}`);
      if (!res.ok) throw new Error("Error del servidor");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      toast.error("Error al cargar las actividades");
      setExpanded(null);
    }
  };

  const addActivity = async () => {
    if (!expanded || !newActivity.description.trim()) return;
    try {
      const res = await fetch(`/api/admin/crm/${expanded}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newActivity),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Actividad agregada");
      setNewActivity({ type: "nota", description: "" });
      // Reload
      const reloadRes = await fetch(`/api/admin/crm/${expanded}`);
      const data = await reloadRes.json();
      setActivities(data.activities || []);
    } catch {
      toast.error("Error al agregar la actividad");
    }
  };

  const replaceTemplateVars = (text: string, university: University) => {
    return text
      .replace(/\{\{contact_name\}\}/g, university.contact_name || "Director/a de Carrera")
      .replace(/\{\{institution\}\}/g, university.name)
      .replace(/\{\{program_name\}\}/g, university.program_name)
      .replace(/\{\{estimated_students\}\}/g, university.estimated_students?.toString() || "[N]")
      .replace(/\{\{country\}\}/g, university.country)
      .replace(/\{\{city\}\}/g, university.city);
  };

  const openEmailModal = async (university: University) => {
    setEmailTarget(university);
    setLoadingTemplates(true);
    setSelectedTemplateId("");
    setEmailSubject("");
    setEmailBody("");
    try {
      const res = await fetch("/api/admin/crm/email-templates");
      if (!res.ok) throw new Error("Error al cargar plantillas");
      const data = await res.json();
      setEmailTemplates(data.templates || []);
      // Auto-select first template
      if (data.templates?.length > 0) {
        const first = data.templates[0];
        setSelectedTemplateId(first.id);
        setEmailSubject(replaceTemplateVars(first.subject, university));
        setEmailBody(replaceTemplateVars(first.body_html, university));
      }
    } catch {
      toast.error("Error al cargar las plantillas de email");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = emailTemplates.find((t) => t.id === templateId);
    if (template && emailTarget) {
      setEmailSubject(replaceTemplateVars(template.subject, emailTarget));
      setEmailBody(replaceTemplateVars(template.body_html, emailTarget));
    }
  };

  const handleSendEmail = async () => {
    if (!emailTarget || !emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/admin/crm/${emailTarget.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailSubject,
          html: emailBody,
        }),
      });
      if (res.ok) {
        toast.success("Email enviado");
        setEmailTarget(null);
        router.refresh();
      } else {
        toast.error("Error al enviar email");
      }
    } catch {
      toast.error("Error al enviar email");
    } finally {
      setSendingEmail(false);
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    presentacion: "Presentación",
    seguimiento: "Seguimiento",
    propuesta: "Propuesta",
    demo: "Demo",
    general: "General",
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Universidades</h1>
          <p className="text-sm text-gray-500 mt-1">Base de datos de universidades latinoamericanas con programas de psicología</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/admin/crm/export"
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Download size={16} /> Exportar CSV
          </a>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-sidebar text-white rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            <Plus size={16} /> Nueva universidad
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total universidades", value: stats.total, color: "text-gray-900" },
          { label: "Clientes activos", value: stats.clientes, color: "text-green-700" },
          { label: "En proceso", value: stats.enConversacion, color: "text-yellow-700" },
          { label: "Países", value: stats.paises, color: "text-blue-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar universidad o ciudad..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
          />
        </div>
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer"
        >
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer"
        >
          <option value="">Pública y privada</option>
          <option value="pública">Pública</option>
          <option value="privada">Privada</option>
        </select>
        {(filterCountry || filterStatus || filterType) && (
          <button
            onClick={() => { setFilterCountry(""); setFilterStatus(""); setFilterType(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer"
          >
            <X size={14} /> Limpiar filtros
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500">{filtered.length} universidades</p>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">Universidad <SortIcon field="name" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("country")}>
                  <span className="flex items-center gap-1">País <SortIcon field="country" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Estado <SortIcon field="status" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("priority")}>
                  <span className="flex items-center gap-1">Prioridad <SortIcon field="priority" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {u.city}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.country}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.type === "pública" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                        {u.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {u.contact_name && <div className="text-xs text-gray-700">{u.contact_name}</div>}
                        {u.contact_email && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail size={10} /> {u.contact_email}
                          </div>
                        )}
                        {u.contact_phone && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone size={10} /> {u.contact_phone}
                          </div>
                        )}
                        {!u.contact_name && !u.contact_email && (
                          <span className="text-xs text-gray-400">Sin contacto</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) => handleStatusChange(u.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[u.status] || ""}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[u.priority] || ""}`}>
                        {u.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {u.website && (
                          <a href={u.website} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Sitio web">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => loadActivities(u.id)} className={`p-1.5 rounded hover:bg-gray-100 cursor-pointer ${expanded === u.id ? "text-sidebar" : "text-gray-500"}`} title="Notas">
                          <MessageSquare size={14} />
                        </button>
                        {u.contact_email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEmailModal(u);
                            }}
                            className="p-1.5 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 cursor-pointer"
                            title="Enviar email"
                          >
                            <Send size={14} />
                          </button>
                        )}
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 cursor-pointer" title="Editar">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === u.id && (
                    <tr key={`${u.id}-exp`}>
                      <td colSpan={7} className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                        <div className="max-w-2xl space-y-4">
                          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <MessageSquare size={14} /> Seguimiento comercial
                          </h4>
                          {u.notes && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                              <span className="text-xs text-gray-400 block mb-1">Notas generales</span>
                              {u.notes}
                            </div>
                          )}
                          {u.next_followup && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar size={14} /> Próximo seguimiento: <strong>{u.next_followup}</strong>
                            </div>
                          )}

                          {/* Activity log */}
                          <div className="space-y-2">
                            {activities.map((a) => (
                              <div key={a.id} className="bg-white border border-gray-100 rounded-lg p-3 text-sm">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.type}</span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(a.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <p className="text-gray-700">{a.description}</p>
                              </div>
                            ))}
                          </div>

                          {/* Add activity */}
                          <div className="flex gap-2 items-end">
                            <select
                              value={newActivity.type}
                              onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer"
                            >
                              {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                            <input
                              type="text"
                              value={newActivity.description}
                              onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                              placeholder="Agregar nota de seguimiento..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
                              onKeyDown={(e) => e.key === "Enter" && addActivity()}
                            />
                            <button
                              onClick={addActivity}
                              className="px-4 py-2 bg-sidebar text-white rounded-lg text-sm hover:bg-sidebar-hover transition-colors cursor-pointer"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-40" />
            <p>No se encontraron universidades</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Editar universidad" : "Nueva universidad"}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
                  <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as "pública" | "privada" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer">
                    <option value="pública">Pública</option>
                    <option value="privada">Privada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Programa</label>
                  <input type="text" value={formData.program_name} onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. estudiantes</label>
                  <input type="number" value={formData.estimated_students} onChange={(e) => setFormData({ ...formData, estimated_students: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>

                <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Contacto</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre contacto</label>
                  <input type="text" value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email contacto</label>
                  <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>

                <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Seguimiento</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 cursor-pointer">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próximo seguimiento</label>
                  <input type="date" value={formData.next_followup} onChange={(e) => setFormData({ ...formData, next_followup: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Sheets URL</label>
                  <input type="url" value={formData.google_sheets_url} onChange={(e) => setFormData({ ...formData, google_sheets_url: e.target.value })}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 resize-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !formData.name || !formData.country || !formData.city}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-sidebar text-white rounded-lg hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                <Save size={16} /> {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar universidad</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Template Modal */}
      {emailTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEmailTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sidebar/10 rounded-xl flex items-center justify-center">
                  <Mail size={20} className="text-sidebar" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Enviar email</h2>
                  <p className="text-sm text-gray-500">
                    {emailTarget.contact_name || emailTarget.name} — {emailTarget.contact_email}
                  </p>
                </div>
              </div>
              <button onClick={() => setEmailTarget(null)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Template selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><FileText size={14} /> Plantilla</span>
                </label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 size={14} className="animate-spin" /> Cargando plantillas...
                  </div>
                ) : (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 hover:border-gray-300 cursor-pointer"
                  >
                    <option value="">Seleccionar plantilla...</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({CATEGORY_LABELS[t.category] || t.category})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Asunto</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Asunto del email..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
                />
              </div>

              {/* Body editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contenido (HTML)</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sidebar/30 resize-none"
                />
              </div>

              {/* Preview */}
              {emailBody && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Vista previa</label>
                  <div
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(emailBody) }}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEmailTarget(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-sidebar text-white rounded-lg hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send size={16} /> {sendingEmail ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
