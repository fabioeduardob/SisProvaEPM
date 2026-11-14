import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, Save, AlertCircle, CheckCircle2, ClipboardCheck, Eye } from 'lucide-react';
import { exportExamToPdf, exportAnswerKeyToPdf } from '../lib/pdfExport';
import { Subject } from './Subjects';
import { Question } from './Questions';

const DEFAULT_INSTRUCTIONS = `1) A prova terá duração de uma (1) hora
2) Não é permitido, durante a prova, a troca de ideias ou sinais
3) A compreensão dos quesitos formulados faz parte da avaliação da Prova
4) A prova não deverá ser rasurada
5) Só existe uma única resposta certa
6) A prova deverá ser feita a caneta (preta ou azul)
7) A prova contém vinte (20) questões, confiram para se Certificarem de que não está faltando nenhuma questão
8) Aguarde a ordem para começar a prova
9) Boa sorte!`;

function getMultipleChoiceAnswer(q: Question): { letter: string; text: string; index: number } {
  const options = Array.isArray(q.options) ? q.options : [];
  const rawAns = String(q.correctAnswer ?? '').trim();

  const idxByText = options.findIndex(opt => String(opt).trim() === rawAns);
  if (idxByText !== -1) {
    return {
      letter: String.fromCharCode(65 + idxByText),
      text: options[idxByText],
      index: idxByText,
    };
  }

  const parsedIdx = parseInt(rawAns, 10);
  if (!Number.isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < options.length) {
    return {
      letter: String.fromCharCode(65 + parsedIdx),
      text: options[parsedIdx],
      index: parsedIdx,
    };
  }

  return {
    letter: rawAns || '-',
    text: rawAns || 'Não definida',
    index: -1,
  };
}

function getTrueFalseAnswers(q: Question): ('V' | 'F')[] {
  const optionsCount = Array.isArray(q.options) && q.options.length > 0 ? q.options.length : 4;
  if (Array.isArray(q.correctAnswer)) {
    return Array.from({ length: optionsCount }, (_, i) => {
      const val = q.correctAnswer[i];
      return val === 'true' || val === true || val === 'V' ? 'V' : 'F';
    });
  }
  const singleVal = q.correctAnswer === 'true' || q.correctAnswer === true || q.correctAnswer === 'V' ? 'V' : 'F';
  return [singleVal];
}

export function NewExam() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [title, setTitle] = useState('PROVA');
  const [subject, setSubject] = useState('');
  const [klass, setKlass] = useState('___/2026');
  const [institution, setInstitution] = useState('MARINHA DO BRASIL');
  const [subInstitution, setSubInstitution] = useState('AGÊNCIA DA CAPITANIA DOS PORTOS EM TRAMANDAÍ');
  const [course, setCourse] = useState(
    'CURSO ESPECIAL PARA TRIPULAÇÃO DE EMBARCAÇÃO DE ESTADO NO SERVIÇO PÚBLICO (ETSP)'
  );
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingAnswerKey, setGeneratingAnswerKey] = useState(false);
  const [previewMode, setPreviewMode] = useState<'exam' | 'answer_key'>(
    searchParams.get('tab') === 'gabarito' ? 'answer_key' : 'exam'
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const navigate = useNavigate();

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
        const qSnap = await getDocs(q);
        const allQuestions = qSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) }));
        setQuestions(allQuestions);

        if (id) {
          const examDoc = await getDoc(doc(db, 'exams', id));
          if (examDoc.exists()) {
            const examData = examDoc.data();
            setTitle(examData.title || 'PROVA');
            setSubject(examData.subject || (subData.length > 0 ? subData[0].name : ''));
            setKlass(examData.klass || '___/2026');
            setInstitution(examData.institution || 'MARINHA DO BRASIL');
            setSubInstitution(examData.subInstitution || 'AGÊNCIA DA CAPITANIA DOS PORTOS EM TRAMANDAÍ');
            setCourse(
              examData.course ||
                'CURSO ESPECIAL PARA TRIPULAÇÃO DE EMBARCAÇÃO DE ESTADO NO SERVIÇO PÚBLICO (ETSP)'
            );
            setInstructions(examData.instructions || DEFAULT_INSTRUCTIONS);
            const existingIds = Array.isArray(examData.questionIds) ? examData.questionIds : [];
            const validIds = existingIds.filter((qId: string) => allQuestions.some(aq => aq.id === qId));
            setSelectedQuestions(validIds);
          }
        } else {
          try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
            if (settingsDoc.exists()) {
              const sData = settingsDoc.data();
              if (sData.schoolName) {
                setInstitution(sData.schoolName);
              }
            }
          } catch {
            // Ignore settings fetch error if not configured
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setFeedback({ type: 'error', message: 'Erro ao carregar dados para geração da prova.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const toggleQuestion = (qId: string) => {
    setSelectedQuestions(prev =>
      prev.includes(qId) ? prev.filter(item => item !== qId) : [...prev, qId]
    );
  };

  const validSelectedQuestions = selectedQuestions
    .map(qId => questions.find(x => x.id === qId))
    .filter((q): q is Question => Boolean(q));

  const isExamReady = Boolean(title.trim()) && validSelectedQuestions.length > 0;

  const handleSaveExam = async () => {
    setFeedback(null);
    if (!isExamReady) {
      setFeedback({
        type: 'error',
        message: 'Preencha o título da prova e selecione pelo menos uma questão.',
      });
      return;
    }

    setSaving(true);
    try {
      const validIds = validSelectedQuestions.map(q => q.id);
      const examData = {
        title: title.trim(),
        subject,
        klass: klass.trim(),
        institution: institution.trim(),
        subInstitution: subInstitution.trim(),
        course: course.trim(),
        instructions,
        questionsCount: validIds.length,
        questionIds: validIds,
        updatedAt: new Date().toISOString(),
      };

      if (id) {
        await updateDoc(doc(db, 'exams', id), examData);
        setFeedback({ type: 'success', message: 'Prova atualizada com sucesso!' });
      } else {
        await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: new Date().toISOString(),
        });
        navigate('/exams');
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setFeedback({ type: 'error', message: 'Houve um erro ao salvar a prova.' });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    setFeedback(null);
    if (!isExamReady) {
      setFeedback({
        type: 'error',
        message: 'Preencha o título da prova e selecione pelo menos uma questão antes de gerar o PDF.',
      });
      return;
    }

    setGeneratingPdf(true);
    try {
      if (previewMode !== 'exam') {
        setPreviewMode('exam');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const examElement = document.getElementById('exam-preview');
      if (!examElement) return;

      await exportExamToPdf(examElement, `${title.trim().replace(/\s+/g, '_')}.pdf`);
      setFeedback({ type: 'success', message: 'PDF da prova gerado com sucesso!' });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setFeedback({ type: 'error', message: 'Houve um erro ao gerar o arquivo PDF da prova.' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleGenerateAnswerKeyPDF = async () => {
    setFeedback(null);
    if (!isExamReady) {
      setFeedback({
        type: 'error',
        message: 'A prova precisa estar pronta (com título e pelo menos uma questão selecionada) para imprimir o gabarito.',
      });
      return;
    }

    setGeneratingAnswerKey(true);
    try {
      if (previewMode !== 'answer_key') {
        setPreviewMode('answer_key');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const answerKeyElement = document.getElementById('answer-key-preview');
      if (!answerKeyElement) return;

      await exportAnswerKeyToPdf(
        answerKeyElement,
        `${title.trim().replace(/\s+/g, '_')}_Gabarito.pdf`
      );
      setFeedback({ type: 'success', message: 'Gabarito da prova gerado com sucesso!' });
    } catch (err) {
      console.error('Erro ao gerar Gabarito PDF:', err);
      setFeedback({ type: 'error', message: 'Houve um erro ao gerar o PDF do gabarito.' });
    } finally {
      setGeneratingAnswerKey(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-slate-500">Carregando...</div>;
  }

  const filteredQuestions = subject
    ? questions.filter(q => q.subject === subject)
    : questions;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {id ? 'Editar Prova' : 'Gerador de Prova'}
          </h1>
          <p className="text-slate-500 mt-1">
            Configure o cabeçalho, selecione as questões e gere a prova ou o gabarito oficial.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/exams')}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveExam}
            disabled={saving}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            <Save size={20} />
            {saving ? 'Salvando...' : 'Salvar Prova'}
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={generatingPdf || !isExamReady}
            title={!isExamReady ? 'Selecione ao menos uma questão para gerar a prova' : 'Exportar prova em PDF'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={20} />
            {generatingPdf ? 'Gerando Prova...' : 'Gerar PDF'}
          </button>
          <button
            onClick={handleGenerateAnswerKeyPDF}
            disabled={generatingAnswerKey || !isExamReady}
            title={
              !isExamReady
                ? 'Finalize a seleção de questões da prova para liberar a impressão do gabarito'
                : 'Exportar gabarito oficial da prova em PDF'
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <ClipboardCheck size={20} />
            {generatingAnswerKey ? 'Gerando Gabarito...' : 'Imprimir Gabarito'}
          </button>
        </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Formulário e Seleção */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Capa da prova</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Instituição (Linha 1)
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: MARINHA DO BRASIL"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sub-Instituição (Linha 2)
                </label>
                <input
                  type="text"
                  value={subInstitution}
                  onChange={e => setSubInstitution(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: AGÊNCIA DA CAPITANIA DOS PORTOS..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo / Título da Prova
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: PROVA"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Curso / Descrição
                </label>
                <input
                  type="text"
                  value={course}
                  onChange={e => setCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: CURSO ESPECIAL PARA..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Disciplina (Filtro de Questões)
                </label>
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
                  <option value="">Todas as disciplinas</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Filtra as questões abaixo.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Turma</label>
                <input
                  type="text"
                  value={klass}
                  onChange={e => setKlass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: ___/2026"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Instruções</label>
                <textarea
                  rows={6}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Instruções para o aluno..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">Seleção de Questões</h2>
              <span className="text-sm font-medium bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                {validSelectedQuestions.length} Selecionada(s)
              </span>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  Nenhuma questão cadastrada para a disciplina selecionada.
                </div>
              ) : (
                filteredQuestions.map(q => (
                  <div
                    key={q.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedQuestions.includes(q.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                    onClick={() => toggleQuestion(q.id)}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">{q.subject}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                    </div>
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">{q.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Live Preview (Alterna entre Prova e Gabarito) */}
        <div className="space-y-3">
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2 px-2 text-sm font-medium text-slate-600">
              <Eye size={16} className="text-indigo-600" />
              <span>Modo de Visualização:</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode('exam')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  previewMode === 'exam'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileText size={15} />
                Prova
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('answer_key')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  previewMode === 'answer_key'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ClipboardCheck size={15} />
                Gabarito Oficial
              </button>
            </div>
          </div>

          <div className="bg-slate-200 p-6 rounded-xl border border-slate-300 overflow-x-auto h-[880px] overflow-y-auto shadow-inner relative">
            {/* Documento 1: Prova */}
            {previewMode === 'exam' && (
              <div
                id="exam-preview"
                className="w-[794px] bg-[#ffffff] text-[#000000] flex flex-col mx-auto shrink-0 shadow-lg relative"
              >
                {/* Página 1: Capa (Tamanho fixo A4 = 1123px) */}
                <div
                  id="exam-cover-page"
                  className="h-[1123px] w-[794px] p-[25mm] flex flex-col justify-between shrink-0 box-border bg-[#ffffff]"
                >
                  <div>
                    <div className="text-center mb-8">
                      <div className="text-base uppercase">{institution}</div>
                      <div className="text-base uppercase">{subInstitution}</div>

                      <div className="font-bold mt-8 mb-8 uppercase text-lg">{title || 'PROVA'}</div>

                      <div className="text-base uppercase mb-6">{course}</div>

                      <div className="text-base uppercase">TURMA {klass}</div>
                    </div>

                    <div className="text-base mb-8">
                      <div className="mb-6">
                        Nome:________________________________________________________________________________
                      </div>
                      <div className="mb-6">
                        Assinatura:__________________________________________________________________________
                      </div>
                      <div>
                        Data:________________________________________________________________________________
                      </div>
                    </div>

                    <div className="mb-10">
                      <p className="mb-4 text-base">Instruções</p>
                      <div className="whitespace-pre-wrap text-base leading-relaxed">{instructions}</div>
                    </div>

                    <div className="text-center tracking-[1em] mb-4 text-lg">XXXXXXX</div>
                  </div>

                  {/* Rodapé fixado na base da página 1 */}
                  <div className="text-base">
                    <div className="mb-4">
                      Total de Acertos / Nota:__________________________________________________________________
                    </div>
                    <div>Aprovado:_________________________ Reprovado:_________________________</div>
                  </div>
                </div>

                {/* Página 2 em diante: Questões */}
                <div
                  id="exam-questions-page"
                  className="min-h-[1123px] w-[794px] px-[25mm] py-[10mm] flex flex-col shrink-0 box-border bg-[#ffffff]"
                >
                  <div>
                    {validSelectedQuestions.map((q, index) => (
                      <div key={q.id} className="text-sm question-block mb-8">
                        <p className="font-bold mb-2 text-justify">
                          {index + 1}. {q.text}
                        </p>
                        {q.type === 'multiple_choice' && (
                          <div className="ml-4">
                            {q.options?.map((opt: string, i: number) => (
                              <div key={i} className="mb-2">
                                ( {String.fromCharCode(65 + i)} ) {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === 'true_false' && (
                          <div className="ml-4">
                            {q.options && q.options.length > 0 ? (
                              q.options.map((opt: string, i: number) => (
                                <div key={i} className="mb-2">
                                  ( &nbsp;&nbsp;&nbsp; ) {opt}
                                </div>
                              ))
                            ) : (
                              <div className="ml-4">( V ) Verdadeiro &nbsp;&nbsp;&nbsp; ( F ) Falso</div>
                            )}
                          </div>
                        )}
                        {q.type === 'discursive' && (
                          <div className="mt-4">
                            <div className="border-b border-[#000000] w-full mb-4 h-4"></div>
                            <div className="border-b border-[#000000] w-full mb-4 h-4"></div>
                            <div className="border-b border-[#000000] w-full mb-4 h-4"></div>
                            <div className="border-b border-[#000000] w-full h-4"></div>
                          </div>
                        )}
                      </div>
                    ))}
                    {validSelectedQuestions.length === 0 && (
                      <div className="text-center text-[#94a3b8] italic pt-10">
                        As questões selecionadas aparecerão aqui...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Documento 2: Gabarito Oficial */}
            {previewMode === 'answer_key' && (
              <div
                id="answer-key-preview"
                className="w-[794px] min-h-[1123px] px-[20mm] py-[16mm] bg-[#ffffff] text-[#000000] flex flex-col mx-auto shrink-0 shadow-lg relative box-border"
              >
                {/* Bloco 1: Cabeçalho do Gabarito */}
                <div className="pdf-block text-center border-b-2 border-[#000000] pb-6 mb-6">
                  <div className="text-sm font-bold uppercase tracking-wide">{institution}</div>
                  <div className="text-xs uppercase mt-1">{subInstitution}</div>

                  <div className="mt-5 mb-3 inline-block px-4 py-1.5 border-2 border-[#000000] font-bold uppercase text-base tracking-wider">
                    GABARITO OFICIAL — {(title || 'PROVA').toUpperCase()}
                  </div>

                  <div className="text-xs uppercase mt-2 font-medium">{course}</div>
                  <div className="flex justify-center items-center text-xs uppercase mt-3 font-semibold">
                    <span className="mx-4">TURMA: {klass || '___'}</span>
                    <span className="mx-4">DISCIPLINA: {subject || 'GERAL'}</span>
                    <span className="mx-4">QUESTÕES: {validSelectedQuestions.length}</span>
                  </div>
                </div>

                {validSelectedQuestions.length === 0 ? (
                  <div className="text-center text-[#94a3b8] italic py-16">
                    Selecione as questões da prova para visualizar e imprimir o gabarito oficial.
                  </div>
                ) : (
                  <div>
                    {/* Bloco 2: Quadro Resumo de Respostas Rápidas (usando flex-wrap 20% para compatibilidade total com html2canvas) */}
                    <div className="pdf-block mb-8">
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-[#000000]">
                        1. Quadro Resumo de Respostas
                      </h3>
                      <div className="flex flex-wrap border-t border-l border-[#000000]">
                        {validSelectedQuestions.map((q, index) => {
                          let summaryAnswer = '';
                          if (q.type === 'multiple_choice') {
                            summaryAnswer = getMultipleChoiceAnswer(q).letter;
                          } else if (q.type === 'true_false') {
                            summaryAnswer = getTrueFalseAnswers(q).join(' - ');
                          } else {
                            summaryAnswer = 'Discursiva';
                          }

                          return (
                            <div
                              key={q.id}
                              style={{ width: '20%', boxSizing: 'border-box' }}
                              className="border-r border-b border-[#000000] p-2 flex items-center justify-between text-xs bg-[#ffffff]"
                            >
                              <span className="font-bold">
                                Q{String(index + 1).padStart(2, '0')}:
                              </span>
                              <span className="font-mono font-semibold">{summaryAnswer}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detalhamento Questão por Questão */}
                    <div>
                      {validSelectedQuestions.map((q, index) => {
                        const mcAns = q.type === 'multiple_choice' ? getMultipleChoiceAnswer(q) : null;
                        const tfAns = q.type === 'true_false' ? getTrueFalseAnswers(q) : null;

                        return (
                          <div key={q.id} className="pdf-block mb-4">
                            {index === 0 && (
                              <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-[#000000]">
                                2. Gabarito Detalhado por Questão
                              </h3>
                            )}
                            <div className="text-xs border border-[#cbd5e1] rounded p-3.5 bg-[#ffffff]">
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-justify pr-4">
                                  {index + 1}. {q.text}
                                </p>
                                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 border border-[#64748b] rounded shrink-0">
                                  {q.type === 'multiple_choice'
                                    ? 'Múltipla Escolha'
                                    : q.type === 'true_false'
                                    ? 'Verdadeiro / Falso'
                                    : 'Discursiva'}
                                </span>
                              </div>

                              {q.type === 'multiple_choice' && mcAns && (
                                <div className="mt-2 pl-3 border-l-2 border-[#000000]">
                                  <p className="font-bold text-xs mb-1">
                                    Resposta Correta: Alternativa ( {mcAns.letter} )
                                  </p>
                                  <p className="text-[#1e293b]">{mcAns.text}</p>
                                </div>
                              )}

                              {q.type === 'true_false' && tfAns && (
                                <div className="mt-2 pl-3 border-l-2 border-[#000000]">
                                  <p className="font-bold text-xs mb-1.5">
                                    Sequência Correta: {tfAns.join(' - ')}
                                  </p>
                                  {q.options && q.options.length > 0 && (
                                    <div className="mt-1">
                                      {q.options.map((opt: string, i: number) => (
                                        <div key={i} className="text-[#1e293b] mb-1">
                                          <span className="font-bold">( {tfAns[i] || 'V'} )</span> {opt}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {q.type === 'discursive' && (
                                <div className="mt-2 pl-3 border-l-2 border-[#000000]">
                                  <p className="font-bold text-xs mb-1">
                                    Padrão de Resposta / Palavras-chave:
                                  </p>
                                  <p className="whitespace-pre-wrap text-[#1e293b]">
                                    {String(q.correctAnswer || 'Critério de correção a cargo do avaliador.')}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
