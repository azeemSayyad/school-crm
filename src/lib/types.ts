export type Stage =
  | "New Lead"
  | "AI Studented"
  | "Pre-Qualifying"
  | "Qualified"
  | "Appointment Booked"
  | "No Show"
  | "Enrolled"
  | "Not Qualified";

export type Source = "Google" | "Meta" | "WhatsApp" | "Referral";
export type Language = "EN" | "ES";

export interface WhatsAppMessage {
  from: "ai" | "lead";
  text: string;
  time: string;
}

export interface Qualification {
  ged: string;
  legalStatus: string;
  availability: string;
  experience: string;
  transportation: string;
  startDate: string;
}

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  language: Language;
  source: string;
  stage: Stage;
  dateAdded: string;
  appointmentDate: string | null;
  notes: string;
  qualification: Qualification;
  whatsappLog: WhatsAppMessage[];
}

export const STAGES: Stage[] = [
  "New Lead",
  "AI Studented",
  "Pre-Qualifying",
  "Qualified",
  "Appointment Booked",
  "No Show",
  "Enrolled",
  "Not Qualified",
];

export const SOURCES: Source[] = ["Google", "Meta", "WhatsApp", "Referral"];
export const LANGUAGES: Language[] = ["EN", "ES"];

export const STAGE_META: Record<Stage, { color: string; bg: string; icon: string }> = {
  "New Lead":           { color: "#6366f1", bg: "#eef2ff", icon: "●" },
  "AI Studented":       { color: "#3b82f6", bg: "#eff6ff", icon: "◉" },
  "Pre-Qualifying":     { color: "#f59e0b", bg: "#fffbeb", icon: "◎" },
  "Qualified":          { color: "#10b981", bg: "#ecfdf5", icon: "◈" },
  "Appointment Booked": { color: "#059669", bg: "#ecfdf5", icon: "◆" },
  "No Show":            { color: "#ef4444", bg: "#fef2f2", icon: "◇" },
  "Enrolled":           { color: "#16a34a", bg: "#f0fdf4", icon: "✦" },
  "Not Qualified":      { color: "#dc2626", bg: "#fef2f2", icon: "✕" },
};
