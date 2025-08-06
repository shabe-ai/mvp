#!/usr/bin/env node

/**
 * Script to set up admin users in Clerk
 * 
 * Usage:
 * 1. Get your Clerk API key from https://dashboard.clerk.com/
 * 2. Run: CLERK_API_KEY=your_key node scripts/setup-admin.js
 */

const https = require('https');

const CLERK_API_KEY = process.env.CLERK_API_KEY;
const CLERK_BASE_URL = 'https://api.clerk.com/v1';

if (!CLERK_API_KEY) {
  console.error('❌ CLERK_API_KEY environment variable is required');
  console.log('Get your API key from: https://dashboard.clerk.com/');
  process.exit(1);
}

// Admin emails to set up
const ADMIN_EMAILS = [
  'vigeashgobal@gmail.com',
  'vigeash11@gmail.com',
  'admin@shabe.ai',
];

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clerk.com',
      port: 443,
      path: `/v1${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${CLERK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function getUsers() {
  try {
    const response = await makeRequest('/users');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get users:', error.message);
    return null;
  }
}

async function updateUserRole(userId, role) {
  try {
    const response = await makeRequest(`/users/${userId}/metadata`, 'PATCH', {
      public_metadata: { role }
    });
    
    if (response.status === 200) {
      console.log(`✅ Updated user ${userId} to role: ${role}`);
      return true;
    } else {
      console.error(`❌ Failed to update user ${userId}:`, response.data);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating user ${userId}:`, error.message);
    return false;
  }
}

async function setupAdmins() {
  console.log('🔧 Setting up admin users...\n');

  // Get all users
  const usersResponse = await getUsers();
  if (!usersResponse) {
    console.error('❌ Could not fetch users');
    return;
  }

  const users = usersResponse.data || [];
  console.log(`📊 Found ${users.length} users`);

  let updatedCount = 0;

  for (const user of users) {
    const email = user.email_addresses?.[0]?.email_address;
    if (!email) continue;

    const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());
    const currentRole = user.public_metadata?.role || 'user';
    
    console.log(`👤 User: ${email} (Current role: ${currentRole})`);

    if (isAdminEmail && currentRole !== 'admin') {
      console.log(`🔄 Updating ${email} to admin role...`);
      const success = await updateUserRole(user.id, 'admin');
      if (success) {
        updatedCount++;
      }
    } else if (isAdminEmail) {
      console.log(`✅ ${email} is already an admin`);
    } else {
      console.log(`ℹ️  ${email} is not in admin list`);
    }
  }

  console.log(`\n🎉 Setup complete! Updated ${updatedCount} users to admin role.`);
  console.log('\n📋 Admin emails configured:');
  ADMIN_EMAILS.forEach(email => {
    console.log(`   • ${email}`);
  });
}

// Run the setup
setupAdmins().catch(console.error); 