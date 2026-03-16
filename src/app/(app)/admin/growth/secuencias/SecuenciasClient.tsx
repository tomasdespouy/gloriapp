"use client";

import { useState } from "react";
import {
  Plus, Trash2, X, Zap, ChevronDown, ChevronRight,
  Clock, Mail, Power, PowerOff, Users,
} from "lucide-react";

type Step = {
  id: string;
  step_order: number;
  delay_days: number;
  subject: string;
  html_body: string;
};

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  steps: Step[];
  enrollmentCount: number;
};

type Contact = {
  id: string;
  full_name: string;
  email: string;
  schoolName: string;
};

type Props = {
  sequences: Sequence[];
  contacts: Contact[];
};

type StepForm = {
  delay_days: number;
  subject: string;
  html_body: string;
};

export default function SecuenciasClient({ sequences: initialSequences, contacts }: Props) {
  const [sequences, setSequences] = useState(initialSequences);
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollSeqId, setEnrollSeqId] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", description: "" });
  const [stepsForm, setStepsForm] = useState<StepForm[]>([
    { delay_days: 0, subject: "", html_body: "" },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openEditor = (seq?: Sequence) => {
    if (seq) {
      setEditingId(seq.id);
      setForm({ name: seq.name, description: seq.description || "" });
      setStepsForm(
        seq.steps.map((s) => ({
          delay_days: s.delay_days,
          subject: s.subject,
          html_body: s.html_body,
        }))
      );
    } else {
      setEditingId(null);
      setForm({ name: "", description: "" });
      setStepsForm([{ delay_days: 0, subject: "", html_body: "" }]);
    }
    setShowEditor(true);
  };

  const addStep = () => {
    setStepsForm((prev) => [...prev, { delay_days: 3, subject: "", html_body: "" }]);
  };

  const removeStep = (index: number) => {
    setStepsForm((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof StepForm, value: string | number) => {
    setStepsForm((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const saveSequence = async () => {
    if (!form.name || stepsForm.length === 0) return;
    setSaving(true);

    const method = editingId ? "PUT" : "POST";
    const body = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      steps: stepsForm,
    };

    const res = await fetch("/api/admin/growth/sequences", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      // Reload to get fresh data
      window.location.reload();
    }
    setSaving(false);
  };

  const toggleActive = async (seq: Sequence) => {
    const res = await fetch("/api/admin/growth/sequences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: seq.id, is_active: !seq.is_active }),
    });
    if (res.ok) {
      setSequences((prev) =>
        prev.map((s) => (s.id === seq.id ? { ...s, is_active: !s.is_active } : s))
      );
    }
  };

  const deleteSequence = async (id: string) => {
    if (!confirm("Eliminar secuencia y todos sus pasos?")) return;
    const res = await fetch("/api/admin/growth/sequences", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setSequences((prev) => prev.filter((s) => s.id !== id));
  };

  const openEnroll = (seqId: string) => {
    setEnrollSeqId(seqId);
    setSelectedContacts([]);
    setShowEnroll(true);
  };

  const enrollContacts = async () => {
    if (!enrollSeqId || selectedContacts.length === 0) return;
    setSaving(true);

    // Enroll each contact in the sequence
    const res = await fetch("/api/admin/growth/sequences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: enrollSeqId,
        enroll_contacts: selectedContacts,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setShowEnroll(false);
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Secuencias drip</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automatiza seguimientos con emails programados
          </p>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 px-4 py-2 bg-[#4A55A2] text-white rounded-lg text-sm font-medium hover:bg-[#3d4789] transition-colors"
        >
          <Plus size={16} /> Nueva secuencia
        </button>
      </header>

      <div className="px-8 pb-8 space-y-4">
        {sequences.map((seq) => {
          const isExpanded = expandedSeq === seq.id;
          return (
            <div key={seq.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <button onClick={() => setExpandedSeq(isExpanded ? null : seq.id)}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className={`w-2.5 h-2.5 rounded-full ${seq.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{seq.name}</p>
                  {seq.description && <p className="text-xs text-gray-500">{seq.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Mail size={12} /> {seq.steps.length} pasos
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {seq.enrollmentCount} inscritos
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEnroll(seq.id)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Inscribir contactos">
                    <Users size={14} />
                  </button>
                  <button onClick={() => toggleActive(seq)} className="p-1.5 text-gray-400 hover:text-green-600" title={seq.is_active ? "Desactivar" : "Activar"}>
                    {seq.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button onClick={() => openEditor(seq)} className="p-1.5 text-gray-400 hover:text-[#4A55A2]" title="Editar">
                    <Zap size={14} />
                  </button>
                  <button onClick={() => deleteSequence(seq.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  <div className="relative ml-4">
                    {seq.steps.map((step, i) => (
                      <div key={step.id} className="flex gap-4 mb-4 last:mb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-[#4A55A2] text-white flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </div>
                          {i < seq.steps.length - 1 && (
                            <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">{step.subject}</p>
                            {step.delay_days > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Clock size={10} /> +{step.delay_days}d
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {step.html_body.replace(/<[^>]*>/g, "").slice(0, 120)}...
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sequences.length === 0 && (
          <div className="text-center py-12">
            <Zap size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No hay secuencias. Crea una para automatizar tu outreach.</p>
          </div>
        )}
      </div>

      {/* Sequence Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? "Editar secuencia" : "Nueva secuencia"}
              </h2>
              <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Secuencia intro - 3 emails"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Pasos del email</h3>
                <button onClick={addStep} className="text-xs text-[#4A55A2] hover:underline flex items-center gap-1">
                  <Plus size={12} /> Agregar paso
                </button>
              </div>

              {stepsForm.map((step, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4A55A2]">Paso {i + 1}</span>
                    {stepsForm.length > 1 && (
                      <button onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={step.subject}
                        onChange={(e) => updateStep(i, "subject", e.target.value)}
                        placeholder="Asunto del email"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} className="text-gray-400" />
                      <input
                        type="number"
                        min={0}
                        value={step.delay_days}
                        onChange={(e) => updateStep(i, "delay_days", parseInt(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap">dias</span>
                    </div>
                  </div>
                  <textarea
                    value={step.html_body}
                    onChange={(e) => updateStep(i, "html_body", e.target.value)}
                    rows={4}
                    placeholder="Cuerpo HTML del email. Usa {{nombre}} y {{escuela}}"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={saveSequence}
              disabled={!form.name || stepsForm.some((s) => !s.subject || !s.html_body) || saving}
              className="w-full bg-[#4A55A2] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d4789] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear secuencia"}
            </button>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {showEnroll && enrollSeqId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowEnroll(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Inscribir contactos</h2>
              <button onClick={() => setShowEnroll(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-50">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(c.id)}
                    onChange={() =>
                      setSelectedContacts((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      )
                    }
                    className="rounded border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                    <p className="text-[10px] text-gray-400">{c.email} - {c.schoolName}</p>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={enrollContacts}
              disabled={selectedContacts.length === 0 || saving}
              className="w-full bg-[#4A55A2] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d4789] transition-colors disabled:opacity-50"
            >
              {saving ? "Inscribiendo..." : `Inscribir ${selectedContacts.length} contactos`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
