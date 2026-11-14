import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  LogIn,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

export function Login() {
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      try {
        const userCred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await setDoc(
          doc(db, 'users', userCred.user.uid),
          { managedPassword: password },
          { merge: true }
        );
        await refreshProfile();
        navigate('/');
      } catch (loginErr: any) {
        // Auto-provision default test accounts if they don't exist yet
        const isTestTeacher = normalizedEmail === 'professor@escola.com' && password === 'senha123';
        const isTestCoordinator = normalizedEmail === 'coordenador@escola.com' && password === 'senha123';

        if (
          (isTestTeacher || isTestCoordinator) &&
          (loginErr?.code === 'auth/user-not-found' ||
            loginErr?.code === 'auth/invalid-credential' ||
            loginErr?.code === 'auth/invalid-login-credentials')
        ) {
          const testRole = isTestCoordinator ? 'coordinator' : 'teacher';
          const testName = isTestCoordinator ? 'Coordenador Teste' : 'Professor Teste';
          const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          const user = userCredential.user;
          await updateProfile(user, { displayName: testName });
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email || normalizedEmail,
            role: testRole,
            name: testName,
            managedPassword: password,
            createdAt: new Date().toISOString(),
          });
          await refreshProfile();
          navigate('/');
          return;
        }
        throw loginErr;
      }
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setError('O login por e-mail/senha não está ativado no Firebase Console.');
      } else if (err?.code === 'auth/too-many-requests') {
        setError('Muitas tentativas de login. Aguarde alguns instantes ou redefina sua senha.');
      } else {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Por favor, informe o seu e-mail cadastrado.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSuccessMessage(
        'E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada e a pasta de spam.'
      );
    } catch (err: any) {
      if (err?.code === 'auth/invalid-email') {
        setError('O endereço de e-mail informado é inválido.');
      } else if (err?.code === 'auth/user-not-found') {
        setError('Não foi encontrado nenhum usuário cadastrado com este e-mail.');
      } else {
        setError('Não foi possível enviar o e-mail de recuperação. Tente novamente ou contate o Coordenador.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SisProvaEPM</h1>
          <p className="text-indigo-100 mt-2">Sistema de Gestão de Avaliações</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3 mb-5 border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg flex items-center gap-3 mb-5 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm">{successMessage}</p>
            </div>
          )}

          {!isResetMode ? (
            <>
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Senha</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setError('');
                        setSuccessMessage('');
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                  {!loading && <LogIn size={20} />}
                </button>
              </form>

              <p className="mt-5 text-xs text-center text-slate-500">
                O cadastro de novos usuários é realizado exclusivamente pela Coordenação.
              </p>
            </>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recuperar Senha</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Informe o seu e-mail cadastrado para receber o link de redefinição de senha.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">E-mail cadastrado</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-colors"
                  placeholder="seu@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                <KeyRound size={18} />
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setError('');
                  setSuccessMessage('');
                }}
                className="w-full py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={16} />
                Voltar para o Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
