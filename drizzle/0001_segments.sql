ALTER TABLE "clients" ADD COLUMN "segment" text DEFAULT 'auto_parts' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "segment" text DEFAULT 'auto_parts' NOT NULL;--> statement-breakpoint
CREATE INDEX "clients_segment_index" ON "clients" USING btree ("segment");