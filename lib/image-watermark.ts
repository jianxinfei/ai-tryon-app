/**
 * 图片水印处理工具
 *
 * 功能：
 * 1. 去除可灵 AI 原水印（右下角 Logo 区域模糊/填充处理）
 * 2. 添加品牌水印 "What to Wear · AI Generated"
 * 3. 上传处理后的图片到 Supabase Storage
 * 4. 完整容错：处理失败时返回原图 URL
 *
 * 依赖：sharp (已包含在 package.json 中)
 */

import sharp from 'sharp';

// ══════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════

/** 可灵水印区域配置（右下角，约占图片宽度的 18%，高度的 8%） */
const KLING_LOGO_CONFIG = {
  widthRatio: 0.18,   // 水印宽度占图片总宽的比例
  heightRatio: 0.08,  // 水印高度占图片总高的比例
  marginRight: 12,    // 右边距（像素）
  marginBottom: 12,   // 下边距（像素）
};

/** 品牌水印文字配置 */
const BRAND_WATERMARK_CONFIG = {
  text: 'What to Wear · AI Generated',
  fontSize: 11,
  color: 'rgba(255, 255, 255, 0.85)',
  bgColor: 'rgba(0, 0, 0, 0.35)',
  paddingX: 10,
  paddingY: 5,
  marginRight: 12,
  marginBottom: 12,
  borderRadius: 4,
};

// ══════════════════════════════════════════════
// 核心处理函数
// ══════════════════════════════════════════════

/**
 * 处理试衣结果图片：去原水印 + 加品牌水印 + 上传 Storage
 *
 * @param originalUrl 可灵返回的原始图片 URL
 * @param taskId 任务 ID（用于生成文件名）
 * @returns 处理后的永久图片 URL（失败则返回原图 URL）
 */
export async function processTryOnImage(
  originalUrl: string,
  taskId: string,
): Promise<string> {
  console.log('[ImageWatermark] 开始处理图片:', originalUrl);

  try {
    // 1. 下载原始图片
    const imageBuffer = await downloadImage(originalUrl);
    console.log('[ImageWatermark] 图片下载完成, 大小:', imageBuffer.length, 'bytes');

    // 2. 获取图片尺寸
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;
    console.log('[ImageWatermark] 图片尺寸:', width, 'x', height);

    // 3. 去除可灵原水印（右下角区域模糊处理）
    let processedBuffer = await removeKlingWatermark(imageBuffer, width, height);
    console.log('[ImageWatermark] 原水印去除完成');

    // 4. 添加品牌水印
    processedBuffer = await addBrandWatermark(processedBuffer, width, height);
    console.log('[ImageWatermark] 品牌水印添加完成');

    // 5. 上传处理后的图片到 Supabase Storage
    const processedUrl = await uploadToStorage(processedBuffer, taskId);
    console.log('[ImageWatermark] 图片上传完成, URL:', processedUrl);

    return processedUrl;
  } catch (err: any) {
    console.error('[ImageWatermark] 图片处理失败, 退回使用原图:', err.message);
    // 容错：处理失败时返回原图 URL，确保试衣功能不崩溃
    return originalUrl;
  }
}

// ══════════════════════════════════════════════
// 下载图片
// ══════════════════════════════════════════════

async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`下载图片失败: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ══════════════════════════════════════════════
// 去除可灵原水印
// ══════════════════════════════════════════════

/**
 * 去除可灵 AI 右下角 Logo 水印
 * 策略：对右下角区域进行高斯模糊 + 轻微噪点填充，使水印无痕迹消失
 */
async function removeKlingWatermark(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const config = KLING_LOGO_CONFIG;

  // 计算水印区域
  const logoWidth = Math.round(width * config.widthRatio);
  const logoHeight = Math.round(height * config.heightRatio);
  const left = width - logoWidth - config.marginRight;
  const top = height - logoHeight - config.marginBottom;

  // 确保区域不越界
  const safeLeft = Math.max(0, left);
  const safeTop = Math.max(0, top);
  const safeWidth = Math.min(logoWidth, width - safeLeft);
  const safeHeight = Math.min(logoHeight, height - safeTop);

  if (safeWidth <= 0 || safeHeight <= 0) {
    console.log('[ImageWatermark] 水印区域计算异常，跳过去除');
    return imageBuffer;
  }

  console.log('[ImageWatermark] 去除水印区域:', {
    left: safeLeft,
    top: safeTop,
    width: safeWidth,
    height: safeHeight,
  });

  // 提取水印区域，进行高斯模糊处理
  const blurredRegion = await sharp(imageBuffer)
    .extract({
      left: safeLeft,
      top: safeTop,
      width: safeWidth,
      height: safeHeight,
    })
    .blur(8) // 高斯模糊，强度 8（足够消除文字/Logo）
    .toBuffer();

  // 将模糊后的区域合并回原图
  const result = await sharp(imageBuffer)
    .composite([
      {
        input: blurredRegion,
        left: safeLeft,
        top: safeTop,
      },
    ])
    .toBuffer();

  return result;
}

// ══════════════════════════════════════════════
// 添加品牌水印
// ══════════════════════════════════════════════

/**
 * 在图片右下角添加半透明品牌文字水印
 * 使用 SVG 叠加方式，无需系统字体
 */
async function addBrandWatermark(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const config = BRAND_WATERMARK_CONFIG;

  // 计算水印位置和尺寸
  const textWidth = config.text.length * config.fontSize * 0.6; // 估算文字宽度
  const watermarkWidth = Math.round(textWidth + config.paddingX * 2);
  const watermarkHeight = Math.round(config.fontSize + config.paddingY * 2);

  const x = width - watermarkWidth - config.marginRight;
  const y = height - watermarkHeight - config.marginBottom;

  // 创建 SVG 水印（带圆角背景 + 文字）
  const svgBuffer = Buffer.from(`
    <svg width="${watermarkWidth}" height="${watermarkHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="0"
        y="0"
        width="${watermarkWidth}"
        height="${watermarkHeight}"
        rx="${config.borderRadius}"
        ry="${config.borderRadius}"
        fill="${config.bgColor}"
      />
      <text
        x="${watermarkWidth / 2}"
        y="${watermarkHeight / 2 + config.fontSize / 3}"
        font-family="Arial, sans-serif"
        font-size="${config.fontSize}px"
        font-weight="500"
        fill="${config.color}"
        text-anchor="middle"
        dominant-baseline="middle"
      >${escapeXml(config.text)}</text>
    </svg>
  `);

  // 将 SVG 水印叠加到图片上
  const result = await sharp(imageBuffer)
    .composite([
      {
        input: svgBuffer,
        left: Math.max(0, x),
        top: Math.max(0, y),
      },
    ])
    .toBuffer();

  return result;
}

/**
 * XML 特殊字符转义
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ══════════════════════════════════════════════
// 上传到 Supabase Storage
// ══════════════════════════════════════════════

/**
 * 上传处理后的图片到 Supabase Storage
 */
async function uploadToStorage(
  imageBuffer: Buffer,
  taskId: string,
): Promise<string> {
  const { getSupabaseAdmin } = await import('./supabase-admin');
  const supabaseAdmin = getSupabaseAdmin();

  // 生成文件名
  const fileName = `processed_${taskId}_${Date.now()}.png`;
  const filePath = `tryon-results/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from('tryon-images')
    .upload(filePath, imageBuffer, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage 上传失败: ${error.message}`);
  }

  // 获取公开 URL
  const { data: urlData } = supabaseAdmin.storage
    .from('tryon-images')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
