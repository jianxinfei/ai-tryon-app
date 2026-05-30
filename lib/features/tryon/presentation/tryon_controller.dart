import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/credit_check_service.dart';
import '../data/tryon_service.dart';

/// 试衣流程状态
enum TryOnStep {
  idle,           // 空闲
  checkingCredits, // 正在校验积分
  uploading,       // 正在上传图片
  generating,      // AI正在生成
  consuming,       // 正在扣减积分
  success,         // 成功
  error,           // 失败
  insufficientCredits, // 积分不足
}

/// 试衣流程状态数据
class TryOnState {
  final TryOnStep step;
  final String? errorMessage;
  final String? resultImageUrl;
  final CreditStatus? creditStatus;
  final ConsumeResult? consumeResult;

  const TryOnState({
    this.step = TryOnStep.idle,
    this.errorMessage,
    this.resultImageUrl,
    this.creditStatus,
    this.consumeResult,
  });

  TryOnState copyWith({
    TryOnStep? step,
    String? errorMessage,
    String? resultImageUrl,
    CreditStatus? creditStatus,
    ConsumeResult? consumeResult,
  }) {
    return TryOnState(
      step: step ?? this.step,
      errorMessage: errorMessage,
      resultImageUrl: resultImageUrl ?? this.resultImageUrl,
      creditStatus: creditStatus ?? this.creditStatus,
      consumeResult: consumeResult ?? this.consumeResult,
    );
  }
}

/// 试衣控制器
///
/// 核心流程：
/// 1. 校验积分 → 2. 调用AI → 3. 扣减积分
class TryOnController extends StateNotifier<TryOnState> {
  final CreditCheckService _creditService;
  final TryOnService _tryonService;

  TryOnController(this._creditService, this._tryonService)
      : super(const TryOnState());

  /// 获取当前用户ID
  String? get _currentUserId {
    return Supabase.instance.client.auth.currentUser?.id;
  }

  /// 查询用户积分状态（不消耗）
  Future<void> checkCredits() async {
    final userId = _currentUserId;
    if (userId == null) return;

    state = state.copyWith(step: TryOnStep.checkingCredits);

    final creditStatus = await _creditService.checkCredits(userId);
    state = state.copyWith(
      step: creditStatus.canTry ? TryOnStep.idle : TryOnStep.insufficientCredits,
      creditStatus: creditStatus,
    );
  }

  /// 核心：执行试衣（含积分校验）
  ///
  /// 完整流程：
  /// 1. 校验积分 → 不够则抛出 insufficientCredits
  /// 2. 调用 AI 试衣 API
  /// 3. AI 成功后扣减积分
  /// 4. AI 失败则不扣减
  Future<void> startTryOn({
    required File userImage,
    required File clothingImage,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      state = state.copyWith(
        step: TryOnStep.error,
        errorMessage: '请先登录',
      );
      return;
    }

    // ── 第1步：校验积分 ──
    state = state.copyWith(step: TryOnStep.checkingCredits);
    final creditStatus = await _creditService.checkCredits(userId);
    state = state.copyWith(creditStatus: creditStatus);

    if (!creditStatus.canTry) {
      // 积分不足，UI层负责弹出引导页
      state = state.copyWith(step: TryOnStep.insufficientCredits);
      return;
    }

    // ── 第2步：调用AI试衣 ──
    state = state.copyWith(step: TryOnStep.generating);

    try {
      final result = await _tryonService.generateTryOn(
        TryOnRequest(
          userId: userId,
          userImagePath: userImage.path,
          clothingImagePath: clothingImage.path,
        ),
      );

      // ── 第3步：AI成功，扣减积分 ──
      state = state.copyWith(step: TryOnStep.consuming);
      final consumeResult = await _creditService.consumeTryOn(
        userId,
        referenceId: result.id,
      );

      if (!consumeResult.success) {
        // 扣减失败（极端情况），仍然返回结果但记录警告
        print('Warning: AI试衣成功但积分扣减失败: ${consumeResult.errorMessage}');
      }

      // ── 完成 ──
      state = state.copyWith(
        step: TryOnStep.success,
        resultImageUrl: result.resultImageUrl,
        consumeResult: consumeResult,
        creditStatus: CreditStatus(
          canTry: consumeResult.freeTriesRemaining > 0 || consumeResult.creditsBalance > 0,
          useType: '',
          freeTriesRemaining: consumeResult.freeTriesRemaining,
          creditsBalance: consumeResult.creditsBalance,
        ),
      );
    } catch (e) {
      // AI失败，不扣减积分
      state = state.copyWith(
        step: TryOnStep.error,
        errorMessage: '试衣生成失败，请重试。积分未被扣除。',
      );
    }
  }

  /// 重置状态
  void reset() {
    state = const TryOnState();
  }
}

/// Provider
final tryOnControllerProvider =
    StateNotifierProvider<TryOnController, TryOnState>((ref) {
  return TryOnController(
    ref.watch(creditCheckServiceProvider),
    ref.watch(tryonServiceProvider),
  );
});
