import SwiftUI

struct ContentView: View {
    @State private var image: ImageDetails?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var presentedSheet: Sheet?
    private let api = APIClient()

    enum Sheet: Identifiable {
        case details(ImageDetails), quiz(ImageDetails), chat(ImageDetails)
        var id: String {
            switch self { case .details: "details"; case .quiz: "quiz"; case .chat: "chat" }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let image {
                AsyncImage(url: image.imageURL) { phase in
                    switch phase {
                    case .success(let picture): picture.resizable().scaledToFill()
                    case .failure: placeholder
                    default: ProgressView().tint(.white)
                    }
                }
                .ignoresSafeArea()
                .overlay(LinearGradient(colors: [.black.opacity(0.35), .clear, .black.opacity(0.9)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
                .overlay(alignment: .top) { header(image) }
                .overlay(alignment: .bottom) { footer(image) }
                .overlay(alignment: .bottomTrailing) { chatButton(image) }
            } else if isLoading {
                ProgressView("Loading today’s image…").tint(.white).foregroundStyle(.white)
            } else {
                errorView
            }
        }
        .task { await loadImage() }
        .sheet(item: $presentedSheet) { sheet in
            switch sheet {
            case .details(let image): DetailsSheet(image: image)
            case .quiz(let image): QuizSheet(image: image, api: api)
            case .chat(let image): ChatSheet(image: image, api: api)
            }
        }
    }

    private func header(_ image: ImageDetails) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Bing Image of the Day").font(.title2.bold())
                Text("Powered by Peapix").font(.subheadline).foregroundStyle(.white.opacity(0.72))
                Button { presentedSheet = .quiz(image) } label: {
                    Label("Quiz me", systemImage: "brain.head.profile").font(.subheadline.bold()).padding(.horizontal, 15).padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent).tint(.pink)
                .padding(.top, 10)
            }
            Spacer()
            Button { Task { await loadImage() } } label: {
                Text("Another image").font(.subheadline).padding(.horizontal, 12).padding(.vertical, 8)
            }.buttonStyle(.bordered).tint(.white)
        }
        .foregroundStyle(.white).padding(.horizontal).padding(.top, 8)
    }

    private func footer(_ image: ImageDetails) -> some View {
        Button { presentedSheet = .details(image) } label: {
            VStack(alignment: .leading, spacing: 7) {
                Text(image.title).font(.title3.bold()).multilineTextAlignment(.leading)
                if let description = image.description { Text(description).font(.subheadline).foregroundStyle(.white.opacity(0.75)).lineLimit(2) }
                Label("View details", systemImage: "info.circle").font(.subheadline).foregroundStyle(.white.opacity(0.75))
            }.frame(maxWidth: .infinity, alignment: .leading).padding(18)
        }.buttonStyle(.plain).foregroundStyle(.white).background(.black.opacity(0.38), in: RoundedRectangle(cornerRadius: 18)).padding()
    }

    private func chatButton(_ image: ImageDetails) -> some View {
        Button { presentedSheet = .chat(image) } label: { Image(systemName: "message.fill").font(.title3).padding(18) }
            .buttonStyle(.borderedProminent).tint(.black.opacity(0.65)).foregroundStyle(.white).clipShape(Circle()).padding(.trailing, 22).padding(.bottom, 112).accessibilityLabel("Ask about this image")
    }

    private var placeholder: some View { Color.gray.opacity(0.3).overlay(Image(systemName: "photo").font(.largeTitle).foregroundStyle(.white.opacity(0.6))) }
    private var errorView: some View { VStack(spacing: 14) { Text(errorMessage ?? "Failed to load image.").foregroundStyle(.white).multilineTextAlignment(.center); Button("Try again") { Task { await loadImage() } }.buttonStyle(.borderedProminent) }.padding() }
    private func loadImage() async { isLoading = true; errorMessage = nil; do { image = try await api.fetchRandomImage() } catch { errorMessage = error.localizedDescription }; isLoading = false }
}

struct DetailsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let image: ImageDetails
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 16) { Text(image.title).font(.title.bold()); if let description = image.description { Text(description).foregroundStyle(.secondary) }; if let full = image.fullDescription { Text(full) }; if let url = image.pageURL { Link("View on Peapix", destination: url).font(.headline) } }.padding() }.navigationTitle("Image details").toolbar { Button("Done") { dismiss() } } }
    }
}
