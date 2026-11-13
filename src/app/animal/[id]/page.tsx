"use client";

/**
 * Ficha Completa do Animal, Guarda Compartilhada e Galeria (`src/app/animal/[id]/page.tsx`).
 *
 * Layout em 2 colunas no desktop (dados/custódia à esquerda, histórico fotográfico à direita)
 * com carregamento instantâneo via cache SWR em memória (`getApiCacheSnapshot` + `apiFetchCached`).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
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
  Users,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoLightbox from "@/components/PhotoLightbox";
import AppHeader from "@/components/AppHeader";
import { useToast } from "@/components/ui/Toast";
import { Animal, Photo } from "@/lib/types";
import { BREEDS, SEX_OPTIONS } from "@/lib/animal";
import { compressImageFile } from "@/lib/image-client";
import { evaluatePhotoScoreBeforeUpload, VisionScoreResult } from "@/lib/vision-client";
import {
  apiFetch,
  apiFetchCached,
  apiUpload,
  getApiCacheSnapshot,
  invalidateApiCache,
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
      <div className="h-15 bg-theme-surface border-b border-theme" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="h-64 skeleton rounded-xl" />
          <div className="h-44 skeleton rounded-xl" />
        </div>
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-8 skeleton rounded-lg w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] skeleton rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-3 bg-theme-surface-2 border border-theme">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">{label}</p>
        <p className="text-sm font-bold text-theme-primary truncate tabular-nums">{value}</p>
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

  const detailEndpoint = id ? `/api/animals/${id}` : "";
  const cachedAnimal = detailEndpoint ? getApiCacheSnapshot<Animal>(detailEndpoint) : null;

  const [animal, setAnimal] = useState<Animal | null>(() => cachedAnimal);
  const [loading, setLoading] = useState<boolean>(() => !cachedAnimal);
  const [uploading, setUploading] = useState(false);
  const [recalibratingAnimal, setRecalibratingAnimal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [pendingPhoto, setPendingPhoto] = useState<PendingGalleryPhoto | null>(null);
  const [copiedTag, setCopiedTag] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [custodyActionLoading, setCustodyActionLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState(() => ({
    tag: cachedAnimal?.tag ?? "",
    name: cachedAnimal?.name ?? "",
    breed: cachedAnimal?.breed ?? "Nelore",
    sex: cachedAnimal?.sex ?? "Fêmea",
    weight: cachedAnimal ? String(cachedAnimal.weight) : "",
    age: cachedAnimal ? String(cachedAnimal.age) : "",
  }));

  const loadAnimal = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;
      const endpoint = `/api/animals/${id}`;
      if (forceRefresh) {
        invalidateApiCache(endpoint);
      }
      try {
        const data = await apiFetchCached<Animal>(endpoint, forceRefresh ? 0 : 12_000);
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
    },
    [id, router]
  );

  useEffect(() => {
    loadAnimal(false);
  }, [loadAnimal]);

  const copyRfid = () => {
    if (!animal) return;
    navigator.clipboard.writeText(animal.tag);
    setCopiedTag(true);
    toast("Identificador copiado.", "info");
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
          `Foto salva com enquadramento de ${Math.round(
            data.photo.score ?? pendingPhoto.scoreResult?.score ?? 0
          )}%.`,
          "success"
        );
        setPendingPhoto(null);
      }
    } catch (err: any) {
      toast(err?.message || "Falha ao enviar foto.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const ok = await confirm({
      title: "Excluir foto",
      message: "Deseja realmente apagar esta foto? Esta ação não pode ser desfeita.",
      confirmText: "Excluir foto",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await apiFetch(`/api/photos/${photoId}`, { method: "DELETE" });
      setAnimal((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p: Photo) => p.id !== photoId) } : prev
      );
      toast("Foto removida.", "success");
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
        toast("Dados do animal atualizados.", "success");
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
      title: `Excluir ${animal.name || animal.tag}`,
      message: `Tem certeza que deseja excluir este animal e todas as suas ${
        animal.photos?.length ?? 0
      } fotos? Esta ação é irreversível.`,
      confirmText: "Excluir definitivamente",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await apiFetch(`/api/animals/${animal.id}`, { method: "DELETE" });
      toast("Animal excluído.", "success");
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
      toast(data?.message || `${data?.updatedCount ?? 0} foto(s) recalculada(s).`, "success");

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
      toast(err?.message || "Erro ao recalcular enquadramento.", "error");
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
    toast(`Enquadramento atualizado para ${Math.round(newScore)}%.`, "success");
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !animal) return;
    setInviting(true);

    try {
      const res = await addCollaborator(animal.id, { email: inviteEmail.trim() });
      toast(res.message || "Operador adicionado à guarda compartilhada.", "success");
      setInviteEmail("");
      if (res.custody) {
        setAnimal((prev) => (prev ? { ...prev, custody: res.custody } : prev));
      } else {
        await loadAnimal(true);
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
      title: "Revogar guarda compartilhada",
      message: `Remover o acesso de ${targetName} a este animal?`,
      confirmText: "Revogar acesso",
      variant: "danger",
    });
    if (!ok) return;

    setCustodyActionLoading(true);
    try {
      const res = await removeCollaborator(animal.id, targetUserId);
      toast(res.message || "Acesso revogado.", "success");
      if (res.custody) {
        setAnimal((prev) => (prev ? { ...prev, custody: res.custody } : prev));
      } else {
        await loadAnimal(true);
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
      title: "Transferir posse definitiva",
      message: `Transferir a propriedade principal para ${targetName}? Você continuará como colaborador na guarda compartilhada.`,
      confirmText: "Transferir posse",
      variant: "danger",
    });
    if (!ok) return;

    setCustodyActionLoading(true);
    try {
      const res = await transferOwnership(animal.id, newOwnerId);
      toast(res.message || "Posse transferida.", "success");
      if (res.custody) {
        setAnimal((prev) =>
          prev ? { ...prev, custody: res.custody, isOwner: false, isShared: true } : prev
        );
      }
      await loadAnimal(true);
    } catch (err: any) {
      toast(err?.message || "Erro ao transferir posse.", "error");
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

  const displayName = animal.name?.trim() || "Sem apelido";
  const cameraUrl = `/camera?animalId=${animal.id}&animalName=${encodeURIComponent(displayName)}`;
  const photos = animal.photos ?? [];
  const photoCount = photos.length;
  const custody = animal.custody;
  const isOwner =
    animal.isOwner ?? (custody?.isOwner ?? (user ? animal.ownerId === Number(user.id) : false));
  const canManage = custody?.canManage ?? (isOwner || isAdmin);

  const shortTag =
    animal.tag.length > 14 ? `${animal.tag.slice(0, 6)}…${animal.tag.slice(-4)}` : animal.tag;

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
        subtitle={`${animal.breed} · ${animal.sex} · ${isOwner ? "Proprietário" : "Compartilhado"}`}
      />

      <main className="flex-1 p-3 sm:p-6 max-w-6xl mx-auto w-full pb-24 sm:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda: Ficha Zootécnica + Guarda Compartilhada */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  {!isOwner && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/12 text-blue-700 dark:text-blue-400 border border-blue-500/20 mb-2">
                      <Users className="w-3 h-3" />
                      Guarda compartilhada
                    </span>
                  )}

                  <h1 className="text-xl sm:text-2xl font-bold text-theme-primary tracking-tight truncate">
                    {displayName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={copyRfid}
                      title={`Copiar identificador: ${animal.tag}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-theme-secondary bg-theme-surface-2 hover:text-theme-primary border border-theme transition"
                    >
                      <Tag className="w-3 h-3 opacity-60" />
                      <span>{shortTag}</span>
                      {copiedTag ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-60" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      className="text-xs text-theme-muted hover:text-theme-primary inline-flex items-center gap-0.5 font-medium"
                    >
                      <span>{showTechnicalDetails ? "Ocultar RFID" : "RFID completo"}</span>
                      {showTechnicalDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {showTechnicalDetails && (
                <div className="p-3 mb-4 rounded-lg bg-theme-surface-2 border border-theme space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-theme-secondary">Identificador completo</span>
                    <button
                      type="button"
                      onClick={copyRfid}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                    >
                      {copiedTag ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <code className="block p-2 rounded bg-black/5 dark:bg-black/30 font-mono text-[11px] text-theme-primary break-all">
                    {animal.tag}
                  </code>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <Stat icon={<Tag className="w-4 h-4" />} label="Raça" value={animal.breed} />
                <Stat icon={<Dna className="w-4 h-4" />} label="Sexo" value={animal.sex} />
                <Stat icon={<Scale className="w-4 h-4" />} label="Peso" value={`${animal.weight} kg`} />
                <Stat
                  icon={<Calendar className="w-4 h-4" />}
                  label="Idade"
                  value={`${animal.age} meses`}
                />
              </div>

              {/* Ações principais */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-theme">
                <Link
                  href={cameraUrl}
                  className="btn-primary py-2.5 px-4 text-xs font-semibold flex-1 min-w-[130px] justify-center min-h-[40px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Fotografar</span>
                </Link>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary py-2.5 px-3.5 text-xs font-semibold flex-1 min-w-[100px] justify-center min-h-[40px]"
                >
                  <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Galeria</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn-secondary py-2.5 px-3 text-xs font-semibold justify-center min-h-[40px]"
                  title="Editar ficha do animal"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={handleDeleteAnimal}
                    className="px-3 py-2.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition inline-flex items-center gap-1.5 min-h-[40px]"
                    title="Excluir animal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                )}
              </div>
            </div>

            {/* Painel de Guarda Compartilhada */}
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-theme-primary">Guarda Compartilhada</h2>
                    <p className="text-[11px] text-theme-secondary">
                      Operadores com acesso a fotos e registro deste animal
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-theme-surface-2 border border-theme mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted block">
                    Proprietário principal
                  </span>
                  <p className="text-xs font-bold text-theme-primary truncate">
                    {custody?.owner?.name || "Proprietário"}
                  </p>
                  {custody?.owner?.email && (
                    <p className="text-[11px] text-theme-secondary truncate">{custody.owner.email}</p>
                  )}
                </div>
                {isOwner && (
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">
                    Você
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-theme-secondary block">
                  Colaboradores ({custody?.collaborators?.length ?? 0})
                </span>

                {custody?.collaborators && custody.collaborators.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {custody.collaborators.map((collab) => {
                      const isMe = user && Number(user.id) === collab.userId;
                      return (
                        <div
                          key={collab.id}
                          className="p-2.5 rounded-lg bg-theme-surface-2 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-theme-primary truncate">
                                {collab.user?.name || "Operador"}
                              </span>
                              {isMe && (
                                <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                  Você
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-theme-secondary truncate">
                              {collab.user?.email}
                            </p>
                          </div>

                          {canManage && !isMe && (
                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              <button
                                type="button"
                                disabled={custodyActionLoading}
                                onClick={() =>
                                  handleTransferOwnership(
                                    collab.userId,
                                    collab.user?.name || "Operador"
                                  )
                                }
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-theme-surface hover:bg-theme-surface-2 border border-theme text-theme-secondary hover:text-theme-primary transition inline-flex items-center gap-1"
                                title="Transferir posse definitiva"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                                <span>Transferir</span>
                              </button>

                              <button
                                type="button"
                                disabled={custodyActionLoading}
                                onClick={() =>
                                  handleRemoveCollaborator(
                                    collab.userId,
                                    collab.user?.name || "Operador"
                                  )
                                }
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition inline-flex items-center gap-1"
                                title="Remover operador"
                              >
                                <UserMinus className="w-3 h-3" />
                                <span>Remover</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-theme-muted p-2.5 bg-theme-surface-2/60 rounded-lg border border-theme">
                    Nenhum colaborador vinculado. Você pode convidar por e-mail abaixo ou pela
                    leitura RFID.
                  </p>
                )}
              </div>

              {canManage && (
                <form
                  onSubmit={handleInviteCollaborator}
                  className="mt-3 pt-3 border-t border-theme flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-mail do operador para compartilhar…"
                    className="field-input flex-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="btn-secondary py-2 px-3.5 text-xs font-semibold shrink-0"
                  >
                    {inviting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span>Compartilhar</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Coluna Direita: Galeria Fotográfica */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="card p-4 sm:p-5">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4 pb-3 border-b border-theme">
                <div>
                  <h2 className="text-base font-bold text-theme-primary">
                    Histórico Fotográfico ({photoCount})
                  </h2>
                  <p className="text-xs text-theme-secondary mt-0.5">
                    Capturas posteriores utilizadas na avaliação de condição corporal
                  </p>
                </div>

                {photoCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRecalibrateAnimal}
                    disabled={recalibratingAnimal}
                    className="btn-secondary py-1.5 px-3 min-h-[38px] text-xs font-semibold shrink-0"
                  >
                    {recalibratingAnimal ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span>{recalibratingAnimal ? "Recalculando…" : "Recalcular scores"}</span>
                  </button>
                )}
              </div>

              <PhotoGrid
                photos={photos}
                onDelete={isOwner || isAdmin ? handleDeletePhoto : undefined}
                onSelect={(_, index) => setLightboxIndex(index)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Barra fixa mobile para captura rápida */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-theme-surface/95 backdrop-blur-md border-t border-theme p-2.5 z-20 flex gap-2"
        style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
        >
          <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Galeria
        </button>
        <Link href={cameraUrl} className="btn-primary flex-1 py-2.5 text-xs font-semibold">
          <Camera className="w-4 h-4" />
          Fotografar
        </Link>
      </div>

      {/* Modal pré-upload de foto da galeria */}
      {pendingPhoto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-md w-full overflow-hidden animate-scale-in">
            <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-theme-primary">
                  Validação de enquadramento
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
                  <div className="flex items-center gap-3 py-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-theme-primary">
                        Verificando nitidez e enquadramento…
                      </p>
                      <p className="text-[11px] text-theme-secondary">
                        Aguarde a análise da imagem antes do envio
                      </p>
                    </div>
                  </div>
                ) : pendingPhoto.scoreResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted block">
                          Qualidade de enquadramento
                        </span>
                        <span className="text-xs font-semibold text-theme-primary">
                          {pendingPhoto.scoreResult.feedback}
                        </span>
                      </div>
                      <span
                        className={`text-base font-bold tabular-nums px-2.5 py-0.5 rounded-md ${
                          pendingPhoto.scoreResult.score >= 70
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : pendingPhoto.scoreResult.score >= 45
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
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
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Enquadramento moderado ou baixo. Você ainda pode salvar ou trocar a foto.
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
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                >
                  Escolher outra
                </button>
                <button
                  type="button"
                  disabled={uploading || pendingPhoto.evaluating}
                  onClick={handleConfirmGalleryUpload}
                  className="btn-primary flex-1 py-2.5 text-xs font-semibold"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploading ? "Enviando…" : "Salvar foto"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-theme flex items-center justify-between">
              <h3 className="font-bold text-base text-theme-primary">Editar dados do animal</h3>
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
                <label className="field-label">Apelido ou nome</label>
                <input
                  type="text"
                  value={editForm.name}
                  placeholder="Ex: Mimosa, Estrela, Lote 42"
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="field-input font-semibold"
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
                    className="field-input tabular-nums"
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
                    className="field-input tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary py-2.5 px-5 text-xs font-semibold"
                >
                  {savingEdit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lightboxIndex !== null && photoCount > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPhotoRecalibrated={handlePhotoRecalibrated}
        />
      )}
    </div>
  );
}
