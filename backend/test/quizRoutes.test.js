const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const Material = require("../models/Material");
const QuizAttempt = require("../models/QuizAttempt");
const quizRouter = require("../routes/quizRoutes");

const USER_ID = "64b000000000000000000001";
const MATERIAL_ID = "64b000000000000000000002";
const TEST_JWT_SECRET = "quiz-route-test-secret";

test("authenticated quick quiz attempts appear in history and progress with material attempts intact", async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalFind = QuizAttempt.find;
  const originalCreate = QuizAttempt.create;
  const originalMaterialFindOne = Material.findOne;
  const savedAttempts = [];
  let nextAttemptId = 1;
  let server;

  process.env.JWT_SECRET = TEST_JWT_SECRET;
  QuizAttempt.create = async (values) => {
    const attempt = {
      ...values,
      _id: String(nextAttemptId++).padStart(24, "0"),
      createdAt: new Date(Date.now() + nextAttemptId * 1000)
    };
    savedAttempts.unshift(attempt);
    return attempt;
  };
  QuizAttempt.find = (filter) => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => savedAttempts
      .filter((attempt) => String(attempt.user) === String(filter.user))
      .sort((a, b) => b.createdAt - a.createdAt)
  });
  Material.findOne = (filter) => ({
    select: async () => {
      assert.deepEqual(filter, { _id: MATERIAL_ID, user: USER_ID });
      return {
        _id: MATERIAL_ID,
        originalName: "Database Notes.pdf",
        subject: "Databases"
      };
    }
  });

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/quizzes", quizRouter);
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/quizzes`;
    const token = jwt.sign({ id: USER_ID }, TEST_JWT_SECRET);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    const unauthorizedResponse = await fetch(`${baseUrl}/history`);
    assert.equal(unauthorizedResponse.status, 401);

    const quickQuizResults = [
      { subject: "DBMS", score: 4, total: 5 },
      { subject: "Operating Systems", score: 3, total: 5 },
      { subject: "Java", score: 5, total: 5 }
    ];

    const savedQuickAttempts = [];
    for (const result of quickQuizResults) {
      const response = await fetch(`${baseUrl}/attempts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ quizType: "quick", ...result })
      });
      assert.equal(response.status, 201);
      const attempt = await response.json();
      assert.equal(attempt.quizType, "quick");
      assert.equal(attempt.subject, result.subject);
      assert.equal(attempt.score, result.score);
      assert.equal(attempt.total, result.total);
      assert.equal(attempt.materialId, null);
      savedQuickAttempts.push(attempt);
    }

    for (const attempt of savedQuickAttempts) {
      const storedAttempt = savedAttempts.find((item) => String(item._id) === attempt.id);
      assert.ok(storedAttempt);
      assert.equal(storedAttempt.subject, attempt.subject);
      assert.equal(storedAttempt.score, attempt.score);
      assert.equal(storedAttempt.quizType, "quick");
    }

    const historyResponse = await fetch(`${baseUrl}/history`, { headers });
    assert.equal(historyResponse.status, 200);
    const quickHistory = await historyResponse.json();
    const quickHistoryBySubject = Object.fromEntries(
      quickHistory.map(({ subject, score, total, quizType }) => [
        subject,
        { score, total, quizType }
      ])
    );
    assert.deepEqual(quickHistoryBySubject, Object.fromEntries(
      quickQuizResults.map(({ subject, ...result }) => [
        subject,
        { ...result, quizType: "quick" }
      ])
    ));

    const { getSubjectQuizStats } = await import("../../frontend/src/utils/quizProgress.js");
    const progressBySubject = Object.fromEntries(
      getSubjectQuizStats(quickHistory).map(({ subject, average }) => [subject, average])
    );
    assert.deepEqual(progressBySubject, {
      Java: 100,
      DBMS: 80,
      "Operating Systems": 60
    });

    const materialResponse = await fetch(`${baseUrl}/attempts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        quizType: "material",
        materialId: MATERIAL_ID,
        score: 3,
        total: 4
      })
    });
    assert.equal(materialResponse.status, 201);
    const materialAttempt = await materialResponse.json();
    assert.equal(materialAttempt.quizType, "material");
    assert.equal(materialAttempt.materialId, MATERIAL_ID);
    assert.equal(materialAttempt.materialName, "Database Notes.pdf");
    assert.equal(materialAttempt.subject, "Databases");
    assert.equal(materialAttempt.score, 3);
    assert.equal(materialAttempt.total, 4);

    const completeHistoryResponse = await fetch(`${baseUrl}/history`, { headers });
    const completeHistory = await completeHistoryResponse.json();
    assert.equal(completeHistory.length, 4);
    assert.ok(completeHistory.some((attempt) => attempt.id === materialAttempt.id));
    assert.equal(
      getSubjectQuizStats(completeHistory).find((item) => item.subject === "Databases").average,
      75
    );

    const quickAttemptDocument = new QuizAttempt({
      user: USER_ID,
      material: null,
      quizType: "quick",
      materialName: "DBMS Quick Quiz",
      subject: "DBMS",
      score: 4,
      total: 5
    });
    await quickAttemptDocument.validate();
  } finally {
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    QuizAttempt.find = originalFind;
    QuizAttempt.create = originalCreate;
    Material.findOne = originalMaterialFindOne;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  }
});
