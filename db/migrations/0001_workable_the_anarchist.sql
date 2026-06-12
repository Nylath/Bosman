CREATE TYPE "public"."exam_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"source_label" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_question_id_position_unique" UNIQUE("question_id","position"),
	CONSTRAINT "answers_position_not_negative" CHECK ("answers"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_version_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"minimum_questions" integer,
	CONSTRAINT "categories_exam_version_id_slug_unique" UNIQUE("exam_version_id","slug"),
	CONSTRAINT "categories_exam_version_id_position_unique" UNIQUE("exam_version_id","position"),
	CONSTRAINT "categories_position_not_negative" CHECK ("categories"."position" >= 0),
	CONSTRAINT "categories_minimum_questions_not_negative" CHECK ("categories"."minimum_questions" IS NULL OR "categories"."minimum_questions" >= 0)
);
--> statement-breakpoint
CREATE TABLE "exam_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "exam_version_status" DEFAULT 'draft' NOT NULL,
	"duration_minutes" integer,
	"questions_per_attempt" integer,
	"passing_score" integer,
	"answers_per_question" integer NOT NULL,
	"random_questions" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "exam_versions_exam_id_version_number_unique" UNIQUE("exam_id","version_number"),
	CONSTRAINT "exam_versions_version_number_positive" CHECK ("exam_versions"."version_number" > 0),
	CONSTRAINT "exam_versions_duration_minutes_positive" CHECK ("exam_versions"."duration_minutes" IS NULL OR "exam_versions"."duration_minutes" > 0),
	CONSTRAINT "exam_versions_questions_per_attempt_positive" CHECK ("exam_versions"."questions_per_attempt" IS NULL OR "exam_versions"."questions_per_attempt" > 0),
	CONSTRAINT "exam_versions_passing_score_positive" CHECK ("exam_versions"."passing_score" IS NULL OR "exam_versions"."passing_score" > 0),
	CONSTRAINT "exam_versions_passing_score_not_too_high" CHECK ("exam_versions"."passing_score" IS NULL
        OR "exam_versions"."questions_per_attempt" IS NULL
        OR "exam_versions"."passing_score" <= "exam_versions"."questions_per_attempt"),
	CONSTRAINT "exam_versions_answers_per_question_positive" CHECK ("exam_versions"."answers_per_question" > 0),
	CONSTRAINT "exam_versions_random_questions_not_negative" CHECK ("exam_versions"."random_questions" IS NULL OR "exam_versions"."random_questions" >= 0)
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tile_image_path" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_organization_id_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_version_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"text" text NOT NULL,
	"image_path" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_exam_version_id_external_id_unique" UNIQUE("exam_version_id","external_id"),
	CONSTRAINT "questions_category_id_position_unique" UNIQUE("category_id","position"),
	CONSTRAINT "questions_position_not_negative" CHECK ("questions"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_exam_version_id_exam_versions_id_fk" FOREIGN KEY ("exam_version_id") REFERENCES "public"."exam_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_versions" ADD CONSTRAINT "exam_versions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_version_id_exam_versions_id_fk" FOREIGN KEY ("exam_version_id") REFERENCES "public"."exam_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_question_id_idx" ON "answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_one_correct_per_question_idx" ON "answers" USING btree ("question_id") WHERE "answers"."is_correct" = true;--> statement-breakpoint
CREATE INDEX "categories_exam_version_id_idx" ON "categories" USING btree ("exam_version_id");--> statement-breakpoint
CREATE INDEX "exam_versions_exam_id_idx" ON "exam_versions" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "exams_organization_id_idx" ON "exams" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "questions_exam_version_id_idx" ON "questions" USING btree ("exam_version_id");--> statement-breakpoint
CREATE INDEX "questions_category_id_idx" ON "questions" USING btree ("category_id");