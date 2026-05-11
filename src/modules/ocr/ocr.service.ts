import { Subject } from "../diary/diary.types";

export interface OcrInferenceInput {
  text?: string;
  imageObjectKey?: string;
}

export interface OcrInferenceResult {
  confidence: number;
  needsHumanReview: boolean;
  inferred: {
    title: string;
    subject: Subject;
    curriculumTags: Array<{
      subject: string;
      topic: string;
      confidence: number;
    }>;
  };
}

export async function inferActivity(input: OcrInferenceInput): Promise<OcrInferenceResult> {
  const text = input.text?.toLowerCase() ?? "";
  const subject = inferSubject(text);
  const topic = inferTopic(text, subject);
  const confidence = text ? 0.72 : 0.35;

  return {
    confidence,
    needsHumanReview: confidence < 0.7,
    inferred: {
      title: topic ? `${subjectLabel(subject)}: ${topic}` : "Uploaded learning evidence",
      subject,
      curriculumTags: topic
        ? [
            {
              subject,
              topic,
              confidence
            }
          ]
        : []
    }
  };
}

function inferSubject(text: string): Subject {
  if (/(fraction|decimal|algebra|number|times table|geometry)/.test(text)) {
    return "maths";
  }

  if (/(read|writing|grammar|story|sentence|phonics)/.test(text)) {
    return "english";
  }

  if (/(experiment|biology|chemistry|physics|force|plant)/.test(text)) {
    return "science";
  }

  if (/(training|skating|football|fitness|exercise|sport)/.test(text)) {
    return "pe";
  }

  return "other";
}

function inferTopic(text: string, subject: Subject): string | undefined {
  const topicMatches: Record<Subject, Array<[RegExp, string]>> = {
    maths: [
      [/fraction/, "Fractions"],
      [/decimal/, "Decimals"],
      [/algebra/, "Algebra"],
      [/geometry/, "Geometry"]
    ],
    english: [
      [/grammar/, "Grammar"],
      [/phonics/, "Phonics"],
      [/story|writing/, "Creative writing"],
      [/read/, "Reading"]
    ],
    science: [
      [/plant/, "Plants"],
      [/force/, "Forces"],
      [/experiment/, "Scientific enquiry"]
    ],
    pe: [
      [/skating/, "Skating"],
      [/fitness|exercise|training/, "Fitness"],
      [/football/, "Football"]
    ],
    art: [],
    humanities: [],
    "life-skills": [],
    other: []
  };

  return topicMatches[subject].find(([pattern]) => pattern.test(text))?.[1];
}

function subjectLabel(subject: Subject): string {
  return subject
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
