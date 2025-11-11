import { getPool } from '../config/database.js';

/**
 * Scheduler Service
 * Handles processing of scheduled notifications when their scheduled time arrives
 */
export class SchedulerService {
  /**
   * Process all scheduled notifications that are due to be sent
   * This method is called by the cron job every minute
   */
  static async processScheduledNotifications() {
    const pool = getPool();
    const startTime = Date.now();
    
    console.log('🕐 [SCHEDULER] Starting scheduled notifications check...');

    try {
      // Query for notifications that are:
      // 1. scheduled_at is in the past (due to be sent)
      // 2. status is still 'pending' (not yet sent)
      // 3. sent_at is NULL (not yet marked as sent)
      // 4. retry_count < max_retries (haven't exceeded retry limit)
      // FOR UPDATE SKIP LOCKED prevents race conditions if cron runs overlap
      const query = `
        SELECT 
          id,
          user_id,
          type,
          recipient,
          subject,
          message,
          metadata,
          scheduled_at,
          retry_count,
          max_retries,
          created_at
        FROM notifications
        WHERE scheduled_at <= NOW()
          AND status = 'pending'
          AND sent_at IS NULL
          AND retry_count < max_retries
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
      `;

      const result = await pool.query(query);
      const dueNotifications = result.rows;

      if (dueNotifications.length === 0) {
        console.log('✓ [SCHEDULER] No scheduled notifications due at this time');
        return {
          processed: 0,
          sent: 0,
          failed: 0,
          duration: Date.now() - startTime
        };
      }

      console.log(`📬 [SCHEDULER] Found ${dueNotifications.length} scheduled notification(s) to process`);

      let sentCount = 0;
      let failedCount = 0;

      // Process each notification
      for (const notification of dueNotifications) {
        try {
          console.log(`  Processing notification ${notification.id}:`, {
            user_id: notification.user_id,
            type: notification.type,
            subject: notification.subject,
            scheduled_at: notification.scheduled_at,
            retry_count: notification.retry_count
          });

          // Update notification status to 'sent' and set sent_at timestamp
          // This "activates" the scheduled notification and makes it visible to users
          const updateQuery = `
            UPDATE notifications
            SET 
              status = 'sent',
              sent_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
            RETURNING id, user_id, type, subject, sent_at
          `;

          const updateResult = await pool.query(updateQuery, [notification.id]);

          if (updateResult.rows.length > 0) {
            sentCount++;
            const sentNotification = updateResult.rows[0];
            console.log(`  ✓ Notification ${notification.id} sent successfully to user ${sentNotification.user_id}`);
            
            // Optional: Log to analytics or trigger additional actions (push, email, etc.)
            // For now, scheduled notifications are in-app only
          } else {
            throw new Error(`Failed to update notification ${notification.id} - no rows returned`);
          }

        } catch (notificationError) {
          failedCount++;
          console.error(`  ✗ Failed to process notification ${notification.id}:`, notificationError.message);

          // Increment retry count and mark as failed if max retries exceeded
          try {
            const newRetryCount = notification.retry_count + 1;
            const shouldMarkAsFailed = newRetryCount >= notification.max_retries;

            const failQuery = `
              UPDATE notifications
              SET 
                retry_count = $1,
                status = $2,
                error_message = $3,
                updated_at = NOW()
              WHERE id = $4
            `;

            await pool.query(failQuery, [
              newRetryCount,
              shouldMarkAsFailed ? 'failed' : 'pending',
              notificationError.message,
              notification.id
            ]);

            if (shouldMarkAsFailed) {
              console.log(`  ⚠️ Notification ${notification.id} marked as failed after ${newRetryCount} retries`);
            } else {
              console.log(`  ⟲ Notification ${notification.id} will retry (attempt ${newRetryCount}/${notification.max_retries})`);
            }

          } catch (updateError) {
            console.error(`  ✗ Failed to update retry count for notification ${notification.id}:`, updateError.message);
          }
        }
      }

      const duration = Date.now() - startTime;
      const stats = {
        processed: dueNotifications.length,
        sent: sentCount,
        failed: failedCount,
        duration
      };

      console.log(`✓ [SCHEDULER] Completed in ${duration}ms:`, {
        processed: stats.processed,
        sent: stats.sent,
        failed: stats.failed
      });

      return stats;

    } catch (error) {
      console.error('✗ [SCHEDULER] Error processing scheduled notifications:', error);
      throw error;
    }
  }

  /**
   * Get statistics about scheduled notifications
   * Useful for monitoring and debugging
   */
  static async getScheduledStats() {
    const pool = getPool();

    try {
      const query = `
        SELECT 
          COUNT(*) as total_scheduled,
          COUNT(CASE WHEN scheduled_at <= NOW() THEN 1 END) as overdue,
          COUNT(CASE WHEN scheduled_at > NOW() THEN 1 END) as future,
          MIN(scheduled_at) as next_scheduled,
          MAX(retry_count) as max_retry_count
        FROM notifications
        WHERE status = 'pending'
          AND sent_at IS NULL
          AND scheduled_at IS NOT NULL
      `;

      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting scheduled stats:', error);
      return null;
    }
  }
}

