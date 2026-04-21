import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getCBCGrade = (score: number) => {
  if (score >= 90) return { level: "EE1", points: 8 };
  if (score >= 75) return { level: "EE2", points: 7 };
  if (score >= 58) return { level: "ME1", points: 6 };
  if (score >= 41) return { level: "ME2", points: 5 };
  if (score >= 31) return { level: "AE1", points: 4 };
  if (score >= 21) return { level: "AE2", points: 3 };
  if (score >= 11) return { level: "BE1", points: 2 };
  return { level: "BE2", points: 1 };
};

export const getRemarks = (score: number) => {
  if (score >= 75) return {
    teacher: "Excellent performance. Keep up the high standards.",
    principal: "Outstanding achievement. A role model to others."
  };
  if (score >= 41) return {
    teacher: "Good work. You have shown consistent effort.",
    principal: "Commendable performance. Aim higher next time."
  };
  if (score >= 21) return {
    teacher: "Fair performance. More effort needed in weak subjects.",
    principal: "Needs improvement. Focus on consistent revision."
  };
  return {
    teacher: "Below expectations. Urgent intervention required.",
    principal: "Immediate improvement required. See the principal."
  };
};

export const getOverallGrade = (score: number) => {
  if (score >= 90) return "EE1";
  if (score >= 75) return "EE2";
  if (score >= 58) return "ME1";
  if (score >= 41) return "ME2";
  if (score >= 31) return "AE1";
  if (score >= 21) return "AE2";
  if (score >= 11) return "BE1";
  return "BE2";
};
