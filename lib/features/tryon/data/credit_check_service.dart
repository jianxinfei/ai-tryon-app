import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// 用户积分状态
class CreditStatus {
  final bool canTry;
  final String useType; // 'free_try' | 'credits'
  final int freeTriesRemaining;
  final int creditsBalance;
  final String? reason;

  CreditStatus({
    required this.canTry,
    required this.useType,
    required this.freeTriesRemaining,
    required this.creditsBalance,
    this.reason,
  });

  factory CreditStatus.fromJson(Map<String, dynamic> json) {
    return CreditStatus(
      canTry: json['can_try'] ?? false,
      useType: json['use_type'] ?? '',
      freeTriesRemaining: json['free_tries'] ?? 0,
      creditsBalance: json['credits'] ?? 0,
      reason: json['reason'],
    );
  }

  /// 是否有可用次数（免费或积分）
  bool get hasAnyCredits => freeTriesRemaining > 0 || creditsBalance > 0;

  /// 可用总次数
  int get totalAvailable => freeTriesRemaining + creditsBalance;
}

/// 试衣消耗结果
class ConsumeResult {
  final bool success;
  final String useType;
  final int freeTriesRemaining;
  final int creditsBalance;
  final String? errorMessage;

  ConsumeResult({
    required this.success,
    required this.useType,
    required this.freeTriesRemaining,
    required this.creditsBalance,
    this.errorMessage,
  });

  factory ConsumeResult.fromJson(Map<String, dynamic> json) {
    return ConsumeResult(
      success: json['success'] ?? false,
      useType: json['use_type'] ?? '',
      freeTriesRemaining: json['free_tries_remaining'] ?? 0,
      creditsBalance: json['credits_balance'] ?? 0,
    );
  }
}

/// 积分校验服务
class CreditCheckService {
  final SupabaseClient _supabase;

  CreditCheckService(this._supabase);

  /// 查询用户可用次数
  ///
  /// 调用 Supabase RPC 函数 check_user_can_try_on
  /// 返回 CreditStatus 对象
  Future<CreditStatus> checkCredits(String userId) async {
    try {
      final response = await _supabase.rpc(
        'check_user_can_try_on',
        params: {'p_user_id': userId},
      );

      return CreditStatus.fromJson(response);
    } catch (e) {
      // RPC 函数不可用时的备用方案：直接查询表
      return _checkCreditsFallback(userId);
    }
  }

  /// 备用方案：直接查询 user_credits 表
  Future<CreditStatus> _checkCreditsFallback(String userId) async {
    try {
      final response = await _supabase
          .from('user_credits')
          .select('free_tries_remaining, credits_balance')
          .eq('user_id', userId)
          .maybeSingle();

      if (response == null) {
        return CreditStatus(
          canTry: false,
          useType: '',
          freeTriesRemaining: 0,
          creditsBalance: 0,
          reason: 'no_credits_record',
        );
      }

      final freeTries = response['free_tries_remaining'] as int? ?? 0;
      final credits = response['credits_balance'] as int? ?? 0;

      if (freeTries > 0) {
        return CreditStatus(
          canTry: true,
          useType: 'free_try',
          freeTriesRemaining: freeTries,
          creditsBalance: credits,
        );
      } else if (credits > 0) {
        return CreditStatus(
          canTry: true,
          useType: 'credits',
          freeTriesRemaining: freeTries,
          creditsBalance: credits,
        );
      } else {
        return CreditStatus(
          canTry: false,
          useType: '',
          freeTriesRemaining: 0,
          creditsBalance: 0,
          reason: 'insufficient_credits',
        );
      }
    } catch (e) {
      return CreditStatus(
        canTry: false,
        useType: '',
        freeTriesRemaining: 0,
        creditsBalance: 0,
        reason: 'query_error',
      );
    }
  }

  /// 消耗一次试衣机会
  ///
  /// 调用 Supabase RPC 函数 consume_try_on
  /// 优先消耗免费次数，再消耗积分
  Future<ConsumeResult> consumeTryOn(String userId, {String? referenceId}) async {
    try {
      final response = await _supabase.rpc(
        'consume_try_on',
        params: {
          'p_user_id': userId,
          'p_reference_id': referenceId,
        },
      );

      return ConsumeResult.fromJson(response);
    } catch (e) {
      // RPC 不可用时的备用方案
      return _consumeTryOnFallback(userId);
    }
  }

  /// 备用方案：直接更新表
  Future<ConsumeResult> _consumeTryOnFallback(String userId) async {
    try {
      // 查询当前状态
      final current = await _supabase
          .from('user_credits')
          .select('free_tries_remaining, credits_balance')
          .eq('user_id', userId)
          .single();

      final freeTries = current['free_tries_remaining'] as int? ?? 0;
      final credits = current['credits_balance'] as int? ?? 0;

      if (freeTries > 0) {
        // 消耗免费次数
        await _supabase
            .from('user_credits')
            .update({
              'free_tries_remaining': freeTries - 1,
              'total_credits_used': current['total_credits_used'] + 1,
            })
            .eq('user_id', userId);

        return ConsumeResult(
          success: true,
          useType: 'free_try',
          freeTriesRemaining: freeTries - 1,
          creditsBalance: credits,
        );
      } else if (credits > 0) {
        // 消耗积分
        final newBalance = credits - 1;
        await _supabase
            .from('user_credits')
            .update({
              'credits_balance': newBalance,
              'total_credits_used': current['total_credits_used'] + 1,
            })
            .eq('user_id', userId);

        // 记录交易流水
        await _supabase.from('credit_transactions').insert({
          'user_id': userId,
          'transaction_type': 'use',
          'amount': -1,
          'balance_after': newBalance,
          'reference_type': 'tryon',
          'description': 'AI试衣消耗',
        });

        return ConsumeResult(
          success: true,
          useType: 'credits',
          freeTriesRemaining: 0,
          creditsBalance: newBalance,
        );
      } else {
        return ConsumeResult(
          success: false,
          useType: '',
          freeTriesRemaining: 0,
          creditsBalance: 0,
          errorMessage: '积分不足',
        );
      }
    } catch (e) {
      return ConsumeResult(
        success: false,
        useType: '',
        freeTriesRemaining: 0,
        creditsBalance: 0,
        errorMessage: e.toString(),
      );
    }
  }
}

/// Provider
final creditCheckServiceProvider = Provider<CreditCheckService>((ref) {
  return CreditCheckService(Supabase.instance.client);
});
