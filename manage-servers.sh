#!/bin/bash
# TSHLA Medical Server Management Script
# Easy commands to manage your development servers

case "$1" in
  start)
    echo "🚀 Starting TSHLA servers..."
    pm2 start ecosystem.config.cjs
    pm2 save
    echo "✅ Servers started!"
    pm2 list
    ;;

  stop)
    echo "🛑 Stopping TSHLA servers..."
    pm2 stop tshla-pump-api tshla-frontend
    echo "✅ Servers stopped!"
    pm2 list
    ;;

  restart)
    echo "🔄 Restarting TSHLA servers..."
    pm2 restart tshla-pump-api tshla-frontend
    echo "✅ Servers restarted!"
    pm2 list
    ;;

  status)
    echo "📊 TSHLA Server Status:"
    pm2 list
    echo ""
    echo "🌐 Access URLs:"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend API: http://localhost:3005"
    echo "  API Docs: http://localhost:3005/"
    echo "  Login Page: http://localhost:5173/pumpdrive/login"
    ;;

  logs)
    echo "📋 Showing server logs (Ctrl+C to exit)..."
    pm2 logs
    ;;

  logs-api)
    echo "📋 Showing API logs (Ctrl+C to exit)..."
    pm2 logs tshla-pump-api
    ;;

  logs-frontend)
    echo "📋 Showing frontend logs (Ctrl+C to exit)..."
    pm2 logs tshla-frontend
    ;;

  delete)
    echo "🗑️  Removing TSHLA servers from PM2..."
    pm2 delete tshla-pump-api tshla-frontend
    pm2 save
    echo "✅ Servers removed!"
    ;;

  test)
    echo "🧪 Testing server connectivity..."
    echo ""
    echo "Testing Backend API..."
    curl -s http://localhost:3005/ | head -c 200
    echo ""
    echo ""
    echo "Testing Frontend..."
    curl -s http://localhost:5173/ -I | grep HTTP
    echo ""
    echo "✅ Test complete!"
    ;;

  *)
    echo "TSHLA Medical Server Management"
    echo "================================"
    echo ""
    echo "Usage: ./manage-servers.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start          - Start both servers"
    echo "  stop           - Stop both servers"
    echo "  restart        - Restart both servers"
    echo "  status         - Show server status and URLs"
    echo "  logs           - View all server logs"
    echo "  logs-api       - View API logs only"
    echo "  logs-frontend  - View frontend logs only"
    echo "  delete         - Remove servers from PM2"
    echo "  test           - Test server connectivity"
    echo ""
    echo "Examples:"
    echo "  ./manage-servers.sh start"
    echo "  ./manage-servers.sh status"
    echo "  ./manage-servers.sh logs"
    ;;
esac
