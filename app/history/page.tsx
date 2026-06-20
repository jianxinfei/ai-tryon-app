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

  // 分享到试衣间状态
  const [shareRecord, setShareRecord] = useState<TryOnRecord | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [shareProductLink, setShareProductLink] = useState('');
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const fetchHistory = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // 登录用模态框，不再跳转到 /profile?login=true
        return;
      }

      const { data, error } = await supabase
        .from('tryon_history')
        .select('id, person_image_url, clothing_image_url, result_image_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[History] 查询试衣历史失败:', error.message);
        setError('Failed to load history, please try again later');
        return;
      }

      setRecords(data || []);
    } catch (err: unknown) {
      console.error('[History] 获取试衣历史异常:', err instanceof Error ? err.message : String(err));
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const targetId = deleteTarget.id;
    console.log('[History] 开始删除记录, recordId:', targetId);
    try {
      const res = await fetch(`/api/tryon/history/${targetId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const data = await res.json();
      console.log('[History] 删除接口返回:', JSON.stringify(data), ', status:', res.status);

      if (data.success) {
        // 先从本地状态移除
        setRecords(prev => prev.filter(r => r.id !== targetId));
        if (selectedRecord?.id === targetId) {
          setSelectedRecord(null);
        }
        // 强制重新从后端拉取最新数据，确保与数据库一致
        console.log('[History] 删除成功，重新从后端拉取数据...');
        await fetchHistory();
      } else {
        console.error('[History] 删除失败:', data.error);
        alert(data.error || 'Delete failed');
      }
    } catch (err: unknown) {
      console.error('[History] 删除请求异常:', err instanceof Error ? err.message : String(err));
      alert('Delete failed, please try again');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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


      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-extrabold text-slate-900 text-center mb-6">Try-On History</h1>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
            <p className="mt-4 text-sm text-slate-400">Loading...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(''); fetchHistory(); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Reload
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm mb-2">No try-on records yet</p>
            <p className="text-slate-400 text-xs mb-6">Try virtual try-on now</p>
            <a
              href="/tryon"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Try Now
            </a>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">{records.length} records total</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {records.map((record) => (
                <div key={record.id} className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-100 transition-all duration-300">
                  <button
                    onClick={() => setSelectedRecord(record)}
                    className="w-full h-full text-left"
                  >
                    <img
                      src={record.result_image_url}
                      alt="Try-on result"
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
                  {/* 分享按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareRecord(record);
                      setShareCaption('');
                      setShareProductLink('');
                      setShareSuccess(false);
                    }}
                    className="absolute top-2 right-10 z-10 w-7 h-7 bg-black/40 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                    title="Share to community"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(record); }}
                    className="absolute top-2 right-2 z-10 w-7 h-7 bg-black/40 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                    title="Delete record"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
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

            {/* 左侧：结果大图 */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center min-h-[300px] md:min-h-0">
              <img
                src={selectedRecord.result_image_url}
                alt="Try-on result"
                className="w-full h-full object-contain max-h-[60vh] md:max-h-[80vh]"
              />
            </div>

            {/* 右侧：人物照片 + 服装照片 + 按钮 */}
            <div className="w-full md:w-64 flex-shrink-0 p-4 space-y-3 flex flex-col">
              <p className="text-sm text-slate-500">
                {formatDate(selectedRecord.created_at)}
              </p>
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Person Photo</p>
                  <img
                    src={selectedRecord.person_image_url}
                    alt="Person photo"
                    className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Clothing Photo</p>
                  <img
                    src={selectedRecord.clothing_image_url}
                    alt="Clothing photo"
                    className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <a
                  href={selectedRecord.result_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium text-center rounded-xl transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    setShareRecord(selectedRecord);
                    setShareCaption('');
                    setShareProductLink('');
                    setShareSuccess(false);
                  }}
                  className="block py-2.5 bg-gradient-to-r from-pink-500 to-indigo-500 hover:from-pink-600 hover:to-indigo-600 text-white text-sm font-medium text-center rounded-xl transition-colors"
                >
                  Share
                </button>
                <button
                  onClick={() => { setSelectedRecord(null); setDeleteTarget(selectedRecord); }}
                  className="block py-2.5 bg-white border border-red-200 text-red-500 text-sm font-medium text-center rounded-xl hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分享到试衣间弹窗 */}
      {shareRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md mx-4 w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5">
              {/* 关闭按钮 */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900">Share to Fitting Room</h3>
                <button
                  onClick={() => setShareRecord(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              {shareSuccess ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-green-600 font-medium text-sm">Shared successfully!</p>
                  <button
                    onClick={() => setShareRecord(null)}
                    className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* 三图预览 */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Person</p>
                      <img src={shareRecord.person_image_url} alt="Person" className="w-full aspect-[3/4] object-cover rounded-lg" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Clothing</p>
                      <img src={shareRecord.clothing_image_url} alt="Clothing" className="w-full aspect-[3/4] object-cover rounded-lg" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Result</p>
                      <img src={shareRecord.result_image_url} alt="Result" className="w-full aspect-[3/4] object-cover rounded-lg" />
                    </div>
                  </div>

                  {/* 文字描述 */}
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    placeholder="Describe your look..."
                    maxLength={200}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 resize-none mb-3"
                  />

                  {/* 按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShareRecord(null)}
                      className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setShareSubmitting(true);
                        try {
                          const res = await fetch('/api/community/share', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              resultImageUrl: shareRecord.result_image_url,
                              caption: shareCaption.trim() || null,
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
                      className="flex-1 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-indigo-500 rounded-xl hover:from-pink-600 hover:to-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {shareSubmitting ? 'Sharing...' : 'Share'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Confirm Delete</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              This action cannot be undone. Are you sure you want to delete this record?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
