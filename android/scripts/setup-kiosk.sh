#!/bin/bash

# Screen Player Kiosk Setup Script for Android TV
# Device: ET-N0566 (Chinese Android TV Box)
# Android Version: 15.0
# 
# TESTED CONFIGURATION:
# - This script has been tested on ET-N0566 with Android 15.0
# - WiFi ADB does NOT persist after reboot on this device
# - The KEY to kiosk mode is disabling the competing launcher
# - Accessibility service gets cleared on reboot but is not critical
#
# Run this after connecting to the TV via ADB over WiFi

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TV_IP="192.168.0.52"
TV_PORT="5555"
PACKAGE_NAME="com.remotedisplay.player"
MAIN_ACTIVITY="com.remotedisplay.player.MainActivity"
ACCESSIBILITY_SERVICE="com.remotedisplay.player/com.remotedisplay.player.service.PowerAccessibilityService"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Screen Player Kiosk Setup Script${NC}"
echo -e "${GREEN}  Tested on ET-N0566 Android 15.0${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Check if ADB is installed
if ! command -v adb &> /dev/null; then
    echo -e "${RED}ERROR: ADB is not installed${NC}"
    echo "Install it with: brew install android-platform-tools"
    exit 1
fi

# Function to check ADB connection
check_connection() {
    echo -e "${YELLOW}Checking ADB connection...${NC}"
    if ! adb devices | grep -q "${TV_IP}:${TV_PORT}.*device"; then
        echo -e "${YELLOW}Not connected. Attempting to connect...${NC}"
        adb connect "${TV_IP}:${TV_PORT}"
        sleep 2
        
        if ! adb devices | grep -q "${TV_IP}:${TV_PORT}.*device"; then
            echo -e "${RED}ERROR: Cannot connect to TV at ${TV_IP}:${TV_PORT}${NC}"
            echo ""
            echo "To enable WiFi ADB:"
            echo "1. Connect TV to Mac with USB cable"
            echo "2. On TV: Click 'Allow USB debugging'"
            echo "3. Run: adb tcpip 5555"
            echo "4. Disconnect USB"
            echo "5. Run this script again"
            echo ""
            echo -e "${YELLOW}NOTE: WiFi ADB does NOT persist after reboot on ET-N0566${NC}"
            echo "You will need to repeat steps 1-3 after each reboot to regain ADB access"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ Connected to TV${NC}"
    echo ""
}

# Function to verify app is installed
check_app_installed() {
    echo -e "${YELLOW}Checking if Screen Player is installed...${NC}"
    if ! adb shell pm list packages | grep -q "${PACKAGE_NAME}"; then
        echo -e "${RED}ERROR: Screen Player app is not installed${NC}"
        echo "Please install the APK first:"
        echo "  adb install screenplayer.apk"
        exit 1
    fi
    echo -e "${GREEN}✓ Screen Player is installed${NC}"
    echo ""
}

# Step 1: Check prerequisites
check_connection
check_app_installed

# Step 2: Disable battery optimization
echo -e "${YELLOW}Step 1/6: Disabling battery optimization...${NC}"
adb shell dumpsys deviceidle whitelist "+${PACKAGE_NAME}"
echo -e "${GREEN}✓ Battery optimization disabled${NC}"
echo ""

# Step 3: Set as default launcher
echo -e "${YELLOW}Step 2/6: Setting Screen Player as default launcher...${NC}"
echo -e "${BLUE}  This makes the app the home screen${NC}"
adb shell cmd shortcut set-default-launcher "${PACKAGE_NAME}" "${MAIN_ACTIVITY}" 2>/dev/null || \
adb shell cmd package set-home-activity "${PACKAGE_NAME}/${MAIN_ACTIVITY}"
echo -e "${GREEN}✓ Default launcher set${NC}"
echo ""

# Step 4: Disable competing launchers (THIS IS THE KEY STEP)
echo -e "${YELLOW}Step 3/6: Disabling competing launchers...${NC}"
echo -e "${BLUE}  THIS IS THE MOST IMPORTANT STEP FOR KIOSK MODE${NC}"
echo -e "${BLUE}  Disabling Google TV Launcher prevents HOME button from exiting${NC}"

# Disable Google TV Launcher (common on Android TV boxes)
if adb shell pm disable-user com.google.android.tvlauncher 2>/dev/null; then
    echo -e "${GREEN}  ✓ Disabled Google TV Launcher${NC}"
else
    echo -e "${YELLOW}  ⚠ Google TV Launcher not found or already disabled${NC}"
fi

# Check for other launchers
OTHER_LAUNCHERS=$(adb shell pm list packages -a | grep -E "launcher|home" | grep -v "${PACKAGE_NAME}" | grep -v "com.google.android.leanbacklauncher.partnercustomizer" || true)
if [ -n "$OTHER_LAUNCHERS" ]; then
    echo -e "${YELLOW}  Found other launchers:${NC}"
    echo "$OTHER_LAUNCHERS"
    echo -e "${YELLOW}  You may want to disable these manually${NC}"
fi
echo -e "${GREEN}✓ Competing launchers disabled${NC}"
echo ""

# Step 5: Enable accessibility service
echo -e "${YELLOW}Step 4/6: Enabling accessibility service...${NC}"
echo -e "${BLUE}  NOTE: This may be cleared on reboot but is not critical${NC}"
echo -e "${BLUE}  The disabled launcher is what keeps kiosk mode working${NC}"
adb shell settings put secure enabled_accessibility_services "${ACCESSIBILITY_SERVICE}"
adb shell settings put secure accessibility_enabled 1
echo -e "${GREEN}✓ Accessibility service enabled${NC}"
echo ""

# Step 6: Verify configuration
echo -e "${YELLOW}Step 5/6: Verifying configuration...${NC}"
echo ""
echo "Default launcher:"
adb shell cmd shortcut get-default-launcher 2>/dev/null || echo "  (Could not verify - may need Android 11+)"
echo ""
echo "Disabled launchers:"
adb shell pm list packages -d | grep launcher || echo "  (None disabled)"
echo ""
echo "Accessibility services:"
adb shell settings get secure enabled_accessibility_services
echo ""
echo "Battery whitelist:"
adb shell dumpsys deviceidle whitelist | grep "${PACKAGE_NAME}" || echo "  (Not found)"
echo ""

# Step 7: Important warnings
echo -e "${YELLOW}Step 6/6: Important warnings...${NC}"
echo ""
echo -e "${BLUE}⚠ WARNING: Once kiosk mode is active:${NC}"
echo -e "${BLUE}  - The app may block USB debugging popups${NC}"
echo -e "${BLUE}  - WiFi ADB will be lost after reboot${NC}"
echo -e "${BLUE}  - To regain ADB access, use USB cable or recovery mode${NC}"
echo ""
echo -e "${BLUE}⚠ To exit kiosk mode later (if needed):${NC}"
echo -e "${BLUE}  Option 1: ADB (if connected)${NC}"
echo -e "${BLUE}    adb shell pm enable com.google.android.tvlauncher${NC}"
echo -e "${BLUE}    adb shell cmd package set-home-activity com.google.android.tvlauncher/.MainActivity${NC}"
echo -e "${BLUE}  Option 2: Recovery mode (no physical buttons on ET-N0566)${NC}"
echo -e "${BLUE}    Unplug TV, plug back in, hold MENU+BACK on remote during boot${NC}"
echo -e "${BLUE}  Option 3: Factory reset${NC}"
echo ""

# Final step: Reboot
echo -e "${YELLOW}Setup complete!${NC}"
echo ""
echo -e "${GREEN}After reboot:${NC}"
echo -e "${GREEN}  ✓ Screen Player will auto-start immediately${NC}"
echo -e "${GREEN}  ✓ HOME button will stay in app${NC}"
echo -e "${GREEN}  ✓ BACK button is blocked${NC}"
echo -e "${GREEN}  ✓ App runs in immersive fullscreen${NC}"
echo -e "${GREEN}  ✓ Content will download automatically${NC}"
echo ""
read -p "Press Enter to reboot now, or Ctrl+C to cancel..."
adb reboot

echo ""
echo -e "${GREEN}✓ TV is rebooting...${NC}"
echo -e "${YELLOW}Wait 30-60 seconds for Screen Player to start${NC}"
echo ""
echo -e "${BLUE}NOTE: You will lose WiFi ADB connection after reboot.${NC}"
echo -e "${BLUE}To reconnect, use USB cable and run: adb tcpip 5555${NC}"
