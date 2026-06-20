import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    const { commentId, reason } = body;

    if (!commentId || !reason) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (reason.trim().length === 0 || reason.trim().length > 200) {
      return NextResponse.json({ error: '举报理由需在 1-200 字之间' }, { status: 400 });
    }

    const { error } = await supabase
      .from('community_reports')
      .insert({
        comment_id: commentId,
        reported_by: user.id,
        reason: reason.trim(),
      });

    if (error) {
      console.error('[community/report] Insert error:', error);
      // 如果是唯一约束冲突，说明已经举报过
      if (error.code === '23505') {
        return NextResponse.json({ error: '你已经举报过该评论' }, { status: 409 });
      }
      return NextResponse.json({ error: '举报失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[community/report] Unexpected error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
