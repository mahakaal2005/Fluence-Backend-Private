# Instagram Integration for Flutter Apps

This guide explains how to set up Instagram OAuth for Flutter mobile applications.

## Key Differences: Flutter vs Web

### Web Apps
- Use HTTP/HTTPS redirect URIs
- Backend redirects to frontend URL after OAuth
- Example: `https://yourdomain.com/api/social/instagram/callback`

### Flutter Apps
- Use **deep links** (custom URL schemes)
- App handles the callback directly
- Example: `myapp://instagram/callback`
- **FRONTEND_URL is NOT required** ✅

## Environment Variables for Flutter

### Required Variables

```env
# Instagram OAuth Configuration
INSTAGRAM_APP_ID=your_app_id_here
INSTAGRAM_APP_SECRET=your_app_secret_here

# Deep Link Redirect URI (for Flutter)
INSTAGRAM_REDIRECT_URI=myapp://instagram/callback

# FRONTEND_URL is NOT needed for Flutter apps
# (Only required for web applications)
```

### Important Notes

1. **FRONTEND_URL is NOT required** for Flutter apps
   - The backend will return JSON responses instead of redirecting
   - Your Flutter app handles the deep link callback

2. **Redirect URI Format**
   - Use your app's custom URL scheme
   - Format: `myapp://instagram/callback`
   - Must match what's configured in Meta Developer Console
   - Must match your Flutter app's deep link configuration

## Flutter App Setup

### 1. Configure Deep Links in Flutter

#### Android (AndroidManifest.xml)

```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTop"
    android:exported="true">
    
    <!-- Existing intent filters -->
    
    <!-- Deep link for Instagram callback -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="myapp"
            android:host="instagram"
            android:pathPrefix="/callback" />
    </intent-filter>
</activity>
```

#### iOS (Info.plist)

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.yourapp.instagram</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>myapp</string>
        </array>
    </dict>
</array>
```

### 2. Handle Deep Links in Flutter

```dart
import 'package:flutter/material.dart';
import 'package:uni_links/uni_links.dart';
import 'dart:async';

class InstagramOAuthHandler {
  StreamSubscription? _linkSubscription;

  void initDeepLinkListener() {
    // Listen for deep links when app is already running
    _linkSubscription = linkStream.listen((String? link) {
      if (link != null) {
        _handleDeepLink(link);
      }
    }, onError: (err) {
      print('Deep link error: $err');
    });
  }

  void _handleDeepLink(String link) {
    final uri = Uri.parse(link);
    
    if (uri.scheme == 'myapp' && uri.host == 'instagram') {
      if (uri.queryParameters.containsKey('code')) {
        // Success - got authorization code
        final code = uri.queryParameters['code'];
        final state = uri.queryParameters['state'];
        
        // Send code to your backend to complete OAuth
        _completeOAuthFlow(code!, state);
      } else if (uri.queryParameters.containsKey('error')) {
        // Error - authorization failed
        final error = uri.queryParameters['error'];
        _handleOAuthError(error ?? 'Unknown error');
      }
    }
  }

  Future<void> _completeOAuthFlow(String code, String? state) async {
    try {
      // Option 1: Let backend handle everything (recommended)
      // The backend callback endpoint will process the code
      // You just need to listen for the deep link
      
      // Option 2: Send code to your backend API
      final response = await http.post(
        Uri.parse('https://your-api.com/api/social/instagram/complete'),
        headers: {
          'Authorization': 'Bearer $userToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'code': code,
          'state': state,
        }),
      );
      
      if (response.statusCode == 200) {
        // Success - account connected
        _showSuccess();
      } else {
        // Error
        _showError('Failed to connect Instagram account');
      }
    } catch (e) {
      _handleOAuthError(e.toString());
    }
  }

  void _handleOAuthError(String error) {
    // Show error to user
    print('OAuth error: $error');
  }

  void _showSuccess() {
    // Show success message
    // Refresh connected accounts list
  }

  void dispose() {
    _linkSubscription?.cancel();
  }
}
```

### 3. Initiate OAuth Flow

```dart
Future<void> connectInstagram() async {
  try {
    // Step 1: Call your backend to get OAuth URL
    final response = await http.post(
      Uri.parse('https://your-api.com/api/social/instagram/authorize'),
      headers: {
        'Authorization': 'Bearer $userToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'redirectUri': 'myapp://instagram/callback',
        'useBasicDisplay': true,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      final authUrl = data['authUrl'];
      
      // Step 2: Open Instagram OAuth in browser/webview
      if (await canLaunchUrl(Uri.parse(authUrl))) {
        await launchUrl(
          Uri.parse(authUrl),
          mode: LaunchMode.externalApplication,
        );
      } else {
        throw Exception('Could not launch $authUrl');
      }
      
      // Step 3: Deep link listener will handle the callback
      // (already set up in initDeepLinkListener)
    }
  } catch (e) {
    print('Error initiating Instagram OAuth: $e');
  }
}
```

### 4. Handle App Launch from Deep Link

```dart
Future<void> initUniLinks() async {
  // Handle deep link when app is launched from deep link
  try {
    final initialLink = await getInitialLink();
    if (initialLink != null) {
      _handleDeepLink(initialLink);
    }
  } on PlatformException {
    // Handle exception
  }
}
```

## Complete Flutter Example

```dart
import 'package:flutter/material.dart';
import 'package:uni_links/uni_links.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

class InstagramConnectScreen extends StatefulWidget {
  @override
  _InstagramConnectScreenState createState() => _InstagramConnectScreenState();
}

class _InstagramConnectScreenState extends State<InstagramConnectScreen> {
  StreamSubscription? _linkSubscription;
  bool _isConnecting = false;

  @override
  void initState() {
    super.initState();
    _initDeepLinkListener();
    _initUniLinks();
  }

  void _initDeepLinkListener() {
    _linkSubscription = linkStream.listen((String? link) {
      if (link != null) {
        _handleDeepLink(link);
      }
    }, onError: (err) {
      print('Deep link error: $err');
    });
  }

  Future<void> _initUniLinks() async {
    try {
      final initialLink = await getInitialLink();
      if (initialLink != null) {
        _handleDeepLink(initialLink);
      }
    } catch (e) {
      print('Error getting initial link: $e');
    }
  }

  void _handleDeepLink(String link) {
    final uri = Uri.parse(link);
    
    if (uri.scheme == 'myapp' && uri.host == 'instagram') {
      if (uri.queryParameters.containsKey('code')) {
        final code = uri.queryParameters['code'];
        final state = uri.queryParameters['state'];
        _completeOAuthFlow(code!, state);
      } else if (uri.queryParameters.containsKey('error')) {
        final error = uri.queryParameters['error'];
        _showError(error ?? 'Authorization failed');
      }
    }
  }

  Future<void> _completeOAuthFlow(String code, String? state) async {
    setState(() => _isConnecting = true);
    
    try {
      // The backend callback endpoint handles everything automatically
      // But you can also verify by checking connected accounts
      await Future.delayed(Duration(seconds: 2)); // Wait for backend processing
      
      // Fetch updated accounts
      await _fetchConnectedAccounts();
      
      _showSuccess();
    } catch (e) {
      _showError('Failed to connect Instagram account');
    } finally {
      setState(() => _isConnecting = false);
    }
  }

  Future<void> connectInstagram() async {
    setState(() => _isConnecting = true);
    
    try {
      final response = await http.post(
        Uri.parse('https://your-api.com/api/social/instagram/authorize'),
        headers: {
          'Authorization': 'Bearer ${await getUserToken()}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'redirectUri': 'myapp://instagram/callback',
          'useBasicDisplay': true,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'];
        final authUrl = data['authUrl'];
        
        if (await canLaunchUrl(Uri.parse(authUrl))) {
          await launchUrl(
            Uri.parse(authUrl),
            mode: LaunchMode.externalApplication,
          );
        }
      } else {
        _showError('Failed to initiate Instagram connection');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      setState(() => _isConnecting = false);
    }
  }

  Future<void> _fetchConnectedAccounts() async {
    // Fetch connected accounts to verify
  }

  void _showSuccess() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Instagram connected successfully!')),
    );
    Navigator.pop(context);
  }

  void _showError(String error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error), backgroundColor: Colors.red),
    );
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Connect Instagram')),
      body: Center(
        child: ElevatedButton(
          onPressed: _isConnecting ? null : connectInstagram,
          child: _isConnecting 
            ? CircularProgressIndicator()
            : Text('Connect Instagram'),
        ),
      ),
    );
  }
}
```

## Required Flutter Packages

Add these to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  uni_links: ^0.5.1  # For deep link handling
  url_launcher: ^6.2.0  # For opening OAuth URLs
  http: ^1.1.0  # For API calls
```

## Meta Developer Console Configuration

1. Go to your app in Meta Developer Console
2. Go to **Settings** → **Basic**
3. Add **Valid OAuth Redirect URIs**:
   - `myapp://instagram/callback`
   - Make sure it matches your Flutter app's deep link scheme

## Flow for Flutter Apps

```
1. User taps "Connect Instagram" in Flutter app
   ↓
2. Flutter app calls: POST /api/social/instagram/authorize
   Body: { redirectUri: "myapp://instagram/callback" }
   ↓
3. Backend returns authUrl
   ↓
4. Flutter app opens authUrl in browser/webview
   ↓
5. User logs in and authorizes on Instagram
   ↓
6. Instagram redirects to: myapp://instagram/callback?code=XXX&state=YYY
   ↓
7. Flutter app receives deep link
   ↓
8. Backend callback endpoint processes code automatically
   (OR Flutter app sends code to backend)
   ↓
9. Account connected! ✅
```

## Summary

**For Flutter Apps:**
- ✅ **FRONTEND_URL is NOT required**
- ✅ Use deep link: `myapp://instagram/callback`
- ✅ Configure deep links in AndroidManifest.xml and Info.plist
- ✅ Handle deep links with `uni_links` package
- ✅ Backend returns JSON instead of redirecting

**Environment Variables:**
```env
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_REDIRECT_URI=myapp://instagram/callback
# FRONTEND_URL not needed for Flutter
```

