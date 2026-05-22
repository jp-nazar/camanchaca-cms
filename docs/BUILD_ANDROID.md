# Build de Android TV Player

## Requisitos del proyecto

| Parámetro | Valor |
|-----------|-------|
| Gradle | 8.5 (via wrapper) |
| JDK | 17 |
| Android SDK | platforms;android-34, build-tools;34.0.0 |
| compileSdk | 34 |
| minSdk | 26 |
| targetSdk | 34 |
| AGP | 8.2.0 |
| Kotlin | 1.9.20 |
| NDK | No requerido |

## Prerequisitos (one-time)

### 1. JDK 17

```bash
brew install openjdk@17

# Agregar al ~/.zshrc
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH
```

### 2. Android SDK

```bash
brew install --cask android-commandlinetools

# Agregar al ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH

# Instalar SDK packages
yes | sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

### 3. Keystore para firmar

```bash
cd android
keytool -genkey -v -keystore release-key.jks -alias remotedisplay \
  -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS
cd ..
```

Si es solo para ADB/pendrive (no Google Play), cualquier contraseña sirve. La keystore generada es descartable.

### 4. Variables de entorno para signing

El build lee las contraseñas del keystore desde variables de entorno:

```bash
export KEYSTORE_PASSWORD="tu-password"
export KEY_ALIAS="remotedisplay"
export KEY_PASSWORD="tu-password"
```

O desde `android/gradle.properties`:

```properties
KEYSTORE_PASSWORD=tu-password
KEY_ALIAS=remotedisplay
KEY_PASSWORD=tu-password
```

### 5. Archivo local.properties

Indica dónde está el Android SDK. Crea `android/local.properties`:

```properties
sdk.dir=/Users/juanpablo.nazar/Library/Android/sdk
```

## Build

### Debug (para ADB / pendrive)

```bash
cd android
KEYSTORE_PASSWORD="pass" KEY_ALIAS="remotedisplay" KEY_PASSWORD="pass" \
  ./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

El APK final se copia a la raíz del proyecto como `camanchaca-player.apk`. El servidor lo sirve desde `/api/update/check` para actualizaciones OTA.

### Release

```bash
cd android
KEYSTORE_PASSWORD="pass" KEY_ALIAS="remotedisplay" KEY_PASSWORD="pass" \
  ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Notas

- **No requiere NDK** — el proyecto es Kotlin puro.
- **Debug build usa la misma keystore que release** (configurado en `app/build.gradle.kts`). Alternativamente, cambiar a `signingConfig = signingConfigs.getByName("debug")` para usar la debug keystore automática de Android SDK.
- **No hay Google Play Services ni Firebase** — no necesita cuenta de Google para funcionar.
- **minSdk 26** = Android 8.0 (Oreo). Compatible con la mayoría de TVs Android del mercado.

## Cambios realizados para cache-busting de integraciones

Archivos modificados para que el player detecte cambios en contenido de Power BI / integraciones:

| Archivo | Cambio |
|---------|--------|
| `PlaylistController.kt` | `PlaylistItem.contentVersion` field + parse + diff por `contentId:contentVersion` |
| `ContentCache.kt` | Cache version-aware: archivos `{id}_v{version}.ext`, URL con `?v=` |
| `MainActivity.kt` | Pasa `contentVersion` a isContentCached/downloadContent |
