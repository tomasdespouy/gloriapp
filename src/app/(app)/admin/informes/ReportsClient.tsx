"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Upload, Trash2, ExternalLink, X, Save, Clock, Pencil, StickyNote, Sparkles, Loader2 } from "lucide-react";

type Report = {
  id: string;
  title: string;
  summary: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  notes: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export default function ReportsClient() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Upload form
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSummary, setUploadSummary] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchReports = async () => {
    const res = await fetch("/api/admin/reports");
    if (res.ok) setReports(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const hasFile = !!selectedFile || (fileRef.current?.files?.length ?? 0) > 0;

  const getFile = (): File | null => {
    return selectedFile || fileRef.current?.files?.[0] || null;
  };

  const handleUpload = async () => {
    const file = getFile();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", uploadTitle || file.name.replace(/\.[^.]+$/, ""));
    formData.append("summary", uploadSummary);

    const res = await fetch("/api/admin/reports", { method: "POST", body: formData });
    if (res.ok) {
      resetUploadForm();
      fetchReports();
    }
    setUploading(false);
  };

  const resetUploadForm = () => {
    setShowUpload(false);
    setUploadTitle("");
    setUploadSummary("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadTitle(file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "));
      setShowUpload(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only leave if actually leaving the container (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOver(false);
    }
  };

  const handleFileInputChange = () => {
    const file = fileRef.current?.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "));
    }
  };

  const generateSummary = async () => {
    const title = uploadTitle || getFile()?.name || "";
    if (!title) return;
    setGeneratingSummary(true);
    try {
      const res = await fetch("/api/admin/reports/suggest-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, fileName: getFile()?.name || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setUploadSummary(data.summary);
      }
    } catch { /* ignore */ }
    setGeneratingSummary(false);
  };

  const saveNotes = async (id: string) => {
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesText }),
    });
    setReports(prev => prev.map(r => r.id === id ? { ...r, notes: notesText } : r));
    setEditingNotes(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/reports/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
    setDeleting(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div
      className="px-8 py-6 max-w-5xl min-h-[calc(100vh-4rem)] relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-sidebar/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl border-2 border-dashed border-sidebar p-12 text-center shadow-xl">
            <Upload size={40} className="text-sidebar mx-auto mb-3" />
            <p className="text-sm font-medium text-sidebar">Suelta el archivo aquí</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-sidebar" />
          <h1 className="text-xl font-bold text-gray-900">Informes técnicos</h1>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#354080] transition-colors"
        >
          <Upload size={15} />
          Subir informe
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => !uploading && resetUploadForm()}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Subir informe</h3>
              <button onClick={resetUploadForm} disabled={uploading} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* File selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivo</label>
                {selectedFile ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-sidebar/5 rounded-lg border border-sidebar/20">
                    <FileText size={18} className="text-sidebar" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-gray-400">{formatSize(selectedFile.size)}</p>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,.md"
                    onChange={handleFileInputChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sidebar/10 file:text-sidebar hover:file:bg-sidebar/20"
                  />
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Se usa el nombre del archivo si se deja vacío"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar"
                />
              </div>

              {/* Summary with AI suggestion */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Resumen</label>
                  {(uploadTitle || selectedFile) && (
                    <button
                      onClick={generateSummary}
                      disabled={generatingSummary}
                      className="flex items-center gap-1 text-[11px] text-sidebar hover:underline disabled:opacity-50"
                    >
                      {generatingSummary ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      {generatingSummary ? "Generando..." : "Sugerir con IA"}
                    </button>
                  )}
                </div>
                <textarea
                  value={uploadSummary}
                  onChange={e => setUploadSummary(e.target.value)}
                  placeholder="Breve descripción del contenido del informe..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={resetUploadForm}
                disabled={uploading}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !hasFile}
                className="flex-1 px-4 py-2.5 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-[#354080] disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : "Subir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando informes...</div>
      ) : reports.length === 0 ? (
        <div
          className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center hover:border-sidebar/30 transition-colors cursor-pointer"
          onClick={() => setShowUpload(true)}
        >
          <Upload size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No hay informes técnicos</p>
          <p className="text-xs text-gray-300 mt-1">Arrastra un archivo aquí o haz click para subir</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={16} className="text-sidebar flex-shrink-0" />
                      <h3 className="text-sm font-bold text-gray-900 truncate">{report.title}</h3>
                    </div>
                    {report.summary && (
                      <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{report.summary}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(report.created_at)}
                      </span>
                      <span>{report.file_name}</span>
                      <span>{formatSize(report.file_size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={report.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-sidebar transition-colors"
                      title="Abrir documento"
                    >
                      <ExternalLink size={15} />
                    </a>
                    <button
                      onClick={() => {
                        setEditingNotes(editingNotes === report.id ? null : report.id);
                        setNotesText(report.notes || "");
                      }}
                      className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                        report.notes ? "text-amber-500" : "text-gray-400 hover:text-amber-500"
                      }`}
                      title="Notas"
                    >
                      <StickyNote size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(report)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {editingNotes === report.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <Pencil size={10} />
                      Notas
                    </label>
                    <textarea
                      value={notesText}
                      onChange={e => setNotesText(e.target.value)}
                      placeholder="Agregar notas sobre este informe..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-sidebar"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingNotes(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">
                        Cancelar
                      </button>
                      <button onClick={() => saveNotes(report.id)} className="px-3 py-1.5 text-xs bg-sidebar text-white rounded-lg hover:bg-[#354080] flex items-center gap-1">
                        <Save size={11} />
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                {editingNotes !== report.id && report.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-line">
                      {report.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Drop zone at the bottom when there are reports */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-sidebar/30 transition-colors cursor-pointer"
            onClick={() => setShowUpload(true)}
          >
            <p className="text-xs text-gray-300">Arrastra otro archivo aquí o haz click para subir</p>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar informe</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Eliminar <strong>{deleteTarget.title}</strong>? Se borrará el archivo y los datos asociados.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
