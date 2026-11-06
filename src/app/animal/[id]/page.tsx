"use client";

/**
 * Ficha Completa do Animal, Guarda Compartilhada e Galeria (`src/app/animal/[id]/page.tsx`).
 *
 * Funcionalidades:
 * - Priorização máxima do Apelido/Nome do animal.
 * - Ocultação de códigos RFID longos em pill discreto copiável e seção recolhível.
 * - Painel de Gestão de Guarda Compartilhada:
 *   - Visualização do Proprietário Principal e operadores colaboradores.
 *   - Ações exclusivas do Dono: remoção de colaboradores, convite por e-mail e transferência de guarda definitiva.
 * - Envio e análise de fotos com IA e diagnóstico de ICS em desenvolvimento.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Scale,
  Calendar,
  Tag,
  Dna,
  Upload,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  Activity,
  AlertTriangle,
  Sparkles,
  Users,
  ShieldCheck,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoLightbox from "@/components/PhotoLightbox";
import AppHeader from "@/components/AppHeader";
import { useToast } from "@/components/ui/Toast";
import { Animal, Photo, CustodyInfo } from "@/lib/types";
import { BREEDS, SEX_OPTIONS } from "@/lib/animal";
import { compressImageFile } from "@/lib/image-client";
import { evaluatePhotoScoreBeforeUpload, VisionScoreResult } from "@/lib/vision-client";
import {
  apiFetch,
  apiUpload,
  addCollaborator,
  removeCollaborator,
  transferOwnership,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface PendingGalleryPhoto {
  blob: Blob;
  previewUrl: string;
  fileName: string;
  evaluating: boolean;
  scoreResult: VisionScoreResult | null;
}

function PageSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-theme-bg">
      <div className="h-16 bg-theme-surface border-b border-theme" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-5">
        <div className="h-40 skeleton rounded-2xl" />
        <div className="h-8 skeleton rounded-lg w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3.5 bg-theme-surface-2 border border-theme">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">{label}</p>
        <p className="text-sm font-extrabold text-theme-primary truncate">{value}</p>
      </div>
    </div>
  );
}

export default function AnimalProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { toast, confirm } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recalibratingAnimal, setRecalibratingAnimal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [pendingPhoto, setPendingPhoto] = useState<PendingGalleryPhoto | null>(null);
  const [copiedTag, setCopiedTag] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Estados de Custódia e Gestão de Colaboradores
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [custodyActionLoading, setCustodyActionLoading] = useState(false);

  // Edição
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    tag: "",
    name: "",
    breed: "Nelore",
    sex: "Fêmea",
    weight: "",
    age: "",
  });

  const loadAnimal = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<Animal>(`/api/animals/${id}`);
      if (data) {
        setAnimal(data);
        setEditForm({
          tag: data.tag,
          name: data.name || "",
          breed: data.breed,
          sex: data.sex,
          weight: String(data.weight),
          age: String(data.age),
        });
      }
    } catch (err: any) {
      if (err?.message?.includes("401") || err?.message?.includes("Token")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadAnimal();
  }, [loadAnimal]);

  const copyRfid = () => {
    if (!animal) return;
    navigator.clipboard.writeText(animal.tag);
    setCopiedTag(true);
    toast("Tag RFID copiada para a área de transferência!", "info");
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const handleSelectFromGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !animal) return;

    try {
      const compressed = await compressImageFile(file, 1600, 0.86);
      setPendingPhoto({
        blob: compressed.blob,
        previewUrl: URL.createObjectURL(compressed.blob),
        fileName: file.name,
        evaluating: true,
        scoreResult: null,
      });

      const scoreRes = await evaluatePhotoScoreBeforeUpload(compressed.blob);
      setPendingPhoto((prev) =>
        prev
          ? {
              ...prev,
              evaluating: false,
              scoreResult: scoreRes,
            }
          : null
      );
    } catch {
      toast("Não foi possível processar a imagem selecionada.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmGalleryUpload = async () => {
    if (!pendingPhoto || !animal) return;
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", pendingPhoto.blob, `rear_${animal.tag}_${Date.now()}.jpg`);
      fd.append("animalId", animal.id);
      fd.append("view", "REAR");
      if (pendingPhoto.scoreResult) {
        fd.append("preScore", String(pendingPhoto.scoreResult.score));
      }

      const data = await apiUpload<{ photo: Photo }>("/api/photos/upload", fd);

      if (data?.photo) {
        setAnimal((prev) =>
          prev
            ? {
                ...prev,
                photos: [data.photo as Photo, ...(prev.photos ?? [])],
              }
            : prev
        );
        toast(
          `Foto enviada com Confiança IA de ${Math.round(
            data.photo.score ?? pendingPhoto.scoreResult?.score ?? 0
          )}%!`,
          "success"
        );
        setPendingPhoto(null);
      }
    } catch (err: any) {
      toast(err?.message || "Falha ao enviar foto", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const ok = await confirm({
      title: "Excluir Foto do Dataset",
      message: "Deseja realmente apagar esta foto do dataset? Esta ação não pode ser desfeita.",
      confirmText: "Excluir Foto",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await apiFetch(`/api/photos/${photoId}`, { method: "DELETE" });
      setAnimal((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p: Photo) => p.id !== photoId) } : prev
      );
      toast("Foto removida do dataset.", "success");
    } catch (err: any) {
      toast(err?.message || "Não foi possível excluir a foto.", "error");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal) return;
    setSavingEdit(true);

    try {
      const data = await apiFetch<Animal>(`/api/animals/${animal.id}`, {
        method: "PATCH",
        body: {
          tag: editForm.tag,
          name: editForm.name,
          breed: editForm.breed,
          sex: editForm.sex,
          weight: Number(editForm.weight),
          age: Number(editForm.age),
        },
      });

      if (data) {
        setAnimal((prev) => (prev ? { ...prev, ...data, photos: prev.photos } : prev));
        setEditing(false);
        toast("Dados do animal atualizados!", "success");
      }
    } catch (err: any) {
      toast(err?.message || "Erro ao atualizar dados.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAnimal = async () => {
    if (!animal) return;
    const ok = await confirm({
      title: `Excluir Animal ${animal.name || animal.tag}`,
      message: `Tem certeza que deseja excluir este animal e todas as suas ${animal.photos?.length ?? 0} fotos? Esta ação é irreversível e só pode ser realizada pelo proprietário principal.`,
      confirmText: "Excluir Definitivamente",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await apiFetch(`/api/animals/${animal.id}`, { method: "DELETE" });
      toast("Animal excluído com sucesso.", "success");
      router.push("/dashboard");
    } catch (err: any) {
      toast(err?.message || "Erro ao excluir animal.", "error");
    }
  };

  const handleRecalibrateAnimal = async () => {
    if (recalibratingAnimal || !animal) return;
    setRecalibratingAnimal(true);
    try {
      const data = await apiFetch<any>(`/api/animals/${animal.id}/recalibrate`, { method: "POST" });
      toast(data?.message || `${data?.updatedCount ?? 0} foto(s) recalculada(s)!`, "success");

      if (Array.isArray(data?.results)) {
        const scoreMap = new Map(
          data.results.map((r: { id: string; newScore: number }) => [r.id, r.newScore])
        );
        setAnimal((prev) =>
          prev
            ? {
                ...prev,
                photos: (prev.photos ?? []).map((p) =>
                  scoreMap.has(p.id) ? { ...p, score: scoreMap.get(p.id) as number } : p
                ),
              }
            : prev
        );
      }
    } catch (err: any) {
      toast(err?.message || "Erro ao recalcular confiança do animal", "error");
    } finally {
      setRecalibratingAnimal(false);
    }
  };

  const handlePhotoRecalibrated = (photoId: string, newScore: number) => {
    setAnimal((prev) =>
      prev
        ? {
            ...prev,
            photos: (prev.photos ?? []).map((p) =>
              p.id === photoId ? { ...p, score: newScore } : p
            ),
          }
        : prev
    );
    toast(`Confiança da foto atualizada para ${Math.round(newScore)}%!`, "success");
  };

  // ── Ações de Guarda Compartilhada ──
  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !animal) return;
    setInviting(true);

    try {
      const res = await addCollaborator(animal.id, { email: inviteEmail.trim() });
      toast(res.message || "Colaborador adicionado à guarda compartilhada!", "success");
      setInviteEmail("");
      if (res.custody) {
        setAnimal((prev) => (prev ? { ...prev, custody: res.custody } : prev));
      } else {
        await loadAnimal();
      }
    } catch (err: any) {
      toast(err?.message || "Erro ao convidar operador.", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (targetUserId: number, targetName: string) => {
    if (!animal) return;
    const ok = await confirm({
      title: "Revogar Guarda Compartilhada",
      message: `Deseja remover o acesso de ${targetName} a este animal? Ele não poderá mais ver fotos ou lançar novas capturas deste animal.`,
      confirmText: "Revogar Acesso",
      variant: "danger",
    });
    if (!ok) return;

    setCustodyActionLoading(true);
    try {
      const res = await removeCollaborator(animal.id, targetUserId);
      toast(res.message || "Acesso de colaborador revogado.", "success");
      if (res.custody) {
        setAnimal((prev) => (prev ? { ...prev, custody: res.custody } : prev));
      } else {
        await loadAnimal();
      }
    } catch (err: any) {
      toast(err?.message || "Erro ao revogar acesso.", "error");
    } finally {
      setCustodyActionLoading(false);
    }
  };

  const handleTransferOwnership = async (newOwnerId: number, targetName: string) => {
    if (!animal) return;
    const ok = await confirm({
      title: "Transferir Guarda Definitiva",
      message: `Tem certeza que deseja transferir a propriedade principal para ${targetName}? Você continuará como colaborador na Guarda Compartilhada, mas apenas o novo proprietário poderá gerenciar operadores ou excluir o animal.`,
      confirmText: "Transferir Posse Definitiva",
      variant: "danger",
    });
    if (!ok) return;

    setCustodyActionLoading(true);
    try {
      const res = await transferOwnership(animal.id, newOwnerId);
      toast(res.message || "Guarda definitiva transferida com sucesso!", "success");
      if (res.custody) {
        setAnimal((prev) => (prev ? { ...prev, custody: res.custody, isOwner: false, isShared: true } : prev));
      }
      await loadAnimal();
    } catch (err: any) {
      toast(err?.message || "Erro ao transferir guarda.", "error");
    } finally {
      setCustodyActionLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (!animal) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-theme-bg text-theme-primary">
        <div className="card p-8 text-center max-w-sm w-full">
          <p className="font-bold text-theme-primary mb-2">Animal não encontrado</p>
          <p className="text-xs text-theme-secondary mb-5">
            O registro pode ter sido removido ou você não possui permissão de acesso.
          </p>
          <button onClick={() => router.push("/dashboard")} className="btn-primary w-full">
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  const displayName = animal.name?.trim() || "Vaca Sem Apelido";
  const cameraUrl = `/camera?animalId=${animal.id}&animalName=${encodeURIComponent(displayName)}`;
  const photoCount = animal.photos?.length ?? 0;
  const custody = animal.custody;
  const isOwner = animal.isOwner ?? (custody?.isOwner ?? (user && animal.ownerId === Number(user.id)));
  const canManage = custody?.canManage ?? (isOwner || isAdmin);

  const shortTag =
    animal.tag.length > 12
      ? `${animal.tag.slice(0, 6)}...${animal.tag.slice(-4)}`
      : animal.tag;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelectFromGallery}
      />

      <AppHeader
        showBack
        backHref="/dashboard"
        title={displayName}
        subtitle={`${animal.breed} · ${animal.sex} · ${isOwner ? "Propriedade Direta" : "Guarda Compartilhada"}`}
      />

      <main className="flex-1 p-3 sm:p-6 max-w-4xl mx-auto w-full flex flex-col gap-5 pb-20 sm:pb-8">
        {/* Cabeçalho da Ficha com Priorização de Apelido */}
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  <Activity className="w-3 h-3" />
                  Ficha Zootécnica & Manejo
                </span>

                {isOwner ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900/80 text-emerald-300">
                    Proprietário Principal
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Guarda Compartilhada
                  </span>
                )}
              </div>

              {/* Apelido em Grande Destaque */}
              <h2 className="text-2xl font-black text-theme-primary tracking-tight">
                {displayName}
              </h2>

              {/* Pill Discreto de RFID com Copiar */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={copyRfid}
                  title="Copiar tag RFID completa"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-theme-secondary bg-theme-surface-2 hover:bg-theme-surface hover:text-theme-primary border border-theme transition"
                >
                  <Tag className="w-3 h-3 opacity-60" />
                  <span>RFID: {shortTag}</span>
                  {copiedTag ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 opacity-60" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-xs text-theme-muted hover:text-theme-primary flex items-center gap-0.5 font-medium"
                >
                  <span>{showTechnicalDetails ? "Ocultar dados técnicos" : "Ver dados técnicos"}</span>
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Ações da Ficha: Câmera IA, Galeria, Edição e Exclusão organizadas no card */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Link href={cameraUrl} className="btn-primary py-2.5 px-4 text-xs font-bold justify-center min-h-[42px] flex-1 sm:flex-initial">
                <Camera className="w-4 h-4" />
                <span>Câmera IA</span>
              </Link>

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary py-2.5 px-3.5 text-xs font-bold justify-center min-h-[42px] flex-1 sm:flex-initial"
              >
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Galeria</span>
              </button>

              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-secondary py-2.5 px-3 text-xs font-semibold justify-center min-h-[42px] flex items-center gap-1.5"
                title="Editar dados zootécnicos do animal"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={handleDeleteAnimal}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition flex items-center gap-1.5 min-h-[42px]"
                  title="Excluir animal (exclusivo do proprietário)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </button>
              )}
            </div>
          </div>

          {/* Seção Expansível de Detalhes Técnicos do RFID */}
          {showTechnicalDetails && (
            <div className="p-3.5 mb-5 rounded-xl bg-theme-surface-2 border border-theme space-y-2 animate-in fade-in duration-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-theme-secondary">Tag RFID Completa (EPC UHF):</span>
                <button
                  type="button"
                  onClick={copyRfid}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                >
                  {copiedTag ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <code className="block p-2 rounded bg-black/10 dark:bg-black/30 font-mono text-[11px] font-bold text-theme-primary break-all">
                {animal.tag}
              </code>
              <p className="text-[11px] text-theme-muted">
                Identificador bruto lido pelo sensor RFID R200 UHF do ESP32 via Bluetooth.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<Tag className="w-4 h-4" />} label="Raça" value={animal.breed} />
            <Stat icon={<Dna className="w-4 h-4" />} label="Sexo" value={animal.sex} />
            <Stat icon={<Scale className="w-4 h-4" />} label="Peso" value={`${animal.weight} kg`} />
            <Stat
              icon={<Calendar className="w-4 h-4" />}
              label="Idade"
              value={`${animal.age} meses`}
            />
          </div>
        </div>

        {/* ── Painel de Gestão de Guarda Compartilhada ── */}
        <div className="card p-4 sm:p-5 border-blue-500/25 bg-linear-to-br from-blue-500/5 via-theme-surface to-transparent shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-theme-primary">
                  Guarda Compartilhada & Acessos
                </h3>
                <p className="text-xs text-theme-secondary">
                  Todos com guarda compartilhada podem fotografar, ver histórico e acompanhar o ICS do animal.
                </p>
              </div>
            </div>

            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              isOwner
                ? "bg-slate-900/80 text-emerald-300 border-theme"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
            }`}>
              {isOwner ? "Seu Rebanho (Dono)" : "Você é Colaborador"}
            </span>
          </div>

          {/* Dados do Dono Principal */}
          <div className="p-3 rounded-xl bg-theme-surface-2 border border-theme mb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted block">
                Proprietário Principal
              </span>
              <p className="text-xs font-extrabold text-theme-primary">
                {custody?.owner?.name || "Proprietário"}
              </p>
              <p className="text-[11px] text-theme-secondary">{custody?.owner?.email}</p>
            </div>
            {isOwner && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Você
              </span>
            )}
          </div>

          {/* Lista de Colaboradores da Guarda */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-secondary">
                Operadores com Guarda Compartilhada ({custody?.collaborators?.length ?? 0})
              </span>
              <span className="text-[11px] text-theme-muted">
                Adicionados via leitura RFID ESP32 ou convite
              </span>
            </div>

            {custody?.collaborators && custody.collaborators.length > 0 ? (
              <div className="flex flex-col gap-2">
                {custody.collaborators.map((collab) => {
                  const isMe = user && Number(user.id) === collab.userId;
                  return (
                    <div
                      key={collab.id}
                      className="p-3 rounded-xl bg-theme-surface-2 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-theme-primary">
                            {collab.user?.name || "Operador"}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                              Você
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-theme-secondary">{collab.user?.email}</p>
                      </div>

                      {canManage && !isMe && (
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            disabled={custodyActionLoading}
                            onClick={() =>
                              handleTransferOwnership(collab.userId, collab.user?.name || "Operador")
                            }
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-theme-surface hover:bg-theme-surface-2 border border-theme text-theme-secondary hover:text-theme-primary transition flex items-center gap-1"
                            title="Transferir posse definitiva para este operador"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                            <span>Transferir Posse</span>
                          </button>

                          <button
                            type="button"
                            disabled={custodyActionLoading}
                            onClick={() =>
                              handleRemoveCollaborator(collab.userId, collab.user?.name || "Operador")
                            }
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition flex items-center gap-1"
                            title="Remover operador da guarda compartilhada"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-theme-muted italic p-3 bg-theme-surface-2/60 rounded-xl border border-theme">
                Nenhum colaborador na guarda compartilhada no momento. Ao aproximar o leitor RFID ESP32 da vaca, novos operadores ganham acesso instantâneo.
              </p>
            )}
          </div>

          {/* Formulário de Convite Manual (Dono ou Admin) */}
          {canManage && (
            <form onSubmit={handleInviteCollaborator} className="mt-4 pt-3 border-t border-theme flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="E-mail do novo operador para guarda compartilhada…"
                className="field-input flex-1 text-xs"
              />
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="btn-primary py-2 px-4 text-xs font-bold shrink-0 flex items-center justify-center gap-1.5"
              >
                {inviting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>Conceder Guarda</span>
              </button>
            </form>
          )}
        </div>

        {/* Card de Diagnóstico do Índice de Condição Corporal (ICS) */}
        <div className="card p-4 sm:p-5 border-amber-500/30 bg-linear-to-br from-amber-500/5 via-theme-surface to-emerald-500/5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/25">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-theme-primary">
                    Índice de Condição Corporal (ICS)
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Em desenvolvimento
                  </span>
                </div>
                <p className="text-xs text-theme-secondary mt-1.5 leading-relaxed">
                  O módulo de cálculo zootécnico automático por rede neural profunda está em fase de treinamento e validação zootécnica.
                  As imagens anatômicas registradas com alta qualidade de enquadramento serão calculadas de forma retroativa assim que a inferência for conectada.
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-theme/60 shrink-0">
              <span className="text-[10px] uppercase font-bold text-theme-muted">Validação de Enquadramento</span>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {photoCount > 0 ? `${photoCount} foto(s) registrada(s)` : "Aguardando 1ª foto"}
              </span>
            </div>
          </div>
        </div>

        {/* Galeria de Fotos */}
        <div>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-theme-primary">
                Histórico Fotográfico · Avaliação Posterior
              </h3>
              <p className="text-xs text-theme-secondary mt-0.5">
                Clique em qualquer imagem para ampliar em tela cheia ou conferir a qualidade do enquadramento anatômico
              </p>
            </div>

            {photoCount > 0 && (
              <button
                type="button"
                onClick={handleRecalibrateAnimal}
                disabled={recalibratingAnimal}
                className="btn-secondary py-1.5 px-3 min-h-[42px] text-xs font-semibold flex items-center gap-1.5 shrink-0 border-emerald-500/30 hover:border-emerald-500/50"
                title="Recalcular a qualidade de enquadramento de todas as fotos deste animal"
              >
                {recalibratingAnimal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span>
                  {recalibratingAnimal ? "Recalculando…" : "Recalcular Enquadramento"}
                </span>
              </button>
            )}
          </div>

          <PhotoGrid
            photos={animal.photos ?? []}
            onDelete={isOwner || isAdmin ? handleDeletePhoto : undefined}
            onSelect={(_, index) => setLightboxIndex(index)}
          />
        </div>
      </main>

      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-theme-surface/95 backdrop-blur-md border-t border-theme p-2.5 z-20 flex gap-2"
        style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary flex-1 py-2.5 text-xs"
        >
          <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Galeria
        </button>
        <Link href={cameraUrl} className="btn-primary flex-1 py-2.5 text-xs">
          <Camera className="w-4 h-4" />
          Câmera IA
        </Link>
      </div>

      {pendingPhoto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-md w-full overflow-hidden animate-scale-in">
            <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-sm text-theme-primary">
                  Avaliação de Confiança Pré-Upload
                </h3>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => setPendingPhoto(null)}
                className="p-1 rounded-md text-theme-muted hover:text-theme-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3.5">
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-black border border-theme relative">
                <img
                  src={pendingPhoto.previewUrl}
                  alt="Prévia da foto selecionada"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="rounded-lg p-3 bg-theme-surface-2 border border-theme">
                {pendingPhoto.evaluating ? (
                  <div className="flex items-center gap-3 py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-theme-primary">
                        Analisando foto com Inteligência Artificial…
                      </p>
                      <p className="text-[11px] text-theme-secondary">
                        Calculando confiança de enquadramento e nitidez antes de enviar
                      </p>
                    </div>
                  </div>
                ) : pendingPhoto.scoreResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted block">
                          Confiança IA Calculada
                        </span>
                        <span className="text-xs font-bold text-theme-primary">
                          {pendingPhoto.scoreResult.feedback}
                        </span>
                      </div>
                      <span
                        className={`text-lg font-black px-2.5 py-0.5 rounded-md ${
                          pendingPhoto.scoreResult.score >= 70
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : pendingPhoto.scoreResult.score >= 45
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-rose-500/15 text-rose-500"
                        }`}
                      >
                        {Math.round(pendingPhoto.scoreResult.score)}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-sm bg-theme-surface overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pendingPhoto.scoreResult.score >= 70
                            ? "bg-emerald-500"
                            : pendingPhoto.scoreResult.score >= 45
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(8, pendingPhoto.scoreResult.score))}%`,
                        }}
                      />
                    </div>

                    {pendingPhoto.scoreResult.lowQuality && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Confiança moderada/baixa — você ainda pode salvar ou escolher outra foto.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setPendingPhoto(null)}
                  className="btn-secondary flex-1 py-2.5 text-xs"
                >
                  Escolher Outra
                </button>
                <button
                  type="button"
                  disabled={uploading || pendingPhoto.evaluating}
                  onClick={handleConfirmGalleryUpload}
                  className="btn-primary flex-1 py-2.5 text-xs"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploading ? "Enviando…" : "Confirmar e Salvar"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-theme flex items-center justify-between">
              <h3 className="font-extrabold text-base text-theme-primary">
                Editar Dados Zootécnicos do Animal
              </h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 flex flex-col gap-4">
              <div>
                <label className="field-label">Apelido do Animal (Nome de Manejo)</label>
                <input
                  type="text"
                  value={editForm.name}
                  placeholder="Ex: Mimosa, Estrela, Vaca 42"
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="field-input font-bold"
                />
              </div>

              <div>
                <label className="field-label">Identificador RFID / Brinco</label>
                <input
                  type="text"
                  required
                  disabled={!isOwner && !isAdmin}
                  value={editForm.tag}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, tag: e.target.value.toUpperCase() }))
                  }
                  className="field-input font-mono text-xs uppercase disabled:opacity-50"
                />
                {!isOwner && !isAdmin && (
                  <p className="text-[11px] text-theme-muted mt-1">
                    Apenas o proprietário principal pode alterar o identificador RFID.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Raça</label>
                  <select
                    value={editForm.breed}
                    onChange={(e) => setEditForm((p) => ({ ...p, breed: e.target.value }))}
                    className="field-input"
                  >
                    {BREEDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Sexo</label>
                  <select
                    value={editForm.sex}
                    onChange={(e) => setEditForm((p) => ({ ...p, sex: e.target.value }))}
                    className="field-input"
                  >
                    {SEX_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={editForm.weight}
                    onChange={(e) => setEditForm((p) => ({ ...p, weight: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Idade (meses)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editForm.age}
                    onChange={(e) => setEditForm((p) => ({ ...p, age: e.target.value }))}
                    className="field-input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary py-2.5 px-4 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary py-2.5 px-5 text-xs"
                >
                  {savingEdit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lightboxIndex !== null && photoCount > 0 && (
        <PhotoLightbox
          photos={animal.photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPhotoRecalibrated={handlePhotoRecalibrated}
        />
      )}
    </div>
  );
}
