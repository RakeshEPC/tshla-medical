const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: uploads } = await supabase
    .from('patient_document_uploads')
    .select('id, created_at, raw_content')
    .eq('patient_id', '32cddaea-5a92-40c5-a3f1-2cd4b076038b')
    .order('created_at', { ascending: false })
    .limit(3);

  uploads.forEach((upload, i) => {
    console.log(`\nUpload ${i + 1} (${upload.created_at}):`);
    const hasA1C = upload.raw_content?.toLowerCase().includes('a1c') ||
                   upload.raw_content?.toLowerCase().includes('hemoglobin a');
    console.log('Contains A1C:', hasA1C);
    if (hasA1C) {
      // Show relevant lines
      const lines = upload.raw_content.split('\n');
      const a1cLines = lines.filter(line =>
        line.toLowerCase().includes('a1c') ||
        line.toLowerCase().includes('hemoglobin a')
      );
      console.log('A1C lines:');
      a1cLines.forEach(line => console.log('  ', line.trim()));
    }
  });
})();
