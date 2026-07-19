"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatFileSize } from "@/lib/image-compress";

interface CompressDialogProps {
  open: boolean;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  type: "image" | "music";
  onConfirm: () => void;
  onCancel: () => void;
}

export function CompressDialog({
  open,
  fileName,
  originalSize,
  compressedSize,
  type,
  onConfirm,
  onCancel,
}: CompressDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[110]"
            style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.5)" }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[111] flex items-center justify-center px-4"
            onClick={onCancel}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            >
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {type === "image" ? "图片压缩" : "音乐压缩"}
              </h3>
              
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                文件 <span className="font-medium text-zinc-900 dark:text-zinc-100">{fileName}</span> 
                {type === "image" ? "超过15MB限制" : "超过50MB限制"}，需要压缩。
              </p>
              
              <div className="mb-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">原始大小：</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatFileSize(originalSize)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">压缩后：</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    ~{formatFileSize(compressedSize)}
                  </span>
                </div>
              </div>
              
              {type === "music" && (
                <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">
                  注意：音频压缩可能会降低音质。
                </p>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={onCancel}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  onClick={onConfirm}
                  className="rounded-md bg-[#FB7299] px-4 py-2 text-sm font-medium text-white hover:bg-[#FC8AB1]"
                >
                  确认压缩
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}