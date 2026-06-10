/**
 * AI 虚拟试衣页面
 * 
 * 功能：
 * 1. 登录状态检查
 * 2. 图片上传（人物照 + 服装照）
 * 3. AI 试衣（调用 /api/tryon）
 * 4. 异步轮询结果
 * 5. 更换服装功能
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import imageCompression from 'browser-image-compression';

// 类型定义
interface TryOnResult {
  success: boolean;
  resultImageUrl: string;
  resultUrl?: string;
  useType: string;
  creditsBalance: number;
  message: string;
  creditsConsumed: number;
  error?: string;
}

interface PollProgress {
  count: number;
  estimatedTime: number;
}

export default function TryOnPage() {
  const router = useRouter();
  const personInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);

  // Supabase 客户端（客户端初始化）
  const [supabase, setSupabase] = useState<any>(null);
  
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const client = createBrowserClient(supabaseUrl, supabaseKey);
    setSupabase(client);
  }, []);

  // 用户状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [credits, setCredits] = useState(0);

  // 图片状态
  const [personPreview, setPersonPreview] = useState('');
  const [personImage, setPersonImage] = useState('');
  const [clothingPreview, setClothingPreview] = useState('');
  const [clothingImage, setClothingImage] = useState('');

  // 上传状态
  const [isUploading, setIsUploading] = useState({ person: false, clothing: false });

  // 试衣状态
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string>(''); // 独立的图片 URL 状态
  const [error, setError] = useState('');
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [taskId, setTaskId] = useState('');

  // 轮询状态
  const [pollProgress, setPollProgress] = useState<PollProgress>({ count: 0, estimatedTime: 40 });
  const pollIntervalRef = useRef<number | null>(null);
  const pollCountRef = useRef<number>(0); // 使用 useRef 存储轮询次数，避免闭包问题

  // 使用 ref 存储图片 URL，避免轮询闭包问题
  const personImageRef = useRef<string>('');
  const clothingImageRef = useRef<string>('');

  // 初始化 - 检查登录状态
  useEffect(() => {
    if (!supabase) return;
    
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoggedIn(false);
          return;
        }
        
        setIsLoggedIn(true);
        setEmailVerified(!!user.email_confirmed_at);
        
        // 获取积分
        const { data: creditsData } = await supabase
          .from('user_credits')
          .select('credits')
          .eq('user_id', user.id)
          .single();
        
        setCredits(creditsData?.credits ?? 0);
      } catch (err) {
        console.error('[TryOn] 检查用户状态失败:', err);
        setIsLoggedIn(false);
      }
    };

    checkUser();
  }, [supabase]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // 上传图片到 Supabase Storage
  const uploadImage = async (file: File): Promise<string> => {
    if (!supabase) throw new Error('Supabase 客户端未初始化');
    
    // 生成纯英文数字文件名（避免中文导致上传失败）
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `tryon-images/${fileName}`;

    const { data, error } = await supabase.storage
      .from('tryon-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`上传失败: ${error.message}`);
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('tryon-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  // 处理图片上传
  const handleImageUpload = async (file: File, type: 'person' | 'clothing') => {
    if (!file || !file.type.startsWith('image/')) {
      setError('请上传有效的图片文件（JPG、PNG）');
      return;
    }

    setError('');
    
    if (type === 'person') {
      setIsUploading(prev => ({ ...prev, person: true }));
    } else {
      setIsUploading(prev => ({ ...prev, clothing: true }));
    }

    try {
      // 客户端压缩图片
      const options = {
        maxSizeMB: 2, // 最大 2MB
        maxWidthOrHeight: 1200, // 最大宽高 1200px
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      
      const imageUrl = await uploadImage(compressedFile);
      
      if (type === 'person') {
        setPersonPreview(imageUrl);
        setPersonImage(imageUrl);
      } else {
        setClothingPreview(imageUrl);
        setClothingImage(imageUrl);
      }
    } catch (err: any) {
      setError(err.message || '图片上传失败');
    } finally {
      if (type === 'person') {
        setIsUploading(prev => ({ ...prev, person: false }));
      } else {
        setIsUploading(prev => ({ ...prev, clothing: false }));
      }
    }
  };

  // 开始轮询（定义在 createTryOnTask 之前，确保闭包引用正确）
  const startPolling = useCallback((taskId: string) => {
    console.log('[TryOn] 即将启动轮询，taskId:', taskId);
    
    // 清除之前的定时器
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // 重置轮询计数
    pollCountRef.current = 0;

    // 轮询函数（使用传入的 taskId，避免闭包问题）
    const pollOnce = async (currentTaskId: string) => {
      console.log('[TryOn] 轮询中..., taskId:', currentTaskId);
      
      // 先增加计数并更新 UI，确保即使 fetch 卡住也能看到进度变化
      pollCountRef.current += 1;
      const currentCount = pollCountRef.current;
      const elapsed = currentCount * 2;
      const estimated = Math.max(0, 40 - elapsed);
      
      console.log(`[TryOn] 轮询第 ${currentCount} 次, 已等待 ${elapsed} 秒, 预计还需 ${estimated} 秒, taskId: ${currentTaskId}`);
      setPollProgress({ count: currentCount, estimatedTime: estimated });

      // 检查超时（40秒 = 20次 * 2秒）
      if (currentCount >= 20) {
        console.log('[TryOn] 轮询达到上限 20 次，超时');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError('生成超时，请稍后重试');
        setIsLoading(false);
        return;
      }

      try {
        console.log(`[TryOn] 发起请求: POST /api/tryon/status, taskId: ${currentTaskId}`);
        
        const response = await fetch('/api/tryon/status', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ taskId: currentTaskId })
        });

        const data = await response.json();
        console.log(`[TryOn] 轮询第 ${currentCount} 次响应:`, data);

        if (!response.ok) {
          throw new Error(data.error || '查询状态失败');
        }

        // 统一处理试衣成功（resultUrl 或 status === 'completed'）
        const isSuccess = data.resultUrl || data.status === 'completed';
        const finalResultUrl = data.resultUrl || data.resultUrl || '';

        if (isSuccess && finalResultUrl) {
          console.log('[TryOn] 试衣成功，resultUrl:', finalResultUrl);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          // 试衣成功，扣减积分并记录历史
          try {
            const deductRes = await fetch('/api/tryon/deduct', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({
                personImageUrl: personImageRef.current,
                clothingImageUrl: clothingImageRef.current,
                resultImageUrl: finalResultUrl,
              }),
            });
            const deductData = await deductRes.json();
            if (deductData.success) {
              console.log('[TryOn] 积分扣减成功，剩余:', deductData.creditsBalance);
              setCredits(deductData.creditsBalance);
            } else {
              console.error('[TryOn] 积分扣减失败:', deductData.error);
            }
          } catch (deductErr: any) {
            console.error('[TryOn] 积分扣减请求失败:', deductErr.message);
          }
          
          setResultUrl(finalResultUrl);
          setResult({
            success: true,
            resultImageUrl: finalResultUrl,
            resultUrl: finalResultUrl,
            useType: data.useType || '',
            creditsBalance: data.creditsBalance || 0,
            message: data.message || '试衣成功',
            creditsConsumed: 1
          });
          setIsLoading(false);
          return;
        }

        if (data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setError(data.error || '试衣失败');
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[TryOn] 轮询第', currentCount, '次失败:', err);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError('查询状态失败，请重试');
        setIsLoading(false);
      }
    };

    // 立即执行第一次轮询（不等待 2 秒）
    pollOnce(taskId);

    // 之后每 2 秒轮询一次
    pollIntervalRef.current = window.setInterval(() => pollOnce(taskId), 2000);
  }, []);

  // 创建试衣任务
  const createTryOnTask = useCallback(async () => {
    if (!personImage || !clothingImage) {
      setError('请先上传人物照片和服装照片');
      return;
    }

    // 检查邮箱验证状态
    if (!emailVerified) {
      setError('请先验证邮箱再试衣');
      return;
    }

    // 将图片 URL 存入 ref，供轮询成功后使用
    personImageRef.current = personImage;
    clothingImageRef.current = clothingImage;

    setError('');
    setIsLoading(true);
    setResult(null);
    setPollProgress({ count: 0, estimatedTime: 40 });

    // 创建任务请求（带 30 秒超时 + 自动重试）
    const doCreateTask = async (isRetry: boolean): Promise<{ taskId: string } | { noRetry: true; error: string } | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const response = await fetch('/api/tryon', {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            personImage,
            clothingImage
          }),
          signal: controller.signal,
        });
        
        const data = await response.json();
        
        // 只要返回了 taskId，就认为成功（即使状态码非 200）
        if (data.taskId) {
          return { taskId: data.taskId };
        }
        
        // 积分不足：直接返回特殊标记，不重试
        if (data.error === 'insufficient_credits') {
          console.warn('[TryOn] 积分不足，停止重试');
          return { taskId: 'INSUFFICIENT_CREDITS' };
        }
        
        // 服务端明确标记不可重试（内容安全、参数错误、超时等确定性错误）
        if (data.noRetry) {
          console.error(`[TryOn] 创建任务失败（不可重试）:`, data.error, data.message);
          return { noRetry: true, error: data.message || data.error || '操作失败，请稍后重试' };
        }
        
        // 没有 taskId，记录错误（可重试）
        if (!response.ok) {
          console.error(`[TryOn] 创建任务${isRetry ? '重试' : ''}失败:`, response.status, data.error, data.message);
          return null;
        }
        
        // 200 OK 但没有 taskId（不应发生）
        console.error(`[TryOn] 创建任务${isRetry ? '重试' : ''}返回 200 但无 taskId:`, data);
        return null;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error(`[TryOn] 创建任务${isRetry ? '重试' : ''}超时（30秒）`);
          return { noRetry: true, error: '服务响应较慢，请稍后重试' };
        }
        console.error(`[TryOn] 创建任务${isRetry ? '重试' : ''}异常:`, err.message);
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // 第一次尝试
    let result = await doCreateTask(false);
    
    // 积分不足：不重试，直接显示购买引导
    if (result && 'taskId' in result && result.taskId === 'INSUFFICIENT_CREDITS') {
      setIsLoading(false);
      setShowCreditsModal(true);
      return;
    }
    
    // 服务端明确标记不可重试：直接展示错误，不重试
    if (result && 'noRetry' in result && result.noRetry) {
      setError(result.error);
      setIsLoading(false);
      return;
    }
    
    // 第一次失败，自动重试一次
    if (!result) {
      console.log('[TryOn] 创建任务失败，1秒后自动重试...');
      await new Promise(r => setTimeout(r, 1000));
      result = await doCreateTask(true);
    }
    
    // 重试后服务端返回不可重试错误
    if (result && 'noRetry' in result && result.noRetry) {
      setError(result.error);
      setIsLoading(false);
      return;
    }
    
    // 拿到 taskId，立即启动轮询
    if (result && 'taskId' in result) {
      setTaskId(result.taskId);
      startPolling(result.taskId);
    } else {
      // 两次都失败，提示用户
      setError('创建任务失败，请稍后重试');
      setIsLoading(false);
    }
  }, [personImage, clothingImage, startPolling]);

  // 更换服装
  const handleChangeClothing = useCallback(() => {
    // 清除轮询定时器
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // 重置所有状态
    setClothingPreview('');
    setClothingImage('');
    setResult(null);
    setResultUrl(''); // 清空图片 URL
    setError('');
    setTaskId('');
    setPollProgress({ count: 0, estimatedTime: 40 });

    // 自动聚焦到服装上传区
    setTimeout(() => clothingInputRef.current?.click(), 100);
  }, []);

  // 未登录状态
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* 导航栏 */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-4 py-3" />
        </nav>

        {/* 主内容 */}
        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          {/* 标题 */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">AI 虚拟试衣</h1>
            <p className="mt-2 text-sm text-slate-500">上传人物照和服装照，AI 为您生成试穿效果</p>
          </div>

          {/* 未登录提示 */}
          <div className="text-center py-12 sm:py-16">
            <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">请先登录后再试穿</h2>
            <p className="text-sm text-slate-500 mb-6">登录后即可体验 AI 虚拟试衣功能</p>
            <button
              onClick={() => router.push('/profile?login=true')}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-1m3 4h10" />
              </svg>
              去登录
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 已登录状态 - 显示试衣功能
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-16">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center">
          <button
            onClick={() => router.push('/')}
            className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white/80 backdrop-blur hover:bg-slate-50 transition-colors"
          >
            ← 首页
          </button>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* 标题 */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">AI 虚拟试衣</h1>
          <p className="mt-2 text-sm text-slate-500">上传人物照和服装照，AI 为您生成试穿效果</p>
          <p className="mt-1.5 text-xs text-slate-400">
            每次消耗 1 积分 | 支持 JPG / PNG | 积分长期有效，放心囤！
          </p>
        </div>

        {/* 邮箱未验证提示 */}
        {!emailVerified && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-sm font-medium text-amber-800">请先验证邮箱再试衣</span>
            </div>
            <button
              onClick={() => router.push('/profile?login=true')}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              去验证
            </button>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* 图片上传区 */}
        {!result && (
          <div className="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-2">
            {/* 人物照片上传 */}
            <div className="group bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
              <input 
                ref={personInputRef} 
                type="file" 
                accept="image/*" 
                onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'person')} 
                className="hidden" 
              />
              {personPreview ? (
                <div className="relative">
                  <img src={personPreview} alt="人物预览" className="w-full h-64 object-cover rounded-xl shadow-sm" />
                  <button 
                    onClick={() => { setPersonPreview(''); setPersonImage(''); }}
                    className="absolute top-2 right-2 py-2 px-3 bg-red-500/90 backdrop-blur-sm text-white text-base font-medium rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => personInputRef.current?.click()} 
                  disabled={isUploading.person}
                  className="w-full h-64 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/30 text-slate-400 hover:text-indigo-600 hover:from-indigo-50/40 hover:to-purple-50/30 transition-all duration-300 active:scale-[0.98]"
                >
                  {isUploading.person ? (
                    <>
                      <div className="animate-spin w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full mb-3" />
                      <span className="text-sm font-medium text-indigo-600">图片处理中...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 mb-3 rounded-2xl bg-indigo-100/60 flex items-center justify-center group-hover:bg-indigo-200/60 transition-colors duration-300">
                        <svg className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">上传人物照片</span>
                      <span className="text-xs mt-1 text-slate-300 group-hover:text-indigo-400 transition-colors duration-300">点击选择或拖拽文件</span>
                    </>
                  )}
                </button>
              )}
              <p className="mt-3 text-xs text-center text-slate-400">支持 JPG、PNG，自动压缩优化</p>
            </div>

            {/* 服装照片上传 */}
            <div className="group bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
              <input 
                ref={clothingInputRef} 
                type="file" 
                accept="image/*" 
                onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'clothing')} 
                className="hidden" 
              />
              {clothingPreview ? (
                <div className="relative">
                  <img src={clothingPreview} alt="服装预览" className="w-full h-64 object-cover rounded-xl shadow-sm" />
                  <button 
                    onClick={() => { setClothingPreview(''); setClothingImage(''); }}
                    className="absolute top-2 right-2 py-2 px-3 bg-red-500/90 backdrop-blur-sm text-white text-base font-medium rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => clothingInputRef.current?.click()} 
                  disabled={isUploading.clothing}
                  className="w-full h-64 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/30 text-slate-400 hover:text-indigo-600 hover:from-indigo-50/40 hover:to-purple-50/30 transition-all duration-300 active:scale-[0.98]"
                >
                  {isUploading.clothing ? (
                    <>
                      <div className="animate-spin w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full mb-3" />
                      <span className="text-sm font-medium text-indigo-600">图片处理中...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 mb-3 rounded-2xl bg-indigo-100/60 flex items-center justify-center group-hover:bg-indigo-200/60 transition-colors duration-300">
                        <svg className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33l3.558-2.207a2.25 2.25 0 00.993-1.898V8.25A2.25 2.25 0 0018 6h-4.568a2.25 2.25 0 01-1.658-.734l-1.08-1.233a2.25 2.25 0 00-1.658-.734zM7.5 9.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">上传服装照片</span>
                      <span className="text-xs mt-1 text-slate-300 group-hover:text-indigo-400 transition-colors duration-300">点击选择或拖拽文件</span>
                    </>
                  )}
                </button>
              )}
              <p className="mt-3 text-xs text-center text-slate-400">支持 JPG、PNG，自动压缩优化</p>
            </div>
          </div>
        )}

        {/* 开始试衣按钮 */}
        {!result && (
          <button 
            onClick={createTryOnTask} 
            disabled={isLoading || !personImage || !clothingImage}
            className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
          >
            {isLoading ? '试衣中...' : '开始试衣（消耗 1 积分）'}
          </button>
        )}

        {/* 等待动画区域 */}
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-4">
            {/* 等待动画 */}
            <div className="w-[200px] h-[200px]">
              <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e7ff" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round" strokeDasharray="283" strokeDashoffset="70" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">AI 正在为您精心试穿...</p>
            <p className="text-xs text-slate-400">
              已等待 {pollProgress.count * 2} 秒
              {pollProgress.estimatedTime > 0 && (
                <span className="ml-2">· 预计还需 {pollProgress.estimatedTime} 秒</span>
              )}
            </p>
          </div>
        )}

        {/* 结果展示 - 使用独立的 resultUrl 状态 */}
        <div className="mt-8">
          {/* 成功结果 */}
          {resultUrl && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-900">试衣结果</h3>
                <span className="text-xs px-2 py-1 rounded-full text-green-600 bg-green-50">
                  试衣成功
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-slate-100">
                <img
                  src={resultUrl}
                  alt="试衣结果"
                  className="w-full max-h-[600px] object-contain"
                  onLoad={() => console.log('[TryOn] 图片加载成功:', resultUrl)}
                  onError={(e) => {
                    console.error('[TryOn] 图片加载失败:', resultUrl);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <span className="absolute bottom-2 right-2 text-white bg-black/40 px-2 py-0.5 rounded-md text-[11px] z-10">
                  What to Wear · AI生成
                </span>
              </div>
              <p className="mt-2 text-xs text-amber-600 text-center">
                生成图片链接有效期30天，请及时下载保存
              </p>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleChangeClothing}
                  className="py-2.5 px-6 border border-indigo-200 text-indigo-600 text-base font-medium rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  更换服装
                </button>
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() => {
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current);
                      pollIntervalRef.current = null;
                    }
                    setPersonPreview('');
                    setPersonImage('');
                    setClothingPreview('');
                    setClothingImage('');
                    setResult(null);
                    setResultUrl('');
                    setError('');
                    setTaskId('');
                    setPollProgress({ count: 0, estimatedTime: 40 });
                    setIsLoading(false);
                  }}
                  className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  重新试衣
                </button>
              </div>
            </div>
          )}

          {/* 失败结果 */}
          {result && !result.success && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-900">试衣结果</h3>
                <span className="text-xs px-2 py-1 rounded-full text-red-600 bg-red-50">
                  试衣失败
                </span>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {result.error || result.message || '试衣失败，请重试'}
              </div>
            </div>
          )}
        </div>

        {/* 服务声明 */}
        <div className="mt-12 pt-6 border-t border-slate-200 space-y-1.5">
          <p className="text-xs text-slate-400 text-center">
            上传图片即表示您同意 <a href="/terms" className="text-indigo-500 hover:text-indigo-600 underline">《用户协议与知识产权声明》</a>
          </p>
          <p className="text-xs text-slate-400 text-center">
            虚拟试衣功能由可灵AI（Kling AI）提供技术支持
          </p>
        </div>

        {/* 配饰按钮（敬请期待） */}
        <div className="mt-6 py-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <button
            onClick={() => alert('即将上线，敬请期待！')}
            disabled={isLoading}
            className="text-amber-600 font-medium hover:text-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            配饰（敬请期待）
          </button>
        </div>
      </main>

      {/* 积分不足弹窗 */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm mx-4 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">积分不足</h3>
            <p className="text-sm text-slate-500 mb-6">当前积分余额为 0，请先购买积分包后再试衣。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <a
                href="/pricing"
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors text-center"
              >
                去购买
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}