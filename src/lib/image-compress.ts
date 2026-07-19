const IMAGE_MAX_SIZE_MB = 15;
const IMAGE_COMPRESSION_TARGET_MB = 13.5; // 90% of limit
const IMAGE_MAX_RESOLUTION = 2560; // 2K

export interface CompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(
  file: File,
  targetSizeMB: number = IMAGE_COMPRESSION_TARGET_MB,
  maxResolution: number = IMAGE_MAX_RESOLUTION
): Promise<CompressionResult> {
  const originalSize = file.size;
  const originalSizeMB = originalSize / (1024 * 1024);
  
  // Check if compression is needed
  const needsSizeCompression = originalSizeMB > IMAGE_MAX_SIZE_MB;
  const needsResolutionCompression = await checkResolution(file, maxResolution);
  
  if (!needsSizeCompression && !needsResolutionCompression) {
    return { file, compressed: false, originalSize, compressedSize: originalSize };
  }
  
  // Perform compression
  const compressedBlob = await performCompression(file, targetSizeMB, maxResolution);
  const compressedSize = compressedBlob.size;
  
  // Check if compression helped
  if (compressedSize >= originalSize) {
    // Compression didn't help, return original
    return { file, compressed: false, originalSize, compressedSize: originalSize };
  }
  
  const compressedFile = new File([compressedBlob], file.name, { type: file.type });
  return { file: compressedFile, compressed: true, originalSize, compressedSize };
}

async function checkResolution(file: File, maxResolution: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width > maxResolution || img.height > maxResolution);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

async function performCompression(
  file: File,
  targetSizeMB: number,
  maxResolution: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Scale down resolution if needed
      if (width > maxResolution || height > maxResolution) {
        const ratio = Math.min(maxResolution / width, maxResolution / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try different quality levels to meet target size
      let quality = 0.9;
      const targetSizeBytes = targetSizeMB * 1024 * 1024;
      
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }
            
            if (blob.size <= targetSizeBytes || quality <= 0.1) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          file.type,
          quality
        );
      };
      
      tryCompress();
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    
    img.src = url;
  });
}

export function needsCompression(file: File): boolean {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB > IMAGE_MAX_SIZE_MB;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
