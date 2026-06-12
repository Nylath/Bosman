CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "attempt_question_options" (
	"attempt_question_id" uuid NOT NULL,
	"answer_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "attempt_question_options_pk" PRIMARY KEY("attempt_question_id","answer_id"),
	CONSTRAINT "attempt_question_options_question_id_position_unique" UNIQUE("attempt_question_id","position"),
	CONSTRAINT "attempt_question_options_position_not_negative" CHECK ("attempt_question_options"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "attempt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_questions_attempt_id_position_unique" UNIQUE("attempt_id","position"),
	CONSTRAINT "attempt_questions_attempt_id_question_id_unique" UNIQUE("attempt_id","question_id"),
	CONSTRAINT "attempt_questions_position_not_negative" CHECK ("attempt_questions"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "attempt_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_question_id" uuid NOT NULL,
	"selected_answer_id" uuid NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_responses_attempt_question_id_unique" UNIQUE("attempt_question_id")
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"course_id" uuid,
	"exam_id" uuid NOT NULL,
	"exam_version_id" uuid NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"total_questions" integer NOT NULL,
	"current_question_position" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"passed" boolean,
	"elapsed_seconds" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_total_questions_positive" CHECK ("attempts"."total_questions" > 0),
	CONSTRAINT "attempts_current_question_position_not_negative" CHECK ("attempts"."current_question_position" >= 0),
	CONSTRAINT "attempts_score_valid" CHECK ("attempts"."score" IS NULL
        OR (
          "attempts"."score" >= 0
          AND "attempts"."score" <= "attempts"."total_questions"
        )),
	CONSTRAINT "attempts_elapsed_seconds_not_negative" CHECK ("attempts"."elapsed_seconds" IS NULL OR "attempts"."elapsed_seconds" >= 0),
	CONSTRAINT "attempts_expiration_after_start" CHECK ("attempts"."expires_at" > "attempts"."started_at")
);
--> statement-breakpoint
ALTER TABLE "attempt_question_options" ADD CONSTRAINT "attempt_question_options_attempt_question_id_attempt_questions_id_fk" FOREIGN KEY ("attempt_question_id") REFERENCES "public"."attempt_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_question_options" ADD CONSTRAINT "attempt_question_options_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_responses" ADD CONSTRAINT "attempt_responses_selected_option_fk" FOREIGN KEY ("attempt_question_id","selected_answer_id") REFERENCES "public"."attempt_question_options"("attempt_question_id","answer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_version_id_exam_versions_id_fk" FOREIGN KEY ("exam_version_id") REFERENCES "public"."exam_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_question_options_answer_id_idx" ON "attempt_question_options" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "attempt_questions_attempt_id_idx" ON "attempt_questions" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "attempt_questions_question_id_idx" ON "attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "attempt_responses_selected_answer_id_idx" ON "attempt_responses" USING btree ("selected_answer_id");--> statement-breakpoint
CREATE INDEX "attempts_organization_id_idx" ON "attempts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "attempts_participant_id_idx" ON "attempts" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "attempts_course_id_idx" ON "attempts" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "attempts_exam_id_idx" ON "attempts" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "attempts_exam_version_id_idx" ON "attempts" USING btree ("exam_version_id");--> statement-breakpoint
CREATE INDEX "attempts_status_idx" ON "attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_active_per_participant_exam_idx" ON "attempts" USING btree ("participant_id","exam_id") WHERE "attempts"."status" = 'in_progress';