'use client';

/**
 * Painel Administrativo, Curadoria do Dataset e Gestão de Usuários (`src/app/admin/page.tsx`).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  ArrowLeft,
  Users,
  ImageIcon,
  Loader2,
  Search,
  Activity,
  Camera,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  UserPlus,
  Trash2,
  Database,
  X,
} from 'lucide-react';
import { AnimalWithOwner, getPhotoUrl } from '@/lib/types';
import { apiFetch, getApiUrl, getStoredToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import PhotoLightbox from '@/components/PhotoLightbox';
import ThemeToggle from '@/components/ThemeToggle';
import MobileNav from '@/components/MobileNav';

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | string;
  createdAt: string;
  animalsCount: number;
  photosCount: number;
  isSelf?: boolean;
}

function SkeletonCard() {
  return (
    <div className="card p-4 flex gap-4">
      <div className="w-16 h-16 skeleton rounded-xl shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-1/2" />
        <div className="h-3 skeleton rounded w-1/3" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'dataset' | 'users'>('dataset');
  const [animals, setAnimals] = useState<AnimalWithOwner[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  const [query, setQuery] = useState('');
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [previewAnimal, setPreviewAnimal] = useState<AnimalWithOwner | null>(null);

  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'USER' | 'ADMIN'>('ADMIN');
  const [savingUser, setSavingUser] = useState(false);

  const { toast, confirm } = useToast();
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const loadData = useCallback(async () => {
    try {
      const [animalsData, usersData] = await Promise.all([
        apiFetch<AnimalWithOwner[]>('/api/admin/animals'),
        apiFetch<AdminUserRow[]>('/api/admin/users'),
      ]);
      if (Array.isArray(animalsData)) setAnimals(animalsData);
      if (Array.isArray(usersData)) setUsers(usersData);
    } catch (err: any) {
      if (err?.message?.includes('403') || err?.message?.includes('Acesso negado')) {
        router.push('/dashboard');
      } else if (err?.message?.includes('401') || err?.message?.includes('Token')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/dashboard');
      } else {
        loadData();
      }
    }
  }, [authLoading, user, isAdmin, router, loadData]);

  const stats = useMemo(() => {
    const totalAnimals = animals.length;
    const allPhotos = animals.flatMap((a) => a.photos ?? []);
    const totalPhotos = allPhotos.length;
    const totalUsers = users.length;
    const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;
    const scoredPhotos = allPhotos.filter(
      (p) => typeof p.score === 'number' && !Number.isNaN(p.score)
    );
    const avgScore =
      scoredPhotos.length > 0
        ? Math.round(
            scoredPhotos.reduce((acc, p) => acc + (p.score as number), 0) /
              scoredPhotos.length
          )
        : null;

    return { totalAnimals, totalPhotos, totalUsers, totalAdmins, avgScore };
  }, [animals, users]);

  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      if (onlyWithPhotos && (a.photos?.length ?? 0) === 0) return false;
      const q = query.trim().toUpperCase();
      if (!q) return true;
      return (
        a.tag.toUpperCase().includes(q) ||
        (a.name || '').toUpperCase().includes(q) ||
        a.breed.toUpperCase().includes(q) ||
        (a.owner?.name || '').toUpperCase().includes(q) ||
        (a.owner?.email || '').toUpperCase().includes(q)
      );
    });
  }, [animals, query, onlyWithPhotos]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const baseUrl = getApiUrl();
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}/api/admin/export`, { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao exportar');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cattle-vision-ics-dataset-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Download do dataset ZIP iniciado com sucesso!', 'success');
    } catch (err: any) {
      toast(err?.message || 'Erro ao gerar o dataset.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleRecalibrateScores = async () => {
    if (recalibrating) return;
    const ok = await confirm({
      title: 'Recalcular Confiança do Dataset',
      message:
        'Deseja recalcular a confiança de todas as fotos do banco de dados com a IA calibrada? Isso atualizará permanentemente os registros.',
      confirmText: 'Recalcular Todas',
      variant: 'primary',
    });
    if (!ok) return;

    setRecalibrating(true);
    try {
      const data = await apiFetch<any>('/api/admin/recalibrate', { method: 'POST' });
      toast(
        data?.message || `${data?.updatedCount ?? 0} fotos recalculadas com sucesso!`,
        'success'
      );
      await loadData();
    } catch (err: any) {
      toast(err?.message || 'Erro ao recalcular confiança da IA', 'error');
    } finally {
      setRecalibrating(false);
    }
  };

  const handleToggleRole = async (target: AdminUserRow) => {
    const nextRole = target.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setUpdatingUserId(target.id);
    try {
      await apiFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: { role: nextRole },
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u))
      );
      toast(
        nextRole === 'ADMIN'
          ? `${target.name} agora é Administrador!`
          : `${target.name} alterado para Operador comum.`,
        'success'
      );
    } catch (err: any) {
      toast(err?.message || 'Falha ao atualizar cargo', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (target: AdminUserRow) => {
    const ok = await confirm({
      title: 'Excluir Usuário',
      message: `Tem certeza que deseja excluir o usuário "${target.name}" (${target.email})? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir Usuário',
      variant: 'danger',
    });
    if (!ok) return;

    setUpdatingUserId(target.id);
    try {
      await apiFetch(`/api/admin/users/${target.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      toast('Usuário removido com sucesso.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Falha ao remover usuário', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateOrPromoteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const data = await apiFetch<any>('/api/admin/users', {
        method: 'POST',
        body: {
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        },
      });

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === data.id);
        if (exists) {
          return prev.map((u) =>
            u.id === data.id
              ? { ...u, name: data.name, role: data.role }
              : u
          );
        }
        return [data, ...prev];
      });

      toast(
        data?.updatedExisting
          ? `Usuário existente atualizado para ${data.role}!`
          : `Novo ${data.role === 'ADMIN' ? 'Administrador' : 'Operador'} cadastrado!`,
        'success'
      );
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('ADMIN');
    } catch (err: any) {
      toast(err?.message || 'Erro ao criar/promover usuário', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-theme-bg text-theme-primary flex flex-col pb-20 sm:pb-8">
      <header className="glass-header sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Link
              href="/dashboard"
              className="p-2 rounded-md min-w-[38px] min-h-[38px] flex items-center justify-center text-theme-secondary hover:bg-theme-surface-2 transition active:scale-95 touch-manipulation shrink-0"
              aria-label="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-theme-primary truncate max-w-[125px] xs:max-w-[200px] sm:max-w-none">
                  Central Administrativa
                </h1>
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  ADMIN
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-theme-muted truncate hidden sm:block">
                Curadoria global do dataset para IA de ICS e gestão de permissões
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={handleDownload}
              disabled={downloading || stats.totalPhotos === 0}
              className="btn-primary py-1.5 px-3 min-h-[38px] text-xs shrink-0 flex items-center gap-1.5 active:scale-95 touch-manipulation"
              title="Exportar dataset completo em ZIP"
              aria-label="Exportar dataset ZIP"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden xs:inline">
                {downloading ? 'Gerando…' : 'Exportar ZIP'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-3 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-emerald-500" /> Total Geral
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-theme-primary mt-1">
              {stats.totalAnimals}
            </p>
            <p className="text-[10px] sm:text-[11px] text-theme-secondary mt-0.5">
              Bovinos catalogados
            </p>
          </div>

          <div className="card p-3 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Dataset ICS
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.totalPhotos}
            </p>
            <p className="text-[10px] sm:text-[11px] text-theme-secondary mt-0.5">
              Fotos anatômicas
            </p>
          </div>

          <div className="card p-3 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-500" /> Operadores
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-theme-primary mt-1">
              {stats.totalUsers}
            </p>
            <p className="text-[10px] sm:text-[11px] text-theme-secondary mt-0.5">
              {stats.totalAdmins} com perfil admin
            </p>
          </div>

          <div className="card p-3 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-amber-500" /> Confiança Média
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-theme-primary mt-1">
              {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-theme-secondary mt-0.5">
              Fotos analisadas por IA
            </p>
          </div>
        </div>

        <div className="flex border-b border-theme mb-5 gap-2">
          <button
            onClick={() => setActiveTab('dataset')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'dataset'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <Database className="w-4 h-4" />
            Curadoria do Dataset ({stats.totalAnimals})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários & Permissões ({stats.totalUsers})
          </button>
        </div>

        {activeTab === 'dataset' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar por brinco, nome, raça ou operador…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="field-input pl-9 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-theme-secondary select-none cursor-pointer bg-theme-surface border border-theme px-3 py-2 rounded-lg">
                  <input
                    type="checkbox"
                    checked={onlyWithPhotos}
                    onChange={(e) => setOnlyWithPhotos(e.target.checked)}
                    className="accent-emerald-600 w-3.5 h-3.5"
                  />
                  Apenas com fotos
                </label>

                {stats.totalPhotos > 0 && (
                  <button
                    onClick={handleRecalibrateScores}
                    disabled={recalibrating}
                    className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 border-emerald-500/30 hover:border-emerald-500/50"
                    title="Recalcular confiança de todas as fotos usando o modelo de IA calibrado"
                  >
                    {recalibrating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span className="hidden sm:inline">
                      {recalibrating ? 'Recalculando…' : 'Recalcular Confiança'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredAnimals.length === 0 ? (
              <div className="card py-12 px-4 text-center text-xs text-theme-muted">
                Nenhum animal encontrado para o filtro aplicado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredAnimals.map((animal) => {
                  const photos = animal.photos ?? [];
                  const photoCount = photos.length;
                  const firstPhoto = photos[0];
                  const photoUrl = firstPhoto ? getPhotoUrl(firstPhoto.id) : null;

                  return (
                    <div
                      key={animal.id}
                      className="card p-3.5 flex gap-3.5 hover:border-emerald-500/50 transition-all items-center"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-theme-surface-2 border border-theme shrink-0 relative flex items-center justify-center">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={animal.tag}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Camera className="w-6 h-6 text-theme-muted opacity-40" />
                        )}
                        {photoCount > 1 && (
                          <span className="absolute bottom-1 right-1 bg-black/75 text-[9px] font-bold text-white px-1 py-0.5 rounded">
                            +{photoCount - 1}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono-tag text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 dark:bg-emerald-950 text-white dark:text-emerald-300">
                            {animal.tag}
                          </span>
                          <span className="text-xs font-extrabold text-theme-primary truncate">
                            {animal.name || animal.breed}
                          </span>
                        </div>

                        <p className="text-[11px] text-theme-secondary truncate">
                          {animal.breed} · {animal.sex} · {animal.weight}kg · {animal.age}m
                        </p>

                        <p className="text-[10px] text-theme-muted truncate mt-0.5">
                          Operador: <strong className="text-theme-secondary">{animal.owner?.name}</strong> ({animal.owner?.email})
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <Link
                            href={`/animal/${animal.id}`}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            Ver ficha <ExternalLink className="w-3 h-3" />
                          </Link>
                          {photoCount > 0 && (
                            <button
                              onClick={() => setPreviewAnimal(animal)}
                              className="text-[11px] font-bold text-theme-secondary hover:text-theme-primary inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Ver fotos ({photoCount})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar usuário por nome, e-mail ou cargo…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="field-input pl-9 text-xs sm:text-sm"
                />
              </div>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Adicionar / Promover Usuário</span>
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="card py-12 px-4 text-center text-xs text-theme-muted">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredUsers.map((target) => {
                  const isCurrentAdmin = target.role === 'ADMIN';
                  const isUpdating = updatingUserId === target.id;

                  return (
                    <div
                      key={target.id}
                      className="card p-4 flex flex-col justify-between hover:border-emerald-500/50 transition gap-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-theme-primary truncate flex items-center gap-1.5">
                              {target.name}
                              {target.isSelf && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  Você
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-theme-secondary truncate">{target.email}</p>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                              isCurrentAdmin
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-slate-500/10 text-theme-secondary border border-theme'
                            }`}
                          >
                            {isCurrentAdmin ? (
                              <ShieldCheck className="w-3 h-3" />
                            ) : (
                              <Users className="w-3 h-3" />
                            )}
                            {target.role}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-theme-muted mt-2">
                          <span>{target.animalsCount} animais</span>
                          <span>•</span>
                          <span>{target.photosCount} fotos enviadas</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
                        {!target.isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleRole(target)}
                              disabled={isUpdating}
                              className={`py-1.5 px-3 text-xs font-semibold rounded-md border transition flex items-center gap-1.5 ${
                                isCurrentAdmin
                                  ? 'bg-theme-surface hover:bg-theme-surface-2 border-theme text-theme-secondary'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                              }`}
                            >
                              {isUpdating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isCurrentAdmin ? (
                                <ShieldAlert className="w-3 h-3" />
                              ) : (
                                <ShieldCheck className="w-3 h-3" />
                              )}
                              <span>{isCurrentAdmin ? 'Rebaixar para Usuário' : 'Tornar Admin'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(target)}
                              disabled={isUpdating}
                              className="p-1.5 text-theme-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Adicionar / Promover Usuário */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-theme flex items-center justify-between">
              <h3 className="font-extrabold text-base text-theme-primary">
                Adicionar ou Promover Usuário
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1 rounded-md text-theme-muted hover:text-theme-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrPromoteUser} className="p-5 flex flex-col gap-4">
              <p className="text-xs text-theme-secondary">
                Se o e-mail já existir, o cargo será atualizado. Caso contrário, um novo usuário será criado.
              </p>

              <div>
                <label className="field-label">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="field-input"
                  placeholder="Nome do usuário"
                />
              </div>

              <div>
                <label className="field-label">E-mail</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="field-input"
                  placeholder="usuario@fazenda.com"
                />
              </div>

              <div>
                <label className="field-label">Senha (opcional se já cadastrado)</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="field-input"
                  placeholder="Senha para novo cadastro"
                />
              </div>

              <div>
                <label className="field-label">Perfil de Acesso</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'USER' | 'ADMIN')}
                  className="field-input"
                >
                  <option value="ADMIN">Administrador (Acesso total + Gestão de Usuários)</option>
                  <option value="USER">Operador de Campo (Apenas seus animais e fotos)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="btn-primary py-2 px-5 text-xs flex items-center gap-1.5"
                >
                  {savingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox para inspeção rápida de fotos do animal na tabela */}
      {previewAnimal && previewAnimal.photos && previewAnimal.photos.length > 0 && (
        <PhotoLightbox
          photos={previewAnimal.photos}
          initialIndex={0}
          onClose={() => setPreviewAnimal(null)}
        />
      )}

      <MobileNav />
    </div>
  );
}
