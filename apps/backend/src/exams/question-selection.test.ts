import { describe, expect, it } from "vitest";

import {
  pickRandom,
  selectAttemptQuestions,
  shuffle,
} from "./question-selection.js";

const deterministicRandom = (maximumExclusive: number): number => {
  return maximumExclusive - 1;
};

describe("shuffle", () => {
  it("nie modyfikuje oryginalnej tablicy", () => {
    const source = [1, 2, 3, 4];

    const result = shuffle(source, deterministicRandom);

    expect(source).toEqual([1, 2, 3, 4]);
    expect(result).not.toBe(source);
  });
});

describe("pickRandom", () => {
  it("zwraca wskazaną liczbę elementów bez duplikatów", () => {
    const result = pickRandom(["a", "b", "c", "d"], 3, deterministicRandom);

    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
  });

  it("zgłasza błąd, gdy pula jest za mała", () => {
    expect(() => pickRandom(["a"], 2, deterministicRandom)).toThrow(
      "Nie można wylosować 2 elementów",
    );
  });
});

describe("selectAttemptQuestions", () => {
  const categories = [
    {
      id: "category-a",
      minimum_questions: 2,
    },
    {
      id: "category-b",
      minimum_questions: 1,
    },
  ];

  const questions = [
    {
      id: "a-1",
      category_id: "category-a",
    },
    {
      id: "a-2",
      category_id: "category-a",
    },
    {
      id: "a-3",
      category_id: "category-a",
    },
    {
      id: "b-1",
      category_id: "category-b",
    },
    {
      id: "b-2",
      category_id: "category-b",
    },
  ];

  it("zwraca właściwą liczbę pytań bez duplikatów", () => {
    const result = selectAttemptQuestions({
      categories,
      questions,
      randomQuestions: 1,
      questionsPerAttempt: 4,
      randomIndex: deterministicRandom,
    });

    expect(result).toHaveLength(4);

    expect(new Set(result.map((question) => question.id)).size).toBe(4);
  });

  it("respektuje minima pytań dla działów", () => {
    const result = selectAttemptQuestions({
      categories,
      questions,
      randomQuestions: 1,
      questionsPerAttempt: 4,
      randomIndex: deterministicRandom,
    });

    const categoryACount = result.filter(
      (question) => question.category_id === "category-a",
    ).length;

    const categoryBCount = result.filter(
      (question) => question.category_id === "category-b",
    ).length;

    expect(categoryACount).toBeGreaterThanOrEqual(2);

    expect(categoryBCount).toBeGreaterThanOrEqual(1);
  });

  it("zgłasza błąd przy niezgodnej konfiguracji liczby pytań", () => {
    expect(() =>
      selectAttemptQuestions({
        categories,
        questions,
        randomQuestions: 1,
        questionsPerAttempt: 5,
        randomIndex: deterministicRandom,
      }),
    ).toThrow("Wylosowana liczba pytań nie odpowiada konfiguracji egzaminu.");
  });

  it("zgłasza błąd, gdy dział ma za mało pytań", () => {
    expect(() =>
      selectAttemptQuestions({
        categories: [
          {
            id: "category-a",
            minimum_questions: 4,
          },
        ],
        questions: questions.filter(
          (question) => question.category_id === "category-a",
        ),
        randomQuestions: 0,
        questionsPerAttempt: 4,
        randomIndex: deterministicRandom,
      }),
    ).toThrow("Nie można wylosować 4 elementów");
  });
});
