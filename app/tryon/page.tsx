/**
 * AI 虚拟试衣页面
 *
 * 功能：
 * 1. 普通模式：上传人物图 + 服装图 → 试衣（消耗 1 积分）
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// ══════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════

interface TryOnResult {
  success: boolean;
  resultImageUrl: string;  // 主字段名
  resultUrl?: string;     // 向后兼容
  useType: string;
  creditsBalance: number;
  message: string;
  creditsConsumed: number;
  error?: string;
}

interface UserStatus {
  isLoggedIn: boolean;
  credits: number;
}

// 试穿类型配置
// 配饰按钮配置
const ACCESSORY_TYPE = { id: 'accessory', label: '配饰', category: 'accessory' } as const;

// AI 模特参数配置
const GENDER_OPTIONS = [
  { id: 'female', label: '女' },
  { id: 'male', label: '男' },
] as const;

const AGE_OPTIONS = [
  { id: 'child', label: '儿童' },
  { id: 'youth', label: '青年' },
  { id: 'elder', label: '老年' },
] as const;

const SKIN_TONE_OPTIONS = [
  { id: 'yellow', label: '黄', color: '#F5D6A8' },
  { id: 'white', label: '白', color: '#FDEBD0' },
  { id: 'brown', label: '棕', color: '#C68642' },
  { id: 'dark', label: '深棕', color: '#8B4513' },
] as const;

// ══════════════════════════════════════════════
// 页面组件
// ══════════════════════════════════════════════

export default function TryOnPage() {
  const router = useRouter();
  // 使用延迟初始化避免构建时环境变量未注入的问题
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createBrowserClient(supabaseUrl, supabaseKey);
  });

  // 用户状态
  const [userStatus, setUserStatus] = useState<UserStatus>({
    isLoggedIn: false,
    credits: 0,
  });

  // AI 模特开关（暂时隐藏，保留代码）
  const SHOW_AI_MODEL = false; // 设为 true 可重新启用 AI 模特功能
  const [useAiModel, setUseAiModel] = useState(false);
  const [aiModelParams, setAiModelParams] = useState({
    gender: 'female' as string,
    age: 'youth' as string,
    skinTone: 'yellow' as string,
    height: 165,
    weight: 55,
  });

  // AI 模特生成状态
  const [isGeneratingModel, setIsGeneratingModel] = useState(false);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string>('');
  const [generatedModelPreview, setGeneratedModelPreview] = useState<string>('');

  // 图片状态
  const [personImage, setPersonImage] = useState<string>('');
  const [clothingImage, setClothingImage] = useState<string>('');
  const [personPreview, setPersonPreview] = useState<string>('');
  const [clothingPreview, setClothingPreview] = useState<string>('');

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState({ person: false, clothing: false });
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [error, setError] = useState<string>('');
  const [pollProgress, setPollProgress] = useState({ count: 0, estimatedTime: 30 }); // 轮询进度

  // AbortController 用于取消正在进行的请求
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数 - 取消所有未完成的请求和定时器
  const cleanupPendingRequests = useCallback(() => {
    console.log('[TryOn] 清理未完成的请求...');
    
    // 取消当前的 abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // 创建新的 abort controller 以备后续使用
    abortControllerRef.current = new AbortController();
  }, []);

  // Refs
  const personInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);

  // ══════════════════════════════════════════════
  // 初始化
  // ══════════════════════════════════════════════

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/profile');
        return;
      }
      const { data: credits } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .single();
      setUserStatus({ isLoggedIn: true, credits: credits?.credits ?? 0 });
    };
    checkUser();
  }, [supabase, router]);

  // ══════════════════════════════════════════════
  // 图片上传
  // ══════════════════════════════════════════════

  const handleImageUpload = async (file: File, type: 'person' | 'clothing') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('请上传图片文件（JPG、PNG）'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('图片大小不能超过 5MB'); return; }

    setIsUploading(prev => ({ ...prev, [type]: true }));
    setError('');

    try {
      const previewUrl = URL.createObjectURL(file);
      if (type === 'person') setPersonPreview(previewUrl);
      else setClothingPreview(previewUrl);

      const ext = file.name.split('.').pop() || 'png';
      const safeFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('tryon-images')
        .upload(safeFileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error(`[TryOn] ${type}图片上传失败:`, uploadError.message);
        setError(`图片上传失败：${uploadError.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('tryon-images')
        .getPublicUrl(safeFileName);

      console.log(`[TryOn] ${type === 'person' ? '人物' : '服装'}图上传成功，publicUrl: ${publicUrl}`);

      if (type === 'person') setPersonImage(publicUrl);
      else setClothingImage(publicUrl);
    } catch (err) {
      console.error(`[TryOn] ${type}图片上传异常:`, err);
      setError('图片上传出错，请重试');
    } finally {
      setIsUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'person' | 'clothing') => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file, type);
  };

  // ══════════════════════════════════════════════
  // 步骤 1：生成 AI 模特
  // ══════════════════════════════════════════════

  const handleGenerateModel = async () => {
    setError('');
    setIsGeneratingModel(true);
    setGeneratedModelUrl('');
    setGeneratedModelPreview('');
    setResult(null);

    try {
      console.log('[TryOn] 开始生成 AI 模特，参数:', aiModelParams);

      const response = await fetch('/api/model/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiModelParams),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) { router.push('/profile'); return; }
        if (response.status === 403 && data.needPurchase) {
          setError(data.message);
          setTimeout(() => router.push(data.redirectTo || '/pricing'), 3000);
          return;
        }
        throw new Error(data.message || data.error || '模特生成失败');
      }

      if (!data.modelImageUrl) throw new Error('服务器返回数据异常');

      console.log('[TryOn] AI 模特生成成功，URL:', data.modelImageUrl);
      setGeneratedModelUrl(data.modelImageUrl);
      setGeneratedModelPreview(data.modelImageUrl);
      setUserStatus(prev => ({ ...prev, credits: data.creditsBalance ?? prev.credits }));
    } catch (err: any) {
      setError(err.message || 'AI 模特生成失败，请重试');
    } finally {
      setIsGeneratingModel(false);
    }
  };

  // ══════════════════════════════════════════════
  // 步骤 2：使用模特试衣 / 普通试衣
  // ══════════════════════════════════════════════

  // 轮询间隔（毫秒）
  const POLL_INTERVAL = 2000;
  // 最大轮询次数（15 次 × 2 秒 = 30 秒）
  const MAX_POLL_RETRIES = 15;

  // 调用积分扣减 API
  const deductCredits = async (): Promise<{ success: boolean; creditsBalance?: number }> => {
    try {
      const response = await fetch('/api/tryon/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      console.log('[TryOn] 积分扣减响应:', data);

      if (data.success && data.creditsBalance !== undefined) {
        setUserStatus(prev => ({ ...prev, credits: data.creditsBalance }));
        return { success: true, creditsBalance: data.creditsBalance };
      }

      return { success: false };
    } catch (err: any) {
      console.error('[TryOn] 积分扣减失败:', err.message);
      return { success: false };
    }
  };

  // 轮询任务状态（使用 POST 请求）
  const pollTaskStatus = async (taskId: string): Promise<string> => {
    let retryCount = 0;

    while (retryCount < MAX_POLL_RETRIES) {
      try {
        const response = await fetch('/api/tryon/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
          signal: abortControllerRef.current?.signal,
        });
        const data = await response.json();

        console.log('[TryOn] 轮询任务状态:', data);

        // API 返回错误
        if (!data.success) {
          const errorMsg = data.error || '查询任务状态失败';
          // 如果是网络错误或超时，抛出具体错误
          if (response.status === 502 || response.status === 504) {
            throw new Error('服务暂时不可用，请稍后重试');
          }
          if (response.status === 500) {
            throw new Error('服务器异常，请稍后重试');
          }
          // 任务不存在或已过期
          if (response.status === 404 || response.status === 410) {
            throw new Error('任务不存在或已过期，请重新试衣');
          }
          throw new Error(errorMsg);
        }

        // 任务成功完成
        if (data.resultUrl) {
          return data.resultUrl;
        }

        // 任务失败
        if (data.status === 'failed') {
          throw new Error(data.error || '试衣失败');
        }

        // 任务处理中 - 更新进度并继续轮询
        retryCount++;
        const estimatedTime = Math.max(0, (MAX_POLL_RETRIES - retryCount) * 2);
        setPollProgress({ count: retryCount, estimatedTime });
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

      } catch (err: any) {
        // 网络错误（如断网、请求失败）
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          throw new Error('网络连接失败，请检查网络后重试');
        }
        // AbortError（超时）
        if (err.name === 'AbortError') {
          throw new Error('请求超时，请稍后重试');
        }
        // 其他错误直接抛出
        throw err;
      }
    }

    throw new Error('生成超时，请稍后重试');
  };

  const handleTryOn = async () => {
    // 验证
    if (useAiModel) {
      if (!generatedModelUrl) { setError('请先生成 AI 模特'); return; }
      if (!clothingImage) { setError('请上传服装图'); return; }
    } else {
      if (!personImage || !clothingImage) { setError('请上传人物图和服装图'); return; }
    }

    setIsLoading(true);
    setError('');
    setResult(null);
    setPollProgress({ count: 0, estimatedTime: 30 }); // 重置轮询进度

    try {
      const requestBody: Record<string, any> = {
        clothingImage,
        tryOnType: 'clothing', // 固定为服装试穿
        personImage: useAiModel ? generatedModelUrl : personImage,
      };

      console.log('[TryOn] 请求参数:', requestBody);

      // 封装请求函数，支持 401 自动刷新重试
      const createTask = async (isRetry = false): Promise<string> => {
        const response = await fetch('/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current?.signal,
        });

        const data = await response.json();
        console.log('[TryOn] 创建任务响应:', JSON.stringify(data));

        if (!response.ok) {
          // ── 401：尝试刷新 session 后重试一次 ──
          if (response.status === 401 && !isRetry) {
            console.log('[TryOn] 收到 401，尝试刷新 session...');
            setError('登录已过期，正在刷新...');

            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('[TryOn] session 刷新失败:', refreshError.message);
            setError('登录已过期，请重新登录');
            setTimeout(() => router.push('/profile'), 1500);
            throw new Error('登录已过期');
          }

            console.log('[TryOn] session 刷新成功，自动重试请求...');
            setError('');
            return createTask(true); // 重试一次
          }

          // ── 401 且已是重试：跳转登录 ──
          if (response.status === 401) {
            setError('登录已过期，请重新登录');
            setTimeout(() => router.push('/profile'), 1500);
            throw new Error('登录已过期');
          }

          // ── 403 积分不足：跳转购买页 ──
          if (response.status === 403 && data.needPurchase) {
            setError(data.message);
            setTimeout(() => router.push(data.redirectTo || '/pricing'), 3000);
            throw new Error('积分不足');
          }

          throw new Error(data.message || data.error || '创建试衣任务失败');
        }

        // ── 成功响应：获取 taskId ──
        if (!data.taskId) {
          console.error('[TryOn] 后端响应中缺少 taskId:', data);
          throw new Error('服务器返回数据异常：缺少任务 ID');
        }

        console.log('[TryOn] 任务创建成功，taskId:', data.taskId);
        return data.taskId;
      };

      // 步骤 1：创建试衣任务
      const taskId = await createTask();

      // 步骤 2：显示加载状态
      console.log('[TryOn] AI 正在为您试穿...');

      // 步骤 3：轮询任务状态
      console.log('[TryOn] 开始轮询任务状态...');
      const resultImageUrl = await pollTaskStatus(taskId);

      // 步骤 4：轮询成功，调用积分扣减
      console.log('[TryOn] 试衣成功，开始扣减积分...');
      const deductResult = await deductCredits();

      console.log('[TryOn] 试衣成功，结果图片 URL:', resultImageUrl);
      setResult({
        success: true,
        resultImageUrl,
        resultUrl: resultImageUrl,
        useType: 'credits',
        creditsBalance: deductResult.creditsBalance ?? userStatus.credits - 1,
        message: '试衣成功！',
        creditsConsumed: 1,
      });

    } catch (err: any) {
      console.error('[TryOn] 试衣流程失败:', err.message);

      // 跳过已处理的错误（登录过期、积分不足）
      if (err.message !== '登录已过期' && err.message !== '积分不足') {
        setError(err.message || '试衣失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ══════════════════════════════════════════════
  // 重置 AI 模特
  // ══════════════════════════════════════════════

  const handleResetModel = () => {
    setGeneratedModelUrl('');
    setGeneratedModelPreview('');
    setResult(null);
    setError('');
  };

  // ══════════════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════════════

  // 按钮是否可点击
  const canSubmit = useAiModel
    ? !!generatedModelUrl && !!clothingImage
    : !!personImage && !!clothingImage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ── 导航栏 ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3">
        </div>
      </nav>

      {/* ── 主内容 ── */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* 标题 */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">AI 虚拟试衣</h1>
          <p className="mt-2 text-sm text-slate-500">
            上传人物照和服装照，AI 为您生成试穿效果
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            每次消耗 1 积分 | 支持 JPG / PNG | 积分长期有效，放心囤！
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* ── AI 模特开关（暂时隐藏） ── */}
        {SHOW_AI_MODEL && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-900">使用 AI 模特</span>
                  <p className="text-xs text-slate-400">无需上传真人照片，AI 自动生成虚拟模特</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUseAiModel(!useAiModel);
                  setResult(null);
                  setError('');
                  if (!useAiModel) {
                    // 切换到 AI 模特模式时，清除普通人物图
                    setPersonImage('');
                    setPersonPreview('');
                  } else {
                    // 切换回普通模式时，清除已生成的模特
                    setGeneratedModelUrl('');
                    setGeneratedModelPreview('');
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useAiModel ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${useAiModel ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── AI 模特参数配置区（暂时隐藏） ── */}
        {SHOW_AI_MODEL && useAiModel && !generatedModelUrl && (
          <div className="mb-6 p-5 bg-white rounded-xl border border-indigo-100 space-y-5">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              模特参数
            </h3>

            {/* 性别 + 年龄 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">性别</label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map(g => (
                    <button key={g.id} onClick={() => setAiModelParams(p => ({ ...p, gender: g.id }))}
                      className={`flex-1 py-2 px-6 text-base font-medium rounded-lg transition-all
                        ${aiModelParams.gender === g.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
                    >{g.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">年龄</label>
                <div className="flex gap-2">
                  {AGE_OPTIONS.map(a => (
                    <button key={a.id} onClick={() => setAiModelParams(p => ({ ...p, age: a.id }))}
                      className={`flex-1 py-2 px-6 text-base font-medium rounded-lg transition-all
                        ${aiModelParams.age === a.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
                    >{a.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 肤色 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">肤色</label>
              <div className="flex gap-3">
                {SKIN_TONE_OPTIONS.map(s => (
                  <button key={s.id}
                    onClick={() => setAiModelParams(p => ({ ...p, skinTone: s.id }))}
                    className="flex flex-col items-center gap-1.5 group"
                    title={s.label}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 transition-all
                      ${aiModelParams.skinTone === s.id
                        ? 'border-indigo-600 ring-2 ring-indigo-200 scale-110'
                        : 'border-slate-200 hover:border-slate-400'}`}
                      style={{ backgroundColor: s.color }}
                    />
                    <span className={`text-xs ${aiModelParams.skinTone === s.id ? 'text-indigo-600 font-medium' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 身高 + 体重 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">身高</label>
                  <span className="text-xs font-semibold text-indigo-600">{aiModelParams.height}cm</span>
                </div>
                <input type="range" min={120} max={200} step={1} value={aiModelParams.height}
                  onChange={e => setAiModelParams(p => ({ ...p, height: Number(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-sm"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-300">120</span>
                  <span className="text-[10px] text-slate-300">200</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">体重</label>
                  <span className="text-xs font-semibold text-indigo-600">{aiModelParams.weight}kg</span>
                </div>
                <input type="range" min={30} max={120} step={1} value={aiModelParams.weight}
                  onChange={e => setAiModelParams(p => ({ ...p, weight: Number(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-sm"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-300">30</span>
                  <span className="text-[10px] text-slate-300">120</span>
                </div>
              </div>
            </div>

            {/* 生成模特按钮 */}
            <button onClick={handleGenerateModel} disabled={isGeneratingModel}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-base rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200">
              {isGeneratingModel ? (
                '生成中...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  生成 AI 模特
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── 已生成的 AI 模特展示（暂时隐藏） ── */}
        {SHOW_AI_MODEL && useAiModel && generatedModelUrl && (
          <div className="mb-6 p-5 bg-white rounded-xl border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-green-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                AI 模特已就绪
              </h3>
              <button onClick={handleResetModel}
                className="py-1.5 px-4 text-xs font-medium text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg hover:border-red-300 transition-colors">
                重新生成
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* 模特图 */}
              <div className="relative rounded-xl overflow-hidden bg-slate-50">
                <img src={generatedModelPreview} alt="AI 模特" className="w-full h-72 object-contain" />
                <div className="absolute bottom-2 right-2">
                  <a href={generatedModelUrl} download
                    className="py-1.5 px-3 bg-white/90 backdrop-blur text-xs font-medium text-slate-700 rounded-lg hover:bg-white transition-colors shadow-sm">
                    下载模特图
                  </a>
                </div>
              </div>
              {/* 服装上传区 */}
              <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 p-4 hover:border-indigo-400 transition-colors">
                <input ref={clothingInputRef} type="file" accept="image/*" onChange={e => onFileChange(e, 'clothing')} className="hidden" />
                {clothingPreview ? (
                  <div className="relative">
                    <img src={clothingPreview} alt="服装预览" className="w-full h-64 object-cover rounded-lg" />
                    <button onClick={() => { setClothingPreview(''); setClothingImage(''); }}
                      className="absolute top-2 right-2 py-1.5 px-2.5 bg-red-500 text-white text-sm font-medium rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">×</button>
                  </div>
                ) : (
                  <button onClick={() => clothingInputRef.current?.click()} disabled={isUploading.clothing}
                    className="w-full h-64 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
                    {isUploading.clothing ? (
                      <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33l3.558-2.207a2.25 2.25 0 00.993-1.898V8.25A2.25 2.25 0 0018 6h-4.568a2.25 2.25 0 01-1.658-.734l-1.08-1.233a2.25 2.25 0 00-1.658-.734zM7.5 9.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                        </svg>
                        <span className="font-medium text-sm">上传服装照片</span>
                        <span className="text-xs mt-1">点击上传</span>
                      </>
                    )}
                  </button>
                )}
                <p className="mt-2 text-xs text-center text-slate-400">支持 JPG、PNG，最大 5MB</p>
              </div>
            </div>

            {/* 使用该模特试衣按钮 */}
            <button onClick={handleTryOn} disabled={isLoading || !clothingImage}
              className="w-full mt-4 py-3 bg-indigo-600 text-white font-bold text-base rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200">
              {isLoading ? (
                '试衣中...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  使用该模特试衣
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── 图片上传区 ── */}
        {(!useAiModel || !generatedModelUrl) && (
          <div className={`grid gap-6 mb-8 ${useAiModel ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {/* 人物图上传（AI 模特模式下隐藏） */}
            {!useAiModel && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 hover:border-indigo-400 transition-colors">
                <input ref={personInputRef} type="file" accept="image/*" onChange={e => onFileChange(e, 'person')} className="hidden" />
                {personPreview ? (
                  <div className="relative">
                    <img src={personPreview} alt="人物预览" className="w-full h-64 object-cover rounded-xl" />
                    <button onClick={() => { setPersonPreview(''); setPersonImage(''); }}
                      className="absolute top-2 right-2 py-2 px-3 bg-red-500 text-white text-base font-medium rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">×</button>
                  </div>
                ) : (
                  <button onClick={() => personInputRef.current?.click()} disabled={isUploading.person}
                    className="w-full h-64 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
                    {isUploading.person ? (
                      <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="font-medium">上传人物照片</span>
                      </>
                    )}
                  </button>
                )}
                <p className="mt-3 text-xs text-center text-slate-400">支持 JPG、PNG，最大 5MB</p>
              </div>
            )}

            {/* 服装/配饰图上传 */}
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 hover:border-indigo-400 transition-colors">
              <input ref={clothingInputRef} type="file" accept="image/*" onChange={e => onFileChange(e, 'clothing')} className="hidden" />
              {clothingPreview ? (
                <div className="relative">
                  <img src={clothingPreview} alt="服装预览" className="w-full h-64 object-cover rounded-xl" />
                  <button onClick={() => { setClothingPreview(''); setClothingImage(''); }}
                    className="absolute top-2 right-2 py-2 px-3 bg-red-500 text-white text-base font-medium rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">×</button>
                </div>
              ) : (
                <button onClick={() => clothingInputRef.current?.click()} disabled={isUploading.clothing}
                  className="w-full h-64 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
                  {isUploading.clothing ? (
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33l3.558-2.207a2.25 2.25 0 00.993-1.898V8.25A2.25 2.25 0 0018 6h-4.568a2.25 2.25 0 01-1.658-.734l-1.08-1.233a2.25 2.25 0 00-1.658-.734zM7.5 9.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                      </svg>
                      <span className="font-medium">上传服装照片</span>
                    </>
                  )}
                </button>
              )}
              <p className="mt-3 text-xs text-center text-slate-400">支持 JPG、PNG，最大 5MB</p>
            </div>
          </div>
        )}

        {/* ── 开始试衣按钮（普通模式） ── */}
        {!useAiModel && (
          <button onClick={handleTryOn} disabled={isLoading || !canSubmit}
            className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200">
            {isLoading ? (
              '试衣中...'
            ) : (
              '开始试衣（消耗 1 积分）'
            )}
          </button>
        )}

        {/* 等待动画区域 */}
        {isLoading && !useAiModel && (
          <div className="mt-8 flex flex-col items-center gap-4">
            {/* 等待动画 */}
            <div className="relative">
              {/* GIF 动画 */}
              <img
                src="/wait-animation.gif"
                alt="AI 正在试衣中"
                className="w-[200px] h-[200px] object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  // 如果 GIF 不存在，显示备用的 MP4
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const videoEl = target.nextElementSibling as HTMLVideoElement;
                  if (videoEl) {
                    videoEl.style.display = 'block';
                  }
                }}
              />
              {/* MP4 备用 */}
              <video
                src="/wait-animation.mp4"
                className="w-[200px] h-[200px] object-contain rounded-lg shadow-lg hidden"
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => {
                  // 如果 MP4 也不存在，显示纯 CSS 旋转动画
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                  const fallbackEl = target.nextElementSibling as HTMLDivElement;
                  if (fallbackEl) {
                    fallbackEl.style.display = 'flex';
                  }
                }}
              />
              {/* 纯 CSS 旋转动画备用 */}
              <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-100 rounded-lg shadow-lg hidden">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            </div>

            {/* 进度文案 - 缩小文字并放在动画下方 */}
            <div className="text-center mt-4">
              <p className="text-sm font-medium text-slate-600">
                AI 正在为您精心试穿...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                已等待 {pollProgress.count * 2} 秒
                {pollProgress.estimatedTime > 0 && (
                  <span className="ml-2">
                    · 预计还需 {pollProgress.estimatedTime} 秒
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── 结果展示 ── */}
        {result && (
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-900">试衣结果</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${result.success ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {result.success ? '试衣成功' : '试衣失败'}
              </span>
            </div>
            {result.success && result.resultImageUrl ? (
              <>
                <div className="relative rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={result.resultImageUrl}
                    alt="试衣结果"
                    className="w-full max-h-[600px] object-contain"
                    onLoad={() => console.log('[TryOn] 结果图片加载成功:', result.resultImageUrl)}
                    onError={(e) => {
                      console.error('[TryOn] 结果图片加载失败:', result.resultImageUrl);
                      // 如果 resultImageUrl 加载失败，尝试 resultUrl
                      const target = e.target as HTMLImageElement;
                      if (result.resultUrl && result.resultUrl !== result.resultImageUrl) {
                        console.log('[TryOn] 尝试使用 resultUrl 回退:', result.resultUrl);
                        target.src = result.resultUrl;
                      } else {
                        setError('结果图片加载失败，请重试');
                      }
                    }}
                  />
                  {/* CSS 水印叠加层 */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 pointer-events-none select-none">
                    <span className="text-[11px] text-white/60 font-medium drop-shadow-md whitespace-nowrap">
                      AI TryOn · 生成
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <a href={result.resultImageUrl} download
                    className="flex-1 py-2 px-6 bg-slate-900 text-white text-base font-medium rounded-lg text-center hover:bg-slate-800 transition-colors shadow-md">下载图片</a>
                  <button onClick={() => {
                    // 清理所有未完成的请求
                    cleanupPendingRequests();
                    // 重置所有状态
                    setResult(null);
                    setPersonPreview('');
                    setClothingPreview('');
                    setPersonImage('');
                    setClothingImage('');
                    setError('');
                    setPollProgress({ count: 0, estimatedTime: 30 });
                    if (useAiModel) {
                      setGeneratedModelUrl('');
                      setGeneratedModelPreview('');
                    }
                  }}
                    className="flex-1 py-2 px-6 border border-slate-300 text-slate-700 text-base font-medium rounded-lg hover:bg-slate-50 transition-colors">再试一件</button>
                </div>
                <div className="mt-3">
                  <button onClick={() => {
                    // 清理所有未完成的请求
                    cleanupPendingRequests();
                    // 只清空服装和结果，保留人物图
                    setResult(null);
                    setClothingPreview('');
                    setClothingImage('');
                    setError('');
                    setPollProgress({ count: 0, estimatedTime: 30 });
                    // 自动聚焦到服装上传区
                    setTimeout(() => clothingInputRef.current?.click(), 100);
                  }}
                    className="w-full py-2.5 px-6 border border-indigo-200 text-indigo-600 text-base font-medium rounded-lg hover:bg-indigo-50 transition-colors">
                    更换服装
                  </button>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {result.error || result.message || '试衣失败，请重试'}
              </div>
            )}
          </div>
        )}

        {/* ── 服务声明 ── */}
        <div className="mt-12 pt-6 border-t border-slate-200 space-y-1.5">
          <p className="text-xs text-slate-400 text-center">
            上传图片即表示您同意 <a href="/terms" className="text-indigo-500 hover:text-indigo-600 underline">《用户协议与知识产权声明》</a>
          </p>
          <p className="text-xs text-slate-400 text-center">
            虚拟试衣功能由可灵AI（Kling AI）提供技术支持
          </p>
        </div>

        {/* ── 配饰按钮（敬请期待） ── */}
        <div className="mt-6 py-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <button
            onClick={() => alert('即将上线，敬请期待！')}
            disabled={isLoading}
            className="text-amber-600 font-medium hover:text-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ACCESSORY_TYPE.label}（敬请期待）
          </button>
        </div>
      </main>
    </div>
  );
}
