import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('AppSuite mobile smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AppSuiteMobileApp()));
    expect(find.byType(AppSuiteMobileApp), findsOneWidget);
  });
}
