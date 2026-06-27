import Client from "@alicloud/vod20170321";
import { CreateUploadVideoRequest, GetVideoPlayAuthRequest, RefreshUploadVideoRequest } from "@alicloud/vod20170321";

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

export async function getVideoPlayAuth(videoId: string): Promise<PlayAuth> {
  const cached = playAuthCache.get(videoId);
  if (cached && Date.now() < cached.expireAt) {
    return cached.auth;
  }

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
