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
    const { resultImageUrl, personImageUrl, clothingImageUrl, clothing2ImageUrl, caption, productLink, tryOnMode } = body;

    if (!resultImageUrl) {
      return NextResponse.json({ error: '缺少效果图 URL' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        result_image_url: resultImageUrl,
        person_image_url: personImageUrl || null,
        clothing_image_url: clothingImageUrl || null,
        clothing2_image_url: clothing2ImageUrl || null,
        caption: caption?.trim() || null,
        product_link: productLink?.trim() || null,
        tryon_mode: tryOnMode || 'single',
        status: 'approved',
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[community/share] Insert error:', error);
      return NextResponse.json({ error: '分享失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true, postId: data.id });
  } catch (err) {
    console.error('[community/share] Unexpected error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
