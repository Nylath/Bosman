CREATE TABLE "participant_exam_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_exam_accesses_participant_exam_unique" UNIQUE("participant_id","exam_id"),
	CONSTRAINT "participant_exam_accesses_dates_valid" CHECK ("participant_exam_accesses"."valid_until" IS NULL OR "participant_exam_accesses"."valid_until" >= "participant_exam_accesses"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_kind_course_relation_valid";--> statement-breakpoint
ALTER TABLE "participant_exam_accesses" ADD CONSTRAINT "participant_exam_accesses_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_exam_accesses" ADD CONSTRAINT "participant_exam_accesses_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_exam_accesses_participant_id_idx" ON "participant_exam_accesses" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "participant_exam_accesses_exam_id_idx" ON "participant_exam_accesses" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "participant_exam_accesses_valid_until_idx" ON "participant_exam_accesses" USING btree ("valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_organization_id_label_course_unique" ON "participants" USING btree ("organization_id","label") WHERE "participants"."kind" = 'course';--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_kind_course_relation_valid" CHECK ((
    "participants"."kind" = 'local'
    AND "participants"."course_id" IS NULL
  ) OR (
    "participants"."kind" = 'course'
  ));