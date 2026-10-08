import 'package:flutter/material.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/theme/app_theme.dart';

class ServerConfigDialog extends StatefulWidget {
  const ServerConfigDialog({super.key});

  @override
  State<ServerConfigDialog> createState() => _ServerConfigDialogState();
}

class _ServerConfigDialogState extends State<ServerConfigDialog> {
  late TextEditingController _urlController;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
    _loadCurrentUrl();
  }

  Future<void> _loadCurrentUrl() async {
    final url = await SecureStorageService.getBaseUrl();
    setState(() {
      _urlController.text = url;
      _isLoading = false;
    });
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.cardBorder),
      ),
      title: const Row(
        children: [
          Icon(Icons.dns_outlined, color: AppColors.primaryLight, size: 22),
          SizedBox(width: 8),
          Text(
            'Server Endpoint',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: _isLoading
          ? const SizedBox(
              height: 100,
              child: Center(child: CircularProgressIndicator()),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Set the backend host URL for AppSuite:',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _urlController,
                  decoration: const InputDecoration(
                    hintText: 'http://192.168.1.5:8000',
                    prefixIcon: Icon(Icons.link, color: AppColors.textMuted),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    ActionChip(
                      label: const Text('Wi-Fi (192.168.0.101)', style: TextStyle(fontSize: 11)),
                      backgroundColor: AppColors.background,
                      onPressed: () {
                        _urlController.text = 'http://192.168.0.101:8000';
                      },
                    ),
                    ActionChip(
                      label: const Text('USB Cable (localhost:8000)', style: TextStyle(fontSize: 11)),
                      backgroundColor: AppColors.background,
                      onPressed: () {
                        _urlController.text = 'http://localhost:8000';
                      },
                    ),
                    ActionChip(
                      label: const Text('Docker Server (192.168.1.100)', style: TextStyle(fontSize: 11)),
                      backgroundColor: AppColors.background,
                      onPressed: () {
                        _urlController.text = 'http://192.168.1.100:8000';
                      },
                    ),
                    ActionChip(
                      label: const Text('Emulator (10.0.2.2)', style: TextStyle(fontSize: 11)),
                      backgroundColor: AppColors.background,
                      onPressed: () {
                        _urlController.text = 'http://10.0.2.2:8000';
                      },
                    ),
                  ],
                ),
              ],
            ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
        ),
        ElevatedButton(
          onPressed: () async {
            final newUrl = _urlController.text.trim();
            if (newUrl.isNotEmpty) {
              await SecureStorageService.saveBaseUrl(newUrl);
            }
            if (context.mounted) {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Server URL updated')),
              );
            }
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
