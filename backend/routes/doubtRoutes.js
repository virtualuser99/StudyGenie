const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const Doubt = require("../models/Doubt");
const authMiddleware = require("../middleware/authMiddleware");
const { sendAIError } = require("../utils/aiErrors");

const router = express.Router();

const SIMILARITY_THRESHOLD = 0.65;
const MAX_QUESTION_LENGTH = 1000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = [500, 502, 503, 504];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isGeminiName = (name) => /^gemini-[a-z0-9.-]+$/i.test(name || "");

// ---------- Models ----------

const geminiModels = () => {
  const primary = process.env.GEMINI_MODEL?.trim();
  const extras = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash")
    .split(",")
    .map((name) => name.trim())
    .filter(isGeminiName);

  return [...new Set([isGeminiName(primary) ? primary : "gemini-3.8-flash", ...extras])];
};

const hasBackupProvider = () =>
  Boolean(
    process.env.FALLBACK_API_KEY &&
      process.env.FALLBACK_BASE_URL &&
      process.env.FALLBACK_MODEL
  );

// ---------- Similarity ----------

const toWordSet = (text) =>
  new Set(
    text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean)
  );

const calculateSimilarity = (question1, question2) => {
  const words1 = toWordSet(question1);
  const words2 = toWordSet(question2);
  if (!words1.size || !words2.size) return 0;

  const common = [...words1].filter((word) => words2.has(word)).length;
  return common / (words1.size + words2.size - common);
};

// ---------- AI ----------

const buildPrompt = (question) => `
You are StudyGenie AI, an academic doubt-solving assistant for IT students.

Student Question:
${question}

Instructions:
- Answer in simple student-friendly language.
- Explain the concept clearly.
- Use headings and bullet points where useful.
- Give examples when useful.
- Keep the answer suitable for exam preparation.
`;

const backupAnswer = async (prompt) => {
  const response = await fetch(`${process.env.FALLBACK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FALLBACK_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.FALLBACK_MODEL,
      messages: [{ role: "user", content: prompt }]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Backup provider returned status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
};

const generateDoubtAnswer = async (question) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildPrompt(question);
  let lastError;

  for (const model of geminiModels()) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`Generating with ${model} (attempt ${attempt})`);
        const response = await ai.models.generateContent({ model, contents: prompt });

        if (response.text) return response.text;

        lastError = new Error("Empty AI response");
        break;
      } catch (error) {
        lastError = error;
        const status = error?.status || error?.response?.status;

        // Busy server: thoda ruk ke dobara try karo
        // Quota (429) ya koi aur error: seedha agle model pe jao
        if (!RETRYABLE_STATUS.includes(status)) {
          console.warn(`${model} failed with status ${status || "unknown"}; trying next.`);
          break;
        }
        if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
      }
    }
  }

  if (hasBackupProvider()) {
    try {
      console.log("Gemini failed; using backup provider");
      const text = await backupAnswer(prompt);
      if (text) return text;
    } catch (error) {
      console.warn("Backup provider failed:", error.message);
    }
  }

  throw lastError;
};

// ---------- ASK: POST /api/doubts/ask ----------

router.post("/ask", authMiddleware, async (req, res) => {
  try {
    const question =
      typeof req.body?.question === "string" ? req.body.question.trim() : "";

    if (!question) {
      return res.status(400).json({ message: "Please enter your question" });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        message: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer`
      });
    }

    // Saare users ke asli AI answers mein dhundho
    const pool = await Doubt.find({ source: "gemini" })
      .select("question answer")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    let bestMatch = null;
    let bestScore = 0;

    for (const doubt of pool) {
      const score = calculateSimilarity(question, doubt.question);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = doubt;
      }
    }

    console.log("Best Doubt Similarity:", bestScore);

    // Purana answer reuse karo, aur is user ki history mein bhi save karo
    if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
      console.log("Answer returned from history");

      try {
        await Doubt.create({
          user: req.user.id,
          question,
          answer: bestMatch.answer,
          source: "history"
        });
      } catch (error) {
        // Save fail ho to bhi user ko answer milna chahiye
        console.error("Could not save reused doubt:", error.message);
      }

      return res.json({
        message: "Answer found in doubt history",
        answer: bestMatch.answer,
        source: "history",
        similarity: bestScore
      });
    }

    console.log("No similar doubt found. Asking AI...");
    const answer = await generateDoubtAnswer(question);

    const doubt = await Doubt.create({
      user: req.user.id,
      question,
      answer,
      source: "gemini"
    });

    return res.status(201).json({
      message: "Doubt solved successfully",
      answer,
      source: "gemini",
      doubt
    });
  } catch (error) {
    console.error("Doubt Solver Error:", {
      status: error?.status || error?.response?.status || 0,
      code: error?.code || "unknown"
    });
    return sendAIError(res, error);
  }
});

// ---------- HISTORY: GET /api/doubts ----------

router.get("/", authMiddleware, async (req, res) => {
  try {
    const doubts = await Doubt.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(doubts);
  } catch (error) {
    console.error("Fetch Doubts Error:", error);
    res.status(500).json({ message: "Failed to fetch doubt history" });
  }
});

// ---------- DELETE: DELETE /api/doubts/:id ----------

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const doubt = await Doubt.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!doubt) {
      return res.status(404).json({ message: "Doubt not found" });
    }

    res.json({ message: "Doubt deleted successfully" });
  } catch (error) {
    console.error("Delete Doubt Error:", error);
    res.status(500).json({ message: "Failed to delete doubt" });
  }
});

module.exports = router;