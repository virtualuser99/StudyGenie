export const getQuizScorePercent = (quiz) => {
  const total = Number(quiz.total);
  return total > 0 ? (Number(quiz.score) / total) * 100 : 0;
};

export const getSubjectQuizStats = (quizzes) => Object.entries(
  quizzes.reduce((result, quiz) => {
    const subject = quiz.subject || "Other";
    result[subject] ||= { attempts: 0, score: 0 };
    result[subject].attempts += 1;
    result[subject].score += getQuizScorePercent(quiz);
    return result;
  }, {}),
)
  .map(([subject, stats]) => ({
    subject,
    attempts: stats.attempts,
    average: Math.round(stats.score / stats.attempts),
  }))
  .sort((a, b) => b.average - a.average);
