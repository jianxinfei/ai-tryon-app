/**
 * 轮询加载动画测试页面
 * 用于本地测试加载动画和预估时间的显示效果
 */

'use client';

import { useState } from 'react';

export default function TestLoadingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [pollProgress, setPollProgress] = useState({ count: 0, estimatedTime: 30 });
  const [isComplete, setIsComplete] = useState(false);

  // 模拟轮询过程
  const startMockPolling = async () => {
    setIsLoading(true);
    setIsComplete(false);
    setPollProgress({ count: 0, estimatedTime: 30 });

    const MAX_POLL_RETRIES = 15;
    const POLL_INTERVAL = 2000; // 2秒

    for (let i = 0; i < MAX_POLL_RETRIES; i++) {
      // 模拟处理中状态
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      
      const estimatedTime = Math.max(0, (MAX_POLL_RETRIES - i - 1) * 2);
      setPollProgress({ count: i + 1, estimatedTime });
      
      console.log(`[Mock] 轮询第 ${i + 1} 次，预计还需 ${estimatedTime} 秒`);

      // 模拟在第 8 次轮询时完成（约 16 秒）
      if (i === 7) {
        setIsLoading(false);
        setIsComplete(true);
        console.log('[Mock] 任务完成！');
        return;
      }
    }

    // 超时
    setIsLoading(false);
    console.log('[Mock] 任务超时');
  };

  const resetTest = () => {
    setIsLoading(false);
    setIsComplete(false);
    setPollProgress({ count: 0, estimatedTime: 30 });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          轮询加载动画测试
        </h1>

        {/* 说明 */}
        <div className="bg-white rounded-xl p-6 mb-6 border border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-3">测试说明</h2>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• 点击"开始模拟"按钮启动轮询模拟</li>
            <li>• 轮询间隔：2 秒</li>
            <li>• 最大轮询次数：15 次（30 秒超时）</li>
            <li>• 模拟在第 8 次轮询时完成（约 16 秒）</li>
          </ul>
        </div>

        {/* 进度显示 */}
        <div className="bg-white rounded-xl p-6 mb-6 border border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-4">当前状态</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{pollProgress.count}</div>
              <div className="text-xs text-slate-500 mt-1">轮询次数</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{pollProgress.estimatedTime}s</div>
              <div className="text-xs text-slate-500 mt-1">预计剩余</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className={`text-2xl font-bold ${isComplete ? 'text-green-600' : 'text-slate-400'}`}>
                {isComplete ? '✓' : '○'}
              </div>
              <div className="text-xs text-slate-500 mt-1">完成状态</div>
            </div>
          </div>
        </div>

        {/* 模拟按钮 - 与实际页面样式一致 */}
        <div className="mb-6">
          <button
            onClick={isLoading ? undefined : startMockPolling}
            disabled={isLoading}
            className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
          >
            {isLoading ? (
              <span className="flex flex-col items-center justify-center gap-1">
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI 正在为您精心试穿...
                </span>
                {pollProgress.estimatedTime > 0 && (
                  <span className="text-sm font-normal opacity-80">
                    预计还需 {pollProgress.estimatedTime} 秒
                  </span>
                )}
              </span>
            ) : isComplete ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                试衣完成！
              </span>
            ) : (
              '开始模拟'
            )}
          </button>
        </div>

        {/* 重置按钮 */}
        {(isLoading || isComplete) && (
          <button
            onClick={resetTest}
            className="w-full py-3 border border-slate-300 text-slate-600 font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            重置测试
          </button>
        )}

        {/* 时间线 */}
        {pollProgress.count > 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 mt-6">
            <h2 className="font-semibold text-slate-800 mb-4">轮询时间线</h2>
            <div className="space-y-2">
              {Array.from({ length: pollProgress.count }, (_, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-slate-700">第 {i + 1} 次轮询</div>
                    <div className="text-xs text-slate-400">
                      已用时 {(i + 1) * 2} 秒 · 预计剩余 {Math.max(0, 30 - (i + 1) * 2)} 秒
                    </div>
                  </div>
                  {i === pollProgress.count - 1 && !isComplete && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-600 rounded-full">当前</span>
                  )}
                </div>
              ))}
              {isComplete && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    ✓
                  </div>
                  <div className="flex-1 text-green-700 font-medium">任务完成</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
