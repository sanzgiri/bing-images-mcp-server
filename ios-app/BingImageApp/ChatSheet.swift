import SwiftUI

struct ChatSheet: View {
    @Environment(\.dismiss) private var dismiss
    let image: ImageDetails
    let api: APIClient
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var isSending = false
    @State private var error: String?

    var body: some View {
        NavigationStack { VStack(spacing: 0) { ScrollView { LazyVStack(alignment: .leading, spacing: 12) { if messages.isEmpty { Text("Ask anything about \"\(image.title)\"!").foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.top, 44) }; ForEach(messages) { message in Text(message.text).padding(12).foregroundStyle(message.role == .user ? .white : .primary).background(message.role == .user ? Color.blue : Color.secondary.opacity(0.15), in: RoundedRectangle(cornerRadius: 16)).frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading) } }.padding() }; HStack { TextField("Type a message…", text: $input).textFieldStyle(.roundedBorder); Button { send() } label: { Image(systemName: "arrow.up.circle.fill").font(.title2) }.disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending) }.padding() }.navigationTitle("Ask about this image").toolbar { Button("Done") { dismiss() } }.alert("Chat failed", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") } }
    }

    private func send() { let text = input.trimmingCharacters(in: .whitespacesAndNewlines); guard !text.isEmpty else { return }; input = ""; messages.append(ChatMessage(role: .user, text: text)); isSending = true; Task { do { let reply = try await api.sendChat(messages: messages, for: image); messages.append(ChatMessage(role: .assistant, text: reply)) } catch { error = error.localizedDescription }; isSending = false } }
}
