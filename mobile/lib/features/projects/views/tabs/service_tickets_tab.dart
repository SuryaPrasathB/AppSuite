import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/project_models.dart';
import '../../providers/projects_provider.dart';

class ServiceTicketsTab extends ConsumerStatefulWidget {
  const ServiceTicketsTab({super.key});

  @override
  ConsumerState<ServiceTicketsTab> createState() => _ServiceTicketsTabState();
}

class _ServiceTicketsTabState extends ConsumerState<ServiceTicketsTab> {
  String _selectedStatus = 'All';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(projectsProvider);
    final tickets = state.tickets;

    final filtered = tickets.where((t) {
      if (_selectedStatus != 'All') {
        return t.status.toUpperCase() == _selectedStatus.toUpperCase();
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateTicketDialog(context),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Ticket', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(projectsProvider.notifier).fetchServiceTickets(),
        color: AppColors.primary,
        backgroundColor: AppColors.card,
        child: Column(
          children: [
            // Filter Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: AppColors.card,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All (${tickets.length})', 'All'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Open', 'OPEN'),
                    const SizedBox(width: 8),
                    _buildFilterChip('In Progress', 'IN_PROGRESS'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Closed', 'CLOSED'),
                  ],
                ),
              ),
            ),

            // Tickets List
            Expanded(
              child: filtered.isEmpty
                  ? const Center(
                      child: Text('No service tickets found', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final ticket = filtered[index];
                        return _buildTicketCard(ticket);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String key) {
    final isSelected = _selectedStatus == key;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : AppColors.textSecondary)),
      selected: isSelected,
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.background,
      onSelected: (_) => setState(() => _selectedStatus = key),
    );
  }

  Widget _buildTicketCard(ServiceTicketModel ticket) {
    Color statusColor = AppColors.warning;
    if (ticket.status == 'CLOSED') statusColor = AppColors.success;
    if (ticket.status == 'OPEN') statusColor = AppColors.danger;

    final isClosed = ticket.status == 'CLOSED';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Ticket #${ticket.id}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryLight),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  ticket.status,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            ticket.title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
          ),
          if (ticket.description != null && ticket.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              ticket.description!,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (ticket.projectName != null || ticket.customProjectName != null) ...[
                const Icon(Icons.folder_outlined, size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text(
                  ticket.projectName ?? ticket.customProjectName ?? '',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
                const SizedBox(width: 12),
              ],
              if (ticket.assigneeName != null) ...[
                const Icon(Icons.person_outline, size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text(
                  ticket.assigneeName!,
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ],
          ),

          if (!isClosed) ...[
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.cardBorder),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ElevatedButton.icon(
                  onPressed: () => _showResolveDialog(context, ticket),
                  icon: const Icon(Icons.camera_alt_outlined, size: 16),
                  label: const Text('Resolve & Attach Photo', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _showCreateTicketDialog(BuildContext context) {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final customPrjController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Create Service Ticket', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(hintText: 'Ticket Title / Issue Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descController,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Detailed description of the fault...'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: customPrjController,
                decoration: const InputDecoration(hintText: 'Project / Bay / System Name'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (titleController.text.trim().isEmpty) return;
              await ref.read(projectsProvider.notifier).createServiceTicket(
                    title: titleController.text.trim(),
                    description: descController.text.trim(),
                    customProjectName: customPrjController.text.trim(),
                  );
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  void _showResolveDialog(BuildContext context, ServiceTicketModel ticket) {
    final notesController = TextEditingController();
    XFile? capturedImage;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Resolve Ticket #${ticket.id}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(ticket.title, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              TextField(
                controller: notesController,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Resolution summary & notes...'),
              ),
              const SizedBox(height: 14),

              // Camera Photo Capture Button
              if (capturedImage != null)
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.cardBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: AppColors.success, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          capturedImage!.name,
                          style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16, color: AppColors.textMuted),
                        onPressed: () => setSheetState(() => capturedImage = null),
                      ),
                    ],
                  ),
                )
              else
                OutlinedButton.icon(
                  onPressed: () async {
                    final picker = ImagePicker();
                    final photo = await picker.pickImage(source: ImageSource.camera);
                    if (photo != null) {
                      setSheetState(() => capturedImage = photo);
                    }
                  },
                  icon: const Icon(Icons.camera_alt, color: AppColors.primaryLight),
                  label: const Text('Capture Photo from Camera', style: TextStyle(color: AppColors.primaryLight)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.primaryLight),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),

              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  if (notesController.text.trim().isEmpty) return;
                  await ref.read(projectsProvider.notifier).resolveServiceTicket(
                        ticketId: ticket.id,
                        notes: notesController.text.trim(),
                        images: capturedImage != null ? [capturedImage!] : null,
                      );
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                child: const Text('Confirm Resolution & Close', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
