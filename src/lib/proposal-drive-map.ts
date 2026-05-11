/**
 * Maps a proposal ID to its Google Drive upload folder so the DocuSeal
 * webhook (which has no access to the user's localStorage) can upload
 * the signed contract to the right place.
 *
 * Stored in Upstash Redis. Server-only — never import from client code.
 */
import { Redis } from '@upstash/redis'

const TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year — proposals can be signed long after creation

export interface ProposalDriveMapping {
  uploadFolderId: string
  fileBaseName: string
}

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Upstash Redis no está configurado')
  }
  return new Redis({ url, token })
}

function key(proposalId: string): string {
  return `proposal:drive:${proposalId}`
}

export async function setProposalDriveMapping(
  proposalId: string,
  mapping: ProposalDriveMapping,
): Promise<void> {
  const redis = getRedis()
  await redis.set(key(proposalId), mapping, { ex: TTL_SECONDS })
}

export async function getProposalDriveMapping(
  proposalId: string,
): Promise<ProposalDriveMapping | null> {
  const redis = getRedis()
  const value = await redis.get<ProposalDriveMapping>(key(proposalId))
  return value ?? null
}
