const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const qrcode = require("qrcode-terminal")
const cron = require("node-cron") // npm i node-cron

process.setMaxListeners(0)

// ================= 🔥 STABILITY LAYER - FIXED (SINGLE HANDLER) =================
process.on("uncaughtException", err => console.log("🔥 UNCAUGHT:", err))
process.on("unhandledRejection", err => console.log("🔥 UNHANDLED:", err))

// ================= 🔐 BOSS CONFIG - SECURITY SYSTEM =================
const BOSS_NUMBERS = [
    "255779774212",
    "255743834025",
    "255796476676"
]

const OWNER = {
    NAME: "KYC BOSS",
    NUMBERS: BOSS_NUMBERS
}

// ================= HELPERS =================
const jidNum = (s) => {
    try {
        if (!s) return ""
        return String(s).split("@")[0].replace(/[^0-9]/g, "")
    } catch {
        return ""
    }
}

// ================= MEMORY =================
const attempts = new Map()
const seen = new Set()
const sent = new Set()

// 🚦 Control flags
let isTagging = false
let scheduleStarted = false

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

// ================= SECURITY MESSAGE =================
function securityMessage(num, name = "UNKNOWN") {
    return `
╭━━━〔 🔐 SECURITY ALERT - ACCESS DENIED 〕━━━╮
┃ 🚫 SAMAHANI! BOT HII NI YA BOSS PEKEE
┃ 👤 NAME: ${name}
┃ 📱 NUMBER: ${num}
┃ 👑 OWNER: ${OWNER.NAME}
┃ ⚡ SYSTEM: SECURED & ACTIVE
┃ 🔒 UNAJARIBU KUTUMIA BOT BILA RUHSAA
╰━━━━━━━━━━━━━━╯

💎 KWA MSAADA WASILIANA NA BOSS:
📱 255779774212
📱 255743834025
📱 255796476676
`
}

// ================= WEEKLY SCHEDULE =================
const weeklySchedule = {
    0: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 SUNDAY – BLESSINGS DAY 🙏\n\nShukrani, baraka na ujumbe wa moyo 💖\n\n📊 Kila mtu atashare mafanikio yake ya wiki nzima kulingana na malengo yake 🌟\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`,
    1: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 MONDAY – SELF LOVE DAY 💕\n\nJipende, jithamini na anza wiki kwa nguvu 💫\n📝 Share ratiba zako za wiki inayoanza ili tukumbukane kwenye maombi ya kila siku 🙏\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`,
    2: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 TUESDAY – FRIENDSHIP DAY 🤝\n\nTengeneza urafiki mpya na ongea na watu wapya 💬\n📸 Jitambulishe kwenye group (jina, picha na unapoishi) familia LOVE MATCH ZONE tukutambue 💖\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`,
    3: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 WEDNESDAY – LOVE TALK 💘\n\nMada za mahusiano na ushauri wa mapenzi ❤️\n💞 Mpost unayempenda kwa dhati family tumjue wifi au shemeji yetu 😍\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`,
    4: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 THURSDAY – FREE CHAT 💬\n\nOngea chochote kwa heshima na furaha 😊\n📢 Tuma post yako kama utambulisho na kama uko serious kutafuta mpenzi 💌\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`,
    5: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 FRIDAY – FUN DAY 🎉\n\nMichezo, jokes na burudani 😄🔥\n🎯 Pia kutakuwa na maswali na utani kutoka kwa Admin waliopo online 🤩\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`,
    6: `💖🌹 LOVE MATCH ZONE WEEKLY SCHEDULE 🌹💖\n\n━━━━━━━━━━\n\n📅 SATURDAY – MATCH DAY 💞\n\nKutafuta match & connection za kweli 💌\n❤️ Tafuta anayekupenda kwa makubaliano, heshima na utulivu — usilazimishe mapenzi 💫\n\n━━━━━━━━━━\n\n💎 LOVE MATCH ZONE FAMILY 💎\n\n💞 Tunajenga upendo, heshima na furaha pamoja ❤️✨`
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
            console.log("🟢 BOT ONLINE - BOSS SECURED 🔐")
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

    // 📅 DAILY SCHEDULE - FIXED CRON + PM2 GUARD
if (!scheduleStarted && sock) {
    scheduleStarted = true

    cron.schedule("0,30 8-23 * * *", async () => {
        if (sock) await sendDailySchedule(sock)
    }, { timezone: "Africa/Dar_es_Salaam" })

    console.log("📅 DAILY SCHEDULE ACTIVATED - 8:00 to 23:30 every 30min")
}

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

        // 🔐 SECURITY CHECK - BOSS ONLY
        if (!isBoss(sender)) {
            return send(sock, jid, securityMessage(num, "UNKNOWN USER"), m)
        }

        if (msg === "nexa tz" || msg === "nexa" || msg === "Nexa tz") {
            return send(sock, jid, "⚡ NEXA TZ SYSTEM ONLINE (BOSS CONFIRMED 👑) 💎", m)
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

                // ⚡ TAG MEMBERS KWA KUSHUSHA MOJA
                let membersTag = ""
                for (const member of allMembers) {
                    membersTag += `⚡ @${member.split("@")[0]} 🔥\n`
                }

                await sock.sendMessage(jid, {
                    text: `👥✨ *GROUP FULL INFO PREMIUM* ✨👥

📛 Name: ${groupName}

👑 Founder:
⚡ @${owner.split("@")[0]} 🔥

🛡 Admins (${admins.length}):
${admins.map(a => `⚡ @${a.id.split("@")[0]} 🔥`).join("\n")}

👥 Total Members: ${participants.length}

🧾 Description:
${desc}

📜 Rules:
${rules()}

🔗 Group Link:
${inviteLink}

💬 Members Tag (${allMembers.length}):
${membersTag}
⚡ Powered by NEXA TZ BOSS SYSTEM 💎`,
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
            return send(sock, jid, "👋 Nipo online mda wote BOSS 👑 shida nini mkuu?", m)
        }

        // ================= TAGALL SYSTEM - BOSS ONLY =================
        if (msg === "tagall" && jid.endsWith("@g.us")) {
            if (isTagging) {
                return send(sock, jid, "⚠️ TAGALL INAENDELEA SASA HIVI... Subiri iishe kwanza ⏳⚡", m)
            }
            isTagging = true
            await runTagAll(sock, jid, m, sender)
            isTagging = false
        }

    })
}

// ================= TAGALL FUNCTION - BOSS ONLY =================
async function runTagAll(sock, jid, m, sender) {
    try {
        const metadata = await sock.groupMetadata(jid)
        const participants = metadata.participants.map(p => p.id)
        const totalMembers = participants.length
        let taggedCount = 0

        // OMbi la kuanza - Reply kwa BOSS aliyeandika tagall
        await sock.sendMessage(jid, {
            text: `💎✨ *OMBI LAKO LA TAGALL LIMENIFIKIA BOSS* ✨💎\n\n` +
                  `🚀 Naenda kushughulikia ombi lako haraka iwezekanavyo bila kuharibu\n` +
                  `⏳ Subiri dakika 2 naanza kutagi Member ⚡🔥`,
            quoted: m
        })

        // Subiri dakika 2 kabla ya kuanza
        await new Promise(resolve => setTimeout(resolve, 120000))

        // TAG RUNDI KWA RUNDI - 10 KWA 10 - FIXED STABLE LOGIC
        while (taggedCount < totalMembers) {

            const remaining = participants.slice(taggedCount)
            const batch = remaining.slice(0, 10)

            if (batch.length === 0) break

            let tagText = ""

            for (const participant of batch) {
                tagText += `⚡ @${participant.split("@")[0]} 🔥\n`
            }

            await sock.sendMessage(jid, {
                text: `${tagText}\n💙 Habari zenu wapendwa nawatagi kwa sababu naona mko kimya sana hadi aibu tuchangamke jamani 🔥`,
                mentions: batch
            })

            taggedCount += batch.length

            if (taggedCount < totalMembers) {
                await new Promise(resolve => setTimeout(resolve, 120000))
            }
        }

        // MWISHO WA TAGALL
        await sock.sendMessage(jid, {
            text: `🌟✨ *NDUGU YANGU WAPENDWA NIMEMALIZA KUWATAGI* ✨🌟\n\n` +
                  `💙 Natumaini kila mmoja tag yangu imemfikia kwa heshima yako\n` +
                  `🙏 Kama umeona tag yangu please naomba uniambie tag yangu umeiona na hutakua kimya tena\n` +
                  `💎 by Nexa Tz LOVE MATCH ZONE isonge mbele kwa nguvu na umoja tutaweza\n` +
                  `☀️ Nawatakia wakati mwema wote wana family ⚡🔥`
        })

        // MWISHO KWA BOSS ALIYETOA OMBI
        await sock.sendMessage(jid, {
            text: `✅✨ *BOSS OMBI LAKO NIMEFANIKIA KULITIMIZA* ✨✅\n\n` +
                  `🛡️ Kwa usalama na utulivu mkubwa\n` +
                  `🔥 Kutitaji tena kwa wakati mwingine usisite kuniambia\n` +
                  `💙 Nipo mda wote Asante 24/7 👑⚡`,
            quoted: m
        })

    } catch (err) {
        console.log("❌ Error in tagall:", err.message)
        send(sock, jid, "❌ TAGALL IMEFELI - Kuna tatizo kwenye system ⚡", m)
        isTagging = false
    }
}

// ================= DAILY SCHEDULE FUNCTION =================
async function sendDailySchedule(sock) {
    try {
        const chats = Object.keys(await sock.groupFetchAllParticipating())
        if (chats.length === 0) return

        const today = new Date().getDay() // 0 = Jumapili, 1 = Jumatatu... 6 = Jumamosi
        const schedule = weeklySchedule[today]

        for (const groupId of chats) {
            await sock.sendMessage(groupId, {
                text: `📅✨ *RATIBA YA LEO* ✨📅\n\n${schedule}`
            })
        }
    } catch (err) {
        console.log("❌ Error in daily schedule:", err.message)
    }
}

start().catch(err => console.log("❌ Fatal error:", err))
