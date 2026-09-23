/**
 * DineFlow demo data seeder.
 *
 * Usage: npm run seed
 *
 * Creates a complete demo tenant (Ember & Oak) with branches, menu,
 * staff, customers, and 90 days of reservation + analytics history,
 * plus a second small tenant to prove multi-tenant isolation.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  Restaurant,
  Branch,
  MenuItem,
  Reservation,
  Customer,
  AnalyticsEvent,
} from "../src/models";
import { addDaysToKey, dayKeyToDate, todayKey } from "../src/lib/dates";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set — add it to .env.local");
  process.exit(1);
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

/** A Dhaka calendar day `days` ago, in the stored UTC-midnight form. */
function daysAgo(days: number) {
  return dayKeyToDate(addDaysToKey(todayKey(), -days));
}

const FIRST_NAMES = [
  "Nusrat", "Tanvir", "Farzana", "Rafiq", "Sadia", "Imran", "Tasnim", "Arif",
  "Mehjabin", "Shakib", "Anika", "Rakib", "Sumaiya", "Fahim", "Jannat",
  "Mahmud", "Nabila", "Sabbir", "Tahmina", "Zubair", "Ishrat", "Ayaan",
  "Rumana", "Kamrul", "Afsana", "Nayeem", "Priyanka", "Sourav", "Lamia", "Omar",
];
const LAST_NAMES = [
  "Rahman", "Hossain", "Islam", "Ahmed", "Chowdhury", "Khan", "Uddin",
  "Akter", "Sarker", "Talukder", "Mahmud", "Karim", "Haque", "Siddiqui",
  "Bhuiyan", "Das", "Roy", "Kabir", "Alam", "Majumder",
];

function bdMobile() {
  const operator = pick(["13", "14", "15", "16", "17", "18", "19"]);
  return `+880 ${operator}${randomInt(10, 99)}-${randomInt(100000, 999999)}`;
}

const TIMES = ["12:30", "13:00", "13:30", "14:00", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

async function seed() {
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected to MongoDB");

  // Wipe existing data
  await Promise.all([
    User.deleteMany({}),
    Restaurant.deleteMany({}),
    Branch.deleteMany({}),
    MenuItem.deleteMany({}),
    Reservation.deleteMany({}),
    Customer.deleteMany({}),
    AnalyticsEvent.deleteMany({}),
  ]);
  console.log("Cleared existing collections");

  const password = await bcrypt.hash("password123", 12);

  // ---------- Tenant 1: Ember & Oak ----------
  const owner = await User.create({
    name: "Farhana Rahman",
    email: "owner@ember-oak.com",
    password,
    role: "owner",
  });

  const restaurant = await Restaurant.create({
    name: "Ember & Oak",
    slug: "ember-and-oak",
    ownerId: owner._id,
    subscriptionPlan: "growth",
    cuisine: "Wood-fired Continental",
    description:
      "Wood-fired continental dining with seasonal Bangladeshi produce, steaks and a signature mocktail bar.",
  });

  owner.restaurantId = restaurant._id;
  await owner.save();

  const branchDocs = await Branch.create([
    {
      restaurantId: restaurant._id,
      name: "Gulshan",
      address: { street: "House 12, Road 55, Gulshan 2", city: "Dhaka", state: "Dhaka", zip: "1212", country: "Bangladesh" },
      capacity: 90,
      contactInfo: { phone: "+880 1711-201110", email: "gulshan@ember-oak.com" },
      openingHours: "Daily 12:00–23:00",
    },
    {
      restaurantId: restaurant._id,
      name: "Dhanmondi",
      address: { street: "House 27, Road 8A, Dhanmondi", city: "Dhaka", state: "Dhaka", zip: "1209", country: "Bangladesh" },
      capacity: 64,
      contactInfo: { phone: "+880 1811-201145", email: "dhanmondi@ember-oak.com" },
      openingHours: "Daily 12:30–23:30",
    },
    {
      restaurantId: restaurant._id,
      name: "Uttara",
      address: { street: "House 5, Road 11, Sector 4, Uttara", city: "Dhaka", state: "Dhaka", zip: "1230", country: "Bangladesh" },
      capacity: 72,
      contactInfo: { phone: "+880 1911-201177", email: "uttara@ember-oak.com" },
      openingHours: "Daily 12:00–22:30",
    },
    {
      restaurantId: restaurant._id,
      name: "Chattogram GEC",
      address: { street: "1 CDA Avenue, GEC Circle", city: "Chattogram", state: "Chattogram", zip: "4000", country: "Bangladesh" },
      capacity: 56,
      contactInfo: { phone: "+880 1611-201192", email: "chattogram@ember-oak.com" },
      openingHours: "Sat–Thu 17:00–23:00",
    },
  ]);
  console.log(`Created ${branchDocs.length} branches`);

  // Staff
  await User.create([
    {
      name: "Tanvir Hasan",
      email: "manager@ember-oak.com",
      password,
      role: "manager",
      restaurantId: restaurant._id,
      branchId: branchDocs[0]._id,
      shift: "evening",
      position: "General Manager",
      phone: "+880 1711-201123",
    },
    {
      name: "Sumaiya Akter",
      email: "staff@ember-oak.com",
      password,
      role: "staff",
      restaurantId: restaurant._id,
      branchId: branchDocs[0]._id,
      shift: "evening",
      position: "Head Host",
    },
    {
      name: "Rakib Hossain",
      email: "david@ember-oak.com",
      password,
      role: "staff",
      restaurantId: restaurant._id,
      branchId: branchDocs[1]._id,
      shift: "afternoon",
      position: "Server",
    },
    {
      name: "Priyanka Das",
      email: "priya@ember-oak.com",
      password,
      role: "manager",
      restaurantId: restaurant._id,
      branchId: branchDocs[2]._id,
      shift: "morning",
      position: "Branch Manager",
    },
  ]);
  console.log("Created staff accounts");

  // Menu
  const menuSeed: {
    name: string;
    description: string;
    price: number;
    category: "Starters" | "Mains" | "Desserts" | "Drinks" | "Sides" | "Specials";
    allergens: ("gluten" | "dairy" | "nuts" | "shellfish" | "soy" | "eggs" | "fish" | "sesame")[];
    preparationTime: number;
  }[] = [
    { name: "Grilled Prawns", description: "Bagda prawns, garlic chili butter, charred lemon", price: 890, category: "Starters", allergens: ["shellfish", "dairy"], preparationTime: 15 },
    { name: "Burrata & Heirloom Tomato", description: "Creamy burrata, basil oil, aged balsamic, grilled sourdough", price: 950, category: "Starters", allergens: ["dairy", "gluten"], preparationTime: 10 },
    { name: "Tuna Crudo", description: "Yellowfin tuna, citrus ponzu, avocado, sesame crisp", price: 850, category: "Starters", allergens: ["fish", "sesame", "soy"], preparationTime: 12 },
    { name: "Wood-Fired Flatbread", description: "Wild mushroom, mozzarella, truffle honey, arugula", price: 690, category: "Starters", allergens: ["gluten", "dairy"], preparationTime: 14 },
    { name: "Dry-Aged Ribeye", description: "28-day dry-aged 400g ribeye, bone marrow butter, charred onion", price: 3450, category: "Mains", allergens: ["dairy"], preparationTime: 30 },
    { name: "Mustard Bhetki", description: "Pan-seared bhetki, kasundi beurre blanc, charred greens", price: 1450, category: "Mains", allergens: ["fish", "dairy"], preparationTime: 25 },
    { name: "Slow-Braised Lamb Shank", description: "Twelve-hour lamb shank, rosemary jus, mashed potato", price: 1890, category: "Mains", allergens: ["dairy"], preparationTime: 28 },
    { name: "Handmade Tagliatelle", description: "Slow-braised beef ragù, parmesan, gremolata", price: 1150, category: "Mains", allergens: ["gluten", "dairy", "eggs"], preparationTime: 20 },
    { name: "Roasted Half Chicken", description: "Deshi-spiced half chicken, salsa verde, roasted potatoes", price: 1090, category: "Mains", allergens: [], preparationTime: 35 },
    { name: "Wild Mushroom Risotto", description: "Arborio rice, porcini, mascarpone, chive oil", price: 980, category: "Mains", allergens: ["dairy"], preparationTime: 24 },
    { name: "Basque Cheesecake", description: "Burnt Basque cheesecake, macerated berries", price: 490, category: "Desserts", allergens: ["dairy", "eggs", "gluten"], preparationTime: 8 },
    { name: "Chocolate Budino", description: "Dark chocolate custard, sea salt, pistachio biscotti", price: 450, category: "Desserts", allergens: ["dairy", "eggs", "gluten", "nuts"], preparationTime: 6 },
    { name: "Mishti Doi Panna Cotta", description: "Bogura mishti doi panna cotta, date jaggery caramel", price: 390, category: "Desserts", allergens: ["dairy"], preparationTime: 4 },
    { name: "Smoked Mint Lemonade", description: "Fresh lime, mint, applewood smoke", price: 320, category: "Drinks", allergens: [], preparationTime: 5 },
    { name: "Mango Lassi", description: "Rajshahi mango, yoghurt, cardamom", price: 350, category: "Drinks", allergens: ["dairy"], preparationTime: 4 },
    { name: "Cold Brew Tonic", description: "House cold brew, tonic, orange peel", price: 380, category: "Drinks", allergens: [], preparationTime: 3 },
    { name: "Truffle Fries", description: "Rosemary salt, truffle oil, garlic aioli", price: 420, category: "Sides", allergens: ["eggs"], preparationTime: 10 },
    { name: "Charred Broccoli", description: "Garlic chili crisp, toasted almonds", price: 390, category: "Sides", allergens: ["nuts"], preparationTime: 12 },
    { name: "Mac & Three Cheese", description: "Aged cheddar, gouda, parmesan, herbed crumb", price: 550, category: "Sides", allergens: ["dairy", "gluten"], preparationTime: 14 },
    { name: "Chef's Tasting Menu", description: "Seven courses highlighting the season — full table only", price: 6500, category: "Specials", allergens: [], preparationTime: 90 },
    { name: "Tomahawk for Two", description: "1.1kg tomahawk, two sides, bone marrow", price: 8900, category: "Specials", allergens: ["dairy"], preparationTime: 45 },
  ];

  const menuItems = await MenuItem.create(
    menuSeed.map((item) => ({
      ...item,
      restaurantId: restaurant._id,
      availability: Math.random() > 0.1,
      popularityScore: randomInt(5, 100),
    }))
  );
  console.log(`Created ${menuItems.length} menu items`);

  // Customers
  const usedEmails = new Set<string>();
  const customerPayloads = Array.from({ length: 48 }, (_, index) => {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    let email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
    if (usedEmails.has(email)) email = `${first.toLowerCase()}.${last.toLowerCase()}${index}@example.com`;
    usedEmails.add(email);
    return {
      restaurantId: restaurant._id,
      name: `${first} ${last}`,
      email,
      phone: bdMobile(),
      tags: Math.random() > 0.75 ? [pick(["VIP", "Regular", "Corporate", "Vegetarian", "Birthday club"])] : [],
      createdAt: daysAgo(randomInt(0, 90)),
    };
  });
  const customers = await Customer.create(customerPayloads);
  console.log(`Created ${customers.length} customers`);

  // Reservations across the last 90 days + next 7 days
  const reservations: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const customerStats = new Map<
    string,
    { visits: { date: Date; branchId: Types.ObjectId; spend: number; guests: number }[]; spend: number }
  >();

  for (let day = 90; day >= -7; day--) {
    const date = daysAgo(day);
    const isPast = day > 0;
    const isWeekend = [4, 5, 6].includes(date.getUTCDay());
    // Volume grows over time and peaks Thu night–Sat (the Bangladeshi weekend)
    const base = 3 + Math.round((90 - day) / 18) + (isWeekend ? 4 : 0);
    const count = randomInt(Math.max(1, base - 2), base + 3);

    for (let i = 0; i < count; i++) {
      const customer = pick(customers);
      const branch = pick(branchDocs);
      const guests = randomInt(1, 8);
      const time = pick(TIMES);

      let status: string;
      let estimatedSpend: number | undefined;

      if (isPast) {
        const roll = Math.random();
        if (roll < 0.62) {
          status = "completed";
          estimatedSpend = guests * randomInt(900, 2600);
        } else if (roll < 0.74) {
          status = "cancelled";
        } else if (roll < 0.84) {
          status = "rejected";
        } else {
          status = "completed";
          estimatedSpend = guests * randomInt(900, 2600);
        }
      } else if (day === 0) {
        status = pick(["pending", "approved", "approved", "seated", "completed"]);
        if (status === "completed") estimatedSpend = guests * randomInt(900, 2600);
        else estimatedSpend = guests * randomInt(900, 2600);
      } else {
        status = pick(["pending", "pending", "approved"]);
        estimatedSpend = guests * randomInt(900, 2600);
      }

      const createdAt = new Date(date);
      createdAt.setUTCDate(createdAt.getUTCDate() - randomInt(1, 6));

      reservations.push({
        restaurantId: restaurant._id,
        branchId: branch._id,
        customerId: customer._id,
        date,
        time,
        guests,
        status,
        estimatedSpend,
        specialRequests:
          Math.random() > 0.85
            ? pick([
                "Window table please",
                "Celebrating a birthday",
                "Nut allergy at the table",
                "High chair needed",
                "Quiet corner if possible",
              ])
            : undefined,
        createdAt,
        updatedAt: createdAt,
      });

      events.push({
        restaurantId: restaurant._id,
        type: "reservation_created",
        metadata: { branchId: branch._id.toString(), guests, source: Math.random() > 0.5 ? "public_site" : "dashboard" },
        createdAt,
      });

      if (status === "completed" && estimatedSpend) {
        const stats = customerStats.get(customer._id.toString()) ?? { visits: [], spend: 0 };
        stats.visits.push({ date, branchId: branch._id, spend: estimatedSpend, guests });
        stats.spend += estimatedSpend;
        customerStats.set(customer._id.toString(), stats);

        events.push({
          restaurantId: restaurant._id,
          type: "revenue_recorded",
          metadata: { branchId: branch._id.toString(), amount: estimatedSpend },
          createdAt: date,
        });
      }
    }
  }

  await Reservation.insertMany(reservations);
  console.log(`Created ${reservations.length} reservations`);

  // Apply visit history to customers
  for (const [customerId, stats] of customerStats) {
    await Customer.updateOne(
      { _id: customerId },
      {
        $set: {
          visitHistory: stats.visits,
          totalSpend: stats.spend,
          visitCount: stats.visits.length,
        },
      }
    );
  }
  console.log("Applied customer visit history");

  // Menu view events (popularity)
  for (const item of menuItems) {
    const viewCount = randomInt(2, 60);
    for (let i = 0; i < viewCount; i++) {
      events.push({
        restaurantId: restaurant._id,
        type: "menu_item_viewed",
        metadata: { menuItemId: item._id.toString(), source: "public_menu" },
        createdAt: daysAgo(randomInt(0, 30)),
      });
    }
  }

  await AnalyticsEvent.insertMany(events);
  console.log(`Created ${events.length} analytics events`);

  // ---------- Tenant 2: small isolation-proof tenant ----------
  const owner2 = await User.create({
    name: "Kenji Watanabe",
    email: "owner@sakura-table.com",
    password,
    role: "owner",
  });
  const restaurant2 = await Restaurant.create({
    name: "Sakura Table",
    slug: "sakura-table",
    ownerId: owner2._id,
    subscriptionPlan: "starter",
    cuisine: "Japanese",
  });
  owner2.restaurantId = restaurant2._id;
  await owner2.save();

  const branch2 = await Branch.create({
    restaurantId: restaurant2._id,
    name: "Sakura Table — Banani",
    address: { street: "House 76, Road 11, Banani", city: "Dhaka", state: "Dhaka", zip: "1213", country: "Bangladesh" },
    capacity: 38,
    contactInfo: { phone: "+880 1511-200260" },
    openingHours: "Daily 17:30–23:00",
  });

  await MenuItem.create([
    { restaurantId: restaurant2._id, name: "Omakase Nigiri (12pc)", description: "Chef's selection of seasonal fish", price: 4500, category: "Specials", allergens: ["fish", "soy"], preparationTime: 35, availability: true, popularityScore: 80 },
    { restaurantId: restaurant2._id, name: "Miso Black Cod", description: "72-hour marinated black cod, pickled ginger", price: 2200, category: "Mains", allergens: ["fish", "soy"], preparationTime: 22, availability: true, popularityScore: 65 },
    { restaurantId: restaurant2._id, name: "Yuzu Sorbet", description: "House yuzu sorbet with sesame tuile", price: 450, category: "Desserts", allergens: ["sesame"], preparationTime: 5, availability: true, popularityScore: 30 },
  ]);

  await Customer.create({
    restaurantId: restaurant2._id,
    name: "Test Guest",
    email: "guest@example.com",
    visitCount: 0,
  });

  console.log(`Created second tenant (${restaurant2.name}) with branch ${branch2.name}`);

  console.log("\n──────────────────────────────────────────");
  console.log("Seed complete. Demo accounts (password123):");
  console.log("  owner@ember-oak.com    — Owner, Ember & Oak");
  console.log("  manager@ember-oak.com  — Manager, Gulshan");
  console.log("  staff@ember-oak.com    — Staff, Gulshan");
  console.log("  owner@sakura-table.com — Owner, Sakura Table (isolation test)");
  console.log("──────────────────────────────────────────");

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
