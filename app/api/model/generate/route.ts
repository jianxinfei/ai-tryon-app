/**
 * AI 模特生成 API
 *
 * 路径: app/api/model/generate/route.ts
 * 方法: POST
 *
 * 流程：
 * 1. 验证用户登录 + 检查积分（≥1）
 * 2. 根据参数构建 prompt，调用可灵文生图 API
 * 3. 轮询等待生成完成
 * 4. 下载生成的模特图，上传到 Supabase Storage
 * 5. 扣减 1 积分（成功后才扣）
 * 6. 返回模特图公开 URL
 *
 * 容错：文生图失败不扣积分
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkUserHasEnoughCredits, consumeCredits } from '@/lib/credits';
import { createHmac } from 'crypto';

// ══════════════════════════════════════════════
// 可灵 AI 配置
// ══════════════════════════════════════════════

const KLING_API_BASE = 'https://api-beijing.klingai.com';
const KLING_TEXT2IMAGE_MODEL = 'kolors-text2image-v1';

const POLL_TIMEOUT = 120;
const POLL_INTERVAL = 3000;
const API_CALL_TIMEOUT = 15000;

// ══════════════════════════════════════════════
// 可灵 AI JWT 鉴权（复用 tryon 的逻辑）
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
  if (!ak || !sk) throw new Error('可灵 AI AK/SK 未配置');

  const now = Math.floor(Date.now() / 1000);
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 }));
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
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${generateKlingJwtToken()}`,
  };
}

// ══════════════════════════════════════════════
// Prompt 构建
// ══════════════════════════════════════════════

function buildModelPrompt(params: {
  gender: string;
  age: string;
  skinTone: string;
  height: number;
  weight: number;
}): string {
  const genderMap: Record<string, string> = { female: 'female', male: 'male' };
  const ageMap: Record<string, string> = {
    child: 'a child around 10 years old',
    youth: 'a young adult around 25 years old',
    elder: 'an elderly person around 60 years old',
  };
  const skinMap: Record<string, string> = {
    yellow: 'warm yellow skin tone',
    white: 'fair pale skin tone',
    brown: 'medium brown skin tone',
    dark: 'dark brown skin tone',
  };

  const gender = genderMap[params.gender] || 'female';
  const age = ageMap[params.age] || 'a young adult around 25 years old';
  const skin = skinMap[params.skinTone] || 'warm yellow skin tone';

  return `Full body photo of ${age} ${gender} fashion model, ${skin}, height ${params.height}cm, slim build, standing straight facing the camera with a neutral expression, wearing simple white underwear set, clean solid white background, studio lighting, professional fashion model photography, full body head to toe, high quality, photorealistic, 8K`;
}

// ══════════════════════════════════════════════
// 可灵 API 调用
// ══════════════════════════════════════════════

async function fetchWithRetry(url: string, options: RequestInit, label: string): Promise<Response> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    const attemptLabel = attempt > 0 ? ` (第${attempt}次重试)` : '';
    try {
      if (attempt > 0 && options.headers && typeof options.headers === 'object') {
        (options.headers as Record<string, string>)['Authorization'] = getKlingAuthHeaders()['Authorization'];
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CALL_TIMEOUT);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) return response;

      let errorData: any = {};
      try { errorData = await response.json(); } catch { /* ignore */ }

      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }

      throw new Error(errorData.message || `API 请求失败 (${response.status})`);
    } catch (err: any) {
      if (err.message && !err.message.includes('API 请求失败') && attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('服务繁忙，请稍后重试');
}

/**
 * 创建可灵文生图任务
 */
async function createText2ImageTask(prompt: string): Promise<string> {
  const url = `${KLING_API_BASE}/v1/images/text2image`;
  console.log('[Model API] 创建文生图任务:', url);

  const requestBody = {
    model_name: KLING_TEXT2IMAGE_MODEL,
    prompt,
  };

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getKlingAuthHeaders(),
    body: JSON.stringify(requestBody),
  }, '创建文生图任务');

  const responseData = await response.json();
  console.log('[Model API] 创建任务响应:', JSON.stringify(responseData, null, 2));

  const taskId = responseData.data?.task_id;
  if (!taskId) {
    console.error('[Model API] 响应缺少 task_id:', responseData);
    throw new Error('文生图任务创建失败');
  }

  return taskId;
}

/**
 * 轮询任务状态，返回结果图片 URL
 */
async function pollTaskResult(taskId: string): Promise<string> {
  const url = `${KLING_API_BASE}/v1/images/text2image/${taskId}`;
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT * 1000) {
    console.log('[Model API] 轮询任务状态... (taskId:', taskId, ')');

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getKlingAuthHeaders(),
    }, '查询文生图状态');

    const pollData = await response.json();
    const taskData = pollData.data || pollData;
    const status = taskData.task_status || taskData.status || 'unknown';
    console.log('[Model API] 任务状态:', status);

    if (status === 'succeed' || status === 'completed' || status === 'SUCCESS') {
      console.log('[Model API] task_result:', JSON.stringify(taskData.task_result, null, 2));

      const resultUrl = taskData.task_result?.images?.[0]?.url
        || taskData.image_url
        || taskData.result_url
        || taskData.output?.[0]
        || taskData.images?.[0]?.url;

      if (!resultUrl) {
        console.error('[Model API] 任务成功但无结果图片:', JSON.stringify(pollData));
        throw new Error('模特图生成完成但未获取到图片');
      }

      console.log('[Model API] 生成成功，结果 URL:', resultUrl);
      return resultUrl;
    }

    if (status === 'failed' || status === 'FAILED') {
      const errorMsg = taskData.error?.message || taskData.message || '文生图失败';
      throw new Error(`AI 模特生成失败: ${errorMsg}`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error('模特图生成超时，请稍后重试');
}

/**
 * 下载图片并上传到 Supabase Storage，返回公开 URL
 */
async function downloadAndUploadToStorage(imageUrl: string): Promise<string> {
  console.log('[Model API] 下载模特图:', imageUrl.substring(0, 80));

  // 下载图片
  const imgResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
  if (!imgResponse.ok) throw new Error(`模特图下载失败 (HTTP ${imgResponse.status})`);

  const buffer = await imgResponse.arrayBuffer();
  console.log('[Model API] 模特图大小:', (buffer.byteLength / 1024).toFixed(1), 'KB');

  // 上传到 Supabase Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  const fileName = `ai_model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('tryon-images')
    .upload(fileName, Buffer.from(buffer), {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/png',
    });

  if (uploadError) {
    console.error('[Model API] Supabase 上传失败:', uploadError.message);
    throw new Error('模特图保存失败');
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('tryon-images')
    .getPublicUrl(fileName);

  console.log('[Model API] 模特图已保存到 Storage:', publicUrl);
  return publicUrl;
}

// ══════════════════════════════════════════════
// 主处理函数
// ══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  console.log('[Model API] === 收到模特生成请求 ===');

  try {
    // ── 1. 验证用户登录 ──
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch { /* 忽略 */ }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // ── 2. 解析参数 ──
    const body = await req.json().catch(() => ({}));
    const { gender, age, skinTone, height, weight } = body;

    if (!gender || !age || !skinTone || !height || !weight) {
      return NextResponse.json({ error: '缺少模特参数' }, { status: 400 });
    }

    console.log('[Model API] 模特参数:', { gender, age, skinTone, height, weight });

    // ── 3. 检查积分（≥1） ──
    const creditCheck = await checkUserHasEnoughCredits(user.id, 1);
    if (!creditCheck.can_try) {
      return NextResponse.json(
        { error: '积分不足', message: '生成 AI 模特需要 1 积分', needPurchase: true, redirectTo: '/pricing' },
        { status: 403 }
      );
    }

    // ── 4. 调用可灵文生图 API（失败不扣积分） ──
    const prompt = buildModelPrompt({ gender, age, skinTone, height, weight });
    console.log('[Model API] Prompt:', prompt);

    const taskId = await createText2ImageTask(prompt);
    const klingImageUrl = await pollTaskResult(taskId);

    // ── 5. 下载并上传到 Supabase Storage ──
    const modelImageUrl = await downloadAndUploadToStorage(klingImageUrl);

    // ── 6. 扣减 1 积分（生成成功后才扣） ──
    const deductResult = await consumeCredits(user.id, 1, 'AI模特生成');
    const creditsBalance = deductResult.success ? deductResult.credits_balance : creditCheck.credits;

    if (!deductResult.success) {
      console.warn('[Model API] 积分扣减失败，但模特图已生成');
    }

    // ── 7. 返回结果 ──
    return NextResponse.json({
      success: true,
      modelImageUrl,
      creditsBalance,
      message: `模特生成成功！消耗 1 积分，剩余 ${creditsBalance} 积分`,
    });

  } catch (err: any) {
    console.error('[Model API] 生成失败:', err.message);
    return NextResponse.json(
      { error: 'AI 模特生成失败', message: err.message || '请稍后重试' },
      { status: 500 }
    );
  }
}
