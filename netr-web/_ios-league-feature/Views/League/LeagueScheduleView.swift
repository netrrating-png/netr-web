// DESTINATION: ios/NETR/Views/League/LeagueScheduleView.swift

import SwiftUI

struct LeagueScheduleView: View {
    let vm: LeagueViewModel
    @State private var filter: ScheduleFilter = .upcoming

    enum ScheduleFilter: String, CaseIterable {
        case upcoming = "Upcoming"
        case completed = "Results"
        case all = "All"
    }

    private var filtered: [LeagueScheduledGame] {
        switch filter {
        case .upcoming:  return vm.games.filter { !$0.isCompleted && !$0.isCancelled }
        case .completed: return vm.games.filter {  $0.isCompleted }.reversed()
        case .all:       return vm.games
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NETRTheme.background.ignoresSafeArea()

                if vm.isLoading {
                    ProgressView()
                        .tint(vm.league?.color ?? NETRTheme.neonGreen)
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            // Filter pills
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(ScheduleFilter.allCases, id: \.self) { f in
                                        Button(f.rawValue) { filter = f }
                                            .font(.system(.subheadline, weight: .semibold))
                                            .padding(.horizontal, 16).padding(.vertical, 8)
                                            .background(filter == f
                                                ? (vm.league?.color ?? NETRTheme.neonGreen).opacity(0.18)
                                                : NETRTheme.card)
                                            .foregroundStyle(filter == f
                                                ? (vm.league?.color ?? NETRTheme.neonGreen)
                                                : NETRTheme.subtext)
                                            .clipShape(Capsule())
                                            .overlay(Capsule().stroke(
                                                filter == f
                                                    ? (vm.league?.color ?? NETRTheme.neonGreen).opacity(0.4)
                                                    : NETRTheme.border,
                                                lineWidth: 1))
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                            }

                            if filtered.isEmpty {
                                ContentUnavailableView(
                                    "No Games",
                                    systemImage: "calendar.badge.exclamationmark",
                                    description: Text("No \(filter.rawValue.lowercased()) games to show.")
                                )
                                .padding(.top, 40)
                            } else {
                                LazyVStack(spacing: 10) {
                                    ForEach(filtered) { game in
                                        ScheduleGameRow(game: game, vm: vm)
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.bottom, 24)
                            }
                        }
                    }
                }
            }
            .navigationTitle(vm.league?.name ?? "Schedule")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

// MARK: - Game Row

private struct ScheduleGameRow: View {
    let game: LeagueScheduledGame
    let vm: LeagueViewModel

    private var homeTeam: LeagueTeam? { vm.team(for: game.homeTeamId) }
    private var awayTeam: LeagueTeam? { vm.team(for: game.awayTeamId) }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        VStack(spacing: 12) {
            // Date / location header
            HStack {
                Text(game.scheduledDate.map { Self.dateFormatter.string(from: $0) } ?? game.scheduledAt)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NETRTheme.subtext)
                Spacer()
                if let loc = game.location {
                    Label(loc, systemImage: "mappin.circle")
                        .font(.caption)
                        .foregroundStyle(NETRTheme.muted)
                        .lineLimit(1)
                }
            }

            // Teams + score
            HStack(spacing: 12) {
                TeamBadge(team: homeTeam, name: vm.teamName(for: game.homeTeamId))

                if game.isCompleted, let hs = game.homeScore, let as_ = game.awayScore {
                    Text("\(hs) – \(as_)")
                        .font(.system(.title3, weight: .black).width(.compressed))
                        .foregroundStyle(NETRTheme.text)
                        .frame(minWidth: 64)
                } else {
                    Text("VS")
                        .font(.system(.caption, weight: .black))
                        .foregroundStyle(NETRTheme.muted)
                        .frame(minWidth: 40)
                }

                TeamBadge(team: awayTeam, name: vm.teamName(for: game.awayTeamId))
            }

            // Status badge
            if game.isCancelled {
                Text("CANCELLED")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.red)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(.red.opacity(0.12), in: Capsule())
            }
        }
        .padding(14)
        .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NETRTheme.border, lineWidth: 1))
    }
}

private struct TeamBadge: View {
    let team: LeagueTeam?
    let name: String

    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(team?.teamColor ?? NETRTheme.card)
                .frame(width: 32, height: 32)
                .overlay(
                    Text(String(name.prefix(1)))
                        .font(.system(.caption, weight: .black))
                        .foregroundStyle(.white)
                )
            Text(name)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(NETRTheme.text)
                .lineLimit(1)
                .frame(maxWidth: 80)
        }
        .frame(maxWidth: .infinity)
    }
}
