'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_prefix: string;
}

interface Post {
  id: string;
  result_image_url: string;
  person_image_url: string | null;
  clothing_image_url: string | null;
  caption: string | null;
  product_link: string | null;
  created_at: string;
  user_id: string;
  user_prefix: string;
  comment_count: number;
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const isZh = pathname.startsWith('/zh');
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [reportModal, setReportModal] = useState<{ commentId: string; commentContent: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState<{ success: boolean; message: string } | null>(null);

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

  useEffect(() => {
    if (!postId) return;

    const fetchPost = async () => {
      try {
        setPostLoading(true);
        const res = await fetch(`/api/community/posts?id=${postId}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data.post || null);
        }
      } catch (err) {
        console.error('[PostDetail] Fetch post error:', err);
      } finally {
        setPostLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  useEffect(() => {
    if (!postId) return;

    const fetchComments = async () => {
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
          console.error('[PostDetail] Fetch comments error:', error);
          return;
        }

        setComments((data || []).map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          user_prefix: c.user_id ? c.user_id.substring(0, 8) : 'unknown',
        })));
      } catch (err) {
        console.error('[PostDetail] Fetch comments error:', err);
      } finally {
        setCommentsLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

  const handleDeletePost = async () => {
    if (!post) return;
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        router.push('/community');
      } else {
        alert(data.error || (isZh ? '删除失败' : 'Delete failed'));
      }
    } catch {
      alert(isZh ? '网络错误' : 'Network error');
    }
  };

  const handleSubmitComment = async () => {
    if (!post) return;
    if (!user) {
      setCommentError(isZh ? '请先登录后再评论' : 'Please sign in to comment');
      return;
    }
    if (!commentText.trim()) {
      setCommentError(isZh ? '评论内容不能为空' : 'Comment cannot be empty');
      return;
    }

    try {
      setCommentSubmitting(true);
      setCommentError('');
      const res = await fetch('/api/community/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          content: commentText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error || (isZh ? '评论失败' : 'Comment failed'));
        return;
      }

      setCommentText('');
      // Refresh comments
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { data: freshData } = await supabase
        .from('community_comments')
        .select('id, content, created_at, user_id')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      setComments((freshData || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_prefix: c.user_id ? c.user_id.substring(0, 8) : 'unknown',
      })));
      setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
    } catch {
      setCommentError(isZh ? '网络错误，请重试' : 'Network error, please try again');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!reportModal || !user) return;
    if (!reportReason.trim()) {
      setReportResult({ success: false, message: isZh ? '请填写举报理由' : 'Please enter a reason' });
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
        setReportResult({ success: true, message: isZh ? '举报已提交，我们会尽快处理' : 'Report submitted, we will review it soon' });
        setTimeout(() => {
          setReportModal(null);
          setReportReason('');
          setReportResult(null);
        }, 2000);
      } else {
        setReportResult({ success: false, message: data.error || (isZh ? '举报失败' : 'Report failed') });
      }
    } catch {
      setReportResult({ success: false, message: isZh ? '网络错误' : 'Network error' });
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

    if (diffMins < 1) return isZh ? '刚刚' : 'Just now';
    if (diffMins < 60) return isZh ? `${diffMins} 分钟前` : `${diffMins}m ago`;
    if (diffHours < 24) return isZh ? `${diffHours} 小时前` : `${diffHours}h ago`;
    if (diffDays < 30) return isZh ? `${diffDays} 天前` : `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (postLoading) {
    return (
      <div className="min-h-screen bg-white pt-16 pb-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white pt-16 pb-8 flex items-center justify-center">
        <p className="text-slate-400">{isZh ? '帖子不存在' : 'Post not found'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-16 pb-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* 返回按钮 */}
        <button
          onClick={() => router.push('/community')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4 mt-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {isZh ? '返回试衣间' : 'Back to Fitting Room'}
        </button>

        {/* 三图展示：不裁切、不变形，自然排列 */}
        <div className="overflow-x-auto">
          {post.person_image_url && post.clothing_image_url ? (
            <div className="flex items-start gap-0">
              <img
                src={post.result_image_url}
                alt={post.caption || 'Post detail'}
                className="max-h-[70vh] object-contain flex-shrink-0"
              />
              <div className="flex flex-col flex-shrink-0">
                <img
                  src={post.person_image_url}
                  alt="Person"
                  className="max-h-[35vh] object-contain"
                />
                <img
                  src={post.clothing_image_url}
                  alt="Clothing"
                  className="max-h-[35vh] object-contain"
                />
              </div>
            </div>
          ) : (
            <img
              src={post.result_image_url}
              alt={post.caption || 'Post detail'}
              className="w-full max-h-[70vh] object-contain"
            />
          )}
        </div>

        {/* 信息区 */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">@{post.user_prefix}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{formatTime(post.created_at)}</span>
              {user && post.user_id === user.id && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  {isZh ? '删除' : 'Delete'}
                </button>
              )}
            </div>
          </div>

          {post.caption && (
            <p className="text-slate-800 text-base mb-3">{post.caption}</p>
          )}

          {post.product_link && (
            <a
              href={post.product_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {isZh ? '去购买' : 'Buy Now'}
            </a>
          )}
        </div>

        {/* 评论区 */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {isZh ? `评论 (${post.comment_count})` : `Comments (${post.comment_count})`}
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
            <p className="text-sm text-slate-400 py-2">
              {isZh ? '暂无评论，来说点什么吧' : 'No comments yet. Be the first!'}
            </p>
          ) : (
            <div className="space-y-3 mb-4">
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
                        alert(isZh ? '请先登录' : 'Please sign in');
                        return;
                      }
                      setReportModal({ commentId: comment.id, commentContent: comment.content });
                      setReportReason('');
                      setReportResult(null);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-red-500 transition-all flex-shrink-0 mt-1"
                    title={isZh ? '举报' : 'Report'}
                  >
                    {isZh ? '举报' : 'Report'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 评论输入框 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => { setCommentText(e.target.value); setCommentError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !commentSubmitting) handleSubmitComment(); }}
              placeholder={user ? (isZh ? '写下你的评论...' : 'Write a comment...') : (isZh ? '登录后评论' : 'Sign in to comment')}
              disabled={!user || commentSubmitting}
              maxLength={500}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!user || commentSubmitting || !commentText.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {commentSubmitting ? '...' : (isZh ? '发送' : 'Send')}
            </button>
          </div>
          {commentError && (
            <p className="text-xs text-red-500 mt-1.5">{commentError}</p>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {isZh ? '确认删除' : 'Confirm Delete'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {isZh ? '删除后无法恢复，确定要删除这条分享吗？' : 'This action cannot be undone. Are you sure?'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleDeletePost}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
              >
                {isZh ? '删除' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 举报弹窗 */}
      {reportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setReportModal(null); setReportResult(null); }} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {isZh ? '举报评论' : 'Report Comment'}
            </h3>
            <p className="text-sm text-slate-500 mb-4 line-clamp-2">
              &ldquo;{reportModal.commentContent}&rdquo;
            </p>

            <textarea
              value={reportReason}
              onChange={(e) => { setReportReason(e.target.value); setReportResult(null); }}
              placeholder={isZh ? '请说明举报理由...' : 'Please explain the reason...'}
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
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleReport}
                disabled={reportSubmitting || !reportReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {reportSubmitting ? (isZh ? '提交中...' : 'Submitting...') : (isZh ? '提交举报' : 'Submit Report')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
