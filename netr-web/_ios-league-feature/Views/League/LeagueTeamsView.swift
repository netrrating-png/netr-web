// DESTINATION: ios/NETR/Views/League/LeagueTeamsView.swift

import SwiftUI

struct LeagueTeamsView: View {
    let vm: LeagueViewModel
    @State private var search: String = ""

    private var filtered: [LeagueTeam] {
        search.isEmpty ? vm.teams
            : vm.teams.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NETRTheme.background.ignoresSafeArea()
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { team in
                            TeamRow(team: team, vm: vm)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .padding(.bottom, 24)
                }
                .searchable(text: $search, prompt: "Search teams…")
                if vm.isLoading { ProgressView().tint(NETRTheme.neonGreen) }
            }
            .navigationTitle("Teams")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

private struct TeamRow: View {
    let team: LeagueTeam
    let vm: LeagueViewModel

    private var record: String {
        let row = vm.standings.first(where: { $0.teamId == team.id })
        return row?.record ?? "0–0"
    }

    var body: some View {
        HStack(spacing: 14) {
            // Team color circle / logo
            if let logo = team.logoUrl {
                AsyncImage(url: URL(string: logo)) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Circle().fill(team.teamColor)
                }
                .frame(width: 44, height: 44)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(team.teamColor)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Text(String(team.name.prefix(1)))
                            .font(.system(.headline, weight: .black))
                            .foregroundStyle(.white)
                    )
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(team.name)
                    .font(.system(.headline, weight: .bold))
                    .foregroundStyle(NETRTheme.text)
                Text(record)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NETRTheme.subtext)
            }

            Spacer()

            // Crew badge — indicates players can chat
            if team.crewId != nil {
                Label("Crew", systemImage: "bubble.left.and.bubble.right.fill")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(NETRTheme.neonGreen)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(NETRTheme.neonGreen.opacity(0.12), in: Capsule())
            }
        }
        .padding(14)
        .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NETRTheme.border, lineWidth: 1))
    }
}
