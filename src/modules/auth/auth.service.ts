import { randomBytes } from "node:crypto";

import { getCollection } from "../../db/mongo";
import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import { badRequest, forbidden, notFound } from "../../shared/apiError";
import { Account } from "../accounts/accounts.types";
import { registerAccount, updateAccountStatus } from "../accounts/accounts.service";
import {
  ChildLink,
  ChildGuardianAccess,
  GuardianLink,
  GuardianTutorAccess,
  LinkScope,
  StudentLink
} from "./auth.types";
import { revokeAllRefreshTokens } from "./session.service";

interface CreateStudentLinkInput {
  studentId?: string;
  childLinkId?: string;
  guardianAccountId: string;
  scopes: LinkScope[];
  expiresAt?: string;
}

interface CreateGuardianLinkInput {
  childLinkId: string;
  headGuardianAccountId: string;
  expiresAt?: string;
}

interface UpdateGuardianTutorChildrenInput {
  guardianAccountId: string;
  tutorAccountId: string;
  childLinkIds: string[];
  scopes?: LinkScope[];
}

interface RevokeChildGuardianAccessInput {
  childLinkId: string;
  headGuardianAccountId: string;
  guardianAccountId: string;
}

interface CreateChildLinkInput {
  guardianAccountId: string;
  studentName: string;
  dateOfBirth?: string;
  age?: number;
  keyStage?: string;
  year?: string;
  canLogEntries?: boolean;
  loginEnabled?: boolean;
  loginCredentials?: {
    email: string;
    password: string;
    displayName?: string;
  };
}

interface UpdateChildLinkProfileInput {
  linkId: string;
  guardianAccountId: string;
  studentName: string;
  dateOfBirth?: string;
  age?: number;
  keyStage?: string;
  year?: string;
  canLogEntries?: boolean;
  loginEnabled?: boolean;
  loginCredentials?: {
    email: string;
    password: string;
    displayName?: string;
  };
}

export async function createStudentLink(input: CreateStudentLinkInput): Promise<StudentLink> {
  const links = await getCollection<StudentLink>("student_links");
  const childLink = await findActiveGuardianChildLink(input.guardianAccountId, {
    childLinkId: input.childLinkId,
    studentId: input.studentId
  });

  if (!childLink?.studentId) {
    throw badRequest("Create a child record before generating a tutor link.");
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

export async function createGuardianLink(input: CreateGuardianLinkInput): Promise<GuardianLink> {
  const childLinks = await getCollection<ChildLink>("child_links");
  const guardianLinks = await getCollection<GuardianLink>("guardian_links");
  const childLink = await childLinks.findOne({
    _id: input.childLinkId,
    guardianAccountId: input.headGuardianAccountId,
    status: "active"
  });

  if (!childLink) {
    throw forbidden("Only the head parent can add guardians for this child.");
  }

  const timestamp = nowIso();
  const link: GuardianLink = {
    _id: createId("glink"),
    childLinkId: childLink._id,
    headGuardianAccountId: input.headGuardianAccountId,
    code: await createUniqueCode(),
    status: "pending",
    expiresAt: input.expiresAt,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await guardianLinks.insertOne(link);
  return link;
}

export async function activateGuardianLink(
  code: string,
  guardianAccountId: string
): Promise<ChildLink> {
  const guardianLinks = await getCollection<GuardianLink>("guardian_links");
  const childLinks = await getCollection<ChildLink>("child_links");
  const link = await guardianLinks.findOne({ code: code.toUpperCase() });

  if (!link) {
    throw notFound("Guardian link code was not found.");
  }

  if (link.status !== "pending") {
    throw badRequest("Guardian link code is no longer pending.");
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    throw badRequest("Guardian link code has expired.");
  }

  if (link.headGuardianAccountId === guardianAccountId) {
    throw badRequest("The head parent already has access to this child.");
  }

  const childLink = await childLinks.findOne({
    _id: link.childLinkId,
    guardianAccountId: link.headGuardianAccountId,
    status: "active"
  });

  if (!childLink) {
    throw notFound("Child record was not found.");
  }

  const timestamp = nowIso();

  await childLinks.updateOne(
    { _id: childLink._id },
    {
      $addToSet: { guardianAccountIds: guardianAccountId },
      $set: { updatedAt: timestamp }
    }
  );
  await guardianLinks.updateOne(
    { _id: link._id },
    {
      $set: {
        guardianAccountId,
        status: "active",
        activatedAt: timestamp,
        updatedAt: timestamp
      }
    }
  );

  const updatedChildLink = {
    ...childLink,
    guardianAccountIds: uniqueStrings([
      ...(childLink.guardianAccountIds ?? []),
      guardianAccountId
    ]),
    updatedAt: timestamp
  };

  return (await withChildLoginStatus([updatedChildLink], guardianAccountId))[0];
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
            status: "active",
            $and: [guardianAccessFilter(guardianAccountId), { $or: childFilters }]
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
          dateOfBirth: childLink.dateOfBirth,
          age: childLink.age ?? calculateAge(childLink.dateOfBirth),
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
            ...guardianAccessFilter(input.guardianAccountId),
            status: "active"
          })
          .toArray()
      : [];

  if (requestedChildLinks.length !== requestedChildLinkIds.length) {
    throw badRequest("One or more selected children are not active child records.");
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
      throw badRequest("One or more selected children are not active child records.");
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

export async function listChildGuardianAccess(
  childLinkId: string,
  headGuardianAccountId: string
): Promise<ChildGuardianAccess[]> {
  const childLink = await requireHeadGuardianChildLink(childLinkId, headGuardianAccountId);

  return childGuardianAccessFromLink(childLink);
}

export async function revokeChildGuardianAccess(
  input: RevokeChildGuardianAccessInput
): Promise<ChildGuardianAccess[]> {
  const childLinks = await getCollection<ChildLink>("child_links");
  const guardianLinks = await getCollection<GuardianLink>("guardian_links");
  const studentLinks = await getCollection<StudentLink>("student_links");
  const childLink = await requireHeadGuardianChildLink(input.childLinkId, input.headGuardianAccountId);

  if (input.guardianAccountId === input.headGuardianAccountId) {
    throw badRequest("The head parent cannot be removed from their child record.");
  }

  if (!childGuardianIds(childLink).includes(input.guardianAccountId)) {
    throw notFound("Guardian access was not found for this child.");
  }

  const timestamp = nowIso();

  await childLinks.updateOne(
    { _id: childLink._id },
    {
      $pull: { guardianAccountIds: input.guardianAccountId },
      $set: { updatedAt: timestamp }
    }
  );

  await guardianLinks.updateMany(
    {
      childLinkId: childLink._id,
      headGuardianAccountId: input.headGuardianAccountId,
      guardianAccountId: input.guardianAccountId,
      status: "active"
    },
    {
      $set: {
        status: "revoked",
        revokedAt: timestamp,
        updatedAt: timestamp
      }
    }
  );

  if (childLink.studentId) {
    await studentLinks.updateMany(
      {
        guardianAccountId: input.guardianAccountId,
        $or: [{ childLinkId: childLink._id }, { studentId: childLink.studentId }],
        status: "active"
      },
      {
        $set: {
          status: "revoked",
          updatedAt: timestamp
        }
      }
    );
  }

  return childGuardianAccessFromLink({
    ...childLink,
    guardianAccountIds: childGuardianIds(childLink).filter((id) => id !== input.guardianAccountId),
    updatedAt: timestamp
  });
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
  const linkId = createId("clink");
  const studentName = input.studentName.trim();

  if (!studentName) {
    throw badRequest("Child name is required.");
  }

  const childAccount = input.loginCredentials
    ? await registerAccount({
        email: input.loginCredentials.email,
        password: input.loginCredentials.password,
        displayName: input.loginCredentials.displayName?.trim() || studentName,
        role: "child"
      })
    : undefined;

  const link: ChildLink = {
    _id: linkId,
    studentId: `child-${linkId}`,
    studentName,
    dateOfBirth: input.dateOfBirth,
    age: input.age,
    keyStage: input.keyStage?.trim() || undefined,
    year: input.year?.trim() || undefined,
    guardianAccountId: input.guardianAccountId,
    guardianAccountIds: [input.guardianAccountId],
    childAccountId: childAccount?._id,
    canLogEntries: input.canLogEntries ?? true,
    status: "active",
    activatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await links.insertOne(link);
  return {
    ...link,
    childLoginEnabled: childAccount?.status === "active"
  };
}

export async function updateChildLinkProfile(
  input: UpdateChildLinkProfileInput
): Promise<ChildLink> {
  const links = await getCollection<ChildLink>("child_links");
  const existing = await links.findOne({
    _id: input.linkId,
    ...guardianAccessFilter(input.guardianAccountId)
  });

  if (!existing) {
    throw notFound("Child record was not found.");
  }

  if (existing.status === "revoked") {
    throw badRequest("Revoked child records cannot be edited.");
  }

  const studentName = input.studentName.trim();

  if (!studentName) {
    throw badRequest("Child name is required.");
  }

  const childLogin = await configureChildLogin(existing, studentName, input);
  const updates = {
    studentId: existing.studentId || `child-${existing._id}`,
    studentName,
    dateOfBirth: input.dateOfBirth,
    age: input.age,
    keyStage: input.keyStage?.trim() || undefined,
    year: input.year?.trim() || undefined,
    childAccountId: childLogin.childAccountId,
    canLogEntries: input.canLogEntries ?? existing.canLogEntries,
    updatedAt: nowIso()
  };

  await links.updateOne({ _id: existing._id }, { $set: updates });

  return {
    ...existing,
    ...updates,
    childLoginEnabled: childLogin.childLoginEnabled
  };
}

export async function listChildLinksForAccount(
  accountId: string,
  role: "guardian" | "child"
): Promise<ChildLink[]> {
  const links = await getCollection<ChildLink>("child_links");
  const filter =
    role === "child" ? { childAccountId: accountId } : guardianAccessFilter(accountId);

  const childLinks = await links.find(filter).sort({ createdAt: -1 }).toArray();

  return withChildLoginStatus(childLinks, accountId);
}

export async function revokeChildLink(linkId: string, accountId: string): Promise<ChildLink> {
  const links = await getCollection<ChildLink>("child_links");
  const existing = await links.findOne({ _id: linkId, guardianAccountId: accountId });

  if (!existing) {
    throw notFound("Child record was not found, or only the head parent can revoke it.");
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

async function configureChildLogin(
  existing: ChildLink,
  studentName: string,
  input: Pick<UpdateChildLinkProfileInput, "loginEnabled" | "loginCredentials">
): Promise<{ childAccountId?: string; childLoginEnabled: boolean }> {
  let childAccountId = existing.childAccountId;
  let childLoginEnabled = await getChildLoginEnabled(childAccountId);

  if (input.loginCredentials) {
    if (childAccountId) {
      throw badRequest("This child already has login credentials.");
    }

    if (input.loginEnabled === false) {
      throw badRequest("Enable child login before adding login credentials.");
    }

    const childAccount = await registerAccount({
      email: input.loginCredentials.email,
      password: input.loginCredentials.password,
      displayName: input.loginCredentials.displayName?.trim() || studentName,
      role: "child"
    });
    childAccountId = childAccount._id;
    childLoginEnabled = true;
  }

  if (input.loginEnabled === undefined) {
    return { childAccountId, childLoginEnabled };
  }

  if (input.loginEnabled) {
    if (!childAccountId) {
      throw badRequest("Login credentials are required to enable child login.");
    }

    await updateAccountStatus(childAccountId, "active");
    return { childAccountId, childLoginEnabled: true };
  }

  if (childAccountId) {
    await updateAccountStatus(childAccountId, "disabled");
    await revokeAllRefreshTokens(childAccountId);
  }

  return { childAccountId, childLoginEnabled: false };
}

async function withChildLoginStatus(
  childLinks: ChildLink[],
  accountId?: string
): Promise<ChildLink[]> {
  const childAccountIds = uniqueStrings(
    childLinks.flatMap((link) => (link.childAccountId ? [link.childAccountId] : []))
  );

  if (childAccountIds.length === 0) {
    return childLinks.map((link) => withGuardianMetadata(link, accountId, false));
  }

  const accounts = await getCollection<Account>("accounts");
  const childAccounts = await accounts.find({ _id: { $in: childAccountIds } }).toArray();
  const childAccountById = new Map(childAccounts.map((account) => [account._id, account]));

  return childLinks.map((link) => ({
    ...withGuardianMetadata(
      link,
      accountId,
      link.childAccountId ? childAccountById.get(link.childAccountId)?.status === "active" : false
    )
  }));
}

async function getChildLoginEnabled(childAccountId?: string): Promise<boolean> {
  if (!childAccountId) {
    return false;
  }

  const accounts = await getCollection<Account>("accounts");
  const account = await accounts.findOne({ _id: childAccountId });

  return account?.status === "active";
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
        ...guardianAccessFilter(guardianAccountId),
        status: "active"
      })) ?? undefined
    );
  }

  if (input.studentId) {
    return (
      (await links.findOne({
        studentId: input.studentId,
        ...guardianAccessFilter(guardianAccountId),
        status: "active"
      })) ?? undefined
    );
  }

  return undefined;
}

function defaultTutorScopes(): LinkScope[] {
  return ["stats:read", "entries:create", "evidence:create", "reports:tutor"];
}

async function requireHeadGuardianChildLink(
  childLinkId: string,
  headGuardianAccountId: string
): Promise<ChildLink> {
  const childLinks = await getCollection<ChildLink>("child_links");
  const childLink = await childLinks.findOne({
    _id: childLinkId,
    guardianAccountId: headGuardianAccountId,
    status: "active"
  });

  if (!childLink) {
    throw notFound("Child record was not found, or only the head parent can manage guardian access.");
  }

  return childLink;
}

async function childGuardianAccessFromLink(childLink: ChildLink): Promise<ChildGuardianAccess[]> {
  const guardianLinks = await getCollection<GuardianLink>("guardian_links");
  const accounts = await getCollection<Account>("accounts");
  const guardianIds = childGuardianIds(childLink);
  const [linkedGuardians, guardianAccounts] = await Promise.all([
    guardianLinks
      .find({
        childLinkId: childLink._id,
        guardianAccountId: { $in: guardianIds },
        status: "active"
      })
      .toArray(),
    accounts.find({ _id: { $in: guardianIds } }).toArray()
  ]);
  const accountById = new Map(guardianAccounts.map((account) => [account._id, account]));
  const activatedAtByGuardianId = new Map(
    linkedGuardians.flatMap((link) =>
      link.guardianAccountId ? [[link.guardianAccountId, link.activatedAt ?? link.updatedAt] as const] : []
    )
  );

  return guardianIds
    .map((accountId) => {
      const account = accountById.get(accountId);

      return {
        accountId,
        displayName: account?.displayName,
        email: account?.email,
        isHeadGuardian: accountId === childLink.guardianAccountId,
        joinedAt:
          accountId === childLink.guardianAccountId
            ? childLink.activatedAt ?? childLink.createdAt
            : activatedAtByGuardianId.get(accountId)
      };
    })
    .sort((a, b) => {
      if (a.isHeadGuardian) {
        return -1;
      }

      if (b.isHeadGuardian) {
        return 1;
      }

      return (a.displayName ?? a.email ?? a.accountId).localeCompare(
        b.displayName ?? b.email ?? b.accountId
      );
    });
}

function childGuardianIds(link: ChildLink): string[] {
  return uniqueStrings([link.guardianAccountId, ...(link.guardianAccountIds ?? [])]);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function guardianAccessFilter(accountId: string) {
  return {
    $or: [{ guardianAccountId: accountId }, { guardianAccountIds: accountId }]
  };
}

function withGuardianMetadata(
  link: ChildLink,
  accountId: string | undefined,
  childLoginEnabled: boolean
): ChildLink {
  return {
    ...link,
    guardianAccountIds: uniqueStrings([link.guardianAccountId, ...(link.guardianAccountIds ?? [])]),
    isHeadGuardian: accountId ? link.guardianAccountId === accountId : undefined,
    childLoginEnabled
  };
}

function calculateAge(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) {
    return undefined;
  }

  const [year, month, day] = dateOfBirth.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDelta = today.getMonth() + 1 - month;

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < day)) {
    age -= 1;
  }

  return age >= 0 ? age : undefined;
}

async function createUniqueCode(): Promise<string> {
  const studentLinks = await getCollection<StudentLink>("student_links");
  const guardianLinks = await getCollection<GuardianLink>("guardian_links");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const [existingStudentLink, existingGuardianLink] = await Promise.all([
      studentLinks.findOne({ code }),
      guardianLinks.findOne({ code })
    ]);

    if (!existingStudentLink && !existingGuardianLink) {
      return code;
    }
  }

  throw badRequest("Could not allocate a unique link code. Try again.");
}
