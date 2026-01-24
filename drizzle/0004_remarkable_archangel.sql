CREATE TYPE "public"."value_source" AS ENUM('manual', 'api');--> statement-breakpoint
CREATE TABLE "property_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"estimated_value" numeric(12, 2) NOT NULL,
	"value_date" date NOT NULL,
	"source" "value_source" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_values" ADD CONSTRAINT "property_values_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_values" ADD CONSTRAINT "property_values_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_values_property_id_idx" ON "property_values" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_values_user_id_idx" ON "property_values" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_values_date_idx" ON "property_values" USING btree ("value_date");