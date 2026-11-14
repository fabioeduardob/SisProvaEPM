import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  initializeApp,
  getApps,
  getApp,
} from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword,
  deleteUser,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from '../lib/firebase';
import { useAuth, UserProfile, UserRole } from '../contexts/AuthContext';
import {
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  ShieldCheck,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Edit,
  X,
} from 'lucide-react';

interface ManagedUser extends UserProfile {
  managedPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

function getSecondaryAuth() {
  const appName = 'SecondaryUserManagementApp';
  const existing = getApps().find(a => a.name === appName);
  const secondaryApp = existing ? getApp(appName) : initializeApp(firebaseConfig, appName);
  return getAuth(secondaryApp);
}

export function Users() {
  const { user: currentUser, refreshProfile } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Edit User / Role Modal State
  const [userToEdit, setUserToEdit] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('teacher');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Change Password Modal State
  const [userForPassword, setUserForPassword] = useState<ManagedUser | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Delete User Modal State
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('name'));
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs.map(d => ({
        ...(d.data() as ManagedUser),
        uid: d.id,
      }));
      setUsers(loaded);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      setFeedback({ type: 'error', message: 'Erro ao carregar a lista de usuários.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = newName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setFeedback({ type: 'error', message: 'Preencha o nome e o e-mail do usuário.' });
      return;
    }

    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'A senha deve possuir no mínimo 6 caracteres.' });
      return;
    }

    setSubmittingCreate(true);
    const secondaryAuth = getSecondaryAuth();

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, newPassword);
      const createdAuthUser = credential.user;
      await updateProfile(createdAuthUser, { displayName: trimmedName });

      const newUserDoc: ManagedUser = {
        uid: createdAuthUser.uid,
        name: trimmedName,
        email: trimmedEmail,
        role: newRole,
        managedPassword: newPassword,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', createdAuthUser.uid), newUserDoc);
      await signOut(secondaryAuth);

      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('teacher');
      setFeedback({
        type: 'success',
        message: `Usuário "${trimmedName}" (${newRole === 'coordinator' ? 'Coordenador' : 'Professor'}) cadastrado com sucesso!`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      if (err?.code === 'auth/email-already-in-use') {
        setFeedback({
          type: 'error',
          message: 'Este endereço de e-mail já está em uso por outra conta.',
        });
      } else if (err?.code === 'auth/invalid-email') {
        setFeedback({ type: 'error', message: 'O endereço de e-mail informado é inválido.' });
      } else {
        setFeedback({
          type: 'error',
          message: err?.message || 'Não foi possível cadastrar o usuário.',
        });
      }
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {
        // Ignore signOut error
      }
      setSubmittingCreate(false);
    }
  };

  const openEditModal = (u: ManagedUser) => {
    setFeedback(null);
    setUserToEdit(u);
    setEditName(u.name || '');
    setEditRole(u.role || 'teacher');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setFeedback(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'O nome do usuário não pode ficar vazio.' });
      return;
    }

    const isSelf = userToEdit.uid === currentUser?.uid;
    if (isSelf && editRole !== 'coordinator') {
      setFeedback({
        type: 'error',
        message: 'Por segurança, um coordenador não pode alterar o próprio perfil de acesso para Professor.',
      });
      return;
    }

    const safeRole: UserRole = isSelf ? 'coordinator' : editRole;

    setSubmittingEdit(true);
    try {
      await updateDoc(doc(db, 'users', userToEdit.uid), {
        name: trimmedName,
        role: safeRole,
        updatedAt: new Date().toISOString(),
      });

      if (isSelf) {
        await refreshProfile();
      }

      setFeedback({
        type: 'success',
        message: `Dados de "${trimmedName}" atualizados com sucesso.`,
      });
      setUserToEdit(null);
      await fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar as alterações do usuário.' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleQuickRoleChange = async (targetUser: ManagedUser, nextRole: UserRole) => {
    setFeedback(null);
    if (targetUser.role === nextRole) return;

    if (targetUser.uid === currentUser?.uid) {
      setFeedback({
        type: 'error',
        message: 'Por segurança, você não pode modificar o seu próprio perfil de acesso para Professor.',
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: nextRole,
        updatedAt: new Date().toISOString(),
      });

      setUsers(prev =>
        prev.map(u => (u.uid === targetUser.uid ? { ...u, role: nextRole } : u))
      );

      setFeedback({
        type: 'success',
        message: `Perfil de "${targetUser.name}" alterado para ${
          nextRole === 'coordinator' ? 'Coordenador' : 'Professor'
        }.`,
      });
    } catch (error) {
      console.error('Erro ao alterar perfil:', error);
      setFeedback({ type: 'error', message: 'Não foi possível alterar o perfil do usuário.' });
    }
  };

  const openPasswordModal = (u: ManagedUser) => {
    setFeedback(null);
    setUserForPassword(u);
    setPasswordValue('');
    setPasswordConfirm('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForPassword) return;
    setFeedback(null);

    if (passwordValue.length < 6) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (passwordValue !== passwordConfirm) {
      setFeedback({ type: 'error', message: 'A confirmação de senha não confere.' });
      return;
    }

    setSubmittingPassword(true);
    const secondaryAuth = getSecondaryAuth();

    try {
      // 1. If changing own password, update on currentUser if possible
      if (userForPassword.uid === auth.currentUser?.uid && auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, passwordValue);
        } catch {
          // If requires-recent-login, try via secondaryAuth with managedPassword
          if (userForPassword.managedPassword && userForPassword.email) {
            const cred = await signInWithEmailAndPassword(
              secondaryAuth,
              userForPassword.email,
              userForPassword.managedPassword
            );
            await updatePassword(cred.user, passwordValue);
            await signOut(secondaryAuth);
          }
        }
      } else if (userForPassword.managedPassword && userForPassword.email) {
        // 2. Update in Firebase Auth via secondaryAuth using the stored password
        try {
          const cred = await signInWithEmailAndPassword(
            secondaryAuth,
            userForPassword.email,
            userForPassword.managedPassword
          );
          await updatePassword(cred.user, passwordValue);
          await signOut(secondaryAuth);
        } catch {
          // If Firebase Auth password differed or account was created before managedPassword,
          // Firestore managedPassword will still be updated and synced on next login
        }
      }

      // 3. Persist updated password in Firestore user document
      await updateDoc(doc(db, 'users', userForPassword.uid), {
        managedPassword: passwordValue,
        updatedAt: new Date().toISOString(),
      });

      setUsers(prev =>
        prev.map(u =>
          u.uid === userForPassword.uid ? { ...u, managedPassword: passwordValue } : u
        )
      );

      setFeedback({
        type: 'success',
        message: `Senha de "${userForPassword.name}" alterada com sucesso!`,
      });
      setUserForPassword(null);
      setPasswordValue('');
      setPasswordConfirm('');
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setFeedback({ type: 'error', message: 'Não foi possível alterar a senha do usuário.' });
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {
        // Ignore
      }
      setSubmittingPassword(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setFeedback(null);

    if (userToDelete.uid === currentUser?.uid) {
      setFeedback({
        type: 'error',
        message: 'Você não pode excluir sua própria conta enquanto estiver conectado.',
      });
      setUserToDelete(null);
      return;
    }

    setSubmittingDelete(true);
    const secondaryAuth = getSecondaryAuth();

    try {
      // Remove from Firebase Auth if we have managed credentials
      if (userToDelete.managedPassword && userToDelete.email) {
        try {
          const cred = await signInWithEmailAndPassword(
            secondaryAuth,
            userToDelete.email,
            userToDelete.managedPassword
          );
          await deleteUser(cred.user);
        } catch {
          // Ignore if already removed or external provider
        }
      }

      await deleteDoc(doc(db, 'users', userToDelete.uid));
      setUsers(prev => prev.filter(u => u.uid !== userToDelete.uid));
      setFeedback({
        type: 'success',
        message: `Usuário "${userToDelete.name}" excluído com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir o usuário.' });
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {
        // Ignore
      }
      setSubmittingDelete(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchText =
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);
    const matchRole = filterRole ? u.role === filterRole : true;
    return matchText && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gerenciamento de Usuários</h1>
          <p className="text-slate-500 mt-1">
            Cadastre novos usuários, altere senhas, modifique perfis de acesso e gerencie contas.
          </p>
        </div>
        <button
          onClick={() => {
            setFeedback(null);
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewRole('teacher');
            setShowCreateModal(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <UserPlus size={20} />
          Novo Usuário
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline opacity-80 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Barra de busca e filtro */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 bg-slate-50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar usuário por nome ou e-mail..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os Perfis</option>
            <option value="teacher">Professores</option>
            <option value="coordinator">Coordenadores</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando usuários...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Nome</th>
                  <th className="px-6 py-4 font-medium">E-mail</th>
                  <th className="px-6 py-4 font-medium">Perfil de Acesso</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map(u => {
                  const isSelf = u.uid === currentUser?.uid;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{u.name || 'Sem nome'}</span>
                          {isSelf && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                              Você
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              u.role === 'coordinator'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {u.role === 'coordinator' ? (
                              <ShieldCheck size={14} />
                            ) : (
                              <GraduationCap size={14} />
                            )}
                            {u.role === 'coordinator' ? 'Coordenador' : 'Professor'}
                          </span>
                          {!isSelf && (
                            <select
                              value={u.role}
                              onChange={e =>
                                handleQuickRoleChange(u, e.target.value as UserRole)
                              }
                              title="Modificar tipo de perfil do usuário"
                              className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="teacher">Professor</option>
                              <option value="coordinator">Coordenador</option>
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                            title="Editar nome e perfil"
                          >
                            <Edit size={15} />
                            Editar
                          </button>
                          <button
                            onClick={() => openPasswordModal(u)}
                            className="px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1"
                            title="Alterar senha do usuário"
                          >
                            <KeyRound size={15} />
                            Alterar Senha
                          </button>
                          <button
                            onClick={() => setUserToDelete(u)}
                            disabled={isSelf}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              isSelf
                                ? 'Não é possível excluir a própria conta em uso'
                                : 'Excluir usuário'
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Nenhum usuário encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Cadastrar Novo Usuário */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Cadastrar Novo Usuário</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  placeholder="Ex: Maria Silva"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  placeholder="usuario@escola.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha Inicial
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="teacher">Professor</option>
                  <option value="coordinator">Coordenador</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submittingCreate ? 'Cadastrando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuário / Perfil */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Editar Usuário</h3>
              <button
                onClick={() => setUserToEdit(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={userToEdit.email}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as UserRole)}
                  disabled={userToEdit.uid === currentUser?.uid}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="teacher">Professor</option>
                  <option value="coordinator">Coordenador</option>
                </select>
                {userToEdit.uid === currentUser?.uid && (
                  <p className="text-xs text-slate-500 mt-1">
                    Por segurança, você não pode alterar seu próprio perfil de Coordenador para Professor.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submittingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Alterar Senha */}
      {userForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-slate-900">Alterar Senha</h3>
              <button
                onClick={() => setUserForPassword(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Definindo nova senha para <strong>{userForPassword.name}</strong> ({userForPassword.email}).
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordValue}
                  onChange={e => setPasswordValue(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUserForPassword(null)}
                  className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="px-4 py-2 bg-amber-600 text-white font-medium hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submittingPassword ? 'Alterando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Usuário */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Usuário</h3>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir o usuário <strong>{userToDelete.name}</strong> ({userToDelete.email})? Esta ação removerá o acesso e o cadastro do usuário permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={submittingDelete}
                className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {submittingDelete ? 'Excluindo...' : 'Sim, Excluir Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
