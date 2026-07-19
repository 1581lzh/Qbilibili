import Client from "@alicloud/vod20170321";
import { CreateUploadVideoRequest, GetVideoPlayAuthRequest, RefreshUploadVideoRequest, GetPlayInfoRequest } from "@alicloud/vod20170321";

const region = process.env.VOD_REGION || "cn-shenzhen";

let vodClient: any = null;

function getVodClient() {
  if (!vodClient) {
    vodClient = new (Client as any)({
      accessKeyId: process.env.VOD_ACCESS_KEY_ID!,
      accessKeySecret: process.env.VOD_ACCESS_KEY_SECRET!,
      regionId: region,
      endpoint: `vod.${region}.aliyuncs.com`,
    });
  }
  return vodClient;
}

export interface PlayInfo {
  videoId: string;
  playURL: string;
  duration: number;
  definition: string;
}

/**
 * Get VOD video play URL (signed OSS URL that can be downloaded).
 * Uses GetPlayInfo API to get the direct download URL.
 */
export async function getVodPlayUrl(videoId: string): Promise<PlayInfo | null> {
  try {
    const client = getVodClient();
    const req = new GetPlayInfoRequest({ videoId });
    const resp = await client.getPlayInfo(req);
    const body = resp.body;

    if (!body?.playInfoList?.playInfo?.length) {
      console.log(`[VOD] No play info for video ${videoId}`);
      return null;
    }

    // Get the first (original quality) play info
    const playInfo = body.playInfoList.playInfo[0];

    const playURL = playInfo.playURL || "";
    if (!playURL) {
      console.log(`[VOD] Empty play URL for video ${videoId}`);
      return null;
    }

    return {
      videoId,
      playURL,
      duration: parseFloat(playInfo.duration) || 0,
      definition: playInfo.definition || "",
    };
  } catch (error) {
    console.error(`[VOD] Failed to get play info for ${videoId}:`, error);
    return null;
  }
}

export interface UploadAuth {
  videoId: string;
  uploadAddress: string;
  uploadAuth: string;
  requestId: string;
}

export async function createUploadVideo(title: string, fileName?: string): Promise<UploadAuth> {
  const client = getVodClient();
  const req = new CreateUploadVideoRequest({
    title,
    fileName: fileName || `${Date.now()}.mp4`,
    spaceName: process.env.VOD_SPACE_NAME!,
  });
  const resp = await client.createUploadVideo(req);
  const body = resp.body;

  return {
    videoId: body.videoId,
    uploadAddress: body.uploadAddress,
    uploadAuth: body.uploadAuth,
    requestId: body.requestId,
  };
}

export interface PlayAuth {
  playAuth: string;
  videoId: string;
  requestId: string;
}

const playAuthCache = new Map<string, { auth: PlayAuth; expireAt: number }>();
const PLAY_AUTH_TTL = 80_000;
const MAX_CACHE_SIZE = 100;

function evictExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of playAuthCache) {
    if (now >= entry.expireAt) {
      playAuthCache.delete(key);
    }
  }
  // LRU: if still over limit, delete oldest entries
  if (playAuthCache.size > MAX_CACHE_SIZE) {
    const keys = playAuthCache.keys();
    const toDelete = playAuthCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toDelete; i++) {
      const key = keys.next().value;
      if (key) playAuthCache.delete(key);
    }
  }
}

export async function getVideoPlayAuth(videoId: string): Promise<PlayAuth> {
  const cached = playAuthCache.get(videoId);
  if (cached && Date.now() < cached.expireAt) {
    return cached.auth;
  }

  evictExpiredCache();

  const client = getVodClient();
  const req = new GetVideoPlayAuthRequest({ videoId });
  const resp = await client.getVideoPlayAuth(req);
  const body = resp.body;

  const auth: PlayAuth = {
    playAuth: body.playAuth,
    videoId: body.videoId,
    requestId: body.requestId,
  };

  playAuthCache.set(videoId, { auth, expireAt: Date.now() + PLAY_AUTH_TTL });
  return auth;
}

export async function refreshUploadVideo(videoId: string): Promise<UploadAuth> {
  const client = getVodClient();
  const req = new RefreshUploadVideoRequest({
    videoId,
    spaceName: process.env.VOD_SPACE_NAME!,
  });
  const resp = await client.refreshUploadVideo(req);
  const body = resp.body;

  return {
    videoId: body.videoId,
    uploadAddress: body.uploadAddress,
    uploadAuth: body.uploadAuth,
    requestId: body.requestId,
  };
}
