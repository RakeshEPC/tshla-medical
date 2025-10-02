#!/bin/bash
# PM2 Startup Script for TSHLA Medical
# This needs to be run with sudo to enable PM2 to start on system boot

echo "Setting up PM2 to start on system boot..."
sudo env PATH=$PATH:/opt/homebrew/Cellar/node/24.4.0/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u rakeshpatel --hp /Users/rakeshpatel

echo ""
echo "PM2 startup configuration complete!"
echo "Your TSHLA servers will now automatically start when your Mac boots up."
