import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api/client';

const PACE_OPTIONS = [
  { value: 1,  label: '1 week' },
  { value: 2,  label: '2 weeks' },
  { value: 4,  label: '1 month' },
  { value: 13, label: '3 months' },
];

function StepDots({ step, total }) {
  return (
    <div className="flex gap-2 justify-center mb-8" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full transition-colors duration-200
          ${i < step ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
      ))}
    </div>
  );
}

export default function SpaceNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  const [templates, setTemplates] = useState([]);
  
  useEffect(() => {
    api.getTemplates().then(data => {
      setTemplates(data);
      const tName = searchParams.get('template');
      if (tName) {
        const t = data.find(x => x.name === tName);
        if (t) {
          try {
            const parsed = JSON.parse(t.stages);
            setStages(parsed.map((name, i) => ({ id: `tpl-${i}`, name })));
          } catch(e) {}
        }
      }
    }).catch(console.error);
  }, [searchParams]);

  // Step 1
  const [name, setName] = useState('');
  // Step 2
  const [intent, setIntent] = useState('');
  const sentenceWarn = intent.trim().split(/[.!?]+/).filter(s => s.trim()).length > 1;
  // Step 3 — Questions and Stages
  const [questions, setQuestions] = useState(['']);
  const [stages, setStages] = useState([
    { id: 'default-1', name: 'Foundations' }, 
    { id: 'default-2', name: 'Core Concepts' }, 
    { id: 'default-3', name: 'Application' }
  ]);
  const [editingId, setEditingId] = useState(null);
  // Step 4 — Pace
  const [paceWeeks, setPaceWeeks] = useState(null); // null = own pace

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    if (step === 1) {
      if (!name.trim()) return { name: 'Please enter a name.' };
      if (name.trim().length > 60) return { name: 'Max 60 characters.' };
    }
    if (step === 2) {
      if (!intent.trim()) return { intent: 'Please write your intent.' };
      if (intent.trim().length > 200) return { intent: 'Max 200 characters.' };
    }
    if (step === 3) {
      const validQs = questions.filter(q => q.trim());
      if (validQs.length === 0) return { questions: 'Add at least one question.' };
      if (stages.some(s => !s.name.trim())) return { stages: 'All stages need names.' };
      if (stages.length === 0) return { stages: 'Add at least one stage.' };
    }
    return {};
  }

  function nextStep() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep(s => s + 1);
  }

  // ── Step 3 helpers ──────────────────────────────────────────────────────────
  function addQuestion() {
    if (questions.length < 5) setQuestions(q => [...q, '']);
  }
  function updateQuestion(i, val) {
    setQuestions(q => q.map((v, idx) => idx === i ? val : v));
  }
  function removeQuestion(i) {
    if (questions.length > 1) setQuestions(q => q.filter((_, idx) => idx !== i));
  }

  function addStage() {
    if (stages.length >= 8) return;
    const id = `new-${Date.now()}`;
    setStages(s => [...s, { id, name: 'New stage' }]);
    setEditingId(id);
  }
  function removeStage(id) { if (stages.length > 1) setStages(s => s.filter(st => st.id !== id)); }
  function updateStageName(id, val) { setStages(s => s.map(st => st.id === id ? { ...st, name: val } : st)); }
  function onDragEnd(result) {
    if (!result.destination) return;
    const items = Array.from(stages);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setStages(items);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    try {
      const space = await api.createSpace({
        name: name.trim(),
        intent: intent.trim(),
        pace_weeks: paceWeeks,
        stages: stages.map((s, i) => ({ name: s.name.trim(), order: i + 1 })),
        discovery_questions: questions.filter(q => q.trim())
      });
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setErrors({ submit: err.message || 'Could not create space.' });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="top-bar">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/')}
          className="btn-ghost btn-sm px-2" aria-label="Go back">
          ← Back
        </button>
        <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 mx-auto">New Space</span>
        <div className="w-16" />
      </header>

      <main className="flex-1 flex flex-col justify-center pt-14">
        <div className="max-w-md mx-auto w-full px-5 py-10">
          <StepDots step={step} total={4} />

          {/* Step 1: Name */}
          {step === 1 && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h1 className="font-medium text-2xl text-zinc-900 dark:text-zinc-100 mb-1">What are you learning?</h1>
                <p className="text-sm text-zinc-500">Be specific. "Machine Learning" is better than "Technology".</p>
              </div>
              <div>
                <input id="space-name" type="text" className="input text-lg" placeholder="e.g. Machine Learning Fundamentals"
                  value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus
                  onKeyDown={e => e.key === 'Enter' && nextStep()} />
                <div className="flex justify-between mt-1">
                  {errors.name ? <p className="text-xs text-red-500">{errors.name}</p> : <span />}
                  <span className="text-xs text-zinc-400">{name.length}/60</span>
                </div>
              </div>
              <button className="btn-primary w-full" onClick={nextStep} id="wizard-step1-next">Continue</button>
            </div>
          )}

          {/* Step 2: Intent */}
          {step === 2 && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h1 className="font-medium text-2xl text-zinc-900 dark:text-zinc-100 mb-1">Why does this matter to you?</h1>
                <p className="text-sm text-zinc-500">One sentence only. This keeps you anchored when the reading gets hard.</p>
              </div>
              <div>
                <textarea id="space-intent" className="textarea text-base" placeholder="I want to understand X so I can Y"
                  value={intent} onChange={e => setIntent(e.target.value)} maxLength={200} rows={3} autoFocus />
                <div className="flex justify-between mt-1 mb-2">
                  {errors.intent ? <p className="text-xs text-red-500">{errors.intent}</p>
                    : sentenceWarn ? <p className="text-xs text-zinc-400">Looks like more than one sentence — try to keep it concise.</p>
                    : <span />}
                  <span className="text-xs text-zinc-400">{intent.length}/200</span>
                </div>
              </div>
              <button className="btn-primary w-full" onClick={nextStep} id="wizard-step2-next">Continue</button>
            </div>
          )}

          {/* Step 3: Questions and Stages */}
          {step === 3 && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="font-medium text-2xl text-zinc-900 dark:text-zinc-100 mb-1">What do you want to find out — and how will you break it down?</h1>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">What specific questions are you hoping to answer?</label>
                <p className="text-xs text-zinc-500 mb-3">These will float on your Learning Map until your reading answers them.</p>
                {questions.map((q, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input className="input text-sm flex-1" placeholder={`Question ${i + 1}`} maxLength={150}
                      value={q} onChange={e => updateQuestion(i, e.target.value)} />
                    {questions.length > 1 && (
                      <button onClick={() => removeQuestion(i)} className="text-zinc-300 hover:text-zinc-500 transition-colors px-2">×</button>
                    )}
                  </div>
                ))}
                {questions.length < 5 && (
                  <button className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mt-1"
                    onClick={addQuestion}>+ Add another question</button>
                )}
                {errors.questions && <p className="text-xs text-red-500 mt-1">{errors.questions}</p>}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">How will you break this down?</label>
                  {templates.length > 0 && (
                    <select 
                      className="select text-xs py-1 w-32"
                      onChange={e => {
                        const t = templates.find(x => x.id === e.target.value);
                        if (t) {
                          try {
                            const parsed = JSON.parse(t.stages);
                            setStages(parsed.map((name, idx) => ({ id: `tpl-${Date.now()}-${idx}`, name })));
                          } catch(err) {}
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Templates...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mb-3">Stages become the columns of your map. You can edit them later.</p>

                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="stages">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {stages.map((stage, index) => (
                          <Draggable key={stage.id} draggableId={stage.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}
                                className={`flex items-center gap-2 card px-3 py-2 ${snapshot.isDragging ? 'border-zinc-400 dark:border-zinc-600' : ''}`}>
                                <span {...provided.dragHandleProps} className="text-zinc-300 dark:text-zinc-700 cursor-grab px-1 select-none">⠿</span>
                                {editingId === stage.id ? (
                                  <input className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 border-b border-zinc-300 dark:border-zinc-700 focus:outline-none py-0.5"
                                    value={stage.name} onChange={e => updateStageName(stage.id, e.target.value)}
                                    onBlur={() => setEditingId(null)} onKeyDown={e => e.key === 'Enter' && setEditingId(null)} autoFocus />
                                ) : (
                                  <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 cursor-text" onClick={() => setEditingId(stage.id)}>
                                    {stage.name || <span className="text-zinc-400">Unnamed stage</span>}
                                  </span>
                                )}
                                <button onClick={() => removeStage(stage.id)} disabled={stages.length <= 1}
                                  className="text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 disabled:opacity-20 p-1">×</button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                {stages.length < 8 && (
                  <button className="btn-ghost btn-sm w-full border border-dashed border-zinc-300 dark:border-zinc-700 mt-2"
                    onClick={addStage} id="wizard-add-stage">+ Add stage</button>
                )}
                {errors.stages && <p className="text-xs text-red-500 mt-1">{errors.stages}</p>}
              </div>

              <button className="btn-primary w-full" onClick={nextStep} id="wizard-step3-next">Continue</button>
            </div>
          )}

          {/* Step 4: Pace (optional) */}
          {step === 4 && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h1 className="font-medium text-2xl text-zinc-900 dark:text-zinc-100 mb-1">How long do you want to spend on this?</h1>
                <p className="text-sm text-zinc-500">This helps Kernvault reflect your pace back to you — not hold you to it.</p>
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${paceWeeks === null ? 'border-zinc-700 dark:border-zinc-300' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  <input type="radio" name="pace" className="accent-zinc-900 dark:accent-zinc-100" checked={paceWeeks === null} onChange={() => setPaceWeeks(null)} />
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">I'll go at my own pace</span>
                </label>
                {PACE_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${paceWeeks === opt.value ? 'border-zinc-700 dark:border-zinc-300' : 'border-zinc-200 dark:border-zinc-800'}`}>
                    <input type="radio" name="pace" className="accent-zinc-900 dark:accent-zinc-100" checked={paceWeeks === opt.value} onChange={() => setPaceWeeks(opt.value)} />
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">{opt.label}</span>
                  </label>
                ))}
              </div>
              {errors.submit && <p className="text-xs text-red-500">{errors.submit}</p>}
              <button className="btn-primary w-full" onClick={handleSubmit} disabled={submitting} id="wizard-create-space">
                {submitting ? 'Creating…' : 'Create Space'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
