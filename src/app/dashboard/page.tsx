"use client";

/**
 * Painel Principal do Operador (`src/app/dashboard/page.tsx`).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Camera,
  Search,
  ChevronRight,
  Layers,
  Copy,
  Check,
  LayoutGrid,
  List,
  RefreshCw,
  MapPin,
  Users,
  Images,
  ShieldCheck,
} from "lucide-react";
import { Animal, getPhotoUrl } from "@/lib/types";
import { AsyncPhoto } from "@/components/AsyncPhoto";
import {
  apiFetchCached,
  getApiCacheSnapshot,
  invalidateApiCache,
  prefetchApi,
  readPersistedApiCache,
} from "@/lib/api";
import { getHerdSnapshot, saveHerdSnapshot } from "@/lib/sync";
import { useAuth } from "@/lib/auth-context";
import AppHeader from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";
import { useToast } from "@/components/ui/Toast";

type FilterMode = "all" | "owned" | "shared" | "with_photos" | "without_photos";
type ViewMode = "grid" | "list";

const ANIMALS_SUMMARY_ENDPOINT = "/api/animals?summary=1";

function getPhotoCount(animal: Animal): number {
  return animal.photoCount ?? animal.photos?.length ?? 0;
}

function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[16/10] skeleton rounded-none" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 skeleton w-2/3" />
        <div className="h-3 skeleton w-1/2" />
        <div className="h-10 skeleton w-full rounded-[10px] mt-1" />
      </div>
    </div>
  );
}

function AnimalCard({ animal, currentUserId }: { animal: Animal; currentUserId?: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const lastPhoto = animal.photos?.[0];
  const photoUrl = lastPhoto ? getPhotoUrl(lastPhoto.id, 480) : null;
  const displayName = animal.name?.trim() || "Sem apelido";
  const photoCount = getPhotoCount(animal);
  const cameraUrl = `/camera?animalId=${animal.id}&animalName=${encodeURIComponent(displayName)}`;
  const bestScore =
    lastPhoto && typeof lastPhoto.score === "number" ? Math.round(lastPhoto.score) : null;

  const isShared = animal.isShared || (currentUserId !== undefined && animal.ownerId !== currentUserId);
  const icsCalculated = animal.ics?.status === "CALCULATED" && typeof animal.ics.score === "number";
  const icsQueued = animal.ics?.status === "QUEUED" || animal.ics?.status === "PROCESSING";

  const copyTag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(animal.tag);
    setCopied(true);
    toast("Identificador copiado.", "info");
    setTimeout(() => setCopied(false), 2000);
  };

  const shortTag =
    animal.tag.length > 14 ? `${animal.tag.slice(0, 6)}…${animal.tag.slice(-4)}` : animal.tag;

  return (
    <div className="card overflow-hidden group relative hover:border-emerald-500/60 transition-colors flex flex-col justify-between">
      <Link
        href={`/animal/${animal.id}`}
        onMouseEnter={() => prefetchApi(`/api/animals/${animal.id}`)}
        onTouchStart={() => prefetchApi(`/api/animals/${animal.id}`)}
        className="block focus:outline-none"
        aria-label={`Abrir ficha de ${displayName}`}
      >
        <div className="aspect-[16/10] relative overflow-hidden bg-theme-surface-2">
          {photoUrl ? (
            <AsyncPhoto
              src={photoUrl}
              alt={displayName}
              loadingLabel="Carregando foto…"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              fallbackIcon={<Layers className="w-7 h-7 opacity-40 stroke-[1.5]" />}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-theme-surface-2 text-theme-muted">
              <Layers className="w-7 h-7 opacity-40 stroke-[1.5]" />
              <span className="text-[11px] font-medium">Sem capturas</span>
            </div>
          )}

          {(bestScore !== null || photoCount > 0) && (
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          )}

          {/* Canto superior esquerdo: ICS ou status na fila */}
          {icsCalculated ? (
            <span
              title={`ICS ${animal.ics?.score?.toFixed(2)} — ${animal.ics?.classification}`}
              className="absolute top-2.5 left-2.5 inline-flex items-center text-[11px] font-bold tabular-nums px-2.5 py-0.5 rounded-[7px] bg-emerald-600 text-white shadow-xs"
            >
              ICS {animal.ics?.score?.toFixed(2).replace(".", ",")}
            </span>
          ) : icsQueued ? (
            <span className="absolute top-2.5 left-2.5 inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-[7px] bg-amber-500 text-slate-950">
              ICS na fila
            </span>
          ) : null}

          {/* Canto superior direito: Compartilhado (sem sobrepor o ICS) */}
          {isShared && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[7px] bg-black/70 text-white backdrop-blur-sm">
              <Users className="w-3 h-3" />
              <span>Compartilhado</span>
            </span>
          )}

          {/* Base da imagem: Enquadramento e contagem */}
          {bestScore !== null && (
            <span
              title={`Qualidade do enquadramento: ${bestScore}%`}
              className="absolute bottom-2.5 left-2.5 inline-flex items-center text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-[7px] bg-black/70 text-emerald-300"
            >
              Foto {bestScore}%
            </span>
          )}

          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-[7px] bg-black/70 text-white">
            <Images className="w-3 h-3 text-emerald-400" />
            <span>{photoCount}</span>
          </span>
        </div>

        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-[15px] text-theme-primary truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {displayName}
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[7px] bg-theme-surface-2 text-theme-secondary border border-theme shrink-0">
              {animal.breed}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2.5">
            <button
              type="button"
              onClick={copyTag}
              title={`Copiar identificador: ${animal.tag}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[7px] text-[11px] font-mono-tag text-theme-secondary bg-theme-surface-2 hover:text-theme-primary border border-theme transition"
            >
              <span>{shortTag}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-60" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-theme-secondary tabular-nums">
            <span>{animal.sex}</span>
            <span>{animal.weight} kg</span>
            <span>{animal.age} meses</span>
            {animal.location && (
              <span
                className="inline-flex items-center gap-1 truncate max-w-[150px]"
                title={animal.locationAddress || animal.location}
              >
                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{animal.location}</span>
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="px-4 pb-4 pt-1 flex items-center gap-2">
        <Link
          href={cameraUrl}
          className="btn-primary flex-1 !min-h-[40px] !py-2 text-xs"
          aria-label={`Fotografar ${displayName}`}
        >
          <Camera className="w-4 h-4" />
          <span>Fotografar</span>
        </Link>
        <Link
          href={`/animal/${animal.id}`}
          className="btn-secondary !min-h-[40px] !py-2 !px-3 text-xs"
          title="Abrir ficha completa"
        >
          <span>Ficha</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function AnimalListRow({ animal, currentUserId }: { animal: Animal; currentUserId?: number }) {
  const lastPhoto = animal.photos?.[0];
  const thumbUrl = lastPhoto ? getPhotoUrl(lastPhoto.id, 240) : null;
  const displayName = animal.name?.trim() || "Sem apelido";
  const photoCount = getPhotoCount(animal);
  const bestScore =
    lastPhoto && typeof lastPhoto.score === "number" ? Math.round(lastPhoto.score) : null;
  const isShared = animal.isShared || (currentUserId !== undefined && animal.ownerId !== currentUserId);
  const icsCalculated = animal.ics?.status === "CALCULATED" && typeof animal.ics.score === "number";
  const cameraUrl = `/camera?animalId=${animal.id}&animalName=${encodeURIComponent(displayName)}`;

  return (
    <div className="card p-3 flex items-center gap-3.5 hover:border-emerald-500/60 transition-colors">
      <Link
        href={`/animal/${animal.id}`}
        className="w-20 h-14 rounded-[10px] overflow-hidden bg-theme-surface-2 shrink-0 flex items-center justify-center border border-theme"
      >
        {thumbUrl ? (
          <AsyncPhoto
            src={thumbUrl}
            alt={displayName}
            compact
            fallbackIcon={<Layers className="w-5 h-5 text-theme-muted opacity-40" />}
          />
        ) : (
          <Layers className="w-5 h-5 text-theme-muted opacity-40" />
        )}
      </Link>

      <Link
        href={`/animal/${animal.id}`}
        onMouseEnter={() => prefetchApi(`/api/animals/${animal.id}`)}
        onTouchStart={() => prefetchApi(`/api/animals/${animal.id}`)}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-theme-primary truncate hover:text-emerald-700 dark:hover:text-emerald-400">
            {displayName}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-[7px] bg-theme-surface-2 border border-theme text-theme-secondary shrink-0">
            {animal.breed}
          </span>
          {icsCalculated && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-[7px] bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
              ICS {animal.ics?.score?.toFixed(2).replace(".", ",")}
            </span>
          )}
          {isShared && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[7px] bg-sky-500/12 text-sky-700 dark:text-sky-300 shrink-0">
              <Users className="w-3 h-3" />
              <span>Compartilhado</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-theme-secondary tabular-nums">
          <span className="font-mono-tag text-[11px] text-theme-muted">{animal.tag}</span>
          <span>{animal.sex}</span>
          <span>{animal.weight} kg</span>
          <span>{animal.age} meses</span>
          {animal.location && (
            <span className="inline-flex items-center gap-1 text-theme-primary">
              <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{animal.location}</span>
            </span>
          )}
          <span>
            {photoCount} {photoCount === 1 ? "foto" : "fotos"}
          </span>
          {bestScore !== null && (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              Enquadramento {bestScore}%
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        <Link href={cameraUrl} className="btn-primary !py-2 !px-3 !min-h-[38px] text-xs">
          <Camera className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Fotografar</span>
        </Link>
        <Link href={`/animal/${animal.id}`} className="btn-secondary !py-2 !px-3 !min-h-[38px] text-xs">
          <span>Ficha</span>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const initialSnapshot = getApiCacheSnapshot<Animal[]>(ANIMALS_SUMMARY_ENDPOINT);
  const [animals, setAnimals] = useState<Animal[]>(() =>
    Array.isArray(initialSnapshot) ? initialSnapshot : []
  );
  const [loading, setLoading] = useState<boolean>(() => !Array.isArray(initialSnapshot));
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [usingOfflineCache, setUsingOfflineCache] = useState(false);
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const currentUserId = user ? Number(user.id) : undefined;

  const loadAnimals = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setRefreshing(true);
        invalidateApiCache("/api/animals");
      }
      try {
        const data = await apiFetchCached<Animal[]>(
          ANIMALS_SUMMARY_ENDPOINT,
          forceRefresh ? 0 : 15_000
        );
        if (Array.isArray(data)) {
          setAnimals(data);
          setUsingOfflineCache(false);
          saveHerdSnapshot("herd_summary", data).catch(() => {});
        }
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.message?.includes("Token")) {
          router.push("/login");
          return;
        }
        const offlineList = await getHerdSnapshot<Animal[]>("herd_summary");
        if (Array.isArray(offlineList) && offlineList.length > 0) {
          setAnimals(offlineList);
          setUsingOfflineCache(true);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        if (!Array.isArray(initialSnapshot)) {
          const persisted = readPersistedApiCache<Animal[]>(ANIMALS_SUMMARY_ENDPOINT);
          if (Array.isArray(persisted) && persisted.length > 0) {
            setAnimals(persisted);
            setLoading(false);
          } else {
            getHerdSnapshot<Animal[]>("herd_summary")
              .then((offlineList) => {
                if (Array.isArray(offlineList) && offlineList.length > 0) {
                  setAnimals((prev) => (prev.length === 0 ? offlineList : prev));
                  setLoading(false);
                }
              })
              .catch(() => {});
          }
        }
        loadAnimals(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router, loadAnimals]);

  const stats = useMemo(() => {
    const totalAnimals = animals.length;
    const totalPhotos = animals.reduce((acc, a) => acc + getPhotoCount(a), 0);
    const withPhotos = animals.filter((a) => getPhotoCount(a) > 0).length;
    const withoutPhotos = totalAnimals - withPhotos;
    const evaluatedIcs = animals.filter((a) => a.ics?.status === "CALCULATED").length;
    const sharedCount = animals.filter(
      (a) => a.isShared || (currentUserId !== undefined && a.ownerId !== currentUserId)
    ).length;
    const ownedCount = totalAnimals - sharedCount;
    const avgWeight =
      totalAnimals > 0
        ? Math.round(animals.reduce((acc, a) => acc + (Number(a.weight) || 0), 0) / totalAnimals)
        : 0;
    return {
      totalAnimals,
      totalPhotos,
      withPhotos,
      withoutPhotos,
      evaluatedIcs,
      sharedCount,
      ownedCount,
      avgWeight,
    };
  }, [animals, currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return animals.filter((a) => {
      const photoCount = getPhotoCount(a);
      const isShared = a.isShared || (currentUserId !== undefined && a.ownerId !== currentUserId);

      if (filterMode === "owned" && isShared) return false;
      if (filterMode === "shared" && !isShared) return false;
      if (filterMode === "with_photos" && photoCount === 0) return false;
      if (filterMode === "without_photos" && photoCount > 0) return false;

      if (!q) return true;
      return (
        a.tag.toUpperCase().includes(q) ||
        (a.name && a.name.toUpperCase().includes(q)) ||
        (a.location && a.location.toUpperCase().includes(q)) ||
        (a.locationAddress && a.locationAddress.toUpperCase().includes(q)) ||
        a.breed.toUpperCase().includes(q)
      );
    });
  }, [animals, query, filterMode, currentUserId]);

  const filterTabs = useMemo(() => {
    return [
      { id: "all" as const, label: "Todos", count: stats.totalAnimals },
      ...(stats.sharedCount > 0
        ? [
            { id: "owned" as const, label: "Meus", count: stats.ownedCount },
            { id: "shared" as const, label: "Compartilhados", count: stats.sharedCount },
          ]
        : []),
      { id: "with_photos" as const, label: "Com fotos", count: stats.withPhotos },
      { id: "without_photos" as const, label: "Sem fotos", count: stats.withoutPhotos },
    ];
  }, [stats]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary">
      <AppHeader
        title="Rebanho"
        subtitle={
          loading
            ? "Carregando…"
            : `${stats.totalAnimals} ${stats.totalAnimals === 1 ? "animal" : "animais"} no lote`
        }
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-5 pb-24 sm:pb-10">
        {!loading && usingOfflineCache && (
          <div className="mb-4 px-3.5 py-2.5 rounded-[10px] bg-sky-500/10 border border-sky-500/25 text-xs text-sky-700 dark:text-sky-300">
            Exibindo cópia salva no aparelho. Novos registros sincronizam ao reconectar.
          </div>
        )}

        {!loading && animals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="card p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-theme-muted">Rebanho</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-theme-primary mt-1">
                {stats.totalAnimals}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                {stats.sharedCount > 0 ? `${stats.sharedCount} compartilhados` : "Animais cadastrados"}
              </p>
            </div>

            <div className="card p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                ICS avaliado
              </p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                {stats.evaluatedIcs}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                de {stats.totalAnimals} {stats.totalAnimals === 1 ? "animal" : "animais"}
              </p>
            </div>

            <div className="card p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-theme-muted">Capturas</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-theme-primary mt-1">
                {stats.totalPhotos}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">Fotos no lote</p>
            </div>

            <div className="card p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-theme-muted">Peso médio</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-theme-primary mt-1">
                {stats.avgWeight}{" "}
                <span className="text-xs font-medium text-theme-secondary">kg</span>
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">Média geral</p>
            </div>
          </div>
        )}

        {!loading && animals.length > 0 && (
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex gap-2.5 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por apelido, brinco, raça ou fazenda…"
                  className="field-input pl-10"
                />
              </div>

              <div className="hidden sm:flex items-center bg-theme-surface border border-theme rounded-[10px] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Visualização em grade"
                  title="Grade"
                  className={`p-1.5 rounded-[7px] transition ${
                    viewMode === "grid"
                      ? "bg-emerald-600 text-white"
                      : "text-theme-secondary hover:text-theme-primary"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="Visualização em lista"
                  title="Lista"
                  className={`p-1.5 rounded-[7px] transition ${
                    viewMode === "list"
                      ? "bg-emerald-600 text-white"
                      : "text-theme-secondary hover:text-theme-primary"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => loadAnimals(true)}
                disabled={refreshing}
                title="Atualizar"
                aria-label="Atualizar lista"
                className="btn-secondary !px-3 !min-h-[44px] shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap inline-flex items-center gap-1.5 border ${
                    filterMode === tab.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-theme-surface text-theme-secondary border-theme hover:text-theme-primary"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
                      filterMode === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-theme-surface-2 text-theme-muted"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-14 px-6 flex flex-col items-center justify-center gap-3 text-center max-w-lg mx-auto my-6">
            <div className="w-11 h-11 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-primary">
                {query || filterMode !== "all"
                  ? "Nenhum animal encontrado"
                  : "Seu rebanho está vazio"}
              </h2>
              <p className="text-xs text-theme-secondary mt-1 max-w-sm mx-auto">
                {query || filterMode !== "all"
                  ? "Limpe a busca ou troque o filtro para visualizar os animais."
                  : "Cadastre o primeiro bovino com apelido ou brinco para iniciar o acompanhamento."}
              </p>
            </div>
            {query || filterMode !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilterMode("all");
                }}
                className="btn-secondary !py-2 !px-4 !min-h-[38px] text-xs"
              >
                Limpar filtros
              </button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2.5 mt-1">
                <Link href="/animal/new" className="btn-primary px-5 text-sm">
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar animal</span>
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="btn-secondary px-4 text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Gestão</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-2.5">
            {filtered.map((a) => (
              <AnimalListRow key={a.id} animal={a} currentUserId={currentUserId} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => (
              <AnimalCard key={a.id} animal={a} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
