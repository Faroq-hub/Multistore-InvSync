import { ConnectionRepo, JobRepo } from '../db';
import { ulid } from 'ulid';

// Schedule times in 24-hour format (UTC)
const SYNC_HOURS = [1, 9, 17]; // 1am, 9am, 5pm UTC

type LogFn = (msg: string) => void;

/**
 * Creates a sync job for a connection
 */
async function createSyncJob(connectionId: string, log: LogFn): Promise<string> {
  const jobId = ulid();
  await JobRepo.enqueue({
    id: jobId,
    connection_id: connectionId,
    job_type: 'full_sync'
  });
  return jobId;
}

/**
 * Triggers sync for all active connections
 */
async function syncAllConnections(log: LogFn): Promise<void> {
  try {
    const connections = await ConnectionRepo.listAllActive();
    
    if (connections.length === 0) {
      log('[Scheduled Sync] No active connections found');
      return;
    }
    
    log(`[Scheduled Sync] Found ${connections.length} active connection(s) to sync`);
    
    for (const conn of connections) {
      try {
        const jobId = await createSyncJob(conn.id, log);
        log(`[Scheduled Sync] Created job ${jobId} for connection "${conn.name}" (${conn.type})`);
      } catch (err: any) {
        log(`[Scheduled Sync] Failed to create job for connection ${conn.id}: ${err?.message || err}`);
      }
    }
    
    log(`[Scheduled Sync] Queued ${connections.length} sync job(s)`);
  } catch (err: any) {
    log(`[Scheduled Sync] Error during scheduled sync: ${err?.message || err}`);
  }
}

/**
 * Checks if current hour matches any scheduled sync time
 */
function shouldRunSync(currentHour: number): boolean {
  return SYNC_HOURS.includes(currentHour);
}

/**
 * Gets milliseconds until the next scheduled sync time
 */
function getMillisUntilNextSync(): number {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinutes = now.getUTCMinutes();
  const currentSeconds = now.getUTCSeconds();
  
  // Find next sync hour
  let nextHour = SYNC_HOURS.find(h => h > currentHour);
  let daysToAdd = 0;
  
  if (nextHour === undefined) {
    // Next sync is tomorrow at the first scheduled hour
    nextHour = SYNC_HOURS[0];
    daysToAdd = 1;
  }
  
  // Calculate milliseconds until next sync
  const hoursUntil = (nextHour - currentHour + 24 * daysToAdd) % 24 || (daysToAdd ? 24 : 0);
  const minutesUntil = 60 - currentMinutes;
  const secondsUntil = 60 - currentSeconds;
  
  // If we're exactly on a sync hour, return time until next one
  if (hoursUntil === 0 && currentMinutes === 0) {
    return getMillisUntilNextSync(); // Recalculate for next slot
  }
  
  const totalMs = ((hoursUntil - 1) * 60 * 60 * 1000) + 
                  (minutesUntil * 60 * 1000) + 
                  (secondsUntil * 1000);
  
  return Math.max(totalMs, 60000); // At least 1 minute
}

/**
 * Formats next sync time for logging
 */
function formatNextSyncTime(): string {
  const now = new Date();
  const msUntilNext = getMillisUntilNextSync();
  const nextSync = new Date(now.getTime() + msUntilNext);
  return nextSync.toISOString();
}

let lastSyncHour = -1; // Track last synced hour to prevent double runs

/**
 * Starts the scheduled sync checker
 * Checks every minute if it's time to sync
 */
export function startScheduledSync(log: LogFn): void {
  log(`[Scheduled Sync] Starting scheduler for sync times: ${SYNC_HOURS.map(h => `${h}:00 UTC`).join(', ')}`);
  log(`[Scheduled Sync] Next sync scheduled at: ${formatNextSyncTime()}`);
  
  // Check every minute if it's time to sync
  const CHECK_INTERVAL = 60 * 1000; // 1 minute
  
  async function checkAndSync() {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    
    // Only sync at the start of the hour (first 5 minutes) and if we haven't already synced this hour
    if (shouldRunSync(currentHour) && currentMinute < 5 && lastSyncHour !== currentHour) {
      lastSyncHour = currentHour;
      log(`[Scheduled Sync] ⏰ Triggered scheduled sync at ${now.toISOString()}`);
      await syncAllConnections(log);
      log(`[Scheduled Sync] Next sync scheduled at: ${formatNextSyncTime()}`);
    }
  }
  
  // Run immediately on startup to catch any missed syncs
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  
  if (shouldRunSync(currentHour) && currentMinute < 5) {
    log(`[Scheduled Sync] Running startup sync (within scheduled window)`);
    lastSyncHour = currentHour;
    syncAllConnections(log);
  }
  
  // Start the interval checker
  setInterval(checkAndSync, CHECK_INTERVAL);
  
  log(`[Scheduled Sync] Scheduler started - checking every minute`);
}

/**
 * Manually trigger a sync for all connections (for testing or manual override)
 */
export async function triggerManualSync(log: LogFn): Promise<void> {
  log(`[Manual Sync] Triggering manual sync for all connections`);
  await syncAllConnections(log);
}

