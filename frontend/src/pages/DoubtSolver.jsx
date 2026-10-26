import {
  useEffect,
  useRef,
  useState
} from "react";

import axios from "axios";
import ReactMarkdown from "react-markdown";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import "../styles/doubtSolver.css";


function DoubtSolver() {

  // =====================================
  // STATES
  // =====================================

  const [question, setQuestion] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [doubtHistory, setDoubtHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [quotaBlocked, setQuotaBlocked] =
    useState(false);

  const [showAllHistory, setShowAllHistory] =
    useState(false);


  const messagesEndRef =
    useRef(null);


  // =====================================
  // FETCH DOUBT HISTORY
  // =====================================

  const fetchDoubtHistory = async () => {

    try {

      const token =
        localStorage.getItem("token");


      if (!token) {
        return null;
      }


      const response =
        await axios.get(
          "/api/doubts",
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );


      console.log(
        "Doubt History:",
        response.data
      );

      return response.data;

    } catch (error) {

      console.error(
        "Fetch Doubt History Error:",
        {
          status: error.response?.status || 0,
          message: error.response?.data?.message || error.message
        }
      );

      return null;
    }

  };


  // =====================================
  // PAGE LOAD
  // =====================================

  useEffect(() => {

    let active = true;

    fetchDoubtHistory().then((history) => {
      if (active && Array.isArray(history)) {
        setDoubtHistory(history);
      }
    });

    return () => {
      active = false;
    };

  }, []);


  // =====================================
  // AUTO SCROLL CHAT
  // =====================================

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });

  }, [messages, loading]);


  // =====================================
  // ASK DOUBT
  // =====================================

  const handleAskDoubt = async () => {

    if (quotaBlocked || loading) return;

    const cleanQuestion =
      question.trim();


    if (!cleanQuestion) {

      alert(
        "Please enter your doubt."
      );

      return;
    }


    const token =
      localStorage.getItem("token");


    if (!token) {

      alert(
        "Please login first."
      );

      return;
    }


    // Add student's message immediately

    const userMessage = {

      id:
        Date.now(),

      role:
        "user",

      text:
        cleanQuestion

    };


    setMessages(
      (previousMessages) => [
        ...previousMessages,
        userMessage
      ]
    );


    // Clear input

    setQuestion("");


    try {

      setLoading(true);


      const response =
        await axios.post(

          "/api/doubts/ask",

          {
            question:
              cleanQuestion
          },

          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }

        );


      // =====================================
      // CREATE AI MESSAGE
      // =====================================

      const aiMessage = {

        id:
          Date.now() + 1,

        role:
          "assistant",

        text:
          response.data.answer,

        source:
          response.data.source,

        matchedQuestion:
          response.data.matchedQuestion || null,

        similarity:
          response.data.similarity || null

      };


      setMessages(
        (previousMessages) => [
          ...previousMessages,
          aiMessage
        ]
      );


      // Refresh MongoDB history
      const history =
        await fetchDoubtHistory();
      if (Array.isArray(history)) {
        setDoubtHistory(history);
      }


    } catch (error) {

      console.error(
        "Ask Doubt Error:",
        {
          status: error.response?.status || 0,
          code: error.response?.data?.code || "unknown",
          message: error.response?.data?.message || error.message
        }
      );

      const isQuotaExceeded =
        error.response?.data?.code === "AI_QUOTA_EXHAUSTED";
      if (isQuotaExceeded) setQuotaBlocked(true);

      const errorMessage = {

        id:
          Date.now() + 2,

        role:
          "assistant",

        text:
          error.response?.data?.message ||
          "Sorry, I could not solve this doubt right now.",

        error:
          true

      };


      setMessages(
        (previousMessages) => [
          ...previousMessages,
          errorMessage
        ]
      );


    } finally {

      setLoading(false);

    }

  };


  // =====================================
  // ENTER KEY
  // =====================================

  const handleKeyDown = (e) => {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      if (!loading && !quotaBlocked) {
        handleAskDoubt();
      }

    }

  };


  // =====================================
  // NEW CHAT
  // =====================================

  const handleNewChat = () => {

    setMessages([]);

    setQuestion("");

  };


  // =====================================
  // OPEN OLD DOUBT
  // =====================================

  const handleOpenHistory = (doubt) => {

    setMessages([

      {
        id:
          `${doubt._id}-question`,

        role:
          "user",

        text:
          doubt.question
      },

      {
        id:
          `${doubt._id}-answer`,

        role:
          "assistant",

        text:
          doubt.answer,

        source:
          "history"
      }

    ]);


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  };


  // =====================================
  // DELETE DOUBT
  // =====================================

  const handleDeleteDoubt =
    async (doubt) => {

      const confirmDelete =
        window.confirm(
          `Delete "${doubt.question}"?`
        );


      if (!confirmDelete) {
        return;
      }


      try {

        const token =
          localStorage.getItem("token");


        if (!token) {

          alert(
            "Please login first."
          );

          return;
        }


        const response =
          await axios.delete(

            `/api/doubts/${doubt._id}`,

            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }

          );


        alert(
          response.data.message
        );


        await fetchDoubtHistory();


      } catch (error) {

        console.error(
          "Delete Doubt Error:",
          error
        );


        alert(
          error.response?.data?.message ||
          "Failed to delete doubt"
        );

      }

    };


  // =====================================
  // UI
  // =====================================

  return (

    <div className="dashboardLayout">

      <Sidebar />


      <main className="dashboardMain">

        <Topbar />


        {/* ===============================
            HEADER
        =============================== */}

        <section className="doubtHeader">

          <div>

            <h1>
              AI Doubt Solver
            </h1>

            <p>
              Ask academic questions and get
              clear AI-powered explanations.
            </p>

          </div>


          <button
            className="newChatBtn"
            onClick={handleNewChat}
          >
            ＋ New Chat
          </button>

        </section>



        {/* ===============================
            MAIN GRID
        =============================== */}

        <section className="doubtMainGrid">


          {/* ===============================
              CHAT AREA
          =============================== */}

          <div className="doubtChatCard">


            {/* CHAT HEADER */}

            <div className="chatHeader">

              <div className="chatBotAvatar">
                🤖
              </div>

              <div>

                <h3>
                  StudyGenie AI
                </h3>

                <p>
                  Academic Doubt Assistant
                </p>

              </div>


              <span className="onlineBadge">
                ● Online
              </span>

            </div>



            {/* ===============================
                CHAT MESSAGES
            =============================== */}

            <div className="chatMessages">


              {messages.length === 0 && (

                <div className="chatWelcome">

                  <div className="welcomeRobot">
                    🤖
                  </div>

                  <h2>
                    How can I help you today?
                  </h2>

                  <p>
                    Ask any B.Sc. IT academic
                    question and StudyGenie will
                    explain it in simple language.
                  </p>


                  <div className="suggestedQuestions">

                    <button
                      onClick={() =>
                        setQuestion(
                          "What is normalization in DBMS?"
                        )
                      }
                    >
                      What is normalization in DBMS?
                    </button>


                    <button
                      onClick={() =>
                        setQuestion(
                          "Explain deadlock in operating system."
                        )
                      }
                    >
                      Explain deadlock in OS
                    </button>


                    <button
                      onClick={() =>
                        setQuestion(
                          "Explain OSI model layers."
                        )
                      }
                    >
                      Explain OSI Model
                    </button>


                    <button
                      onClick={() =>
                        setQuestion(
                          "What is inheritance in Java?"
                        )
                      }
                    >
                      What is inheritance in Java?
                    </button>

                  </div>

                </div>

              )}



              {messages.map(
                (message) => (

                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "messageRow userMessageRow"
                        : "messageRow aiMessageRow"
                    }
                  >

                    {message.role === "assistant" && (

                      <div className="messageAvatar">
                        🤖
                      </div>

                    )}


                    <div
                      className={
                        message.role === "user"
                          ? "messageBubble userBubble"
                          : "messageBubble aiBubble"
                      }
                    >

                      {message.role === "assistant" ? (

                        <ReactMarkdown>
                          {message.text}
                        </ReactMarkdown>

                      ) : (

                        <p>
                          {message.text}
                        </p>

                      )}



                      {/* AUTO FAQ BADGE */}

                      {
                        message.role === "assistant" &&
                        message.source === "history" &&
                        (

                          <div className="historyAnswerBadge">

                            ⚡ Answer reused from
                            your doubt history

                          </div>

                        )
                      }



                      {/* GEMINI BADGE */}

                      {
                        message.role === "assistant" &&
                        message.source === "gemini" &&
                        (

                          <div className="geminiAnswerBadge">

                            ✨ Generated by StudyGenie AI

                          </div>

                        )
                      }


                    </div>


                    {message.role === "user" && (

                      <div className="messageAvatar userAvatar">
                        👤
                      </div>

                    )}

                  </div>

                )
              )}



              {/* AI TYPING */}

              {loading && (

                <div className="messageRow aiMessageRow">

                  <div className="messageAvatar">
                    🤖
                  </div>

                  <div className="messageBubble aiBubble typingBubble">

                    <span></span>
                    <span></span>
                    <span></span>

                  </div>

                </div>

              )}


              <div ref={messagesEndRef}></div>

            </div>



            {/* ===============================
                CHAT INPUT
            =============================== */}

            <div className="chatInputArea">

              <textarea
                placeholder="Ask your academic doubt..."
                value={question}
                onChange={(e) =>
                  setQuestion(
                    e.target.value
                  )
                }
                onKeyDown={handleKeyDown}
                rows="2"
                disabled={loading || quotaBlocked}
              />


              <button
                className="sendDoubtBtn"
                onClick={handleAskDoubt}
                disabled={
                  loading ||
                  quotaBlocked ||
                  !question.trim()
                }
              >

                {loading
                  ? "..."
                  : quotaBlocked
                    ? "—"
                    : "➤"}

              </button>

            </div>


            <div className="chatInputHint">

              {quotaBlocked
                ? "Daily AI quota reached. Reload this page after the quota resets."
                : "Press Enter to send • Shift + Enter for new line"}

            </div>


          </div>



          {/* ===============================
              RIGHT SIDE
          =============================== */}

          <aside className="doubtRightPanel">


            {/* ===============================
                HISTORY
            =============================== */}

            <div className="doubtSideCard">


              <div className="doubtSideHeader">

                <h3>
                  🕘 Doubt History
                </h3>


                {doubtHistory.length > 4 && (

                  <button
                    onClick={() =>
                      setShowAllHistory(
                        !showAllHistory
                      )
                    }
                  >

                    {showAllHistory
                      ? "Show Less"
                      : "View All"}

                  </button>

                )}

              </div>



              {doubtHistory.length > 0 ? (

                (
                  showAllHistory
                    ? doubtHistory
                    : doubtHistory.slice(
                        0,
                        4
                      )
                ).map(
                  (doubt) => (

                    <HistoryItem
                      key={doubt._id}
                      doubt={doubt}
                      onOpen={
                        handleOpenHistory
                      }
                      onDelete={
                        handleDeleteDoubt
                      }
                    />

                  )
                )

              ) : (

                <div className="noDoubtHistory">

                  No doubts asked yet.

                </div>

              )}


            </div>



            {/* ===============================
                AUTO FAQ
            =============================== */}

            <div className="doubtSideCard autoFaqCard">

              <div className="autoFaqIcon">
                ⚡
              </div>

              <h3>
                Auto-FAQ
              </h3>

              <p>
                StudyGenie checks your previous
                doubts before contacting AI.
              </p>

              <div className="autoFaqFlow">

                <span>
                  Question
                </span>

                <b>→</b>

                <span>
                  History
                </span>

                <b>→</b>

                <span>
                  AI
                </span>

              </div>

            </div>



            {/* ===============================
                TIPS
            =============================== */}

            <div className="doubtSideCard doubtTips">

              <h3>
                💡 Ask Better Questions
              </h3>

              <ul>

                <li>
                  Mention the subject or topic.
                </li>

                <li>
                  Ask one concept at a time.
                </li>

                <li>
                  Ask for examples if needed.
                </li>

                <li>
                  Use clear academic questions.
                </li>

              </ul>

            </div>


          </aside>


        </section>


      </main>

    </div>

  );

}



// =====================================
// HISTORY ITEM COMPONENT
// =====================================

function HistoryItem({
  doubt,
  onOpen,
  onDelete
}) {

  return (

    <div className="doubtHistoryItem">


      <div
        className="doubtHistoryContent"
        onClick={() =>
          onOpen(doubt)
        }
      >

        <div className="historyQuestionIcon"> ?  </div>


        <div className="historyQuestionText">

          <h4>
            {doubt.question}
          </h4>

          <span>
            {new Date(
              doubt.createdAt
            ).toLocaleDateString()}
          </span>

        </div>

      </div>


      <button
        className="deleteDoubtBtn"
        title="Delete Doubt"
        onClick={() =>
          onDelete(doubt)
        }
      >
        🗑️
      </button>


    </div>

  );

}


export default DoubtSolver;