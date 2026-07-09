export interface Rubric {
  capability: string;
  criteria: string[];
  passThreshold: number; // 0-100
}

export const RUBRICS: Record<string, Rubric> = {
  research: {
    capability: "research",
    criteria: [
      "Directly answers the task, not a generic tangent",
      "Claims are plausible and internally consistent",
      "Uncertain claims are flagged rather than stated as fact",
      "No fabricated sources or invented statistics",
    ],
    passThreshold: 70,
  },
  echo: {
    capability: "echo",
    criteria: ["Response is valid, non-empty JSON"],
    passThreshold: 50,
  },
  default: {
    capability: "default",
    criteria: ["Response is relevant to the requested task", "Response is non-empty and well-formed"],
    passThreshold: 60,
  },
};

export function rubricFor(capability: string): Rubric {
  return RUBRICS[capability] ?? RUBRICS.default;
}
