import { nowIso } from "../../shared/time";
import { getDiaryStats, listDiaryEntries } from "../diary/diary.service";
import { DiaryEntry, EvidenceReference } from "../diary/diary.types";

interface ReportQuery {
  from?: string;
  to?: string;
  includeImages?: boolean;
  limit?: number;
}

export async function generateTutorStatsReport(studentId: string, query: ReportQuery) {
  const stats = await getDiaryStats({
    studentId,
    from: query.from,
    to: query.to,
    limit: query.limit
  });

  return {
    reportType: "tutor-stats",
    access: "statistics-only",
    generatedAt: nowIso(),
    studentId,
    stats
  };
}

export async function generateEducationDiaryReport(studentId: string, query: ReportQuery) {
  const entries = await listDiaryEntries({
    studentId,
    from: query.from,
    to: query.to,
    limit: query.limit ?? 200
  });

  return {
    reportType: "guardian-education-diary",
    access: "guardian-controlled-evidence",
    generatedAt: nowIso(),
    studentId,
    entries: entries.map((entry) => redactEntryForReport(entry, Boolean(query.includeImages)))
  };
}

function redactEntryForReport(entry: DiaryEntry, includeImages: boolean) {
  return {
    ...entry,
    evidence: entry.evidence
      .filter((evidence) => evidence.includeInGuardianReport)
      .map((evidence) => redactEvidenceForReport(evidence, includeImages))
  };
}

function redactEvidenceForReport(evidence: EvidenceReference, includeImages: boolean) {
  const imageAllowed = includeImages && evidence.includeImageInReports;

  return {
    ...evidence,
    objectKey: imageAllowed ? evidence.objectKey : undefined,
    imageRedacted: !imageAllowed
  };
}
