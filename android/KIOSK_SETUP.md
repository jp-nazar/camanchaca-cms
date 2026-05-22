# TODO Translate.

# Screen Player Android TV Kiosk Setup Guide

## Quick Start

For ET-N0566 Android TV boxes (Android 15.0, no battery).

### Prerequisites

- [ ] Screen Player app installed on Android TV
- [ ] TV in Developer Mode with USB Debugging enabled
- [ ] TV connected to WiFi (IP: 192.168.0.52)
- [ ] Mac with ADB installed: `brew install android-platform-tools`

### One-Command Setup

```bash
cd /path/to/camanchaca-cms/android/scripts
./setup-kiosk.sh
```

### Manual Setup (Step by Step)

#### Step 1: Enable WiFi ADB (First Time Only)

**Option A: Via USB Cable**
1. Connect TV to Mac with USB cable
2. On TV: Click "Allow USB debugging" when prompted
3. On Mac:
   ```bash
   adb devices
   # Should show: XXXXXXXX    device
   
   adb tcpip 5555
   # Enables WiFi ADB for this session
   # WARNING: May NOT persist after reboot on ET-N0566
   ```
4. Disconnect USB cable

**Option B: Check TV Developer Options**
- Look for "Wireless debugging" or "ADB over network"
- Enable it and note the IP:port shown

#### Step 2: Connect via WiFi

```bash
adb connect 192.168.0.52:5555
adb devices
# Should show: 192.168.0.52:5555    device
```

#### Step 3: Run Kiosk Configuration

```bash
# 1. Disable battery optimization (prevents Android from killing the app)
adb shell dumpsys deviceidle whitelist +com.remotedisplay.player

# 2. Set Screen Player as default home launcher
# Pressing HOME button will stay in the app
adb shell cmd package set-home-activity com.remotedisplay.player/.MainActivity

# 3. Disable Google TV Launcher (CRITICAL - prevents HOME button from switching apps)
# This is the key step that makes kiosk mode work on ET-N0566
adb shell pm disable-user com.google.android.tvlauncher

# 4. Enable accessibility service (optional, helps with some system keys)
# NOTE: This may NOT persist after reboot on some firmwares
adb shell settings put secure enabled_accessibility_services com.remotedisplay.player/com.remotedisplay.player.service.PowerAccessibilityService
adb shell settings put secure accessibility_enabled 1
```

#### Step 4: Verify

```bash
# Check default launcher
adb shell cmd shortcut get-default-launcher

# Check disabled launchers
adb shell pm list packages -d | grep launcher

# Check battery whitelist
adb shell dumpsys deviceidle whitelist | grep remotedisplay
```

#### Step 5: Reboot and Test

```bash
adb reboot
```

**After reboot (wait 30-60 seconds):**
- Screen Player should auto-launch immediately
- Press HOME on remote → should stay in app
- Press BACK on remote → should do nothing
- App should be in fullscreen mode
- Content should download automatically

---

## What This Achieves

| Feature | Status | Method |
|---------|--------|--------|
| Auto-start on boot | ✅ Working | `BootReceiver` + `BOOT_COMPLETED` |
| Home button blocked | ✅ Working | Disabled Google TV Launcher |
| Back button blocked | ✅ Working | `onBackPressed()` override (built-in) |
| Immersive fullscreen | ✅ Working | `SYSTEM_UI_FLAG_IMMERSIVE_STICKY` (built-in) |
| Battery optimization bypass | ✅ Working | Device idle whitelist |
| Foreground service persistent | ✅ Working | WebSocketService with wake lock (built-in) |
| Power outage recovery | ✅ Working | Auto-starts on boot after power loss |
| Content download | ✅ Working | Works with both HTTP and HTTPS URLs |

## What Does NOT Work (Requires Code Changes)

| Feature | Why Not Possible | Impact |
|---------|-----------------|--------|
| Crash recovery | Needs `UncaughtExceptionHandler` | If app crashes → black screen until reboot |
| True app pinning (lock task) | Needs `startLockTask()` in code | Recent apps button may still work |
| Update auto-relaunch | Needs `ACTION_PACKAGE_REPLACED` receiver | After APK update → manual relaunch |
| Accessibility persistence | Firmware clears it on reboot | Not needed if launcher is disabled |
| WiFi ADB persistence | Firmware doesn't auto-start it | Need USB cable to reconnect after reboot |

**Workaround for crashes:** Reboot the TV (unplug/plug back in). App will auto-restart.

---

## Critical Findings from Real-World Testing

### 1. Disabling the Launcher is THE KEY

The most important step is **disabling Google TV Launcher** (`com.google.android.tvlauncher`). 

- The accessibility service gets cleared on reboot on ET-N0566 firmware
- But disabling the competing launcher means pressing HOME has nowhere else to go
- The app stays in the foreground because there's no other launcher to switch to

### 2. WiFi ADB Does NOT Persist

After reboot, WiFi ADB is lost on this device. To reconnect:
1. Use USB cable
2. Run `adb tcpip 5555`
3. Disconnect USB
4. Run `adb connect <ip>:5555`

**Warning:** Once kiosk mode is active, the app may block the "Allow USB debugging?" popup. If you need ADB access after enabling kiosk:
- Unplug TV power
- Plug back in
- Immediately hold MENU + BACK on remote during boot (to interrupt kiosk auto-start)
- Or use recovery mode if available

### 3. No Physical Buttons on ET-N0566

This device has no physical buttons (only ports: Ethernet, DC, HDMI, AV, IR). 
- Recovery mode must be accessed via remote control
- Common method: Hold MENU + BACK during boot
- If that fails, factory reset may be needed

### 4. HTTP vs HTTPS

The app works with both HTTP and HTTPS server URLs. During testing, HTTP `http://your-server-domain.com` successfully downloaded content. However, HTTPS is recommended for production.

If you need to change the server URL after initial setup:
1. Clear app data: `adb shell pm clear com.remotedisplay.player`
2. Re-pair with new URL

---

## Troubleshooting

### "Cannot connect to TV"

```bash
# Check if ADB is running
adb devices

# If empty, try:
adb kill-server
adb start-server
adb connect 192.168.0.52:5555

# If still failing, re-enable WiFi ADB via USB:
adb tcpip 5555
adb connect 192.168.0.52:5555
```

### "App doesn't auto-start after reboot"

1. Check if BootReceiver fired:
   ```bash
   adb logcat -d | grep -i "bootreceiver\|boot_completed" | tail -20
   ```
   
2. Look for errors:
   ```bash
   adb logcat -d | grep -i "remotedisplay\|exception\|error" | tail -30
   ```

3. Common issues:
   - Battery optimization re-enabled → Run whitelist command again
   - App crashed on boot → Check logs for crash
   - BOOT_COMPLETED not received → Check if TV has custom firmware blocking it

### "HOME button still exits app"

```bash
# The KEY is disabling the competing launcher
# Check if Google TV Launcher is disabled:
adb shell pm list packages -d | grep launcher
# Should show: com.google.android.tvlauncher

# If not disabled:
adb shell pm disable-user com.google.android.tvlauncher
```

**Note:** The accessibility service gets cleared on reboot, but it's not needed if the launcher is disabled.

### "Recent apps button works"

This is expected without true app pinning (requires code changes).

**Workaround:** Some TV remotes have a "Recent Apps" button. You can:
- Use a remote without that button
- Or disable the button in TV settings (if available)

### "WiFi ADB connection lost after reboot"

**This is normal on ET-N0566.** The firmware doesn't persist WiFi ADB settings.

**To reconnect:**
1. Use USB cable
2. Run `adb tcpip 5555`
3. Disconnect USB
4. Run `adb connect <tv-ip>:5555`

**Alternative:** If you need persistent ADB access, consider:
- Rooting the device and adding a startup script
- Or using a device that supports persistent WiFi ADB

### "USB debugging popup doesn't appear"

Once kiosk mode is active, the app may block system popups.

**Solutions:**
1. Try unplugging/replugging USB cable
2. Try a different USB port
3. Reboot TV and quickly connect USB before kiosk app starts
4. Use recovery mode to access system UI

---

## Emergency Exit

If you need to exit kiosk mode and can't use ADB:

### Option 1: Via ADB (if still connected)

```bash
# Re-enable Google TV Launcher
adb shell pm enable com.google.android.tvlauncher

# Reset default launcher
adb shell cmd package set-home-activity com.google.android.tvlauncher/.MainActivity

# Reboot
adb reboot
```

### Option 2: Recovery Mode via Remote (No Physical Buttons)

Since ET-N0566 has no physical buttons:
1. Unplug TV power
2. Plug back in
3. **Immediately hold MENU + BACK** on remote (hold together for 10-15 seconds)
4. This should interrupt boot and show system UI or recovery menu
5. From there, you can disable kiosk or factory reset

### Option 3: Factory Reset (Last Resort)

1. Unplug TV power
2. If there's a reset pinhole (check back/side of device), use a paperclip
3. Hold reset while plugging power back in
4. Or try recovery mode via remote (Method 2 above)

---

## For Multiple TVs

### Mass Deployment Script

Create a script for each TV:

```bash
#!/bin/bash
# setup-tv.sh
TV_IP=$1

echo "Setting up TV at ${TV_IP}..."

# Connect via ADB
adb connect "${TV_IP}:5555"

# Verify connection
if ! adb devices | grep -q "${TV_IP}:5555.*device"; then
    echo "ERROR: Cannot connect to ${TV_IP}"
    echo "Make sure WiFi ADB is enabled on the TV"
    exit 1
fi

# Run kiosk setup
adb shell dumpsys deviceidle whitelist +com.remotedisplay.player
adb shell cmd package set-home-activity com.remotedisplay.player/.MainActivity
adb shell pm disable-user com.google.android.tvlauncher
adb shell settings put secure enabled_accessibility_services com.remotedisplay.player/com.remotedisplay.player.service.PowerAccessibilityService
adb shell settings put secure accessibility_enabled 1

# Verify
adb shell pm list packages -d | grep launcher
adb shell dumpsys deviceidle whitelist | grep remotedisplay

# Reboot
adb reboot

echo "TV ${TV_IP} configured. It will reboot now."
```

**Usage:**
```bash
chmod +x setup-tv.sh
./setup-tv.sh 192.168.0.52
./setup-tv.sh 192.168.0.53
./setup-tv.sh 192.168.0.54
```

### Configuration Checklist per TV

- [ ] Install Screen Player APK
- [ ] Enable Developer Mode
- [ ] Enable USB Debugging
- [ ] Note IP address
- [ ] Run setup script
- [ ] Reboot and verify
- [ ] Test HOME button stays in app
- [ ] Test BACK button is blocked
- [ ] Test power outage recovery (unplug and plug back)
- [ ] Test content downloads successfully
- [ ] Verify WiFi ADB is lost after reboot (expected)

---

## Files Reference

| File | Description |
|------|-------------|
| `setup-kiosk.sh` | Automated setup script |
| `BootReceiver.kt` | Auto-starts app on boot (built-in) |
| `MainActivity.kt` | Blocks BACK button, immersive mode (built-in) |
| `PowerAccessibilityService.kt` | Intercepts HOME key (built-in) |
| `WebSocketService.kt` | Persistent foreground service (built-in) |
| `AndroidManifest.xml` | App permissions and component declarations (built-in) |

---

## Architecture Overview

```
Power Outage
     ↓
TV Boots Up
     ↓
BOOT_COMPLETED broadcast
     ↓
BootReceiver.kt triggers
     ↓
Starts WebSocketService (foreground)
     ↓
Launches MainActivity via notification
     ↓
MainActivity displays content
     ↓
Blocks BACK button
     ↓
HOME button → stays in app (launcher disabled)
     ↓
Immersive fullscreen (no nav bar)
     ↓
WebSocketService keeps connection alive
     ↓
Content downloads automatically
     ↓
If app crashes → black screen → reboot TV to recover
```

---

## Last Updated

2025-05-19 - Updated with real-world ET-N0566 testing results

## Tested Configuration

- **Device:** ET-N0566 (Chinese Android TV Box)
- **Android Version:** 15.0 (API 29)
- **Kernel:** 4.9.170
- **App Version:** Screen Player 1.7.8
- **Server:** your-server-domain.com (HTTP and HTTPS)

## Known Limitations

1. **WiFi ADB lost after reboot** - Need USB cable to reconnect
2. **Accessibility service cleared on reboot** - Not critical if launcher disabled
3. **No crash recovery** - Reboot TV if app crashes
4. **Recent apps button may work** - True lock task requires code changes
5. **Kiosk blocks system popups** - May prevent USB debugging authorization

## Notes

- **No code changes required** - All setup via ADB commands
- **Settings persist** across reboots and power outages (except WiFi ADB)
- **HTTP works** for content download, but HTTPS is recommended
- **Tested successfully** on ET-N0566 with auto-start, HOME/BACK blocking, and content download
