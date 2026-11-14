import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, AlertCircle, ArrowRight, UserPlus, LogIn } from 'lucide-react';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isLogin) {
        try {
          const userCred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          // Sync managedPassword so Coordinator can manage this user's password later if needed
          await setDoc(
            doc(db, 'users', userCred.user.uid),
            { managedPassword: password },
            { merge: true }
          );
          await refreshProfile();
          navigate('/');
        } catch (loginErr: any) {
          // Auto-provision test accounts if they don't exist yet
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
      } else {
        // New users registered from the login screen can ONLY have the 'teacher' (Professor) role
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: name.trim() });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || normalizedEmail,
          role: 'teacher',
          name: name.trim(),
          managedPassword: password,
          createdAt: new Date().toISOString(),
        });

        await refreshProfile();
        navigate('/');
      }
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setError('O login por e-mail/senha não está ativado no Firebase Console. Utilize o botão "Entrar com Google" abaixo.');
      } else if (err?.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err?.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
      } else if (isLogin) {
        setError('Credenciais inválidas. Verifique seu e-mail e senha ou entre com sua conta Google.');
      } else {
        setError(err.message || 'Erro ao criar conta. Verifique os dados fornecidos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        // New users signing up via Login screen default to 'teacher'
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          role: 'teacher',
          name: user.displayName || 'Professor',
          createdAt: new Date().toISOString(),
        });
      }
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('Não foi possível autenticar com o Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const setTestUser = (testRole: 'teacher' | 'coordinator') => {
    setIsLogin(true);
    setError('');
    setEmail(testRole === 'teacher' ? 'professor@escola.com' : 'coordenador@escola.com');
    setPassword('senha123');
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
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-colors"
                  placeholder="Seu nome"
                />
              </div>
            )}

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
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
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

            {!isLogin && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-700">
                  Perfil de Acesso: <span className="text-indigo-700 font-semibold">Professor</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Novos cadastros são criados exclusivamente como Professor. Apenas um Coordenador pode atribuir o perfil de Coordenador.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (isLogin ? 'Entrando...' : 'Criando conta...') : isLogin ? 'Entrar' : 'Criar Conta'}
              {!loading && (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
            </button>
          </form>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium py-3 rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Entrar com Google
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Fazer Login'}
              <ArrowRight size={16} />
            </button>
          </div>

          {isLogin && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500 mb-4 text-center">Preencher conta de teste</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTestUser('teacher')}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
                >
                  Professor
                </button>
                <button
                  type="button"
                  onClick={() => setTestUser('coordinator')}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
                >
                  Coordenador
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
