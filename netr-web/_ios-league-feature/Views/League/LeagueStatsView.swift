// DESTINATION: ios/NETR/Views/League/LeagueStatsView.swift
//
// Shows player stat leaders fetched from league_player_stats joined
// to league_players + profiles.

import SwiftUI

struct LeagueStatsView: View {
    let vm: LeagueViewModel
    @State private var statLeaders: [StatLeader] = []
    @State private var isLoading = false
    @State private var selectedStat: StatCategory = .points

    enum StatCategory: String, CaseIterable {
        case points  = "PTS"
        case assists = "AST"
        case rebounds = "REB"
        case steals  = "STL"
        case blocks  = "BLK"
    }

    var topFive: [StatLeader] {
        statLeaders
            .filter { $0.stat == selectedStat }
            .prefix(10)
            .map { $0 }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NETRTheme.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    // Stat category picker
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(StatCategory.allCases, id: \.self) { cat in
                                Button(cat.rawValue) { selectedStat = cat }
                                    .font(.system(.subheadline, weight: .bold))
                                    .padding(.horizontal, 18).padding(.vertical, 9)
                                    .background(selectedStat == cat
                                        ? (vm.league?.color ?? NETRTheme.neonGreen).opacity(0.18)
                                        : NETRTheme.card)
                                    .foregroundStyle(selectedStat == cat
                                        ? (vm.league?.color ?? NETRTheme.neonGreen)
                                        : NETRTheme.subtext)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(
                                        selectedStat == cat
                                            ? (vm.league?.color ?? NETRTheme.neonGreen).opacity(0.4)
                                            : NETRTheme.border,
                                        lineWidth: 1))
                            }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 12)
                    }

                    if isLoading {
                        Spacer()
                        ProgressView().tint(NETRTheme.neonGreen)
                        Spacer()
                    } else if topFive.isEmpty {
                        ContentUnavailableView("No Stats Yet",
                            systemImage: "chart.bar",
                            description: Text("Stats will appear once games are scored."))
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(topFive.enumerated()), id: \.element.id) { idx, leader in
                                    StatLeaderRow(rank: idx + 1, leader: leader, accentColor: vm.league?.color)
                                    if idx < topFive.count - 1 {
                                        Divider().background(NETRTheme.border).padding(.horizontal, 16)
                                    }
                                }
                            }
                            .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(NETRTheme.border, lineWidth: 1))
                            .padding(.horizontal, 16)
                            .padding(.bottom, 24)
                        }
                    }
                }
            }
            .navigationTitle("Stats")
            .navigationBarTitleDisplayMode(.large)
            .task(id: vm.league?.id) {
                await loadStats()
            }
        }
    }

    private func loadStats() async {
        guard let leagueId = vm.league?.id else { return }
        isLoading = true
        defer { isLoading = false }

        // Fetch per-game averages via Supabase RPC or raw query
        // Using league_player_stats table joined to league_players
        struct RawStat: Decodable {
            let displayName: String
            let teamName: String?
            let points, assists, rebounds, steals, blocks: Double
            let gamesPlayed: Int

            enum CodingKeys: String, CodingKey {
                case displayName = "display_name"
                case teamName    = "team_name"
                case points, assists, rebounds, steals, blocks
                case gamesPlayed = "games_played"
            }
        }

        do {
            let raw: [RawStat] = try await SupabaseManager.shared.client
                .rpc("league_stat_leaders", params: ["p_league_id": leagueId])
                .execute()
                .value

            var leaders: [StatLeader] = []
            for stat in StatCategory.allCases {
                let sorted = raw.sorted {
                    statValue($0, stat) > statValue($1, stat)
                }
                leaders += sorted.map { r in
                    StatLeader(
                        id:          "\(r.displayName)-\(stat.rawValue)",
                        playerName:  r.displayName,
                        teamName:    r.teamName ?? "",
                        stat:        stat,
                        value:       statValue(r, stat),
                        gamesPlayed: r.gamesPlayed
                    )
                }
            }
            statLeaders = leaders
        } catch {
            // silently fail — show empty state
        }
    }

    private func statValue(_ r: any StatRowProtocol, _ cat: StatCategory) -> Double {
        switch cat {
        case .points:   return r.points
        case .assists:  return r.assists
        case .rebounds: return r.rebounds
        case .steals:   return r.steals
        case .blocks:   return r.blocks
        }
    }
}

// Dummy protocol for the generic helper above
private protocol StatRowProtocol {
    var points: Double { get }
    var assists: Double { get }
    var rebounds: Double { get }
    var steals: Double { get }
    var blocks: Double { get }
}

struct StatLeader: Identifiable {
    let id:          String
    let playerName:  String
    let teamName:    String
    let stat:        LeagueStatsView.StatCategory
    let value:       Double
    let gamesPlayed: Int
}

private struct StatLeaderRow: View {
    let rank: Int
    let leader: StatLeader
    let accentColor: Color?

    var body: some View {
        HStack(spacing: 14) {
            Text("\(rank)")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(rank == 1 ? (accentColor ?? NETRTheme.neonGreen) : NETRTheme.muted)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(leader.playerName)
                    .font(.system(.subheadline, weight: .semibold))
                    .foregroundStyle(NETRTheme.text)
                Text(leader.teamName)
                    .font(.caption)
                    .foregroundStyle(NETRTheme.subtext)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.1f", leader.value))
                    .font(.system(.title3, weight: .black).width(.compressed))
                    .foregroundStyle(accentColor ?? NETRTheme.neonGreen)
                Text("\(leader.stat.rawValue)/G")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(NETRTheme.muted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
    }
}
