import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';
import { ApiError } from '../middleware/error.js';

export class AdminAnalyticsController {
  /**
   * Get platform-wide transaction analytics
   */
  static async getPlatformTransactionAnalytics(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      
      if (startDate && endDate) {
        dateFilter = 'AND ct.created_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      } else if (startDate) {
        dateFilter = 'AND ct.created_at >= $1';
        params = [startDate];
      } else if (endDate) {
        dateFilter = 'AND ct.created_at <= $1';
        params = [endDate];
      }
      
      const groupByClause = groupBy === 'hour' ? 'DATE_TRUNC(\'hour\', ct.created_at)' :
                           groupBy === 'day' ? 'DATE_TRUNC(\'day\', ct.created_at)' :
                           groupBy === 'week' ? 'DATE_TRUNC(\'week\', ct.created_at)' :
                           'DATE_TRUNC(\'month\', ct.created_at)';
      
      const analytics = await pool.query(
        `SELECT 
          ${groupByClause} as period,
          COUNT(ct.id) as total_transactions,
          SUM(ct.cashback_amount) as total_cashback_paid,
          AVG(ct.cashback_amount) as avg_cashback_amount,
          AVG(ct.cashback_percentage) as avg_cashback_percentage,
          COUNT(CASE WHEN ct.status = 'processed' THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN ct.status = 'failed' THEN 1 END) as failed_transactions,
          COUNT(CASE WHEN ct.status = 'disputed' THEN 1 END) as disputed_transactions,
          COUNT(DISTINCT ct.merchant_id) as active_merchants,
          COUNT(DISTINCT ct.customer_id) as active_customers
        FROM cashback_transactions ct
        WHERE 1=1 ${dateFilter}
        GROUP BY ${groupByClause}
        ORDER BY period DESC`,
        params
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          analytics: analytics.rows,
          groupBy,
          period: { startDate, endDate }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get merchant performance analytics
   */
  static async getMerchantPerformanceAnalytics(req, res, next) {
    try {
      const { startDate, endDate, limit = 50, offset = 0 } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      let paramCount = 0;
      
      if (startDate && endDate) {
        paramCount += 2;
        dateFilter = 'AND ct.created_at BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        paramCount++;
        dateFilter = 'AND ct.created_at >= $1';
        params.push(startDate);
      } else if (endDate) {
        paramCount++;
        dateFilter = 'AND ct.created_at <= $1';
        params.push(endDate);
      }
      
      const merchantAnalytics = await pool.query(
        `SELECT 
          ct.merchant_id,
          mb.business_name,
          COUNT(ct.id) as total_transactions,
          SUM(ct.cashback_amount) as total_cashback_paid,
          AVG(ct.cashback_percentage) as avg_cashback_percentage,
          COUNT(CASE WHEN ct.status = 'processed' THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN ct.status = 'failed' THEN 1 END) as failed_transactions,
          COUNT(CASE WHEN ct.status = 'disputed' THEN 1 END) as disputed_transactions,
          ROUND(
            (COUNT(CASE WHEN ct.status = 'processed' THEN 1 END)::DECIMAL / NULLIF(COUNT(ct.id), 0)) * 100, 2
          ) as success_rate,
          COUNT(DISTINCT ct.customer_id) as unique_customers
        FROM cashback_transactions ct
        WHERE 1=1 ${dateFilter}
        GROUP BY ct.merchant_id
        ORDER BY total_cashback_paid DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          merchantAnalytics: merchantAnalytics.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: merchantAnalytics.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction error analytics
   */
  static async getTransactionErrorAnalytics(req, res, next) {
    try {
      const { startDate, endDate, errorType } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      let paramCount = 0;
      
      if (startDate && endDate) {
        paramCount += 2;
        dateFilter = 'AND ct.created_at BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        paramCount++;
        dateFilter = 'AND ct.created_at >= $1';
        params.push(startDate);
      } else if (endDate) {
        paramCount++;
        dateFilter = 'AND ct.created_at <= $1';
        params.push(endDate);
      }
      
      let errorFilter = '';
      if (errorType) {
        paramCount++;
        errorFilter = `AND ct.error_type = $${paramCount}`;
        params.push(errorType);
      }
      
      const errorAnalytics = await pool.query(
        `SELECT 
          ct.error_type,
          ct.error_message,
          COUNT(*) as error_count,
          COUNT(DISTINCT ct.merchant_id) as affected_merchants,
          COUNT(DISTINCT ct.customer_id) as affected_customers,
          AVG(ct.cashback_amount) as avg_transaction_amount,
          MIN(ct.created_at) as first_occurrence,
          MAX(ct.created_at) as last_occurrence
        FROM cashback_transactions ct
        WHERE ct.status = 'failed' ${dateFilter} ${errorFilter}
        GROUP BY ct.error_type, ct.error_message
        ORDER BY error_count DESC`,
        params
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: errorAnalytics.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment settlement analytics
   */
  static async getPaymentSettlementAnalytics(req, res, next) {
    try {
      const { startDate, endDate, merchantId } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      let paramCount = 0;
      
      if (startDate && endDate) {
        paramCount += 2;
        dateFilter = 'AND bt.created_at BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        paramCount++;
        dateFilter = 'AND bt.created_at >= $1';
        params.push(startDate);
      } else if (endDate) {
        paramCount++;
        dateFilter = 'AND bt.created_at <= $1';
        params.push(endDate);
      }
      
      let merchantFilter = '';
      if (merchantId) {
        paramCount++;
        merchantFilter = `AND bt.merchant_id = $${paramCount}`;
        params.push(merchantId);
      }
      
      const settlementAnalytics = await pool.query(
        `SELECT 
          bt.merchant_id,
          mb.business_name,
          bt.transaction_type,
          COUNT(*) as transaction_count,
          SUM(bt.amount) as total_amount,
          AVG(bt.amount) as avg_amount,
          MIN(bt.created_at) as first_settlement,
          MAX(bt.created_at) as last_settlement,
          COUNT(CASE WHEN bt.transaction_type = 'cashback_payout' THEN 1 END) as cashback_payouts,
          COUNT(CASE WHEN bt.transaction_type = 'load' THEN 1 END) as fund_loads,
          COUNT(CASE WHEN bt.transaction_type = 'refund' THEN 1 END) as refunds
        FROM budget_transactions bt
        WHERE 1=1 ${dateFilter} ${merchantFilter}
        GROUP BY bt.merchant_id, bt.transaction_type
        ORDER BY total_amount DESC`,
        params
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: settlementAnalytics.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get failed payment notifications
   */
  static async getFailedPaymentNotifications(req, res, next) {
    try {
      const { startDate, endDate, limit = 50, offset = 0 } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      let paramCount = 0;
      
      if (startDate && endDate) {
        paramCount += 2;
        dateFilter = 'AND ct.created_at BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        paramCount++;
        dateFilter = 'AND ct.created_at >= $1';
        params.push(startDate);
      } else if (endDate) {
        paramCount++;
        dateFilter = 'AND ct.created_at <= $1';
        params.push(endDate);
      }
      
      const failedPayments = await pool.query(
        `SELECT 
          ct.id,
          ct.original_transaction_id,
          ct.cashback_amount,
          ct.cashback_percentage,
          ct.status,
          ct.error_message,
          ct.created_at,
          ct.updated_at,
          u.name as customer_name,
          u.email as customer_email
        FROM cashback_transactions ct
        LEFT JOIN users u ON ct.customer_id = u.id
        WHERE ct.status = 'failed' ${dateFilter}
        ORDER BY ct.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          failedPayments: failedPayments.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: failedPayments.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get late payment notifications
   */
  static async getLatePaymentNotifications(req, res, next) {
    try {
      const { hoursLate = 24, limit = 50, offset = 0 } = req.query;
      const pool = getPool();
      
      const latePayments = await pool.query(
        `SELECT 
          ct.id,
          ct.original_transaction_id,
          ct.cashback_amount,
          ct.cashback_percentage,
          ct.status,
          ct.created_at,
          EXTRACT(EPOCH FROM (NOW() - ct.created_at))/3600 as hours_pending,
          u.name as customer_name,
          u.email as customer_email
        FROM cashback_transactions ct
        LEFT JOIN users u ON ct.customer_id = u.id
        WHERE ct.status = 'pending'
        AND ct.created_at < NOW() - INTERVAL '${parseInt(hoursLate)} hours'
        ORDER BY ct.created_at ASC
        LIMIT $1 OFFSET $2`,
        [parseInt(limit), parseInt(offset)]
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          latePayments: latePayments.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: latePayments.rows.length
          },
          hoursLate: parseInt(hoursLate)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive admin dashboard metrics
   */
  static async getAdminDashboardMetrics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      
      if (startDate && endDate) {
        dateFilter = 'AND created_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      } else if (startDate) {
        dateFilter = 'AND created_at >= $1';
        params = [startDate];
      } else if (endDate) {
        dateFilter = 'AND created_at <= $1';
        params = [endDate];
      }
      
      const dashboardMetrics = await pool.query(
        `SELECT 
          -- Transaction Metrics
          (SELECT COUNT(*) FROM cashback_transactions WHERE 1=1 ${dateFilter}) as total_transactions,
          (SELECT SUM(cashback_amount) FROM cashback_transactions WHERE status = 'processed' ${dateFilter}) as total_cashback_paid,
          (SELECT COUNT(*) FROM cashback_transactions WHERE status = 'failed' ${dateFilter}) as failed_transactions,
          (SELECT COUNT(*) FROM cashback_transactions WHERE status = 'disputed' ${dateFilter}) as disputed_transactions,
          
          -- Merchant Metrics
          (SELECT COUNT(DISTINCT merchant_id) FROM cashback_transactions WHERE 1=1 ${dateFilter}) as active_merchants,
          (SELECT COUNT(DISTINCT customer_id) FROM cashback_transactions WHERE 1=1 ${dateFilter}) as active_customers,
          
          -- Funds Metrics
          (SELECT SUM(current_balance) FROM merchant_budgets WHERE status = 'active') as total_funds_balance,
          (SELECT SUM(total_loaded) FROM merchant_budgets WHERE status = 'active') as total_funds_loaded,
          (SELECT SUM(total_spent) FROM merchant_budgets WHERE status = 'active') as total_funds_spent,
          
          -- Dispute Metrics
          (SELECT COUNT(*) FROM disputes WHERE status = 'open') as open_disputes,
          (SELECT COUNT(*) FROM disputes WHERE status = 'under_review') as under_review_disputes,
          (SELECT COUNT(*) FROM disputes WHERE status = 'resolved' ${dateFilter}) as resolved_disputes`,
        params
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: dashboardMetrics.rows[0] || {},
        period: { startDate, endDate }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction trends over time
   */
  static async getTransactionTrends(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      
      if (startDate && endDate) {
        dateFilter = 'AND created_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      } else if (startDate) {
        dateFilter = 'AND created_at >= $1';
        params = [startDate];
      } else if (endDate) {
        dateFilter = 'AND created_at <= $1';
        params = [endDate];
      }
      
      const groupByClause = groupBy === 'hour' ? 'DATE_TRUNC(\'hour\', created_at)' :
                           groupBy === 'day' ? 'DATE_TRUNC(\'day\', created_at)' :
                           groupBy === 'week' ? 'DATE_TRUNC(\'week\', created_at)' :
                           'DATE_TRUNC(\'month\', created_at)';
      
      const trends = await pool.query(
        `SELECT 
          ${groupByClause} as period,
          COUNT(*) as transaction_count,
          SUM(cashback_amount) as total_cashback,
          AVG(cashback_amount) as avg_cashback,
          COUNT(CASE WHEN status = 'processed' THEN 1 END) as successful_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
          COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count
        FROM cashback_transactions
        WHERE 1=1 ${dateFilter}
        GROUP BY ${groupByClause}
        ORDER BY period DESC`,
        params
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          trends: trends.rows,
          groupBy,
          period: { startDate, endDate }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get platform health metrics
   */
  static async getPlatformHealthMetrics(req, res, next) {
    try {
      const pool = getPool();
      
      const healthMetrics = await pool.query(
        `SELECT 
          -- System Health
          (SELECT COUNT(*) FROM cashback_transactions WHERE created_at > NOW() - INTERVAL '1 hour') as transactions_last_hour,
          (SELECT COUNT(*) FROM cashback_transactions WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour') as failures_last_hour,
          (SELECT COUNT(*) FROM disputes WHERE status = 'open' AND created_at > NOW() - INTERVAL '24 hours') as new_disputes_24h,
          -- Performance Metrics
          (SELECT AVG(EXTRACT(EPOCH FROM (processed_at - created_at))/60) FROM cashback_transactions WHERE status = 'processed' AND processed_at IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours') as avg_processing_time_minutes,
          (SELECT COUNT(*) FROM cashback_transactions WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour') as stuck_transactions,
          
          -- Funds Health
          (SELECT COUNT(*) FROM merchant_budgets WHERE current_balance < (total_loaded * 0.1)) as low_balance_merchants,
          (SELECT COUNT(*) FROM merchant_budgets WHERE status = 'suspended') as suspended_merchants`
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: healthMetrics.rows[0] || {},
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}
