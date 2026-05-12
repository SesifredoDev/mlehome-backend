import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { requireAccount } from "../../plugins/requestContext";
import { getCollection } from "../../db/mongo";
import { forbidden } from "../../shared/apiError";
import { listStudentLinksForAccount, requireTutorStudentScope } from "../auth/auth.service";
import { ChildLink } from "../auth/auth.types";
import { generateTutorStatsReport } from "../reports/report.service";

const studentParamsSchema = z.object({
  studentId: z.string().min(1)
});

export const tutorRoutes: FastifyPluginAsync = async (app) => {
  app.get("/students", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "tutor") {
      throw forbidden("Only tutor accounts can list tutor students.");
    }

    const links = await listStudentLinksForAccount(account.accountId, "tutor");
    const activeLinks = links.filter((link) => link.status === "active");
    const childLinksCollection = await getCollection<ChildLink>("child_links");
    const childLinks = await childLinksCollection
      .find({
        status: "active",
        studentId: { $in: activeLinks.map((link) => link.studentId) }
      })
      .toArray();
    const childLinkById = new Map(childLinks.map((link) => [link._id, link]));
    const childLinkByStudentId = new Map(
      childLinks.flatMap((link) => (link.studentId ? [[link.studentId, link] as const] : []))
    );

    return {
      data: activeLinks
        .flatMap((link) => {
          const childLink =
            (link.childLinkId ? childLinkById.get(link.childLinkId) : undefined) ??
            childLinkByStudentId.get(link.studentId);

          if (!childLink) {
            return [];
          }

          return {
            studentId: link.studentId,
            studentName: childLink?.studentName ?? link.studentId,
            keyStage: childLink?.keyStage,
            year: childLink?.year,
            guardianAccountId: link.guardianAccountId,
            childLinkId: childLink._id,
            scopes: link.scopes,
            activatedAt: link.activatedAt
          };
        })
    };
  });

  app.get("/students/:studentId/summary", async (request) => {
    const account = requireAccount(request);
    const params = studentParamsSchema.parse(request.params);

    if (account.role === "tutor") {
      await requireTutorStudentScope(account.accountId, params.studentId, "stats:read");
    }

    const report = await generateTutorStatsReport(params.studentId, {});

    return { data: report };
  });
};
