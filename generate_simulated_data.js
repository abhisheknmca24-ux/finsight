const fs = require('fs');
const path = require('path');

// Highly realistic Indian Bank Statement Strings
const CATEGORIES = {
    income: [
        "NEFT CR-SALARY-EMPLOYER", 
        "IMPS INWARD-FREELANCE-CLIENT", 
        "UPI CR-RECEIVED FROM RAHUL", 
        "BY CASH DEPOSIT-BRANCH",
        "ACH CR-DIVIDEND-RELIANCE"
    ],
    rent: [
        "IMPS-RENT PAYMENT TO OWNER",
        "UPI-LANDLORD MONTHLY RENT",
        "NEFT-SOCIETY MAINTENANCE"
    ],
    emi: [
        "ACH DR-HOME LOAN EMI-HDFC",
        "AUTO DEBIT-CAR LOAN-ICICI",
        "CREDIT CARD BILL PAYMENT-SBI",
        "PERSONAL LOAN EMI-BAJAJ"
    ],
    utilities: [
        "UPI-BESCOM ELECTRICITY BILL",
        "UPI-JIO FIBER BROADBAND",
        "UPI-AIRTEL POSTPAID",
        "UPI-IGL PIPED GAS",
        "UPI-WATER BILL PAYMENT"
    ],
    insurance: [
        "AUTO DEBIT-LIC PREMIUM",
        "UPI-STAR HEALTH INSURANCE",
        "NEFT-CARE HEALTH POLICY"
    ],
    groceries: [
        "UPI-BLINKIT GROCERIES",
        "UPI-BIGBASKET",
        "POS-DMART RETAIL",
        "POS-RELIANCE FRESH",
        "UPI-ZEPTO MINTS"
    ],
    dining: [
        "UPI-SWIGGY TECHNOLOGIES",
        "UPI-ZOMATO FOOD",
        "POS-MCDONALDS",
        "UPI-CAFE COFFEE DAY",
        "POS-DOMINOS PIZZA",
        "UPI-BARBEQUE NATION"
    ],
    health: [
        "POS-APOLLO PHARMACY",
        "UPI-PRACTO CONSULTATION",
        "UPI-1MG ONLINE MEDS",
        "POS-CITY HOSPITAL",
        "UPI-DR LAL PATHLABS"
    ],
    education: [
        "NEFT-SCHOOL FEES PAYMENT",
        "UPI-UDEMY ONLINE COURSE",
        "UPI-BYJUS LEARNING APP",
        "POS-COLLEGE TUITION"
    ],
    travel: [
        "UPI-UBER RIDE",
        "UPI-OLA CABS",
        "POS-IRCTC TICKET BOOKING",
        "POS-INDIGO AIRLINES",
        "UPI-NCMC METRO RECHARGE",
        "UPI-FASTAG TOLL RECHARGE",
        "POS-BPCL PETROL PUMP",
        "POS-IOCL FUEL STATION"
    ],
    shopping: [
        "UPI-AMAZON SELLER SERVICES",
        "UPI-FLIPKART INTERNET",
        "UPI-MYNTRA DESIGNS",
        "POS-LIFESTYLE STORES",
        "POS-CROMA ELECTRONICS",
        "POS-ZARA APPARELS"
    ],
    entertainment: [
        "UPI-NETFLIX SUBSCRIPTION",
        "POS-PVR CINEMAS MULTIPLEX",
        "UPI-BOOKMYSHOW TICKETS",
        "UPI-SPOTIFY PREMIUM",
        "UPI-STEAM GAMING"
    ],
    hobbies: [
        "UPI-GUITAR CLASSES",
        "POS-ART SUPPLIES STATIONERY",
        "UPI-POTTERY WORKSHOP",
        "POS-DECATHLON SPORTS GEAR",
        "UPI-GOLF CLUB FEE"
    ],
    emergency: [
        "UPI-CAR TOWING SERVICE",
        "UPI-PLUMBER EMERGENCY REPAIR",
        "POS-APOLLO CLINIC URGENT",
        "UPI-LAPTOP SCREEN REPAIR"
    ],
    goals: [
        "NEFT-VACATION FUND TRANSFER",
        "AUTO DEBIT-RECURRING DEPOSIT SBI",
        "UPI-NEW CAR DOWNPAYMENT SAVINGS"
    ],
    investment: [
        "ACH DR-ZERODHA BROKING SIP",
        "UPI-GROWW MUTUAL FUNDS",
        "NEFT-PPF ACCOUNT DEPOSIT",
        "UPI-COIN BY ZERODHA",
        "AUTO DEBIT-NPS TIER 1"
    ],
    daily_cash: [
        "ATM WDL-1234 SBI-NEW DELHI",
        "UPI-CHAI WALA STALL",
        "UPI-LOCAL DAIRY SHOP",
        "UPI-AUTO RICKSHAW FARE",
        "UPI-STREET FOOD VENDOR",
        "UPI-RAMESH KIRANA STORE",
        "UPI-PAN SHOP TUCK"
    ],
    bank_charges: [
        "DR-SMS ALERT CHARGES",
        "DR-ANNUAL DEBIT CARD FEE",
        "DR-MIN BALANCE PENALTY"
    ]
};

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Generates a random amount between min and max loosely rounded
function randAmount(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateData(profile) {
    const transactions = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    startDate.setDate(1);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const dom = d.getDate(); // day of month

        // 1. Core Monthly Fixed Deductions
        if (dom === 1) { // Salary
            transactions.push({ Date: dateStr, Description: "NEFT CR-SALARY-EMPLOYER", Amount: profile.salary, Type: "income" });
        }
        if (dom === 3 && profile.rent > 0) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.rent), Amount: profile.rent, Type: "expense" });
        }
        if (dom === 5 && profile.emi > 0) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.emi), Amount: profile.emi, Type: "expense" });
        }
        if (dom === 7) { // Utilities
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.utilities), Amount: randAmount(profile.utilMin, profile.utilMax), Type: "expense" });
            transactions.push({ Date: dateStr, Description: "UPI-JIO FIBER BROADBAND", Amount: 999, Type: "expense" });
        }
        if (dom === 10 && profile.investment > 0) { // Investments
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.investment), Amount: profile.investment, Type: "investment" });
        }
        if (dom === 15 && profile.insurance > 0) { // Insurance (Monthly or staggered)
            // Just simulate monthly policy for consistent data
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.insurance), Amount: profile.insurance, Type: "expense" });
        }
        if (dom === 20 && profile.education > 0) { // Education fees/courses
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.education), Amount: profile.education, Type: "expense" });
        }
        
        // 2. Weekly routines (e.g., Grocery Shopping on Sundays)
        if (d.getDay() === 0) { // Every Sunday
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.groceries), Amount: randAmount(profile.groceriesMin, profile.groceriesMax), Type: "expense" });
        }

        // 3. Daily / Lifestyle Variables
        const roll = Math.random();
        
        // Small daily spending (Chai, Auto, Snacks) -> Very frequent
        if (roll < profile.dailyChance) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.daily_cash), Amount: randAmount(20, 250), Type: "expense" });
        }
        
        // Dining / Fast Food
        if (Math.random() < profile.diningChance) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.dining), Amount: randAmount(profile.diningMin, profile.diningMax), Type: "expense" });
        }

        // E-commerce Shopping
        if (Math.random() < profile.shoppingChance) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.shopping), Amount: randAmount(profile.shoppingMin, profile.shoppingMax), Type: "expense" });
        }

        // Travel / Commute (Cabs, fuel)
        if (Math.random() < profile.travelChance) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.travel), Amount: randAmount(profile.travelMin, profile.travelMax), Type: "expense" });
        }

        // Entertainment
        if (Math.random() < profile.entChance) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.entertainment), Amount: randAmount(300, 1500), Type: "expense" });
        }

        // Hobbies (Occasional)
        if (Math.random() < (profile.entChance / 2)) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.hobbies), Amount: randAmount(500, 2500), Type: "expense" });
        }

        // Health / Medical (Occasional)
        if (Math.random() < profile.healthChance) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.health), Amount: randAmount(profile.healthMin, profile.healthMax), Type: "expense" });
        }
        
        // Rare Emergency
        if (dom === 14 && Math.random() < 0.1) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.emergency), Amount: randAmount(2000, 8000), Type: "expense" });
        }

        // Goals (Savings goals occasionally funded around end of month)
        if (dom === 27 && profile.investment > 5000) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.goals), Amount: randAmount(2000, 5000), Type: "investment" });
        }
        
        // 4. Random Bank Charges (End of Month)
        if (dom === 28 && Math.random() > 0.5) {
            transactions.push({ Date: dateStr, Description: getRandom(CATEGORIES.bank_charges), Amount: randAmount(15, 250), Type: "expense" });
        }
    }

    return transactions;
}

// Highly customized realistic profiles
const profiles = {
    good: { // Financially disciplined, high income HNI
        salary: 150000, rent: 30000, emi: 0, investment: 40000,
        utilMin: 2000, utilMax: 4000, insurance: 3000, education: 5000,
        groceriesMin: 2000, groceriesMax: 4000,
        dailyChance: 0.2, 
        diningChance: 0.15, diningMin: 800, diningMax: 2000, 
        shoppingChance: 0.1, shoppingMin: 1500, shoppingMax: 4000, 
        travelChance: 0.2, travelMin: 500, travelMax: 1500, 
        entChance: 0.1, healthChance: 0.05, healthMin: 500, healthMax: 3000
    },
    average: { // Middle class life - financially decent
        salary: 75000, rent: 18000, emi: 8000, investment: 5000,
        utilMin: 1500, utilMax: 2500, insurance: 1500, education: 2000,
        groceriesMin: 1000, groceriesMax: 2000,
        dailyChance: 0.3, 
        diningChance: 0.2, diningMin: 300, diningMax: 600, 
        shoppingChance: 0.15, shoppingMin: 500, shoppingMax: 1200, 
        travelChance: 0.2, travelMin: 100, travelMax: 300, 
        entChance: 0.1, healthChance: 0.05, healthMin: 200, healthMax: 800
    },
    bad: { // Paycheck to paycheck, bleeding ~10k a month
        salary: 50000, rent: 18000, emi: 15000, investment: 0, 
        utilMin: 1500, utilMax: 2500, insurance: 0, education: 0,
        groceriesMin: 1000, groceriesMax: 2000,
        dailyChance: 0.4, 
        // Highly realistic parameters that total exactly ~60k expenses instead of absurd 95k
        diningChance: 0.15, diningMin: 300, diningMax: 700, 
        shoppingChance: 0.15, shoppingMin: 1000, shoppingMax: 2000, 
        travelChance: 0.2, travelMin: 150, travelMax: 350, 
        entChance: 0.15, healthChance: 0.05, healthMin: 500, healthMax: 1500
    }
};

const outputDir = path.join(__dirname, 'sample_statements');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

Object.keys(profiles).forEach(key => {
    const data = generateData(profiles[key]);
    const csvContent = [
        "Date,Description,Amount,Type",
        ...data.map(row => `${row.Date},"${row.Description}",${row.Amount},${row.Type}`)
    ].join('\n');
    
    fs.writeFileSync(path.join(outputDir, `statement_${key}.csv`), csvContent);
    console.log(`Generated: statement_${key}.csv with ${data.length} transactions`);
});
