'use client';

import { Brain, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

interface QuizQuestion {
  kind?: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  funFact?: string;
}

interface QuizResponse {
  questions: QuizQuestion[];
}

interface ImageDetails {
  title: string;
  image_url: string;
  page_url: string;
  description?: string | null;
  full_description?: string | null;
}

const KIND_LABELS: Record<string, string> = {
  trivia: '🧠 Trivia',
  guess: '🎯 Closest guess',
  lateral: '🔀 Lateral',
  whatif: '💭 What if',
  culture: '🎭 Culture',
  sensory: '👁️ Sensory',
  thisorthat: '⚖️ This or that',
  mystery: '🔍 Mystery',
};

function labelForKind(kind: string) {
  return KIND_LABELS[kind] ?? `✨ ${kind}`;
}

export default function Quiz({ imageContext }: { imageContext: ImageDetails }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const resetState = () => {
    setQuiz(null);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setRevealed(false);
    setFinished(false);
    setError(null);
  };

  const loadQuiz = async () => {
    resetState();
    setLoading(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageContext }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `Quiz request failed (${res.status})`);
      }
      const data = (await res.json()) as QuizResponse;
      if (!data.questions?.length) {
        throw new Error('Quiz returned no questions.');
      }
      setQuiz(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz.');
    } finally {
      setLoading(false);
    }
  };

  const openAndLoad = async () => {
    setIsOpen(true);
    if (!quiz && !loading) {
      await loadQuiz();
    }
  };

  const onSelect = (index: number) => {
    if (revealed || !quiz) return;
    setSelected(index);
    setRevealed(true);
    if (index === quiz.questions[current].answerIndex) {
      setScore((s) => s + 1);
    }
  };

  const onNext = () => {
    if (!quiz) return;
    if (current + 1 >= quiz.questions.length) {
      setFinished(true);
      return;
    }
    setCurrent((c) => c + 1);
    setSelected(null);
    setRevealed(false);
  };

  const question = quiz?.questions[current];

  return (
    <>
      <div className="inline-block">
        <button
          type="button"
          onClick={openAndLoad}
          className="group relative inline-flex items-center gap-2 rounded-full border border-white/30 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(236,72,153,0.7)] ring-2 ring-white/30 backdrop-blur-md transition hover:scale-105 hover:shadow-[0_15px_40px_-10px_rgba(236,72,153,0.9)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 animate-quiz-pulse"
        >
          <Brain className="h-4 w-4 transition group-hover:rotate-12" />
          <span className="tracking-wide">Quiz me</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 text-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div>
                <h3 className="font-semibold">Image Quiz</h3>
                <p className="text-xs text-white/50">{imageContext.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close quiz"
                className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-5 py-6">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-10 text-white/70">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Generating your quiz…</span>
                </div>
              )}

              {error && (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    type="button"
                    onClick={loadQuiz}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && quiz && !finished && question && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>
                      Question {current + 1} of {quiz.questions.length}
                    </span>
                    <span>Score: {score}</span>
                  </div>
                  {question.kind && (
                    <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60">
                      {labelForKind(question.kind)}
                    </span>
                  )}
                  <p className="text-base font-medium leading-snug">{question.question}</p>
                  <div className="space-y-2">
                    {question.choices.map((choice, index) => {
                      const isCorrect = index === question.answerIndex;
                      const isPicked = index === selected;
                      const base =
                        'w-full rounded-xl border px-4 py-2 text-left text-sm transition';
                      let stateClasses =
                        'border-white/15 bg-white/5 hover:bg-white/10';
                      if (revealed && isCorrect) {
                        stateClasses =
                          'border-emerald-400/60 bg-emerald-500/15 text-emerald-100';
                      } else if (revealed && isPicked && !isCorrect) {
                        stateClasses =
                          'border-rose-400/60 bg-rose-500/15 text-rose-100';
                      } else if (revealed) {
                        stateClasses =
                          'border-white/10 bg-white/5 text-white/60';
                      }
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => onSelect(index)}
                          disabled={revealed}
                          className={`${base} ${stateClasses}`}
                        >
                          <span className="mr-2 text-white/40">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          {choice}
                          {revealed && isCorrect && (
                            <Check className="ml-2 inline h-4 w-4 text-emerald-300" />
                          )}
                          {revealed && isPicked && !isCorrect && (
                            <X className="ml-2 inline h-4 w-4 text-rose-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {revealed && (
                    <div className="space-y-3 rounded-xl bg-white/5 p-3 text-sm text-white/70">
                      <p>{question.explanation}</p>
                      {question.funFact && (
                        <p className="text-xs text-white/55">
                          <span className="font-semibold text-white/70">Did you know? </span>
                          {question.funFact}
                        </p>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={onNext}
                          className="rounded-full bg-white text-zinc-900 px-4 py-1.5 text-sm font-medium hover:bg-white/90"
                        >
                          {current + 1 >= quiz.questions.length ? 'See result' : 'Next'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && quiz && finished && (
                <div className="space-y-4 text-center">
                  <h4 className="text-lg font-semibold">
                    You scored {score} / {quiz.questions.length}
                  </h4>
                  <p className="text-sm text-white/70">
                    {score === quiz.questions.length
                      ? 'Perfect run! 🎉'
                      : score >= Math.ceil(quiz.questions.length * 0.6)
                        ? 'Nice work!'
                        : 'Try another image to bump your score.'}
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={loadQuiz}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm hover:bg-white/10"
                    >
                      <RotateCcw className="h-4 w-4" />
                      New quiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white/90"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
