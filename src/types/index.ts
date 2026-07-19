// 共享类型定义
// 基于 Prisma schema 和组件中使用的接口

// ===== 用户相关类型 =====
export interface Author {
  id: string;
  name: string;
  avatar: string | null;
}

// ===== 视频相关类型 =====
export interface Video {
  id: string;
  title: string;
  coverUrl: string;
  author: { name: string };
  _count: { likes: number };
}

export interface VideoWithAuthor {
  id: string;
  title: string;
  coverUrl: string;
  author: { id: string; name: string };
  _count: { likes: number; favorites: number };
}

// ===== 评论相关类型 =====
export interface Reply {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
  _count: { likes: number };
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
  _count: { likes: number; replies: number };
  replies: Reply[];
}

// ===== API 响应类型 =====
export interface CommentsResponse {
  comments: Comment[];
  likedCommentIds: string[];
  likedReplyIds: string[];
}

export interface LikeResponse {
  liked: boolean;
}
