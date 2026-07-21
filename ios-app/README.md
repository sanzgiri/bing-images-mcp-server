# Bing Image of the Day — iOS

Native SwiftUI client for the approved web-app experience. Images are fetched dynamically from the deployed Next.js backend; the OpenAI key remains server-side.

## Resume on a Mac with Xcode

1. Open this repository in Codex on the Mac with Xcode installed.
2. Verify Xcode is selected:

   ```bash
   xcode-select -p
   xcodebuild -version
   ```

   If needed:

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   ```

3. Connect the iPhone, enable Developer Mode, trust the Mac, and confirm the Apple ID is available under Xcode’s signing settings.
4. Use XcodeBuildMCP to generate/open an iOS app project for the Swift sources in this folder. Set a unique bundle identifier and the connected iPhone as the target device.
5. Build and install on the physical device with XcodeBuildMCP. If signing asks for a team, select the configured Apple ID team.
6. Launch the app and verify image loading, “Another image,” details, quiz, and chat.

## Current implementation

- `BingImageApp/ContentView.swift`: full-screen image UI, header, details card, quiz/chat sheet presentation, loading and error states.
- `BingImageApp/QuizSheet.swift`: five-question quiz flow and scoring.
- `BingImageApp/ChatSheet.swift`: native chat sheet.
- `BingImageApp/APIClient.swift`: calls the deployed Next.js API at `https://bing-images-mcp-server.vercel.app`.
- `BingImageApp/Models.swift`: API and UI models.
- `Package.swift`: Swift package manifest for the source module.

The Swift files passed syntax parsing on the original Mac, but a full Xcode build and device install have not yet run because that Mac only had Command Line Tools selected.

## Cost recommendation

The web backend currently uses `gpt-4o` for chat and `gpt-4o-mini` for quizzes. For the cheapest practical setup, change the chat route in `web-app/app/api/chat/route.ts` to:

```ts
model: openai('gpt-4o-mini')
```

The quiz already uses `gpt-4o-mini`. Keep the OpenAI API key on the server; never put it in the iOS app.
