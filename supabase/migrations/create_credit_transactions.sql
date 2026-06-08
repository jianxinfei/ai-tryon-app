-- ══════════════════════════════════════════════
-- credit_transactions 表
-- 记录所有积分变动流水（购买、赠送、消费、扣减）
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,           -- 'purchase' | 'bonus' | 'refund' | 'use'
  amount INTEGER NOT NULL,                 -- 正数=增加，负数=扣减
  balance_after INTEGER NOT NULL,          -- 交易后余额
  description TEXT,                       -- 描述（如"购买 10次试穿积分包"）
  payment_reference TEXT,                 -- 支付参考号（Creem order ID）
  payment_amount_cents INTEGER,            -- 支付金额（美分）
  payment_currency TEXT DEFAULT 'USD',     -- 支付币种
  stripe_payment_intent_id TEXT,           -- 兼容旧字段
  reference_type TEXT,                     -- 关联类型（如 'tryon'）
  reference_id TEXT,                       -- 关联 ID（如试衣任务 ID）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引：按用户查询交易记录
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

-- 索引：按用户+交易类型查询（用于新老用户判断等）
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON credit_transactions(user_id, transaction_type);

-- RLS：用户只能查看自己的交易记录
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);
