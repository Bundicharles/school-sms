export function getStandardGrade(score: number) {
  if (score >= 80) return { grade: "A", points: 12, comment: "Excellent", color: "#16a34a" };
  if (score >= 75) return { grade: "A-", points: 11, comment: "Very Good", color: "#22c55e" };
  if (score >= 70) return { grade: "B+", points: 10, comment: "Good", color: "#4ade80" };
  if (score >= 65) return { grade: "B", points: 9, comment: "Fairly Good", color: "#3b82f6" };
  if (score >= 60) return { grade: "B-", points: 8, comment: "Satisfactory", color: "#60a5fa" };
  if (score >= 55) return { grade: "C+", points: 7, comment: "Above Average", color: "#a855f7" };
  if (score >= 50) return { grade: "C", points: 6, comment: "Average", color: "#c084fc" };
  if (score >= 45) return { grade: "C-", points: 5, comment: "Below Average", color: "#f59e0b" };
  if (score >= 40) return { grade: "D+", points: 4, comment: "Poor", color: "#fbbf24" };
  if (score >= 35) return { grade: "D", points: 3, comment: "Very Poor", color: "#f87171" };
  if (score >= 30) return { grade: "D-", points: 2, comment: "Extremely Poor", color: "#ef4444" };
  return { grade: "E", points: 1, comment: "Failed", color: "#b91c1c" };
}
