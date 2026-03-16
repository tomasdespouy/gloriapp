"use client";

import { useState } from "react";
import {
  Plus, Send, Edit3, Trash2, X, Mail, Check, Users,
} from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  status: string;
  sent_at: string | null;
  total_sent: number;
  total_opened: number;
  created_at: string;
};

type Contact = {
  id: string;
  full_name: string;
  email: string;
  schoolName: string;
  schoolCountry: string;
};

type Props = {
  campaigns: Campaign[];
  contacts: Contact[];
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sending: "bg-amber-50 text-amber-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Fallida",
};

export default function CampanasClient({ campaigns: initialCampaigns, contacts }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showEditor, setShowEditor] = useState(false);
  const [showSender, setShowSender] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [sendingCampaign, setSendingCampaign] = useState<Campaign | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ sent: number; total: number; errors?: string[] } | null>(null);

  const [form, setForm] = useState({
    name: "", subject: "", html_body: "",
  });

  const openEditor = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setForm({ name: campaign.name, subject: campaign.subject, html_body: campaign.html_body });
    } else {
      setEditingCampaign(null);
      setForm({ name: "", subject: "", html_body: "" });
    }
    setShowEditor(true);
  };

  const saveCampaign = async () => {
    if (!form.name || !form.subject || !form.html_body) return;
    setSaving(true);

    const method = editingCampaign ? "PUT" : "POST";
    const body = editingCampaign ? { id: editingCampaign.id, ...form } : form;

    const res = await fetch("/api/admin/growth/campaigns", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      if (editingCampaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
      } else {
        setCampaigns((prev) => [data, ...prev]);
      }
      setShowEditor(false);
    }
    setSaving(false);
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Eliminar campana?")) return;
    const res = await fetch("/api/admin/growth/campaigns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  const openSender = (campaign: Campaign) => {
    setSendingCampaign(campaign);
    setSelectedContacts([]);
    setSendStatus(null);
    setShowSender(true);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedContacts(
      selectedContacts.length === contacts.length ? [] : contacts.map((c) => c.id)
    );
  };

  const sendCampaign = async () => {
    if (!sendingCampaign || selectedContacts.length === 0) return;
    setSaving(true);
    setSendStatus(null);

    const res = await fetch("/api/admin/growth/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: sendingCampaign.id,
        contact_ids: selectedContacts,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setSendStatus({ sent: data.sent, total: data.total, errors: data.errors });
      // Update campaign in list
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === sendingCampaign.id
            ? { ...c, status: "sent", total_sent: (c.total_sent || 0) + data.sent, sent_at: new Date().toISOString() }
            : c
        )
      );
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanas de email</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Crea y envia campanas a tus contactos
          </p>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 px-4 py-2 bg-[#4A55A2] text-white rounded-lg text-sm font-medium hover:bg-[#3d4789] transition-colors"
        >
          <Plus size={16} /> Nueva campana
        </button>
      </header>

      <div className="px-8 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Campana</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Asunto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Enviados</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{c.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[c.status] || "bg-gray-100"}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.total_sent}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => openSender(c)} className="p-1.5 text-gray-400 hover:text-green-600" title="Enviar">
                      <Send size={14} />
                    </button>
                    <button onClick={() => openEditor(c)} className="p-1.5 text-gray-400 hover:text-[#4A55A2]">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => deleteCampaign(c.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                    No hay campanas. Crea una para empezar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingCampaign ? "Editar campana" : "Nueva campana"}
              </h2>
              <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre interno</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Primer contacto - Chile Q1"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto del email</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Usa {{nombre}} y {{escuela}} para personalizar"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuerpo del email (HTML)
                </label>
                <p className="text-[10px] text-gray-400 mb-2">
                  Variables disponibles: {`{{nombre}}`}, {`{{escuela}}`}
                </p>
                <textarea
                  value={form.html_body}
                  onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                  rows={12}
                  placeholder="<div>Hola {{nombre}},\n\nQueremos presentarle GlorIA a {{escuela}}...</div>"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
            </div>

            <button
              onClick={saveCampaign}
              disabled={!form.name || !form.subject || !form.html_body || saving}
              className="w-full bg-[#4A55A2] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d4789] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingCampaign ? "Guardar cambios" : "Crear campana"}
            </button>
          </div>
        </div>
      )}

      {/* Send Campaign Modal */}
      {showSender && sendingCampaign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowSender(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Enviar campana</h2>
                <p className="text-xs text-gray-500">{sendingCampaign.name}</p>
              </div>
              <button onClick={() => setShowSender(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {sendStatus ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Check size={28} className="text-green-500" />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {sendStatus.sent} de {sendStatus.total} emails enviados
                </p>
                {sendStatus.errors && sendStatus.errors.length > 0 && (
                  <div className="mt-3 text-left">
                    <p className="text-xs font-medium text-red-600 mb-1">Errores:</p>
                    {sendStatus.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-500">{err}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowSender(false)}
                  className="mt-4 bg-[#4A55A2] text-white px-6 py-2 rounded-xl text-sm font-medium"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    <Users size={14} className="inline mr-1" />
                    Selecciona destinatarios ({selectedContacts.length} de {contacts.length})
                  </p>
                  <button onClick={selectAll} className="text-xs text-[#4A55A2] hover:underline">
                    {selectedContacts.length === contacts.length ? "Deseleccionar todos" : "Seleccionar todos"}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {contacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(c.id)}
                        onChange={() => toggleContact(c.id)}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                        <p className="text-[10px] text-gray-400">{c.email} - {c.schoolName} ({c.schoolCountry})</p>
                      </div>
                    </label>
                  ))}
                  {contacts.length === 0 && (
                    <p className="text-center py-4 text-sm text-gray-400">No hay contactos activos</p>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    <Mail size={12} className="inline mr-1" />
                    Se enviara el email &ldquo;{sendingCampaign.subject}&rdquo; a {selectedContacts.length} contacto(s).
                    Las variables {`{{nombre}}`} y {`{{escuela}}`} se reemplazaran automaticamente.
                  </p>
                </div>

                <button
                  onClick={sendCampaign}
                  disabled={selectedContacts.length === 0 || saving}
                  className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  {saving ? "Enviando..." : `Enviar a ${selectedContacts.length} contactos`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
