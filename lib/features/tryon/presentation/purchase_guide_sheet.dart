import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// 积分不足时的引导购买页面
/// 以底部弹窗 (BottomSheet) 形式展示
class PurchaseGuideSheet extends StatelessWidget {
  /// 关闭弹窗
  final VoidCallback onClose;

  /// 购买积分回调（priceId）
  final Future<void> Function(String priceId, String mode)? onPurchase;

  const PurchaseGuideSheet({
    super.key,
    required this.onClose,
    this.onPurchase,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── 顶部拖拽指示条 ──
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colorScheme.onSurfaceVariant.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),

              // ── 标题区域 ──
              _buildHeader(context, colorScheme),
              const SizedBox(height: 28),

              // ── 积分包 ──
              _buildSectionTitle(context, '💎 积分包', '按需购买，永久有效'),
              const SizedBox(height: 12),
              _buildCreditPackages(context, colorScheme),
              const SizedBox(height: 28),

              // ── 订阅方案 ──
              _buildSectionTitle(context, '👑 订阅会员', '无限试衣，超值之选'),
              const SizedBox(height: 12),
              _buildSubscriptionPlans(context, colorScheme),
              const SizedBox(height: 20),

              // ── 关闭按钮 ──
              TextButton(
                onPressed: onClose,
                child: Text(
                  '稍后再说',
                  style: TextStyle(
                    color: colorScheme.onSurfaceVariant,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────
  // 标题区域
  // ──────────────────────────────────────────
  Widget _buildHeader(BuildContext context, ColorScheme colorScheme) {
    return Column(
      children: [
        // 插画图标
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                colorScheme.primary.withOpacity(0.1),
                colorScheme.tertiary.withOpacity(0.1),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.checkroom_rounded,
            size: 40,
            color: colorScheme.primary,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          '试衣次数已用完',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          '购买积分包或订阅会员，继续享受AI虚拟试衣体验',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: colorScheme.onSurfaceVariant,
            fontSize: 14,
            height: 1.5,
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────
  // 分区标题
  // ──────────────────────────────────────────
  Widget _buildSectionTitle(
    BuildContext context,
    String title,
    String subtitle,
  ) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────
  // 积分包卡片
  // ──────────────────────────────────────────
  Widget _buildCreditPackages(BuildContext context, ColorScheme colorScheme) {
    final packages = [
      _CreditPackage(
        name: '基础包',
        credits: 20,
        price: '\$2.99',
        pricePerCredit: '\$0.15/次',
        priceId: 'price_credits_20',
        color: colorScheme.primary,
      ),
      _CreditPackage(
        name: '标准包',
        credits: 50,
        price: '\$6.99',
        pricePerCredit: '\$0.14/次',
        priceId: 'price_credits_50',
        color: colorScheme.secondary,
        badge: '热门',
      ),
      _CreditPackage(
        name: '高级包',
        credits: 100,
        price: '\$9.99',
        pricePerCredit: '\$0.10/次',
        priceId: 'price_credits_100',
        color: colorScheme.tertiary,
        badge: '超值',
      ),
      _CreditPackage(
        name: '专业包',
        credits: 200,
        price: '\$16.99',
        pricePerCredit: '\$0.08/次',
        priceId: 'price_credits_200',
        color: Colors.amber.shade700,
        badge: '最划算',
      ),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: packages.map((pkg) {
          return Container(
            width: 130,
            margin: const EdgeInsets.only(right: 12),
            child: _CreditPackageCard(
              package: pkg,
              onTap: () => _handlePurchase(context, pkg.priceId, 'payment'),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ──────────────────────────────────────────
  // 订阅方案卡片
  // ──────────────────────────────────────────
  Widget _buildSubscriptionPlans(BuildContext context, ColorScheme colorScheme) {
    final plans = [
      _SubscriptionPlan(
        name: '月度会员',
        price: '\$14.99',
        period: '/月',
        priceId: 'price_monthly',
        features: ['无限次试衣', '优先处理', '高清导出'],
        isPopular: false,
      ),
      _SubscriptionPlan(
        name: '季度会员',
        price: '\$39.99',
        period: '/季',
        priceId: 'price_quarterly',
        features: ['无限次试衣', '优先处理', '高清导出', '节省11%'],
        isPopular: true,
      ),
      _SubscriptionPlan(
        name: '年度会员',
        price: '\$99.99',
        period: '/年',
        priceId: 'price_yearly',
        features: ['无限次试衣', '优先处理', '高清导出', '节省44%'],
        isPopular: false,
      ),
    ];

    return Column(
      children: plans.map((plan) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _SubscriptionPlanCard(
            plan: plan,
            onTap: () => _handlePurchase(context, plan.priceId, 'subscription'),
          ),
        );
      }).toList(),
    );
  }

  // ──────────────────────────────────────────
  // 购买处理
  // ──────────────────────────────────────────
  Future<void> _handlePurchase(
    BuildContext context,
    String priceId,
    String mode,
  ) async {
    if (onPurchase != null) {
      await onPurchase!(priceId, mode);
    } else {
      // 默认行为：跳转到网页支付
      final url = Uri.parse('https://your-app.com/pricing');
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      }
    }
  }
}

// ══════════════════════════════════════════════
// 数据模型
// ══════════════════════════════════════════════

class _CreditPackage {
  final String name;
  final int credits;
  final String price;
  final String pricePerCredit;
  final String priceId;
  final Color color;
  final String? badge;

  const _CreditPackage({
    required this.name,
    required this.credits,
    required this.price,
    required this.pricePerCredit,
    required this.priceId,
    required this.color,
    this.badge,
  });
}

class _SubscriptionPlan {
  final String name;
  final String price;
  final String period;
  final String priceId;
  final List<String> features;
  final bool isPopular;

  const _SubscriptionPlan({
    required this.name,
    required this.price,
    required this.period,
    required this.priceId,
    required this.features,
    required this.isPopular,
  });
}

// ══════════════════════════════════════════════
// 积分包卡片组件
// ══════════════════════════════════════════════

class _CreditPackageCard extends StatelessWidget {
  final _CreditPackage package;
  final VoidCallback onTap;

  const _CreditPackageCard({
    required this.package,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              // 角标
              if (package.badge != null)
                Align(
                  alignment: Alignment.topRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: package.color,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      package.badge!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),

              // 积分数量
              Text(
                '${package.credits}',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: package.color,
                    ),
              ),
              Text(
                '次试衣',
                style: TextStyle(
                  color: colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 12),

              // 价格
              Text(
                package.price,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                package.pricePerCredit,
                style: TextStyle(
                  color: colorScheme.onSurfaceVariant,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════
// 订阅方案卡片组件
// ══════════════════════════════════════════════

class _SubscriptionPlanCard extends StatelessWidget {
  final _SubscriptionPlan plan;
  final VoidCallback onTap;

  const _SubscriptionPlanCard({
    required this.plan,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isSelected = plan.isPopular;

    return Material(
      color: isSelected
          ? colorScheme.primaryContainer.withOpacity(0.5)
          : colorScheme.surfaceContainerHighest.withOpacity(0.3),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: isSelected
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: colorScheme.primary,
                    width: 1.5,
                  ),
                )
              : null,
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // 左侧信息
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          plan.name,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        if (isSelected) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: colorScheme.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              '推荐',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    // 特性标签
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: plan.features.map((f) {
                        return Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.check_circle,
                              size: 12,
                              color: colorScheme.primary,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              f,
                              style: TextStyle(
                                color: colorScheme.onSurfaceVariant,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),

              // 右侧价格
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        plan.price,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: colorScheme.primary,
                            ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4, left: 2),
                        child: Text(
                          plan.period,
                          style: TextStyle(
                            color: colorScheme.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
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

// ══════════════════════════════════════════════
// 工具函数：显示购买引导弹窗
// ══════════════════════════════════════════════

/// 显示积分不足引导弹窗
Future<void> showPurchaseGuide({
  required BuildContext context,
  Future<void> Function(String priceId, String mode)? onPurchase,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    backgroundColor: Colors.transparent,
    builder: (context) => PurchaseGuideSheet(
      onClose: () => Navigator.of(context).pop(),
      onPurchase: (priceId, mode) async {
        Navigator.of(context).pop(); // 先关闭弹窗
        await onPurchase?.call(priceId, mode);
      },
    ),
  );
}
