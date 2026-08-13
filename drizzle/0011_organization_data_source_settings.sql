CREATE TABLE "organization_data_source_settings" (
	"singleton_key" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"web_research_provider" text DEFAULT 'firecrawl' NOT NULL,
	"company_enrichment_provider" text DEFAULT 'apollo' NOT NULL,
	"persona_enrichment_provider" text DEFAULT 'prospeo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_data_source_settings_singleton_key_check" CHECK ("organization_data_source_settings"."singleton_key" = 1),
	CONSTRAINT "organization_data_source_settings_web_research_provider_check" CHECK ("organization_data_source_settings"."web_research_provider" IN ('firecrawl', 'exa')),
	CONSTRAINT "organization_data_source_settings_company_enrichment_provider_check" CHECK ("organization_data_source_settings"."company_enrichment_provider" IN ('apollo', 'prospeo')),
	CONSTRAINT "organization_data_source_settings_persona_enrichment_provider_check" CHECK ("organization_data_source_settings"."persona_enrichment_provider" IN ('apollo', 'prospeo'))
);
