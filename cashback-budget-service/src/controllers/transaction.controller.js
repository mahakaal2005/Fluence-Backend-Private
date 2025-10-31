import { TransactionModel } from '../models/transaction.model.js';
import { validationResult } from 'express-validator';

export class TransactionController {
  /**
   * Create a new transaction
   */
  static async createTransaction(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { amount, type, campaignId, customerId, description, metadata } = req.body;

      if (type !== 'cashback') {
        throw new Error('Only cashback transactions are supported');
      }

      // Get campaign to derive merchant and percentage
      const { CampaignModel } = await import('../models/campaign.model.js');
      const campaign = await CampaignModel.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campaign not found' });
      }

      // Ensure original transaction id (required by schema)
      const { randomUUID } = await import('crypto');
      const originalTransactionId = req.body.originalTransactionId || randomUUID();

      const transaction = await TransactionModel.createTransaction({
        merchantId: campaign.merchant_id,
        campaignId,
        customerId,
        originalTransactionId,
        cashbackAmount: amount,
        cashbackPercentage: campaign.cashback_percentage
      });

      // Also create a pending points entry in Points Wallet Service for the user
      try {
        const { getConfig } = await import('../config/index.js');
        const config = getConfig();
        const pointsBase = config.services.points;

        // Build a JWT-like header for the target customer (points service trusts payload parsing)
        const header = { alg: 'none', typ: 'JWT' };
        const toBase64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
        const payload = { sub: customerId, email: `${customerId}@internal`, role: 'user' };
        const customerJwt = `${toBase64(header)}.${toBase64(payload)}.`;

        const earnBody = {
          amount: Math.round(Number(amount) || 0),
          transactionType: 'cashback',
          description: `Cashback pending (txn ${transaction.id})`,
          referenceId: transaction.id,
          socialPostRequired: true
        };

        await fetch(`${pointsBase}/api/points/earn`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${customerJwt}`
          },
          body: JSON.stringify(earnBody)
        });
      } catch (earnErr) {
        // Do not block transaction creation if points service call fails
        console.error('Failed to enqueue pending points for transaction:', transaction.id, earnErr);
      }

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Transaction created successfully'
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create transaction',
        message: error.message
      });
    }
  }

  /**
   * Get all transactions
   */
  static async getTransactions(req, res) {
    const startTime = Date.now();

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ [TRANSACTIONS] Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    try {
      console.log('\n========================================');
      console.log('💰 [TRANSACTIONS] GET /api/transactions');
      console.log('========================================');
      console.log('📋 Request Details:');
      console.log('   User ID:', req.user?.id);
      console.log('   User Email:', req.user?.email);
      console.log('   User Role:', req.user?.role);
      console.log('   Query params:', JSON.stringify(req.query, null, 2));

      const { page = 1, limit = 100, status, type } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      console.log('🔍 Query Configuration:');
      console.log('   Page:', page, '| Limit:', limit, '| Offset:', offset);
      console.log('   Filters: status =', status || 'all', '| type =', type || 'all');

      // Get cashback transactions with merchant and campaign data
      const pool = await import('../config/database.js').then(m => m.getPool());

      let query = `
        SELECT 
          ct.id,
          ct.customer_id,
          ct.merchant_id,
          ct.campaign_id,
          ct.original_transaction_id,
          ct.cashback_amount,
          ct.cashback_percentage,
          ct.status,
          ct.processed_at,
          ct.created_at,
          cc.campaign_name,
          cc.cashback_percentage as campaign_rate
        FROM cashback_transactions ct
        LEFT JOIN cashback_campaigns cc ON ct.campaign_id = cc.id
      `;

      const params = [];
      let paramCount = 0;

      // Admin sees all transactions, regular users see only their own
      if (req.user.role !== 'admin') {
        paramCount++;
        query += ` WHERE ct.customer_id = $${paramCount}`;
        params.push(req.user.id);
      } else {
        query += ` WHERE 1=1`; // Placeholder for admin to allow AND clauses
      }

      if (status) {
        paramCount++;
        query += ` AND ct.status = $${paramCount}`;
        params.push(status);
      }

      query += ` ORDER BY ct.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), offset);

      console.log('📊 Executing query with', params.length, 'parameters');
      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM cashback_transactions';
      const countParams = [];

      if (req.user.role !== 'admin') {
        countQuery += ' WHERE customer_id = $1';
        countParams.push(req.user.id);

        if (status) {
          countQuery += ' AND status = $2';
          countParams.push(status);
        }
      } else {
        if (status) {
          countQuery += ' WHERE status = $1';
          countParams.push(status);
        }
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Get OVERALL analytics (unfiltered) for dashboard stats
      let overallQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'disputed' THEN 1 ELSE 0 END) as disputed,
          SUM(cashback_amount) as total_volume
        FROM cashback_transactions
      `;

      const overallParams = [];
      if (req.user.role !== 'admin') {
        overallQuery += ' WHERE customer_id = $1';
        overallParams.push(req.user.id);
      }

      const overallResult = await pool.query(overallQuery, overallParams);
      const overall = overallResult.rows[0];

      // Calculate growth: compare last 7 days vs previous 7 days
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      let recentVolumeQuery = `
        SELECT SUM(cashback_amount) as volume
        FROM cashback_transactions
        WHERE created_at > $1
      `;
      const recentVolumeParams = [sevenDaysAgo];

      if (req.user.role !== 'admin') {
        recentVolumeQuery += ' AND customer_id = $2';
        recentVolumeParams.push(req.user.id);
      }

      let previousVolumeQuery = `
        SELECT SUM(cashback_amount) as volume
        FROM cashback_transactions
        WHERE created_at > $1 AND created_at <= $2
      `;
      const previousVolumeParams = [fourteenDaysAgo, sevenDaysAgo];

      if (req.user.role !== 'admin') {
        previousVolumeQuery += ' AND customer_id = $3';
        previousVolumeParams.push(req.user.id);
      }

      const [recentVolumeResult, previousVolumeResult] = await Promise.all([
        pool.query(recentVolumeQuery, recentVolumeParams),
        pool.query(previousVolumeQuery, previousVolumeParams)
      ]);

      const recentVolume = parseFloat(recentVolumeResult.rows[0].volume || 0);
      const previousVolume = parseFloat(previousVolumeResult.rows[0].volume || 0);

      let volumeGrowth = 0;
      if (previousVolume > 0) {
        volumeGrowth = ((recentVolume - previousVolume) / previousVolume) * 100;
      } else if (recentVolume > 0) {
        volumeGrowth = 100; // 100% growth if we had 0 before
      }

      // Round to 1 decimal place
      volumeGrowth = Math.round(volumeGrowth * 10) / 10;

      const analytics = {
        totalVolume: parseFloat(overall.total_volume || 0),
        volumeGrowth: volumeGrowth,
        recentVolume: recentVolume,
        previousVolume: previousVolume,
        pending: parseInt(overall.pending || 0),
        processed: parseInt(overall.processed || 0),
        failed: parseInt(overall.failed || 0),
        disputed: parseInt(overall.disputed || 0)
      };

      const overallTotal = parseInt(overall.total || 0);
      const successRate = overallTotal > 0 ? ((analytics.processed / overallTotal) * 100).toFixed(0) : 0;

      console.log('✅ Query Results:');
      console.log('   Transactions found:', result.rows.length);
      console.log('   Total in DB:', total);
      console.log('   Total volume: ₹', analytics.totalVolume.toFixed(2));
      console.log('   Volume growth:', volumeGrowth.toFixed(1) + '%');
      console.log('   Recent volume (7d): ₹', recentVolume.toFixed(2));
      console.log('   Previous volume (7-14d): ₹', previousVolume.toFixed(2));
      console.log('   Success rate:', successRate + '%');
      console.log('   Status breakdown:', {
        pending: analytics.pending,
        processed: analytics.processed,
        failed: analytics.failed,
        disputed: analytics.disputed
      });

      if (result.rows.length > 0) {
        console.log('📝 Sample transaction:', {
          id: result.rows[0].id,
          amount: result.rows[0].cashback_amount,
          status: result.rows[0].status,
          campaign: result.rows[0].campaign_name
        });
      }

      const responseTime = Date.now() - startTime;
      console.log('⏱️  Response time:', responseTime + 'ms');
      console.log('========================================\n');

      res.json({
        success: true,
        data: {
          transactions: result.rows.map(t => ({
            id: t.id,
            userId: t.customer_id,
            merchantId: t.merchant_id,
            campaignId: t.campaign_id,
            amount: parseFloat(t.cashback_amount),
            currency: 'INR',
            type: 'cashback',
            status: t.status,
            category: 'Cashback',
            description: t.campaign_name || `Cashback ${t.cashback_percentage}%`,
            merchantName: t.campaign_name || 'Unknown Business',
            cashbackPercentage: parseFloat(t.cashback_percentage),
            originalTransactionId: t.original_transaction_id,
            processedAt: t.processed_at,
            createdAt: t.created_at
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
          },
          analytics: {
            totalVolume: analytics.totalVolume,
            volumeGrowth: analytics.volumeGrowth,
            recentVolume: analytics.recentVolume,
            previousVolume: analytics.previousVolume,
            successRate: parseInt(successRate),
            pending: analytics.pending,
            processed: analytics.processed,
            failed: analytics.failed,
            disputed: analytics.disputed
          }
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('❌ [TRANSACTIONS] Error after', responseTime + 'ms');
      console.error('   Error type:', error.name);
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
      console.error('========================================\n');

      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get a specific transaction by ID
   */
  static async getTransactionById(req, res) {
    try {
      const { id } = req.params;
      const transaction = await TransactionModel.findById(id);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction',
        message: error.message
      });
    }
  }

  /**
   * Update a transaction
   */
  static async updateTransaction(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const transaction = await TransactionModel.findById(id);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      const updatedTransaction = await TransactionModel.update(id, req.body);

      res.json({
        success: true,
        data: updatedTransaction,
        message: 'Transaction updated successfully'
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update transaction',
        message: error.message
      });
    }
  }

  /**
   * Delete a transaction
   */
  static async deleteTransaction(req, res) {
    try {
      const { id } = req.params;
      const transaction = await TransactionModel.findById(id);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      await TransactionModel.delete(id);

      res.json({
        success: true,
        message: 'Transaction deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete transaction',
        message: error.message
      });
    }
  }

  /**
   * Process a transaction
   */
  static async processTransaction(req, res) {
    try {
      const { id } = req.params;
      const transaction = await TransactionModel.findById(id);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      const processedTransaction = await TransactionModel.process(id);

      // Credit user's wallet points in Points Wallet Service
      try {
        const { getConfig } = await import('../config/index.js');
        const config = getConfig();
        const baseUrl = config.services.points;
        const merchantBase = config.services.merchant;

        // Build a minimal JWT-like token acceptable by the points service middleware
        const payload = {
          sub: processedTransaction.customer_id,
          email: `${processedTransaction.customer_id}@internal`,
          role: 'user'
        };
        const header = { alg: 'none', typ: 'JWT' };
        const toBase64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
        const fakeJwt = `${toBase64(header)}.${toBase64(payload)}.`;

        // Try to resolve merchant name for description enrichment
        let merchantName = null;
        try {
          const adminPayload = { sub: 'system', email: 'system@internal', role: 'admin' };
          const adminJwt = `${toBase64(header)}.${toBase64(adminPayload)}.`;
          const resp = await fetch(`${merchantBase}/api/admin/merchants?merchantId=${processedTransaction.merchant_id}`, {
            headers: { 'Authorization': `Bearer ${adminJwt}` }
          });
          if (resp.ok) {
            const data = await resp.json();
            const first = Array.isArray(data?.data) ? data.data.find(m => m.id === processedTransaction.merchant_id) : null;
            merchantName = first?.business_name || first?.businessName || null;
          }
        } catch {}

        const body = {
          amount: Number(processedTransaction.cashback_amount),
          transactionType: 'cashback',
          description: merchantName
            ? `Cashback from ${merchantName} (txn ${processedTransaction.id})`
            : `Cashback credited (txn ${processedTransaction.id})`,
          referenceId: processedTransaction.id
        };

        await fetch(`${baseUrl}/api/points/earn`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fakeJwt}`
          },
          body: JSON.stringify(body)
        });
      } catch (creditError) {
        // Don't fail the processing if crediting points fails; log for later retries
        console.error('Failed to credit points for transaction:', id, creditError);
      }

      res.json({
        success: true,
        data: processedTransaction,
        message: 'Transaction processed successfully'
      });
    } catch (error) {
      console.error('Error processing transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process transaction',
        message: error.message
      });
    }
  }

  /**
   * Get transaction analytics
   */
  static async getTransactionAnalytics(req, res) {
    try {
      console.log('\n========================================');
      console.log('📊 [ANALYTICS] GET /api/transactions/analytics');
      console.log('========================================');
      console.log('Query params:', JSON.stringify(req.query, null, 2));
      console.log('User ID:', req.user?.id);

      const { startDate, endDate, type } = req.query;

      // For merchants, use their user ID as merchant_id
      const merchantId = req.user?.id;

      const options = {
        startDate,
        endDate,
        type,
        merchantId
      };

      console.log('Fetching analytics with options:', JSON.stringify(options, null, 2));
      console.log('Merchant ID:', merchantId);

      const analytics = await TransactionModel.getAnalytics(options);

      console.log('✅ Analytics result:', JSON.stringify(analytics, null, 2));
      console.log('========================================\n');

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('❌ [ANALYTICS] Error:', error);
      console.error('Stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction analytics',
        message: error.message
      });
    }
  }
}