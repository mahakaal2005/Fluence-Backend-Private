#!/usr/bin/env node

/**
 * ============================================================================
 * FLUENCE PAY - ADMIN USER CREATION SCRIPT
 * ============================================================================
 * 
 * This script creates a complete admin user with:
 * 1. Firebase Authentication account with admin role
 * 2. PostgreSQL database record with admin privileges
 * 3. Custom Firebase claims for admin access
 * 
 * Usage:
 *   npm run create-admin
 *   OR
 *   node create-admin.js
 * 
 * Environment Variables Required:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON: Firebase service account credentials (JSON string)
 *   - PG_HOST: PostgreSQL host
 *   - PG_PORT: PostgreSQL port  
 *   - PG_DATABASE: PostgreSQL database name
 *   - PG_USER: PostgreSQL user
 *   - PG_PASSWORD: PostgreSQL password
 * 
 * Default Admin Credentials:
 *   - Email: admin@gmail.com
 *   - Password: admin123 (configurable via ADMIN_PASSWORD env var)
 *   - Name: Admin User (configurable via ADMIN_NAME env var)
 * 
 * Note: Firebase requires passwords to be at least 6 characters
 * ============================================================================
 */

import admin from 'firebase-admin';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const { Pool } = pg;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env from multiple locations
const envPaths = [
    join(__dirname, '.env'),
    join(__dirname, '..', 'auth-service', '.env'),
    join(__dirname, '..', '.env'),
];

for (const envPath of envPaths) {
    if (existsSync(envPath)) {
        console.log(`📄 Loading environment variables from: ${envPath}`);
        dotenv.config({ path: envPath });
        break;
    }
}

// Configuration
const CONFIG = {
    admin: {
        email: process.env.ADMIN_EMAIL || 'admin@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'admin123', // Firebase requires min 6 chars
        name: process.env.ADMIN_NAME || 'Admin User',
        displayName: process.env.ADMIN_DISPLAY_NAME || 'Admin',
    },
    database: {
        host: process.env.PG_HOST || '161.248.37.208',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE || 'postgres',
        user: process.env.PG_USER || 'bp-user',
        password: process.env.PG_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
        ssl: (process.env.PG_SSL || 'false').toLowerCase() === 'true',
    },
};

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase() {
    try {
        console.log('\n🔥 Initializing Firebase Admin SDK...');

        const credJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!credJson) {
            throw new Error(
                'FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.\n' +
                'Please set it in your .env file or environment.'
            );
        }

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(credJson);
            console.log(`   ✓ Firebase credentials loaded`);
            console.log(`   ✓ Project ID: ${serviceAccount.project_id}`);
        } catch (error) {
            throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON format: ${error.message}`);
        }

        const credential = admin.credential.cert(serviceAccount);
        admin.initializeApp({ credential });
        console.log('   ✓ Firebase Admin SDK initialized successfully\n');

        return true;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        throw error;
    }
}

/**
 * Create or update Firebase user
 */
async function createFirebaseUser(email, password, displayName) {
    try {
        console.log('👤 Creating/updating Firebase user...');
        console.log(`   Email: ${email}`);
        console.log(`   Display Name: ${displayName}`);

        let userRecord;

        // Check if user already exists
        try {
            userRecord = await admin.auth().getUserByEmail(email);
            console.log(`   ℹ️  User already exists in Firebase (UID: ${userRecord.uid})`);

            // Update existing user
            await admin.auth().updateUser(userRecord.uid, {
                password: password,
                displayName: displayName,
                emailVerified: true,
            });

            console.log('   ✓ Firebase user password and details updated');

        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                userRecord = await admin.auth().createUser({
                    email: email,
                    password: password,
                    displayName: displayName,
                    emailVerified: true,
                });

                console.log('   ✓ Firebase user created successfully');
                console.log(`   ✓ UID: ${userRecord.uid}`);
            } else {
                throw error;
            }
        }

        // Set custom claims for admin role
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role: 'admin',
            isAdmin: true,
            permissions: ['all'],
        });

        console.log('   ✓ Admin role and custom claims set\n');

        return userRecord;
    } catch (error) {
        console.error('❌ Firebase user creation failed:', error.message);
        throw error;
    }
}

/**
 * Create database connection pool
 */
function createDatabasePool() {
    return new Pool({
        host: CONFIG.database.host,
        port: CONFIG.database.port,
        database: CONFIG.database.database,
        user: CONFIG.database.user,
        password: CONFIG.database.password,
        ssl: CONFIG.database.ssl ? { rejectUnauthorized: false } : false,
    });
}

/**
 * Create or update database user record
 */
async function createDatabaseUser(pool, firebaseUserRecord, name, email) {
    try {
        console.log('💾 Creating/updating database user record...');

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        let userId;

        if (existingUser.rows.length > 0) {
            // Update existing user
            const user = existingUser.rows[0];
            userId = user.id;

            await pool.query(
                `UPDATE users 
                 SET name = $1,
                     auth_provider = $2,
                     provider_id = $3,
                     role = $4,
                     status = $5,
                     updated_at = NOW()
                 WHERE id = $6`,
                [name, 'google', firebaseUserRecord.uid, 'admin', 'active', userId]
            );

            console.log(`   ℹ️  User already exists in database (ID: ${userId})`);
            console.log('   ✓ User role updated to admin');

        } else {
            // Create new user
            const result = await pool.query(
                `INSERT INTO users (name, email, auth_provider, provider_id, role, status, password_hash, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, '', NOW(), NOW())
                 RETURNING id`,
                [name, email.toLowerCase(), 'google', firebaseUserRecord.uid, 'admin', 'active']
            );

            userId = result.rows[0].id;
            console.log('   ✓ Database user record created');
            console.log(`   ✓ User ID: ${userId}`);
        }

        // Verify the user record
        const verifyUser = await pool.query(
            'SELECT id, name, email, role, auth_provider, provider_id, status FROM users WHERE id = $1',
            [userId]
        );

        const user = verifyUser.rows[0];
        console.log('\n📋 Database User Record:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Auth Provider: ${user.auth_provider}`);
        console.log(`   Provider ID: ${user.provider_id}`);
        console.log(`   Status: ${user.status}\n`);

        return user;
    } catch (error) {
        console.error('❌ Database operation failed:', error.message);
        throw error;
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        FLUENCE PAY - ADMIN USER CREATION SCRIPT              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('📝 Admin Credentials:');
    console.log(`   Email: ${CONFIG.admin.email}`);
    console.log(`   Password: ${CONFIG.admin.password}`);
    console.log(`   Name: ${CONFIG.admin.name}\n`);

    // Validate password length
    if (CONFIG.admin.password.length < 6) {
        console.error('❌ Error: Firebase requires passwords to be at least 6 characters');
        console.log('   Current password length:', CONFIG.admin.password.length);
        console.log('   Set ADMIN_PASSWORD environment variable with a longer password');
        process.exit(1);
    }

    console.log('🗄️  Database Configuration:');
    console.log(`   Host: ${CONFIG.database.host}`);
    console.log(`   Port: ${CONFIG.database.port}`);
    console.log(`   Database: ${CONFIG.database.database}`);
    console.log(`   User: ${CONFIG.database.user}\n`);

    const pool = createDatabasePool();

    try {
        // Step 1: Initialize Firebase
        await initializeFirebase();

        // Step 2: Create Firebase user
        const firebaseUser = await createFirebaseUser(
            CONFIG.admin.email,
            CONFIG.admin.password,
            CONFIG.admin.displayName
        );

        // Step 3: Test database connection
        console.log('🔌 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('   ✓ Database connection successful\n');

        // Step 4: Create database user record
        const dbUser = await createDatabaseUser(
            pool,
            firebaseUser,
            CONFIG.admin.name,
            CONFIG.admin.email
        );

        // Success summary
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                  ✅ ADMIN USER CREATED SUCCESSFULLY!         ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        console.log('🎉 Setup Complete! You can now use these credentials:\n');
        console.log('┌─────────────────────────────────────────────────────────────┐');
        console.log('│  LOGIN CREDENTIALS                                          │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log(`│  Email:    ${CONFIG.admin.email.padEnd(47)}│`);
        console.log(`│  Password: ${CONFIG.admin.password.padEnd(47)}│`);
        console.log('└─────────────────────────────────────────────────────────────┘\n');

        console.log('🔐 Firebase Details:');
        console.log(`   UID: ${firebaseUser.uid}`);
        console.log('   Custom Claims: role=admin, isAdmin=true\n');

        console.log('💾 Database Details:');
        console.log(`   User ID: ${dbUser.id}`);
        console.log(`   Role: ${dbUser.role}`);
        console.log(`   Status: ${dbUser.status}\n`);

        console.log('📱 Next Steps:');
        console.log('   1. Start the backend services: npm start');
        console.log('   2. Run the Flutter app: flutter run');
        console.log('   3. Login using the credentials above');
        console.log('   4. Access admin panel and manage users\n');

    } catch (error) {
        console.error('\n╔══════════════════════════════════════════════════════════════╗');
        console.error('║                ❌ ADMIN CREATION FAILED                       ║');
        console.error('╚══════════════════════════════════════════════════════════════╝\n');
        console.error('Error:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Verify FIREBASE_SERVICE_ACCOUNT_JSON is set in .env file');
        console.error('2. Check database connection credentials');
        console.error('3. Ensure PostgreSQL server is running and accessible');
        console.error('4. Verify the users table exists in the database\n');
        process.exit(1);
    } finally {
        await pool.end();
    }

    process.exit(0);
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

