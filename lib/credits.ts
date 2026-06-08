/**
 * 积分操作工具函数
 * 服务端使用，直接操作 Supabase 表
 * 
 * 注意：user_credits 表只有以下字段：
 * - id, user_id, credits, created_at, updated_at
 */

import { getSupabaseAdmin } from './supabase-admin';

// ══════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════

export interface UserCredits {
  id: string;
  user_id: string;
  credits: number;
  created_at: string;
  updated_at: string;
}

export interface CreditCheckResult {
  can_try: boolean;
  use_type: 'credits' | '';
  credits: number;
  reason?: string;
}

export interface ConsumeResult {
  success: boolean;
  use_type: string;
  credits_balance: number;
  error?: string;
}

// ══════════════════════════════════════════════
// 查询积分
// ══════════════════════════════════════════════

/**
 * 获取用户的积分信息
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  console.log('[Credits] 开始查询用户积分, userId:', userId);
  
  const { data, error } = await getSupabaseAdmin()
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[Credits] 查询用户积分失败:', {
      userId,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
    });
    return null;
  }
  
  console.log('[Credits] 查询用户积分成功:', {
    userId,
    credits: data?.credits,
    recordId: data?.id,
  });
  
  return data;
}

/**
 * 检查用户是否可以试衣
 * 
 * 简化逻辑：只有积分系统，没有免费次数/试用期/订阅
 */
export async function checkUserCanTryOn(userId: string): Promise<CreditCheckResult> {
  const userCredits = await getUserCredits(userId);

  if (!userCredits) {
    return {
      can_try: false,
      use_type: '',
      credits: 0,
      reason: 'no_credits_record',
    };
  }

  // 只有积分系统
  if (userCredits.credits > 0) {
    return {
      can_try: true,
      use_type: 'credits',
      credits: userCredits.credits,
    };
  }

  return {
    can_try: false,
    use_type: '',
    credits: 0,
    reason: 'insufficient_credits',
  };
}

// ══════════════════════════════════════════════
// 添加积分
// ══════════════════════════════════════════════

/**
 * 为用户添加积分（购买或赠送）
 */
export async function addCredits(params: {
  userId: string;
  amount: number;
  transactionType: 'purchase' | 'bonus' | 'refund';
  description: string;
  paymentReference?: string;
  paymentAmountCents?: number;
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, transactionType, description, paymentReference, paymentAmountCents } = params;

  // 获取当前余额
  const current = await getUserCredits(userId);
  const currentBalance = current?.credits ?? 0;
  const newBalance = currentBalance + amount;

  // 更新余额
  if (current) {
    const { error } = await getSupabaseAdmin()
      .from('user_credits')
      .update({ credits: newBalance })
      .eq('user_id', userId);
    
    if (error) {
      console.error('[Credits] 更新积分失败:', error);
      throw error;
    }
  } else {
    // 首次创建记录
    const { error } = await getSupabaseAdmin()
      .from('user_credits')
      .insert({
        user_id: userId,
        credits: amount,
      });
    
    if (error) {
      console.error('[Credits] 创建积分记录失败:', error);
      throw error;
    }
  }

  // 记录交易流水（如果表存在）
  try {
    await getSupabaseAdmin().from('credit_transactions').insert({
      user_id: userId,
      transaction_type: transactionType,
      amount: amount,
      balance_after: newBalance,
      description,
      payment_reference: paymentReference ?? null,
      payment_amount_cents: paymentAmountCents ?? null,
      payment_currency: 'USD',
    });
  } catch (e) {
    // 如果 credit_transactions 表不存在，忽略错误
    console.log('[Credits] 记录交易流水失败（表可能不存在）:', e);
  }

  return { success: true, newBalance };
}

// ══════════════════════════════════════════════
// 扣减积分
// ══════════════════════════════════════════════

/**
 * 检查用户积分是否足够
 */
export async function checkUserHasEnoughCredits(userId: string, required: number): Promise<CreditCheckResult> {
  console.log('[Credits] 检查用户积分是否足够:', { userId, required });
  
  const userCredits = await getUserCredits(userId);

  // 用户无积分记录
  if (!userCredits) {
    console.log('[Credits] 用户无积分记录:', { userId });
    return {
      can_try: false,
      use_type: '',
      credits: 0,
      reason: 'no_credits_record',
    };
  }

  console.log('[Credits] 用户积分信息:', { 
    userId, 
    currentCredits: userCredits.credits, 
    required,
    hasEnough: userCredits.credits >= required 
  });

  if (userCredits.credits >= required) {
    return {
      can_try: true,
      use_type: 'credits',
      credits: userCredits.credits,
    };
  }

  console.log('[Credits] 用户积分不足:', { 
    userId, 
    currentCredits: userCredits.credits, 
    required 
  });

  return {
    can_try: false,
    use_type: '',
    credits: userCredits.credits,
    reason: 'insufficient_credits',
  };
}

/**
 * 扣减指定数量积分
 * 
 * @param userId    用户 ID
 * @param amount    扣减数量（正整数）
 * @param reason    扣减原因（用于日志）
 * @param referenceId 关联 ID（可选）
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  reason: string = '消耗积分',
  referenceId?: string,
): Promise<ConsumeResult> {
  // 获取当前余额
  const current = await getUserCredits(userId);
  if (!current) {
    return {
      success: false,
      use_type: '',
      credits_balance: 0,
      error: 'no_credits_record',
    };
  }

  if (current.credits < amount) {
    return {
      success: false,
      use_type: '',
      credits_balance: current.credits,
      error: 'insufficient_credits',
    };
  }

  const newBalance = current.credits - amount;

  const { error } = await getSupabaseAdmin()
    .from('user_credits')
    .update({ credits: newBalance })
    .eq('user_id', userId);

  if (error) {
    console.error('[Credits] 扣减积分失败:', error);
    return {
      success: false,
      use_type: '',
      credits_balance: current.credits,
      error: 'update_failed',
    };
  }

  // 记录流水（如果表存在）
  try {
    await getSupabaseAdmin().from('credit_transactions').insert({
      user_id: userId,
      transaction_type: 'use',
      amount: -amount,
      balance_after: newBalance,
      reference_type: 'tryon',
      reference_id: referenceId ?? null,
      description: reason,
    });
  } catch (e) {
    console.log('[Credits] 记录交易流水失败:', e);
  }

  console.log(`[Credits] 扣减 ${amount} 积分成功，剩余: ${newBalance}`);

  return {
    success: true,
    use_type: 'credits',
    credits_balance: newBalance,
  };
}

/**
 * 消耗一次试衣机会
 * 简化逻辑：只扣减积分
 */
export async function consumeTryOn(
  userId: string,
  referenceId?: string,
): Promise<ConsumeResult> {
  return consumeCredits(userId, 1, 'AI试衣消耗', referenceId);
}

/**
 * 回滚积分（任务失败时返还）
 * 
 * @param userId  用户 ID
 * @param amount  返还数量（默认 1）
 * @param reason  回滚原因
 */
export async function rollbackCredits(
  userId: string,
  amount: number = 1,
  reason: string = '试衣任务失败，回滚积分',
): Promise<{ success: boolean; newBalance: number }> {
  console.log('[Credits] 回滚积分:', { userId, amount, reason });
  
  try {
    const result = await addCredits({
      userId,
      amount,
      transactionType: 'refund',
      description: reason,
    });
    
    console.log('[Credits] 回滚积分成功:', { userId, newBalance: result.newBalance });
    return { success: true, newBalance: result.newBalance };
  } catch (error: any) {
    console.error('[Credits] 回滚积分失败:', { userId, error: error.message });
    return { success: false, newBalance: 0 };
  }
}
