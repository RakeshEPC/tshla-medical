# Business Associate Agreements (BAAs)

**⚠️ IMPORTANT: Do NOT store actual BAA PDFs in this folder!**

## Storage Instructions

### Where to Store Actual BAAs:
1. **Primary:** Secure cloud storage (Google Drive, Dropbox, OneDrive)
   - Path: `TSHLA Medical/Legal/BAAs/`
   - Set appropriate access permissions
   - Enable version history

2. **Backup:** Local encrypted storage
   - Path: Outside this git repository
   - Use encrypted disk/folder
   - Regular backups

3. **Archive:** Legal counsel's document management system
   - Per your organization's legal compliance requirements

### What Goes in This Folder:
- ✅ `README.md` (this file) - Instructions
- ✅ Status tracking documents
- ✅ Compliance checklists
- ❌ **NOT actual BAA PDFs** (blocked by .gitignore)

### Security Note:
Actual BAA PDFs are excluded from git via `.gitignore`:
```
legal-compliance/baas/*.pdf
*.baa.pdf
*-baa-*.pdf
```

If you accidentally add a PDF here, it will NOT be committed to git.

## Current BAA Status

Track actual status in: `/HIPAA-BAA-TRACKER.md` (root of project)

### Quick Reference:
- **ElevenLabs:** ✅ Signed (stored in secure cloud)
- **Deepgram:** ⏳ Pending verification
- **Supabase:** ⏳ Pending execution

## Need Help?
See main tracker: `/HIPAA-BAA-TRACKER.md`
