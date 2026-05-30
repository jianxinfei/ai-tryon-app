/**
 * Supabase 客户端（浏览器端）
 * 使用 anon key，受 RLS 保护
 */

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * 获取当前登录用户
 */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * 获取用户积分（浏览器端，受 RLS 保护）
 */
export async function getUserCredits(userId: string) {
  const { data, error } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data;
}
