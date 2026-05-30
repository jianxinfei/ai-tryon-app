import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../shared/widgets/image_picker_widget.dart';
import '../data/credit_check_service.dart';
import '../presentation/purchase_guide_sheet.dart';
import '../presentation/tryon_controller.dart';

/// 试衣页面
///
/// 核心交互：
/// 1. 用户上传全身照和服装照片
/// 2. 点击"开始试衣"按钮
/// 3. 自动校验积分 → 够则试衣 → 不够则弹出购买引导
class TryOnScreen extends ConsumerStatefulWidget {
  const TryOnScreen({super.key});

  @override
  ConsumerState<TryOnScreen> createState() => _TryOnScreenState();
}

class _TryOnScreenState extends ConsumerState<TryOnScreen> {
  File? _userImage;
  File? _clothingImage;

  // ── 监听试衣状态变化 ──
  void _listenTryOnState(TryOnState state) {
    switch (state.step) {
      case TryOnStep.insufficientCredits:
        // 积分不足 → 弹出购买引导
        _showPurchaseGuide();
        break;

      case TryOnStep.success:
        // 试衣成功 → 跳转结果页
        _showSuccessResult(state);
        break;

      case TryOnStep.error:
        // 出错 → 显示错误提示
        if (state.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage!),
              backgroundColor: AppColors.error,
            ),
          );
        }
        break;

      default:
        break;
    }
  }

  // ── 弹出购买引导 ──
  void _showPurchaseGuide() {
    showPurchaseGuide(
      context: context,
      onPurchase: (priceId, mode) {
        // 跳转到支付页面
        context.push('/payment?priceId=$priceId&mode=$mode');
      },
    );
  }

  // ── 显示成功结果 ──
  void _showSuccessResult(TryOnState state) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ResultBottomSheet(
        resultImageUrl: state.resultImageUrl,
        consumeResult: state.consumeResult,
        onClose: () {
          Navigator.of(context).pop();
          ref.read(tryOnControllerProvider.notifier).reset();
        },
      ),
    );
  }

  // ── 点击"开始试衣" ──
  Future<void> _onStartTryOn() async {
    // 前置校验：必须上传两张照片
    if (_userImage == null || _clothingImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先上传全身照和服装照片')),
      );
      return;
    }

    // 触发试衣流程（控制器会自动校验积分）
    await ref.read(tryOnControllerProvider.notifier).startTryOn(
          userImage: _userImage!,
          clothingImage: _clothingImage!,
        );
  }

  @override
  Widget build(BuildContext context) {
    final tryOnState = ref.watch(tryOnControllerProvider);
    final creditStatus = tryOnState.creditStatus;
    final isProcessing = tryOnState.step == TryOnStep.checkingCredits ||
        tryOnState.step == TryOnStep.generating ||
        tryOnState.step == TryOnStep.consuming;

    // 监听状态变化
    ref.listen(tryOnControllerProvider, (prev, next) {
      _listenTryOnState(next);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI 虚拟试衣'),
        actions: [
          // 积分余额显示
          if (creditStatus != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: _CreditBadge(creditStatus: creditStatus),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 步骤提示 ──
            _buildStepIndicator(tryOnState.step),
            const SizedBox(height: 24),

            // ── 上传区域 ──
            Row(
              children: [
                // 全身照
                Expanded(
                  child: Column(
                    children: [
                      const Text(
                        '你的全身照',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ImagePickerWidget(
                        image: _userImage,
                        placeholderText: '上传全身照',
                        height: 220,
                        onTap: () async {
                          final file = await ImageUtils.pickAndCropImage(
                            source: ImageSource.gallery,
                            aspectRatio: CropAspectRatioPreset.ratio3x4,
                          );
                          if (file != null) {
                            setState(() => _userImage = file);
                          }
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),

                // 箭头图标
                Padding(
                  padding: const EdgeInsets.only(bottom: 40),
                  child: Icon(
                    Icons.arrow_forward,
                    size: 28,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 16),

                // 服装照片
                Expanded(
                  child: Column(
                    children: [
                      const Text(
                        '服装照片',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ImagePickerWidget(
                        image: _clothingImage,
                        placeholderText: '上传服装',
                        height: 220,
                        onTap: () async {
                          final file = await ImageUtils.pickAndCropImage(
                            source: ImageSource.gallery,
                            aspectRatio: CropAspectRatioPreset.ratio3x4,
                          );
                          if (file != null) {
                            setState(() => _clothingImage = file);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // ── 开始试衣按钮 ──
            _buildStartButton(isProcessing, tryOnState.step),
            const SizedBox(height: 16),

            // ── 状态提示 ──
            if (isProcessing) _buildProcessingHint(tryOnState.step),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────
  // 步骤指示器
  // ──────────────────────────────────────────
  Widget _buildStepIndicator(TryOnStep step) {
    int currentStep = 0;
    if (step == TryOnStep.checkingCredits) currentStep = 1;
    if (step == TryOnStep.generating) currentStep = 2;
    if (step == TryOnStep.consuming) currentStep = 3;
    if (step == TryOnStep.success) currentStep = 4;

    return Row(
      children: [
        _StepDot(label: '校验', index: 0, current: currentStep),
        _StepDot(label: '生成', index: 1, current: currentStep),
        _StepDot(label: '完成', index: 2, current: currentStep),
      ],
    );
  }

  // ──────────────────────────────────────────
  // 开始试衣按钮
  // ──────────────────────────────────────────
  Widget _buildStartButton(bool isProcessing, TryOnStep step) {
    final colorScheme = Theme.of(context).colorScheme;

    return FilledButton.icon(
      onPressed: isProcessing ? null : _onStartTryOn,
      icon: isProcessing
          ? SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colorScheme.onPrimary,
              ),
            )
          : const Icon(Icons.auto_awesome),
      label: Text(
        isProcessing
            ? _getProcessingText(step)
            : '开始试衣',
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    );
  }

  String _getProcessingText(TryOnStep step) {
    switch (step) {
      case TryOnStep.checkingCredits:
        return '正在校验积分...';
      case TryOnStep.generating:
        return 'AI 正在生成试衣效果...';
      case TryOnStep.consuming:
        return '正在更新积分...';
      default:
        return '处理中...';
    }
  }

  // ──────────────────────────────────────────
  // 处理中提示
  // ──────────────────────────────────────────
  Widget _buildProcessingHint(TryOnStep step) {
    return Column(
      children: [
        const SizedBox(height: 8),
        LinearProgressIndicator(
          borderRadius: BorderRadius.circular(4),
        ),
        const SizedBox(height: 8),
        Text(
          step == TryOnStep.generating
              ? '通常需要 10-30 秒，请耐心等待'
              : '请稍候...',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════
// 积分余额角标
// ══════════════════════════════════════════════

class _CreditBadge extends StatelessWidget {
  final CreditStatus creditStatus;

  const _CreditBadge({required this.creditStatus});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: () {
        // 点击可以查看积分详情
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: colorScheme.primaryContainer,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.stars_rounded,
              size: 16,
              color: colorScheme.primary,
            ),
            const SizedBox(width: 4),
            Text(
              '${creditStatus.freeTriesRemaining + creditStatus.creditsBalance}',
              style: TextStyle(
                color: colorScheme.primary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════
// 步骤圆点
// ══════════════════════════════════════════════

class _StepDot extends StatelessWidget {
  final String label;
  final int index;
  final int current;

  const _StepDot({
    required this.label,
    required this.index,
    required this.current,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = index <= current;
    final colorScheme = Theme.of(context).colorScheme;

    return Expanded(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: isActive
                        ? colorScheme.primary
                        : colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              color: isActive
                  ? colorScheme.primary
                  : colorScheme.onSurfaceVariant,
              fontSize: 12,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════
// 试衣结果弹窗
// ══════════════════════════════════════════════

class _ResultBottomSheet extends StatelessWidget {
  final String? resultImageUrl;
  final ConsumeResult? consumeResult;
  final VoidCallback onClose;

  const _ResultBottomSheet({
    this.resultImageUrl,
    this.consumeResult,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 拖拽指示条
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colorScheme.onSurfaceVariant.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // 成功图标
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_rounded,
                  size: 32,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(height: 12),

              const Text(
                '试衣完成！',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),

              // 扣减信息
              if (consumeResult != null)
                Text(
                  consumeResult!.useType == 'free_try'
                      ? '已使用 1 次免费试衣（剩余 ${consumeResult!.freeTriesRemaining} 次）'
                      : '已消耗 1 积分（剩余 ${consumeResult!.creditsBalance} 积分）',
                  style: TextStyle(
                    color: colorScheme.onSurfaceVariant,
                    fontSize: 13,
                  ),
                ),
              const SizedBox(height: 20),

              // 操作按钮
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onClose,
                      child: const Text('关闭'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        // TODO: 保存到历史 / 分享
                      },
                      child: const Text('保存'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
