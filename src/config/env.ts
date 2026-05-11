import { z } from "zod";

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().min(1).default("info"),
  CORS_ORIGIN: z.string().min(1).default("*"),

  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/mlehome"),
  MONGODB_DB: z.string().min(1).default("mlehome"),

  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().min(1).default("eu-west-2"),
  S3_BUCKET: z.string().min(1).default("mlehome-evidence"),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),
  S3_SERVER_SIDE_ENCRYPTION: z.string().default("")
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);
