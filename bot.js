
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
// ตั้งค่า Google Sheets
// ============================================
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);

async function initializeSheet() {
  try {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();
    console.log('✅ Google Sheets เชื่อมต่อสำเร็จ');
  } catch (error) {
    console.error('❌ เชื่อมต่อ Google Sheets ล้มเหลว:', error.message);
  }
}

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
  const validSets = ["Hysilens","Cyrane","Chisa","Lynea","Waguri","Cerydra",];

  // ค้นหาวันที่
  let datePattern = /(\d{1,2}(-\d{1,2})?\/\d{1,2}\/\d{2})/g;
let dates = message.match(datePattern) || [];
  // บันทึกชื่อผู้เช่า (ตัวแรก)
  if (parts.length > 0) {
    data.เฟสผู้เช่า = parts[0];
  }

  // หาการใช้งาน
  for (let part of parts) {
    if (validUsage.includes(part)) {
      data.การใช้งาน = part;
      break;
    }
  }

  // หาชุดที่เช่า
  for (let part of parts) {
    if (validSets.includes(part)) {
      data.ชุดที่เช่า = part;
      break;
    }
  }

  // หาวันที่
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
    const sheet = doc.sheetsByTitle["Sheet1"];
    
    if (!sheet) {
      console.error('❌ ไม่พบ Sheet "Sheet1"');
      return false;
    }

    // ตรวจสอบว่า Header มีไหม ถ้าไม่มีให้สร้าง
    const rows = await sheet.getRows();
    
    if (rows.length === 0) {
      // ถ้าไม่มี row เลย ให้เพิ่ม Header ก่อน
      await sheet.setHeaderRow([
        'เฟสผู้เช่า', 
        'วันที่ใช้', 
        'วันที่ส่งกลับ', 
        'ชุดที่เช่า', 
        'การใช้งาน', 
        'สถานะโอน', 
        'สถานะส่งไป', 
        'เลขแทร็กขนส่ง', 
        'เพิ่มเติม'
      ]);
    }

    // เพิ่มแถวข้อมูลใหม่ (จะเพิ่มหลัง Header อัตโนมัติ)
    await sheet.addRow({
      'เฟสผู้เช่า': data.เฟสผู้เช่า || '',
      'วันที่ใช้': data.วันที่ใช้ || '',
      'วันที่ส่งกลับ': data.วันที่ส่งกลับ || '',
      'ชุดที่เช่า': data.ชุดที่เช่า || '',
      'การใช้งาน': data.การใช้งาน || '',
      'สถานะโอน': data.สถานะโอน || '',
      'สถานะส่งไป': data.สถานะส่งไป || '',
      'เลขแทร็กขนส่ง': data.เลขแทร็กขนส่ง || '',
      'เพิ่มเติม': data.เพิ่มเติม || ''
    });

    console.log('✅ เพิ่มข้อมูลลง Google Sheets สำเร็จ');
    return true;
  } catch (error) {
    console.error('❌ เพิ่มข้อมูลล้มเหลว:', error.message);
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
        { name: '!add [ข้อมูล]', value: 'เพิ่มข้อมูลลง Google Sheets\nตัวอย่าง: `!add Yanisa เทส Hysilens 14-15/2/26 16/2/26`' },
        { name: '!help', value: 'แสดงความช่วยเหลือ' }
      )
      .setColor('Blue');

    await message.reply({ embeds: [helpEmbed] });
  }
});

// ============================================
// เริ่มต้น Bot
// ============================================
initializeSheet();
client.login(process.env.DISCORD_TOKEN);

