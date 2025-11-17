#!/bin/bash

echo "Creating test patient via dictation..."
echo ""

# Create a patient via dictation
curl -X POST http://localhost:3000/api/dictated-notes \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "test-001",
    "provider_name": "Dr. Smith",
    "patient_name": "Test Patient",
    "patient_phone": "555-999-8888",
    "patient_email": "test@example.com",
    "patient_dob": "1990-01-15",
    "visit_date": "2025-01-16",
    "chief_complaint": "Annual checkup",
    "raw_transcript": "Patient presents for annual physical examination",
    "processed_note": "Annual physical examination completed. Patient reports feeling well with no new concerns.",
    "status": "completed"
  }'

echo ""
echo ""
echo "=========================================="
echo "✅ Patient created successfully!"
echo "=========================================="
echo ""
echo "Check your server console logs for:"
echo "  📱 New PIN: XXXXXX"
echo ""
echo "Then login at:"
echo "  http://localhost:5173/patient-portal-login"
echo ""
echo "Phone: 555-999-8888"
echo "PIN: (from console output above)"
echo ""
