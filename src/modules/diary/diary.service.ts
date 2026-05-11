import { Filter } from "mongodb";

import { getCollection } from "../../db/mongo";
import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import { DiaryEntry, DiaryStats } from "./diary.types";

export type CreateDiaryEntryInput = Omit<DiaryEntry, "_id" | "createdAt" | "updatedAt">;

interface ListDiaryEntriesInput {
  studentId: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function createDiaryEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry> {
  const entries = await getCollection<DiaryEntry>("diary_entries");
  const timestamp = nowIso();
  const entry: DiaryEntry = {
    _id: createId("entry"),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await entries.insertOne(entry);
  return entry;
}

export async function listDiaryEntries(input: ListDiaryEntriesInput): Promise<DiaryEntry[]> {
  const entries = await getCollection<DiaryEntry>("diary_entries");
  const filter: Filter<DiaryEntry> = {
    studentId: input.studentId
  };

  if (input.from || input.to) {
    filter.occurredAt = {};

    if (input.from) {
      filter.occurredAt.$gte = input.from;
    }

    if (input.to) {
      filter.occurredAt.$lte = input.to;
    }
  }

  return entries
    .find(filter)
    .sort({ occurredAt: -1 })
    .limit(input.limit ?? 50)
    .toArray();
}

export async function getDiaryStats(input: ListDiaryEntriesInput): Promise<DiaryStats> {
  const entries = await listDiaryEntries({
    ...input,
    limit: input.limit ?? 5000
  });
  const subjectTotals = new Map<string, { minutes: number; entries: number }>();
  let totalMinutes = 0;
  let externalTutorMinutes = 0;

  for (const entry of entries) {
    totalMinutes += entry.durationMinutes;

    if (entry.tutorAccountId) {
      externalTutorMinutes += entry.durationMinutes;
    }

    const current = subjectTotals.get(entry.subject) ?? { minutes: 0, entries: 0 };
    current.minutes += entry.durationMinutes;
    current.entries += 1;
    subjectTotals.set(entry.subject, current);
  }

  return {
    studentId: input.studentId,
    from: input.from,
    to: input.to,
    totalMinutes,
    totalHours: toHours(totalMinutes),
    entryCount: entries.length,
    externalTutorMinutes,
    subjectBreakdown: Array.from(subjectTotals.entries()).map(([subject, total]) => ({
      subject,
      minutes: total.minutes,
      hours: toHours(total.minutes),
      entries: total.entries
    })),
    generatedAt: nowIso()
  };
}

function toHours(minutes: number): number {
  return Number((minutes / 60).toFixed(2));
}
