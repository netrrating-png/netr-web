// DESTINATION: ios/NETR/Views/League/LeagueStandingsView.swift

import SwiftUI

struct LeagueStandingsView: View {
    let vm: LeagueViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                NETRTheme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 0) {
                        if vm.standings.isEmpty {
                            ContentUnavailableView("No Standings Yet",
                                systemImage: "trophy",
                                description: Text("Standings will appear once games are recorded."))
                                .padding(.top, 40)
                        } else {
                            standingsTable
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
                }
            }
            .navigationTitle("Standings")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private var standingsTable: some View {
        VStack(spacing: 0) {
            // Header row
            HStack(spacing: 0) {
                Text("TEAM").frame(maxWidth: .infinity, alignment: .leading)
                Text("W").frame(width: 36, alignment: .center)
                Text("L").frame(width: 36, alignment: .center)
                Text("PCT").frame(width: 48, alignment: .center)
                Text("+/-").frame(width: 48, alignment: .center)
            }
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(NETRTheme.muted)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(NETRTheme.surface)

            Divider().background(NETRTheme.border)

            ForEach(Array(vm.standings.enumerated()), id: \.element.id) { idx, row in
                HStack(spacing: 0) {
                    // Rank + team color dot + name
                    HStack(spacing: 8) {
                        Text("\(idx + 1)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(NETRTheme.muted)
                            .frame(width: 20)
                        Circle()
                            .fill(row.teamColor)
                            .frame(width: 10, height: 10)
                        Text(row.teamName)
                            .font(.system(.subheadline, weight: .semibold))
                            .foregroundStyle(NETRTheme.text)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Text("\(row.wins)")
                        .monospacedDigit()
                        .frame(width: 36, alignment: .center)
                        .foregroundStyle(NETRTheme.text)

                    Text("\(row.losses)")
                        .monospacedDigit()
                        .frame(width: 36, alignment: .center)
                        .foregroundStyle(NETRTheme.text)

                    Text(String(format: "%.3f", row.winPct).dropFirst())
                        .monospacedDigit()
                        .font(.system(.caption, weight: .medium))
                        .frame(width: 48, alignment: .center)
                        .foregroundStyle(NETRTheme.subtext)

                    Text(row.pointDiff > 0 ? "+\(row.pointDiff)" : "\(row.pointDiff)")
                        .monospacedDigit()
                        .font(.system(.caption, weight: .medium))
                        .frame(width: 48, alignment: .center)
                        .foregroundStyle(row.pointDiff > 0 ? NETRTheme.neonGreen
                                       : row.pointDiff < 0 ? .red : NETRTheme.muted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(idx % 2 == 0 ? NETRTheme.card : NETRTheme.background)

                if idx < vm.standings.count - 1 {
                    Divider().background(NETRTheme.border).padding(.horizontal, 14)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NETRTheme.border, lineWidth: 1))
    }
}
