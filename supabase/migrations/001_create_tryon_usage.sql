-- ══════════════════════════════════════════════════════════
-- Supabase 数据库表：试衣月度使用记录
-- ══════════════════════════════════════════════════════════
--
-- 用途：记录订阅用户每月试衣次数，实现每月 100 次上限
--
-- 使用方法：
-- 1. 打开 Supabase Dashboard → SQL Editor
-- 2. 粘贴此 SQL 并执行
-- ══════════════════════════════════════════════════════════

-- 创建 tryon_usage 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.tryon_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- 格式: "2024-01"
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 复合主键：每个用户每月一条记录
  PRIMARY KEY (user_id, month)
);

-- 添加表注释
COMMENT ON TABLE public.tryon_usage IS '记录用户每月试衣使用次数，用于订阅用户 100 次/月上限控制';
COMMENT ON COLUMN public.tryon_usage.user_id IS '用户 ID，关联 auth.users';
COMMENT ON COLUMN public.tryon_usage.month IS '月份，格式 YYYY-MM';
COMMENT ON COLUMN public.tryon_usage.count IS '本月已使用次数';

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_tryon_usage_user_id ON public.tryon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_tryon_usage_month ON public.tryon_usage(month);

-- 启用 RLS（行级安全）
ALTER TABLE public.tryon_usage ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看和修改自己的记录
DO $$
BEGIN
  -- 删除已存在的策略（如果存在）
  DROP POLICY IF EXISTS "Users can view own usage" ON public.tryon_usage;
  DROP POLICY IF EXISTS "Users can update own usage" ON public.tryon_usage;
  DROP POLICY IF EXISTS "Users can insert own usage" ON public.tryon_usage;
  
  -- 创建新策略
  CREATE POLICY "Users can view own usage"
    ON public.tryon_usage
    FOR SELECT
    USING (auth.uid() = user_id);
    
  CREATE POLICY "Users can update own usage"
    ON public.tryon_usage
    FOR UPDATE
    USING (auth.uid() = user_id);
    
  CREATE POLICY "Users can insert own usage"
    ON public.tryon_usage
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
END $$;

-- 验证表是否创建成功
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tryon_usage'
ORDER BY ordinal_position;
