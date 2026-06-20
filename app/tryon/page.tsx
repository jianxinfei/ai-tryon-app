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

  // 分享到社区状态
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [shareProductLink, setShareProductLink] = useState('');
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // 任务队列状态（防止快速连续提交）
  const [queueCount, setQueueCount] = useState(0); // 排队中的任务数
  const taskQueueRef = useRef<(() => Promise<void>)[]>([]); // 任务队列
  const isProcessingQueueRef = useRef(false); // 是否正在处理队列

  // 轮询状态
  const [pollProgress, setPollProgress] = useState<PollProgress>({ count: 0, estimatedTime: 40 });
  const pollIntervalRef = useRef<number | null>(null);
  const pollCountRef = useRef<number>(0); // 使用 useRef 存储轮询次数，避免闭包问题

  // 使用 ref 存储图片 URL，避免轮询闭包问题
  const personImageRef = useRef<string>('');
  const clothingImageRef = useRef<string>('');
  // 防止重复扣减积分（幂等性保护）
  const deductedRef = useRef<boolean>(false);

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
    if (!supabase) throw new Error('Supabase client not initialized');
    
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
      throw new Error(`Upload failed: ${error.message}`);
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
      setError('Please upload a valid image (JPG, PNG)');
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
      setError(err.message || 'Image upload failed');
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
    // 重置扣减标记
    deductedRef.current = false;

    // 阶段1: 轮询回调结果表（13次 x 1.5秒 ≈ 20秒）
    // 阶段2: 兜底轮询可灵 API（7次 x 1.5秒 ≈ 10秒）
    // 总上限: 20次（30秒）
    const CALLBACK_POLL_MAX = 13;
    const FALLBACK_POLL_MAX = 20;

    // 轮询函数（使用传入的 taskId，避免闭包问题）
    const pollOnce = async (currentTaskId: string) => {
      console.log('[TryOn] 轮询中..., taskId:', currentTaskId);

      // 先增加计数并更新 UI
      pollCountRef.current += 1;
      const currentCount = pollCountRef.current;
      const elapsed = Math.round(currentCount * 1.5);

      console.log(`[TryOn] 轮询第 ${currentCount} 次, 已等待 ${elapsed} 秒, taskId: ${currentTaskId}`);
      setPollProgress({ count: currentCount, estimatedTime: Math.max(0, 30 - elapsed) });

      // 检查超时（20次 x 1.5秒 = 30秒）
      if (currentCount >= FALLBACK_POLL_MAX) {
        console.log('[TryOn] 轮询达到上限 20 次，超时');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError('Generation timed out, please try again later');
        setIsLoading(false);
        return;
      }

      try {
        // 阶段1: 轮询回调结果表（前15次）
        if (currentCount <= CALLBACK_POLL_MAX) {
          console.log(`[TryOn] 发起请求: POST /api/tryon/callback-result, taskId: ${currentTaskId}`);

          const response = await fetch('/api/tryon/callback-result', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ taskId: currentTaskId })
          });

          const data = await response.json();
          console.log(`[TryOn] 回调结果轮询第 ${currentCount} 次响应:`, data);

          if (data.status === 'succeed' && data.resultUrl) {
            console.log('[TryOn] 回调结果表命中 succeed，resultUrl:', data.resultUrl);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            // 试衣成功，扣减积分并记录历史（幂等性保护：只扣一次）
            if (!deductedRef.current) {
              deductedRef.current = true;
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
                    resultImageUrl: data.resultUrl,
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
            } else {
              console.log('[TryOn] 已扣减过积分，跳过重复扣减');
            }

            setResultUrl(data.resultUrl);
            setResult({
              success: true,
              resultImageUrl: data.resultUrl,
              resultUrl: data.resultUrl,
              useType: '',
              creditsBalance: 0,
              message: 'Try-on successful',
              creditsConsumed: 1
            });
            setIsLoading(false);
            return;
          }

          if (data.status === 'failed') {
            console.log('[TryOn] 回调结果表命中 failed:', data.error);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setError(data.error || 'Try-on failed');
            setIsLoading(false);
            return;
          }

          // status === 'processing'，继续轮询
          return;
        }

        // 阶段2: 兜底轮询可灵 API（第16-20次）
        console.log(`[TryOn] 发起请求: POST /api/tryon/status, taskId: ${currentTaskId}`);

        const response = await fetch('/api/tryon/status', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ taskId: currentTaskId })
        });

        const data = await response.json();
        console.log(`[TryOn] 兜底轮询第 ${currentCount} 次响应:`, data);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check status');
        }

        // 统一处理试衣成功（resultUrl 或 status === 'completed'）
        const isSuccess = data.resultUrl || data.status === 'completed';
        const finalResultUrl = data.resultUrl || data.resultUrl || '';

        if (isSuccess && finalResultUrl) {
          console.log('[TryOn] 兜底轮询试衣成功，resultUrl:', finalResultUrl);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // 试衣成功，扣减积分并记录历史（幂等性保护：只扣一次）
          if (!deductedRef.current) {
            deductedRef.current = true;
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
          } else {
            console.log('[TryOn] 已扣减过积分，跳过重复扣减');
          }

          setResultUrl(finalResultUrl);
          setResult({
            success: true,
            resultImageUrl: finalResultUrl,
            resultUrl: finalResultUrl,
            useType: data.useType || '',
            creditsBalance: data.creditsBalance || 0,
            message: 'Try-on successful',
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
          setError(data.error || 'Try-on failed');
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[TryOn] 轮询第', currentCount, '次失败:', err);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError('Failed to check status, please try again');
        setIsLoading(false);
      }
    };

    // 立即开始轮询（不再等回调，主用轮询）
    // 立即执行第一次轮询
    pollOnce(taskId);

    // 之后每 1.5 秒轮询一次
    pollIntervalRef.current = window.setInterval(() => pollOnce(taskId), 1500);
  }, []);

  // 处理任务队列（依次执行，上一个完成后才执行下一个）
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (taskQueueRef.current.length > 0) {
      const task = taskQueueRef.current.shift();
      setQueueCount(taskQueueRef.current.length);
      if (task) {
        await task();
      }
    }

    isProcessingQueueRef.current = false;
    setQueueCount(0);
  }, []);

  // 创建试衣任务
  const createTryOnTask = useCallback(async () => {
    if (!personImage || !clothingImage) {
      setError('Please upload both a person photo and a clothing photo first');
      return;
    }

    // 检查邮箱验证状态
    if (!emailVerified) {
      setError('Please verify your email before trying on');
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
          return { noRetry: true, error: data.message || data.error || 'Operation failed, please try again later' };
        }

        // code 1303 并发超限：特殊标记，触发前端等待重试
        if (data.code === 1303 || data.klingCode === 1303) {
          console.warn(`[TryOn] 并发超限 (code 1303)，等待后重试`);
          return { noRetry: true, error: '__CONCURRENT_LIMIT__' };
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
          return { noRetry: true, error: 'Server response slow, please try again later' };
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
    
    // 服务端明确标记不可重试：直接展示错误，不重试（排除并发超限）
    if (result && 'noRetry' in result && result.noRetry && result.error !== '__CONCURRENT_LIMIT__') {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    // code 1303 并发超限：等待 2 秒后重试，最多 3 次
    if (result && 'noRetry' in result && result.error === '__CONCURRENT_LIMIT__') {
      let retrySuccess = false;
      for (let i = 0; i < 3; i++) {
        console.log(`[TryOn] 并发超限，等待 2 秒后重试 (${i + 1}/3)...`);
        await new Promise(r => setTimeout(r, 2000));
        result = await doCreateTask(true);

        if (result && 'taskId' in result && result.taskId !== 'INSUFFICIENT_CREDITS') {
          retrySuccess = true;
          break;
        }

        // 重试后又遇到并发超限，继续循环
        if (result && 'noRetry' in result && result.error === '__CONCURRENT_LIMIT__') {
          continue;
        }

        // 其他不可重试错误
        if (result && 'noRetry' in result) {
          setError(result.error);
          setIsLoading(false);
          return;
        }
      }

      if (!retrySuccess) {
        setError('Server is busy, please try again in a moment');
        setIsLoading(false);
        return;
      }
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
      setError('Failed to create task, please try again later');
      setIsLoading(false);
    }
  }, [personImage, clothingImage, startPolling]);

  // 带任务队列的提交入口
  const submitTryOn = useCallback(() => {
    // 如果当前正在加载（有任务在执行），将请求加入队列
    if (isLoading) {
      console.log('[TryOn] 任务执行中，加入队列等待');
      taskQueueRef.current.push(async () => {
        await createTryOnTask();
      });
      setQueueCount(taskQueueRef.current.length);
      return;
    }

    // 没有任务在执行，直接执行
    createTryOnTask();
  }, [isLoading, createTryOnTask]);

  // 监听队列变化，自动处理
  useEffect(() => {
    if (!isLoading && taskQueueRef.current.length > 0 && !isProcessingQueueRef.current) {
      processQueue();
    }
  }, [isLoading, processQueue]);

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
      <div className="min-h-screen bg-[#FFF7FA]">
        {/* 主内容 */}
        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          {/* 标题 */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">AI Virtual Try-On</h1>
            <p className="mt-2 text-sm text-slate-500">Upload a person photo and a clothing photo, and AI will generate the try-on result for you</p>
          </div>

          {/* 未登录提示 */}
          <div className="text-center py-12 sm:py-16">
            <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Please log in first</h2>
            <p className="text-sm text-slate-500 mb-6">Log in to experience the AI virtual try-on feature</p>
            <button
              onClick={() => router.push('/profile/account?login=true')}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-1m3 4h10" />
              </svg>
              Log In
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 已登录状态 - 显示试衣功能
  return (
    <div className="min-h-screen bg-[#FFF7FA] pb-16">


      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* 标题 */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">AI Virtual Try-On</h1>
          <p className="mt-2 text-sm text-slate-500">Upload a person photo and a clothing photo, and AI will generate the try-on result for you</p>
          <p className="mt-1.5 text-xs text-slate-400">
            1 credit per use | JPG / PNG supported | Credits valid for 180 days from purchase
          </p>
        </div>

        {/* 邮箱未验证提示 */}
        {!emailVerified && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-sm font-medium text-amber-800">Please verify your email before trying on</span>
            </div>
            <button
              onClick={() => router.push('/profile/account?login=true')}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Verify Email
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
                  <img src={personPreview} alt="Person preview" className="w-full h-64 object-cover rounded-xl shadow-sm" />
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
                      <span className="text-sm font-medium text-indigo-600">Processing image...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 mb-3 rounded-2xl bg-indigo-100/60 flex items-center justify-center group-hover:bg-indigo-200/60 transition-colors duration-300">
                        <svg className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">Upload person photo</span>
                      <span className="text-xs mt-1 text-slate-300 group-hover:text-indigo-400 transition-colors duration-300">Click to select or drag a file</span>
                    </>
                  )}
                </button>
              )}
              <p className="mt-3 text-xs text-center text-slate-400">Supports JPG, PNG with auto compression</p>
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
                  <img src={clothingPreview} alt="Clothing preview" className="w-full h-64 object-cover rounded-xl shadow-sm" />
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
                      <span className="text-sm font-medium text-indigo-600">Processing image...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 mb-3 rounded-2xl bg-indigo-100/60 flex items-center justify-center group-hover:bg-indigo-200/60 transition-colors duration-300">
                        <svg className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33l3.558-2.207a2.25 2.25 0 00.993-1.898V8.25A2.25 2.25 0 0018 6h-4.568a2.25 2.25 0 01-1.658-.734l-1.08-1.233a2.25 2.25 0 00-1.658-.734zM7.5 9.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">Upload clothing photo</span>
                      <span className="text-xs mt-1 text-slate-300 group-hover:text-indigo-400 transition-colors duration-300">Click to select or drag a file</span>
                    </>
                  )}
                </button>
              )}
              <p className="mt-3 text-xs text-center text-slate-400">Supports JPG, PNG with auto compression</p>
            </div>
          </div>
        )}

        {/* 开始试衣按钮 */}
        {!result && (
          <button 
            onClick={submitTryOn} 
            disabled={isLoading || !personImage || !clothingImage}
            className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
          >
            {isLoading ? 'Trying on...' : 'Start Try-On (1 credit)'}
          </button>
        )}

        {/* 排队提示 */}
        {queueCount > 0 && (
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm rounded-full">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {queueCount} task{queueCount > 1 ? 's' : ''} in queue
            </span>
          </div>
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
            <p className="text-sm font-medium text-slate-600">AI is generating your try-on...</p>
            <p className="text-xs text-slate-400">
              Elapsed: {pollProgress.count * 2}s
            </p>
          </div>
        )}

        {/* 结果展示 - 使用独立的 resultUrl 状态 */}
        <div className="mt-8">
          {/* 成功结果 */}
          {resultUrl && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-900">Try-On Result</h3>
                <span className="text-xs px-2 py-1 rounded-full text-green-600 bg-green-50">
                  Try-on successful
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-slate-100">
                <img
                  src={resultUrl}
                  alt="Try-on result"
                  className="w-full max-h-[600px] object-contain"
                  onLoad={() => console.log('[TryOn] 图片加载成功:', resultUrl)}
                  onError={(e) => {
                    console.error('[TryOn] 图片加载失败:', resultUrl);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-amber-600 text-center">
                Generated image link is valid for 30 days, please download and save it in time
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={handleChangeClothing}
                  className="py-2.5 px-6 border border-indigo-200 text-indigo-600 text-base font-medium rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Change Clothing
                </button>
                <button
                  onClick={() => {
                    setShareCaption('');
                    setShareProductLink('');
                    setShareSuccess(false);
                    setShowShareModal(true);
                  }}
                  className="py-2.5 px-6 bg-gradient-to-r from-pink-500 to-indigo-500 text-white text-base font-medium rounded-lg hover:from-pink-600 hover:to-indigo-600 transition-colors"
                >
                  🌐 Share to Community
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
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* 失败结果 */}
          {result && !result.success && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-900">Try-On Result</h3>
                <span className="text-xs px-2 py-1 rounded-full text-red-600 bg-red-50">
                  Try-on failed
                </span>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {result.error || result.message || 'Try-on failed, please try again'}
              </div>
            </div>
          )}
        </div>

        {/* 服务声明 */}
        <div className="mt-12 pt-6 border-t border-slate-200 space-y-1.5">
          <p className="text-xs text-slate-400 text-center">
            By uploading images, you agree to the <a href="/terms" className="text-indigo-500 hover:text-indigo-600 underline">Terms of Service</a>
          </p>
          <p className="text-xs text-slate-400 text-center">
            Virtual try-on powered by Kling AI
          </p>
        </div>

        {/* 配饰按钮（敬请期待） */}
        <div className="mt-6 py-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <button
            onClick={() => alert('Coming soon!')}
            disabled={isLoading}
            className="text-amber-600 font-medium hover:text-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accessories (Coming Soon)
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
            <h3 className="text-lg font-bold text-slate-900 mb-2">Insufficient Credits</h3>
            <p className="text-sm text-slate-500 mb-6">Your current credit balance is 0. Please purchase a credit pack before trying on.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <a
                href="/pricing"
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors text-center"
              >
                Purchase Credits
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 分享到社区弹窗 */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md mx-4 w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Share to Community</h3>

            {/* 效果图预览 */}
            {resultUrl && (
              <div className="mb-4 rounded-xl overflow-hidden bg-slate-100">
                <img src={resultUrl} alt="Preview" className="w-full max-h-48 object-contain" />
              </div>
            )}

            {shareSuccess ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-green-600 font-medium">Shared successfully!</p>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  View Community
                </button>
              </div>
            ) : (
              <>
                {/* 文字描述 */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Caption</label>
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    placeholder="Describe your look..."
                    maxLength={200}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 resize-none"
                  />
                </div>

                {/* 商品链接（选填） */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Link <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={shareProductLink}
                    onChange={(e) => setShareProductLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!resultUrl) return;
                      setShareSubmitting(true);
                      try {
                        const res = await fetch('/api/community/share', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            resultImageUrl: resultUrl,
                            caption: shareCaption.trim() || null,
                            productLink: shareProductLink.trim() || null,
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setShareSuccess(true);
                        } else {
                          alert(data.error || 'Share failed');
                        }
                      } catch {
                        alert('Network error, please try again');
                      } finally {
                        setShareSubmitting(false);
                      }
                    }}
                    disabled={shareSubmitting}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-indigo-500 rounded-xl hover:from-pink-600 hover:to-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {shareSubmitting ? 'Sharing...' : 'Confirm Share'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
