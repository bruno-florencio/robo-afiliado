const fs = require("node:fs");
const path = require("node:path");
const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  POST_INTERVAL_MINUTES: z.coerce.number().int().positive().default(180),
  CAMPAIGNS_FILE: z.string().default("./config/campaigns.json"),
  RUN_ON_START: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  TIMEZONE: z.string().default("America/Sao_Paulo"),
  AMAZON_PARTNER_TAG: z.string().optional(),
  AMAZON_ACCESS_KEY: z.string().optional(),
  AMAZON_SECRET_KEY: z.string().optional(),
  AMAZON_REGION: z.string().default("us-east-1"),
  AMAZON_HOST: z.string().default("webservices.amazon.com"),
  AMAZON_MARKETPLACE: z.string().default("www.amazon.com.br"),
  MERCADOLIVRE_SITE_ID: z.string().default("MLB"),
  MERCADOLIVRE_AGENT_USERNAME: z.string().optional(),
  MERCADOLIVRE_AGENT_PASSWORD: z.string().optional(),
  MERCADOLIVRE_AFFILIATE_LINKBUILDER_URL: z.string().url().optional(),
  MERCADOLIVRE_OFFERS_URL: z.string().url().optional(),
});

const campaignSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  provider: z.enum(["amazon", "mercadolivre"]),
  mode: z.enum(["search", "manual"]).optional().default("search"),
  keywords: z.array(z.string()).optional().default([]),
  searchIndex: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  itemCount: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  affiliateMode: z.enum(["direct_url", "template"]).optional(),
  affiliateTemplate: z.string().optional(),
  messageTemplate: z.string().optional(),
  ctaText: z.string().optional(),
  sourceLabel: z.string().optional(),
  disclosureText: z.string().optional(),
  highlights: z.array(z.string()).optional().default([]),
  hashtags: z.array(z.string()).optional().default([]),
  manualProducts: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        price: z.number(),
        originalPrice: z.number().optional(),
        url: z.string().url(),
        imageUrl: z.string().url().optional(),
      })
    )
    .optional()
    .default([]),
});

function loadConfig() {
  const env = envSchema.parse(process.env);
  const campaignsFile = path.resolve(process.cwd(), env.CAMPAIGNS_FILE);

  if (!fs.existsSync(campaignsFile)) {
    throw new Error(
      `Arquivo de campanhas nao encontrado em ${campaignsFile}. Copie config/campaigns.example.json para config/campaigns.json.`
    );
  }

  const campaignsRaw = JSON.parse(fs.readFileSync(campaignsFile, "utf8"));
  const campaigns = z
    .object({
      campaigns: z.array(campaignSchema),
    })
    .parse(campaignsRaw).campaigns;

  return {
    env,
    campaignsFile,
    campaigns,
  };
}

module.exports = {
  loadConfig,
};
