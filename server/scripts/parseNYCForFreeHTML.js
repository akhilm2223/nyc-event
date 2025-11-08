import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, '../../events.json');

// NYC for FREE events extracted from the website (November 2025)
const nycForFreeEvents = [
  // November 8
  {
    name: "Champs Run Club New York City November 8",
    date: "Friday, November 8, 2025",
    time: "8:00 AM",
    location: "10 Times Square, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Grown Alchemist at ANSA Coffee",
    date: "Friday, November 8, 2025",
    time: "9:00 AM",
    location: "101 Thompson Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Rockefeller Center Meet the Tree Day",
    date: "Friday, November 8, 2025",
    time: "10:00 AM",
    location: "45 Rockefeller Plaza, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "CUUP Holiday Pop-Up",
    date: "Friday, November 8, 2025",
    time: "11:00 AM",
    location: "262 Mott Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "AESTURA Capsule Cart Pop-Up",
    date: "Friday, November 8, 2025",
    time: "12:00 PM",
    location: "New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "The K-Beauty Drop by EARLYANCE",
    date: "Friday, November 8, 2025",
    time: "12:00 PM",
    location: "12 Saint Marks Place, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "P.F. Candle Co. X Grillo's Pickles Launch Event",
    date: "Friday, November 8, 2025",
    time: "3:00 PM",
    location: "63 North 3rd Street, Brooklyn, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 9
  {
    name: "Gotham FC Quarterfinal Watch Party",
    date: "Saturday, November 9, 2025",
    time: "12:00 PM",
    location: "6 West 33rd Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Stanley x LoveShackFancy Frosty & Fancy Pop-Up Shop",
    date: "Saturday, November 9, 2025",
    time: "12:00 PM",
    location: "45 Rockefeller Plaza, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "K-Jewelry House NYC hosted by Atelier Darin",
    date: "Saturday, November 9, 2025",
    time: "1:00 PM",
    location: "12 Saint Marks Place, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Sundays by KFC",
    date: "Saturday, November 9, 2025",
    time: "1:00 PM",
    location: "242 East 14th Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "THE RUNNING MAN New York Premiere",
    date: "Saturday, November 9, 2025",
    time: "7:00 PM",
    location: "AMC Lincoln Square, 1998 Broadway, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 10
  {
    name: "Holiday Under the Stars: Columbus Circle",
    date: "Sunday, November 10, 2025",
    time: "10:00 AM",
    location: "10 Columbus Circle, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "NOW YOU SEE ME: NOW YOU DON'T Advance Screening",
    date: "Sunday, November 10, 2025",
    time: "7:00 PM",
    location: "AMC Loews Lincoln Square 13, 1998 Broadway, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 11
  {
    name: "PLAYDATE Advance Screening",
    date: "Monday, November 11, 2025",
    time: "7:00 PM",
    location: "AMC Empire, 234 West 42nd Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Brooklyn Nets NYC for FREE Night: Biggie Night",
    date: "Monday, November 11, 2025",
    time: "7:30 PM",
    location: "Barclays Center, 620 Atlantic Avenue, Brooklyn, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 12
  {
    name: "Olay + Secret x Wicked: For Good Beauty Lab",
    date: "Tuesday, November 12, 2025",
    time: "11:30 AM",
    location: "393 Broadway, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 13
  {
    name: "New York Transit Museum Holiday Train Show",
    date: "Wednesday, November 13, 2025",
    time: "1:00 AM",
    location: "89 East 42nd Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "V8 Energy Orchard",
    date: "Wednesday, November 13, 2025",
    time: "10:00 AM",
    location: "220-200 West 33rd Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 14
  {
    name: "Grillo's Pickles National Pickle Party",
    date: "Thursday, November 14, 2025",
    time: "2:00 PM",
    location: "Bar Snack, 92 2nd Avenue, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Sea Candy Co - Tide of Thanks Pop-Up",
    date: "Thursday, November 14, 2025",
    time: "4:00 PM",
    location: "48 Ludlow Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 15
  {
    name: "Express Pop-Up at Iconic Magazines",
    date: "Friday, November 15, 2025",
    time: "7:00 AM",
    location: "188 Mulberry Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Voluspa Holiday Café",
    date: "Friday, November 15, 2025",
    time: "8:00 AM",
    location: "120 Thompson St, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Boris & Horton X MyPetsQR",
    date: "Friday, November 15, 2025",
    time: "10:00 AM",
    location: "195 Avenue A, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Manhattan Walk to End Alzheimer's",
    date: "Friday, November 15, 2025",
    time: "10:00 AM",
    location: "West 72nd Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Lipault Paris x Lil Sweet Treat Pop-Up",
    date: "Friday, November 15, 2025",
    time: "11:00 AM",
    location: "184 7th Avenue South, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Modelones 10-Year On the GO NYC Pop-Up",
    date: "Friday, November 15, 2025",
    time: "12:00 PM",
    location: "210 Spring Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "The Hidden Valley Ranch Tiny Restaurant Pop-Up",
    date: "Friday, November 15, 2025",
    time: "12:00 PM",
    location: "15 West 28th Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 17
  {
    name: "Wedding Salon NYC November 17",
    date: "Sunday, November 17, 2025",
    time: "5:00 PM",
    location: "Infinity Mega Yacht, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 20
  {
    name: "Diamond Crystal Salt House of Brining",
    date: "Wednesday, November 20, 2025",
    time: "12:00 PM",
    location: "95 Rivington Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // November 21-22
  {
    name: "Tree Hut Dancin' Queen Ice Skating Pop-Up",
    date: "Friday, November 21, 2025",
    time: "2:30 PM",
    location: "Domino Park, 15 River Street, Brooklyn, NY",
    link: "https://www.nycforfree.co/events"
  },
  
  // Multi-day/ongoing events
  {
    name: "La Beauté Louis Vuitton Pop-Up",
    date: "Saturday, August 30, 2025",
    time: "11:00 AM",
    location: "104 Prince Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Nature Made Wellness Experience at TENSPACE",
    date: "Saturday, October 11, 2025",
    time: "11:00 AM",
    location: "434 Broadway, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Genesis House CHROMA: Tales Between Hues",
    date: "Thursday, October 23, 2025",
    time: "11:00 AM",
    location: "40A 10th Avenue, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Medik8 x OM Juice Pop Up Juice Cart",
    date: "Wednesday, October 29, 2025",
    time: "11:00 AM",
    location: "New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Brookfield Place Canstruction 2025",
    date: "Thursday, October 30, 2025",
    time: "10:00 AM",
    location: "Brookfield Place, 230 Vesey Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Guerlain Shalimar Exhibition",
    date: "Wednesday, November 5, 2025",
    time: "10:00 AM",
    location: "303 Park Avenue, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Gap x Stranger Things Claw Machine",
    date: "Thursday, November 6, 2025",
    time: "10:00 AM",
    location: "1514 Broadway, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Kiehl's Holiday Season Givebacks",
    date: "Friday, November 7, 2025",
    time: "8:00 AM",
    location: "New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Back Market Bytes for Bites",
    date: "Friday, November 7, 2025",
    time: "11:00 AM",
    location: "449 Broadway, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Stranger Things Radio Room",
    date: "Friday, November 7, 2025",
    time: "11:00 AM",
    location: "22 Little West 12th Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "The Glowcery by Mizz Korea",
    date: "Friday, November 7, 2025",
    time: "11:00 AM",
    location: "188 Lafayette St., SoHo, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Dr. Martens' Wear The Weather Retail Experience",
    date: "Friday, November 7, 2025",
    time: "11:00 AM",
    location: "193 Bedford Avenue, Brooklyn, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "AERIN x GLACE Pop-Up",
    date: "Friday, November 7, 2025",
    time: "12:00 PM",
    location: "50th Street between 5th & 6th Avenues, New York, NY",
    link: "https://www.nycforfree.co/events"
  },
  {
    name: "Divine Theories at RIVAA Gallery",
    date: "Friday, November 7, 2025",
    time: "6:00 PM",
    location: "527 Main Street, New York, NY",
    link: "https://www.nycforfree.co/events"
  }
];

// Load existing events
let existingEvents = [];
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    const fileContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
    existingEvents = JSON.parse(fileContent);
    console.log(`📂 Loaded ${existingEvents.length} existing events`);
  } catch (error) {
    console.error('⚠️ Error reading existing events file:', error.message);
  }
}

// Merge NYC for FREE events with existing events
console.log(`\n🔄 Adding ${nycForFreeEvents.length} NYC for FREE events...`);

// Simple duplicate check by name and date
const merged = [...existingEvents];
for (const newEvent of nycForFreeEvents) {
  const exists = merged.some(e => 
    e.name.toLowerCase() === newEvent.name.toLowerCase() && 
    e.date === newEvent.date
  );
  if (!exists) {
    merged.push(newEvent);
  }
}

// Save to JSON file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf8');
console.log(`\n💾 Saved ${merged.length} total events to events.json`);
console.log(`✅ Added ${merged.length - existingEvents.length} new NYC for FREE events`);

