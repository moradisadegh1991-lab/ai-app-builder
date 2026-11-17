CREATE TABLE "ai_tariffs" (
  "key" text PRIMARY KEY NOT NULL,
  "price" jsonb NOT NULL,
  "updated_by" uuid NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_tariffs" ADD CONSTRAINT "ai_tariffs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
