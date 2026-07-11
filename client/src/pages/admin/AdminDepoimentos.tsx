import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LayoutDashboard,
  MessageSquareQuote,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type FormState = {
  name: string;
  company: string;
  niche: string;
  quote: string;
  resultLabel: string;
  imageUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

const emptyForm: FormState = {
  name: "",
  company: "",
  niche: "",
  quote: "",
  resultLabel: "",
  imageUrl: "",
  sortOrder: 0,
  isPublished: false,
};

function toForm(row: any): FormState {
  return {
    name: row.name ?? "",
    company: row.company ?? "",
    niche: row.niche ?? "",
    quote: row.quote ?? "",
    resultLabel: row.resultLabel ?? "",
    imageUrl: row.imageUrl ?? "",
    sortOrder: row.sortOrder ?? 0,
    isPublished: !!row.isPublished,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wide text-[#61708a]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function AdminDepoimentos() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const testimonials = trpc.admin.testimonials.useQuery();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const create = trpc.admin.createTestimonial.useMutation({
    onSuccess: () => {
      toast.success("Depoimento cadastrado.");
      reset();
      utils.admin.testimonials.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao cadastrar"),
  });

  const update = trpc.admin.updateTestimonial.useMutation({
    onSuccess: () => {
      toast.success("Depoimento atualizado.");
      reset();
      utils.admin.testimonials.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao atualizar"),
  });

  const remove = trpc.admin.deleteTestimonial.useMutation({
    onSuccess: () => {
      toast.success("Depoimento excluido.");
      utils.admin.testimonials.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao excluir"),
  });

  const rows = testimonials.data ?? [];
  const canSave = form.name.trim().length >= 2 && form.quote.trim().length >= 10;
  const isSaving = create.isPending || update.isPending;

  const submit = () => {
    const payload = {
      name: form.name,
      company: form.company || undefined,
      niche: form.niche || undefined,
      quote: form.quote,
      resultLabel: form.resultLabel || undefined,
      imageUrl: form.imageUrl || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      isPublished: form.isPublished,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };

  const togglePublished = (row: any) => {
    update.mutate({ id: row.id, isPublished: !row.isPublished });
  };

  return (
    <div
      className="min-h-screen bg-[#f7f9fc]"
      style={{ fontFamily: "Inter, Arial, sans-serif" }}
    >
      <header
        style={{ background: "#011643" }}
        className="px-8 h-16 flex items-center justify-between shadow-lg"
      >
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" theme="dark" hideTagline />
          <span
            className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: "rgba(255,50,23,0.15)", color: "#ff3217" }}
          >
            <MessageSquareQuote className="w-3 h-3 inline mr-1" />
            Depoimentos
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white border border-white/20 hover:bg-white/10"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Painel
          </button>
          <button
            onClick={() => { window.location.href = "/app/"; }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white/70 border border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Plataforma
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8 space-y-6">
        <section className="bg-white rounded-xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <h1 className="text-xl font-black text-[#070b17]">
                Prova social pronta para a vitrine
              </h1>
              <p className="text-sm text-[#61708a] mt-1 font-semibold">
                Cadastre casos reais agora. Quando formos mexer no site, esses
                depoimentos ja entram sem retrabalho.
              </p>
            </div>
            {editingId && (
              <button
                onClick={reset}
                className="rounded-lg border border-[#e6ebf3] px-3 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc]"
              >
                Cancelar edicao
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field label="Nome do cliente">
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217]"
                placeholder="Ex.: Julia Lago"
              />
            </Field>
            <Field label="Empresa / nicho">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  className="w-full rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217]"
                  placeholder="Empresa"
                />
                <input
                  value={form.niche}
                  onChange={e => setForm({ ...form, niche: e.target.value })}
                  className="w-full rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217]"
                  placeholder="Nicho"
                />
              </div>
            </Field>
            <Field label="Depoimento">
              <textarea
                value={form.quote}
                onChange={e => setForm({ ...form, quote: e.target.value })}
                className="w-full min-h-[110px] rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217] resize-none"
                placeholder="O que mudou depois de usar o Cacarejar?"
              />
            </Field>
            <div className="space-y-3">
              <Field label="Resultado curto">
                <input
                  value={form.resultLabel}
                  onChange={e => setForm({ ...form, resultLabel: e.target.value })}
                  className="w-full rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217]"
                  placeholder="Ex.: Saiu com 7 dias de conteudo pronto"
                />
              </Field>
              <Field label="Imagem ou print (URL opcional)">
                <input
                  value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217]"
                  placeholder="/uploads/print.png ou https://..."
                />
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="Ordem">
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff3217]"
                  />
                </Field>
                <label className="h-10 rounded-lg border border-[#e6ebf3] bg-white px-3 flex items-center gap-2 text-xs font-black text-[#071b44] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={e => setForm({ ...form, isPublished: e.target.checked })}
                  />
                  Publicar
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={!canSave || isSaving}
            className="mt-5 rounded-xl bg-[#ff3217] text-white px-5 py-3 text-sm font-black inline-flex items-center gap-2 disabled:opacity-50"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? "Salvar depoimento" : "Cadastrar depoimento"}
          </button>
        </section>

        <section className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e6ebf3] flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-[#070b17]">
              Depoimentos cadastrados
            </h2>
            <span className="text-xs font-black text-[#61708a]">
              {rows.length} registro(s)
            </span>
          </div>

          {testimonials.isLoading ? (
            <p className="p-8 text-sm font-semibold text-[#61708a]">
              Carregando...
            </p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-sm font-semibold text-[#61708a]">
              Nenhum depoimento cadastrado ainda.
            </p>
          ) : (
            <div className="divide-y divide-[#edf1f7]">
              {rows.map((row: any) => (
                <article key={row.id} className="p-5 flex flex-col lg:flex-row gap-4">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      className="w-full lg:w-32 h-28 object-cover rounded-xl border border-[#e6ebf3] bg-[#f8fafc]"
                    />
                  ) : (
                    <div className="w-full lg:w-32 h-28 rounded-xl border border-dashed border-[#d9e1ee] bg-[#f8fafc] grid place-items-center text-[#9aa7bd]">
                      <MessageSquareQuote className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-black text-[#071b44]">
                          {row.name}
                        </p>
                        <p className="text-xs font-bold text-[#61708a] mt-0.5">
                          {[row.company, row.niche].filter(Boolean).join(" - ") || "Sem empresa/nicho"}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[10px] font-black"
                        style={{
                          background: row.isPublished ? "#eafff1" : "#f1f4f9",
                          color: row.isPublished ? "#087a32" : "#61708a",
                        }}
                      >
                        {row.isPublished ? "publicado" : "rascunho"}
                      </span>
                    </div>
                    <p className="text-sm text-[#22304b] leading-relaxed mt-3">
                      "{row.quote}"
                    </p>
                    {row.resultLabel && (
                      <p className="text-xs font-black text-[#ff3217] mt-2">
                        {row.resultLabel}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-[#9aa7bd] mt-2">
                      Ordem {row.sortOrder ?? 0} - ID #{row.id}
                    </p>
                  </div>
                  <div className="flex lg:flex-col gap-2">
                    <button
                      onClick={() => togglePublished(row)}
                      className="rounded-lg border border-[#e6ebf3] px-3 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-1.5 justify-center"
                    >
                      {row.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {row.isPublished ? "Ocultar" : "Publicar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(row.id);
                        setForm(toForm(row));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-lg border border-[#e6ebf3] px-3 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-1.5 justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Excluir este depoimento definitivamente?")) {
                          remove.mutate({ id: row.id });
                        }
                      }}
                      className="rounded-lg border border-[#ffd0c8] px-3 py-2 text-xs font-black text-[#c20f00] hover:bg-[#fff8f6] inline-flex items-center gap-1.5 justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
