# iOS Testing Checklist for Latest UI/UX Changes

## 🔴 CRITICAL FIXES APPLIED
- ✅ **Platform import added** to HomeScreen.tsx (was missing - would cause crash)
- ✅ **Filter infinite loop** fixed in TasksScreen
- ✅ **Form reset** now closes Options section properly
- ✅ **Filter dropdown** handles all cases including 'weekend'

---

## 📱 iOS-Specific UI Elements to Test

### Home Screen
- [ ] **Card shadows** render correctly (subtle, not harsh)
- [ ] **Touch feedback** on task rows (0.7 opacity)
- [ ] **Long press gesture** (400ms delay) opens task detail
- [ ] **Scroll performance** with RefreshControl
- [ ] **Text truncation** in news items (3 lines max)
- [ ] **Task limit** shows max 3 tasks correctly
- [ ] **Quote card** displays without shadow (matte look)

### Tasks Screen
- [ ] **Collapsible Options** section animates smoothly
  - Tap "Options" toggle
  - Verify Category and Description appear/disappear
  - Create task and verify Options closes automatically
- [ ] **DateTimePicker** appears correctly (iOS spinner style)
- [ ] **Filter dropdown** shows all options without "undefined"
- [ ] **Task count** displays: "Toutes (X)"
- [ ] **Keyboard avoidance** works (ProfileScreen has KeyboardAvoidingView)
- [ ] **Touch targets** are >= 44pt for all interactive elements

### Notifications
- [ ] **Notification messages** display task titles correctly
  - Test with 1 overdue task
  - Test with 2-3 overdue tasks (should list titles)
  - Test with >3 overdue tasks (should show "dont « title »")
- [ ] **Notification actions** (delay/delete) work on specific task
- [ ] **App refreshes** after notification action
- [ ] **Deleted tasks** disappear from UI immediately
- [ ] **Deep linking** from notifications opens correct filtered view
  - Tap overdue notification → "En retard" filter active
  - Tap J-1 notification → "Demain" filter active

---

## 🎨 Visual Polish to Verify

### Typography
- [ ] Card titles: 16px, weight 600, color #111827
- [ ] Body text: 15px, weight 400, color #111827
- [ ] Meta text: 13px, weight 400, color #6B7280
- [ ] Temperature: 26px, weight 700

### Colors
- [ ] Background: #F7F8FA (light gray)
- [ ] Cards: #FFFFFF with subtle shadows
- [ ] Quote card: #F3F4F6 (no shadow)
- [ ] Task badges: #EAF2FF background, #1D4ED8 text
- [ ] Overdue dates: Bold (#DC2626, weight 600)

### Spacing
- [ ] Card padding: 14px
- [ ] Card margins: 12px bottom
- [ ] Container padding: 16px horizontal, 12px top
- [ ] Task row height feels comfortable (not cramped)

---

## ⚡ Performance Checks

- [ ] **Scroll smoothness** at 60fps
- [ ] **No jank** when opening/closing Options
- [ ] **Image loading** doesn't block UI
- [ ] **Notification scheduling** doesn't cause lag
- [ ] **Form submission** is responsive

---

## 🐛 Edge Cases to Test

### Filter State
- [ ] Returning to Tasks screen maintains filter
- [ ] Filter never shows empty/blank
- [ ] Weekend filter shows "Week-end" text
- [ ] Navigating away and back preserves selection

### Form Behavior
- [ ] Creating task with Options open → Options closes
- [ ] Error messages scroll to top automatically
- [ ] Success toast appears and disappears (3s)
- [ ] Long task titles don't break layout

### Notifications on iOS
- [ ] French characters (guillemets «») display correctly
- [ ] Multi-line messages format properly
- [ ] Category identifier doesn't cause crash
- [ ] Actions trigger without delay

---

## 📋 Regression Tests

Verify these still work after UI changes:
- [ ] PDF generation and viewing
- [ ] Task editing inline
- [ ] Task deletion with confirmation
- [ ] Weather and location display
- [ ] Profile sections collapsible
- [ ] 3-tap debug screen access
- [ ] Image upload from camera/gallery

---

## 🚨 Known iOS-Specific Behaviors

1. **Shadow rendering**: iOS shows softer shadows than Android (expected)
2. **Touch feedback**: iOS has slight delay for long press (400ms)
3. **Keyboard**: Uses native iOS keyboard with QuickType bar
4. **DatePicker**: iOS spinner style (not calendar)
5. **Notifications**: iOS requires explicit permission (auto-requested on launch)

---

## ✅ Sign-off Checklist

Before marking complete:
- [ ] All critical fixes verified working
- [ ] No console errors in Metro bundler
- [ ] No red/yellow warning boxes on device
- [ ] Notifications appear in Settings app
- [ ] App doesn't crash on any screen transition
- [ ] Memory usage stable (no leaks)
- [ ] Battery drain is normal

---

## 📝 Notes for Testing

- Test on both **iPhone with notch** (safe area) and **older models**
- Test in both **light and dark mode** (if supported)
- Test with **VoiceOver** enabled (accessibility)
- Test with **Reduce Motion** enabled
- Test **notification permissions** denied scenario
- Test **airplane mode** / offline behavior

