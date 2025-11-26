# Testing Instructions for Client

## Prerequisites
1. **Install Expo Go** on your iPhone:
   - Open the App Store
   - Search for "Expo Go"
   - Install the app

## Backend Setup
The app needs the backend server running to fetch data (weather, quotes, tasks, news).

1. **Start the Backend Server:**
   ```bash
   cd "C:\Users\33769\Desktop\Parentia app"
   npm run dev
   ```
   
2. **Note:** The backend runs on `http://192.168.1.10:5000` - you may need to update this IP address in `mobile/app.json` if your network is different.

## Mobile App Testing

1. **Start Expo Development Server:**
   ```bash
   cd mobile
   npx expo start
   ```

2. **Scan QR Code:**
   - When Expo starts, a QR code will appear in your terminal
   - Open **Expo Go** on your iPhone
   - Tap **"Scan QR Code"** at the bottom
   - Point your camera at the QR code in the terminal
   - Wait for the app to load (first load takes 10-20 seconds)

## What You Should See

### Home Screen
- **Weather section** with temperature, city, and clothing suggestions displayed as blue pill tags
- **Quote of the day** in a gray box
- **Today's tasks** (3 mocked tasks) with colored status indicators
- **News** with clickable article links
- Pull down to refresh all data
- Feather icons on each section header

### Profile Screen
- Input field to enter your city or postal code
- Blue "Enregistrer" button (44px height per design specs)
- Green success message when city is saved
- Returns to Home after 1.5 seconds

### Tasks Screen
- Placeholder text explaining this screen will be completed in future milestone

### Inbox Screen
- Placeholder text for email/OCR integration in future milestone

## Design Verification

The app implements your exact design specifications:

### Colors
- ✅ White background: #FFFFFF
- ✅ Titles: #2C3E50 (blue-gray)
- ✅ Secondary text: #6E7A84 (medium gray)
- ✅ Borders: #E9EEF2 (light gray)
- ✅ Buttons/accents: #3A82F7 (blue)
- ✅ Success: #4CAF50 (green)
- ✅ Warnings: #F7A45A (orange)

### Typography
- ✅ Font: Inter (system default)
- ✅ H1: 24px
- ✅ H2: 19px
- ✅ Body: 16px
- ✅ Weights: 400/500/600

### Components
- ✅ Cards: 12px radius, #E9EEF2 border, 16px padding
- ✅ Buttons: #3A82F7, 44px height, 8-10px radius
- ✅ Inputs: #F5F7FA background, 10px radius

### Spacing
- ✅ 20-24px between sections
- ✅ 16-20px horizontal padding

### Icons
- ✅ Feather Icons throughout

## Features to Test

1. **Weather Display:**
   - Go to Profile → Enter "Paris" → Save
   - Return to Home → Weather should show Paris temperature and clothing suggestions

2. **Pull to Refresh:**
   - On Home screen, pull down to refresh all data

3. **Navigation:**
   - Tap bottom tabs to switch between screens
   - Active tab is highlighted in #2C3E50
   - Inactive tabs are #6E7A84

4. **City Persistence:**
   - Enter a city in Profile
   - Close the app completely
   - Reopen → City should still be saved

## Troubleshooting

### "Unable to connect to Expo Go"
- Ensure your iPhone and computer are on the **same WiFi network**
- Check that no firewall is blocking port 8081

### "Network request failed"
- Ensure the backend server is running (`npm run dev`)
- Check that the IP address in `mobile/app.json` matches your computer's IP
- You can find your IP by running `ipconfig` on Windows

### App crashes or won't load
- Close Expo Go completely
- In terminal, stop Expo (Ctrl+C)
- Restart: `npx expo start -c` (the `-c` clears cache)
- Scan QR code again

## Technical Notes

This version uses:
- **React Native 0.81.5** with New Architecture enabled
- **Expo SDK 54**
- **Plain React Native components** (no third-party UI libraries)
- **Custom tab navigation** (fully compatible with New Architecture)
- All components styled with StyleSheet for optimal performance

## Next Steps (Future Milestones)

After approval of this Milestone 1 build:
- Milestone 2: Full Tasks management (add, edit, delete, categories)
- Milestone 3: Email integration and OCR for receipts
- Milestone 4: Calendar integration
- Milestone 5: iOS/Android production builds (TestFlight/APK)

---

**Questions or Issues?** Contact the development team with:
1. Screenshot of the issue
2. What you were trying to do
3. Your iPhone model and iOS version
