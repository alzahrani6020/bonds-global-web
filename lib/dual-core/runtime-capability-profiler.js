'use strict';

const os = require('os');

function bytesToGb(value) {
  return Math.round((Number(value || 0) / (1024 ** 3)) * 100) / 100;
}

function deriveProfile(snapshot) {
  const totalRamGb = Number(snapshot.total_ram_gb || 0);
  const freeRamGb = Number(snapshot.free_ram_gb || 0);
  const cpuLoad = Number(snapshot.cpu_load || 0);
  const gpuAvailable = Boolean(snapshot.gpu_available);
  const modelHealthy = snapshot.model_healthy !== false;

  let execution_profile = 'MINIMAL';
  if (totalRamGb >= 32 && freeRamGb >= 12 && cpuLoad < 0.8) execution_profile = 'BALANCED';
  if (totalRamGb >= 64 && freeRamGb >= 24 && cpuLoad < 0.7 && gpuAvailable) execution_profile = 'HIGH';
  if (totalRamGb >= 128 && freeRamGb >= 48 && cpuLoad < 0.6 && gpuAvailable) execution_profile = 'MAXIMUM';

  return {
    execution_profile,
    runnable: modelHealthy,
    parallel_candidates: execution_profile === 'MINIMAL' ? 1 : execution_profile === 'BALANCED' ? 2 : execution_profile === 'HIGH' ? 4 : 8,
    parallel_agents: execution_profile === 'MINIMAL' ? 1 : execution_profile === 'BALANCED' ? 2 : execution_profile === 'HIGH' ? 4 : 8,
    loaded_models: execution_profile === 'MINIMAL' ? 1 : execution_profile === 'BALANCED' ? 1 : execution_profile === 'HIGH' ? 2 : 4,
    context_strategy: execution_profile === 'MINIMAL' ? 'selective' : execution_profile === 'BALANCED' ? 'expanded_selective' : 'dynamic_expanded'
  };
}

function snapshotSystem(overrides = {}) {
  const cpus = os.cpus();
  const load = os.loadavg?.()[0] || 0;
  return {
    total_ram_gb: bytesToGb(os.totalmem()),
    free_ram_gb: bytesToGb(os.freemem()),
    cpu_count: cpus.length,
    cpu_load: cpus.length ? Math.min(1, load / cpus.length) : 0,
    gpu_available: false,
    model_healthy: true,
    ...overrides
  };
}

function buildCapabilityProfile(overrides = {}) {
  const snapshot = snapshotSystem(overrides);
  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    snapshot,
    ...deriveProfile(snapshot)
  };
}

module.exports = { bytesToGb, deriveProfile, snapshotSystem, buildCapabilityProfile };
