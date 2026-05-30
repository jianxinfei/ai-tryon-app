-- ══════════════════════════════════════════════════════════
-- Supabase 数据库触发器：用户注册时自动创建积分记录
-- ══════════════════════════════════════════════════════════
--
-- 使用方法：
-- 1. 打开 Supabase Dashboard → SQL Editor
-- 2. 粘贴此 SQL 并执行
--
-- 原理：监听 auth.users 表的 INSERT 事件，
--       当新用户注册时，自动在 user_credits 表插入初始积分记录
-- ══════════════════════════════════════════════════════════

-- 1. 创建触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 在 user_credits 表中为新用户创建初始积分记录
  INSERT INTO public.user_credits (user_id, credits)
  VALUES (
    NEW.id,           -- Supabase Auth 用户 ID (UUID)
    0                 -- 初始积分为 0
  )
  ON CONFLICT (user_id) DO NOTHING;  -- 防止重复插入

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建触发器：在 auth.users 表插入新记录后执行
--    注意：auth.users 是 Supabase 内部表，需要特殊权限
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. 验证触发器是否创建成功
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
