# How to Get/Set Instagram Redirect URI for Flutter App

The redirect URI for Flutter apps is a **deep link** that you define yourself. It's not something you "get" - you create it based on your app's URL scheme.

## What is a Redirect URI for Flutter?

For Flutter apps, the redirect URI is a **custom URL scheme** (deep link) that your app can handle. It looks like:

```
yourappscheme://instagram/callback
```

Examples:
- `fluence://instagram/callback`
- `myapp://instagram/callback`
- `com.yourapp://instagram/callback`

## Step-by-Step Guide

### Step 1: Choose Your App's URL Scheme

You need to decide on a unique URL scheme for your app. Common formats:

1. **App Name** (simplest):
   ```
   fluence://
   ```

2. **Reverse Domain** (more unique):
   ```
   com.fluence.app://
   ```

3. **Company + App**:
   ```
   fluencepay://
   ```

**Recommendation**: Use your app name in lowercase (e.g., `fluence://`)

### Step 2: Configure Deep Links in Flutter

#### For Android (android/app/src/main/AndroidManifest.xml)

Add this inside your `<activity>` tag:

```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTop"
    android:exported="true">
    
    <!-- Existing intent filters -->
    
    <!-- Deep link for Instagram OAuth callback -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="fluence"
            android:host="instagram"
            android:pathPrefix="/callback" />
    </intent-filter>
</activity>
```

**Important**: Replace `fluence` with your chosen URL scheme.

#### For iOS (ios/Runner/Info.plist)

Add this inside the root `<dict>`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.fluence.instagram</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>fluence</string>
        </array>
    </dict>
</array>
```

**Important**: Replace `fluence` with your chosen URL scheme.

### Step 3: Build Your Redirect URI

Based on your URL scheme, your redirect URI will be:

```
your_scheme://instagram/callback
```

**Examples:**
- If scheme is `fluence` → `fluence://instagram/callback`
- If scheme is `myapp` → `myapp://instagram/callback`
- If scheme is `com.fluence.app` → `com.fluence.app://instagram/callback`

### Step 4: Add Redirect URI to Meta Developer Console

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app
3. Go to **Settings** → **Basic**
4. Scroll down to **"Valid OAuth Redirect URIs"**
5. Click **"Add URI"**
6. Enter your redirect URI (e.g., `fluence://instagram/callback`)
7. Click **"Save Changes"**

**Important**: The redirect URI in Meta Console must match exactly what you put in your `.env` file.

### Step 5: Add to .env File

Add the redirect URI to your `social-features-service/.env`:

```env
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback
```

Replace `fluence` with your actual URL scheme.

## Complete Example

Let's say your app is called "Fluence" and you choose `fluence` as your URL scheme:

### 1. AndroidManifest.xml
```xml
<data
    android:scheme="fluence"
    android:host="instagram"
    android:pathPrefix="/callback" />
```

### 2. Info.plist
```xml
<string>fluence</string>
```

### 3. Meta Developer Console
```
Valid OAuth Redirect URIs:
fluence://instagram/callback
```

### 4. .env File
```env
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback
```

## How to Find Your Existing URL Scheme

If your Flutter app already has a URL scheme configured:

### Check AndroidManifest.xml
Look for existing `<intent-filter>` with `<data android:scheme="...">`

### Check Info.plist
Look for `CFBundleURLSchemes` array

### Check pubspec.yaml
Some packages like `uni_links` might have URL scheme configuration

## Testing Your Redirect URI

### 1. Test Deep Link on Android

```bash
# Using ADB
adb shell am start -W -a android.intent.action.VIEW -d "fluence://instagram/callback?code=test&state=test" com.yourapp.package
```

### 2. Test Deep Link on iOS

```bash
# Using Simulator
xcrun simctl openurl booted "fluence://instagram/callback?code=test&state=test"
```

### 3. Test in Flutter App

```dart
import 'package:url_launcher/url_launcher.dart';

// Test if your app can handle the deep link
void testDeepLink() async {
  final uri = Uri.parse('fluence://instagram/callback?code=test');
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri);
  } else {
    print('Cannot launch deep link');
  }
}
```

## Common Issues and Solutions

### Issue: "Invalid redirect_uri" Error

**Cause**: Redirect URI doesn't match between:
- Meta Developer Console
- .env file
- Flutter app configuration

**Solution**: 
1. Check all three places match exactly
2. No trailing slashes
3. Same case (lowercase recommended)
4. Same scheme name

### Issue: Deep Link Not Opening App

**Cause**: URL scheme not configured in AndroidManifest.xml or Info.plist

**Solution**: 
1. Verify intent-filter is in AndroidManifest.xml
2. Verify CFBundleURLSchemes in Info.plist
3. Rebuild the app after changes

### Issue: App Opens But Doesn't Handle Callback

**Cause**: Deep link listener not set up in Flutter code

**Solution**: 
1. Install `uni_links` package
2. Set up link stream listener
3. Handle the callback URL

## Quick Checklist

- [ ] Choose a URL scheme for your app (e.g., `fluence`)
- [ ] Configure deep link in AndroidManifest.xml
- [ ] Configure deep link in Info.plist
- [ ] Add redirect URI to Meta Developer Console
- [ ] Add redirect URI to .env file
- [ ] Test deep link works
- [ ] Rebuild app after configuration changes

## Example: Complete Setup for "Fluence" App

### URL Scheme: `fluence`

**AndroidManifest.xml:**
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="fluence"
        android:host="instagram"
        android:pathPrefix="/callback" />
</intent-filter>
```

**Info.plist:**
```xml
<key>CFBundleURLSchemes</key>
<array>
    <string>fluence</string>
</array>
```

**Meta Developer Console:**
```
Valid OAuth Redirect URIs:
fluence://instagram/callback
```

**.env File:**
```env
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback
```

**Flutter Code:**
```dart
// Handle deep link
linkStream.listen((String? link) {
  if (link != null && link.contains('fluence://instagram/callback')) {
    // Handle Instagram callback
    final uri = Uri.parse(link);
    final code = uri.queryParameters['code'];
    // Process the code...
  }
});
```

## Summary

1. **Choose a URL scheme** (e.g., `fluence`)
2. **Configure in Android/iOS** (AndroidManifest.xml, Info.plist)
3. **Add to Meta Console** (Valid OAuth Redirect URIs)
4. **Add to .env** (`INSTAGRAM_REDIRECT_URI=fluence://instagram/callback`)
5. **Handle in Flutter** (using uni_links package)

The redirect URI format is: `your_scheme://instagram/callback`

