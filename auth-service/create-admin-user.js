#!/usr/bin/env node

/**
 * Script to create an initial admin user
 * Usage: node create-admin-user.js
 */

import bcrypt from 'bcryptjs';
import { getPool } from './src/db/pool.js';
import { createUser } from './src/models/user.model.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createInitialAdmin() {
  try {
    console.log('🔐 Creating Initial Admin User for Fluence Pay App');
    console.log('================================================\n');

    // Get admin details
    const name = await question('Admin Name: ');
    const email = await question('Admin Email: ');
    const password = await question('Admin Password (min 8 characters): ');
    const phone = await question('Admin Phone (optional): ');

    if (!name || !email || !password) {
      console.error('❌ Name, email, and password are required');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    // Check if user already exists
    const pool = getPool();
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  User with this email already exists');
      const update = await question('Do you want to update their role to admin? (y/N): ');
      
      if (update.toLowerCase() === 'y' || update.toLowerCase() === 'yes') {
        const saltRounds = 12;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        await pool.query(
          'UPDATE users SET role = $1, password_hash = $2, updated_at = NOW() WHERE email = $3',
          ['admin', password_hash, email.toLowerCase()]
        );
        
        console.log('✅ User role updated to admin successfully');
      } else {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    } else {
      // Create new admin user
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const adminUser = await createUser({
        name,
        email,
        password_hash,
        auth_provider: 'password',
        phone: phone || null,
        role: 'admin'
      });

      console.log('✅ Admin user created successfully!');
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Name: ${adminUser.name}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Role: ${adminUser.role}`);
    }

    console.log('\n🎉 Setup complete! You can now use this admin account to:');
    console.log('   - Access admin endpoints');
    console.log('   - Create additional admin users');
    console.log('   - Manage user roles and permissions');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createInitialAdmin();

