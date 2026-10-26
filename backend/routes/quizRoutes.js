const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const Material = require("../models/Material");
const QuizAttempt = require("../models/QuizAttempt");

const router = express.Router();
const QUICK_QUIZ_SUBJECTS = new Set(["DBMS", "Operating Systems", "Java"]);

router.get("/history", authMiddleware, async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(attempts.map((attempt) => ({
      id: String(attempt._id),
      materialId: attempt.material ? String(attempt.material) : null,
      quizType: attempt.quizType || (attempt.material ? "material" : "quick"),
      materialName: attempt.materialName,
      subject: attempt.subject,
      score: attempt.score,
      total: attempt.total,
      date: attempt.createdAt
    })));
  } catch (error) {
    console.error("Fetch Quiz History Error:", error);
    res.status(500).json({ message: "Could not load quiz history" });
  }
});

router.post("/attempts", authMiddleware, async (req, res) => {
  try {
    const {
      materialId,
      quizType = "material",
      subject,
      score,
      total
    } = req.body;
    const isQuickQuiz = quizType === "quick";
    const validQuizType = isQuickQuiz || quizType === "material";

    if (
      !validQuizType
      || !Number.isInteger(score)
      || !Number.isInteger(total)
      || total < 1
      || total > 50
      || score < 0
      || score > total
      || (isQuickQuiz && (!QUICK_QUIZ_SUBJECTS.has(subject) || total !== 5))
      || (!isQuickQuiz && !/^[a-f\d]{24}$/i.test(materialId || ""))
    ) {
      return res.status(400).json({ message: "Quiz result is invalid" });
    }

    let attemptDetails;
    if (isQuickQuiz) {
      attemptDetails = {
        material: null,
        materialName: `${subject} Quick Quiz`,
        subject,
        quizType: "quick"
      };
    } else {
      const material = await Material.findOne({
        _id: materialId,
        user: req.user.id
      }).select("originalName subject");

      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      attemptDetails = {
        material: material._id,
        materialName: material.originalName,
        subject: material.subject || "General",
        quizType: "material"
      };
    }

    const attempt = await QuizAttempt.create({
      user: req.user.id,
      ...attemptDetails,
      score,
      total
    });

    res.status(201).json({
      id: String(attempt._id),
      materialId: attempt.material ? String(attempt.material) : null,
      quizType: attempt.quizType,
      materialName: attempt.materialName,
      subject: attempt.subject,
      score: attempt.score,
      total: attempt.total,
      date: attempt.createdAt
    });
  } catch (error) {
    console.error("Save Quiz Attempt Error:", error);
    res.status(500).json({ message: "Could not save quiz result" });
  }
});

module.exports = router;
