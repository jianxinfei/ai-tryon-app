'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface Post {
  id: string;
  result_image_url: string;
  caption: string | null;
  product_link: string | null;
  created_at: string;
  user_prefix: string;
  comment_count: number;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_prefix: string;
}

export default function CommunityPage() {
  const router = useRouter();
  const isZh = true;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [reportModal, setReportModal] = useState<{ commentId: string; commentContent: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch { /* ignore */ }
    };
    checkAuth();
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/community/posts?page=1&pageSize=40');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error('[Community] Fetch posts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const fetchComments = useCallback(async (postId: string) => {
    try {
      setCommentsLoading(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from('community_comments')
        .select('id, content, created_at, user_id')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Community] Fetch comments error:', error);
        return;
      }

      setComments((data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_prefix: c.user_id ? c.user_id.substring(0, 8) : 'unknown',
      })));
    } catch (err) {
      console.error('[Community] Fetch comments error:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const openPostDetail = (post: Post) => {
    setSelectedPost(post);
    setComments([]);
    setCommentText('');
    setCommentError('');
    fetchComments(post.id);
  };

  const closePostDetail = () => {
    setSelectedPost(null);
    setComments([]);
    setCommentText('');
    setCommentError('');
  };

  const handleSubmitComment = async () => {
    if (!selectedPost) return;
    if (!user) {
      setCommentError('请先登录后再评论');
      return;
    }
    if (!commentText.trim()) {
      setCommentError('评论内容不能为空');
      return;
    }

    try {
      setCommentSubmitting(true);
      setCommentError('');
      const res = await fetch('/api/community/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPost.id,
          content: commentText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error || '评论失败');
        return;
      }

      setCommentText('');
      fetchComments(selectedPost.id);
      setPosts(prev => prev.map(p =>
        p.id === selectedPost.id ? { ...p, comment_count: p.comment_count + 1 } : p
      ));
    } catch {
      setCommentError('网络错误，请重试');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!reportModal || !user) return;
    if (!reportReason.trim()) {
      setReportResult({ success: false, message: '请填写举报理由' });
      return;
    }

    try {
      setReportSubmitting(true);
      setReportResult(null);
      const res = await fetch('/api/community/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: reportModal.commentId,
          reason: reportReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReportResult({ success: true, message: '举报已提交，我们会尽快处理' });
        setTimeout(() => {
          setReportModal(null);
          setReportReason('');
          setReportResult(null);
        }, 2000);
      } else {
        setReportResult({ success: false, message: data.error || '举报失败' });
      }
    } catch {
      setReportResult({ success: false, message: '网络错误' });
    } finally {
      setReportSubmitting(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 30) return `${diffDays} 天前`;
    return date.toLocaleDateString();
  };

  // 小红书风格：瀑布流布局，计算每列高度
  const distributePosts = (posts: Post[], cols: number) => {
    const columns: Post[][] = Array.from({ length: cols }, () => []);
    const heights = new Array(cols).fill(0);
    posts.forEach((post) => {
      const minCol = heights.indexOf(Math.min(...heights));
      columns[minCol].push(post);
      heights[minCol] += 1;
    });
    return columns;
  };

  return (
    <div className="min-h-screen bg-white pt-16 pb-8">
      {/* 小红书风格瀑布流 */}
      {loading ? (
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="break-inside-avoid mb-2 sm:mb-3">
                <div className="bg-slate-100 rounded-xl animate-pulse" style={{ height: `${200 + (i % 3) * 80}px` }} />
              </div>
            ))}
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 pt-8">
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-3">
            <div className="break-inside-avoid mb-2 sm:mb-3">
              <div className="bg-slate-50 rounded-xl aspect-[3/4] flex items-center justify-center">
                <p className="text-slate-300 text-sm">暂无内容</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-3">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => openPostDetail(post)}
                className="break-inside-avoid mb-2 sm:mb-3 cursor-pointer group"
              >
                <div className="relative rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={post.result_image_url}
                    alt={post.caption || 'Community post'}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* 悬停时显示标题 */}
                  {post.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-xs line-clamp-2">{post.caption}</p>
                    </div>
                  )}
                </div>
                {/* 底部信息 */}
                <div className="flex items-center justify-between mt-1 px-0.5">
                  <span className="text-xs text-slate-500">@{post.user_prefix}</span>
                  <div className="flex items-center gap-1">
                    {post.comment_count > 0 && (
                      <span className="text-xs text-slate-400 flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {post.comment_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 帖子详情弹窗 */}
      {selectedPost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePostDetail} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={closePostDetail}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="bg-slate-100">
              <img
                src={selectedPost.result_image_url}
                alt={selectedPost.caption || 'Post detail'}
                className="w-full max-h-[60vh] object-contain"
              />
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">@{selectedPost.user_prefix}</span>
                <span className="text-xs text-slate-400">{formatTime(selectedPost.created_at)}</span>
              </div>

              {selectedPost.caption && (
                <p className="text-slate-800 text-base mb-3">{selectedPost.caption}</p>
              )}

              {selectedPost.product_link && (
                <a
                  href={selectedPost.product_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mb-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  去购买
                </a>
              )}

              <div className="border-t border-slate-100 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  评论 ({selectedPost.comment_count})
                </h3>

                {commentsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 bg-slate-200 rounded w-1/3 mb-1" />
                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">暂无评论，来说点什么吧</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2 group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-slate-600">@{comment.user_prefix}</span>
                            <span className="text-xs text-slate-400">{formatTime(comment.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-700">{comment.content}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (!user) {
                              alert('请先登录');
                              return;
                            }
                            setReportModal({ commentId: comment.id, commentContent: comment.content });
                            setReportReason('');
                            setReportResult(null);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-red-500 transition-all flex-shrink-0 mt-1"
                          title="举报"
                        >
                          举报
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => { setCommentText(e.target.value); setCommentError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !commentSubmitting) handleSubmitComment(); }}
                    placeholder={user ? '写下你的评论...' : '登录后评论'}
                    disabled={!user || commentSubmitting}
                    maxLength={500}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!user || commentSubmitting || !commentText.trim()}
                    className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {commentSubmitting ? '...' : '发送'}
                  </button>
                </div>
                {commentError && (
                  <p className="text-xs text-red-500 mt-1.5">{commentError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 举报弹窗 */}
      {reportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setReportModal(null); setReportResult(null); }} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">举报评论</h3>
            <p className="text-sm text-slate-500 mb-4 line-clamp-2">
              &ldquo;{reportModal.commentContent}&rdquo;
            </p>

            <textarea
              value={reportReason}
              onChange={(e) => { setReportReason(e.target.value); setReportResult(null); }}
              placeholder="请说明举报理由..."
              maxLength={200}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 resize-none"
            />

            {reportResult && (
              <p className={`text-xs mt-1.5 ${reportResult.success ? 'text-green-600' : 'text-red-500'}`}>
                {reportResult.message}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setReportModal(null); setReportResult(null); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReport}
                disabled={reportSubmitting || !reportReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {reportSubmitting ? '提交中...' : '提交举报'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
