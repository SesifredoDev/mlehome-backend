import { randomBytes } from "node:crypto";

import { getCollection } from "../../db/mongo";
import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import { badRequest, forbidden, notFound } from "../../shared/apiError";
import { Account } from "../accounts/accounts.types";
import { ChildLink, GuardianTutorAccess, LinkScope, StudentLink } from "./auth.types";

interface CreateStudentLinkInput {
  studentId?: string;
  childLinkId?: string;
  guardianAccountId: string;
  scopes: LinkScope[];
  expiresAt?: string;
}

interface UpdateGuardianTutorChildrenInput {
  guardianAccountId: string;
  tutorAccountId: string;
  childLinkIds: string[];
  scopes?: LinkScope[];
}

interface CreateChildLinkInput {
  guardianAccountId: string;
  canLogEntries?: boolean;
  expiresAt?: string;
}

interface ActivateChildLinkInput {
  code: string;
  childAccountId: string;
  studentId?: string;
  studentName: string;
  keyStage?: string;
  year?: string;
}

export async function createStudentLink(input: CreateStudentLinkInput): Promise<StudentLink> {
  const links = await getCollection<StudentLink>("student_links");
  const childLink = await findActiveGuardianChildLink(input.guardianAccountId, {
    childLinkId: input.childLinkId,
    studentId: input.studentId
  });

  if (!childLink?.studentId) {
    throw badRequest("Create and activate a child link before generating a tutor link.");
  }

  const timestamp = nowIso();
  const link: StudentLink = {
    _id: createId("link"),
    studentId: childLink.studentId,
    childLinkId: childLink._id,
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

export async function listGuardianTutorAccess(
  guardianAccountId: string
): Promise<GuardianTutorAccess[]> {
  const links = await getCollection<StudentLink>("student_links");
  const accounts = await getCollection<Account>("accounts");
  const childLinksCollection = await getCollection<ChildLink>("child_links");
  const tutorLinks = await links
    .find({
      guardianAccountId,
      tutorAccountId: { $exists: true },
      status: { $in: ["active", "revoked"] }
    })
    .sort({ createdAt: -1 })
    .toArray();

  const tutorIds = uniqueStrings(
    tutorLinks.flatMap((link) => (link.tutorAccountId ? [link.tutorAccountId] : []))
  );

  if (tutorIds.length === 0) {
    return [];
  }

  const tutorAccounts = await accounts.find({ _id: { $in: tutorIds } }).toArray();
  const tutorAccountById = new Map(tutorAccounts.map((account) => [account._id, account]));
  const childLinkIds = uniqueStrings(
    tutorLinks.flatMap((link) => (link.childLinkId ? [link.childLinkId] : []))
  );
  const studentIds = uniqueStrings(tutorLinks.map((link) => link.studentId));
  const childFilters = [];

  if (childLinkIds.length > 0) {
    childFilters.push({ _id: { $in: childLinkIds } });
  }

  if (studentIds.length > 0) {
    childFilters.push({ studentId: { $in: studentIds } });
  }

  const childLinks =
    childFilters.length > 0
      ? await childLinksCollection
          .find({
            guardianAccountId,
            status: "active",
            $or: childFilters
          })
          .toArray()
      : [];
  const childLinkById = new Map(childLinks.map((link) => [link._id, link]));
  const childLinkByStudentId = new Map(
    childLinks.flatMap((link) => (link.studentId ? [[link.studentId, link] as const] : []))
  );
  const accessByTutorId = new Map<string, GuardianTutorAccess>();

  for (const link of tutorLinks) {
    if (!link.tutorAccountId) {
      continue;
    }

    const tutorAccount = tutorAccountById.get(link.tutorAccountId);
    const access =
      accessByTutorId.get(link.tutorAccountId) ??
      {
        tutorAccountId: link.tutorAccountId,
        tutorName: tutorAccount?.displayName,
        tutorEmail: tutorAccount?.email,
        children: []
      };

    if (link.status === "active") {
      const childLink =
        (link.childLinkId ? childLinkById.get(link.childLinkId) : undefined) ??
        childLinkByStudentId.get(link.studentId);

      if (childLink?.studentId) {
        access.children.push({
          studentLinkId: link._id,
          childLinkId: childLink._id,
          studentId: childLink.studentId,
          studentName: childLink.studentName,
          keyStage: childLink.keyStage,
          year: childLink.year,
          scopes: link.scopes,
          activatedAt: link.activatedAt
        });
      }
    }

    accessByTutorId.set(link.tutorAccountId, access);
  }

  return Array.from(accessByTutorId.values()).sort((a, b) =>
    (a.tutorName ?? a.tutorEmail ?? a.tutorAccountId).localeCompare(
      b.tutorName ?? b.tutorEmail ?? b.tutorAccountId
    )
  );
}

export async function updateGuardianTutorChildren(
  input: UpdateGuardianTutorChildrenInput
): Promise<GuardianTutorAccess[]> {
  const links = await getCollection<StudentLink>("student_links");
  const childLinksCollection = await getCollection<ChildLink>("child_links");
  const timestamp = nowIso();
  const requestedChildLinkIds = uniqueStrings(input.childLinkIds);
  const existingTutorLinks = await links
    .find({
      guardianAccountId: input.guardianAccountId,
      tutorAccountId: input.tutorAccountId,
      status: { $in: ["active", "revoked"] }
    })
    .toArray();

  if (existingTutorLinks.length === 0) {
    throw notFound("Tutor is not linked to this parent account.");
  }

  const requestedChildLinks =
    requestedChildLinkIds.length > 0
      ? await childLinksCollection
          .find({
            _id: { $in: requestedChildLinkIds },
            guardianAccountId: input.guardianAccountId,
            status: "active"
          })
          .toArray()
      : [];

  if (requestedChildLinks.length !== requestedChildLinkIds.length) {
    throw badRequest("One or more selected children are not active child links.");
  }

  const requestedChildLinkIdSet = new Set(requestedChildLinkIds);
  const requestedChildById = new Map(requestedChildLinks.map((link) => [link._id, link]));
  const existingByChildKey = new Map<string, StudentLink>();

  for (const link of existingTutorLinks) {
    if (link.childLinkId) {
      existingByChildKey.set(link.childLinkId, link);
    }

    const matchingChild = requestedChildLinks.find((childLink) => childLink.studentId === link.studentId);

    if (matchingChild) {
      existingByChildKey.set(matchingChild._id, link);
    }
  }

  for (const link of existingTutorLinks) {
    if (link.status !== "active") {
      continue;
    }

    const childLinkId =
      link.childLinkId ??
      requestedChildLinks.find((childLink) => childLink.studentId === link.studentId)?._id;

    if (childLinkId && requestedChildLinkIdSet.has(childLinkId)) {
      continue;
    }

    await links.updateOne(
      { _id: link._id },
      {
        $set: {
          status: "revoked",
          updatedAt: timestamp
        }
      }
    );
  }

  for (const childLinkId of requestedChildLinkIds) {
    const childLink = requestedChildById.get(childLinkId);

    if (!childLink?.studentId) {
      throw badRequest("One or more selected children have not completed activation.");
    }

    const existing = existingByChildKey.get(childLinkId);
    const updates = {
      studentId: childLink.studentId,
      childLinkId: childLink._id,
      tutorAccountId: input.tutorAccountId,
      scopes: input.scopes ?? defaultTutorScopes(),
      status: "active" as const,
      activatedAt: existing?.activatedAt ?? timestamp,
      updatedAt: timestamp
    };

    if (existing) {
      await links.updateOne({ _id: existing._id }, { $set: updates });
      continue;
    }

    await links.insertOne({
      _id: createId("link"),
      guardianAccountId: input.guardianAccountId,
      code: await createUniqueCode(),
      expiresAt: undefined,
      createdAt: timestamp,
      ...updates
    });
  }

  return listGuardianTutorAccess(input.guardianAccountId);
}

export async function requireTutorStudentScope(
  tutorAccountId: string,
  studentId: string,
  scope: LinkScope
): Promise<StudentLink> {
  const links = await getCollection<StudentLink>("student_links");
  const link = await links.findOne({
    tutorAccountId,
    studentId,
    status: "active"
  });

  if (!link) {
    throw forbidden("Tutor is not linked to this child.");
  }

  if (!link.scopes.includes(scope)) {
    throw forbidden("Tutor link does not allow this action.");
  }

  return link;
}

export async function createChildLink(input: CreateChildLinkInput): Promise<ChildLink> {
  const links = await getCollection<ChildLink>("child_links");
  const timestamp = nowIso();
  const link: ChildLink = {
    _id: createId("clink"),
    guardianAccountId: input.guardianAccountId,
    code: await createUniqueChildCode(),
    canLogEntries: input.canLogEntries ?? true,
    status: "pending",
    expiresAt: input.expiresAt,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await links.insertOne(link);
  return link;
}

export async function activateChildLink(input: ActivateChildLinkInput): Promise<ChildLink> {
  const links = await getCollection<ChildLink>("child_links");
  const link = await links.findOne({ code: input.code.toUpperCase() });

  if (!link) {
    throw notFound("Child link was not found.");
  }

  if (link.status !== "pending") {
    throw badRequest("Child link is no longer pending.");
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    throw badRequest("Child link has expired.");
  }

  const studentId = input.studentId?.trim() || `child-${input.childAccountId}`;
  const studentName = input.studentName.trim();

  if (!studentName) {
    throw badRequest("Child display name is required.");
  }

  const updates = {
    studentId,
    studentName,
    keyStage: input.keyStage?.trim() || undefined,
    year: input.year?.trim() || undefined,
    childAccountId: input.childAccountId,
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

export async function listChildLinksForAccount(
  accountId: string,
  role: "guardian" | "child"
): Promise<ChildLink[]> {
  const links = await getCollection<ChildLink>("child_links");
  const filter =
    role === "child" ? { childAccountId: accountId } : { guardianAccountId: accountId };

  return links.find(filter).sort({ createdAt: -1 }).toArray();
}

export async function revokeChildLink(linkId: string, accountId: string): Promise<ChildLink> {
  const links = await getCollection<ChildLink>("child_links");
  const existing = await links.findOne({ _id: linkId, guardianAccountId: accountId });

  if (!existing) {
    throw notFound("Child link was not found.");
  }

  if (existing.status === "revoked") {
    return existing;
  }

  const updates = {
    status: "revoked" as const,
    revokedAt: nowIso(),
    updatedAt: nowIso()
  };

  await links.updateOne({ _id: linkId }, { $set: updates });

  return {
    ...existing,
    ...updates
  };
}

async function findActiveGuardianChildLink(
  guardianAccountId: string,
  input: { childLinkId?: string; studentId?: string }
): Promise<ChildLink | undefined> {
  const links = await getCollection<ChildLink>("child_links");

  if (input.childLinkId) {
    return (
      (await links.findOne({
        _id: input.childLinkId,
        guardianAccountId,
        status: "active"
      })) ?? undefined
    );
  }

  if (input.studentId) {
    return (
      (await links.findOne({
        studentId: input.studentId,
        guardianAccountId,
        status: "active"
      })) ?? undefined
    );
  }

  return undefined;
}

function defaultTutorScopes(): LinkScope[] {
  return ["stats:read", "entries:create", "evidence:create", "reports:tutor"];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
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

async function createUniqueChildCode(): Promise<string> {
  const links = await getCollection<ChildLink>("child_links");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const existing = await links.findOne({ code });

    if (!existing) {
      return code;
    }
  }

  throw badRequest("Could not allocate a unique child link. Try again.");
}
