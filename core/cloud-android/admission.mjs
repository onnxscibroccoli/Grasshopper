const MB = 1024 * 1024;

export function bytesToMb(value) {
  return Math.floor(Number(value || 0) / MB);
}

export function evaluateAndroidAdmission(input) {
  const total = bytesToMb(input.memTotalBytes);
  const available = bytesToMb(input.memAvailableBytes);
  const swapTotal = bytesToMb(input.swapTotalBytes);
  const swapFree = bytesToMb(input.swapFreeBytes);
  const qemuRss = bytesToMb(input.existingQemuRssBytes);
  const requested = Number(input.requestedMb);
  const reserve = Number(input.reserveMb ?? 2048);
  const overhead = Number(input.overheadMb ?? 512);
  const minSwapFree = Number(input.minSwapFreeMb ?? 512);
  const neededAvailable = requested + overhead + reserve;
  const projectedQemu = qemuRss + requested + overhead;
  const maxQemuEnvelope = Math.max(0, total - reserve);
  const reasons = [];

  if (!Number.isFinite(requested) || requested <= 0) reasons.push("invalid_requested_memory");
  if (available < neededAvailable) reasons.push("insufficient_mem_available");
  if (projectedQemu > maxQemuEnvelope) reasons.push("qemu_memory_envelope_exceeded");
  if (swapTotal > 0 && swapFree < minSwapFree) reasons.push("insufficient_swap_free");

  return {
    decision: reasons.length ? "REJECT" : "PASS",
    reasons,
    mem_total_mb: total,
    mem_available_mb: available,
    swap_total_mb: swapTotal,
    swap_free_mb: swapFree,
    existing_qemu_rss_mb: qemuRss,
    existing_qemu_count: Number(input.existingQemuCount || 0),
    requested_guest_mb: requested,
    launch_overhead_mb: overhead,
    host_reserve_mb: reserve,
    min_swap_free_mb: minSwapFree,
    required_mem_available_mb: neededAvailable,
    max_qemu_envelope_mb: maxQemuEnvelope,
    projected_qemu_mb: projectedQemu
  };
}
