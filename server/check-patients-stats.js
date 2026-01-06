require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function checkPatients() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Total unique patients
    const [totalResult] = await connection.execute(
      'SELECT COUNT(*) as total FROM unified_patients'
    );
    console.log(`\n📊 Total Unique Patients: ${totalResult[0].total}`);

    // Patients with internal ID (patient_id)
    const [withInternalId] = await connection.execute(
      'SELECT COUNT(*) as count FROM unified_patients WHERE patient_id IS NOT NULL'
    );
    console.log(`✅ Patients with Internal ID: ${withInternalId[0].count}`);

    // Patients with TSH ID (tshla_id)
    const [withTshId] = await connection.execute(
      'SELECT COUNT(*) as count FROM unified_patients WHERE tshla_id IS NOT NULL'
    );
    console.log(`✅ Patients with TSH ID: ${withTshId[0].count}`);

    // Patients missing internal ID
    const [missingInternal] = await connection.execute(
      'SELECT COUNT(*) as count FROM unified_patients WHERE patient_id IS NULL'
    );
    if (missingInternal[0].count > 0) {
      console.log(`❌ Patients missing Internal ID: ${missingInternal[0].count}`);
    }

    // Patients missing TSH ID
    const [missingTsh] = await connection.execute(
      'SELECT COUNT(*) as count FROM unified_patients WHERE tshla_id IS NULL'
    );
    if (missingTsh[0].count > 0) {
      console.log(`❌ Patients missing TSH ID: ${missingTsh[0].count}`);
    }

    // Total appointments created
    const [appointmentsResult] = await connection.execute(
      'SELECT COUNT(*) as total FROM provider_schedules WHERE unified_patient_id IS NOT NULL'
    );
    console.log(`\n📅 Total Appointments with Patients: ${appointmentsResult[0].total}`);

    // Sample of recent patients
    console.log('\n📋 Sample of Recent 5 Patients:');
    const [samplePatients] = await connection.execute(
      'SELECT patient_id, tshla_id, first_name, last_name, phone_primary FROM unified_patients ORDER BY created_at DESC LIMIT 5'
    );
    samplePatients.forEach(p => {
      console.log(`   ${p.first_name || 'N/A'} ${p.last_name || 'N/A'} - Internal: ${p.patient_id}, TSH: ${p.tshla_id}, Phone: ${p.phone_primary}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkPatients();
