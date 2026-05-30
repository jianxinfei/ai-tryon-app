/**
 * AI 虚拟试衣页面
 *
 * 功能：
 * 1. 普通模式：上传人物图 + 服装图 → 试衣（消耗 1 积分）
 * 2. AI 模特模式（两步）：
 *    - 步骤 1：配置参数 → 生成 AI 模特（消耗 1 积分）
 *    - 步骤 2：上传服装图 → 使用模特试衣（消耗 1 积分）
 *    总共 2 积分，分两次扣
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// ══════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════

interface TryOnResult {
  success: boolean;
  resultUrl: string;
  useType: string;
  creditsBalance: number;
  message: string;
  creditsConsumed: number;
}

interface UserStatus {
  isLoggedIn: boolean;
  credits: number;
}

// 试穿类型配置
const TRY_ON_TYPES = [
  { id: 'upper_body', label: '上衣', category: 'clothing', uploadLabel: '服装照片' },
  { id: 'lower_body', label: '下衣', category: 'clothing', uploadLabel: '服装照片' },
  { id: 'dress', label: '连衣裙/套装', category: 'clothing', uploadLabel: '服装照片' },
  { id: 'hat', label: '帽子', category: 'accessory', uploadLabel: '帽子图片' },
  { id: 'glasses', label: '眼镜', category: 'accessory', uploadLabel: '眼镜图片' },
  { id: 'necklace', label: '项链', category: 'accessory', uploadLabel: '项链图片' },
  { id: 'earring', label: '耳饰', category: 'accessory', uploadLabel: '耳饰图片' },
] as const;

type TryOnTypeId = typeof TRY_ON_TYPES[number]['id'];

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
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  // 用户状态
  const [userStatus, setUserStatus] = useState<UserStatus>({
    isLoggedIn: false,
    credits: 0,
  });

  // 试穿类型
  const [tryOnType, setTryOnType] = useState<TryOnTypeId>('upper_body');

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
        router.push('/auth/login?redirectTo=/tryon');
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
        if (response.status === 401) { router.push('/auth/login?redirectTo=/tryon'); return; }
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

  const handleTryOn = async () => {
    // 验证
    if (useAiModel) {
      if (!generatedModelUrl) { setError('请先生成 AI 模特'); return; }
      if (!clothingImage) { setError('请上传服装图'); return; }
    } else {
      if (!personImage || !clothingImage) { setError('请上传人物图和服装图'); return; }
    }

    const selectedType = TRY_ON_TYPES.find(t => t.id === tryOnType);
    if (selectedType?.category === 'accessory') {
      setError('配饰试穿即将上线，敬请期待！');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const requestBody: Record<string, any> = {
        clothingImage,
        tryOnType,
        personImage: useAiModel ? generatedModelUrl : personImage,
      };

      console.log('[TryOn] 请求参数:', requestBody);

      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) { router.push('/auth/login?redirectTo=/tryon'); return; }
        if (response.status === 403 && data.needPurchase) {
          setError(data.message);
          setTimeout(() => router.push(data.redirectTo || '/pricing'), 3000);
          return;
        }
        throw new Error(data.message || data.error || '试衣失败');
      }

      if (!data.resultUrl) throw new Error('服务器返回数据异常');

      console.log('[TryOn] 试衣成功，结果图片 URL:', data.resultUrl);
      setResult(data);
      setUserStatus(prev => ({ ...prev, credits: data.creditsBalance ?? prev.credits }));
    } catch (err: any) {
      setError(err.message || '试衣失败，请重试');
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-900 hover:text-indigo-600 transition-colors">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-sm sm:text-base">AI Try-On</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
              <span>积分: {userStatus.credits}</span>
            </div>
            <button onClick={() => router.push('/pricing')} className="py-2 px-6 text-base font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors">
              购买积分
            </button>
          </div>
        </div>
      </nav>

      {/* ── 主内容 ── */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* 标题 */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">AI 虚拟试衣</h1>
          <p className="mt-2 text-sm text-slate-500">
            {useAiModel
              ? generatedModelUrl
                ? '模特已就绪，上传服装即可试穿'
                : '配置模特参数，AI 将为您生成虚拟模特（消耗 1 积分）'
              : '上传人物照片和服装照片，AI 将为您生成试穿效果（消耗 1 积分）'}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* ── 试穿类型选择器 ── */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">试穿类型</label>
          <div className="flex flex-wrap gap-2">
            {TRY_ON_TYPES.map((type) => {
              const isSelected = tryOnType === type.id;
              const isAccessory = type.category === 'accessory';
              return (
                <button key={type.id} onClick={() => setTryOnType(type.id)}
                  className={`py-2 px-6 text-base font-medium rounded-lg transition-all
                    ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                  {type.label}
                  {isAccessory && !isSelected && <span className="ml-1.5 text-xs text-amber-500">✨</span>}
                </button>
              );
            })}
          </div>
          {TRY_ON_TYPES.find(t => t.id === tryOnType)?.category === 'accessory' && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.144 2.42-1.144 3.185 0l6.364 9.528c.753 1.131-.056 2.623-1.592 2.623H3.485c-1.536 0-2.345-1.492-1.592-2.623l6.364-9.528zM11 14a1 1 0 11-2 0 1 1 0 012 0zm-1-3a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              配饰试穿功能即将上线，敬请期待！
            </p>
          )}
        </div>

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
                  <p className="text-xs text-slate-400">无需上传真人照片，AI 自动生成虚拟模特（生成 1 积分 + 试衣 1 积分）</p>
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
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI 正在生成模特...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  生成 AI 模特（消耗 1 积分）
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
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI 正在试衣中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  使用该模特试衣（消耗 1 积分）
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
                        <span className="text-xs mt-1">点击或拖拽上传</span>
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
                      <span className="font-medium">
                        上传{TRY_ON_TYPES.find(t => t.id === tryOnType)?.uploadLabel || '服装照片'}
                      </span>
                      <span className="text-xs mt-1">点击或拖拽上传</span>
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
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI 正在试衣中...
              </span>
            ) : (
              '开始试衣（消耗 1 积分）'
            )}
          </button>
        )}

        {/* ── 结果展示 ── */}
        {result && (
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-900">试衣结果</h3>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">试衣成功</span>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-slate-100">
              <img
                src={result.resultUrl}
                alt="试衣结果"
                className="w-full max-h-[600px] object-contain"
                onLoad={() => console.log('[TryOn] 结果图片加载成功:', result.resultUrl)}
                onError={(e) => console.error('[TryOn] 结果图片加载失败:', result.resultUrl)}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <a href={result.resultUrl} download
                className="flex-1 py-2 px-6 bg-slate-900 text-white text-base font-medium rounded-lg text-center hover:bg-slate-800 transition-colors shadow-md">下载图片</a>
              <button onClick={() => {
                setResult(null);
                setPersonPreview('');
                setClothingPreview('');
                setPersonImage('');
                setClothingImage('');
                if (useAiModel) {
                  setGeneratedModelUrl('');
                  setGeneratedModelPreview('');
                }
              }}
                className="flex-1 py-2 px-6 border border-slate-300 text-slate-700 text-base font-medium rounded-lg hover:bg-slate-50 transition-colors">再试一件</button>
            </div>
          </div>
        )}

        {/* ── 使用说明 ── */}
        <div className="mt-12 p-6 bg-slate-50 rounded-2xl">
          <h3 className="font-bold text-slate-900 mb-3">使用说明</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2"><span className="text-indigo-600">•</span>普通试衣消耗 1 积分，AI 模特模式消耗 2 积分（生成 1 + 试衣 1）</li>
            <li className="flex items-start gap-2"><span className="text-indigo-600">•</span>积分可单独购买，永久有效</li>
            <li className="flex items-start gap-2"><span className="text-indigo-600">•</span>支持 JPG、PNG 格式图片</li>
            <li className="flex items-start gap-2"><span className="text-indigo-600">•</span>开启「使用 AI 模特」可无需上传真人照片</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
