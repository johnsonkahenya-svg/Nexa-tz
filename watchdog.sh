#!/data/data/com.termux/files/usr/bin/sh

while true
do
    STATUS=$(pm2 jlist | grep '"name":"nexa-tz"' | grep '"status":"online"')

    if [ -z "$STATUS" ]; then
        echo "🔁 BOT DEAD → RESTARTING..."
        pm2 restart nexa-tz
        sleep 5
    else
        echo "✅ BOT OK"
    fi

    sleep 15
done
