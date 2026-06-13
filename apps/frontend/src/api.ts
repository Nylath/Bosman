export class ApiError extends Error {
  public readonly status: number;

  public constructor(
    status: number,
    message: string,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}

export type PublicExam = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tileImageUrl: string | null;

  version: {
    id: string;
    number: number;
    durationMinutes: number;
    questionsPerAttempt: number;
    passingScore: number;
    answersPerQuestion: number;
  };
};

export type AttemptAnswer = {
  id: string;
  text: string;
};

export type AttemptQuestion = {
  attemptQuestionId: string;
  externalId: string;
  position: number;
  number: number;
  text: string;
  imageUrl: string | null;
  answers: AttemptAnswer[];
};

export type Attempt = {
  id: string;

  status:
    | "in_progress"
    | "completed"
    | "expired"
    | "cancelled";

  exam: {
    slug: string;
    name: string;
  };

  totalQuestions: number;
  currentQuestionPosition: number;
  startedAt: string;
  expiresAt: string;
  currentQuestion: AttemptQuestion | null;
};

export type AttemptResult = {
  id: string;
  status: "completed" | "expired";

  exam: {
    slug: string;
    name: string;
  };

  score: number;
  totalQuestions: number;
  passed: boolean;
  elapsedSeconds: number;
  startedAt: string;
  finishedAt: string;
};

export type AttemptMistake = {
  number: number;
  externalId: string;
  text: string;
  imageUrl: string | null;

  selectedAnswer: null | {
    id: string;
    text: string;
  };

  correctAnswer: {
    id: string;
    text: string;
  };
};

export type AdminSession = {
  authenticated: true;
  expiresAt: string;
};

export type AdminExam = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tileImagePath: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminImportReport = {
  errors: string[];
  publicationBlockers: string[];
  warnings: string[];
  information: string[];
};

export type AdminImportResult = {
  imported: boolean;
  canImportAsDraft: boolean;
  canPublish: boolean;
  report: AdminImportReport;

  exam?: {
    id: string;
    versionId: string;
    versionNumber: number;
  };

  importedData?: {
    categories: number;
    questions: number;
    answers: number;
    assets: number;
  };
};

type PublishedExamsResponse = {
  exams: PublicExam[];
};

type PublishedExamResponse = {
  exam: PublicExam;
};

type StartAttemptResponse = {
  status: "ready";
  created: boolean;
  attempt: Attempt;
};

type GetAttemptResponse = {
  attempt: Attempt;
};

type SubmitAttemptAnswerResponse =
  | {
      status: "next_question";
      attempt: Attempt;
    }
  | {
      status: "finished";
      result: AttemptResult;
    };

type GetAttemptResultResponse = {
  result: AttemptResult;
};

type GetAttemptMistakesResponse = {
  mistakes: AttemptMistake[];
};

type GetAttemptHistoryResponse = {
  attempts: AttemptResult[];
};

type GetAdminExamsResponse = {
  exams: AdminExam[];
};

async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    let message =
      "Nie udało się pobrać danych z serwera.";

    try {
      const body = (await response.json()) as {
        message?: string;
      };

      if (body.message) {
        message = body.message;
      }
    } catch {
      // Serwer nie zwrócił poprawnego JSON-a.
    }

    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export async function getPublishedExams(): Promise<
  PublicExam[]
> {
  const response =
    await requestJson<PublishedExamsResponse>(
      "/api/exams",
    );

  return response.exams;
}

export async function getPublishedExam(
  slug: string,
): Promise<PublicExam> {
  const response =
    await requestJson<PublishedExamResponse>(
      `/api/exams/${encodeURIComponent(slug)}`,
    );

  return response.exam;
}

export async function startOrResumeAttempt(
  slug: string,
): Promise<StartAttemptResponse> {
  return requestJson<StartAttemptResponse>(
    `/api/exams/${encodeURIComponent(slug)}/attempts`,
    {
      method: "POST",
    },
  );
}

export async function getAttempt(
  attemptId: string,
): Promise<Attempt> {
  const response =
    await requestJson<GetAttemptResponse>(
      `/api/attempts/${encodeURIComponent(attemptId)}`,
    );

  return response.attempt;
}

export async function submitAttemptAnswer(input: {
  attemptId: string;
  attemptQuestionId: string;
  selectedAnswerId: string;
}): Promise<SubmitAttemptAnswerResponse> {
  return requestJson<SubmitAttemptAnswerResponse>(
    `/api/attempts/${encodeURIComponent(input.attemptId)}/answers`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        attemptQuestionId: input.attemptQuestionId,
        selectedAnswerId: input.selectedAnswerId,
      }),
    },
  );
}

export async function getAttemptResult(
  attemptId: string,
): Promise<AttemptResult> {
  const response =
    await requestJson<GetAttemptResultResponse>(
      `/api/attempts/${encodeURIComponent(attemptId)}/result`,
    );

  return response.result;
}

export async function getAttemptMistakes(
  attemptId: string,
): Promise<AttemptMistake[]> {
  const response =
    await requestJson<GetAttemptMistakesResponse>(
      `/api/attempts/${encodeURIComponent(attemptId)}/mistakes`,
    );

  return response.mistakes;
}

export async function getAttemptHistory(): Promise<
  AttemptResult[]
> {
  const response =
    await requestJson<GetAttemptHistoryResponse>(
      "/api/history",
    );

  return response.attempts;
}

export async function loginAdmin(
  password: string,
): Promise<AdminSession> {
  return requestJson<AdminSession>(
    "/api/admin/auth/login",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        password,
      }),
    },
  );
}

export async function getAdminSession(): Promise<
  AdminSession
> {
  return requestJson<AdminSession>(
    "/api/admin/auth/session",
  );
}

export async function logoutAdmin(): Promise<void> {
  await requestJson<{
    authenticated: false;
  }>("/api/admin/auth/logout", {
    method: "POST",
  });
}

export async function getAdminExams(): Promise<
  AdminExam[]
> {
  const response =
    await requestJson<GetAdminExamsResponse>(
      "/api/admin/exams",
    );

  return response.exams;
}

export async function importAdminExamPackage(
  file: File,
): Promise<AdminImportResult> {
  const formData = new FormData();

  formData.append("package", file);

  return requestJson<AdminImportResult>(
    "/api/admin/exams/import",
    {
      method: "POST",
      body: formData,
    },
  );
}

export type AdminExamVersionStatus =
  | "draft"
  | "published"
  | "archived";

export type AdminExamVersionSummary = {
  id: string;
  versionNumber: number;
  status: AdminExamVersionStatus;
  durationMinutes: number | null;
  questionsPerAttempt: number | null;
  passingScore: number | null;
  answersPerQuestion: number;
  randomQuestions: number | null;
  createdAt: string;
  publishedAt: string | null;
};

export type AdminExamVersionCategory = {
  id: string;
  slug: string;
  name: string;
  position: number;
  minimumQuestions: number | null;
  questionCount: number;
};

export type AdminPublicationValidation = {
  canPublish: boolean;
  blockers: string[];

  statistics: {
    categories: number;
    questions: number;
    invalidQuestions: number;
  };
};

export type AdminExamVersionDetails = {
  id: string;

  exam: {
    id: string;
    slug: string;
    name: string;
  };

  versionNumber: number;
  status: AdminExamVersionStatus;
  durationMinutes: number | null;
  questionsPerAttempt: number | null;
  passingScore: number | null;
  answersPerQuestion: number;
  randomQuestions: number | null;
  createdAt: string;
  publishedAt: string | null;
  categories: AdminExamVersionCategory[];
  publication: AdminPublicationValidation;
};

export type AdminExamVersionConfiguration = {
  durationMinutes: number | null;
  questionsPerAttempt: number | null;
  passingScore: number | null;
  randomQuestions: number | null;

  categories: Array<{
    id: string;
    minimumQuestions: number | null;
  }>;
};

type GetAdminExamVersionsResponse = {
  versions: AdminExamVersionSummary[];
};

type GetAdminExamVersionResponse = {
  version: AdminExamVersionDetails;
};

export async function getAdminExamVersions(
  examId: string,
): Promise<AdminExamVersionSummary[]> {
  const response =
    await requestJson<GetAdminExamVersionsResponse>(
      `/api/admin/exams/${encodeURIComponent(examId)}/versions`,
    );

  return response.versions;
}

export async function getAdminExamVersion(
  versionId: string,
): Promise<AdminExamVersionDetails> {
  const response =
    await requestJson<GetAdminExamVersionResponse>(
      `/api/admin/exam-versions/${encodeURIComponent(versionId)}`,
    );

  return response.version;
}

export async function updateAdminExamVersionConfiguration(
  versionId: string,
  configuration: AdminExamVersionConfiguration,
): Promise<AdminExamVersionDetails> {
  const response =
    await requestJson<GetAdminExamVersionResponse>(
      `/api/admin/exam-versions/${encodeURIComponent(versionId)}/configuration`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(configuration),
      },
    );

  return response.version;
}

export async function publishAdminExamVersion(
  versionId: string,
): Promise<AdminExamVersionDetails> {
  const response =
    await requestJson<GetAdminExamVersionResponse>(
      `/api/admin/exam-versions/${encodeURIComponent(versionId)}/publish`,
      {
        method: "POST",
      },
    );

  return response.version;
}

type UpdateAdminExamActiveResponse = {
  exam: AdminExam;
};

export async function updateAdminExamActive(
  examId: string,
  isActive: boolean,
): Promise<AdminExam> {
  const response =
    await requestJson<UpdateAdminExamActiveResponse>(
      `/api/admin/exams/${encodeURIComponent(examId)}/active`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          isActive,
        }),
      },
    );

  return response.exam;
}

type GetActiveAttemptResponse = {
  attempt: Attempt | null;
};

type CancelAttemptResponse = {
  status: "cancelled";
};

export async function getActiveAttemptForExam(
  slug: string,
): Promise<Attempt | null> {
  const response =
    await requestJson<GetActiveAttemptResponse>(
      `/api/exams/${encodeURIComponent(slug)}/attempts/active`,
    );

  return response.attempt;
}

export async function cancelAttempt(
  attemptId: string,
): Promise<void> {
  await requestJson<CancelAttemptResponse>(
    `/api/attempts/${encodeURIComponent(attemptId)}/cancel`,
    {
      method: "POST",
    },
  );
}