'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

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

export default function CommunityPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMine, setShowMine] = useState(false);
  const [user, setUser] = useState<any>(null);

  // 从 URL 读取 mine 参数（避免 useSearchParams 的 SSR 问题）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mine') === 'true') {
        setShowMine(true);
      }
    }
  }, []);

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

  const fetchPosts = useCallback(async (mine: boolean) => {
    try {
      setLoading(true);
      const url = mine
        ? '/api/community/posts?page=1&pageSize=40&mine=true'
        : '/api/community/posts?page=1&pageSize=40';
      const res = await fetch(url);
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
    fetchPosts(showMine);
  }, [fetchPosts, showMine]);

  const handleToggleMine = () => {
    const next = !showMine;
    setShowMine(next);
    if (next) {
      router.replace(`${pathname}?mine=true`, { scroll: false });
    } else {
      router.replace(pathname, { scroll: false });
    }
  };

  return (
    <div className="min-h-screen bg-white pt-16 pb-8">
      {/* 顶部筛选标签 */}
      {user && (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => { if (showMine) handleToggleMine(); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !showMine
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => { if (!showMine) handleToggleMine(); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                showMine
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              我的分享
            </button>
          </div>
        </div>
      )}

      {/* Pinterest/Xiaohongshu style masonry feed */}
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
          <div className="text-center py-20">
            <p className="text-slate-400 text-sm">
              {showMine ? '你还没有分享过穿搭' : '暂无内容'}
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-3">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => router.push(`/zh/community/${post.id}`)}
                className="break-inside-avoid mb-2 sm:mb-3 cursor-pointer group relative"
              >
                <div className="relative rounded-xl overflow-hidden bg-slate-100">
                  {/* 三图布局：左侧大图 + 右侧两张竖图 */}
                  {post.person_image_url && post.clothing_image_url ? (
                    <div className="flex gap-0.5 aspect-[3/4]">
                      <div className="flex-1 min-w-0">
                        <img
                          src={post.result_image_url}
                          alt={post.caption || 'Community post'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                      <div className="w-[30%] flex flex-col gap-0.5 flex-shrink-0">
                        <div className="flex-1 min-h-0">
                          <img
                            src={post.person_image_url}
                            alt="Person"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1 min-h-0">
                          <img
                            src={post.clothing_image_url}
                            alt="Clothing"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={post.result_image_url}
                      alt={post.caption || 'Community post'}
                      className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  )}
                  {post.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-xs line-clamp-2">{post.caption}</p>
                    </div>
                  )}
                </div>
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
    </div>
  );
}
