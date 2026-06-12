CREATE TYPE "public"."course_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."participant_kind" AS ENUM('local', 'course');--> statement-breakpoint
CREATE TABLE "course_exams" (
	"course_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_exams_pk" PRIMARY KEY("course_id","exam_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"participant_access_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_dates_valid" CHECK ("courses"."ends_at" IS NULL
        OR "courses"."starts_at" IS NULL
        OR "courses"."ends_at" >= "courses"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "participant_access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_access_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "participant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"course_id" uuid,
	"kind" "participant_kind" NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_course_id_label_unique" UNIQUE("course_id","label"),
	CONSTRAINT "participants_kind_course_relation_valid" CHECK ((
        "participants"."kind" = 'local'
        AND "participants"."course_id" IS NULL
      ) OR (
        "participants"."kind" = 'course'
        AND "participants"."course_id" IS NOT NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "course_exams" ADD CONSTRAINT "course_exams_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_exams" ADD CONSTRAINT "course_exams_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_access_codes" ADD CONSTRAINT "participant_access_codes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_sessions" ADD CONSTRAINT "participant_sessions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_exams_exam_id_idx" ON "course_exams" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "courses_organization_id_idx" ON "courses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "participant_access_codes_participant_id_idx" ON "participant_access_codes" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "participant_sessions_participant_id_idx" ON "participant_sessions" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "participant_sessions_expires_at_idx" ON "participant_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "participants_organization_id_idx" ON "participants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "participants_course_id_idx" ON "participants" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_one_local_per_organization_idx" ON "participants" USING btree ("organization_id") WHERE "participants"."kind" = 'local';