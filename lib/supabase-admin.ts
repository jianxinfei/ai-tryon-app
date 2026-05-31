/**
 * Supabase 服务端客户端
 * 使用 service_role key，绕过 RLS
 *
 * 注意：使用延迟初始化（lazy initialization）避免在构建时环境变量未注入的问题
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

/**
 * 获取 Supabase Admin 客户端（延迟初始化）
 * 使用 service_role key，绕过 RLS
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase URL 和 Service Role Key 未配置。请检查环境变量 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  }

  return _supabaseAdmin;
}

// 兼容旧代码的导出（延迟获取）
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabaseAdmin(), prop);
  },
});
