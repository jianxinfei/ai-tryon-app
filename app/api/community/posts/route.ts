import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch { /* ignore */ }
          },
        },
      }
    );

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const mine = searchParams.get('mine') === 'true';
    const offset = (page - 1) * pageSize;

    // 构建查询
    let query = supabase
      .from('community_posts')
      .select('id, user_id, result_image_url, caption, product_link, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    // 如果 mine=true，只查当前用户的帖子
    if (mine) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
      }
      query = query.eq('user_id', user.id);
    }

    const { data: posts, error: postsError } = await query
      .range(offset, offset + pageSize - 1);

    if (postsError) {
      console.error('[community/posts] Fetch error:', postsError);
      return NextResponse.json({ error: '获取帖子失败' }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ posts: [], total: 0 });
    }

    // 获取帖子作者信息
    const userIds = posts.map(p => p.user_id).filter((id, index, arr) => arr.indexOf(id) === index);
    const { data: profiles } = await supabase
      .from('user_credits')
      .select('user_id')
      .in('user_id', userIds);

    // 获取每个帖子的评论数
    const postIds = posts.map(p => p.id);
    const { data: commentCounts } = await supabase
      .from('community_comments')
      .select('post_id')
      .in('post_id', postIds);

    const commentCountMap: Record<string, number> = {};
    if (commentCounts) {
      for (const c of commentCounts) {
        commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1;
      }
    }

    // 获取总数（带相同筛选条件）
    let countQuery = supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    if (mine) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) countQuery = countQuery.eq('user_id', user.id);
    }
    const { count } = await countQuery;

    // 组装返回数据
    const postsWithMeta = posts.map(post => ({
      id: post.id,
      result_image_url: post.result_image_url,
      caption: post.caption,
      product_link: post.product_link,
      created_at: post.created_at,
      user_id: post.user_id,
      user_prefix: post.user_id ? post.user_id.substring(0, 8) : 'unknown',
      comment_count: commentCountMap[post.id] || 0,
    }));

    return NextResponse.json({
      posts: postsWithMeta,
      total: count || 0,
    });
  } catch (err) {
    console.error('[community/posts] Unexpected error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
