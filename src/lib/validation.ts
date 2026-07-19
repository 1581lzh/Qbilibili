import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(1, "用户名不能为空")
  .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, "用户名只能包含字母、数字、下划线和中文");

export const passwordSchema = z
  .string()
  .min(1, "密码不能为空");

export const registerSchema = z.object({
  name: usernameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  name: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

const safeUrl = z
  .string()
  .url("URL格式无效")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return !parsed.pathname.includes("..") && !parsed.pathname.includes("\\");
      } catch {
        return false;
      }
    },
    { message: "URL包含非法路径" }
  );

export const commentSchema = z
  .object({
    content: z
      .string()
      .max(500, "评论内容最多500个字符")
      .trim()
      .optional()
      .or(z.literal("")),
    images: z
      .array(safeUrl)
      .max(7, "最多上传7张图片")
      .optional(),
    parentId: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasContent = data.content && data.content.trim().length > 0;
      const hasImages = data.images && data.images.length > 0;
      return hasContent || hasImages;
    },
    { message: "评论内容和图片至少填写一项" }
  );

export const videoSchema = z.object({
  title: z
    .string()
    .min(1, "标题不能为空")
    .max(100, "标题最多100个字符")
    .trim(),
  description: z
    .string()
    .max(2000, "描述最多2000个字符")
    .trim()
    .optional()
    .nullable(),
  coverUrl: safeUrl.optional(),
  videoUrl: safeUrl.optional(),
  vodVideoId: z.string().optional(),
  postType: z.enum(["video", "image_text"]).default("video"),
  imageUrls: z.string().optional(),
  musicUrl: safeUrl.optional(),
  musicUrls: z.string().optional(),
  imageDuration: z.number().min(1).max(30).optional().nullable(),
});

export const profileUpdateSchema = z.object({
  name: usernameSchema.optional(),
  password: passwordSchema.optional(),
});

export const searchSchema = z.object({
  q: z.string().max(100, "搜索关键词最多100个字符").trim(),
  type: z.enum(["video", "comment"]).optional().default("video"),
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0]?.message || "输入验证失败";
  return { success: false, error: firstError };
}
