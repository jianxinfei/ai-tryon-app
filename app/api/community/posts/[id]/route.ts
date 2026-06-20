import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id;
    if (!postId) {
      return NextResponse.json({ error: 'Missing post ID' }, { status: 400 });
    }

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

    // 先查询帖子，确认作者是当前用户
    const { data: post, error: fetchError } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: '帖子不存在' }, { status: 404 });
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: '无权删除他人帖子' }, { status: 403 });
    }

    // 删除帖子（级联删除评论和举报，由外键 ON DELETE CASCADE 处理）
    const { error: deleteError } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('[community/posts/delete] Delete error:', deleteError);
      return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[community/posts/delete] Unexpected error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
