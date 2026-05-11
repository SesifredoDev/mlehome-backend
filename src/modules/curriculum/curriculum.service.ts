import { Filter } from "mongodb";

import { getCollection } from "../../db/mongo";
import { CurriculumStandard } from "./curriculum.types";

const fallbackStandards: CurriculumStandard[] = [
  {
    _id: "fallback_ks1_maths_number",
    subject: "maths",
    keyStage: "KS1",
    code: "KS1-MATHS-NUMBER",
    topic: "Number",
    description: "Number and place value, addition, subtraction, multiplication, and division.",
    source: "national-curriculum"
  },
  {
    _id: "fallback_ks2_english_reading",
    subject: "english",
    keyStage: "KS2",
    code: "KS2-ENGLISH-READING",
    topic: "Reading",
    description: "Word reading, comprehension, and discussion of texts.",
    source: "national-curriculum"
  },
  {
    _id: "fallback_ks3_science_working_scientifically",
    subject: "science",
    keyStage: "KS3",
    code: "KS3-SCIENCE-WORKING-SCIENTIFICALLY",
    topic: "Working scientifically",
    description: "Scientific attitudes, experimental skills, investigations, analysis, and evaluation.",
    source: "national-curriculum"
  },
  {
    _id: "fallback_pe_physical_activity",
    subject: "pe",
    keyStage: "All",
    code: "PE-PHYSICAL-ACTIVITY",
    topic: "Physical activity",
    description: "Structured physical education, training, sport, or movement activity.",
    source: "custom"
  }
];

interface ListStandardsInput {
  subject?: string;
  keyStage?: string;
  limit?: number;
}

export async function listCurriculumStandards(
  input: ListStandardsInput
): Promise<CurriculumStandard[]> {
  const standards = await getCollection<CurriculumStandard>("curriculum_standards");
  const filter: Filter<CurriculumStandard> = {};

  if (input.subject) {
    filter.subject = input.subject;
  }

  if (input.keyStage) {
    filter.keyStage = input.keyStage;
  }

  const records = await standards.find(filter).limit(input.limit ?? 100).toArray();

  if (records.length > 0) {
    return records;
  }

  return fallbackStandards.filter((standard) => {
    if (input.subject && standard.subject !== input.subject) {
      return false;
    }

    if (input.keyStage && standard.keyStage !== input.keyStage) {
      return false;
    }

    return true;
  });
}
