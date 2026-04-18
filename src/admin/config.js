const crypto = require("node:crypto");
const { z } = require("zod");
require("dotenv").config();

const adminEnvSchema = z.object({
  ADMIN_HOST: z.string().default("127.0.0.1"),
  ADMIN_PORT: z.coerce.number().int().positive().default(8787),
  ADMIN_PATH: z.string().default("/console"),
  ADMIN_USERNAME_HASH: z.string().length(64),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  ADMIN_SESSION_SECRET: z
    .string()
    .optional()
    .transform((value) => value || crypto.randomBytes(32).toString("hex")),
});

function loadAdminEnv() {
  return adminEnvSchema.parse(process.env);
}

module.exports = {
  loadAdminEnv,
};
