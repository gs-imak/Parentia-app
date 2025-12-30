# PDF Modal Layout Fix - iOS Safe Area Issue

## Problem Identified

The PDF viewer modal header was overlapping with the iOS status bar/notch area, causing the close button, title ("Pièce jointe"), and download button to sit underneath the status bar.

## Root Cause

1. **Old Build**: The EAS build you tested was created at 19:01, BEFORE the fixes were applied
2. **Safe Area Implementation**: The modal wasn't properly respecting iOS safe area insets

## Solution Applied

### Code Changes in `mobile/src/components/PDFViewerModal.tsx`

1. **Container Safe Area Padding** (Line 316):
   ```typescript
   <View style={[styles.container, { paddingTop: topSafeArea }]}>
   ```
   - On iOS: Uses `insets.top` (typically 44-59px depending on device)
   - On Android/Web: Uses 0

2. **Header Additional Padding** (Line 318):
   ```typescript
   <View style={[styles.header, { paddingTop: headerExtraPadding }]}>
   ```
   - On iOS: 16px extra padding for proper spacing
   - On Android/Web: 12px

3. **Improved Header Spacing**:
   - `paddingBottom`: 16px (was 12px)
   - `paddingHorizontal`: 16px (was 12px)
   - `gap`: 12px (was 8px)
   - Follows 4pt/8pt spacing system

## How to Test the Fix

### Option 1: Build New iOS App (REQUIRED for Device Testing)
```bash
cd mobile
eas build -p ios --profile preview
```

Then install the NEW build on your iOS device via the QR code.

### Option 2: Test with Expo Go (Quick Verification)
```bash
cd mobile
expo start
```

Scan the QR code with Expo Go app to test the changes immediately without building.

## Expected Behavior After Fix

✅ The header should clear the iOS notch/status bar completely
✅ "Pièce jointe" title should be visible and not overlapped
✅ Close (X) button should be fully accessible
✅ Download button should be fully accessible
✅ Proper spacing following 8pt grid system

## Technical Details

- Uses `useSafeAreaInsets()` from `react-native-safe-area-context`
- Platform-specific safe area handling
- Modal with `statusBarTranslucent={false}` on iOS (true only on Android)
- Explicit `StatusBar` component with `barStyle="dark-content"`

## Files Modified

- `mobile/src/components/PDFViewerModal.tsx`

## Testing Checklist

- [ ] Build new iOS app with updated code
- [ ] Install on physical iOS device
- [ ] Open a PDF from Tasks or Inbox
- [ ] Verify header elements don't overlap status bar
- [ ] Test on iPhone with notch (X, 11, 12, 13, 14, 15)
- [ ] Test on iPhone without notch (SE, 8, etc.) if available

## Important Note

**YOU MUST CREATE A NEW EAS BUILD** to see these changes on a physical device. The build you tested at 19:01 does NOT contain these fixes.

