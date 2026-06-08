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

  if (/(physics|phys|force|motion|energy|electricity|circuit|wave|magnet)/.test(text)) {
    return "physics";
  }

  if (/(chemistry|chem|atom|element|compound|reaction|acid|alkali|molecule|periodic table)/.test(text)) {
    return "chemistry";
  }

  if (/(biology|bio|cell|organism|ecosystem|photosynthesis|plant|digestion|genetics)/.test(text)) {
    return "biology";
  }

  if (/(computing|computer science|comp|coding|programming|algorithm|python|javascript|scratch|html|css)/.test(text)) {
    return "computing";
  }

  if (/(experiment|science|scientific enquiry|laboratory|lab)/.test(text)) {
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
      [/experiment/, "Scientific enquiry"]
    ],
    physics: [
      [/force/, "Forces"],
      [/electricity|circuit/, "Electricity"],
      [/energy/, "Energy"],
      [/wave|sound|light/, "Waves"]
    ],
    chemistry: [
      [/acid|alkali/, "Acids and alkalis"],
      [/atom|element|periodic table/, "Atoms and elements"],
      [/reaction/, "Chemical reactions"]
    ],
    biology: [
      [/plant|photosynthesis/, "Plants"],
      [/cell/, "Cells"],
      [/ecosystem/, "Ecosystems"],
      [/digestion|respiration/, "Human biology"]
    ],
    computing: [
      [/algorithm/, "Algorithms"],
      [/python|javascript|scratch|coding|programming/, "Programming"],
      [/html|css/, "Web development"],
      [/data|database/, "Data"]
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
