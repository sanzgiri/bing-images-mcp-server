import SwiftUI

struct QuizSheet: View {
    @Environment(\.dismiss) private var dismiss
    let image: ImageDetails
    let api: APIClient
    @State private var quiz: QuizResponse?
    @State private var selected: Int?
    @State private var current = 0
    @State private var score = 0
    @State private var error: String?

    var body: some View {
        NavigationStack { Group { if let quiz, current < quiz.questions.count { questionView(quiz.questions[current], total: quiz.questions.count) } else if quiz != nil { resultView } else if let error { ContentUnavailableView("Quiz unavailable", systemImage: "exclamationmark.triangle", description: Text(error)) } else { ProgressView("Generating your quiz…") } }.padding().navigationTitle("Image Quiz").toolbar { Button("Done") { dismiss() } } }.task { await load() }
    }

    private func questionView(_ question: QuizQuestion, total: Int) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Question \(current + 1) of \(total)").foregroundStyle(.secondary)
                Spacer()
                Text("Score: \(score)").foregroundStyle(.secondary)
            }
            Text(question.question).font(.title3.bold())
            ForEach(Array(question.choices.enumerated()), id: \.offset) { index, choice in
                Button { select(index, answer: question.answerIndex) } label: {
                    HStack {
                        Text("\(String(UnicodeScalar(65 + index)!)).")
                        Text(choice)
                        Spacer()
                        if selected != nil && index == question.answerIndex {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
                .buttonStyle(.bordered)
                .tint(selected == nil ? .accentColor : (index == question.answerIndex ? .green : .red))
                .disabled(selected != nil)
            }
            if selected != nil {
                VStack(alignment: .leading, spacing: 8) {
                    Text(question.explanation)
                    if let fact = question.funFact {
                        Text("Did you know? \(fact)").font(.footnote).foregroundStyle(.secondary)
                    }
                    Button(current + 1 == total ? "See result" : "Next") {
                        if current + 1 == total {
                            current += 1
                        } else {
                            current += 1
                            selected = nil
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .background(.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
            }
            Spacer()
        }
    }

    private var resultView: some View { VStack(spacing: 18) { Spacer(); Text("You scored \(score) / \(quiz?.questions.count ?? 0)").font(.title.bold()); Text(score == quiz?.questions.count ? "Perfect run! 🎉" : "Nice work!").foregroundStyle(.secondary); Spacer(); Button("Done") { dismiss() }.buttonStyle(.borderedProminent) } }
    private func select(_ index: Int, answer: Int) { guard selected == nil else { return }; selected = index; if index == answer { score += 1 } }
    private func load() async { do { quiz = try await api.fetchQuiz(for: image) } catch { error = error.localizedDescription } }
}
