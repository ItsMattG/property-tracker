CREATE INDEX IF NOT EXISTS "property_emails_user_id_idx" ON "property_emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_emails_user_property_idx" ON "property_emails" USING btree ("user_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_emails_user_read_idx" ON "property_emails" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_emails_user_received_idx" ON "property_emails" USING btree ("user_id","received_at");
