import { randomInt } from "node:crypto";

export type SelectionCategory = {
  id: string;
  minimum_questions: number;
};

export type SelectionQuestion = {
  id: string;
  category_id: string;
};

type RandomIndexGenerator = (
  maximumExclusive: number,
) => number;

function createCryptoRandomIndex(
  maximumExclusive: number,
): number {
  return randomInt(maximumExclusive);
}

export function shuffle<T>(
  values: readonly T[],
  randomIndex: RandomIndexGenerator =
    createCryptoRandomIndex,
): T[] {
  const result = [...values];

  for (
    let index = result.length - 1;
    index > 0;
    index -= 1
  ) {
    const selectedIndex = randomIndex(index + 1);

    [
      result[index],
      result[selectedIndex],
    ] = [
      result[selectedIndex],
      result[index],
    ];
  }

  return result;
}

export function pickRandom<T>(
  values: readonly T[],
  count: number,
  randomIndex?: RandomIndexGenerator,
): T[] {
  if (count > values.length) {
    throw new Error(
      `Nie można wylosować ${count} elementów z puli zawierającej ${values.length} elementów.`,
    );
  }

  return shuffle(values, randomIndex).slice(
    0,
    count,
  );
}

export function selectAttemptQuestions(input: {
  categories: readonly SelectionCategory[];
  questions: readonly SelectionQuestion[];
  randomQuestions: number;
  questionsPerAttempt: number;
  randomIndex?: RandomIndexGenerator;
}): SelectionQuestion[] {
  const selectedQuestionIds =
    new Set<string>();

  const minimumQuestions: SelectionQuestion[] =
    [];

  for (const category of input.categories) {
    const categoryPool = input.questions.filter(
      (question) =>
        question.category_id === category.id &&
        !selectedQuestionIds.has(question.id),
    );

    const selectedFromCategory = pickRandom(
      categoryPool,
      category.minimum_questions,
      input.randomIndex,
    );

    for (const question of selectedFromCategory) {
      selectedQuestionIds.add(question.id);
      minimumQuestions.push(question);
    }
  }

  const remainingPool = input.questions.filter(
    (question) =>
      !selectedQuestionIds.has(question.id),
  );

  const additionalQuestions = pickRandom(
    remainingPool,
    input.randomQuestions,
    input.randomIndex,
  );

  const selectedQuestions = shuffle(
    [
      ...minimumQuestions,
      ...additionalQuestions,
    ],
    input.randomIndex,
  );

  if (
    selectedQuestions.length !==
    input.questionsPerAttempt
  ) {
    throw new Error(
      "Wylosowana liczba pytań nie odpowiada konfiguracji egzaminu.",
    );
  }

  return selectedQuestions;
}