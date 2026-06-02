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
import { cookies } from 'next/headers';
import { checkUserHasEnoughCredits } from '@/lib/credits';
import { createHmac } from 'crypto';

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

// ══════════════════════════════════════════════
// 主处理函数
// ══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  console.log('[TryOn API] === 收到试衣请求 ===');

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
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return allCookies; },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (e) { console.error('[TryOn API] setAll() 错误:', e); }
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

    // ── 2. 解析请求体 ──
    const body = await req.json().catch(() => ({}));
    const { personImage, clothingImage } = body;

    console.log('[TryOn API] 请求模式: 虚拟试衣，所需积分: 1');
    console.log('[TryOn API] 当前用户ID:', userId);

    // ── 3. 检查积分（≥1） ──
    console.log('[TryOn API] 开始检查用户积分...');
    const creditCheck = await checkUserHasEnoughCredits(userId, 1);
    console.log('[TryOn API] 积分检查结果:', creditCheck);
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

    // ── 5. 调用可灵 AI 创建试衣任务（异步模式） ──
    console.log('[TryOn API] 创建可灵 AI 试衣任务...');
    let taskId: string;

    try {
      // 只创建任务，不等待结果，积分扣减由前端在成功后调用
      taskId = await createKlingTryOnTask(personImage, clothingImage);
      console.log('[TryOn API] 任务创建成功，task_id:', taskId);
    } catch (err: any) {
      console.error('[TryOn API] 创建试衣任务失败:', err.message);
      return NextResponse.json(
        { success: false, error: '创建试衣任务失败', message: err.message || '请重试或更换图片' },
        { status: 500 }
      );
    }

    // ── 6. 返回结果（立即返回 task_id，不等待图片生成） ──
    console.log('[TryOn API] 任务创建完成，返回 taskId:', taskId);

    return NextResponse.json({
      success: true,
      taskId,
      message: '任务已创建',
    });

  } catch (err: any) {
    console.error('[TryOn API] 未捕获的异常:', err);
    return NextResponse.json(
      { success: false, error: '操作失败，请稍后重试', message: err.message },
      { status: 500 }
    );
  }
}
