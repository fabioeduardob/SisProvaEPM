import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, AlertCircle, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Exams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setExams(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching exams:', error);
      setErrorMsg('Erro ao carregar as provas.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    setErrorMsg(null);
    try {
      await deleteDoc(doc(db, 'exams', examToDelete));
      setExams(exams.filter(e => e.id !== examToDelete));
    } catch (error) {
      console.error('Erro ao excluir prova:', error);
      setErrorMsg('Erro ao excluir a prova.');
    } finally {
      setExamToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Provas</h1>
          <p className="text-slate-500 mt-1">Gerencie, gere e exporte provas e gabaritos em PDF.</p>
        </div>
        <button
          onClick={() => navigate('/exams/new')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Nova Prova
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline">
            Fechar
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-500">Carregando provas...</div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-slate-500 mb-4">Nenhuma prova gerada ainda.</p>
          <button
            onClick={() => navigate('/exams/new')}
            className="text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
          >
            Criar sua primeira prova
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{exam.title}</h3>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600 mb-6">
                <p>
                  <strong>Turma:</strong> {exam.klass || 'Não informada'}
                </p>
                <p>
                  <strong>Questões:</strong> {exam.questionsCount ?? (exam.questionIds?.length || 0)}
                </p>
                <p>
                  <strong>Data de Geração:</strong>{' '}
                  {exam.createdAt && !Number.isNaN(Date.parse(exam.createdAt))
                    ? new Date(exam.createdAt).toLocaleDateString('pt-BR')
                    : '-'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => navigate(`/exams/edit/${exam.id}`)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex justify-center items-center gap-1.5"
                >
                  <Edit size={16} /> Editar
                </button>
                <button
                  onClick={() => navigate(`/exams/edit/${exam.id}?tab=gabarito`)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex justify-center items-center gap-1.5"
                  title="Visualizar e imprimir o gabarito desta prova"
                >
                  <ClipboardCheck size={16} /> Gabarito
                </button>
                <button
                  onClick={() => setExamToDelete(exam.id)}
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex justify-center items-center gap-1.5"
                  title="Excluir prova"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Prova</h3>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir esta prova? Esta ação não pode ser desfeita e a prova será removida permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setExamToDelete(null)}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition-colors"
              >
                Sim, Excluir Prova
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
