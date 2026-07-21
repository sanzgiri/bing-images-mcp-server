import Foundation

struct ImageDetails: Codable, Identifiable, Hashable {
    let title: String
    let imageURL: URL?
    let description: String?
    let fullDescription: String?
    let pageURL: URL?

    var id: String { imageURL?.absoluteString ?? title }

    enum CodingKeys: String, CodingKey {
        case title
        case imageURL = "image_url"
        case description
        case fullDescription = "full_description"
        case pageURL = "page_url"
    }
}

struct QuizResponse: Codable {
    let questions: [QuizQuestion]
}

struct QuizQuestion: Codable, Identifiable {
    let kind: String?
    let question: String
    let choices: [String]
    let answerIndex: Int
    let explanation: String
    let funFact: String?

    var id: String { question }

    enum CodingKeys: String, CodingKey {
        case kind, question, choices
        case answerIndex
        case explanation, funFact
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: Role
    let text: String

    enum Role { case user, assistant }
}
