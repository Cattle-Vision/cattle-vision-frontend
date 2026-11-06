"use client";

/**
 * Página de Cadastro de Novo Animal (`src/app/animal/new/page.tsx`).
 *
 * Funcionalidades:
 * - Priorização de Apelido/Nome do animal como principal campo de identificação de manejo.
 * - Pré-preenchimento automático de tags RFID lidas via ESP32 Bluetooth.
 * - Tratamento inteligente de duplicidade com adesão instantânea à Guarda Compartilhada.
 */
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Camera, Check, Sparkles, Tag, Users } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { BREEDS, SEX_OPTIONS, isValidTag, normalizeTag } from "@/lib/animal";
import { apiFetch } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";

interface AnimalFormState {
  tag: string;
  name: string;
  breed: string;
  sex: string;
  weight: string;
  age: string;
}

function NewAnimalForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [goToCamera, setGoToCamera] = useState(true);

  const initialTag = (searchParams.get("tag") ?? "").toUpperCase();

  const [formData, setFormData] = useState<AnimalFormState>({
    tag: initialTag,
    name: "",
    breed: "Nelore",
    sex: "Fêmea",
    weight: "",
    age: "",
  });

  const setField = (field: keyof AnimalFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generateSampleTag = () => {
    let hex = "E280";
    const chars = "0123456789ABCDEF";
    for (let i = 0; i < 20; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setField("tag", hex);
  };

  const handleSubmit = async (e: React.FormEvent, openCameraAfter: boolean) => {
    e.preventDefault();
    const tag = normalizeTag(formData.tag);

    if (!isValidTag(tag)) {
      toast("Informe uma tag RFID ou brinco válido (mínimo 2 caracteres).", "error");
      return;
    }
    if (!formData.breed.trim()) {
      toast("Selecione a raça do animal.", "error");
      return;
    }
    if (!formData.weight || Number(formData.weight) <= 0) {
      toast("Informe um peso válido em kg.", "error");
      return;
    }
    if (formData.age === "" || Number(formData.age) < 0) {
      toast("Informe a idade em meses.", "error");
      return;
    }

    setLoading(true);
    setGoToCamera(openCameraAfter);

    try {
      const data = await apiFetch<any>("/api/animals", {
        method: "POST",
        body: {
          ...formData,
          tag,
          weight: Number(formData.weight),
          age: Number(formData.age),
        },
      });

      if (data?.id) {
        toast("Animal cadastrado com sucesso (Propriedade Principal)!", "success");
        const label = data.name || data.tag || tag;
        if (openCameraAfter) {
          router.push(`/camera?animalId=${data.id}&animalName=${encodeURIComponent(label)}`);
        } else {
          router.push(`/animal/${data.id}`);
        }
        return;
      }
    } catch (err: any) {
      // Se já existia e o backend concedeu guarda compartilhada:
      if (err?.data?.sharedGranted && err?.data?.id) {
        toast(err.message || "Animal já existente. Guarda Compartilhada ativada!", "info");
        router.push(`/animal/${err.data.id}`);
        return;
      }
      if (err?.data?.id) {
        toast("Animal já cadastrado em sua conta.", "info");
        router.push(`/animal/${err.data.id}`);
        return;
      }
      toast(err?.message || "Erro ao cadastrar o animal.", "error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary pb-20 sm:pb-8">
      <AppHeader
        showBack
        backHref="/dashboard"
        title="Novo Animal"
        subtitle="Cadastro Zootécnico & RFID"
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={(e) => handleSubmit(e, true)}
            className="card p-5 sm:p-7 flex flex-col gap-6"
          >
            {/* Aviso quando a Tag veio de leitura do ESP32 */}
            {initialTag && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <Tag className="w-4 h-4 shrink-0" />
                <span>
                  Tag RFID <strong>{initialTag.length > 12 ? `${initialTag.slice(0, 8)}...` : initialTag}</strong> identificada pelo sensor e preenchida automaticamente.
                </span>
              </div>
            )}

            {/* Apelido/Nome do Animal em Destaque Principal */}
            <div>
              <label className="field-label" htmlFor="name-field">
                Apelido / Nome do Animal <span className="text-emerald-600 dark:text-emerald-400 font-bold">(Principal)</span>
              </label>
              <input
                id="name-field"
                type="text"
                value={formData.name}
                onChange={(e) => setField("name", e.target.value)}
                className="field-input text-base font-extrabold"
                placeholder="Ex: Mimosa, Estrela, Vaca 42, Nelore 105"
                autoFocus={!initialTag}
                autoComplete="off"
              />
              <p className="text-[11px] text-theme-secondary mt-1">
                Nome de fácil reconhecimento no curral e no manejo diário.
              </p>
            </div>

            {/* Código RFID / Brinco (Secundário) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label !mb-0" htmlFor="tag-field">
                  Identificador RFID / Brinco Eletrônico <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateSampleTag}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Gerar RFID 24-Hex
                </button>
              </div>
              <input
                id="tag-field"
                type="text"
                value={formData.tag}
                onChange={(e) => setField("tag", e.target.value.toUpperCase())}
                className="field-input font-mono text-xs tracking-wider uppercase font-bold"
                placeholder="Ex: E2801160600002047E7A5A01 ou NEL-0142"
                required
                autoComplete="off"
              />
              <p className="text-[11px] text-theme-secondary mt-1">
                Código transmitido pelo leitor ESP32 ou código impresso no brinco visual.
              </p>
            </div>

            {/* Raça */}
            <div>
              <label className="field-label">
                Raça <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {BREEDS.map((breed) => {
                  const active = formData.breed === breed;
                  return (
                    <button
                      key={breed}
                      type="button"
                      onClick={() => setField("breed", breed)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                        active
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-theme-surface-2 text-theme-secondary border-theme hover:text-theme-primary"
                      }`}
                    >
                      {breed}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sexo */}
            <div>
              <label className="field-label">
                Sexo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SEX_OPTIONS.map((opt) => {
                  const active = formData.sex === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField("sex", opt.value)}
                      className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                        active
                          ? "bg-emerald-500/10 border-emerald-500 text-theme-primary ring-2 ring-emerald-500/20"
                          : "bg-theme-surface-2 border-theme text-theme-secondary hover:text-theme-primary"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-extrabold text-theme-primary">{opt.value}</p>
                        <p className="text-xs text-theme-secondary mt-0.5">{opt.label}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          active
                            ? "bg-emerald-600 text-white"
                            : "border border-theme"
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Peso e Idade */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="weight-field">
                  Peso estimado (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  id="weight-field"
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setField("weight", e.target.value)}
                  className="field-input"
                  placeholder="Ex: 450"
                  min="1"
                  step="0.1"
                  required
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="age-field">
                  Idade (meses) <span className="text-red-500">*</span>
                </label>
                <input
                  id="age-field"
                  type="number"
                  value={formData.age}
                  onChange={(e) => setField("age", e.target.value)}
                  className="field-input"
                  placeholder="Ex: 24"
                  min="0"
                  required
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-3.5 min-h-[48px] text-sm"
              >
                {loading && goToCamera ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>Cadastrar e Abrir Câmera IA</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, false)}
                className="btn-secondary py-3.5 px-6 min-h-[48px] text-sm"
              >
                {loading && !goToCamera ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Apenas Salvar Ficha</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}

export default function NewAnimalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-theme-bg">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <NewAnimalForm />
    </Suspense>
  );
}
