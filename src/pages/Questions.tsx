import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Subject } from './Subjects';

export type QuestionType = 'multiple_choice' | 'true_false' | 'discursive';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  text: string;
  subject: string;
  topic: string;
  type: QuestionType;
  difficulty: Difficulty;
  options?: string[];
  correctAnswer: string | boolean | string[];
}

export function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // Form State
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [type, setType] = useState<QuestionType>('multiple_choice');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<string | string[]>('0');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sq = query(collection(db, 'subjects'), orderBy('name'));
        const sSnap = await getDocs(sq);
        const subData = sSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }));
        setSubjects(subData);
        if (subData.length > 0) {
          setSubject(subData[0].name);
        }

        const q = query(collection(db, 'questions'), orderBy('subject'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) }));
        setQuestions(data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setFeedback({ type: 'error', message: 'Erro ao carregar o banco de questões.' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    if (newType === 'multiple_choice') {
      setCorrectAnswer('0');
    } else if (newType === 'true_false') {
      setCorrectAnswer(['true', 'true', 'true', 'true']);
    } else {
      setCorrectAnswer('');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    if (subjects.length > 0) {
      setSubject(subjects[0].name);
    }
    setText('');
    setType('multiple_choice');
    setDifficulty('medium');
    setOptions(['', '', '', '']);
    setCorrectAnswer('0');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!subject) {
      setFeedback({ type: 'error', message: 'Por favor, cadastre uma disciplina primeiro.' });
      return;
    }

    if (!text.trim()) {
      setFeedback({ type: 'error', message: 'O enunciado da questão não pode estar vazio.' });
      return;
    }

    try {
      const parsedIndex = typeof correctAnswer === 'string' ? parseInt(correctAnswer, 10) : 0;
      const safeIndex = !Number.isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < options.length ? parsedIndex : 0;

      const newQuestion: Record<string, unknown> = {
        subject,
        text: text.trim(),
        type,
        difficulty,
        topic: 'Geral',
      };

      if (type === 'multiple_choice') {
        const trimmedOptions = options.map(o => o.trim());
        newQuestion.options = trimmedOptions;
        newQuestion.correctAnswer = trimmedOptions[safeIndex] || '';
      } else if (type === 'true_false') {
        newQuestion.options = options.map(o => o.trim());
        newQuestion.correctAnswer = Array.isArray(correctAnswer)
          ? correctAnswer
          : ['true', 'true', 'true', 'true'];
      } else {
        newQuestion.correctAnswer = typeof correctAnswer === 'string' ? correctAnswer.trim() : '';
      }

      if (editingId) {
        await updateDoc(doc(db, 'questions', editingId), newQuestion);
        setFeedback({ type: 'success', message: 'Questão atualizada com sucesso!' });
      } else {
        await addDoc(collection(db, 'questions'), newQuestion);
        setFeedback({ type: 'success', message: 'Questão adicionada com sucesso!' });
      }

      setShowForm(false);
      resetForm();

      const q = query(collection(db, 'questions'), orderBy('subject'));
      const snapshot = await getDocs(q);
      setQuestions(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) })));
    } catch (error) {
      console.error('Error saving question:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar a questão.' });
    }
  };

  const handleEdit = (q: Question) => {
    setFeedback(null);
    setEditingId(q.id);
    setSubject(q.subject);
    setText(q.text);
    setType(q.type);
    setDifficulty(q.difficulty);
    if (q.type === 'multiple_choice' && q.options) {
      setOptions(q.options);
      const cIndex = q.options.indexOf(q.correctAnswer as string);
      setCorrectAnswer(cIndex !== -1 ? cIndex.toString() : '0');
    } else if (q.type === 'true_false') {
      if (q.options && q.options.length > 0) {
        setOptions(q.options);
        setCorrectAnswer(
          Array.isArray(q.correctAnswer) ? q.correctAnswer : ['true', 'true', 'true', 'true']
        );
      } else {
        setOptions(['', '', '', '']);
        setCorrectAnswer(['true', 'true', 'true', 'true']);
      }
    } else {
      setOptions(['', '', '', '']);
      setCorrectAnswer(typeof q.correctAnswer === 'string' ? q.correctAnswer : '');
    }
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    setFeedback(null);
    try {
      await deleteDoc(doc(db, 'questions', questionToDelete));
      setQuestions(questions.filter(q => q.id !== questionToDelete));
      setFeedback({ type: 'success', message: 'Questão excluída com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir a questão.' });
    } finally {
      setQuestionToDelete(null);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchSearch = (q.text || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchSubject = filterSubject ? q.subject === filterSubject : true;
    const matchType = filterType ? q.type === filterType : true;
    const matchDifficulty = filterDifficulty ? q.difficulty === filterDifficulty : true;
    return matchSearch && matchSubject && matchType && matchDifficulty;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Banco de Questões</h1>
          <p className="text-slate-500 mt-1">Gerencie as questões para a geração de provas.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setFeedback(null);
            setShowForm(!showForm);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Nova Questão
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
            {editingId ? 'Editar Questão' : 'Adicionar Questão'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Disciplina</label>
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {subjects.length === 0 && <option value="">Cadastre disciplinas primeiro</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={e => handleTypeChange(e.target.value as QuestionType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="multiple_choice">Múltipla Escolha</option>
                  <option value="true_false">Verdadeiro/Falso</option>
                  <option value="discursive">Discursiva</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dificuldade</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as Difficulty)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="easy">Fácil</option>
                  <option value="medium">Média</option>
                  <option value="hard">Difícil</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enunciado da Questão</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
              />
            </div>

            {type === 'multiple_choice' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Alternativas (Selecione a correta)
                </label>
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={correctAnswer === i.toString()}
                      onChange={() => setCorrectAnswer(i.toString())}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }}
                      required
                      placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {type === 'true_false' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Afirmações (Marque V ou F para o gabarito)
                </label>
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <select
                      value={
                        Array.isArray(correctAnswer) && correctAnswer[i] !== undefined
                          ? correctAnswer[i]
                          : 'true'
                      }
                      onChange={e => {
                        const newAns = Array.isArray(correctAnswer)
                          ? [...correctAnswer]
                          : ['true', 'true', 'true', 'true'];
                        newAns[i] = e.target.value;
                        setCorrectAnswer(newAns);
                      }}
                      className="px-2 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="true">V</option>
                      <option value="false">F</option>
                    </select>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }}
                      required
                      placeholder={`Afirmação ${i + 1}`}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {type === 'discursive' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Padrão de Resposta / Palavras-chave
                </label>
                <textarea
                  value={typeof correctAnswer === 'string' ? correctAnswer : ''}
                  onChange={e => setCorrectAnswer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {editingId ? 'Salvar Alterações' : 'Salvar Questão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar questões pelo enunciado..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
            }`}
          >
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Disciplina</label>
              <select
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todos</option>
                <option value="multiple_choice">Múltipla Escolha</option>
                <option value="true_false">Verdadeiro/Falso</option>
                <option value="discursive">Discursiva</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Dificuldade</label>
              <select
                value={filterDifficulty}
                onChange={e => setFilterDifficulty(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas</option>
                <option value="easy">Fácil</option>
                <option value="medium">Média</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterSubject('');
                  setFilterType('');
                  setFilterDifficulty('');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Disciplina</th>
                <th className="px-6 py-4 font-medium">Enunciado</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Dificuldade</th>
                <th className="px-6 py-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredQuestions.map(q => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{q.subject}</td>
                  <td className="px-6 py-4 text-slate-700 max-w-md truncate">{q.text}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {q.type === 'multiple_choice'
                      ? 'Múltipla Escolha'
                      : q.type === 'true_false'
                      ? 'V/F'
                      : 'Discursiva'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        q.difficulty === 'easy'
                          ? 'bg-green-100 text-green-700'
                          : q.difficulty === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {q.difficulty === 'easy'
                        ? 'Fácil'
                        : q.difficulty === 'medium'
                        ? 'Média'
                        : 'Difícil'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar Questão"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setQuestionToDelete(q.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Questão"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma questão encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Questão</h3>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir esta questão? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setQuestionToDelete(null)}
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
