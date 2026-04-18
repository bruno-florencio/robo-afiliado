const fs = require("node:fs");
const path = require("node:path");
const { z } = require("zod");

const channelSchema = z.object({
  network: z.enum(["instagram", "linkedin"]),
  enabled: z.boolean().default(true),
  profile: z.string().min(1),
  goal: z.string().optional(),
  cadence: z.string().optional(),
});

const brandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  niche: z.string().min(1),
  tone: z.string().min(1),
  topics: z.array(z.string()).default([]),
  channels: z.array(channelSchema).default([]),
});

const socialConfigSchema = z.object({
  brands: z.array(brandSchema).default([]),
});

function loadSocialConfig(configPath = "./config/social-accounts.json") {
  const resolvedPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Arquivo social nao encontrado em ${resolvedPath}. Copie config/social-accounts.example.json para config/social-accounts.json.`
    );
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  const config = socialConfigSchema.parse(raw);

  return {
    configPath: resolvedPath,
    brands: config.brands,
  };
}

module.exports = {
  loadSocialConfig,
};
