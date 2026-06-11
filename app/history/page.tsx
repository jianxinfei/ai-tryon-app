'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface TryOnRecord {
  id: string;
  person_image_url: string;
  clothing_image_url: string;
  result_image_url: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<TryOnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<TryOnRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TryOnRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/profile?login=true');
        return;
      }

      const { data, error } = await supabase
        .from('tryon_history')
        .select('id, person_image_url, clothing_image_url, result_image_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[History] 查询试衣历史失败:', error.message);
        setError('加载试衣记录失败，请稍后重试');
        return;
      }

      setRecords(data || []);
    } catch (err: any) {
      console.error('[History] 获取试衣历史异常:', err.message);
      setError('加载试衣记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tryon/history/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const data = await res.json();
      if (data.success) {
        setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        if (selectedRecord?.id === deleteTarget.id) {
          setSelectedRecord(null);
        }
      } else {
        alert(data.error || '删除失败');
      }
    } catch (err: any) {
      console.error('[History] 删除失败:', err.message);
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };
        }

        setRecords(data || []);
      } catch (err: any) {
        console.error('[History] 获取试衣历史异常:', err.message);
        setError('加载试衣记录失败');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [supabase, router]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#FFF7FA] pb-16">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/profile')}
            className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white/80 backdrop-blur hover:bg-slate-50 transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-slate-900">试衣记录</h1>
          <div className="w-16" />
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 加载中 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full mb-4" />
            <p className="text-sm text-slate-500">加载中...</p>
          </div>
        )}

        {/* 错误提示 */}
        {!loading && error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-600">{error}</p>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && records.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">暂无试衣记录</h2>
            <p className="text-sm text-slate-500 mb-6">您还没有生成过试衣结果，快去体验吧！</p>
            <button
              onClick={() => router.push('/tryon')}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              去试衣
            </button>
          </div>
        )}

        {/* 图片墙 */}
        {!loading && !error && records.length > 0 && (
          <>
            <p className="text-sm text-slate-500 mb-6">
              共 {records.length} 条记录 · 点击图片可放大查看
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-100 transition-all duration-300 text-left"
                >
                  <img
                    src={record.result_image_url}
                    alt="试衣结果"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white text-xs font-medium">
                      {formatDate(record.created_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {/* 放大查看弹窗 */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 结果大图 */}
            <div className="aspect-[3/4] bg-slate-100">
              <img
                src={selectedRecord.result_image_url}
                alt="试衣结果"
                className="w-full h-full object-contain"
              />
            </div>

            {/* 详情 */}
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-500">
                生成时间：{formatDate(selectedRecord.created_at)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">人物照片</p>
                  <img
                    src={selectedRecord.person_image_url}
                    alt="人物照片"
                    className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">服装照片</p>
                  <img
                    src={selectedRecord.clothing_image_url}
                    alt="服装照片"
                    className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <a
                href={selectedRecord.result_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium text-center rounded-xl transition-colors"
              >
                下载图片
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
