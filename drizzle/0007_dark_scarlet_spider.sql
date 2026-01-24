CREATE TABLE "cash_flow_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"property_id" uuid,
	"forecast_month" date NOT NULL,
	"projected_income" numeric(12, 2) NOT NULL,
	"projected_expenses" numeric(12, 2) NOT NULL,
	"projected_net" numeric(12, 2) NOT NULL,
	"breakdown" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"assumptions" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_flow_forecasts" ADD CONSTRAINT "cash_flow_forecasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_forecasts" ADD CONSTRAINT "cash_flow_forecasts_scenario_id_forecast_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."forecast_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_forecasts" ADD CONSTRAINT "cash_flow_forecasts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_scenarios" ADD CONSTRAINT "forecast_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_flow_forecasts_user_id_idx" ON "cash_flow_forecasts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cash_flow_forecasts_scenario_id_idx" ON "cash_flow_forecasts" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "cash_flow_forecasts_property_id_idx" ON "cash_flow_forecasts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "cash_flow_forecasts_month_idx" ON "cash_flow_forecasts" USING btree ("forecast_month");--> statement-breakpoint
CREATE INDEX "forecast_scenarios_user_id_idx" ON "forecast_scenarios" USING btree ("user_id");