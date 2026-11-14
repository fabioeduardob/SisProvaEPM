import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Settings() {
  const [passingGrade, setPassingGrade] = useState('7.0');
  const [gradingSystem, setGradingSystem] = useState('numeric');
  const [schoolName, setSchoolName] = useState('MARINHA DO BRASIL');
  const [printLayout, setPrintLayout] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.passingGrade) setPassingGrade(data.passingGrade);
          if (data.gradingSystem) setGradingSystem(data.gradingSystem);
          if (data.schoolName) setSchoolName(data.schoolName);
          if (data.printLayout) setPrintLayout(data.printLayout);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'settings', 'general'),
        {
          passingGrade,
          gradingSystem,
          schoolName: schoolName.trim(),
          printLayout,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setFeedback({ type: 'success', message: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar as configurações.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-slate-500">Carregando configurações...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Configurações do Sistema</h1>
        <p className="text-slate-500 mt-1">Personalize os parâmetros de avaliação e impressão.</p>
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

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">
            Parâmetros de Avaliação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Média para Aprovação
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={passingGrade}
                onChange={(e) => setPassingGrade(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sistema de Notas
              </label>
              <select
                value={gradingSystem}
                onChange={(e) => setGradingSystem(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="numeric">Numérico (0 a 10)</option>
                <option value="conceptual">Conceitual (A, B, C, D)</option>
                <option value="percentage">Percentual (0% a 100%)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">
            Personalização de Provas (Exportação PDF)
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nome da Instituição (Cabeçalho)
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Layout de Impressão
              </label>
              <select
                value={printLayout}
                onChange={(e) => setPrintLayout(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="standard">Padrão (1 coluna, fonte 12pt)</option>
                <option value="compact">Compacto (2 colunas, fonte 10pt)</option>
                <option value="large">Acessibilidade (1 coluna, fonte 14pt)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60"
          >
            <Save size={20} />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}
