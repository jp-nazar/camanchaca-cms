# Android TV Image Quality — Findings & Improvement Plan

> **Status:** Research complete. JPEG quality default changed from 85 → 95.
>
> **Created:** 2026-05-25
>
> **Last updated:** 2026-05-25 — Changed `deviceImageQuality` default to 95 in `server/config.js`
>
> **Context:** Session investigating image quality loss on Android TV APK, comparing APK vs browser kiosk approaches, and evaluating Fully Kiosk as an alternative.

---

## 1. The Problem

Images and dashboards (Power BI, Looker Studio, custom URLs) appear pixelated or soft on Android TV compared to the web player or admin preview.

**User assumption:** The APK is the problem.

**Actual root cause:** The **server aggressively downsamples all images** served to Android clients before they ever reach the device.

---

## 2. Current Image Pipeline (Server → Android)

```
Original Upload / Integration Fetch
    ↓
[Server] sharp().resize(1920, 1080, {fit: 'inside'}).jpeg({quality: 95})
    ↓
Saved as content.optimized_filepath
    ↓
/api/content/:id/file serves optimized variant to Android
    ↓
[APK] BitmapFactory.decodeFile() with inSampleSize power-of-2 downsampling
    ↓
ImageView.setImageBitmap() — GPU scales to screen
```

**Two separate quality loss stages:**

### Stage 1: Server-Side (Most Impact)

| Setting | Value | Location | Effect |
|---------|-------|----------|--------|
| Max width | 1920 | `server/config.js:30` | Hard cap — 4K TVs upscale 2x |
| Max height | 1080 | `server/config.js:31` | Hard cap — 4K TVs upscale 2x |
| JPEG quality | ~~85~~ → **95** | `server/config.js:32` | Lossy re-encode. Raised to 95 on 2026-05-25 for sharper dashboards. |
| Fit mode | `inside` | `server/routes/content.js` | Never enlarges, may undershoot |
| Format forced | JPEG | `server/routes/content.js` | PNG dashboards lose sharpness |

**Code locations:**
- Upload: `server/routes/content.js:113-122`
- Replace: `server/routes/content.js:317-326`
- Integration refresh: `server/services/integration-worker.js:163-170`
- Config defaults: `server/config.js:27-32`
- Serving logic: `server/server.js:264` (serves `optimized_filepath` or falls back to `filepath`)

**Key issue:** There is **no device capability negotiation**. A 4K TV and a 1080p tablet both get the same 1920x1080 JPEG image.

> **Update 2026-05-25:** Default JPEG quality raised from 85 to 95. Existing optimized images keep their old quality until re-uploaded or refreshed.

### Stage 2: Android-Side (Less Impact After Fix)

**Recent fix (commit `4a11a57`):**
- `ImageLoader.kt:88-98` — Added backoff logic to prevent power-of-2 `inSampleSize` from undershooting target resolution and causing upscaling pixelation.

**Current behavior:**
- `BitmapFactory` decodes with `inSampleSize` (power of 2)
- `ImageView` in single-zone mode uses `scaleType="fitCenter"` (`android/app/src/main/res/layout/activity_main.xml:26`)
- Zone mode uses `CENTER_CROP` / `FIT_CENTER` / `FIT_XY` based on zone config (`ZoneManager.kt:164-169`)

**The Android-side fix is good, but it can't recover detail already lost by server-side JPEG 85 + 1920 cap.**

---

## 3. Specific Quality Loss Scenarios

### Scenario A: 4K TV (3840×2160) + Any Image

- Server serves 1920×1080 max
- TV upscales 2x via GPU bilinear scaling
- **Result:** Soft, not pixelated, but noticeably less sharp than original

### Scenario B: Power BI Dashboard (PNG with fine text)

- Integration worker fetches crisp PNG from Power BI ExportTo API
- Server converts to JPEG quality 85
- Text edges get ringing/artifacts
- **Result:** Dashboard text looks blurry or compressed

### Scenario C: Wide Panoramic Image (4000×1080)

- Server `fit: 'inside'` with 1920 cap → scales to 1920×518
- TV displays at full width, height is tiny
- **Result:** Black bars, wasted resolution

### Scenario D: Small Image (1280×720)

- `withoutEnlargement: true` means it stays 1280×720
- TV upscales to fill screen
- **Result:** Soft

---

## 4. Comparison: APK vs Browser vs Fully Kiosk

### The APK

**Pros:**
- Foreground service + wake lock = survives reboot, Doze, overnight
- Auto-starts on boot (`BootReceiver.kt`)
- True kiosk (traps HOME/BACK, immersive fullscreen)
- Screenshots, telemetry, remote control via WebSocket
- OTA updates from `/api/update/check`
- ExoPlayer for hardware-accelerated video
- `ImageLoader.kt` now handles memory-efficient decoding correctly

**Cons:**
- Receives server-downsampled images (same as any Android client)
- Build complexity (Gradle, Android SDK, signing)
- Native code maintenance

### Browser (Chrome/Firefox on Android TV)

**Pros:**
- No build step, just navigate to `/player`
- Always gets latest web player code

**Cons:**
- No auto-start on boot
- No wake lock (browser tab gets throttled/killed by Doze after ~48h)
- Can't trap HOME/BACK
- Background tab throttling freezes timers
- After power outage or weekend = black screen until manual intervention
- **Same image quality as APK** (server still serves 1920×1080 JPEG 85)

### Fully Kiosk Browser

**Pros:**
- True kiosk lockdown (fullscreen, trap HOME/BACK)
- Auto-start on boot
- Motion detection, screensaver
- Remote admin via Fully Cloud
- JavaScript API for integration
- €8.90/device one-time

**Cons:**
- Still a WebView — WebSocket lives in a browser process, not a foreground service
- No screenshots pushed to your server dashboard
- No telemetry (battery, CPU, storage, WiFi)
- No remote touch/key injection via your WebSocket protocol
- No OTA via your `/api/update/check` endpoint
- **Same image quality as APK** (server still serves 1920×1080 JPEG 85)
- Additional licensing cost

### Bottom Line

> **The image quality issue is server-side, not client-side.** Switching to a browser or Fully Kiosk will NOT improve image quality. The only way to improve quality is to change what the server sends.

---

## 5. Proposed Solutions

### Solution 1: Environment Variables for Tuning (Partially Implemented)

Env vars already exist for tuning. Default quality was raised to 95 on 2026-05-25.

```bash
# In server/.env

# Override the defaults (current defaults: 1920x1080, quality 95)
DEVICE_IMAGE_MAX_WIDTH=1920
DEVICE_IMAGE_MAX_HEIGHT=1080
DEVICE_IMAGE_QUALITY=95

# Future: disable optimization entirely
# DEVICE_OPTIMIZATION_ENABLED=false

# Future: keep PNG format for integrations
# DEVICE_IMAGE_FORMAT=png
```

**Pros:**
- Zero code changes for different deployments
- Easy A/B testing
- Backward compatible (defaults to current behavior)

**Cons:**
- `DEVICE_IMAGE_FORMAT=png` requires handling different formats per content type
- Higher quality = larger files = more bandwidth

**Implementation sketch:**
- `server/config.js` — add `deviceOptimizationEnabled`, `deviceImageFormat`
- `server/routes/content.js` — skip optimization if disabled
- `server/services/integration-worker.js` — skip optimization if disabled
- `server/server.js` — serve `filepath` instead of `optimized_filepath` if disabled

### Solution 2: Per-Device Resolution Negotiation

Allow the Android app to report its screen resolution on registration, and the server serves appropriately sized variants.

```javascript
// Android sends on connect:
socket.emit('device:register', {
  ...,
  screen_width: 3840,
  screen_height: 2160
});

// Server stores in devices table and uses for content serving
```

**Pros:**
- 1080p devices get small files, 4K devices get crisp images
- Future-proof

**Cons:**
- More complex (DB migration, new column, serving logic)
- Requires APK update to report resolution
- More storage (multiple variants per image)

### Solution 3: Serve Originals to Android

Remove server-side optimization entirely for Android clients. The APK's `ImageLoader.kt` already handles efficient decoding.

**Pros:**
- Simplest implementation
- Maximum quality
- No env vars needed

**Cons:**
- APK must handle large files (e.g., 20MB camera photos)
- `ImageLoader.kt` may need additional memory management for huge images
- More bandwidth usage

### Solution 4: Hybrid — Originals for Integrations, Optimized for Photos

Integration dashboards need maximum quality (text, UI). Photos/videos can tolerate compression.

**Logic:**
- If `content.mime_type` is `image/png` or comes from an integration → serve original
- If `content.mime_type` is `image/jpeg` and file > 5MB → serve optimized

**Pros:**
- Targeted fix for the worst quality loss (dashboards)
- Keeps bandwidth reasonable for photos

**Cons:**
- More complex serving logic
- Less predictable behavior

---

## 6. Recommended Next Steps

### Immediate (No Code)
1. Decide on target image quality strategy (env vars vs originals vs hybrid)
2. Test current quality on 4K TV vs 1080p TV to confirm resolution cap impact
3. Compare Power BI dashboard quality: admin download vs Android display

### Short Term
1. Add `DEVICE_OPTIMIZATION_ENABLED` and `DEVICE_IMAGE_QUALITY` env vars
2. Update `server/config.js` to read them
3. Update `server/routes/content.js`, `integration-worker.js`, and `server.js` to respect them
4. Update `AGENTS.md` and `docs/GUIA_IT.md` with new env vars

### Long Term
1. Consider per-device resolution negotiation (Solution 2) if deploying mixed 1080p/4K fleets
2. Evaluate if WebView-based APK (pointing at `/player`) could reduce native maintenance while keeping service/wake lock benefits

---

## 7. Relevant Files for Future Sessions

| File | Purpose | Relevant Lines |
|------|---------|----------------|
| `server/config.js` | Env var defaults | 27-32 |
| `server/routes/content.js` | Upload/replace optimization | 113-122, 317-326 |
| `server/services/integration-worker.js` | Integration refresh optimization | 163-170 |
| `server/server.js` | Content serving logic | 264 |
| `server/db/database.js` | Migration for `optimized_filepath` | ~103 |
| `server/db/schema.sql` | Schema | 93 |
| `android/app/.../ImageLoader.kt` | Android decode logic | 88-98 |
| `android/app/.../ZoneManager.kt` | Multi-zone image display | 164-169 |
| `android/app/.../MediaPlayerManager.kt` | Single-zone image display | 97-113 |
| `android/app/.../ContentCache.kt` | File caching | 48-50 |
| `server/player/index.html` | Web player | 127-1291 (WebSocket, wake lock) |

---

## 8. Commit History

- **`4a11a57`** — Fixed Android pixelation from power-of-2 downsampling + added server-side device-optimized JPEG generation
  - `ImageLoader.kt` — backs off inSampleSize to prevent undershooting
  - Server — generates 1920×1080 JPEG 85 on upload/replace/integration refresh
  - DB — added `content.optimized_filepath`

---

## 9. Open Questions

1. What is the native resolution of the TVs in production? (1080p vs 4K)
2. Is the quality issue worse on dashboards (Power BI/Looker) or photos/videos?
3. What is the typical file size of uploaded images? (Are 20MB+ camera photos common?)
4. Would the user accept a WebView-based APK that points at `/player` but retains the foreground service, wake lock, and boot receiver?
5. What bandwidth constraints exist? (Mobile data vs local WiFi)

---

*Document created for context preservation across sessions. No code changes made.*
