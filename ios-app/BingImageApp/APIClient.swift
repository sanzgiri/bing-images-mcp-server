import Foundation

enum APIError: LocalizedError {
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "The server returned an invalid response."
        case .server(let message): return message
        }
    }
}

struct APIClient {
    // Uses the deployed Next.js API, which keeps the OpenAI key and Peapix proxy server-side.
    let baseURL = URL(string: "https://bing-images-mcp-server.vercel.app")!

    func fetchRandomImage() async throws -> ImageDetails {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/bing-image"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "country", value: "us"),
            URLQueryItem(name: "random", value: "true")
        ]
        let (data, response) = try await URLSession.shared.data(from: components.url!)
        try validate(response, data: data)
        return try JSONDecoder().decode(ImageDetails.self, from: data)
    }

    func fetchQuiz(for image: ImageDetails) async throws -> QuizResponse {
        try await post(path: "api/quiz", body: ["imageContext": image])
    }

    func sendChat(messages: [ChatMessage], for image: ImageDetails) async throws -> String {
        let apiMessages = messages.map { ["role": $0.role == .user ? "user" : "assistant", "content": $0.text] }
        let body: [String: Any] = [
            "messages": apiMessages,
            "imageContext": image.dictionary
        ]
        let data = try JSONSerialization.data(withJSONObject: body)
        var request = URLRequest(url: baseURL.appendingPathComponent("api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        let (responseData, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: responseData)
        return String(decoding: responseData, as: UTF8.self)
    }

    private func post<T: Decodable>(path: String, body: [String: Any]) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(String(decoding: data, as: UTF8.self))
        }
    }
}

private extension Encodable {
    var dictionary: [String: Any] {
        guard let data = try? JSONEncoder().encode(self),
              let object = try? JSONSerialization.jsonObject(with: data),
              let dictionary = object as? [String: Any] else { return [:] }
        return dictionary
    }
}
