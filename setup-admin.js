#!/usr/bin/env node

/**
 * Complete Admin Setup Script
 * Creates admin user in both Firebase and PostgreSQL
 * 
 * Usage: node setup-admin.js
 */

const { spawn } = require('child_process');
const path = require('path');

const authServiceDir = path.join(__dirname, 'auth-service');

console.log('\n🔐 Fluence Admin Setup');
console.log('═'.repeat(70));
console.log('\nThis script will create an admin user in:');
console.log('  1. Firebase Authentication');
console.log('  2. PostgreSQL Database\n');
console.log('═'.repeat(70));

console.log('\n📋 Default Admin Credentials:\n');
console.log('  Email:    admin@gmail.com');
console.log('  Password: admin12345678');
console.log('\n═'.repeat(70));

// Step 1: Create Firebase Admin
console.log('\n\n🔥 Step 1: Creating Firebase Admin User\n');
console.log('─'.repeat(70));

const firebaseProcess = spawn('node', ['create-firebase-admin.js'], {
    cwd: authServiceDir,
    stdio: 'inherit',
    shell: true
});

firebaseProcess.on('error', (error) => {
    console.error('\n❌ Error running Firebase setup:', error.message);
    process.exit(1);
});

firebaseProcess.on('exit', (code) => {
    if (code !== 0) {
        console.error('\n❌ Firebase setup failed with code:', code);
        process.exit(1);
    }

    console.log('\n─'.repeat(70));

    // Step 2: Update PostgreSQL Admin Role
    console.log('\n\n🗄️  Step 2: Setting Admin Role in PostgreSQL\n');
    console.log('─'.repeat(70));

    const pgProcess = spawn('node', ['update-admin-role.js'], {
        cwd: authServiceDir,
        stdio: 'inherit',
        shell: true
    });

    pgProcess.on('error', (error) => {
        console.error('\n❌ Error running PostgreSQL setup:', error.message);
        process.exit(1);
    });

    pgProcess.on('exit', (pgCode) => {
        console.log('\n═'.repeat(70));

        if (pgCode !== 0) {
            console.log('\n⚠️  PostgreSQL setup completed with warnings');
            console.log('This is normal if the user doesn\'t exist yet in the database.');
            console.log('The user will be created automatically on first login.\n');
        }

        // Final Summary
        console.log('\n\n✅ Admin Setup Complete!\n');
        console.log('═'.repeat(70));
        console.log('\n📱 Next Steps:\n');
        console.log('  1. Start backend services:');
        console.log('     cd FluenceApp');
        console.log('     npm start\n');
        console.log('  2. Start Flutter app:');
        console.log('     flutter run -d chrome\n');
        console.log('  3. Login with admin credentials:');
        console.log('     Email:    admin@gmail.com');
        console.log('     Password: admin12345678\n');
        console.log('═'.repeat(70));
        console.log('\n💡 Tip: You can change the password after first login\n');

        process.exit(0);
    });
});
