import { randomBytes } from "node:crypto";

import { getCollection } from "../../db/mongo";
import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import { badRequest, notFound } from "../../shared/apiError";
import { LinkScope, StudentLink } from "./auth.types";

interface CreateStudentLinkInput {
  studentId: string;
  guardianAccountId: string;
  scopes: LinkScope[];
  expiresAt?: string;
}

export async function createStudentLink(input: CreateStudentLinkInput): Promise<StudentLink> {
  const links = await getCollection<StudentLink>("student_links");
  const timestamp = nowIso();
  const link: StudentLink = {
    _id: createId("link"),
    studentId: input.studentId,
    guardianAccountId: input.guardianAccountId,
    code: await createUniqueCode(),
    scopes: input.scopes,
    status: "pending",
    expiresAt: input.expiresAt,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await links.insertOne(link);
  return link;
}

export async function activateStudentLink(code: string, tutorAccountId: string): Promise<StudentLink> {
  const links = await getCollection<StudentLink>("student_links");
  const link = await links.findOne({ code: code.toUpperCase() });

  if (!link) {
    throw notFound("Student link code was not found.");
  }

  if (link.status !== "pending") {
    throw badRequest("Student link code is no longer pending.");
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    throw badRequest("Student link code has expired.");
  }

  const updates = {
    tutorAccountId,
    status: "active" as const,
    activatedAt: nowIso(),
    updatedAt: nowIso()
  };

  await links.updateOne({ _id: link._id }, { $set: updates });

  return {
    ...link,
    ...updates
  };
}

export async function listStudentLinksForAccount(
  accountId: string,
  role: "guardian" | "tutor"
): Promise<StudentLink[]> {
  const links = await getCollection<StudentLink>("student_links");
  const filter =
    role === "tutor" ? { tutorAccountId: accountId } : { guardianAccountId: accountId };

  return links.find(filter).sort({ createdAt: -1 }).toArray();
}

async function createUniqueCode(): Promise<string> {
  const links = await getCollection<StudentLink>("student_links");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const existing = await links.findOne({ code });

    if (!existing) {
      return code;
    }
  }

  throw badRequest("Could not allocate a unique link code. Try again.");
}
