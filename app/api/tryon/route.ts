/**
 * AI 虚拟试衣 API
 *
 * 路径: app/api/tryon/route.ts
 * 方法: POST
 *
 * 使用可灵 AI kolors-virtual-try-on 模型
 * 文档: https://klingai.com/document-api/apiReference/model/virtualTryOn
 *
 * 统一消耗 1 积分（AI 模特生成已由 /api/model/generate 单独扣减）
 *
 * 错误处理：
 * - Token 过期自动刷新重试
 * - 速率限制自动等待重试
 * - 服务器错误自动重试
 * - 账户异常友好提示
 * - API 失败时积分回滚
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkUserHasEnoughCredits, consumeCredits, getUserCredits } from '@/lib/credits';
import { createHmac } from 'crypto';
import sharp from 'sharp';

// ══════════════════════════════════════════════
// 可灵 AI 配置
// ══════════════════════════════════════════════

const KLING_API_BASE = 'https://api-beijing.klingai.com';
const KLING_MODEL = 'kolors-virtual-try-on-v1';

// 轮询超时（秒）
const POLL_TIMEOUT = 120;
// 轮询间隔（毫秒）
const POLL_INTERVAL = 3000;
// 单次 API 调用超时（毫秒）
const API_CALL_TIMEOUT = 15000;

// ══════════════════════════════════════════════
// 可灵 AI 错误码定义
// ══════════════════════════════════════════════

interface KlingError {
  code: number;       // 业务码
  message: string;    // 错误信息
  request_id?: string;
}

// 业务码分类
const KLING_ERROR = {
  // 身份验证失败 (401)
  AUTH_EMPTY: 1000,          // Authorization 为空
  AUTH_INVALID: 1001,         // Authorization 值非法
  AUTH_NOT_YET: 1002,         // 未到有效时间
  AUTH_EXPIRED: 1003,         // 已失效 → 需刷新 Token 重试
  // 账户异常 (429)
  ACCOUNT_ABNORMAL: 1100,     // 账户异常
  ACCOUNT_ARREARS: 1101,      // 欠费
  ACCOUNT_EXHAUSTED: 1102,     // 资源包用完
  ACCOUNT_NO_PERMISSION: 1103, // 无权限
  // 请求参数非法 (400/404)
  PARAM_INVALID: 1200,        // 参数非法
  PARAM_KEY_INVALID: 1201,    // key/value 非法
  METHOD_INVALID: 1202,       // method 无效
  RESOURCE_NOT_FOUND: 1203,   // 资源不存在
  // 触发策略 (400/429)
  POLICY_TRIGGERED: 1300,     // 平台策略
  CONTENT_SAFE: 1301,         // 内容安全策略
  RATE_LIMIT: 1302,           // 速率限制 → 等待重试
  QPS_LIMIT: 1303,            // QPS 超限 → 等待重试
  IP_WHITELIST: 1304,         // IP 白名单
  // 内部错误 (500/503/504)
  INTERNAL_ERROR: 5000,        // 服务器内部错误 → 重试
  SERVICE_UNAVAILABLE: 5001,   // 暂时不可用 → 重试
  TIMEOUT: 5002,              // 内部超时 → 重试
} as const;

// ══════════════════════════════════════════════
// 可灵 AI JWT Token 鉴权
// ══════════════════════════════════════════════

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateKlingJwtToken(): string {
  const ak = process.env.KLING_AI_ACCESS_KEY_ID;
  const sk = process.env.KLING_AI_SECRET_KEY;

  if (!ak || !sk) {
    throw new Error('可灵 AI AK/SK 未配置');
  }

  const now = Math.floor(Date.now() / 1000);

  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify({
    iss: ak,
    exp: now + 1800,
    nbf: now - 5,
  }));

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha256', sk)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signature}`;
}

function getKlingAuthHeaders(): Record<string, string> {
  const token = generateKlingJwtToken();
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ══════════════════════════════════════════════
// 可灵 AI 错误处理核心
// ══════════════════════════════════════════════

/**
 * 解析可灵 AI 响应中的错误
 */
function parseKlingError(data: any): KlingError | null {
  if (data.code !== undefined && data.code !== 0) {
    return {
      code: data.code,
      message: data.message || '未知错误',
      request_id: data.request_id,
    };
  }
  return null;
}

/**
 * 根据业务码判断错误类型并采取对应策略
 *
 * 返回值:
 * - { action: 'retry_auth' }  → Token 过期，刷新后重试
 * - { action: 'retry_wait', delay: number }  → 速率限制/服务器错误，等待后重试
 * - { action: 'throw', message: string }  → 不可重试，抛出友好错误
 */
function classifyKlingError(httpStatus: number, klingError: KlingError | null): {
  action: 'retry_auth' | 'retry_wait' | 'throw';
  delay?: number;
  message?: string;
} {
  // 没有 klingError（非 JSON 响应或网络错误）
  if (!klingError) {
    // 服务器错误（500/503/504）→ 等待 1 秒重试
    if (httpStatus >= 500) {
      return { action: 'retry_wait', delay: 1000, message: '服务维护中，请稍后重试' };
    }
    // 速率限制（429）→ 等待 2 秒重试
    if (httpStatus === 429) {
      return { action: 'retry_wait', delay: 2000, message: '当前使用人数较多，请稍后重试' };
    }
    return { action: 'throw', message: `服务请求失败 (${httpStatus})` };
  }

  const { code, message } = klingError;

  // ── 身份验证失败 ──
  if (code === KLING_ERROR.AUTH_EXPIRED) {
    console.warn(`[TryOn API] Token 已失效 (code: ${code})，将刷新 Token 重试`);
    return { action: 'retry_auth' };
  }
  if (code === KLING_ERROR.AUTH_EMPTY || code === KLING_ERROR.AUTH_INVALID || code === KLING_ERROR.AUTH_NOT_YET) {
    console.error(`[TryOn API] 认证错误 (code: ${code}): ${message}`);
    return { action: 'throw', message: '服务认证异常，请稍后重试' };
  }

  // ── 账户异常 ──
  if (code === KLING_ERROR.ACCOUNT_ABNORMAL || code === KLING_ERROR.ACCOUNT_ARREARS || code === KLING_ERROR.ACCOUNT_EXHAUSTED) {
    console.error(`[TryOn API] 账户异常 (code: ${code}): ${message}`);
    return { action: 'throw', message: '服务繁忙，请稍后重试' }; // 不暴露账户状态
  }
  if (code === KLING_ERROR.ACCOUNT_NO_PERMISSION) {
    console.error(`[TryOn API] 权限不足 (code: ${code}): ${message}`);
    return { action: 'throw', message: '服务暂不可用，请联系客服' };
  }

  // ── 请求参数非法 ──
  if (code >= 1200 && code <= 1299) {
    console.error(`[TryOn API] 参数错误 (code: ${code}): ${message}`);
    return { action: 'throw', message: '请求参数异常，请检查图片后重试' };
  }

  // ── 速率限制 ──
  if (code === KLING_ERROR.RATE_LIMIT || code === KLING_ERROR.QPS_LIMIT || code === KLING_ERROR.IP_WHITELIST) {
    console.warn(`[TryOn API] 速率限制 (code: ${code}): ${message}`);
    return { action: 'retry_wait', delay: 2000, message: '当前使用人数较多，请稍后重试' };
  }

  // ── 内容安全策略 ──
  if (code === KLING_ERROR.CONTENT_SAFE) {
    console.error(`[TryOn API] 内容安全拦截 (code: ${code}): ${message}`);
    return { action: 'throw', message: '图片内容不符合规范，请更换图片后重试' };
  }
  if (code === KLING_ERROR.POLICY_TRIGGERED) {
    console.error(`[TryOn API] 触发平台策略 (code: ${code}): ${message}`);
    return { action: 'throw', message: '操作受限，请稍后重试' };
  }

  // ── 服务器内部错误 ──
  if (code === KLING_ERROR.INTERNAL_ERROR || code === KLING_ERROR.SERVICE_UNAVAILABLE || code === KLING_ERROR.TIMEOUT) {
    console.warn(`[TryOn API] 服务器错误 (code: ${code}): ${message}`);
    return { action: 'retry_wait', delay: 1000, message: '服务维护中，请稍后重试' };
  }

  // ── 未知错误码 ──
  console.error(`[TryOn API] 未知错误码 (code: ${code}): ${message}`);
  return { action: 'throw', message: '操作失败，请稍后重试' };
}

/**
 * 带智能错误处理的 fetch 封装
 *
 * 策略：
 * - Token 过期 → 自动刷新重试 1 次
 * - 速率限制 → 等待 2 秒重试 1 次
 * - 服务器错误 → 等待 1 秒重试 1 次
 * - 超时 15 秒
 */
async function fetchWithSmartRetry(
  url: string,
  options: RequestInit,
  label: string,
): Promise<Response> {
  let lastError: Error | null = null;
  let hasRetriedAuth = false;
  let hasRetriedWait = false;

  for (let attempt = 0; attempt <= 2; attempt++) {
    const attemptLabel = attempt === 0 ? '' : ` (第${attempt}次重试)`;
    const startTime = Date.now();

    try {
      // 如果是 auth 重试，重新生成 Token
      if (attempt > 0 && options.headers && typeof options.headers === 'object') {
        const newHeaders = getKlingAuthHeaders();
        (options.headers as Record<string, string>)['Authorization'] = newHeaders['Authorization'];
        console.log(`[TryOn API] ${label}${attemptLabel} 已刷新 JWT Token`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CALL_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const elapsed = Date.now() - startTime;

      // 成功
      if (response.ok) {
        console.log(`[TryOn API] ${label}${attemptLabel} 完成，耗时 ${elapsed}ms，状态: ${response.status}`);
        return response;
      }

      // 错误：解析响应体
      let errorData: any = {};
      try { errorData = await response.json(); } catch { /* 非 JSON 响应 */ }

      const klingError = parseKlingError(errorData);
      const strategy = classifyKlingError(response.status, klingError);

      console.error(`[TryOn API] ${label}${attemptLabel} 错误: HTTP ${response.status}, 业务码 ${klingError?.code ?? '-'}, 信息: ${klingError?.message ?? response.statusText}, 耗时 ${elapsed}ms`);

      // 根据策略处理
      if (strategy.action === 'retry_auth' && !hasRetriedAuth) {
        hasRetriedAuth = true;
        console.log(`[TryOn API] ${label} Token 过期，刷新后重试...`);
        continue; // 立即重试（不等待）
      }

      if (strategy.action === 'retry_wait' && !hasRetriedWait) {
        hasRetriedWait = true;
        const delay = strategy.delay || 2000;
        console.log(`[TryOn API] ${label} 等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // 不可重试或已重试过，抛出友好错误
      throw new Error(strategy.message || '操作失败，请稍后重试');

    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      lastError = err;

      // 网络错误或超时（非业务错误）
      if (err.message && !err.message.startsWith('[')) {
        // 这是 classifyKlingError 抛出的友好错误
        if (attempt > 0) {
          console.error(`[TryOn API] ${label} 重试后仍失败 (${elapsed}ms): ${err.message}`);
          throw err;
        }

        // 首次遇到友好错误，直接抛出
        throw err;
      }

      // 网络级错误
      if (err.name === 'AbortError') {
        console.warn(`[TryOn API] ${label}${attemptLabel} 超时 (${elapsed}ms)`);
      } else {
        console.warn(`[TryOn API] ${label}${attemptLabel} 网络错误 (${elapsed}ms): ${err.message}`);
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError || new Error('服务繁忙，请稍后重试');
}

// ══════════════════════════════════════════════
// 可灵 AI 虚拟试衣
// ══════════════════════════════════════════════

/**
 * 将图片 URL 下载并转为 Base64（无前缀）
 * 可灵 API 要求纯 Base64 字符串，不能带 data:image/png;base64, 前缀
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  console.log('[TryOn API] 下载图片:', imageUrl.substring(0, 80));

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`图片下载失败 (HTTP ${response.status}): ${imageUrl}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  console.log('[TryOn API] 图片已转为 Base64，大小:', (buffer.byteLength / 1024).toFixed(1), 'KB');
  return base64;
}

/**
 * 创建可灵 AI 虚拟试衣任务
 */
async function createKlingTryOnTask(
  personImage: string,
  clothingImage: string,
): Promise<string> {
  // 正确路径：/v1/images/kolors-virtual-try-on
  const path = '/v1/images/kolors-virtual-try-on';
  const url = `${KLING_API_BASE}${path}`;

  console.log('[TryOn API] 创建可灵 AI 试衣任务...');
  console.log('[TryOn API] 请求 URL:', url);

  // 下载图片并转为 Base64
  const [humanImageBase64, clothImageBase64] = await Promise.all([
    downloadImageAsBase64(personImage),
    downloadImageAsBase64(clothingImage),
  ]);

  // 正确参数名：model_name, human_image, cloth_image
  const requestBody = {
    model_name: KLING_MODEL,
    human_image: humanImageBase64,
    cloth_image: clothImageBase64,
  };

  console.log('[TryOn API] 请求体: model_name=%s, human_image=[Base64 %s], cloth_image=[Base64 %s]',
    KLING_MODEL,
    (humanImageBase64.length / 1024).toFixed(1) + 'KB',
    (clothImageBase64.length / 1024).toFixed(1) + 'KB',
  );

  const bodyStr = JSON.stringify(requestBody);
  const headers = getKlingAuthHeaders();

  const response = await fetchWithSmartRetry(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  }, '创建试衣任务');

  const responseData = await response.json();
  console.log('[TryOn API] 创建任务完整响应:', JSON.stringify(responseData, null, 2));

  // 修正：task_id 在 responseData.data 对象中
  const taskId = responseData.data?.task_id;

  if (!taskId) {
    console.error('[TryOn API] 响应缺少任务 ID:', responseData);
    throw new Error('服务返回数据异常，请稍后重试');
  }

  console.log(`[TryOn API] 任务创建成功，task_id: ${taskId}`);
  return taskId;
}

/**
 * 查询可灵 AI 任务状态
 */
async function pollKlingTask(taskId: string): Promise<string> {
  // 正确路径：/v1/images/kolors-virtual-try-on/{id}
  const path = `/v1/images/kolors-virtual-try-on/${taskId}`;
  const url = `${KLING_API_BASE}${path}`;

  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT * 1000) {
    console.log(`[TryOn API] 轮询任务状态... (taskId: ${taskId})`);

    const headers = getKlingAuthHeaders();

    const response = await fetchWithSmartRetry(url, {
      method: 'GET',
      headers,
    }, '查询任务状态');

    const pollData = await response.json();
    console.log('[TryOn API] 查询任务完整响应:', JSON.stringify(pollData, null, 2));

    // 修正：状态字段可能在 pollData.data 中
    const taskData = pollData.data || pollData;
    const status = taskData.task_status || taskData.status || 'unknown';
    console.log('[TryOn API] 任务状态:', status);

    // 任务成功
    if (status === 'succeed' || status === 'completed' || status === 'SUCCESS') {
      console.log('[TryOn API] 任务成功');
      console.log('[TryOn API] task_result:', JSON.stringify(taskData.task_result, null, 2));

      // 修正：结果 URL 在 task_result.images[0].url 中
      const resultUrl = taskData.task_result?.images?.[0]?.url
        || taskData.image_url
        || taskData.result_url
        || taskData.output?.[0]
        || taskData.images?.[0]?.url;

      if (!resultUrl) {
        console.error('[TryOn API] 任务成功但无结果图片:', JSON.stringify(pollData));
        throw new Error('试衣完成但未获取到结果图片');
      }

      console.log(`[TryOn API] 试衣成功，结果 URL: ${resultUrl}`);
      console.log(`[TryOn API] 总耗时 ${Date.now() - startTime}ms`);
      return resultUrl;
    }

    // 任务失败
    if (status === 'failed' || status === 'FAILED') {
      const errorMsg = taskData.error?.message || taskData.message || taskData.fail_reason || '模型处理失败';
      console.error('[TryOn API] 任务失败:', errorMsg);
      throw new Error(`AI 试衣失败: ${errorMsg}`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  console.warn(`[TryOn API] 轮询超时 (${POLL_TIMEOUT}s)`);
  throw new Error('服务繁忙，请稍后重试');
}

/**
 * 调用可灵 AI 虚拟试衣（完整流程）
 */
async function virtualTryOn(personImage: string, clothingImage: string): Promise<string> {
  const taskId = await createKlingTryOnTask(personImage, clothingImage);
  console.log('[TryOn API] 任务已创建，ID:', taskId);
  return pollKlingTask(taskId);
}

// ══════════════════════════════════════════════
// 图片后处理：去Logo + 加品牌水印 + 上传 Storage
// ══════════════════════════════════════════════

/**
 * 对可灵AI生成的效果图进行后处理：
 * 1. 下载原始图片
 * 2. 智能填充右下角可能存在的Logo区域
 * 3. 添加品牌水印 "AI TryOn · 生成"
 * 4. 上传到 Supabase Storage
 * 5. 返回新的公开 URL
 */
async function postProcessImage(originalUrl: string): Promise<string> {
  const startTime = Date.now();
  console.log('[TryOn API] 开始图片后处理...');
  console.log('[TryOn API] 原始图片 URL:', originalUrl.substring(0, 100));

  // ── 1. 下载原始图片 ──
  const imgResponse = await fetch(originalUrl, { signal: AbortSignal.timeout(30000) });
  if (!imgResponse.ok) {
    console.warn('[TryOn API] 图片下载失败，跳过后处理，使用原始 URL');
    return originalUrl;
  }

  const originalBuffer = await imgResponse.arrayBuffer();
  console.log('[TryOn API] 原始图片大小:', (originalBuffer.byteLength / 1024).toFixed(1), 'KB');

  // ── 2. 使用 sharp 处理图片 ──
  let processedBuffer: Buffer;

  try {
    const image = sharp(Buffer.from(originalBuffer));
    const metadata = await image.metadata();
    const width = metadata.width || 768;
    const height = metadata.height || 1024;

    console.log('[TryOn API] 图片尺寸:', width, 'x', height);

    // Logo 区域参数（右下角，约占图片宽度的 15%，高度的 8%）
    const logoRegionWidth = Math.round(width * 0.15);
    const logoRegionHeight = Math.round(height * 0.08);
    const logoX = width - logoRegionWidth - Math.round(width * 0.02); // 右侧留 2% 边距
    const logoY = height - logoRegionHeight - Math.round(height * 0.02); // 底部留 2% 边距

    // 水印文字参数
    const watermarkText = 'AI TryOn · 生成';
    const watermarkFontSize = Math.round(width * 0.022); // 约为图片宽度的 2.2%（~11px@512px）
    const watermarkX = width - Math.round(width * 0.02); // 右侧留 2% 边距
    const watermarkY = height - Math.round(height * 0.03); // 底部留 3% 边距

    // SVG 水印（半透明白色文字）
    const watermarkSvg = Buffer.from(`
      <svg width="${width}" height="${height}">
        <text
          x="${watermarkX}"
          y="${watermarkY}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${watermarkFontSize}"
          font-weight="400"
          fill="rgba(255, 255, 255, 0.45)"
          text-anchor="end"
          dominant-baseline="auto"
        >${watermarkText}</text>
      </svg>
    `);

    processedBuffer = await image
      // 步骤 A：模糊右下角 Logo 区域（高斯模糊，radius=20）
      .composite([
        {
          input: await sharp({
            create: {
              width: logoRegionWidth,
              height: logoRegionHeight,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          })
            .composite([
              {
                input: await sharp(Buffer.from(originalBuffer))
                  .extract({ left: logoX, top: logoY, width: logoRegionWidth, height: logoRegionHeight })
                  .blur(20)
                  .toBuffer(),
                top: 0,
                left: 0,
              },
            ])
            .toBuffer(),
          top: logoY,
          left: logoX,
        },
      ])
      // 步骤 B：叠加品牌水印
      .composite([
        {
          input: watermarkSvg,
          top: 0,
          left: 0,
        },
      ])
      .png({ quality: 95 })
      .toBuffer();

    console.log('[TryOn API] 图片后处理完成（去Logo + 加水印），耗时:', Date.now() - startTime, 'ms');
    console.log('[TryOn API] 处理后图片大小:', (processedBuffer.byteLength / 1024).toFixed(1), 'KB');

  } catch (err: any) {
    console.warn('[TryOn API] 图片后处理失败，使用原始图片:', err.message);
    return originalUrl;
  }

  // ── 3. 上传到 Supabase Storage ──
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      console.error('[TryOn API] 错误: NEXT_PUBLIC_SUPABASE_URL 环境变量未设置（图片上传）');
      return originalUrl;
    }
    
    if (!supabaseKey) {
      console.error('[TryOn API] 错误: SUPABASE_SERVICE_ROLE_KEY 环境变量未设置（图片上传）');
      return originalUrl;
    }
    
    console.log('[TryOn API] 创建 Supabase Admin 客户端用于上传...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const fileName = `tryon_result_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('tryon-images')
      .upload(fileName, processedBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/png',
      });

    if (uploadError) {
      console.warn('[TryOn API] 后处理图片上传失败，使用原始 URL:', uploadError.message);
      return originalUrl;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('tryon-images')
      .getPublicUrl(fileName);

    console.log('[TryOn API] 后处理图片已上传:', publicUrl);
    console.log('[TryOn API] 图片后处理总耗时:', Date.now() - startTime, 'ms');
    return publicUrl;

  } catch (err: any) {
    console.warn('[TryOn API] Supabase 上传异常，使用原始 URL:', err.message);
    return originalUrl;
  }
}

// ══════════════════════════════════════════════
// 积分回滚
// ══════════════════════════════════════════════

/**
 * 回滚已扣减的积分
 */
async function rollbackCredits(userId: string, amount: number, reason: string): Promise<void> {
  console.log(`[TryOn API] 尝试回滚积分: userId=${userId}, amount=${amount}, reason=${reason}`);
  if (!userId || amount <= 0) {
    console.log('[TryOn API] 跳过回滚: 用户ID为空或积分为0');
    return;
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[TryOn API] 跳过回滚: Supabase 环境变量未设置');
      return;
    }

    console.log('[TryOn API] 创建 Supabase 客户端进行积分回滚...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 查询当前余额
    const { data: current, error: queryError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (queryError) {
      console.error('[TryOn API] 查询用户积分失败:', queryError);
    }

    const newBalance = (current?.credits ?? 0) + amount;
    console.log(`[TryOn API] 当前余额: ${current?.credits ?? 0}, 回滚后余额: ${newBalance}`);

    const { error } = await supabase
      .from('user_credits')
      .update({ credits: newBalance })
      .eq('user_id', userId);

    if (error) {
      console.error(`[TryOn API] 积分回滚失败 (userId: ${userId}, amount: ${amount}):`, error);
    } else {
      console.log(`[TryOn API] 积分已回滚 ${amount} 分 (userId: ${userId}), 新余额: ${newBalance}, 原因: ${reason}`);
    }
  } catch (e: any) {
    console.error('[TryOn API] 积分回滚异常:', e.message, e);
  }
}

// ══════════════════════════════════════════════
// 主处理函数
// ══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  console.log('[TryOn API] === 收到试衣请求 ===');

  // 追踪已扣减的积分，用于失败时回滚
  let creditsDeducted = 0;
  const userId_holder = { value: '' as string };

  try {
    // ── 1. 验证用户登录 ──
    console.log('[TryOn API] 开始验证用户登录...');
    
    // 检查环境变量
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      console.error('[TryOn API] 错误: NEXT_PUBLIC_SUPABASE_URL 环境变量未设置');
      return NextResponse.json({ error: '服务器配置错误', message: 'Supabase URL 未配置' }, { status: 500 });
    }
    
    if (!supabaseAnonKey) {
      console.error('[TryOn API] 错误: NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量未设置');
      return NextResponse.json({ error: '服务器配置错误', message: 'Supabase Anon Key 未配置' }, { status: 500 });
    }
    
    console.log('[TryOn API] 环境变量检查通过:', { 
      supabaseUrl: supabaseUrl.substring(0, 20) + '...', 
      hasAnonKey: !!supabaseAnonKey 
    });
    
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log('[TryOn API] 获取到的 cookies 数量:', allCookies.length);
    console.log('[TryOn API] Cookie 名称列表:', allCookies.map(c => c.name));
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { 
            console.log('[TryOn API] getAll() 被调用，返回 cookies:', allCookies.length);
            return allCookies; 
          },
          setAll(cookiesToSet) {
            try {
              console.log('[TryOn API] setAll() 被调用，设置 cookies:', cookiesToSet.length);
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (e) { 
              console.error('[TryOn API] setAll() 错误:', e);
            }
          },
        },
      }
    );

    console.log('[TryOn API] 调用 supabase.auth.getUser()...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[TryOn API] 认证错误:', authError.message, authError);
      return NextResponse.json({ success: false, error: '认证失败', message: authError.message, needLogin: true }, { status: 401 });
    }
    
    if (!user) {
      console.error('[TryOn API] 错误: 未获取到用户对象');
      return NextResponse.json({ success: false, error: '请先登录后再试衣', needLogin: true }, { status: 401 });
    }
    
    console.log('[TryOn API] 用户认证成功:', user.id, user.email);
    const userId = user.id;
    userId_holder.value = userId;

    // ── 2. 解析请求体 ──
    const body = await req.json().catch(() => ({}));
    const { personImage, clothingImage } = body;

    console.log('[TryOn API] 请求模式: 虚拟试衣，所需积分: 1');

    // ── 3. 检查积分（≥1） ──
    const creditCheck = await checkUserHasEnoughCredits(userId, 1);
    if (!creditCheck.can_try) {
      return NextResponse.json(
        { success: false, error: '积分不足', message: '虚拟试衣需要 1 积分，请购买积分包后继续。', needPurchase: true, redirectTo: '/pricing', currentCredits: creditCheck.credits, requiredCredits: 1 },
        { status: 403 }
      );
    }

    // ── 4. 验证参数 ──
    if (!personImage) {
      return NextResponse.json({ success: false, error: '请上传人物图或使用 AI 模特' }, { status: 400 });
    }
    if (!clothingImage) {
      return NextResponse.json({ success: false, error: '请上传服装图' }, { status: 400 });
    }
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(personImage)) {
      return NextResponse.json({ success: false, error: '人物图片 URL 格式无效' }, { status: 400 });
    }
    if (!urlPattern.test(clothingImage)) {
      return NextResponse.json({ success: false, error: '服装图片 URL 格式无效' }, { status: 400 });
    }

    // ── 5. 调用可灵 AI 虚拟试衣 ──
    console.log('[TryOn API] 调用可灵 AI 虚拟试衣...');
    let resultUrl: string;

    try {
      resultUrl = await virtualTryOn(personImage, clothingImage);

      // ══════════════════════════════════════════════
      // 图片后处理：已暂时禁用
      // 原因：sharp 在 Vercel 无服务器环境下可能缺少原生二进制依赖导致执行失败
      // 如需恢复，建议改用 jimp（纯 JS 实现，无需原生依赖）
      // ══════════════════════════════════════════════
      // try {
      //   resultUrl = await postProcessImage(resultUrl);
      //   console.log('[TryOn API] 使用后处理图片 URL');
      // } catch (err: any) {
      //   console.warn('[TryOn API] 后处理异常，使用原始图片:', err.message);
      // }

      console.log('[TryOn API] 直接使用可灵 AI 原始图片 URL（后处理已禁用）:', resultUrl.substring(0, 100));

      // 扣减 1 积分（虚拟试衣）
      const deductResult = await consumeCredits(userId, 1, '虚拟试衣');
      if (deductResult.success) {
        creditsDeducted += 1;
        console.log(`[TryOn API] 已扣减 1 积分（虚拟试衣），剩余: ${deductResult.credits_balance}`);
      }
    } catch (err: any) {
      console.error('[TryOn API] 虚拟试衣失败:', err.message);

      // ⚠️ API 调用失败，回滚已扣减的积分
      if (creditsDeducted > 0) {
        console.log(`[TryOn API] 开始回滚 ${creditsDeducted} 积分...`);
        await rollbackCredits(userId, creditsDeducted, '虚拟试衣失败自动回滚');
        creditsDeducted = 0;
      }

      return NextResponse.json(
        { success: false, error: 'AI 试衣失败', message: err.message || '请重试或更换图片' },
        { status: 500 }
      );
    }

    // ── 6. 返回结果 ──
    const finalCreditsBalance = creditsDeducted > 0
      ? (await getUserCredits(userId))?.credits ?? creditCheck.credits - 1
      : creditCheck.credits;

    console.log('[TryOn API] 试衣完成，返回结果:', {
      success: true,
      resultImageUrl: resultUrl,
      creditsBalance: finalCreditsBalance,
      creditsConsumed: creditsDeducted,
    });

    return NextResponse.json({
      success: true,
      resultImageUrl: resultUrl,
      resultUrl: resultUrl,  // 向后兼容旧前端
      useType: 'credits',
      creditsBalance: finalCreditsBalance,
      message: '试衣成功！',
      creditsConsumed: creditsDeducted,
    });

  } catch (err: any) {
    console.error('[TryOn API] 未捕获的异常:', err);

    // 回滚已扣减的积分
    if (creditsDeducted > 0 && userId_holder.value) {
      await rollbackCredits(userId_holder.value, creditsDeducted, '未捕获异常自动回滚');
    }

    return NextResponse.json(
      { success: false, error: '操作失败，请稍后重试', message: err.message },
      { status: 500 }
    );
  }
}
