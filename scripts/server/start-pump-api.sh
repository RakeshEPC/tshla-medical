#!/bin/bash
export PORT=3005
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=""
export DB_DATABASE=tshla_medical_local
export USE_MYSQL=true

node server/pump-report-api.js
