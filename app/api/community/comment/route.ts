import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isContentClean } from '@/lib/content-filter';

export async function POST(request: NextRequest) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, content } = body;

    if (!postId || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 内容审核
    const filterResult = isContentClean(content);
    if (!filterResult.clean) {
      return NextResponse.json({ error: filterResult.reason }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: content.trim(),
      })
      .select('id, content, created_at')
      .single();

    if (error) {
      console.error('[community/comment] Insert error:', error);
      return NextResponse.json({ error: '评论失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_prefix: user.id.substring(0, 8),
      },
    });
  } catch (err) {
    console.error('[community/comment] Unexpected error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
