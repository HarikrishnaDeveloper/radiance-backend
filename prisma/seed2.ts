import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const questions = [
  {
    text: "Which among the following is/are the objective(s) of the Rainfed Area Development (RAD) initiative under the National Mission for Sustainable Agriculture (NMSA)?\nEncouraging monoculture in rainfed areas\nIncreasing rice cultivation in irrigated regions\nEnhancing productivity and minimising climatic risks through Integrated Farming Systems (IFS)",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "d"
  },
  {
    text: "Which of the following is/are the most significant implication(s) of obtaining Oeko-Tex certification for Eri Silk in the global textiles industry?\nIt allows Indian exporters to compete in high-end markets that prioritise chemical-free products.\nIt confirms that Eri Silk meets international safety, environmental and quality standards, enabling its entry into premium eco-conscious markets.",
    optionA: "(a) 1 only",
    optionB: "(b) 2 only",
    optionC: "(c) Both 1 and 2",
    optionD: "(d) Neither 1 nor 2",
    correctAnswer: "c"
  },
  {
    text: "Ships from which of the following countries have to cross the Strait of Hormuz to reach out to the Indian Ocean?\nBahrain\nSyria\nQatar\nEgypt",
    optionA: "(a) 1 and 2",
    optionB: "(b) 1 and 3",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 and 4",
    correctAnswer: "b"
  },
  {
    text: "Tungurahua Volcano, which was declared a Global Geopark by UNESCO in 2025, is situated in which one among the following countries?",
    optionA: "(a) Ecuador",
    optionB: "(b) Peru",
    optionC: "(c) Bolivia",
    optionD: "(d) Colombia",
    correctAnswer: "d"
  },
  {
    text: "With reference to Madhav National Park, which of the following statements is/are correct?\nIt was declared a Tiger Reserve in India in 2025.\nSakhya Sagar, which is designated as a Ramsar Site, is situated within this National Park.\nIts area is shared between Madhya Pradesh and Rajasthan.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "b"
  },
  {
    text: "With reference to the climate of Andaman and Nicobar Islands, which of the following statements is/are correct?\nThe climate can be defined as a humid, tropical coastal climate.\nIt receives rainfall from both South-west monsoon and North-east monsoon.\nMaximum precipitation is between December and May.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "d"
  },
  {
    text: "Which of the following geographical features or phenomena is/are associated with the Peninsular Block of India?\nSubmergence of parts of the western coast due to tectonic activity.\nPresence of residual mountain ranges such as the Veliconda Hills and Mahendragiri Hills.\nDeep, V-shaped river valleys formed by fast-flowing rivers.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "b"
  },
  {
    text: "Consider the following statements with reference to the Sagarmala Programme of the Government of India:\nI. The Sagarmala Programme seeks to achieve port-led economic growth through cost-effective and sustainable coastal infrastructure.\nII. The success of the Sagarmala Programme is reflected in significant growth in coastal and inland waterway shipping, along with improved global port rankings.\nIII. Sagarmala 2.0 aims to position India as a global maritime innovation hub aligned with Atmanirbhar Bharat and Viksit Bharat 2047 visions.\nWhich of the following relationships among the above statements is/are correct?\nStatement II validates the effectiveness of the strategies envisioned in Statement I.\nStatement III extends the objectives of Statement I by embedding them into a future-oriented innovation framework.\nStatement I contradicts Statement III by focusing only on traditional infrastructure instead of modern innovation.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "b"
  },
  {
    text: "Consider the following statements about Rhynchostylis retusa (Foxtail Orchid):\nIt is an epiphytic orchid.\nThe species is endemic to North-east India.\nIt is the State flower of Arunachal Pradesh and Assam.\nWhich of the statements given above is/are correct?",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 3",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "a"
  },
  {
    text: "Which one of the following statements with regard to the Moidams, built by the Tai-Ahom kingdom and inscribed as a World Heritage Site by UNESCO, is/are correct?\nThey acted as army fortresses.\nThey were recreation centres of the Royals and Nobles.\nThey were burial grounds of the Royals and Nobles.\nThey were battle drill centres of the Royals and Nobles.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 3",
    optionC: "(c) 3 only",
    optionD: "(d) 2 and 4",
    correctAnswer: "c"
  },
  {
    text: "At the United Nations Ocean Conference (UNOC) held in June 2025 in France, the Food and Agriculture Organization (FAO) of the United Nations demonstrated its leading voice on marine and ocean issues, especially on sustainable fisheries and aquaculture for resilient livelihood and \"Blue Transformation\".\nWhich of the following combinations about the \"Four Betters\" proposed by FAO for \"Blue Transformation\" is correct?",
    optionA: "(a) Better production, better nutrition, better environment and better ocean",
    optionB: "(b) Better production, better nutrition, better environment and better life",
    optionC: "(c) Better coral reefs, better nutrition, better environment and better life",
    optionD: "(d) Better estuaries, better nutrition, better environment and better mangrove vegetation",
    correctAnswer: "b"
  },
  {
    text: "Which of the following statements with reference to Lake Turkana is/are correct?\nIt is the largest desert lake in the world.\nThe lake is situated in South Sudan along the eastern fringe of the Sahara Desert.\nThe lake is listed as a UNESCO World Heritage Site and is also referred to as the \"Jade Sea\".",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 3 only",
    optionC: "(c) 2 and 3 only",
    optionD: "(d) 1, 2 and 3",
    correctAnswer: "b"
  },
  {
    text: "Which one of the following is the first Plan Vivo certified Reducing Emissions from Deforestation and Forest Degradation (REDD+) project in India?",
    optionA: "(a) Uttarakhand REDD+ project",
    optionB: "(b) ICFRE-ICIMOD Transboundary REDD+ project in North-Eastern Himalayas",
    optionC: "(c) Khasi Hills Community REDD+ project",
    optionD: "(d) Sikkim Mamley Kamrang Community REDD+ project",
    correctAnswer: "c"
  },
  {
    text: "Consider the following statements with reference to India's response to climate change:\nI. India's Long-Term Low Emission Development Strategy (LT-LEDS) is a crucial tool for achieving net-zero emissions by 2070.\nII. India's 4th Biennial Update Report (BUR-4) submitted in December, 2024 recorded around 8% decrease in Greenhouse gas emissions in 2020 over 2019.\nIII. Climate-resilient development necessarily depends on quick and short-term achievement of emission reduction targets.\nWhich of the following relationships among the above statements is/are correct?\nStatement I is empirically supported by Statement II.\nStatement III contradicts the approach implicit in Statement I.\nStatement I and Statement III together establish the premise of long-term sustainability.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "c"
  },
  {
    text: "With respect to the Western Hoolock Gibbons, which of the following statements is/are correct?\nA Sanctuary in North-east India is home to this ape species listed as Endangered in the International Union for Conservation of Nature (IUCN) Red List.\nThey have specialized brachiation and can easily swing between trees.\nThey possess a strong and heavy build like gorillas, yet are remarkably agile tree climbers.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "b"
  },
  {
    text: "Which of the following best explain(s) the rationale for protecting mangrove ecosystems in the context of climate resilience?\nMangroves reduce tidal energy and store freshwater, making them ideal sites for paddy cultivation in saline estuarine belts.\nTheir salt-sensitive roots filter seawater, making mangroves key to converting coastal land into freshwater aquaculture zones.\nBy withstanding tidal surges and offering biomass resources, mangroves function both as natural bio-shields and livelihood bases for rural communities.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "d"
  },
  {
    text: "In what way(s) does the Vizhinjam International Seaport represent a structural shift in India's maritime trade and logistics policy?\nBy functioning exclusively as a domestic cargo hub to reduce reliance on coastal shipping and eliminate the need for foreign collaborations.\nBy focusing primarily on passenger cruise tourism and heritage shipping to increase Kerala's profile as a maritime heritage destination.\nBy leveraging its natural deep draft and strategic location to reduce dependence on foreign trans-shipment ports, enhance revenue retention, and reposition India in regional maritime trade.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "d"
  },
  {
    text: "Identify the river of the Indian sub-continent on the basis of the following information:\nIt has an antecedent drainage system.\nIt flows through three countries.\nIt originates in the Tibetan Plateau and is an important river for irrigation.\nIt does not form distributaries.",
    optionA: "(a) Brahmaputra",
    optionB: "(b) Indus",
    optionC: "(c) Sutlej",
    optionD: "(d) Teesta",
    correctAnswer: "c"
  },
  {
    text: "Which of the following with reference to Indian States is/are not correct?\nUttar Pradesh shares its boundary with the highest number of other Indian States.\nRajasthan shares the longest international border among all Indian States.\nSikkim is the only State that shares its boundary with just one other Indian State.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "c"
  },
  {
    text: "Which of the following statements with regard to the arrival of Amur Falcons at Doyang Lake in Nagaland each year from Mongolia is/are correct?\nIt showcases how sustained local conservation efforts can contribute to the arrival and protection of international migratory birds.\nIt reflects the global success of advanced tracking technologies that guide migratory birds back to their stopover sites.\nIt confirms that Amur Falcons have adapted to permanent residency in India due to favourable habitat changes.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "a"
  }
];

async function main() {
  console.log('Start seeding batch 2...');
  let i = 0;
  for (const q of questions) {
    const question = await prisma.question.create({
      data: q,
    });
    i++;
    console.log(`Created question with id: ${question.id}`);
  }
  console.log(`Seeding finished. Inserted ${i} questions.`);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
