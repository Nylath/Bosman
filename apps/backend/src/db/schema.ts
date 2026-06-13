import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const examVersionStatus = pgEnum("exam_version_status", [
  "draft",
  "published",
  "archived",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    slug: text("slug").notNull(),

    name: text("name").notNull(),

    description: text("description"),

    tileImagePath: text("tile_image_path"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exams_organization_id_idx").on(table.organizationId),

    unique("exams_organization_id_slug_unique").on(
      table.organizationId,
      table.slug,
    ),
  ],
);

export const examVersions = pgTable(
  "exam_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, {
        onDelete: "restrict",
      }),

    versionNumber: integer("version_number").notNull(),

    status: examVersionStatus("status").notNull().default("draft"),

    tileImagePath: text("tile_image_path"),

    durationMinutes: integer("duration_minutes"),

    questionsPerAttempt: integer("questions_per_attempt"),

    passingScore: integer("passing_score"),

    answersPerQuestion: integer("answers_per_question").notNull(),

    randomQuestions: integer("random_questions"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    publishedAt: timestamp("published_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("exam_versions_exam_id_idx").on(table.examId),

    unique("exam_versions_exam_id_version_number_unique").on(
      table.examId,
      table.versionNumber,
    ),

    check(
      "exam_versions_version_number_positive",
      sql`${table.versionNumber} > 0`,
    ),

    check(
      "exam_versions_duration_minutes_positive",
      sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} > 0`,
    ),

    check(
      "exam_versions_questions_per_attempt_positive",
      sql`${table.questionsPerAttempt} IS NULL OR ${table.questionsPerAttempt} > 0`,
    ),

    check(
      "exam_versions_passing_score_positive",
      sql`${table.passingScore} IS NULL OR ${table.passingScore} > 0`,
    ),

    check(
      "exam_versions_passing_score_not_too_high",
      sql`${table.passingScore} IS NULL
        OR ${table.questionsPerAttempt} IS NULL
        OR ${table.passingScore} <= ${table.questionsPerAttempt}`,
    ),

    check(
      "exam_versions_answers_per_question_positive",
      sql`${table.answersPerQuestion} > 0`,
    ),

    check(
      "exam_versions_random_questions_not_negative",
      sql`${table.randomQuestions} IS NULL OR ${table.randomQuestions} >= 0`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    examVersionId: uuid("exam_version_id")
      .notNull()
      .references(() => examVersions.id, {
        onDelete: "restrict",
      }),

    slug: text("slug").notNull(),

    name: text("name").notNull(),

    position: integer("position").notNull(),

    minimumQuestions: integer("minimum_questions"),
  },
  (table) => [
    index("categories_exam_version_id_idx").on(table.examVersionId),

    unique("categories_exam_version_id_slug_unique").on(
      table.examVersionId,
      table.slug,
    ),

    unique("categories_exam_version_id_position_unique").on(
      table.examVersionId,
      table.position,
    ),

    check("categories_position_not_negative", sql`${table.position} >= 0`),

    check(
      "categories_minimum_questions_not_negative",
      sql`${table.minimumQuestions} IS NULL OR ${table.minimumQuestions} >= 0`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    examVersionId: uuid("exam_version_id")
      .notNull()
      .references(() => examVersions.id, {
        onDelete: "restrict",
      }),

    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, {
        onDelete: "restrict",
      }),

    externalId: text("external_id").notNull(),

    text: text("text").notNull(),

    imagePath: text("image_path"),

    position: integer("position").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("questions_exam_version_id_idx").on(table.examVersionId),

    index("questions_category_id_idx").on(table.categoryId),

    unique("questions_exam_version_id_external_id_unique").on(
      table.examVersionId,
      table.externalId,
    ),

    unique("questions_category_id_position_unique").on(
      table.categoryId,
      table.position,
    ),

    check("questions_position_not_negative", sql`${table.position} >= 0`),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, {
        onDelete: "restrict",
      }),

    text: text("text").notNull(),

    isCorrect: boolean("is_correct").notNull().default(false),

    sourceLabel: text("source_label"),

    position: integer("position").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("answers_question_id_idx").on(table.questionId),

    unique("answers_question_id_position_unique").on(
      table.questionId,
      table.position,
    ),

    uniqueIndex("answers_one_correct_per_question_idx")
      .on(table.questionId)
      .where(sql`${table.isCorrect} = true`),

    check("answers_position_not_negative", sql`${table.position} >= 0`),
  ],
);

export const courseStatus = pgEnum("course_status", [
  "draft",
  "active",
  "archived",
]);

export const participantKind = pgEnum("participant_kind", [
  "local",
  "course",
]);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    name: text("name").notNull(),

    status: courseStatus("status").notNull().default("draft"),

    startsAt: timestamp("starts_at", {
      withTimezone: true,
    }),

    endsAt: timestamp("ends_at", {
      withTimezone: true,
    }),

    participantAccessExpiresAt: timestamp("participant_access_expires_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("courses_organization_id_idx").on(table.organizationId),

    check(
      "courses_dates_valid",
      sql`${table.endsAt} IS NULL
        OR ${table.startsAt} IS NULL
        OR ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const courseExams = pgTable(
  "course_exams",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "restrict",
      }),

    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, {
        onDelete: "restrict",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.courseId, table.examId],
      name: "course_exams_pk",
    }),

    index("course_exams_exam_id_idx").on(table.examId),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),

    kind: participantKind("kind").notNull(),

    label: text("label").notNull(),

    isActive: boolean("is_active").notNull().default(true),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("participants_organization_id_idx").on(table.organizationId),

    index("participants_course_id_idx").on(table.courseId),

    unique("participants_course_id_label_unique").on(
      table.courseId,
      table.label,
    ),

    uniqueIndex("participants_one_local_per_organization_idx")
      .on(table.organizationId)
      .where(sql`${table.kind} = 'local'`),

    check(
      "participants_kind_course_relation_valid",
      sql`(
        ${table.kind} = 'local'
        AND ${table.courseId} IS NULL
      ) OR (
        ${table.kind} = 'course'
        AND ${table.courseId} IS NOT NULL
      )`,
    ),
  ],
);

export const participantAccessCodes = pgTable(
  "participant_access_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, {
        onDelete: "cascade",
      }),

    codeHash: text("code_hash").notNull().unique(),

    isActive: boolean("is_active").notNull().default(true),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("participant_access_codes_participant_id_idx").on(
      table.participantId,
    ),
  ],
);

export const participantSessions = pgTable(
  "participant_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("participant_sessions_participant_id_idx").on(table.participantId),

    index("participant_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_sessions_organization_id_idx").on(table.organizationId),

    index("admin_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const attemptStatus = pgEnum("attempt_status", [
  "in_progress",
  "completed",
  "expired",
  "cancelled",
]);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, {
        onDelete: "restrict",
      }),

    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),

    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, {
        onDelete: "restrict",
      }),

    examVersionId: uuid("exam_version_id")
      .notNull()
      .references(() => examVersions.id, {
        onDelete: "restrict",
      }),

    status: attemptStatus("status").notNull().default("in_progress"),

    totalQuestions: integer("total_questions").notNull(),

    currentQuestionPosition: integer("current_question_position")
      .notNull()
      .default(0),

    score: integer("score"),

    passed: boolean("passed"),

    elapsedSeconds: integer("elapsed_seconds"),

    startedAt: timestamp("started_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    finishedAt: timestamp("finished_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attempts_organization_id_idx").on(table.organizationId),

    index("attempts_participant_id_idx").on(table.participantId),

    index("attempts_course_id_idx").on(table.courseId),

    index("attempts_exam_id_idx").on(table.examId),

    index("attempts_exam_version_id_idx").on(table.examVersionId),

    index("attempts_status_idx").on(table.status),

    uniqueIndex("attempts_one_active_per_participant_exam_idx")
      .on(table.participantId, table.examId)
      .where(sql`${table.status} = 'in_progress'`),

    check(
      "attempts_total_questions_positive",
      sql`${table.totalQuestions} > 0`,
    ),

    check(
      "attempts_current_question_position_not_negative",
      sql`${table.currentQuestionPosition} >= 0`,
    ),

    check(
      "attempts_score_valid",
      sql`${table.score} IS NULL
        OR (
          ${table.score} >= 0
          AND ${table.score} <= ${table.totalQuestions}
        )`,
    ),

    check(
      "attempts_elapsed_seconds_not_negative",
      sql`${table.elapsedSeconds} IS NULL OR ${table.elapsedSeconds} >= 0`,
    ),

    check(
      "attempts_expiration_after_start",
      sql`${table.expiresAt} > ${table.startedAt}`,
    ),
  ],
);

export const attemptQuestions = pgTable(
  "attempt_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, {
        onDelete: "cascade",
      }),

    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, {
        onDelete: "restrict",
      }),

    position: integer("position").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attempt_questions_attempt_id_idx").on(table.attemptId),

    index("attempt_questions_question_id_idx").on(table.questionId),

    unique("attempt_questions_attempt_id_position_unique").on(
      table.attemptId,
      table.position,
    ),

    unique("attempt_questions_attempt_id_question_id_unique").on(
      table.attemptId,
      table.questionId,
    ),

    check(
      "attempt_questions_position_not_negative",
      sql`${table.position} >= 0`,
    ),
  ],
);

export const attemptQuestionOptions = pgTable(
  "attempt_question_options",
  {
    attemptQuestionId: uuid("attempt_question_id")
      .notNull()
      .references(() => attemptQuestions.id, {
        onDelete: "cascade",
      }),

    answerId: uuid("answer_id")
      .notNull()
      .references(() => answers.id, {
        onDelete: "restrict",
      }),

    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.attemptQuestionId, table.answerId],
      name: "attempt_question_options_pk",
    }),

    index("attempt_question_options_answer_id_idx").on(table.answerId),

    unique("attempt_question_options_question_id_position_unique").on(
      table.attemptQuestionId,
      table.position,
    ),

    check(
      "attempt_question_options_position_not_negative",
      sql`${table.position} >= 0`,
    ),
  ],
);

export const attemptResponses = pgTable(
  "attempt_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    attemptQuestionId: uuid("attempt_question_id").notNull(),

    selectedAnswerId: uuid("selected_answer_id").notNull(),

    answeredAt: timestamp("answered_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("attempt_responses_attempt_question_id_unique").on(
      table.attemptQuestionId,
    ),

    index("attempt_responses_selected_answer_id_idx").on(
      table.selectedAnswerId,
    ),

    foreignKey({
      name: "attempt_responses_selected_option_fk",
      columns: [table.attemptQuestionId, table.selectedAnswerId],
      foreignColumns: [
        attemptQuestionOptions.attemptQuestionId,
        attemptQuestionOptions.answerId,
      ],
    }).onDelete("cascade"),
  ],
);

export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    clientKeyHash: text("client_key_hash").notNull(),

    wasSuccessful: boolean("was_successful")
      .notNull()
      .default(false),

    attemptedAt: timestamp("attempted_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_login_attempts_lookup_idx").on(
      table.organizationId,
      table.clientKeyHash,
      table.attemptedAt,
    ),
  ],
);