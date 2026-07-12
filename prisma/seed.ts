import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const questions = [
  {
    text: "Which one of the following Carnatic music ragas is similar to Raga Bilawal in Hindustani music?",
    optionA: "(a) Nat Bhairavi",
    optionB: "(b) Kamavardhini",
    optionC: "(c) Hanumatodi",
    optionD: "(d) Dheera Shankarabharanam",
    correctAnswer: "d"
  },
  {
    text: "The artificially fixed rupee-sterling exchange rate prescribed by the Hilton-Young Commission (1926) was adopted by the British Government for which one of the following reasons?",
    optionA: "(a) Aiding the flow of remittances from India and maintaining India's creditworthiness",
    optionB: "(b) Providing support to Indian importers",
    optionC: "(c) Encouraging export of cotton produce from India",
    optionD: "(d) Preventing depreciation of the Rupee in terms of gold",
    correctAnswer: "a"
  },
  {
    text: "Consider the following statements:\nI. Pali texts contain the first definite references to coins, e.g., kahapana, nikkha, kamsa, and kakanika.\nII. The literary evidence from Pali texts is corroborated by archaeological evidence of punch-marked coins from many sites, most of them made of silver.\nThe above statements have been associated with which of the following?\nEmergence of urban life\nTransition to money economy",
    optionA: "(a) 1 only",
    optionB: "(b) 2 only",
    optionC: "(c) Both 1 and 2",
    optionD: "(d) Neither 1 nor 2",
    correctAnswer: "b"
  },
  {
    text: "Which of the following temples has/have a Nagara-style shikhara?\nMalegitti Shivalaya, Badami\nHuchimalligudi Temple, Aihole\nDashavatara Temple, Deogarh\nVirupaksha Temple, Pattadakal",
    optionA: "(a) 1 and 2",
    optionB: "(b) 2 and 3",
    optionC: "(c) 3 only",
    optionD: "(d) 3 and 4",
    correctAnswer: "c"
  },
  {
    text: "Among the four main forms of existence of life recognized in Jainism, which one of the following is not included?",
    optionA: "(a) Deva (gods)",
    optionB: "(b) Yaksha (demi-gods)",
    optionC: "(c) Manushya (humans)",
    optionD: "(d) Tiryancha (animals and plants)",
    correctAnswer: "b"
  },
  {
    text: "The Hallisalasa painting in the Bagh Caves represents:",
    optionA: "(a) A joyous folk dance",
    optionB: "(b) Buddha in a meditative pose",
    optionC: "(c) The depiction of Shiva and Parvati on Kailasha",
    optionD: "(d) Samudramanthan (Churning of the Ocean)",
    correctAnswer: "a"
  },
  {
    text: "Consider the following statements relating to the use of the place-value system in India:\nThe earliest epigraphic use of the place-value system in India is found in the Mankani plates from Gujarat (AD 595-596).\nIn the ninth century, place-values become general in inscriptions all over India.\nThe place-values have been found in Sanskrit inscriptions in South-east Asia as early as the seventh century.\nWhich of the statements given above are correct?",
    optionA: "(a) 1 and 2 only",
    optionB: "(b) 1 and 3 only",
    optionC: "(c) 2 and 3 only",
    optionD: "(d) 1, 2 and 3",
    correctAnswer: "d"
  },
  {
    text: "Consider the following statements about the archaeological findings in Harappan towns:\nI. There is wide occurrence of spindle-whorls in the houses but absence of spinning wheels.\nII. Weights and measurement scales, complete with graduations have been discovered.\nIII. There are houses built in large part with baked bricks, around relatively spacious courtyards, with their own wells, bathing platforms, and large rooms.\nWhich of the following inferences can be drawn from the above statements?\nStatement I suggests that spinning was a laborious activity done at home.\nStatement II suggests the extent of the scientific knowledge that the Harappans possessed.\nStatement III suggests the emergence of a common property system.",
    optionA: "(a) 1 and 2 only",
    optionB: "(b) 2 and 3 only",
    optionC: "(c) 1 and 3 only",
    optionD: "(d) 1, 2 and 3",
    correctAnswer: "a"
  },
  {
    text: "Which one of the following statements about the Eka Movement and Bardoli Satyagraha is correct?",
    optionA: "(a) The Eka Movement was throughout supported and organized by the Congress while Bardoli Satyagraha was initially independent of Congress influence and was only in the last stages supported by the Congress.",
    optionB: "(b) The Eka Movement was provided leadership by the taluqdars of Awadh, whereas the Bardoli Satyagraha was a movement of the landless labourers.",
    optionC: "(c) The Bardoli Satyagraha was a campaign against the enhancement of land revenue, while the Eka Movement was a protest against excessive extraction of rents.",
    optionD: "(d) The Eka Movement was located in the Varanasi and Mirzapur districts of the present-day U.P., while the Bardoli Satyagraha took place in Saurashtra.",
    correctAnswer: "c"
  },
  {
    text: "Consider the following statements about the Rigvedic period:\nI. Irrigation from wells allowed agriculture to expand away from flood plains and strips on river margins into the present Punjab and Haryana plains having underground water levels reasonably close to the surface.\nII. Draught-animal power was employed to draw up water out of the wells.\nWhich of the following information support/supports the above statements?\nThere is evidence in the Rigveda of the use of ashma chakra (stone pulley wheel) and ahava (strapped wooden pails) to draw up water.\nMention has been made in the Rigveda of the use of implements like parashu/kulisha (axe) and datra/sreni (sickle).\nThere is a history of the use of ox, even before the Rigveda, for ploughing the land and pulling the carts.",
    optionA: "(a) 1 and 2 only",
    optionB: "(b) 1, 2 and 3",
    optionC: "(c) 1 and 3 only",
    optionD: "(d) 3 only",
    correctAnswer: "a"
  },
  {
    text: "Consider the following assertion: In the Pleistocene period either the Yamuna once flowed into the Indus, or the Sutlej flowed into the Yamuna and one major tributary of either had shifted from the Ganga to the Indus or vice versa.\nWhich of the following is/are the basis of the above assertion?\nThe Nadi-Sukta of the Rigveda\nThe explorations of the Sutlej and the Yamuna by Robert Bruce Foote\nThe presence of the same species of dolphins in both the Indus and the Ganga river systems",
    optionA: "(a) 1 only",
    optionB: "(b) 2 only",
    optionC: "(c) 1 and 2",
    optionD: "(d) 3",
    correctAnswer: "a"
  },
  {
    text: "What does an empty seat represent in early Buddhist iconography?",
    optionA: "(a) The meditation of the Buddha",
    optionB: "(b) The Buddha's First Sermon",
    optionC: "(c) The Buddha's Mahaparinibbana",
    optionD: "(d) The Buddha's Mahabhinishkramana",
    correctAnswer: "c"
  },
  {
    text: "Which of the following pairs of ancient and modern names of rivers is/are correctly matched?\nVitasta : Chenab\nAsikni : Jhelum\nParushni : Ravi\nYavyavati : Beas",
    optionA: "(a) 1 and 2",
    optionB: "(b) 3 and 4",
    optionC: "(c) 3 only",
    optionD: "(d) 4 only",
    correctAnswer: "b"
  },
  {
    text: "Which of the following statements on the Amaravati Stupa and its relief sculpture is/are correct?\nIt was located in the lower Krishna valley.\nIn India, it was next only to the Sanchi Stupa in size.\nThe Amaravati school of sculpture made a lasting impact on the later South Indian sculpture, and its products were carried to Sri Lanka and South-east Asia.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 3 only",
    optionC: "(c) 2 and 3 only",
    optionD: "(d) 1, 2 and 3",
    correctAnswer: "b"
  },
  {
    text: "Which of the following pairs of the king and his dynasty in early historical Tamilakam is/are not correctly matched?\nSenguttuvan : Chera\nUdiyanjeral : Chola\nNedunjeliyan : Pandya",
    optionA: "(a) 1 and 2",
    optionB: "(b) 2 only",
    optionC: "(c) 1 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "b"
  },
  {
    text: "Which of the following factors contributed to the formation of the Forward Bloc by Subhas Chandra Bose in 1939?\nBose failed to win the confidence of Mahatma Gandhi.\nThe Congress Left was disunited and failed to support Bose.\nThe Communists did not support Bose in his endeavours.\nThe supporters of M.N. Roy and socialist leaders like Jayaprakash Narayan preferred Congress unity to supporting Bose.",
    optionA: "(a) 1, 2 and 3",
    optionB: "(b) 1, 2 and 4",
    optionC: "(c) 1, 3 and 4",
    optionD: "(d) 2 and 4 only",
    correctAnswer: "b"
  },
  {
    text: "Consider the following statements regarding the British policy in Awadh immediately after its annexation in 1856:\nThe taluqdars were dispossessed of their estates but allowed to retain their arms and forts.\nA Summary Revenue Settlement was made in 1856 assuming that the taluqdars were outsiders.\nThe British believed in taking revenue directly from the peasants by removing the taluqdars.\nWhich of the statements given above is/are correct?",
    optionA: "(a) 2 and 3 only",
    optionB: "(b) 1 and 3 only",
    optionC: "(c) 1, 2 and 3",
    optionD: "(d) 2 only",
    correctAnswer: "a"
  },
  {
    text: "Consider the following assertion:\nThe genesis of political alliances based on community lay in the very nature of the Montague-Chelmsford Reforms, 1919.\nWhich of the following statements support/supports the above assertion?\nReforms retained and extended the principle of separate electorates.\nSeparate electorates were supposed to counter Indian nationalism, which was growing stronger.\nDeprived classes rallied around the favours inherent in separate electorates.",
    optionA: "(a) 1 only",
    optionB: "(b) 2 and 3 only",
    optionC: "(c) 1 and 2 only",
    optionD: "(d) 1, 2 and 3",
    correctAnswer: "a"
  },
  {
    text: "Pandit Mallikarjun Mansur, the famous classical singer from Karnataka, represented the:",
    optionA: "(a) Agra Gharana",
    optionB: "(b) Gwalior Gharana",
    optionC: "(c) Patiala Gharana",
    optionD: "(d) Jaipur-Atrauli Gharana",
    correctAnswer: "d"
  },
  {
    text: "In which one among the following texts does the term kshetra-patni ('mistress of the field') originate?",
    optionA: "(a) Rigveda",
    optionB: "(b) Atharvaveda",
    optionC: "(c) Ashtadhyayi",
    optionD: "(d) Arthashastra",
    correctAnswer: "b"
  },
  {
    text: "Consider the following statements with reference to India's response to climate change:\nI. India's Long-Term Low Emission Development Strategy (LT-LEDS) is a crucial tool for achieving net-zero emissions by 2070.\nII. India's 4th Biennial Update Report (BUR-4) submitted in December, 2024 recorded around 8% decrease in Greenhouse gas emissions in 2020 over 2019.\nIII. Climate-resilient development necessarily depends on quick and short-term achievement of emission reduction targets.\nWhich of the following relationships among the above statements is/are correct?\nStatement I is empirically supported by statement II.\nStatement III contradicts the approach implicit in statement I.\nStatement I and statement III together establish the premise of long-term sustainability.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "a"
  },
  {
    text: "With respect to the Western Hoolock Gibbons, which of the following statements is/are correct?\nA Sanctuary in North-east India is home to this ape species listed as Endangered in the International Union for Conservation of Nature (IUCN) Red List.\nThey have specialized brachiation and can easily swing between trees.\nThey possess a strong and heavy build like gorillas, yet are remarkably agile tree climbers.",
    optionA: "(a) 1 only",
    optionB: "(b) 1 and 2",
    optionC: "(c) 2 and 3",
    optionD: "(d) 3 only",
    correctAnswer: "a"
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
    correctAnswer: "a"
  }
];

async function main() {
  console.log('Start seeding...');
  for (const q of questions) {
    const question = await prisma.question.create({
      data: q,
    });
    console.log(`Created question with id: ${question.id}`);
  }
  console.log('Seeding finished.');
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
