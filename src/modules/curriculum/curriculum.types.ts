export interface CurriculumStandard {
  _id: string;
  subject: string;
  keyStage: string;
  yearGroup?: string;
  code: string;
  topic: string;
  description: string;
  source: "national-curriculum" | "custom";
}
