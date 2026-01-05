const { supabaseAdmin } = require('../config/supabase');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DatabaseMigrator {
  constructor() {
    this.backupDir = path.join(__dirname, '../data/backups');
  }

  async init() {
    // Ensure backup directory exists
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.log('Backup directory already exists');
    }
  }

  /**
   * Generate secure temporary password
   * @returns {string} Random password
   */
  generateTempPassword() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Backup existing data
   * @param {Object} data - Data to backup
   * @param {string} filename - Backup filename
   */
  async createBackup(data, filename) {
    const backupPath = path.join(this.backupDir, filename);
    const backupData = {
      timestamp: new Date().toISOString(),
      data: data,
      version: '1.0.0'
    };

    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    return backupPath;
  }

  /**
   * Load existing user data from file
   * @returns {Object} User data
   */
  async loadExistingData() {
    const usersFile = path.join(__dirname, '../data/users.json');

    try {
      const data = await fs.readFile(usersFile, 'utf8');
      const usersData = JSON.parse(data);
      console.log(`📂 Loaded ${Object.keys(usersData).length} users from existing data`);
      return usersData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📂 No existing user data found');
        return {};
      }
      throw error;
    }
  }

  /**
   * Migrate users to Supabase
   * @param {Object} usersData - Existing user data
   * @returns {Object} Migration results
   */
  async migrateUsers(usersData) {
    const results = {
      total: Object.keys(usersData).length,
      migrated: 0,
      skipped: 0,
      errors: []
    };

    for (const [avatarName, userData] of Object.entries(usersData)) {
      try {
        console.log(`🔄 Migrating user: ${avatarName}`);

        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('avatar_name', avatarName)
          .single();

        if (existingUser) {
          console.log(`⏭️  User ${avatarName} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Create user in Supabase
        const { data: user, error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            email: userData.email,
            avatar_name: avatarName,
            temp_password: userData.tempPassword || this.generateTempPassword(),
            ethereal_user: userData.etherealUser,
            ethereal_pass: userData.etherealPass,
            email_verified: true,
            is_active: true,
            created_at: userData.createdAt || new Date().toISOString(),
            last_login: userData.lastLogin
          })
          .select()
          .single();

        if (userError) {
          console.error(`❌ Failed to migrate ${avatarName}:`, userError);
          results.errors.push({ avatarName, error: userError });
          continue;
        }

        // Create user profile
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: avatarName,
            status: 'offline',
            last_seen: userData.lastSeen || new Date().toISOString(),
            preferences: {
              theme: 'dark',
              notifications: true,
              sound_enabled: true,
              encryption_level: 'high'
            }
          });

        if (profileError) {
          console.error(`⚠️  Profile creation failed for ${avatarName}:`, profileError);
        }

        console.log(`✅ Migrated ${avatarName} (ID: ${user.id})`);
        results.migrated++;

      } catch (error) {
        console.error(`❌ Unexpected error migrating ${avatarName}:`, error);
        results.errors.push({ avatarName, error: error.message });
      }
    }

    return results;
  }

  /**
   * Clean up old data files (optional)
   */
  async cleanupOldData() {
    const usersFile = path.join(__dirname, '../data/users.json');
    const otpFile = path.join(__dirname, '../data/otp.json');

    try {
      await fs.rename(usersFile, `${usersFile}.migrated`);
      console.log('📦 Renamed old users.json to users.json.migrated');

      try {
        await fs.rename(otpFile, `${otpFile}.migrated`);
        console.log('📦 Renamed old otp.json to otp.json.migrated');
      } catch (error) {
        // OTP file might not exist
      }
    } catch (error) {
      console.log('⚠️  Could not rename old data files:', error.message);
    }
  }

  /**
   * Verify migration success
   * @returns {Object} Verification results
   */
  async verifyMigration() {
    const results = {
      usersCount: 0,
      profilesCount: 0,
      sampleUsers: []
    };

    // Count users
    const { count: usersCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    results.usersCount = usersCount || 0;

    // Count profiles
    const { count: profilesCount } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    results.profilesCount = profilesCount || 0;

    // Get sample users
    const { data: sampleUsers } = await supabaseAdmin
      .from('users')
      .select('avatar_name, email, created_at')
      .limit(5);

    results.sampleUsers = sampleUsers || [];

    return results;
  }

  /**
   * Run complete migration
   */
  async runMigration() {
    console.log('🚀 Starting ChitChat to Supabase migration...');
    console.log('=' .repeat(50));

    try {
      await this.init();

      // Load existing data
      const usersData = await loadExistingData();
      if (Object.keys(usersData).length === 0) {
        console.log('ℹ️  No existing data to migrate');
        return;
      }

      // Create backup
      const backupPath = await this.createBackup(usersData, `migration-backup-${Date.now()}.json`);

      // Migrate users
      console.log('🔄 Migrating users...');
      const migrationResults = await this.migrateUsers(usersData);

      console.log('\n📊 Migration Results:');
      console.log(`   Total users: ${migrationResults.total}`);
      console.log(`   Migrated: ${migrationResults.migrated}`);
      console.log(`   Skipped: ${migrationResults.skipped}`);
      console.log(`   Errors: ${migrationResults.errors.length}`);

      if (migrationResults.errors.length > 0) {
        console.log('\n❌ Migration Errors:');
        migrationResults.errors.forEach(err => {
          console.log(`   ${err.avatarName}: ${err.error}`);
        });
      }

      // Verify migration
      console.log('\n🔍 Verifying migration...');
      const verification = await this.verifyMigration();

      console.log('✅ Verification Results:');
      console.log(`   Users in database: ${verification.usersCount}`);
      console.log(`   Profiles in database: ${verification.profilesCount}`);

      if (verification.sampleUsers.length > 0) {
        console.log('   Sample migrated users:');
        verification.sampleUsers.forEach(user => {
          console.log(`     - ${user.avatar_name} (${user.email})`);
        });
      }

      // Optional cleanup
      const shouldCleanup = process.argv.includes('--cleanup');
      if (shouldCleanup) {
        console.log('\n🧹 Cleaning up old data files...');
        await this.cleanupOldData();
      } else {
        console.log('\n💡 Old data files preserved. Use --cleanup to remove them.');
      }

      console.log('\n🎉 Migration completed successfully!');
      console.log(`📁 Backup available at: ${backupPath}`);
      console.log('🔄 You can now start using the new microservice architecture.');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      console.log('🔄 You can retry the migration or restore from backup.');
      process.exit(1);
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  migrator.runMigration().catch(console.error);
}

module.exports = DatabaseMigrator;
