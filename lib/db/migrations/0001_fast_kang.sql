ALTER TABLE "users" ADD COLUMN "email_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_hash_idx" ON "users" USING btree ("email_hash");