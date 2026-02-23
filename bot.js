const { Client, IntentsBitField, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

// ============================================
// ฟังก์ชันวิเคราะห์ข้อมูล
// ============================================
function parseUserInput(message) {
  const parts = message.trim().split(/\s+/);
  
  const data = {
    เฟสผู้เช่า: "",
    วันที่ใช้: "",
    วันที่ส่งกลับ: "",
    ชุดที่เช่า: "",
    การใช้งาน: "",
    สถานะโอน: "",
    สถานะส่งไป: "",
    เลขแทร็กขนส่ง: "",
    เพิ่มเติม: ""
  };

  const validUsage = ["เทส", "ไพร"];
  const validSets = ["Hysilens","Cyrane","Chisa","Lynea","Waguri","Cerydra"];

  let datePattern = /(\d{1,2}(-\d{1,2})?\/\d{1,2}\/\d{2})/g;
  let dates = message.match(datePattern) || [];

  if (parts.length > 0) {
    data.เฟสผู้เช่า = parts[0];
  }

  for (let part of parts) {
    if (validUsage.includes(part)) {
      data.การใช้งาน = part;
      break;
    }
  }

  for (let part of parts) {
    if (validSets.includes(part)) {
      data.ชุดที่เช่า = part;
      break;
    }
  }

  if (dates.length >= 1) {
    data.วันที่ใช้ = dates[0];
  }
  if (dates.length >= 2) {
    data.วันที่ส่งกลับ = dates[1];
  }

  return data;
}

// ============================================
// ฟังก์ชันเพิ่มข้อมูลลง Google Sheets
// ============================================
async function addDataToSheet(data) {
  try {
    const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;
    
    if (!SHEETS_ID || !API_KEY) {
      console.error('❌ Missing GOOGLE_SHEETS_ID or GOOGLE_API_KEY');
      return false;
    }

    const newRow = [
      data.เฟสผู้เช่า || '',
      data.วันที่ใช้ || '',
      data.วันที่ส่งกลับ || '',
      data.ชุดที่เช่า || '',
      data.การใช้งาน || '',
      data.สถานะโอน || '',
      data.สถานะส่งไป || '',
      data.เลขแทร็กขนส่ง || '',
      data.เพิ่มเติม || ''
    ];

    await axios.post(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/Sheet1!A:I:append?valueInputOption=RAW&key=${API_KEY}`,
      { values: [newRow] }
    );

    console.log('✅ เพิ่มข้อมูลลง Google Sheets สำเร็จ');
    return true;
  } catch (error) {
    console.error('❌ เพิ่มข้อมูลล้มเหลว:', error.response?.data?.error?.message || error.message);
    return false;
  }
}

// ============================================
// Discord Bot Events
// ============================================
client.on('clientReady', () => {
  console.log(`✅ Bot พร้อม! ลงชื่อเข้าเป็น ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // คำสั่ง !add
  if (message.content.startsWith('!add')) {
    const userInput = message.content.slice(5).trim();

    if (!userInput) {
      return message.reply('❌ กรุณาใส่ข้อมูล: `!add ชื่อ การใช้งาน ชุด วันที่ใช้ วันที่คืน`');
    }

    // วิเคราะห์ข้อมูล
    const data = parseUserInput(userInput);

    // ส่ง JSON กลับไป
    const jsonResponse = JSON.stringify(data, null, 2);
    
    const embed = new EmbedBuilder()
      .setTitle('📊 ข้อมูลที่รับ')
      .setDescription(`\`\`\`json\n${jsonResponse}\n\`\`\``)
      .setColor('Green')
      .setFooter({ text: 'กำลังเพิ่มลง Google Sheets...' });

    await message.reply({ embeds: [embed] });

    // เพิ่มลง Google Sheets
    const success = await addDataToSheet(data);

    if (success) {
      await message.reply('✅ **เพิ่มข้อมูลลง Google Sheets สำเร็จ!**');
    } else {
      await message.reply('❌ **เพิ่มข้อมูลล้มเหลว!**');
    }
  }

  // คำสั่ง !help
  if (message.content === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📖 วิธีใช้ Sheets Bot')
      .setDescription('**คำสั่งที่ใช้ได้:**')
      .addFields(
        { name: '!add [ข้อมูล]', value: 'เพิ่มข้อมูลลง Google Sheets\nตัวอย่าง: `!add Yanisa เทส Hysilens 28-29/3/26 30/3/26`' },
        { name: '!help', value: 'แสดงความช่วยเหลือ' }
      )
      .setColor('Blue');

    await message.reply({ embeds: [helpEmbed] });
  }
});

// ============================================
// เริ่มต้น Bot
// ============================================
client.login(process.env.DISCORD_TOKEN);
