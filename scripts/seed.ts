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

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

const FIRST_NAMES = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "Logan", "Mia", "Lucas", "Charlotte", "Jackson", "Amelia",
  "Aiden", "Harper", "Elijah", "Evelyn", "James", "Abigail", "Benjamin",
  "Emily", "Carter", "Elizabeth", "Daniel", "Sofia", "Henry", "Grace", "Owen",
];
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson",
  "Anderson", "Thomas", "Taylor", "Moore", "Chen", "Patel", "Kim",
];

const TIMES = ["11:30", "12:00", "12:30", "13:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

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
    name: "Amelia Rhodes",
    email: "owner@ember-oak.com",
    password,
    role: "owner",
  });

  const restaurant = await Restaurant.create({
    name: "Ember & Oak",
    slug: "ember-and-oak",
    ownerId: owner._id,
    subscriptionPlan: "growth",
    cuisine: "Modern American",
    description:
      "Wood-fired modern American dining with seasonal ingredients and an award-winning wine list.",
  });

  owner.restaurantId = restaurant._id;
  await owner.save();

  const branchDocs = await Branch.create([
    {
      restaurantId: restaurant._id,
      name: "Downtown",
      address: { street: "548 Market St", city: "San Francisco", state: "CA", zip: "94104", country: "USA" },
      capacity: 90,
      contactInfo: { phone: "+1 (415) 555-0110", email: "downtown@ember-oak.com" },
      openingHours: "Mon–Sun 11:00–23:00",
    },
    {
      restaurantId: restaurant._id,
      name: "Marina",
      address: { street: "2210 Chestnut St", city: "San Francisco", state: "CA", zip: "94123", country: "USA" },
      capacity: 64,
      contactInfo: { phone: "+1 (415) 555-0145", email: "marina@ember-oak.com" },
      openingHours: "Tue–Sun 17:00–23:30",
    },
    {
      restaurantId: restaurant._id,
      name: "Palo Alto",
      address: { street: "180 University Ave", city: "Palo Alto", state: "CA", zip: "94301", country: "USA" },
      capacity: 72,
      contactInfo: { phone: "+1 (650) 555-0177", email: "paloalto@ember-oak.com" },
      openingHours: "Mon–Sun 11:30–22:30",
    },
    {
      restaurantId: restaurant._id,
      name: "Oakland Uptown",
      address: { street: "2335 Broadway", city: "Oakland", state: "CA", zip: "94612", country: "USA" },
      capacity: 56,
      contactInfo: { phone: "+1 (510) 555-0192", email: "oakland@ember-oak.com" },
      openingHours: "Wed–Sun 17:00–23:00",
    },
  ]);
  console.log(`Created ${branchDocs.length} branches`);

  // Staff
  await User.create([
    {
      name: "Marcus Chen",
      email: "manager@ember-oak.com",
      password,
      role: "manager",
      restaurantId: restaurant._id,
      branchId: branchDocs[0]._id,
      shift: "evening",
      position: "General Manager",
      phone: "+1 (415) 555-0123",
    },
    {
      name: "Sofia Martínez",
      email: "staff@ember-oak.com",
      password,
      role: "staff",
      restaurantId: restaurant._id,
      branchId: branchDocs[0]._id,
      shift: "evening",
      position: "Head Host",
    },
    {
      name: "David Okafor",
      email: "david@ember-oak.com",
      password,
      role: "staff",
      restaurantId: restaurant._id,
      branchId: branchDocs[1]._id,
      shift: "afternoon",
      position: "Server",
    },
    {
      name: "Priya Nair",
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
    { name: "Charred Octopus", description: "Spanish octopus, smoked paprika aioli, confit potato", price: 21, category: "Starters", allergens: ["shellfish", "eggs"], preparationTime: 15 },
    { name: "Burrata & Heirloom Tomato", description: "Creamy burrata, basil oil, aged balsamic, grilled sourdough", price: 18, category: "Starters", allergens: ["dairy", "gluten"], preparationTime: 10 },
    { name: "Tuna Crudo", description: "Yellowfin tuna, citrus ponzu, avocado, sesame crisp", price: 22, category: "Starters", allergens: ["fish", "sesame", "soy"], preparationTime: 12 },
    { name: "Wood-Fired Flatbread", description: "Wild mushroom, taleggio, truffle honey, arugula", price: 17, category: "Starters", allergens: ["gluten", "dairy"], preparationTime: 14 },
    { name: "Dry-Aged Ribeye", description: "28-day dry-aged 16oz ribeye, bone marrow butter, charred onion", price: 64, category: "Mains", allergens: ["dairy"], preparationTime: 30 },
    { name: "Cedar Plank Salmon", description: "King salmon, miso glaze, charred broccolini, yuzu beurre blanc", price: 38, category: "Mains", allergens: ["fish", "dairy", "soy"], preparationTime: 25 },
    { name: "Heritage Pork Chop", description: "Double-cut chop, apple mostarda, braised greens", price: 42, category: "Mains", allergens: [], preparationTime: 28 },
    { name: "Handmade Tagliatelle", description: "Slow-braised short rib ragù, parmigiano, gremolata", price: 32, category: "Mains", allergens: ["gluten", "dairy", "eggs"], preparationTime: 20 },
    { name: "Roasted Half Chicken", description: "Jidori chicken, salsa verde, fingerling potatoes", price: 34, category: "Mains", allergens: [], preparationTime: 35 },
    { name: "Wild Mushroom Risotto", description: "Carnaroli rice, porcini, mascarpone, chive oil", price: 28, category: "Mains", allergens: ["dairy"], preparationTime: 24 },
    { name: "Basque Cheesecake", description: "Burnt Basque cheesecake, macerated berries", price: 14, category: "Desserts", allergens: ["dairy", "eggs", "gluten"], preparationTime: 8 },
    { name: "Chocolate Budino", description: "Dark chocolate custard, olive oil, sea salt, biscotti", price: 13, category: "Desserts", allergens: ["dairy", "eggs", "gluten", "nuts"], preparationTime: 6 },
    { name: "Seasonal Sorbet", description: "Rotating selection of house-made sorbets", price: 9, category: "Desserts", allergens: [], preparationTime: 4 },
    { name: "Smoked Old Fashioned", description: "Bourbon, demerara, black walnut bitters, applewood smoke", price: 17, category: "Drinks", allergens: ["nuts"], preparationTime: 6 },
    { name: "Garden Spritz", description: "Cucumber, elderflower, prosecco, mint", price: 14, category: "Drinks", allergens: [], preparationTime: 4 },
    { name: "Barrel-Aged Negroni", description: "House-aged 6 weeks in oak", price: 16, category: "Drinks", allergens: [], preparationTime: 3 },
    { name: "Duck Fat Fries", description: "Rosemary salt, garlic aioli", price: 12, category: "Sides", allergens: ["eggs"], preparationTime: 10 },
    { name: "Charred Brussels", description: "Pancetta, pecorino, calabrian chili", price: 14, category: "Sides", allergens: ["dairy"], preparationTime: 12 },
    { name: "Mac & Three Cheese", description: "Aged cheddar, gruyère, parmigiano, herbed crumb", price: 15, category: "Sides", allergens: ["dairy", "gluten"], preparationTime: 14 },
    { name: "Chef's Tasting Menu", description: "Seven courses highlighting the season — full table only", price: 125, category: "Specials", allergens: [], preparationTime: 90 },
    { name: "Tomahawk for Two", description: "40oz tomahawk, two sides, bone marrow", price: 145, category: "Specials", allergens: ["dairy"], preparationTime: 45 },
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
      phone: `+1 (555) ${String(randomInt(100, 999))}-${String(randomInt(1000, 9999))}`,
      tags: Math.random() > 0.75 ? [pick(["VIP", "Regular", "Wine club", "Vegetarian", "Birthday club"])] : [],
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
    const isWeekend = [0, 5, 6].includes(date.getDay());
    // Volume grows over time and is higher on weekends
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
          estimatedSpend = guests * randomInt(38, 95);
        } else if (roll < 0.74) {
          status = "cancelled";
        } else if (roll < 0.84) {
          status = "rejected";
        } else {
          status = "completed";
          estimatedSpend = guests * randomInt(38, 95);
        }
      } else if (day === 0) {
        status = pick(["pending", "approved", "approved", "seated", "completed"]);
        if (status === "completed") estimatedSpend = guests * randomInt(38, 95);
        else estimatedSpend = guests * randomInt(38, 95);
      } else {
        status = pick(["pending", "pending", "approved"]);
        estimatedSpend = guests * randomInt(38, 95);
      }

      const createdAt = new Date(date);
      createdAt.setDate(createdAt.getDate() - randomInt(1, 6));

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
                "Celebrating an anniversary",
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
    name: "Sakura Table — Ginza",
    address: { street: "742 Post St", city: "San Francisco", state: "CA", country: "USA" },
    capacity: 38,
    contactInfo: { phone: "+1 (415) 555-0260" },
    openingHours: "Tue–Sun 17:30–22:30",
  });

  await MenuItem.create([
    { restaurantId: restaurant2._id, name: "Omakase Nigiri (12pc)", description: "Chef's selection of seasonal fish", price: 88, category: "Specials", allergens: ["fish", "soy"], preparationTime: 35, availability: true, popularityScore: 80 },
    { restaurantId: restaurant2._id, name: "Miso Black Cod", description: "72-hour marinated black cod, pickled ginger", price: 42, category: "Mains", allergens: ["fish", "soy"], preparationTime: 22, availability: true, popularityScore: 65 },
    { restaurantId: restaurant2._id, name: "Yuzu Sorbet", description: "House yuzu sorbet with sesame tuile", price: 10, category: "Desserts", allergens: ["sesame"], preparationTime: 5, availability: true, popularityScore: 30 },
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
  console.log("  manager@ember-oak.com  — Manager, Downtown");
  console.log("  staff@ember-oak.com    — Staff, Downtown");
  console.log("  owner@sakura-table.com — Owner, Sakura Table (isolation test)");
  console.log("──────────────────────────────────────────");

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
