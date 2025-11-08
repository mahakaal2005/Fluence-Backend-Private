#!/usr/bin/env node

/**
 * Test script for admin notifications
 * 
 * This script helps verify that admin notifications are working correctly
 * for both new social posts and new merchant applications.
 * 
 * Usage:
 *   node scripts/test-admin-notifications.js
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration - using shared database
const dbConfig = {
    host: process.env.DB_HOST || '161.248.37.208',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'bp-user',
    password: process.env.DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const authPool = new Pool(dbConfig);
const notificationPool = new Pool(dbConfig);

async function checkAdminUsers() {
    console.log('\n📋 Checking for admin users...\n');

    try {
        const result = await authPool.query(
            `SELECT id, name, email, role, status 
       FROM users 
       WHERE role = 'admin' AND status = 'active'`
        );

        if (result.rows.length === 0) {
            console.log('❌ No active admin users found!');
            console.log('\nTo create an admin user, run:');
            console.log(`UPDATE users SET role = 'admin' WHERE email = 'your-admin@example.com';`);
            return false;
        }

        console.log(`✅ Found ${result.rows.length} active admin user(s):\n`);
        result.rows.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.email})`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Status: ${user.status}\n`);
        });

        return true;
    } catch (error) {
        console.error('❌ Error checking admin users:', error.message);
        return false;
    }
}

async function checkRecentNotifications() {
    console.log('\n📬 Checking recent admin notifications...\n');

    try {
        const result = await notificationPool.query(
            `SELECT 
         n.id,
         n.user_id,
         n.type,
         n.subject as title,
         n.message,
         n.metadata,
         n.created_at,
         n.read_at,
         u.name as user_name,
         u.email as user_email
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.metadata::text LIKE '%admin_new_post%' 
          OR n.metadata::text LIKE '%admin_new_merchant_application%'
       ORDER BY n.created_at DESC
       LIMIT 10`
        );

        if (result.rows.length === 0) {
            console.log('ℹ️  No admin notifications found yet.');
            console.log('\nTo test:');
            console.log('1. Create a social post as a user');
            console.log('2. Submit a merchant application');
            console.log('3. Run this script again\n');
            return;
        }

        console.log(`Found ${result.rows.length} recent admin notification(s):\n`);
        result.rows.forEach((notif, index) => {
            const metadata = typeof notif.metadata === 'string'
                ? JSON.parse(notif.metadata)
                : notif.metadata;

            console.log(`${index + 1}. ${notif.title}`);
            console.log(`   To: ${notif.user_name} (${notif.user_email})`);
            console.log(`   Message: ${notif.message}`);
            console.log(`   Category: ${metadata?.category || 'N/A'}`);
            console.log(`   Created: ${new Date(notif.created_at).toLocaleString()}`);
            console.log(`   Read: ${notif.read_at ? 'Yes' : 'No'}`);

            if (metadata?.category === 'admin_new_post') {
                console.log(`   Post ID: ${metadata.postId}`);
                console.log(`   Platform: ${metadata.platform || 'N/A'}`);
                console.log(`   Post Type: ${metadata.postType || 'N/A'}`);
            } else if (metadata?.category === 'admin_new_merchant_application') {
                console.log(`   Application ID: ${metadata.applicationId}`);
                console.log(`   Business: ${metadata.businessName}`);
                console.log(`   Type: ${metadata.businessType}`);
            }

            console.log('');
        });
    } catch (error) {
        console.error('❌ Error checking notifications:', error.message);
    }
}

async function getNotificationStats() {
    console.log('\n📊 Notification Statistics...\n');

    try {
        const result = await notificationPool.query(
            `SELECT 
         COUNT(*) FILTER (WHERE metadata::text LIKE '%admin_new_post%') as post_notifications,
         COUNT(*) FILTER (WHERE metadata::text LIKE '%admin_new_merchant_application%') as application_notifications,
         COUNT(*) FILTER (WHERE read_at IS NOT NULL AND metadata::text LIKE '%admin_new_%') as read_notifications,
         COUNT(*) FILTER (WHERE read_at IS NULL AND metadata::text LIKE '%admin_new_%') as unread_notifications
       FROM notifications`
        );

        const stats = result.rows[0];
        console.log(`Total Post Notifications: ${stats.post_notifications}`);
        console.log(`Total Application Notifications: ${stats.application_notifications}`);
        console.log(`Read Admin Notifications: ${stats.read_notifications}`);
        console.log(`Unread Admin Notifications: ${stats.unread_notifications}`);
        console.log('');
    } catch (error) {
        console.error('❌ Error getting stats:', error.message);
    }
}

async function testDatabaseConnections() {
    console.log('\n🔌 Testing database connections...\n');

    try {
        await authPool.query('SELECT 1');
        console.log('✅ Auth service database: Connected');
    } catch (error) {
        console.error('❌ Auth service database: Failed -', error.message);
        return false;
    }

    try {
        await notificationPool.query('SELECT 1');
        console.log('✅ Notification service database: Connected');
    } catch (error) {
        console.error('❌ Notification service database: Failed -', error.message);
        return false;
    }

    return true;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Admin Notifications Test Script                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    // Test database connections
    const connected = await testDatabaseConnections();
    if (!connected) {
        console.log('\n❌ Database connection failed. Please check your configuration.\n');
        process.exit(1);
    }

    // Check for admin users
    const hasAdmins = await checkAdminUsers();

    // Check recent notifications
    await checkRecentNotifications();

    // Get statistics
    await getNotificationStats();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     Test Summary                                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    if (hasAdmins) {
        console.log('✅ Admin users configured correctly');
        console.log('✅ Ready to receive admin notifications');
        console.log('\nNext steps:');
        console.log('1. Create a social post to test post notifications');
        console.log('2. Submit a merchant application to test application notifications');
        console.log('3. Check the admin panel to see the notifications\n');
    } else {
        console.log('⚠️  No admin users found');
        console.log('⚠️  Admin notifications will not be sent');
        console.log('\nPlease create at least one admin user to test notifications.\n');
    }

    // Close connections
    await authPool.end();
    await notificationPool.end();
}

// Run the script
main().catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
});
