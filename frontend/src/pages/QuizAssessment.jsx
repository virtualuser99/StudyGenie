import { useEffect, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { QUICK_QUIZZES, QUICK_QUIZ_SUBJECTS } from "../data/quickQuizzes";
import "../styles/learningTools.css";

const SUPPORTED_MATERIAL = /\.(pdf|docx|txt)$/i;

function QuizAssessment() {
  const [materials, setMaterials] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [hasToken] = useState(() => Boolean(localStorage.getItem("token")));
  const [materialsLoading, setMaterialsLoading] = useState(hasToken);
  const [history, setHistory] = useState([]);
  const [quizMode, setQuizMode] = useState("quick");
  const [selectedQuickSubject, setSelectedQuickSubject] = useState("DBMS");
  const [quizSource, setQuizSource] = useState("quick");
  const [studyKit, setStudyKit] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [reviewAnswers, setReviewAnswers] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [canRetryGeneration, setCanRetryGeneration] = useState(false);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");

    if (!token) {
      return () => { active = false; };
    }

    Promise.allSettled([
      axios.get("/api/materials", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get("/api/quizzes/history", {
        headers: { Authorization: `Bearer ${token}` }
      })
    ])
      .then(([materialsResult, historyResult]) => {
        if (!active) return;
        if (materialsResult.status === "fulfilled") {
          const allMaterials = Array.isArray(materialsResult.value.data) ? materialsResult.value.data : [];
          const supportedMaterials = allMaterials.filter((material) => SUPPORTED_MATERIAL.test(material.originalName || ""));
          setMaterials(supportedMaterials);
          setSelectedMaterialId(supportedMaterials[0]?._id || "");
        } else {
          setError("Could not load your study materials. Please try again.");
        }

        if (historyResult.status === "fulfilled") {
          setHistory(Array.isArray(historyResult.value.data) ? historyResult.value.data : []);
        } else if (materialsResult.status === "fulfilled") {
          setError("Your study materials loaded, but quiz history could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setMaterialsLoading(false);
      });

    return () => { active = false; };
  }, []);

  const selectedMaterial = materials.find((material) => material._id === selectedMaterialId);
  const bestScore = history.length
    ? history.reduce(
      (best, attempt) => Math.max(best, Math.round((attempt.score / attempt.total) * 100)),
      0
    )
    : null;

  const generateStudyKit = async () => {
    if (!selectedMaterial) return;
    const token = localStorage.getItem("token");
    setGenerating(true);
    setError("");
    setCanRetryGeneration(false);
    setStudyKit(null);

    try {
      const response = await axios.post(
        "/api/ai/material-study-kit",
        { materialId: selectedMaterial._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudyKit(response.data);
      setQuotaBlocked(false);
    } catch (requestError) {
      const responseData = requestError.response?.data;
      const quotaExceeded = responseData?.code === "AI_QUOTA_EXHAUSTED";
      setError(responseData?.message || "Could not generate your study kit. Please try again.");
      setQuotaBlocked(quotaExceeded);
      setCanRetryGeneration(!quotaExceeded);
    } finally {
      setGenerating(false);
    }
  };

  const startQuiz = () => {
    if (!studyKit?.questions?.length) return;
    setQuizSource("material");
    setQuiz(studyKit.questions);
    setCurrentQuestion(0);
    setAnswers({});
    setShowReview(false);
    setReviewAnswers(false);
  };

  const startQuickQuiz = () => {
    const questions = QUICK_QUIZZES[selectedQuickSubject];
    if (!questions) return;
    setQuizSource("quick");
    setQuiz(questions);
    setCurrentQuestion(0);
    setAnswers({});
    setShowReview(false);
    setReviewAnswers(false);
    setError("");
  };

  const finishQuiz = async () => {
    if (!allAnswered || savingAttempt) return;
    const score = quiz.reduce(
      (total, item, index) => total + (answers[index] === item.answer ? 1 : 0),
      0
    );
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Sign in to save this quiz result. You can still review your answers below.");
      setShowReview(true);
      setReviewAnswers(true);
      return;
    }

    setSavingAttempt(true);
    setError("");
    setCanRetryGeneration(false);

    try {
      const response = await axios.post(
        "/api/quizzes/attempts",
        quizSource === "quick"
          ? { quizType: "quick", subject: selectedQuickSubject, score, total: quiz.length }
          : { quizType: "material", materialId: selectedMaterialId, score, total: quiz.length },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory((previous) => [response.data, ...previous].slice(0, 100));
      setShowReview(true);
      setReviewAnswers(quizSource === "quick");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not save your quiz result. Finish the quiz again to retry.");
    } finally {
      setSavingAttempt(false);
    }
  };

  const score = quiz
    ? quiz.reduce((total, item, index) => total + (answers[index] === item.answer ? 1 : 0), 0)
    : 0;
  const question = quiz?.[currentQuestion];
  const allAnswered = quiz && Object.keys(answers).length === quiz.length;
  const visibleError = error || (
    quizMode === "material" && quotaBlocked
      ? "The AI daily quota is exhausted. Wait for it to reset, then reload this page to try again."
      : ""
  );

  return (
    <div className="dashboardLayout">
      <Sidebar />
      <main className="dashboardMain learningMain">
        <Topbar />
        <section className="learningPageIntro">
          <div>
            <span className="learningEyebrow">PRACTICE &amp; LEARN</span>
            <h1>Quiz &amp; Assessment</h1>
            <p>Take a quick subject challenge or build a quiz from your study materials.</p>
          </div>
          {quiz && !showReview && (
            <button className="learningSecondaryButton" onClick={() => setQuiz(null)} type="button">
              Exit quiz
            </button>
          )}
        </section>

        {visibleError && (
          <div className="quizErrorNotice" role="alert">
            <span>{visibleError}</span>
            {canRetryGeneration && quizMode === "material" && selectedMaterial && !generating && !quiz && (
              <button type="button" onClick={generateStudyKit}>Try again</button>
            )}
          </div>
        )}

        {!quiz ? (
          <div className="learningGrid quizLandingGrid">
            <section className="learningCard quizSetupCard">
              {quizMode === "quick" ? (
                <>
                  <div className="learningCardHeading">
                    <div className="learningIcon" aria-hidden="true">✦</div>
                    <div>
                      <h2>Ready for a quick challenge?</h2>
                      <p>Choose a subject and start a five-question practice quiz.</p>
                    </div>
                  </div>
                  <p className="learningLabel">Choose a subject</p>
                  <div className="subjectOptions" aria-label="Quick quiz subjects">
                    {QUICK_QUIZ_SUBJECTS.map((subject) => (
                      <button
                        aria-pressed={selectedQuickSubject === subject.name}
                        className={`subjectOption ${selectedQuickSubject === subject.name ? "selected" : ""}`}
                        key={subject.name}
                        onClick={() => setSelectedQuickSubject(subject.name)}
                        type="button"
                      >
                        <span aria-hidden="true">{subject.icon}</span>
                        <strong>{subject.name}</strong>
                        <small>5 questions · 5 min</small>
                      </button>
                    ))}
                  </div>
                  <button className="learningPrimaryButton" onClick={startQuickQuiz} type="button">
                    Start {selectedQuickSubject} quiz <span aria-hidden="true">→</span>
                  </button>
                  <p className="quizNote"><span aria-hidden="true">✦</span>Instant results with explanations for every question</p>
                  <button
                    className="quizModeLink"
                    onClick={() => {
                      setQuizMode("material");
                      setError("");
                    }}
                    type="button"
                  >
                    Build a quiz from my uploaded material <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="learningCardHeading">
                    <div className="learningIcon" aria-hidden="true">✦</div>
                    <div>
                      <h2>Turn your material into practice</h2>
                      <p>Your summary and questions are based on the selected upload.</p>
                    </div>
                  </div>
                  <button
                    className="quizModeLink"
                    onClick={() => {
                      setQuizMode("quick");
                      setError("");
                    }}
                    type="button"
                  >
                    ← Quick subject challenge
                  </button>
                  {!hasToken ? (
                    <div className="learningEmptyNote quizNoMaterials">
                      <p>Sign in to use your uploaded study materials.</p>
                      <Link className="learningPrimaryButton" to="/login">Sign in <span aria-hidden="true">→</span></Link>
                    </div>
                  ) : materialsLoading ? (
                    <p className="learningEmptyNote">Loading your uploaded materials…</p>
                  ) : materials.length ? (
                    <>
                      <label className="learningLabel" htmlFor="quiz-material">Choose study material</label>
                      <select
                        className="quizMaterialSelect"
                        id="quiz-material"
                        value={selectedMaterialId}
                        disabled={generating}
                        onChange={(event) => {
                          setSelectedMaterialId(event.target.value);
                          setStudyKit(null);
                          setError("");
                          setCanRetryGeneration(false);
                        }}
                      >
                        {materials.map((material) => (
                          <option key={material._id} value={material._id}>
                            {material.originalName} · {material.subject || "General"}
                          </option>
                        ))}
                      </select>
                      <p className="quizSupportedTypes">Supported files: PDF, DOCX, TXT</p>
                      <button className="learningPrimaryButton" disabled={generating || !selectedMaterial || quotaBlocked} onClick={generateStudyKit} type="button">
                        {quotaBlocked ? "AI quota reached" : generating ? "Generating summary & quiz…" : "Generate summary & quiz"}
                        {!generating && !quotaBlocked && <span aria-hidden="true">→</span>}
                      </button>
                    </>
                  ) : (
                    <div className="learningEmptyNote quizNoMaterials">
                      <p>No supported uploads found yet. Upload a PDF, DOCX, or TXT file to get started.</p>
                      <Link className="learningPrimaryButton" to="/materials">Upload study material <span aria-hidden="true">→</span></Link>
                    </div>
                  )}
                </>
              )}
            </section>

            <aside className="learningCard quizProgressCard">
              <div className="learningCardTitleRow">
                <h2>Your practice</h2>
                <span className="learningTitleIcon" aria-hidden="true">✓</span>
              </div>
              <div className="practiceScore">
                <div className="scoreRing" style={{ "--score": `${bestScore}%` }}>
                  <strong>{bestScore === null ? "—" : `${bestScore}%`}</strong>
                </div>
                <div><strong>Personal best</strong><span>From completed quizzes</span></div>
              </div>
              <div className="practiceStats">
                <div><strong>{history.length}</strong><span>Quizzes taken</span></div>
                <div>
                  <strong>{history.length ? `${Math.round(history.reduce((sum, item) => sum + item.score / item.total, 0) / history.length * 100)}%` : "—"}</strong>
                  <span>Average score</span>
                </div>
              </div>
              <div className="recentQuizHeader"><strong>Recent attempts</strong></div>
              {history.length ? (
                <ul className="quizHistoryList">
                  {history.slice(0, 4).map((attempt) => (
                    <li key={attempt.id}>
                      <span className="quizHistoryDot" aria-hidden="true">✓</span>
                      <span><strong>{attempt.materialName || attempt.subject}</strong><small>{new Date(attempt.date).toLocaleDateString()}</small></span>
                      <b>{attempt.score}/{attempt.total}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="learningEmptyNote">Completed quizzes will appear here.</p>
              )}
            </aside>

            {studyKit && quizMode === "material" && (
              <section className="learningCard quizSummaryCard">
                <div className="quizSummaryHeader">
                  <div>
                    <span className="learningEyebrow">AI-GENERATED SUMMARY</span>
                    <h2>{studyKit.material?.originalName || selectedMaterial?.originalName}</h2>
                  </div>
                  <button className="learningPrimaryButton" onClick={startQuiz} type="button">
                    Start {studyKit.questions.length}-question quiz <span aria-hidden="true">→</span>
                  </button>
                </div>
                <div className="quizSummaryContent"><ReactMarkdown>{studyKit.summary}</ReactMarkdown></div>
              </section>
            )}
          </div>
        ) : showReview ? (
          <section className="learningCard quizResultCard">
            <div className="resultIllustration" aria-hidden="true">{score === quiz.length ? "🏆" : score >= 3 ? "✨" : "🌱"}</div>
            <span className="learningEyebrow">QUIZ COMPLETE</span>
            <h2>{score === quiz.length ? "Perfect score!" : score >= 3 ? "Nice work!" : "Good start — keep going!"}</h2>
            <p>You scored <strong>{score} out of {quiz.length}</strong> on {quizSource === "quick" ? `${selectedQuickSubject} quick quiz` : selectedMaterial?.originalName || "your study material"}.</p>
            <div className="resultBar"><span style={{ width: `${(score / quiz.length) * 100}%` }} /></div>
            <span className="resultPercent">{Math.round((score / quiz.length) * 100)}% correct</span>
            <div className="resultActions">
              <button className="learningPrimaryButton" onClick={() => setReviewAnswers((visible) => !visible)} type="button">{reviewAnswers ? "Hide answer review" : "Review answers"}</button>
              <button className="learningSecondaryButton" onClick={quizSource === "quick" ? startQuickQuiz : startQuiz} type="button">Try again</button>
              <button
                className="learningSecondaryButton"
                onClick={() => {
                  setQuiz(null);
                  setStudyKit(null);
                  setShowReview(false);
                  setReviewAnswers(false);
                  setAnswers({});
                  setQuizMode(quizSource === "quick" ? "quick" : "material");
                  setError("");
                }}
                type="button"
              >
                {quizSource === "quick" ? "Choose another subject" : "Choose another file"}
              </button>
            </div>
            {reviewAnswers && (
              <div className="answerReviewList">
                {quiz.map((item, index) => (
                  <article className="answerReviewItem" key={`${item.question}-${index}`}>
                    <div className="reviewQuestionTitle">
                      <span className={`reviewMark ${answers[index] === item.answer ? "correct" : "incorrect"}`}>{answers[index] === item.answer ? "✓" : "×"}</span>
                      <strong>{item.question}</strong>
                    </div>
                    <p>Your answer: <b>{answers[index] === undefined ? "Not answered" : item.options[answers[index]]}</b></p>
                    <p>Correct answer: <b>{item.options[item.answer]}</b></p>
                    <small>{item.explanation}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="learningCard activeQuizCard">
            <div className="quizProgressHeader">
              <div><span className="learningEyebrow">{(quizSource === "quick" ? selectedQuickSubject : selectedMaterial?.subject || "STUDY MATERIAL").toUpperCase()}</span><h2>Question {currentQuestion + 1} <span>of {quiz.length}</span></h2></div>
              <span className="quizQuestionCount">{Object.keys(answers).length} answered</span>
            </div>
            <div className="questionProgressTrack"><span style={{ width: `${((currentQuestion + 1) / quiz.length) * 100}%` }} /></div>
            <div className="questionContent">
              <span className="questionNumber">QUESTION {String(currentQuestion + 1).padStart(2, "0")}</span>
              <h3>{question.question}</h3>
              <div className="quizAnswerOptions">
                {question.options.map((option, index) => (
                  <button
                    className={`quizAnswerOption ${answers[currentQuestion] === index ? "chosen" : ""}`}
                    key={option}
                    onClick={() => setAnswers((previous) => ({ ...previous, [currentQuestion]: index }))}
                    type="button"
                  >
                    <span className="answerLetter">{String.fromCharCode(65 + index)}</span>{option}
                    <span className="answerCheck">{answers[currentQuestion] === index ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="quizNavigation">
              <button className="learningSecondaryButton" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((index) => index - 1)} type="button">← Previous</button>
              {currentQuestion < quiz.length - 1 ? (
                <button className="learningPrimaryButton" onClick={() => setCurrentQuestion((index) => index + 1)} type="button">Next question →</button>
              ) : (
                <button className="learningPrimaryButton" disabled={!allAnswered || savingAttempt} onClick={finishQuiz} type="button">
                  {savingAttempt ? "Saving result…" : "Finish quiz"} {!savingAttempt && <span>✓</span>}
                </button>
              )}
            </div>
            {!allAnswered && currentQuestion === quiz.length - 1 && <p className="quizFinishHint">Answer all questions before finishing.</p>}
          </section>
        )}
      </main>
    </div>
  );
}

export default QuizAssessment;
