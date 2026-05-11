import {
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env";

const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials:
    env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY
        }
      : undefined
});

interface CreatePresignedPutUrlInput {
  objectKey: string;
  mimeType: string;
  expiresInSeconds?: number;
}

export async function createPresignedPutUrl(
  input: CreatePresignedPutUrlInput
): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
  const expiresInSeconds = input.expiresInSeconds ?? 900;
  const commandInput: PutObjectCommandInput = {
    Bucket: env.S3_BUCKET,
    Key: input.objectKey,
    ContentType: input.mimeType
  };

  if (env.S3_SERVER_SIDE_ENCRYPTION) {
    commandInput.ServerSideEncryption =
      env.S3_SERVER_SIDE_ENCRYPTION as PutObjectCommandInput["ServerSideEncryption"];
  }

  const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand(commandInput), {
    expiresIn: expiresInSeconds
  });

  return { uploadUrl, expiresInSeconds };
}

export function buildEvidenceObjectKey(input: {
  studentId: string;
  evidenceId: string;
  fileName: string;
}): string {
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `students/${input.studentId}/evidence/${input.evidenceId}/${safeFileName}`;
}
