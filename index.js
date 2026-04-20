const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const qrcode = require("qrcode-terminal")

process.setMaxListeners(0)

// ================= CORE =================
process.on("uncaughtException", e => console.log("CRASH FIX:", e.message))
process.on("unhandledRejection", e => console.log("PROMISE FIX:", e.message))

// ================= 🔥 HARD STABILITY LAYER =================
process.on("uncaughtException", (err) => {
    console.log("🔥 UNCAUGHT:", err)
})

process.on("unhandledRejection", (err) => {
    console.log("🔥 UNHANDLED:", err)
})

// ================= OWNER =================
const OWNER = {
    NAME: "KYC",
    NUMBER: "255711512857"
}

// ================= HELPERS =================
const jidNum = (s) => (s || "").split("@")[0].replace(/[^0-9]/g, "")

const isOwner = (sender) => {
    const num = jidNum(sender)
    const owner = OWNER.NUMBER.replace(/[^0-9]/g, "")
    return num === owner
}

// ================= MEMORY =================
const attempts = new Map()
const seen = new Set()
const sent = new Set()

// 🚦 Control flags ili isirudie tagall
let isTagging = false

// ================= ANALYTICS =================
const stats = {
    messages: 0,
    links: 0,
    kicks: 0,
    bans: 0,
    stickers: 0
}

// ================= SAFE SEND =================
function send(sock, jid, text, m) {
    const key = jid + text
    if (sent.has(key)) return
    sent.add(key)

    sock.sendMessage(jid, { text }, { quoted: m })

    setTimeout(() => sent.delete(key), 2000)
}

// ================= RULES =================
function rules() {
    return `
📜 GROUP RULES KYC SYSTEM 📜

1 🚫 No links == hakuna Link
2 🚫 No insults == hakuna matusi
3 🚫 No dirty videos == hakuna video chafu
4 🚫 No dirty pictures == hakuna picha chafu
5 🚫 Respect admins == heshima kwa viongozi
6 🚫 Sticks are allowed == stick zinaruhusiwa
7 🚫 No exceptions == hakuna kubaguana
8 🚫 No inbox match == hakuna kufatana DM
9 🚫 No posting ads == hakuna matanganzo
10 🚫 No bot usage == hakuna matumizi ya bot
`
}

// ================= SECURITY =================
function securityMessage(num, name = "UNKNOWN") {
    return `
╭━━━〔 🔐 SECURITY ALERT 〕━━━╮
┃ 🚫 ACCESS DENIED
┃ 👤 NAME: ${name}
┃ 📱 NUMBER: ${num}
┃ 👑 OWNER: ${OWNER.NAME}
┃ ⚡ SYSTEM: ACTIVE
╰━━━━━━━━━━━━━━╯
`
}

// ================= DETECTORS =================
const isLink = (t) =>
    /https?:\/\/|www\.|bit\.ly|tinyurl|t\.co|short\.link|cutt\.ly/i.test(t)

const isSticker = (m) =>
   !!m.message?.stickerMessage

// ================= START GUARD =================
let isStarting = false
let sockInstance = null
let reconnectAttempts = 0

// ================= WATCHDOG =================
setInterval(() => {
    try {
        if (!sockInstance) {
            console.log("♻️ WATCHDOG: restarting bot...")
            start()
        }
    } catch (e) {
        console.log("WATCHDOG ERROR:", e)
    }
}, 15000)

// ================= START =================
async function start() {

    if (isStarting) return
    isStarting = true

    const { state, saveCreds } = await useMultiFileAuthState("./session")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" })
    })

    sockInstance = sock

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (u) => {
        const { connection, qr, lastDisconnect } = u

        if (qr) qrcode.generate(qr, { small: true })

        if (connection === "open") {
            console.log("🟢 BOT ONLINE")
            reconnectAttempts = 0
        }

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode

            isStarting = false
            sockInstance = null

            reconnectAttempts++

            console.log("❌ DISCONNECTED:", code)

            if (code === DisconnectReason.loggedOut) {
                console.log("⚠️ LOGGED OUT - scan QR upya")
                return
            }

            const baseDelay = 15000
            const maxDelay = 60000

            const delay = Math.min(baseDelay * reconnectAttempts, maxDelay)

            console.log(`♻️ SAFE RESTART IN ${delay / 1000}s...`)

            setTimeout(() => {
                start()
            }, delay)
        }
    })

    // ================= MESSAGE =================
    sock.ev.on("messages.upsert", async ({ messages }) => {

        const m = messages[0]
        if (!m.message || m.key.fromMe) return

        const jid = m.key.remoteJid
        const sender = m.key.participant || jid
        const num = jidNum(sender)

        const text =
            m.message.conversation ||
            m.message.extendedTextMessage?.text || ""

        const msg = text.toLowerCase()

        if (seen.has(m.key.id)) return
        seen.add(m.key.id)

        stats.messages++

        let metadata = null
        if (jid.endsWith("@g.us")) {
            try {
                metadata = await sock.groupMetadata(jid)
            } catch {}
        }

        if (msg === "nexa tz" || msg === "nexa" || msg === "Nexa tz") {

            if (isOwner(sender)) {
                return send(sock, jid, "⚡ NEXA TZ SYSTEM ONLINE (OWNER CONFIRMED 👑)", m)
            } else {
                return send(sock, jid, "⚡ NEXA TZ ACTIVE KWA NIABA YA KYC", m)
            }
        }

        if (isLink(msg)) {
            stats.links++
            try { await sock.sendMessage(jid, { delete: m.key }) } catch {}
            return send(sock, jid, rules(), m)
        }

        // ================= TYPING =================
        async function typing(sock, jid, delay = 1500) {
            await sock.sendPresenceUpdate("composing", jid)
            await new Promise(resolve => setTimeout(resolve, delay))
            await sock.sendPresenceUpdate("paused", jid)
        }

        // ================= FULL GROUP INFO WITH VERTICAL TAGS =================
        if (msg === "group") {
            try {
                const metadata = await sock.groupMetadata(jid)

                const groupName = metadata.subject
                const desc = metadata.desc || "No description"

                const participants = metadata.participants
                const admins = participants.filter(p => p.admin)
                const adminMentions = admins.map(a => a.id)

                const owner = metadata.owner || admins[0]?.id || ""
                const allMembers = participants.map(p => p.id)

                let inviteLink = "Unavailable"
                try {
                    const code = await sock.groupInviteCode(jid)
                    inviteLink = `https://chat.whatsapp.com/${code}`
                } catch {}

                await typing(sock, jid)

                // 🌸 TAG MEMBERS KWA KUSHUSHA MOJA
                let membersTag = ""
                for (const member of allMembers) {
                    membersTag += `🌸 @${member.split("@")[0]}\n`
                }

                await sock.sendMessage(jid, {
                    text: `👥✨ *GROUP FULL INFO PREMIUM* ✨👥

📛 Name: ${groupName}

👑 Founder:
🌸 @${owner.split("@")[0]}

🛡 Admins (${admins.length}):
${admins.map(a => `🌸 @${a.id.split("@")[0]}`).join("\n")}

👥 Total Members: ${participants.length}

🧾 Description:
${desc}

📜 Rules:
${rules()}

🔗 Group Link:
${inviteLink}

💬 Members Tag (${allMembers.length}):
${membersTag}
⚡ Powered by NEXA TZ 💎🌹`,
                    mentions: [...allMembers,...adminMentions, owner]
                })

            } catch (e) {
                send(sock, jid, "❌ Imeshindikana kupata taarifa za group", m)
            }
        }

        if (msg === ".group") {
            try {
                const metadata = await sock.groupMetadata(jid)

                return send(sock, jid, `
👥 GROUP INFORMATION

📛 Name: ${metadata.subject}
👤 Members: ${metadata.participants.length}
🧾 Description: ${metadata.desc || "No description available"}
`, m)

            } catch (e) {
                return send(sock, jid, "❌ Sijafanikiwa kupata group info", m)
            }
        }

        if (msg === ".stats") {
            return send(sock, jid, `
📊 GROUP ANALYTICS

💬 Messages: ${stats.messages}
🔗 Links: ${stats.links}
👮 Kicks: ${stats.kicks}
🚫 Bans: ${stats.bans}
🧩 Stickers: ${stats.stickers}
`, m)
        }

        if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            return send(sock, jid, "👋 Nipo online mda wote wewe je mala moja shida nini mkuu?", m)
        }

        // ================= TAGALL SYSTEM =================
        if (msg === "tagall" && jid.endsWith("@g.us")) {
            if (isTagging) {
                return send(sock, jid, "⚠️ TAGALL INAENDELEA SASA HIVI... Subiri iishe kwanza ⏳🌸", m)
            }
            isTagging = true
            await runTagAll(sock, jid, m)
            isTagging = false
        }

    })
}

// ================= TAGALL FUNCTION =================
async function runTagAll(sock, jid, m) {
    try {
        const metadata = await sock.groupMetadata(jid)
        const participants = metadata.participants.map(p => p.id)
        const totalMembers = participants.length

        // ROUND 1 - TAG 35 MEMBERS
        let tagText1 = ""
        let mentions1 = []
        for (let i = 0; i < Math.min(35, participants.length); i++) {
            tagText1 += `🌸 @${participants[i].split("@")[0]}\n`
            mentions1.push(participants[i])
        }

        await sock.sendMessage(jid, {
            text: `🏷️✨ *TAGALL MEMBER IMEANZA* ✨🏷️\n\n${tagText1}\n` +
                  `💪 Tunawapenda wote na tunathamini uwepo wenu 💙🌹`,
            mentions: mentions1
        })

        // WAIT 2 MINUTES
        await new Promise(resolve => setTimeout(resolve, 120000))

        // ROUND 2 - TAG 35 AGAIN
        let tagText2 = ""
        let mentions2 = []
        for (let i = 0; i < Math.min(35, participants.length); i++) {
            tagText2 += `🌸 @${participants[i].split("@")[0]}\n`
            mentions2.push(participants[i])
        }

        await sock.sendMessage(jid, {
            text: `🏷️✨ *STIMU ZEXA TZ TAGALL MEMBER INAENDELEA* ✨🏷️\n\n${tagText2}\n` +
                  `💙 Habari zenu wote? Tunawapenda sana 💚🌟`,
            mentions: mentions2
        })

        // WAIT 2 MINUTES
        await new Promise(resolve => setTimeout(resolve, 120000))

        // FINAL ROUND - TAG ALL MEMBERS
        let allTags = ""
        for (const participant of participants) {
            allTags += `🌸 @${participant.split("@")[0]}\n`
        }

        await sock.sendMessage(jid, {
            text: `🏷️✨ *TAGALL MEMBER IMEFANIKIWA VIZURI* ✨🏷️\n\n${allTags}\n` +
                  `💙 TAGALL MEMBER IMEFANIKIWA VIZURI by NEXA TZ LOVE MATCH ZONE ISONGE MBELE 🌹💎\n\n` +
                  `🙏 Asante kwa kushirikiana nasi katika kujenga jamii nzuri ✨`,
            mentions: participants
        })

    } catch (err) {
        console.log("❌ Error in tagall:", err.message)
        send(sock, jid, "❌ TAGALL IMEFELI - Kuna tatizo kwenye system 🌸", m)
    }
}

start()
