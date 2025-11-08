#!/usr/bin/env node

/**
 * ============================================================================
 * CLEAR ALL TRANSACTIONS SCRIPT
 * ============================================================================
 * 
 * This script completely removes:
 * 1. All cashback transactions
 * 2. All disputes
 * 3. All cashback campaigns
 * 4. All merchant budgets
 * 
 * Usage:
 *   npm run clear-transactions
 *   OR
 *   node clear-all-transactions.js
 * 
 * WARNING: This will DELETE ALL transaction data permanently!
 * ============================================================================
 */

import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
    host: process.env.PG_HOST || '161.248.37.208',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'postgres',
    user: process.env.PG_USER || 'bp-user',
    password: process.env.PG_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
});

async function clearAllTransactions() {
    const client = await pool.connect();

    try {
        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║     ⚠️  CLEARING ALL TRANSACTION DATA - PLEASE WAIT  ⚠️       ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        await client.query('BEGIN');

        // Step 1: Delete all disputes
        console.log('🗑️  Step 1: Deleting disputes...');
        const deleteDisputes = await client.query('DELETE FROM disputes');
        console.log(`   ✓ Deleted ${deleteDisputes.rowCount} disputes\n`);

        // Step 2: Delete all cashback transactions
        console.log('🗑️  Step 2: Deleting cashback transactions...');
        const deleteTransactions = await client.query('DELETE FROM cashback_transactions');
        console.log(`   ✓ Deleted ${deleteTransactions.rowCount} transactions\n`);

        // Step 3: Delete all cashback campaigns
        console.log('🗑️  Step 3: Deleting cashback campaigns...');
        const deleteCampaigns = await client.query('DELETE FROM cashback_campaigns');
        console.log(`   ✓ Deleted ${deleteCampaigns.rowCount} campaigns\n`);

        // Step 4: Delete all merchant budgets
        console.log('🗑️  Step 4: Deleting merchant budgets...');
        const deleteBudgets = await client.query('DELETE FROM merchant_budgets');
        console.log(`   ✓ Deleted ${deleteBudgets.rowCount} merchant budgets\n`);

        // Commit the transaction
        await client.query('COMMIT');

        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║           ✅ ALL TRANSACTION DATA CLEARED SUCCESSFULLY       ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        console.log('📊 Summary:');
        console.log(`   - Disputes deleted: ${deleteDisputes.rowCount}`);
        console.log(`   - Transactions deleted: ${deleteTransactions.rowCount}`);
        console.log(`   - Campaigns deleted: ${deleteCampaigns.rowCount}`);
        console.log(`   - Merchant budgets deleted: ${deleteBudgets.rowCount}\n`);

        console.log('💡 Next Steps:');
        console.log('   1. Restart the cashback service to clear any in-memory cache');
        console.log('   2. Refresh your admin panel (Ctrl+Shift+R for hard refresh)');
        console.log('   3. You should see 0 transactions now\n');
        console.log('   Optional: Run "node seed-transactions.js" to create new test data\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n╔══════════════════════════════════════════════════════════════╗');
        console.error('║                 ❌ ERROR OCCURRED                             ║');
        console.error('╚══════════════════════════════════════════════════════════════╝\n');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the script
clearAllTransactions();

