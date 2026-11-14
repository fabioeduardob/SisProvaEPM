import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Edit, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface Subject {
  id: string;
  name: string;
}

export function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const q = query(collection(db, 'subjects'), orderBy('name'));
      const snapshot = await getDocs(q);
      setSubjects(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) })));
    } catch (error) {
      console.error('Error fetching subjects:', error);
      setFeedback({ type: 'error', message: 'Erro ao carregar disciplinas.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'Informe um nome válido para a disciplina.' });
      return;
    }

    const duplicate = subjects.find(
      s => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingId
    );
    if (duplicate) {
      setFeedback({ type: 'error', message: 'Já existe uma disciplina cadastrada com este nome.' });
      return;
    }

    try {
      if (editingId) {
        const previousSubject = subjects.find(s => s.id === editingId);
        await updateDoc(doc(db, 'subjects', editingId), { name: trimmedName });

        // Keep questions and exams in sync when renaming a subject
        if (previousSubject && previousSubject.name !== trimmedName) {
          const batch = writeBatch(db);
          const qSnap = await getDocs(
            query(collection(db, 'questions'), where('subject', '==', previousSubject.name))
          );
          qSnap.docs.forEach(qDoc => {
            batch.update(qDoc.ref, { subject: trimmedName });
          });

          const eSnap = await getDocs(
            query(collection(db, 'exams'), where('subject', '==', previousSubject.name))
          );
          eSnap.docs.forEach(eDoc => {
            batch.update(eDoc.ref, { subject: trimmedName });
          });

          await batch.commit();
        }
        setFeedback({ type: 'success', message: 'Disciplina atualizada com sucesso!' });
      } else {
        await addDoc(collection(db, 'subjects'), { name: trimmedName });
        setFeedback({ type: 'success', message: 'Disciplina adicionada com sucesso!' });
      }
      setShowForm(false);
      setEditingId(null);
      setName('');
      await fetchSubjects();
    } catch (error) {
      console.error('Error saving subject:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar a disciplina.' });
    }
  };

  const handleEdit = (subject: Subject) => {
    setFeedback(null);
    setName(subject.name);
    setEditingId(subject.id);
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!subjectToDelete) return;
    setFeedback(null);
    try {
      await deleteDoc(doc(db, 'subjects', subjectToDelete.id));
      setFeedback({ type: 'success', message: 'Disciplina excluída com sucesso.' });
      await fetchSubjects();
    } catch (error) {
      console.error('Error deleting subject:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir a disciplina.' });
    } finally {
      setSubjectToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Disciplinas</h1>
          <p className="text-slate-500 mt-1">Gerencie as disciplinas da instituição.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setName('');
            setFeedback(null);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Nova Disciplina
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

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {editingId ? 'Editar Disciplina' : 'Adicionar Disciplina'}
          </h2>
          <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Disciplina</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Ex: Matemática"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setName('');
                }}
                className="px-6 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg font-medium transition-colors h-[42px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors h-[42px]"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Nome da Disciplina</th>
                <th className="px-6 py-4 font-medium w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjects.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{sub.name}</td>
                  <td className="px-6 py-4 flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(sub)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar Disciplina"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => setSubjectToDelete(sub)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir Disciplina"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma disciplina cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Disciplina</h3>
            <p className="text-slate-600 mb-6">
              Deseja realmente excluir a disciplina <strong>{subjectToDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSubjectToDelete(null)}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition-colors"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
