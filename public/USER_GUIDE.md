# BRETT — User Guide
## Warehouse Parts Inventory System

---

## 📱 Getting Started on Your Phone

Brett is a web app — no app store needed. Just open it in your phone's browser.

### Step 1: Open Brett on Your Phone

1. Open **Safari** (iPhone) or **Chrome** (Android)
2. Navigate to your Brett URL (e.g., `https://brett.pages.dev`)
3. The dashboard loads automatically

### Step 2: Add Brett to Your Home Screen (Recommended)

This makes Brett launch like a real app — fullscreen, no browser bars.

**iPhone (Safari):**
1. Tap the **Share** button (square with arrow ↑)
2. Scroll down and tap **"Add to Home Screen"**
3. Tap **Add**

**Android (Chrome):**
1. Tap the **⋮ menu** (three dots, top-right)
2. Tap **"Add to Home screen"** or **"Install app"**
3. Tap **Add**

You'll now see the BRETT icon on your home screen. Tap it to open the app fullscreen.

---

## 📸 Sending Photos Wirelessly from Your Phone

This is the core feature — snap a photo of a part and Brett + Gemini AI will identify it automatically.

### Adding a New Part with Your Phone Camera

1. **Tap the "＋ Add Part" button** (top-right of the app)
2. **Tap the camera upload area** — it says *"Tap to take photo"*
3. Your phone's camera opens automatically
4. **Take a photo** of the part (showing the label/part number)
5. Tap **Use Photo** (iPhone) or the **checkmark** (Android)
6. The photo uploads wirelessly and appears in the preview
7. **Gemini AI auto-scans** the photo — it reads the part number, model, and manufacturer from the label
8. Review the auto-filled fields and adjust if needed
9. Enter the **quantity** and **warehouse location**
10. Tap **"🤖 Add Part & Generate Description"**

> **Tip:** Hold your phone steady and make sure the part label is well-lit and in focus. Gemini AI works best with clear, readable labels.

### Choosing an Existing Photo Instead

If you already have a photo saved on your phone:
1. Tap the camera upload area
2. When the camera opens, tap **"Photo Library"** (iPhone) or **"Gallery"** (Android) instead of taking a new photo
3. Select the photo from your gallery
4. The AI scan runs automatically

---

## 📊 Dashboard

The dashboard shows your inventory at a glance:

| Card | What It Shows |
|------|--------------|
| **Total Parts** | Number of unique part types in inventory |
| **Total In Stock** | Sum of all quantities across all parts |
| **Low Stock** | Parts with 5 or fewer remaining |
| **Out of Stock** | Parts with 0 quantity |

Below the cards is the **Recent Activity** feed showing the latest take/add transactions.

---

## 📦 Inventory Tab

View all parts in your inventory. On your phone, parts display as easy-to-read cards showing:
- Part photo thumbnail
- Part number
- Description
- Quantity (color-coded: 🟢 healthy, 🟡 low, 🔴 out)
- Warehouse location

### Searching for Parts

**On phone:** Tap the 🔍 icon in the top-right to open the search bar. Type a part number, description, or location.

**On desktop:** Use the search bar in the header.

### Filtering by Location

Use the **"All Locations"** dropdown at the top of the inventory list to filter parts by warehouse location.

### Sorting

On desktop, click the column headers (Part #, QTY, Location) to sort. On phone, parts are sorted by newest first by default.

---

## ➕ Add Part Tab

### The Workflow

1. **Upload a photo** → Camera opens on phone
2. **AI scans the label** automatically
3. **Review & adjust** auto-filled fields
4. **Set quantity & location**
5. **Submit** → AI generates a detailed description

### What Gemini AI Detects

From a single photo, the AI attempts to read:
- Part number
- Model number
- Manufacturer/brand name

It also generates a professional description of the part when you submit.

### Manual Entry

You can always skip the photo and type everything manually:
1. Leave the photo empty
2. Type the part number (required)
3. Fill in model and manufacturer
4. Set quantity and location
5. Submit

---

## 👁️ Part Detail View

Tap any part in the inventory to see its full details:

- **Full-size photo** of the part
- **Part number** and **AI-generated description**
- **Current quantity** and **location**
- **Stock controls** — take or add parts
- **Transaction history** — full log of all takes/adds

### Taking Parts

1. Open the part detail
2. Use the **−/+** buttons or type a number
3. Tap **"📤 Take Parts"**
4. Quantity updates instantly

### Adding Stock

Same process, but tap **"📥 Add Stock"** instead.

### Quick Take (from Inventory list, desktop only)

On the inventory table, tap the red 📤 button next to any part for a quick take popup.

---

## ✏️ Editing a Part

1. Open the part detail
2. Tap **"✏️ Edit"** at the bottom
3. Modify any field — part number, quantity, location, description
4. Optionally upload a **replacement photo** (camera opens on phone)
5. Toggle **"🤖 Regenerate with AI"** to get a fresh AI description
6. Tap **"💾 Save Changes"**

---

## 🗑️ Deleting a Part

1. Open the part detail
2. Tap **"🗑️ Delete"** at the bottom
3. Confirm the deletion

> **Warning:** Deletion is permanent. The part and all its transaction history will be removed.

---

## 📋 Activity Log Tab

A complete history of every inventory transaction:
- **📤 TAKEN** — parts removed from stock
- **📥 ADDED** — parts added to stock
- **📦 INITIAL STOCK** — the starting quantity when a part was first created
- **🔧 ADJUSTMENT** — manual quantity corrections

Each entry shows the part number, quantity change, remaining quantity, and when it happened.

---

## � Match Request Tab (Material Request Analyzer)

This is the key feature for PMs and warehouse managers. Upload a photo of a material request form and Brett will tell you what's already in the warehouse — so you can pull parts before ordering.

### How to Use

1. Tap the **📄 Match Request** tab
2. **Upload or photograph** a material request form (bill of materials, parts list, purchase order, etc.)
3. Tap **🔍 Analyze & Match Parts**
4. Wait for Gemini AI to read the form (usually 5-15 seconds)
5. View results in two panels:

### Results Breakdown

| Panel | What It Shows |
|-------|--------------|
| ✅ **Available in Warehouse** | Parts found in inventory — shows QTY in stock and warehouse location so PM/Mike can pull them |
| ❌ **Need to Order** | Parts NOT found in inventory — these need to be purchased |

### Summary Cards

At the top of the results you'll see:
- **Parts on Form** — total number of parts extracted from the form
- **In Warehouse** — how many are already in stock
- **Need to Order** — how many need to be purchased
- **Match Rate** — percentage of parts already available

### Tips for Best Results
- Make sure the form is **flat and well-lit** — avoid shadows and wrinkles
- **Fill the frame** with the form — crop out surrounding clutter
- Forms with **printed/typed text** work best (handwritten forms may be less accurate)
- The AI reads part numbers, model numbers, catalog numbers, SKUs, and item codes

---

## �💡 Tips & Tricks

### Best Practices for Photo Scanning
- **Good lighting** — avoid shadows on the label
- **Fill the frame** — get close to the part number/label
- **Hold steady** — blurry photos = missed scans
- **Multiple labels?** — The AI picks the most prominent one

### Phone-Specific Tips
- **Add to Home Screen** for the best experience (see above)
- **Landscape mode** works great for viewing the inventory table
- **Swipe left/right** on the navigation tabs to access all sections
- **Pull down to go back** on modals

### Photo Storage
- All part photos are stored in Cloudflare's cloud (R2)
- Photos **auto-delete after 2 days** to save storage
- Part data (numbers, quantities, locations, descriptions) is kept permanently

### Offline Note
Brett requires an internet connection to:
- Load and save inventory data (stored in the cloud)
- Use Gemini AI for photo scanning and descriptions
- Upload part photos

Make sure you have cellular data or Wi-Fi when using the app.

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera doesn't open | Check browser permissions: Settings → Brett → Camera → Allow |
| Photo won't upload | Check file size is under 10MB, try a different format (JPG works best) |
| AI says "no part info found" | Try a clearer photo with better lighting, or enter info manually |
| Page looks broken on phone | Clear browser cache and reload (pull down to refresh) |
| Can't find the search bar | On phone, tap the 🔍 icon in the top-right corner |
| Match Request shows no parts | Make sure the form photo is clear, well-lit, and text is readable |
| Wrong parts matched | The AI uses fuzzy matching — review results and verify part numbers |

