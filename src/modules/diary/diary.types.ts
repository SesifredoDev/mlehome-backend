import { AccountRole } from "../../shared/roles";

export const subjects = [
  "maths",
  "english",
  "science",
  "pe",
  "art",
  "humanities",
  "life-skills",
  "other"
] as const;

export type Subject = (typeof subjects)[number];

export interface CurriculumTag {
  standardId?: string;
  keyStage?: string;
  subject: string;
  topic?: string;
  confidence?: number;
}

export interface EvidenceReference {
  evidenceId: string;
  objectKey?: string;
  mimeType?: string;
  description?: string;
  includeInGuardianReport: boolean;
  includeImageInReports: boolean;
}

export interface DiaryEntry {
  _id: string;
  studentId: string;
  createdByAccountId: string;
  createdByRole: AccountRole;
  occurredAt: string;
  durationMinutes: number;
  subject: Subject;
  title: string;
  description?: string;
  location?: string;
  tutorAccountId?: string;
  evidence: EvidenceReference[];
  curriculumTags: CurriculumTag[];
  shareWithTutorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DiaryStats {
  studentId: string;
  from?: string;
  to?: string;
  totalMinutes: number;
  totalHours: number;
  entryCount: number;
  externalTutorMinutes: number;
  subjectBreakdown: Array<{
    subject: string;
    minutes: number;
    hours: number;
    entries: number;
  }>;
  generatedAt: string;
}
